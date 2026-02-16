import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Metis Dashboard',
  description: 'AI-powered development toolkit dashboard',
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
