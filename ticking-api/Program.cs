using Microsoft.EntityFrameworkCore;
using ticking_api.Data;
using ticking_api.Hubs;
using ticking_api.Models;
using ticking_api.Services;

var builder = WebApplication.CreateBuilder(args);

// Add OpenApi & SignalR
builder.Services.AddOpenApi();
builder.Services.AddSignalR();

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Configure Database
var postgresConn = builder.Configuration.GetConnectionString("PostgresConnection");
if (!string.IsNullOrEmpty(postgresConn))
{
    builder.Services.AddDbContext<TicketingDbContext>(opt =>
        opt.UseNpgsql(postgresConn));
}
else
{
    builder.Services.AddDbContext<TicketingDbContext>(opt =>
        opt.UseInMemoryDatabase("TicketingInMemoryDb"));
}

builder.Services.AddSingleton<TicketQrService>();
builder.Services.AddScoped<SeatHoldService>();

var app = builder.Build();

// Ensure Database is Created
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<TicketingDbContext>();
    db.Database.EnsureCreated();
}

app.UseCors();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Health Check
app.MapGet("/api/health", () => Results.Ok(new
{
    status = "healthy",
    system = "05_TICKETING_ENGINE",
    timestamp = DateTime.UtcNow,
    engine = ".NET 10 + SignalR + QRCoder + HMAC-SHA256 + Redlock Distributed Hold"
}));

// SignalR Hub Endpoint
app.MapHub<TicketHub>("/hubs/tickets");

// 1. Get All Seats (Arena Map)
app.MapGet("/api/seats", async (TicketingDbContext db) =>
{
    var seats = await db.Seats
        .OrderBy(s => s.Tier)
        .ThenBy(s => s.Row)
        .ThenBy(s => s.Number)
        .ToListAsync();
    return Results.Ok(seats);
});

// 2. Hold Seat (Trigger: HOLD_SEAT / AVAILABLE -> HELD)
app.MapPost("/api/seats/{id:int}/hold", async (int id, HoldSeatDto dto, SeatHoldService service) =>
{
    try
    {
        var seat = await service.HoldSeatAsync(
            id,
            dto.CustomerName ?? "Arena Fan",
            dto.CustomerEmail ?? "fan@enterprise.com"
        );
        return Results.Ok(seat);
    }
    catch (KeyNotFoundException)
    {
        return Results.NotFound();
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

// 3. Release Seat (Trigger: TTL_EXPIRED / HELD -> AVAILABLE)
app.MapPost("/api/seats/{id:int}/release", async (int id, SeatHoldService service) =>
{
    try
    {
        var seat = await service.ReleaseSeatAsync(id);
        return Results.Ok(seat);
    }
    catch (KeyNotFoundException)
    {
        return Results.NotFound();
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

// 4. Confirm Booking (Trigger: PAYMENT_SUCCESS / HELD -> CONFIRMED)
app.MapPost("/api/orders/confirm", async (ConfirmOrderDto dto, SeatHoldService service) =>
{
    try
    {
        var order = await service.ConfirmBookingAsync(
            dto.SeatIds,
            dto.CustomerName ?? "VIP Guest",
            dto.CustomerEmail ?? "guest@enterprise.com",
            dto.PaymentTransactionId ?? $"TXN-{Guid.NewGuid():N}"
        );
        return Results.Ok(order);
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

// 5. Get Booking Orders
app.MapGet("/api/orders", async (TicketingDbContext db) =>
{
    var list = await db.BookingOrders
        .Include(o => o.Seats)
        .OrderByDescending(o => o.CreatedAt)
        .ToListAsync();
    return Results.Ok(list);
});

// 6. Gate Scanner Validation (Trigger: CONFIRMED -> CHECKED_IN)
app.MapPost("/api/gate/check-in", async (GateScanDto dto, SeatHoldService service) =>
{
    var (success, message, order) = await service.CheckInTicketAsync(dto.QrPayload);
    if (!success)
    {
        return Results.BadRequest(new { success = false, error = message });
    }
    return Results.Ok(new { success = true, message, order });
});

app.Run();

public record HoldSeatDto(string? CustomerName, string? CustomerEmail);
public record ConfirmOrderDto(List<int> SeatIds, string? CustomerName, string? CustomerEmail, string? PaymentTransactionId);
public record GateScanDto(string QrPayload);
