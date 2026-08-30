using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ticking_api.Data;
using ticking_api.Hubs;
using ticking_api.Models;
using ticking_api.Services;
using Xunit;

namespace ticking_api.Tests;

public class DomainInvariantTests
{
    private TicketingDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<TicketingDbContext>()
            .UseInMemoryDatabase(databaseName: $"TicketingTestDb_{Guid.NewGuid()}")
            .Options;

        var db = new TicketingDbContext(options);
        db.Database.EnsureCreated();
        return db;
    }

    private IHubContext<TicketHub> CreateMockHub()
    {
        var mockClients = new Mock<IHubClients>();
        var mockClientProxy = new Mock<IClientProxy>();
        mockClients.Setup(c => c.All).Returns(mockClientProxy.Object);

        var mockHub = new Mock<IHubContext<TicketHub>>();
        mockHub.Setup(h => h.Clients).Returns(mockClients.Object);

        return mockHub.Object;
    }

    [Fact]
    public async Task Invariant_StrictlyZeroDoubleBooking_RejectsConcurrentHoldAttempts()
    {
        using var db = CreateInMemoryDbContext();
        var hub = CreateMockHub();
        var qrService = new TicketQrService();
        var service = new SeatHoldService(db, hub, qrService, NullLogger<SeatHoldService>.Instance);

        // First customer holds Seat 1
        var heldSeat = await service.HoldSeatAsync(1, "Customer Alice", "alice@test.com");
        Assert.Equal(SeatStatus.HELD, heldSeat.Status);
        Assert.NotNull(heldSeat.HoldToken);
        Assert.NotNull(heldSeat.HoldExpiresAt);

        // Second customer attempts to hold the same Seat 1 -> Must throw Invariant Violation
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.HoldSeatAsync(1, "Customer Bob", "bob@test.com")
        );

        Assert.Contains("StrictlyZeroDoubleBooking", ex.Message);
    }

    [Fact]
    public async Task Invariant_HoldTokenTtlExact600Seconds_ExpiresAndReleasesSeat()
    {
        using var db = CreateInMemoryDbContext();
        var hub = CreateMockHub();
        var qrService = new TicketQrService();
        var service = new SeatHoldService(db, hub, qrService, NullLogger<SeatHoldService>.Instance);

        // Hold Seat 2
        var held = await service.HoldSeatAsync(2, "Charlie", "charlie@test.com");
        Assert.Equal(SeatStatus.HELD, held.Status);

        // Verify TTL is ~600 seconds
        var secondsUntilExpiry = (held.HoldExpiresAt!.Value - DateTime.UtcNow).TotalSeconds;
        Assert.True(secondsUntilExpiry >= 590 && secondsUntilExpiry <= 601, $"Expected ~600s TTL, got {secondsUntilExpiry}");

        // Manually simulate TTL expiration
        held.HoldExpiresAt = DateTime.UtcNow.AddMinutes(-5); // Expired in past
        await db.SaveChangesAsync();

        // New customer can now acquire expired hold
        var reacquired = await service.HoldSeatAsync(2, "David", "david@test.com");
        Assert.Equal("David", reacquired.HeldByCustomer);
        Assert.Equal(SeatStatus.HELD, reacquired.Status);
    }

    [Fact]
    public async Task StateTransitions_ConfirmBooking_GeneratesHmacSignedQrTicketAndValidatesAtGate()
    {
        using var db = CreateInMemoryDbContext();
        var hub = CreateMockHub();
        var qrService = new TicketQrService();
        var service = new SeatHoldService(db, hub, qrService, NullLogger<SeatHoldService>.Instance);

        // 1. Hold Seats 3 & 4
        await service.HoldSeatAsync(3, "Eve", "eve@test.com");
        await service.HoldSeatAsync(4, "Eve", "eve@test.com");

        // 2. PAYMENT_SUCCESS -> Confirm Booking
        var order = await service.ConfirmBookingAsync(new() { 3, 4 }, "Eve", "eve@test.com", "STRIPE_TXN_998877");
        Assert.Equal(OrderStatus.PAID, order.Status);
        Assert.NotNull(order.HmacSignature);
        Assert.NotNull(order.QrPayload);
        Assert.NotNull(order.QrCodeBase64);

        // 3. Gate Scanner: Valid Check-in
        var (success, msg, checkedOrder) = await service.CheckInTicketAsync(order.QrPayload);
        Assert.True(success, $"Valid ticket must pass gate check: {msg}");
        Assert.NotNull(checkedOrder?.CheckedInAt);

        // 4. Duplicate Check-in Attempt -> Must be Rejected
        var (dupSuccess, dupMsg, _) = await service.CheckInTicketAsync(order.QrPayload);
        Assert.False(dupSuccess, "Duplicate check-in attempt must be rejected");
        Assert.Contains("ALREADY USED", dupMsg);

        // 5. Tampered Ticket HMAC -> Must be Rejected
        var tamperedPayload = order.QrPayload.Replace("eve@test.com", "hacker@evil.com");
        var (tamperSuccess, tamperMsg, _) = await service.CheckInTicketAsync(tamperedPayload);
        Assert.False(tamperSuccess, "Tampered payload with invalid HMAC must be rejected");
        Assert.Contains("verification failed", tamperMsg);
    }
}
