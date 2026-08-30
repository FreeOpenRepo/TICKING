system: 05_TICKETING_ENGINE
tech_stack:
  frontend: "Next.js 16 (Edge SSR) + react-konva + @stripe/stripe-js + @microsoft/signalr"
  backend: ".NET 10 (Native AOT) + Medallion.Threading.Redis + QRCoder + HMAC-SHA256"
  orm: "EF Core 10 (Npgsql.EntityFrameworkCore.PostgreSQL)"
  storage: "Redis 7.2 (TTL Expiry) + PostgreSQL 18"
  protocols: "HTTPS, WSS (SignalR), Payment Webhooks"
spec:
  actors: [Customer, PaymentWebhook, GateScanner]
  invariants: [StrictlyZeroDoubleBooking, HoldTokenTtlExact600Seconds]
  state_transitions:
    - { from: AVAILABLE, to: HELD, trigger: HOLD_SEAT, handler: "Ticketing.HoldSeat", locking: "RedisRedlock:seat_{id}", side_effects: ["Redis.SetTtl600", "SignalR.BroadcastLock"] }
    - { from: HELD, to: AVAILABLE, trigger: TTL_EXPIRED, handler: "Ticketing.ReleaseSeat" }
    - { from: HELD, to: CONFIRMED, trigger: PAYMENT_SUCCESS, handler: "Ticketing.ConfirmBooking", side_effects: ["QRCoder.GenerateHmacSignedQr", "Email.DispatchTicket"] }