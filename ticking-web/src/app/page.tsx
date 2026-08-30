'use client';

import React, { useState, useEffect } from 'react';
import { ActorRole } from '@/lib/types';
import CustomerView from '@/components/views/CustomerView';
import PaymentWebhookView from '@/components/views/PaymentWebhookView';
import GateScannerView from '@/components/views/GateScannerView';
import { Ticket, Webhook, Scan, Wifi, WifiOff } from 'lucide-react';

export default function Home() {
  const [activeRole, setActiveRole] = useState<ActorRole>('Customer');
  const [isApiOnline, setIsApiOnline] = useState<boolean>(false);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  async function checkHealth() {
    try {
      const res = await fetch('http://localhost:5080/api/health');
      setIsApiOnline(res.ok);
    } catch {
      setIsApiOnline(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header Navigation */}
      <header
        style={{
          background: 'rgba(6, 9, 19, 0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border-glass)',
          position: 'sticky',
          top: 0,
          zIndex: 30,
          padding: '12px 24px'
        }}
      >
        <div style={{ maxWidth: '1500px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(236, 72, 153, 0.4)'
            }}>
              <Ticket style={{ color: '#fff', width: 22, height: 22 }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ENTERPRISE <span style={{ color: 'var(--accent-vip)' }}>TICKETING ENGINE</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
                05_TICKETING_ENGINE
              </div>
            </div>
          </div>

          {/* Actor Role Tabs */}
          <div style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--border-glass)',
            padding: '4px',
            borderRadius: '14px',
            gap: '4px'
          }}>
            {[
              { role: 'Customer' as const, label: 'Customer Arena Map', icon: Ticket, color: 'var(--accent-vip)' },
              { role: 'PaymentWebhook' as const, label: 'Payment Webhook', icon: Webhook, color: 'var(--accent-gold)' },
              { role: 'GateScanner' as const, label: 'Gate Scanner Desk', icon: Scan, color: 'var(--accent-emerald)' },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeRole === tab.role;
              return (
                <button
                  key={tab.role}
                  onClick={() => setActiveRole(tab.role)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: isActive ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.3)' : 'none'
                  }}
                >
                  <Icon style={{ width: 16, height: 16, color: isActive ? tab.color : 'inherit' }} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* API Health */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '20px',
            background: isApiOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
            border: `1px solid ${isApiOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
            fontSize: '0.75rem',
            fontWeight: 700,
            color: isApiOnline ? '#34d399' : '#fca5a5'
          }}>
            {isApiOnline ? <Wifi style={{ width: 12, height: 12 }} /> : <WifiOff style={{ width: 12, height: 12 }} />}
            <span>{isApiOnline ? 'Ticket API Active' : 'Connecting API :5080...'}</span>
          </div>
        </div>
      </header>

      {/* Main View Content */}
      <div style={{ flex: 1, padding: '16px' }}>
        {activeRole === 'Customer' && <CustomerView />}
        {activeRole === 'PaymentWebhook' && <PaymentWebhookView />}
        {activeRole === 'GateScanner' && <GateScannerView />}
      </div>
    </main>
  );
}

