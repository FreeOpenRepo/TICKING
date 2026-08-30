namespace ticking_api.Models;

public class Seat
{
    public int Id { get; set; }
    public string SeatCode { get; set; } = string.Empty; // e.g. "VIP-A1", "ZA-B3"
    public string Section { get; set; } = "VIP Arena";
    public string Row { get; set; } = "A";
    public int Number { get; set; } = 1;
    public SeatTier Tier { get; set; } = SeatTier.VIP_FLOOR;
    public decimal Price { get; set; } = 5500m;

    public SeatStatus Status { get; set; } = SeatStatus.AVAILABLE;

    // Invariant: HoldTokenTtlExact600Seconds
    public string? HoldToken { get; set; }
    public DateTime? HoldExpiresAt { get; set; }
    public string? HeldByCustomer { get; set; }

    public int? ConfirmedOrderId { get; set; }
    public BookingOrder? ConfirmedOrder { get; set; }
}

public class BookingOrder
{
    public int Id { get; set; }
    public string OrderCode { get; set; } = string.Empty; // e.g. "ORD-2026-8801"
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerEmail { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.PENDING;

    // Cryptographic Side-effect: QRCoder.GenerateHmacSignedQr
    public string? HmacSignature { get; set; }
    public string? QrPayload { get; set; }
    public string? QrCodeBase64 { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }
    public DateTime? CheckedInAt { get; set; }

    public List<Seat> Seats { get; set; } = new();
}
