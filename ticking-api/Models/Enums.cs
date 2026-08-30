namespace ticking_api.Models;

public enum SeatStatus
{
    AVAILABLE,
    HELD,
    CONFIRMED,
    CHECKED_IN
}

public enum SeatTier
{
    VIP_FLOOR,
    ZONE_A,
    ZONE_B
}

public enum OrderStatus
{
    PENDING,
    PAID,
    EXPIRED,
    CANCELLED
}

public enum ActorRole
{
    Customer,
    PaymentWebhook,
    GateScanner
}
