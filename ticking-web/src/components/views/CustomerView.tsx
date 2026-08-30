import { showSuccess, showError, showInfo, showWarning, showยืนยัน } from '@/lib/swal';
'use client';

import React, { useState, useEffect } from 'react';
import { Seat, BookingOrder } from '@/lib/types';
import { fetchSeats, holdSeat, releaseSeat, confirmOrder } from '@/lib/api';
import * as signalR from '@microsoft/signalr';
import { Ticket, Lock, Clock, CreditCard, Sparkles, CheckCircle2, ShieldCheck, Download, AlertTriangle, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function CustomerView() {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [heldSeats, setHeldSeats] = useState<Seat[]>([]);
  const [customerName, setCustomerName] = useState('Alex Mercer');
  const [customerEmail, setCustomerEmail] = useState('alex.mercer@enterprise.com');
  const [confirmedOrder, setยืนยันedOrder] = useState<BookingOrder | null>(null);

  // 600s Countdown Timer
  const [timeLeft, setTimeLeft] = useState<number>(600);
  const [isProcessing, setIsProcessing] = useState(false);
  const [signalrConnected, setSignalrConnected] = useState(false);

  useEffect(() => {
    loadSeats();

    // SignalR Setup
    const connection = new signalR.HubConnectionBuilder()
      .withUrl('http://localhost:5080/hubs/tickets')
      .withAutomaticReconnect()
      .build();

    connection.on('SeatLocked', (payload: { seatId: number; seatCode: string; heldBy: string }) => {
      setSeats(prev => prev.map(s => s.id === payload.seatId ? { ...s, status: 'HELD', heldByCustomer: payload.heldBy } : s));
    });

    connection.on('SeatReleased', (payload: { seatId: number; seatCode: string }) => {
      setSeats(prev => prev.map(s => s.id === payload.seatId ? { ...s, status: 'AVAILABLE', heldByCustomer: undefined } : s));
    });

    connection.on('Seatยืนยันed', (payload: { seatId: number; seatCode: string; orderCode: string }) => {
      setSeats(prev => prev.map(s => s.id === payload.seatId ? { ...s, status: 'CONFIRMED' } : s));
    });

    connection.start()
      .then(() => setSignalrConnected(true))
      .catch(err => console.error('SignalR error:', err));

    return () => {
      connection.stop();
    };
  }, []);

  // Timer interval for held seats
  useEffect(() => {
    if (heldSeats.length === 0) {
      setTimeLeft(600);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          // Release held seats on local timeout
          heldSeats.forEach(s => releaseSeat(s.id).catch(() => {}));
          setHeldSeats([]);
          showInfo('แจ้งเตือนระบบ', '⏰ Hold token expired (600s TTL). Seats released back to available pool.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [heldSeats]);

  async function loadSeats() {
    try {
      const list = await fetchSeats();
      setSeats(list);
    } catch (err: any) {
      console.error(err);
    }
  }

  async function handleSelectSeat(seat: Seat) {
    if (seat.status === 'CONFIRMED' || seat.status === 'CHECKED_IN') return;

    if (heldSeats.some(s => s.id === seat.id)) {
      // Unhold
      try {
        await releaseSeat(seat.id);
        setHeldSeats(prev => prev.filter(s => s.id !== seat.id));
        await loadSeats();
      } catch (err: any) {
        showInfo('แจ้งเตือนระบบ', err.message);
      }
      return;
    }

    if (seat.status === 'HELD' && !heldSeats.some(s => s.id === seat.id)) {
      showInfo('แจ้งเตือนระบบ', `Seat ${seat.seatCode} is currently held by another user.`);
      return;
    }

    // Hold Seat
    try {
      const updated = await holdSeat(seat.id, customerName, customerEmail);
      setHeldSeats(prev => [...prev, updated]);
      await loadSeats();
    } catch (err: any) {
      showInfo('แจ้งเตือนระบบ', 'Hold rejected: ' + err.message);
    }
  }

  async function handlePaymentCheckout() {
    if (heldSeats.length === 0) return;
    setIsProcessing(true);

    try {
      const order = await confirmOrder({
        seatIds: heldSeats.map(s => s.id),
        customerName,
        customerEmail,
        paymentTransactionId: `STRIPE_CH_${Date.now()}`
      });

      setยืนยันedOrder(order);
      setHeldSeats([]);
      await loadSeats();
      confetti({ particleCount: 90, spread: 100, origin: { y: 0.6 } });
    } catch (err: any) {
      showInfo('แจ้งเตือนระบบ', 'Payment failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const totalHoldAmount = heldSeats.reduce((acc, s) => acc + s.price, 0);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 16px', minHeight: '100vh' }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Ticket style={{ color: 'var(--accent-vip)', width: 28, height: 28 }} />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Arena Concert Live Seat Reservation Desk</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
            SignalR WSS Real-Time multi-user locking • 600s Redlock hold token • HMAC-SHA256 cryptographic ticket pass
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: 12, height: 12, borderRadius: '4px', background: 'rgba(236, 72, 153, 0.4)', border: '1px solid #ec4899' }} />
            <span>VIP (5,500 ฿)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: 12, height: 12, borderRadius: '4px', background: 'rgba(6, 182, 212, 0.4)', border: '1px solid #06b6d4' }} />
            <span>Zone A (3,500 ฿)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: 12, height: 12, borderRadius: '4px', background: 'rgba(99, 102, 241, 0.4)', border: '1px solid #6366f1' }} />
            <span>Zone B (2,000 ฿)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: 12, height: 12, borderRadius: '4px', background: 'rgba(245, 158, 11, 0.4)', border: '1px solid #f59e0b' }} />
            <span>Held (600s TTL)</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Left: Stadium Arena Map */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Stage Banner */}
          <div style={{ width: '80%', padding: '10px', borderRadius: '12px', background: 'linear-gradient(90deg, #ec4899, #8b5cf6, #06b6d4)', color: '#fff', fontWeight: 800, fontSize: '0.9rem', textAlign: 'center', letterSpacing: '0.2em', marginBottom: '32px', boxShadow: '0 0 24px rgba(236,72,153,0.4)' }}>
            ✦ MAIN CONCERT STAGE & AUDIO VISUAL MATRIX ✦
          </div>

          {/* Seat Grid Sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', width: '100%', alignItems: 'center' }}>
            {/* VIP Section */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-vip)', marginBottom: '8px' }}>
                VIP CENTER STAGE FLOOR (5,500 THB)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 44px)', gap: '8px' }}>
                {seats.filter(s => s.tier === 'VIP_FLOOR').map(seat => {
                  const isMine = heldSeats.some(s => s.id === seat.id);
                  return (
                    <div
                      key={seat.id}
                      onClick={() => handleSelectSeat(seat)}
                      className={`seat-node seat-vip ${seat.status === 'HELD' ? 'seat-held' : ''} ${seat.status === 'CONFIRMED' ? 'seat-confirmed' : ''} ${seat.status === 'CHECKED_IN' ? 'seat-checkedin' : ''}`}
                      style={{ border: isMine ? '2px solid #fff' : undefined }}
                    >
                      {seat.seatCode.split('-')[1]}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Zone A Section */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-zoneA)', marginBottom: '8px' }}>
                ZONE A TIER 1 (3,500 THB)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 44px)', gap: '8px' }}>
                {seats.filter(s => s.tier === 'ZONE_A').map(seat => {
                  const isMine = heldSeats.some(s => s.id === seat.id);
                  return (
                    <div
                      key={seat.id}
                      onClick={() => handleSelectSeat(seat)}
                      className={`seat-node seat-zonea ${seat.status === 'HELD' ? 'seat-held' : ''} ${seat.status === 'CONFIRMED' ? 'seat-confirmed' : ''} ${seat.status === 'CHECKED_IN' ? 'seat-checkedin' : ''}`}
                      style={{ border: isMine ? '2px solid #fff' : undefined }}
                    >
                      {seat.seatCode.split('-')[1]}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Zone B Section */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-zoneB)', marginBottom: '8px' }}>
                ZONE B GRANDSTAND (2,000 THB)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 44px)', gap: '8px' }}>
                {seats.filter(s => s.tier === 'ZONE_B').map(seat => {
                  const isMine = heldSeats.some(s => s.id === seat.id);
                  return (
                    <div
                      key={seat.id}
                      onClick={() => handleSelectSeat(seat)}
                      className={`seat-node seat-zoneb ${seat.status === 'HELD' ? 'seat-held' : ''} ${seat.status === 'CONFIRMED' ? 'seat-confirmed' : ''} ${seat.status === 'CHECKED_IN' ? 'seat-checkedin' : ''}`}
                      style={{ border: isMine ? '2px solid #fff' : undefined }}
                    >
                      {seat.seatCode.split('-')[1]}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Active Hold Basket & Payment Desk */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard style={{ width: 20, height: 20, color: 'var(--accent-vip)' }} />
              Active Reservation Basket
            </h2>

            {/* 600s Countdown Badge */}
            {heldSeats.length > 0 && (
              <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock style={{ width: 18, height: 18, color: 'var(--accent-gold)' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Hold TTL Timer:</span>
                </div>
                <span className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 800, color: timeLeft < 60 ? 'var(--accent-rose)' : 'var(--accent-gold)' }}>
                  {formatTime(timeLeft)}
                </span>
              </div>
            )}

            {/* Customer Information Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Your Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-glass)', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Your Email</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-glass)', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* Selected Seats List */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {heldSeats.map(s => (
                <div key={s.id} style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="font-mono" style={{ fontWeight: 800, color: '#fff' }}>{s.seatCode}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>({s.section})</span>
                  </div>
                  <span className="font-mono" style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>{s.price.toLocaleString()} ฿</span>
                </div>
              ))}
              {heldSeats.length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Click available seats on the map to hold.
                </div>
              )}
            </div>

            {/* ยอดรวม Summary & Checkout Button */}
            <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ยอดรวม ({heldSeats.length} Seats):</span>
                <span className="font-mono" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-vip)' }}>
                  {totalHoldAmount.toLocaleString()} THB
                </span>
              </div>

              <button
                onClick={handlePaymentCheckout}
                disabled={isProcessing || heldSeats.length === 0}
                className="btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: '0.95rem' }}
              >
                <CreditCard style={{ width: 18, height: 18 }} />
                {isProcessing ? 'Authorizing Payment...' : 'Pay & ยืนยัน Booking (PAYMENT_SUCCESS)'}
              </button>
            </div>
          </div>

          {/* ยืนยันed QR Ticket Display */}
          {confirmedOrder && (
            <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-emerald)', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <ShieldCheck style={{ width: 20, height: 20 }} />
                HMAC-SHA256 Signed Ticket Pass
              </h3>
              <div className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-cyan)', marginBottom: '12px' }}>
                Order #{confirmedOrder.orderCode}
              </div>

              {confirmedOrder.qrCodeBase64 && (
                <img
                  src={confirmedOrder.qrCodeBase64}
                  alt="Ticket QR"
                  style={{ width: '180px', height: '180px', margin: '0 auto 12px', borderRadius: '10px', background: '#fff', padding: '6px' }}
                />
              )}

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Present this QR code at concert gates. Protected with cryptographic anti-counterfeit HMAC signature.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


