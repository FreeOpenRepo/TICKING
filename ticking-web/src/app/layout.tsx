import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Enterprise Event Ticketing & Seat Hold Engine',
  description: 'Next.js 16 + .NET 10 SignalR, QRCoder, HMAC-SHA256 & Redlock Distributed Hold',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
