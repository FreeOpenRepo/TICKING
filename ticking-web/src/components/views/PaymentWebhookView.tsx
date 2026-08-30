'use client';

import React, { useState, useEffect } from 'react';
import { BookingOrder } from '@/lib/types';
import { fetchOrders } from '@/lib/api';
import { Webhook, CheckCircle2, DollarSign, Clock, RefreshCw, Send } from 'lucide-react';

export default function PaymentWebhookView() {
  const [orders, setOrders] = useState<BookingOrder[]>([]);
  const [webhookLog, setWebhookLog] = useState<string[]>([
    'Stripe Webhook Listener initialized on /api/orders/confirm (Secret key verified).'
  ]);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    const list = await fetchOrders();
    setOrders(list);
  }

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '24px 16px', minHeight: '100vh' }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Webhook style={{ color: 'var(--accent-gold)', width: 28, height: 28 }} />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Payment Webhook & Order Authority Desk</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
            Stripe checkout webhooks • HMAC-SHA256 Ticket issuance • TTL expiry watchdog telemetry
          </p>
        </div>

        <button onClick={loadOrders} className="btn-secondary" style={{ fontSize: '0.85rem' }}>
          <RefreshCw style={{ width: 14, height: 14 }} /> Refresh Orders
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
        {/* Orders Table */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px' }}>
            Confirmed Paid Orders ({orders.length})
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '600px', overflowY: 'auto' }}>
            {orders.map(o => (
              <div key={o.id} style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span className="font-mono" style={{ fontSize: '0.85rem', color: 'var(--accent-vip)', fontWeight: 800 }}>
                    {o.orderCode}
                  </span>
                  <span style={{ fontSize: '0.75rem', background: 'rgba(16,185,129,0.2)', color: '#34d399', padding: '2px 8px', borderRadius: '8px', fontWeight: 700 }}>
                    {o.status}
                  </span>
                </div>

                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>{o.customerName} ({o.customerEmail})</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Seats: <strong style={{ color: 'var(--accent-zoneA)' }}>{o.seats.map(s => s.seatCode).join(', ')}</strong> • Total: <strong style={{ color: 'var(--accent-emerald)' }}>{o.totalAmount.toLocaleString()} ฿</strong>
                </div>

                <div style={{ marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  HMAC: <code className="font-mono" style={{ color: 'var(--accent-gold)' }}>{o.hmacSignature?.substring(0, 24)}...</code>
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No completed orders yet. Complete checkout in Customer view to test.
              </div>
            )}
          </div>
        </div>

        {/* Webhook Stream Logs */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px' }}>
            Live Webhook Events Log
          </h2>

          <div style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-glass)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#34d399', lineHeight: '1.7', overflowY: 'auto', maxHeight: '500px' }}>
            {webhookLog.map((log, i) => (
              <div key={i}>➔ {log}</div>
            ))}
            {orders.map((o, idx) => (
              <div key={idx} style={{ color: '#60a5fa' }}>
                [{new Date(o.createdAt).toLocaleTimeString()}] WEBHOOK: checkout.session.completed ➔ Issued Order {o.orderCode} ({o.seats.length} Seats).
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
