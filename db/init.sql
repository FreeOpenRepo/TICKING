-- =============================================================================
-- High-Throughput Event Ticketing Engine Initial Database (ticking_db)
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DROP TABLE IF EXISTS "Tickets" CASCADE;
DROP TABLE IF EXISTS "Seats" CASCADE;
DROP TABLE IF EXISTS "Events" CASCADE;

-- 1. Events
CREATE TABLE "Events" (
    "Id" SERIAL PRIMARY KEY,
    "EventCode" VARCHAR(50) NOT NULL UNIQUE,
    "Title" VARCHAR(255) NOT NULL,
    "VenueName" VARCHAR(200) NOT NULL,
    "EventDate" TIMESTAMP WITH TIME ZONE NOT NULL,
    "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Seats (State transitions: AVAILABLE -> HELD -> CONFIRMED -> CHECKED_IN)
CREATE TABLE "Seats" (
    "Id" SERIAL PRIMARY KEY,
    "EventId" INT NOT NULL REFERENCES "Events"("Id") ON DELETE CASCADE,
    "SeatNumber" VARCHAR(20) NOT NULL,
    "Zone" VARCHAR(50) NOT NULL,
    "Row" VARCHAR(10) NOT NULL,
    "Price" NUMERIC(10, 2) NOT NULL,
    "Status" VARCHAR(50) DEFAULT 'AVAILABLE', -- AVAILABLE, HELD, CONFIRMED, CHECKED_IN
    "HoldToken" VARCHAR(100),
    "HeldByUserId" VARCHAR(100),
    "HoldExpiresAt" TIMESTAMP WITH TIME ZONE,
    "Version" INT DEFAULT 1, -- Optimistic concurrency lock
    CONSTRAINT "UQ_Event_Seat" UNIQUE ("EventId", "SeatNumber")
);

-- 3. Tickets (HMAC-SHA256 Signed QR verification)
CREATE TABLE "Tickets" (
    "Id" SERIAL PRIMARY KEY,
    "TicketNumber" VARCHAR(50) NOT NULL UNIQUE,
    "SeatId" INT NOT NULL REFERENCES "Seats"("Id"),
    "CustomerName" VARCHAR(150) NOT NULL,
    "CustomerEmail" VARCHAR(150) NOT NULL,
    "HmacSignature" VARCHAR(255) NOT NULL,
    "QrCodeBase64" TEXT,
    "IsCheckedIn" BOOLEAN DEFAULT FALSE,
    "CheckedInAt" TIMESTAMP WITH TIME ZONE,
    "PurchasedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed Initial Concert Event & Arena Seats
INSERT INTO "Events" ("Id", "EventCode", "Title", "VenueName", "EventDate") VALUES
(1, 'EVT-2026-IMPACT', 'Grand Symphony Arena World Tour 2026', 'Impact Arena Hall 1', CURRENT_TIMESTAMP + INTERVAL '30 days')
ON CONFLICT ("Id") DO NOTHING;

-- Seed Seats for Event #1
INSERT INTO "Seats" ("EventId", "SeatNumber", "Zone", "Row", "Price", "Status") VALUES
(1, 'VIP-A01', 'VIP Royal', 'A', 5500.00, 'AVAILABLE'),
(1, 'VIP-A02', 'VIP Royal', 'A', 5500.00, 'AVAILABLE'),
(1, 'VIP-A03', 'VIP Royal', 'A', 5500.00, 'AVAILABLE'),
(1, 'VIP-A04', 'VIP Royal', 'A', 5500.00, 'AVAILABLE'),
(1, 'STD-B01', 'Standard Gold', 'B', 3200.00, 'AVAILABLE'),
(1, 'STD-B02', 'Standard Gold', 'B', 3200.00, 'AVAILABLE'),
(1, 'STD-B03', 'Standard Gold', 'B', 3200.00, 'AVAILABLE'),
(1, 'STD-B04', 'Standard Gold', 'B', 3200.00, 'AVAILABLE')
ON CONFLICT ("EventId", "SeatNumber") DO NOTHING;

SELECT setval(pg_get_serial_sequence('"Events"', 'Id'), COALESCE(max("Id"), 1)) FROM "Events";
SELECT setval(pg_get_serial_sequence('"Seats"', 'Id'), COALESCE(max("Id"), 1)) FROM "Seats";
