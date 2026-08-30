import { showSuccess, showError, showInfo, showWarning, showConfirm } from '@/lib/swal';
'use client';

import React, { useState, useEffect } from 'react';
import { BookingOrder } from '@/lib/types';
import { fetchOrders, checkInGate } from '@/lib/api';
import { QrCode, Scan, ShieldCheck, AlertTriangle, CheckCircle2, UserCheck, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function GateScannerView() {
  const [orders, setOrders] = useState<BookingOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<BookingOrder | null>(null);
  const [manualPayload, setManualPayload] = useState('');
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string; order?: BookingOrder } | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    const list = await fetchOrders();
    setOrders(list);
    if (list.length > 0 && !selectedOrder) {
      setSelectedOrder(list[0]);
      setManualPayload(list[0].qrPayload || '');
    }
  }

  function handleSelectOrder(order: BookingOrder) {
    setSelectedOrder(order);
    setManualPayload(order.qrPayload || '');
    setScanResult(null);
  }

  async function handleVerifyAndCheckIn() {
    if (!manualPayload) return;
    setIsScanning(true);
    try {
      const res = await checkInGate(manualPayload);
      setScanResult(res);
      await loadOrders();
      if (res.success) {
        confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
      }
    } catch (err: any) {
      setScanResult({ success: false, message: err.message });
    } finally {
      setIsScanning(false);
    }
  }

  function handleSimulateTampering() {
    if (!manualPayload) return;
    // Alter customer email or amount to break HMAC
    const parts = manualPayload.split('|');
    if (parts.length >= 6) {
      parts[2] = 'hacker.tampered@evil.com';
      setManualPayload(parts.join('|'));
      showInfo('แจ้งเตือนระบบ', '⚠️ Tampered with ticket email! HMAC signature will fail verification.');
    }
  }

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '24px 16px', minHeight: '100vh' }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Scan style={{ color: 'var(--accent-emerald)', width: 28, height: 28 }} />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Concert Gate Admission & HMAC Ticket Scanner</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
            Cryptographic HMAC-SHA256 signature verification • Duplicate check-in prevention • Real-time gate validation
          </p>
        </div>

        <button onClick={loadOrders} className="btn-secondary" style={{ fontSize: '0.85rem' }}>
          <RefreshCw style={{ width: 14, height: 14 }} /> Refresh Gate Data
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '24px' }}>
        {/* Left: Quick Scanner Presets from Confirmed Orders */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '14px' }}>
            Recent Issued Tickets ({orders.length})
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '560px', overflowY: 'auto' }}>
            {orders.map(order => (
              <div
                key={order.id}
                onClick={() => handleSelectOrder(order)}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: selectedOrder?.id === order.id ? '1px solid var(--accent-emerald)' : '1px solid var(--border-glass)',
                  background: selectedOrder?.id === order.id ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span className="font-mono" style={{ fontWeight: 800, color: 'var(--accent-vip)' }}>{order.orderCode}</span>
                  <span style={{ fontSize: '0.75rem', color: order.checkedInAt ? '#6ee7b7' : '#fbbf24', fontWeight: 700 }}>
                    {order.checkedInAt ? '✅ CHECKED IN' : 'READY TO SCAN'}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>{order.customerName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Seats: {order.seats.map(s => s.seatCode).join(', ')} • {order.totalAmount.toLocaleString()} THB
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No issued tickets available.
              </div>
            )}
          </div>
        </div>

        {/* Right: Barcode & HMAC Verification Console */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <QrCode style={{ width: 20, height: 20, color: 'var(--accent-cyan)' }} />
            Optical Scanner & Cryptographic Validator
          </h2>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              QR Code Payload Stream (Includes Order, Seats, Amount, & HMAC-SHA256 signature):
            </label>
            <textarea
              rows={3}
              value={manualPayload}
              onChange={e => setManualPayload(e.target.value)}
              className="font-mono"
              style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-glass)', color: '#38bdf8', fontSize: '0.8rem', lineHeight: '1.5' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button
              onClick={handleVerifyAndCheckIn}
              disabled={isScanning || !manualPayload}
              className="btn-success"
              style={{ flex: 1, padding: '12px', fontSize: '0.95rem' }}
            >
              <UserCheck style={{ width: 16, height: 16 }} />
              {isScanning ? 'Verifying HMAC...' : 'Scan & Validate Admission (CONFIRMED -> CHECKED_IN)'}
            </button>
            <button
              onClick={handleSimulateTampering}
              className="btn-secondary"
              style={{ padding: '12px 16px', fontSize: '0.85rem' }}
            >
              Simulate Tamper
            </button>
          </div>

          {/* Gate Scan Result Banner */}
          {scanResult && (
            <div
              style={{
                padding: '20px',
                borderRadius: '12px',
                background: scanResult.success ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                border: `1px solid ${scanResult.success ? 'rgba(16,185,129,0.4)' : 'rgba(244,63,94,0.4)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '14px'
              }}
            >
              {scanResult.success ? (
                <ShieldCheck style={{ width: 36, height: 36, color: 'var(--accent-emerald)', flexShrink: 0 }} />
              ) : (
                <AlertTriangle style={{ width: 36, height: 36, color: 'var(--accent-rose)', flexShrink: 0 }} />
              )}
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: scanResult.success ? '#34d399' : '#fda4af' }}>
                  {scanResult.success ? 'GATE ADMISSION GRANTED' : 'ADMISSION REJECTED'}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {scanResult.message}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

