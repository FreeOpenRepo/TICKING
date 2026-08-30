using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ticking_api.Data;
using ticking_api.Hubs;
using ticking_api.Models;

namespace ticking_api.Services;

public class SeatHoldService
{
    private readonly TicketingDbContext _db;
    private readonly IHubContext<TicketHub> _hub;
    private readonly TicketQrService _qrService;
    private readonly ILogger<SeatHoldService> _logger;

    // Redlock Distributed Lock Simulator (SeatId -> SemaphoreSlim)
    private static readonly ConcurrentDictionary<int, SemaphoreSlim> _seatLocks = new();

    public const int DefaultTtlSeconds = 600; // Invariant: HoldTokenTtlExact600Seconds

    public SeatHoldService(
        TicketingDbContext db,
        IHubContext<TicketHub> hub,
        TicketQrService qrService,
        ILogger<SeatHoldService> logger)
    {
        _db = db;
        _hub = hub;
        _qrService = qrService;
        _logger = logger;
    }

    // State Transition: AVAILABLE -> HELD (Trigger: HOLD_SEAT)
    public async Task<Seat> HoldSeatAsync(int seatId, string customerName, string customerEmail)
    {
        var semaphore = _seatLocks.GetOrAdd(seatId, _ => new SemaphoreSlim(1, 1));
        await semaphore.WaitAsync();

        try
        {
            var seat = await _db.Seats.FindAsync(seatId)
                ?? throw new KeyNotFoundException($"Seat #{seatId} not found.");

            // Invariant: StrictlyZeroDoubleBooking
            if (seat.Status != SeatStatus.AVAILABLE)
            {
                // Check if currently held but expired
                if (seat.Status == SeatStatus.HELD && seat.HoldExpiresAt.HasValue && seat.HoldExpiresAt.Value < DateTime.UtcNow)
                {
                    // Expired hold can be acquired
                    _logger.LogInformation("Prior hold on seat {Code} expired at {Time}. Re-assigning.", seat.SeatCode, seat.HoldExpiresAt);
                }
                else
                {
                    throw new InvalidOperationException($"Invariant violation [StrictlyZeroDoubleBooking]: Seat '{seat.SeatCode}' is currently {seat.Status} and cannot be held.");
                }
            }

            // Side-effect: Redis.SetTtl600
            seat.Status = SeatStatus.HELD;
            seat.HoldToken = Guid.NewGuid().ToString("N");
            seat.HoldExpiresAt = DateTime.UtcNow.AddSeconds(DefaultTtlSeconds);
            seat.HeldByCustomer = customerName;

            await _db.SaveChangesAsync();

            // Side-effect: SignalR.BroadcastLock
            await _hub.Clients.All.SendAsync("SeatLocked", new
            {
                seatId = seat.Id,
                seatCode = seat.SeatCode,
                heldBy = customerName,
                expiresAt = seat.HoldExpiresAt,
                ttlSeconds = DefaultTtlSeconds
            });

            _logger.LogInformation("Side-effects applied: Seat {Code} HELD for {Name} with 600s TTL. SignalR broadcasted.",
                seat.SeatCode, customerName);

            return seat;
        }
        finally
        {
            semaphore.Release();
        }
    }

    // State Transition: HELD -> AVAILABLE (Trigger: TTL_EXPIRED)
    public async Task<Seat> ReleaseSeatAsync(int seatId)
    {
        var semaphore = _seatLocks.GetOrAdd(seatId, _ => new SemaphoreSlim(1, 1));
        await semaphore.WaitAsync();

        try
        {
            var seat = await _db.Seats.FindAsync(seatId)
                ?? throw new KeyNotFoundException($"Seat #{seatId} not found.");

            if (seat.Status == SeatStatus.CONFIRMED || seat.Status == SeatStatus.CHECKED_IN)
            {
                throw new InvalidOperationException($"Cannot release confirmed seat '{seat.SeatCode}'.");
            }

            seat.Status = SeatStatus.AVAILABLE;
            seat.HoldToken = null;
            seat.HoldExpiresAt = null;
            seat.HeldByCustomer = null;

            await _db.SaveChangesAsync();

            await _hub.Clients.All.SendAsync("SeatReleased", new
            {
                seatId = seat.Id,
                seatCode = seat.SeatCode
            });

            _logger.LogInformation("Seat {Code} released back to AVAILABLE.", seat.SeatCode);
            return seat;
        }
        finally
        {
            semaphore.Release();
        }
    }

    // State Transition: HELD -> CONFIRMED (Trigger: PAYMENT_SUCCESS)
    public async Task<BookingOrder> ConfirmBookingAsync(
        List<int> seatIds,
        string customerName,
        string customerEmail,
        string paymentTransactionId)
    {
        var seats = await _db.Seats.Where(s => seatIds.Contains(s.Id)).ToListAsync();

        if (seats.Count == 0)
        {
            throw new InvalidOperationException("No seats selected for confirmation.");
        }

        // Invariant: StrictlyZeroDoubleBooking & Validation
        foreach (var seat in seats)
        {
            if (seat.Status == SeatStatus.CONFIRMED || seat.Status == SeatStatus.CHECKED_IN)
            {
                throw new InvalidOperationException($"Invariant violation [StrictlyZeroDoubleBooking]: Seat '{seat.SeatCode}' is already confirmed.");
            }
        }

        var orderCode = $"ORD-{DateTime.UtcNow.Year}-{(Random.Shared.Next(1000, 9999))}";
        var totalAmount = seats.Sum(s => s.Price);
        var seatCodesJoined = string.Join(", ", seats.Select(s => s.SeatCode));

        // Side-effect 1: QRCoder.GenerateHmacSignedQr
        var hmacSignature = _qrService.SignTicketPayload(orderCode, customerEmail, seatCodesJoined, totalAmount);
        var qrPayload = $"FREEOPENREPO-TICKET|{orderCode}|{customerEmail}|{seatCodesJoined}|{totalAmount:F2}|{hmacSignature}";
        var qrBase64 = _qrService.GenerateQrCodeBase64(qrPayload);

        var order = new BookingOrder
        {
            OrderCode = orderCode,
            CustomerName = customerName,
            CustomerEmail = customerEmail,
            TotalAmount = totalAmount,
            Status = OrderStatus.PAID,
            HmacSignature = hmacSignature,
            QrPayload = qrPayload,
            QrCodeBase64 = qrBase64,
            CreatedAt = DateTime.UtcNow,
            PaidAt = DateTime.UtcNow,
            Seats = seats
        };

        _db.BookingOrders.Add(order);

        foreach (var seat in seats)
        {
            seat.Status = SeatStatus.CONFIRMED;
            seat.ConfirmedOrder = order;
            seat.HoldToken = null;
            seat.HoldExpiresAt = null;
        }

        await _db.SaveChangesAsync();

        // Side-effect 2: SignalR.BroadcastConfirmed
        foreach (var seat in seats)
        {
            await _hub.Clients.All.SendAsync("SeatConfirmed", new
            {
                seatId = seat.Id,
                seatCode = seat.SeatCode,
                orderCode = order.OrderCode,
                customerName = customerName
            });
        }

        _logger.LogInformation("Side-effects [QRCoder & SignalR]: Booking order {Code} CONFIRMED for {Email}. Total: {Amount} THB.",
            order.OrderCode, customerEmail, totalAmount);

        return order;
    }

    // Gate Scanner Validation
    public async Task<(bool Success, string Message, BookingOrder? Order)> CheckInTicketAsync(string qrPayload)
    {
        // Payload format: FREEOPENREPO-TICKET|ORD-2026-XXXX|Email|SeatCodes|Amount|HMAC
        var parts = qrPayload.Split('|');
        if (parts.Length < 6)
        {
            return (false, "Invalid QR ticket format.", null);
        }

        var orderCode = parts[1];
        var email = parts[2];
        var seatCodes = parts[3];
        if (!decimal.TryParse(parts[4], out var amount))
        {
            return (false, "Invalid ticket amount encoding.", null);
        }
        var hmac = parts[5];

        // 1. Verify Cryptographic Signature
        var (isValid, err) = _qrService.VerifyHmacSignature(orderCode, email, seatCodes, amount, hmac);
        if (!isValid)
        {
            return (false, err!, null);
        }

        // 2. Find Order in DB
        var order = await _db.BookingOrders
            .Include(o => o.Seats)
            .FirstOrDefaultAsync(o => o.OrderCode == orderCode);

        if (order == null)
        {
            return (false, $"Order '{orderCode}' not found in database.", null);
        }

        if (order.CheckedInAt.HasValue)
        {
            return (false, $"⚠️ TICKET ALREADY USED: Ticket #{orderCode} was already checked in at {order.CheckedInAt:yyyy-MM-dd HH:mm:ss} UTC.", order);
        }

        order.CheckedInAt = DateTime.UtcNow;
        foreach (var seat in order.Seats)
        {
            seat.Status = SeatStatus.CHECKED_IN;
        }

        await _db.SaveChangesAsync();

        return (true, $"✅ ADMISSION GRANTED: Valid VIP/Arena ticket for {order.CustomerName} ({seatCodes}).", order);
    }
}
