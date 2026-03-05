import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Enkai Qualify - SaaS Opportunity Discovery',
  description: 'Find data-driven opportunities for SaaS products',
};

// Force dynamic rendering for the entire app
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-white focus:text-blue-600 focus:rounded focus:shadow-lg"
        >
          Skip to main content
        </a>
        <div className="min-h-screen bg-gray-50">{children}</div>
      </body>
    </html>
  );
}
