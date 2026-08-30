import { Seat, BookingOrder } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5080';

export async function fetchSeats(): Promise<Seat[]> {
  const res = await fetch(`${API_BASE}/api/seats`);
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return await res.json();
}

export async function holdSeat(seatId: number, customerName: string, customerEmail: string): Promise<Seat> {
  const res = await fetch(`${API_BASE}/api/seats/${seatId}/hold`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerName, customerEmail })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Seat hold failed' }));
    throw new Error(err.error || `HTTP error ${res.status}`);
  }

  return await res.json();
}

export async function releaseSeat(seatId: number): Promise<Seat> {
  const res = await fetch(`${API_BASE}/api/seats/${seatId}/release`, {
    method: 'POST'
  });

  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return await res.json();
}

export async function confirmOrder(payload: {
  seatIds: number[];
  customerName: string;
  customerEmail: string;
  paymentTransactionId?: string;
}): Promise<BookingOrder> {
  const res = await fetch(`${API_BASE}/api/orders/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Payment confirmation failed' }));
    throw new Error(err.error || `HTTP error ${res.status}`);
  }

  return await res.json();
}

export async function fetchOrders(): Promise<BookingOrder[]> {
  const res = await fetch(`${API_BASE}/api/orders`);
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return await res.json();
}

export async function checkInGate(qrPayload: string): Promise<{ success: boolean; message: string; order?: BookingOrder }> {
  const res = await fetch(`${API_BASE}/api/gate/check-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qrPayload })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gate check-in failed');
  }

  return data;
}
