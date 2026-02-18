import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Metis - SaaS Opportunity Discovery',
  description: 'Find data-driven opportunities for SaaS products',
};

// Force dynamic rendering for the entire app
export const dynamic = 'force-dynamic';

// Check if Clerk is configured
const isClerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Conditionally import ClerkProvider only when configured
async function ConditionalClerkProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  if (isClerkConfigured) {
    const { ClerkProvider } = await import('@clerk/nextjs');
    return <ClerkProvider>{children}</ClerkProvider>;
  }
  // Render without Clerk when not configured
  return <>{children}</>;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ConditionalClerkProvider>
          <main className="min-h-screen bg-gray-50">{children}</main>
        </ConditionalClerkProvider>
      </body>
    </html>
  );
}
