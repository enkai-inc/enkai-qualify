import JSZip from 'jszip';

export interface PackFeature {
  id: string;
  name: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface PackValidation {
  keywordScore: number;
  painPointScore: number;
  competitionScore: number;
  revenueEstimate: number;
  overallScore: number;
}

export interface PackGenerationParams {
  ideaTitle: string;
  ideaDescription: string;
  industry: string;
  targetMarket: string;
  technologies: string[];
  features: PackFeature[];
  modules: string[];
  complexity: 'MVP' | 'STANDARD' | 'FULL';
  validation?: PackValidation | null;
}

type FileMap = Record<string, string>;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// --- Module generators ---

function generateAuthModule(params: PackGenerationParams): FileMap {
  const files: FileMap = {};
  files['src/modules/auth/middleware.ts'] = `import { NextRequest, NextResponse } from 'next/server';

export function authMiddleware(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // TODO: Verify token (JWT or session)
  return NextResponse.next();
}
`;
  files['src/modules/auth/login.tsx'] = `'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      window.location.href = '/dashboard';
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required />
      <button type="submit">Sign In</button>
    </form>
  );
}
`;
  files['src/modules/auth/register.tsx'] = `'use client';

import { useState } from 'react';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    if (res.ok) {
      window.location.href = '/login';
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Name" required />
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required />
      <button type="submit">Create Account</button>
    </form>
  );
}
`;
  return files;
}

function generateDatabaseModule(params: PackGenerationParams): FileMap {
  const files: FileMap = {};
  const modelLines = params.features
    .map(
      (f) => `model ${f.name.replace(/[^a-zA-Z0-9]/g, '')} {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  // TODO: Add fields for "${f.description}"
}`
    )
    .join('\n\n');

  files['prisma/schema.prisma'] = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

${modelLines}
`;
  files['prisma/seed.ts'] = `import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin',
      password: 'changeme', // TODO: Hash in production
    },
  });

  console.log('Seed complete.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
`;
  return files;
}

function generateApiModule(params: PackGenerationParams): FileMap {
  const files: FileMap = {};

  files['src/modules/api/validation.ts'] = `export function validateBody<T>(schema: { parse: (data: unknown) => T }, body: unknown): T {
  return schema.parse(body);
}
`;

  for (const feature of params.features) {
    const slug = slugify(feature.name);
    files[`src/modules/api/routes/${slug}.ts`] = `import { NextRequest, NextResponse } from 'next/server';

// ${feature.name}: ${feature.description}

export async function GET() {
  // TODO: Fetch ${feature.name} records
  return NextResponse.json({ data: [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  // TODO: Validate and create ${feature.name}
  return NextResponse.json({ data: body }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  // TODO: Validate and update ${feature.name}
  return NextResponse.json({ data: body });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  // TODO: Delete ${feature.name} by id
  return NextResponse.json({ deleted: id });
}
`;
  }
  return files;
}

function generateDashboardModule(params: PackGenerationParams): FileMap {
  const files: FileMap = {};
  files['src/modules/dashboard/layout.tsx'] = `export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r p-4">
        <nav>
          <a href="/dashboard" className="block py-2">Overview</a>
          <a href="/dashboard/data" className="block py-2">Data</a>
          <a href="/dashboard/settings" className="block py-2">Settings</a>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
`;
  files['src/modules/dashboard/stats-cards.tsx'] = `interface StatCardProps {
  label: string;
  value: string | number;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

export function StatsGrid({ stats }: { stats: StatCardProps[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <StatCard key={s.label} {...s} />
      ))}
    </div>
  );
}
`;
  files['src/modules/dashboard/data-table.tsx'] = `interface Column<T> {
  key: keyof T;
  header: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
}

export function DataTable<T extends Record<string, unknown>>({ columns, data }: DataTableProps<T>) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={String(col.key)} className="border-b p-2 text-left">{col.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            {columns.map((col) => (
              <td key={String(col.key)} className="border-b p-2">{String(row[col.key])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
`;
  return files;
}

function generateLandingModule(params: PackGenerationParams): FileMap {
  const files: FileMap = {};
  const featureItems = params.features
    .map(
      (f) => `        <div className="rounded-lg border p-6">
          <h3 className="text-lg font-semibold">${f.name}</h3>
          <p className="mt-2 text-gray-600">${f.description}</p>
        </div>`
    )
    .join('\n');

  files['src/modules/landing/page.tsx'] = `export default function LandingPage() {
  return (
    <div>
      <section className="py-20 text-center">
        <h1 className="text-5xl font-bold">${params.ideaTitle}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-xl text-gray-600">${params.ideaDescription}</p>
        <a href="/register" className="mt-8 inline-block rounded-lg bg-blue-600 px-6 py-3 text-white">Get Started</a>
      </section>

      <section className="py-16">
        <h2 className="mb-8 text-center text-3xl font-bold">Features</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
${featureItems}
        </div>
      </section>

      <section className="py-16 text-center">
        <h2 className="text-3xl font-bold">Ready to get started?</h2>
        <p className="mt-4 text-gray-600">Join today and transform the way you work.</p>
        <a href="/register" className="mt-8 inline-block rounded-lg bg-blue-600 px-6 py-3 text-white">Sign Up Free</a>
      </section>
    </div>
  );
}
`;
  return files;
}

function generateBillingModule(params: PackGenerationParams): FileMap {
  const files: FileMap = {};
  files['src/modules/billing/stripe-config.ts'] = `import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export const PLANS = {
  free: { name: 'Free', priceId: null, features: ['Basic access'] },
  pro: { name: 'Pro', priceId: process.env.STRIPE_PRO_PRICE_ID, features: ['Everything in Free', 'Priority support'] },
  enterprise: { name: 'Enterprise', priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID, features: ['Everything in Pro', 'Custom integrations'] },
};
`;
  files['src/modules/billing/pricing.tsx'] = `const plans = [
  { name: 'Free', price: '$0', features: ['Basic access', 'Community support'] },
  { name: 'Pro', price: '$29/mo', features: ['Everything in Free', 'Priority support', 'Advanced features'] },
  { name: 'Enterprise', price: 'Custom', features: ['Everything in Pro', 'Custom integrations', 'Dedicated support'] },
];

export default function PricingPage() {
  return (
    <div className="py-16">
      <h2 className="mb-8 text-center text-3xl font-bold">Pricing</h2>
      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.name} className="rounded-lg border p-6">
            <h3 className="text-xl font-bold">{plan.name}</h3>
            <p className="my-4 text-3xl font-bold">{plan.price}</p>
            <ul className="space-y-2">
              {plan.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <button className="mt-6 w-full rounded bg-blue-600 py-2 text-white">Choose {plan.name}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
`;
  files['src/modules/billing/webhook.ts'] = `import { NextRequest, NextResponse } from 'next/server';
import { stripe } from './stripe-config';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  try {
    const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);

    switch (event.type) {
      case 'checkout.session.completed':
        // TODO: Provision access
        break;
      case 'customer.subscription.deleted':
        // TODO: Revoke access
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 });
  }
}
`;
  return files;
}

function generateEmailModule(params: PackGenerationParams): FileMap {
  const files: FileMap = {};
  files['src/modules/email/send.ts'] = `interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  // TODO: Integrate with email provider (SES, Resend, SendGrid, etc.)
  console.log('Sending email:', options.subject, 'to:', options.to);
}
`;
  files['src/modules/email/templates/welcome.ts'] = `export function welcomeEmail(name: string): string {
  return \`
    <h1>Welcome to ${params.ideaTitle}, \${name}!</h1>
    <p>We're excited to have you on board.</p>
    <p>${params.ideaDescription}</p>
    <a href="\${process.env.APP_URL}/dashboard">Go to Dashboard</a>
  \`;
}
`;
  files['src/modules/email/templates/notification.ts'] = `export function notificationEmail(title: string, message: string): string {
  return \`
    <h2>\${title}</h2>
    <p>\${message}</p>
    <a href="\${process.env.APP_URL}/dashboard">View in Dashboard</a>
  \`;
}
`;
  return files;
}

function generateAnalyticsModule(params: PackGenerationParams): FileMap {
  const files: FileMap = {};
  files['src/modules/analytics/provider.tsx'] = `'use client';

import { createContext, useContext } from 'react';

interface AnalyticsContext {
  track: (event: string, properties?: Record<string, unknown>) => void;
}

const AnalyticsCtx = createContext<AnalyticsContext>({
  track: () => {},
});

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  function track(event: string, properties?: Record<string, unknown>) {
    // TODO: Send to analytics service (Mixpanel, PostHog, etc.)
    console.log('[Analytics]', event, properties);
  }

  return <AnalyticsCtx.Provider value={{ track }}>{children}</AnalyticsCtx.Provider>;
}

export function useAnalytics() {
  return useContext(AnalyticsCtx);
}
`;
  files['src/modules/analytics/dashboard.tsx'] = `export default function AnalyticsDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Analytics</h1>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Total Users</p>
          <p className="text-3xl font-bold">0</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Active Today</p>
          <p className="text-3xl font-bold">0</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Events (7d)</p>
          <p className="text-3xl font-bold">0</p>
        </div>
      </div>
      {/* TODO: Add charts */}
    </div>
  );
}
`;
  return files;
}

// --- Scaffold files ---

function generateScaffoldFiles(params: PackGenerationParams): FileMap {
  const slug = slugify(params.ideaTitle);
  const files: FileMap = {};

  files['README.md'] = `# ${params.ideaTitle}

${params.ideaDescription}

## Tech Stack

${params.technologies.map((t) => `- ${t}`).join('\n')}

## Modules

${params.modules.map((m) => `- ${m}`).join('\n')}

## Getting Started

\`\`\`bash
npm install
cp .env.example .env
# Edit .env with your values
npm run dev
\`\`\`

## Project Structure

\`\`\`
src/
  modules/
${params.modules.map((m) => `    ${m}/`).join('\n')}
\`\`\`
`;

  files['package.json'] = JSON.stringify(
    {
      name: slug,
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        lint: 'next lint',
      },
      dependencies: {
        next: '^14.2.0',
        react: '^18.3.0',
        'react-dom': '^18.3.0',
        ...(params.modules.includes('database') ? { '@prisma/client': '^5.14.0' } : {}),
        ...(params.modules.includes('billing') ? { stripe: '^16.0.0' } : {}),
      },
      devDependencies: {
        typescript: '^5.5.0',
        '@types/node': '^20.14.0',
        '@types/react': '^18.3.0',
        ...(params.modules.includes('database') ? { prisma: '^5.14.0' } : {}),
      },
    },
    null,
    2
  );

  files['tsconfig.json'] = JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2017',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        paths: { '@/*': ['./src/*'] },
      },
      include: ['**/*.ts', '**/*.tsx'],
      exclude: ['node_modules'],
    },
    null,
    2
  );

  const envVars = [
    '# App',
    'APP_URL=http://localhost:3000',
    'NODE_ENV=development',
    '',
  ];
  if (params.modules.includes('database')) {
    envVars.push('# Database', 'DATABASE_URL=postgresql://user:password@localhost:5432/dbname', '');
  }
  if (params.modules.includes('auth')) {
    envVars.push('# Auth', 'JWT_SECRET=change-me', 'SESSION_SECRET=change-me', '');
  }
  if (params.modules.includes('billing')) {
    envVars.push(
      '# Stripe',
      'STRIPE_SECRET_KEY=sk_test_...',
      'STRIPE_WEBHOOK_SECRET=whsec_...',
      'STRIPE_PRO_PRICE_ID=price_...',
      'STRIPE_ENTERPRISE_PRICE_ID=price_...',
      ''
    );
  }
  if (params.modules.includes('email')) {
    envVars.push('# Email', 'EMAIL_FROM=noreply@example.com', 'EMAIL_API_KEY=...', '');
  }
  if (params.modules.includes('analytics')) {
    envVars.push('# Analytics', 'ANALYTICS_KEY=...', '');
  }
  files['.env.example'] = envVars.join('\n');

  files['.gitignore'] = `node_modules/
.next/
.env
.env.local
dist/
*.log
`;

  return files;
}

// --- Complexity extras ---

function generateComplexityExtras(params: PackGenerationParams): FileMap {
  const files: FileMap = {};

  if (params.complexity === 'STANDARD' || params.complexity === 'FULL') {
    // Validation schemas
    for (const feature of params.features) {
      const slug = slugify(feature.name);
      files[`src/schemas/${slug}.ts`] = `import { z } from 'zod';

export const ${feature.name.replace(/[^a-zA-Z0-9]/g, '')}Schema = z.object({
  // TODO: Define fields for ${feature.name}
  id: z.string().optional(),
});

export type ${feature.name.replace(/[^a-zA-Z0-9]/g, '')}Input = z.infer<typeof ${feature.name.replace(/[^a-zA-Z0-9]/g, '')}Schema>;
`;
    }

    // Test stubs
    files['src/__tests__/example.test.ts'] = `describe('${params.ideaTitle}', () => {
  it('should be configured correctly', () => {
    expect(true).toBe(true);
  });

  // TODO: Add integration tests for each module
${params.modules.map((m) => `  // - ${m} module tests`).join('\n')}
});
`;
  }

  if (params.complexity === 'FULL') {
    files['Dockerfile'] = `FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
`;

    files['docker-compose.yml'] = `version: '3.8'
services:
  app:
    build: .
    ports:
      - '3000:3000'
    env_file: .env
${params.modules.includes('database') ? `    depends_on:
      - db
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: dbname
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:` : ''}
`;

    files['src/lib/logger.ts'] = `type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const entry = { timestamp: new Date().toISOString(), level, message, ...meta };
  console[level === 'debug' ? 'log' : level](JSON.stringify(entry));
}
`;

    files['src/lib/error-handler.ts'] = `import { NextResponse } from 'next/server';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode },
    );
  }
  console.error('Unhandled error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
`;

    files['src/lib/rate-limit.ts'] = `const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number = 60, windowMs: number = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}
`;
  }

  return files;
}

// --- SPEC.md generation ---

function generateSpecMd(params: PackGenerationParams): string {
  const sections: string[] = [];

  // 1. Executive Summary
  sections.push(`# ${params.ideaTitle} — Technical Specification

## 1. Executive Summary

**Description:** ${params.ideaDescription}

**Industry:** ${params.industry}
**Target Market:** ${params.targetMarket}
**Complexity:** ${params.complexity}
`);

  // 2. Validation Summary
  if (params.validation) {
    const v = params.validation;
    sections.push(`## 2. Validation Summary

| Metric | Score |
|--------|-------|
| Keyword Demand | ${v.keywordScore}/100 |
| Pain Point Severity | ${v.painPointScore}/100 |
| Competition Gap | ${v.competitionScore}/100 |
| Overall Score | ${v.overallScore}/100 |

**Estimated Revenue Potential:** $${v.revenueEstimate.toLocaleString()}/mo
`);
  } else {
    sections.push(`## 2. Validation Summary

No validation data available yet.
`);
  }

  // 3. Architecture Overview
  const techList = params.technologies.length > 0 ? params.technologies.join(', ') : 'Next.js, TypeScript, React';
  sections.push(`## 3. Architecture Overview

**Tech Stack:** ${techList}

### Module Dependencies

\`\`\`
${params.modules.map((m) => `  [${m}]`).join(' --> ')}
\`\`\`

### Selected Modules

${params.modules.map((m) => `- **${m}**`).join('\n')}
`);

  // 4. Module Specifications
  const moduleDescriptions: Record<string, string> = {
    auth: 'Authentication and authorization — login, registration, session management',
    database: 'Data layer — Prisma ORM with PostgreSQL, schema models, seed scripts',
    api: 'REST API — CRUD routes per feature, request validation',
    dashboard: 'Admin dashboard — layout, data tables, stats cards',
    landing: 'Landing page — hero section, feature grid, call-to-action',
    billing: 'Billing — Stripe integration, pricing page, webhooks',
    email: 'Email — transactional emails, templates, provider integration',
    analytics: 'Analytics — event tracking, provider abstraction, dashboard',
  };

  sections.push(`## 4. Module Specifications
`);
  for (const mod of params.modules) {
    sections.push(`### ${mod}

**Purpose:** ${moduleDescriptions[mod] || `Module for ${mod} functionality`}

**Components:** See \`src/modules/${mod}/\` directory.
`);
  }

  // 5. Feature Breakdown
  sections.push(`## 5. Feature Breakdown

| Feature | Priority | Description |
|---------|----------|-------------|
${params.features.map((f) => `| ${f.name} | ${f.priority} | ${f.description} |`).join('\n')}
`);

  // 6. Implementation Priorities
  const byPriority = { high: [] as PackFeature[], medium: [] as PackFeature[], low: [] as PackFeature[] };
  for (const f of params.features) {
    byPriority[f.priority].push(f);
  }
  sections.push(`## 6. Implementation Priorities

### Phase 1 — High Priority
${byPriority.high.map((f) => `- ${f.name}: ${f.description}`).join('\n') || '- None'}

### Phase 2 — Medium Priority
${byPriority.medium.map((f) => `- ${f.name}: ${f.description}`).join('\n') || '- None'}

### Phase 3 — Low Priority
${byPriority.low.map((f) => `- ${f.name}: ${f.description}`).join('\n') || '- None'}
`);

  // 7. Environment Setup
  sections.push(`## 7. Environment Setup

Copy \`.env.example\` to \`.env\` and configure the required variables.

### Local Development

\`\`\`bash
npm install
${params.modules.includes('database') ? 'npx prisma generate\nnpx prisma db push\nnpx prisma db seed\n' : ''}npm run dev
\`\`\`

### Deployment

${params.complexity === 'FULL' ? 'Use the included `Dockerfile` and `docker-compose.yml` for containerized deployments.' : 'Deploy to Vercel, AWS, or your preferred platform.'}
`);

  // 8. Data Model
  if (params.modules.includes('database')) {
    sections.push(`## 8. Data Model

See \`prisma/schema.prisma\` for the full schema.

**Generated models from features:**
${params.features.map((f) => `- \`${f.name.replace(/[^a-zA-Z0-9]/g, '')}\` — ${f.description}`).join('\n')}
`);
  }

  // 9. API Design
  if (params.modules.includes('api')) {
    sections.push(`## 9. API Design

| Endpoint | Methods | Feature |
|----------|---------|---------|
${params.features.map((f) => `| \`/api/${slugify(f.name)}\` | GET, POST, PUT, DELETE | ${f.name} |`).join('\n')}
`);
  }

  // 10. Security Considerations
  sections.push(`## 10. Security Considerations

- All secrets stored in environment variables, never committed
- Input validation on all API endpoints${params.modules.includes('auth') ? '\n- JWT/session-based authentication with secure token handling' : ''}${params.modules.includes('billing') ? '\n- Stripe webhook signature verification' : ''}
- HTTPS enforced in production
- Rate limiting on public-facing endpoints${params.complexity === 'FULL' ? '\n- Error boundaries prevent information leakage' : ''}
`);

  return sections.join('\n');
}

// --- Main generator ---

const MODULE_GENERATORS: Record<string, (params: PackGenerationParams) => FileMap> = {
  auth: generateAuthModule,
  database: generateDatabaseModule,
  api: generateApiModule,
  dashboard: generateDashboardModule,
  landing: generateLandingModule,
  billing: generateBillingModule,
  email: generateEmailModule,
  analytics: generateAnalyticsModule,
};

export async function generatePackZip(params: PackGenerationParams): Promise<Buffer> {
  const zip = new JSZip();
  const slug = slugify(params.ideaTitle);
  const root = zip.folder(slug)!;

  // Add SPEC.md
  root.file('SPEC.md', generateSpecMd(params));

  // Add scaffold files
  const scaffold = generateScaffoldFiles(params);
  for (const [path, content] of Object.entries(scaffold)) {
    root.file(path, content);
  }

  // Add module files
  for (const mod of params.modules) {
    const generator = MODULE_GENERATORS[mod];
    if (generator) {
      const moduleFiles = generator(params);
      for (const [path, content] of Object.entries(moduleFiles)) {
        root.file(path, content);
      }
    }
  }

  // Add complexity extras
  const extras = generateComplexityExtras(params);
  for (const [path, content] of Object.entries(extras)) {
    root.file(path, content);
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return buffer;
}
