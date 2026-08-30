export type SeatStatus = 'AVAILABLE' | 'HELD' | 'CONFIRMED' | 'CHECKED_IN';
export type SeatTier = 'VIP_FLOOR' | 'ZONE_A' | 'ZONE_B';
export type OrderStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
export type ActorRole = 'Customer' | 'PaymentWebhook' | 'GateScanner';

export interface Seat {
  id: number;
  seatCode: string;
  section: string;
  row: string;
  number: number;
  tier: SeatTier;
  price: number;
  status: SeatStatus;
  holdToken?: string;
  holdExpiresAt?: string;
  heldByCustomer?: string;
  confirmedOrderId?: number;
}

export interface BookingOrder {
  id: number;
  orderCode: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  status: OrderStatus;
  hmacSignature?: string;
  qrPayload?: string;
  qrCodeBase64?: string;
  createdAt: string;
  paidAt?: string;
  checkedInAt?: string;
  seats: Seat[];
}
