import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Rune',
  description: 'Your personal second brain',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#2c1810',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="bg-[#f5e6d3] text-[#2c1810] min-h-screen">
        {children}
      </body>
    </html>
  );
}
