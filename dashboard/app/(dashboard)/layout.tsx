import { Sidebar } from '@/components/layout/Sidebar';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { getCurrentUser } from '@/lib/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-blue-600 focus:shadow-lg focus:rounded-md focus:top-2 focus:left-2"
      >
        Skip to main content
      </a>
      <Sidebar user={user} />
      <main id="main-content" className="flex-1 overflow-y-auto bg-gray-50">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
    </div>
  );
}
