'use client';

import { useEffect, useState } from 'react';

interface UserProfile {
  id: string;
  cognitoId: string;
  email: string;
  name: string | null;
  subscription: {
    tier: string;
    ideasUsed: number;
    packsUsed: number;
    periodEnd: string;
  } | null;
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) throw new Error('Failed to fetch user');
        const data = await response.json();
        setUser(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-red-800">Error loading settings: {error}</p>
      </div>
    );
  }

  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email.charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Profile Section */}
      <section className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Profile</h2>
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-xl font-medium text-white">
            {initials}
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-500">Name</label>
              <p className="text-gray-900">{user.name || 'Not set'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Email</label>
              <p className="text-gray-900">{user.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">User ID</label>
              <p className="font-mono text-sm text-gray-500">{user.cognitoId}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Subscription Section */}
      <section className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Subscription</h2>
        {user.subscription ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Current Plan</span>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                {user.subscription.tier}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Ideas Used</span>
              <span className="text-gray-900">{user.subscription.ideasUsed}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Packs Used</span>
              <span className="text-gray-900">{user.subscription.packsUsed}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Period Ends</span>
              <span className="text-gray-900">
                {new Date(user.subscription.periodEnd).toLocaleDateString()}
              </span>
            </div>
            <div className="pt-4">
              <a
                href="/billing"
                className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Manage Subscription
              </a>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500 mb-4">No active subscription</p>
            <a
              href="/billing"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              View Plans
            </a>
          </div>
        )}
      </section>

      {/* Preferences Section (Future-ready placeholder) */}
      <section className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Preferences</h2>
        <p className="text-gray-500 text-sm">
          Notification and theme preferences coming soon.
        </p>
      </section>
    </div>
  );
}
