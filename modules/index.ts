import nextjsBase from './nextjs-base.json';
import authClerk from './auth-clerk.json';
import paymentsStripe from './payments-stripe.json';
import storageS3 from './storage-s3.json';
import aiClaude from './ai-claude.json';
import dbPrisma from './db-prisma.json';
import emailResend from './email-resend.json';
import analyticsPosthog from './analytics-posthog.json';
import uiShadcn from './ui-shadcn.json';
import apiFastapi from './api-fastapi.json';
import infraCdk from './infra-cdk.json';

export const modules = {
  'nextjs-base': nextjsBase,
  'auth-clerk': authClerk,
  'payments-stripe': paymentsStripe,
  'storage-s3': storageS3,
  'ai-claude': aiClaude,
  'db-prisma': dbPrisma,
  'email-resend': emailResend,
  'analytics-posthog': analyticsPosthog,
  'ui-shadcn': uiShadcn,
  'api-fastapi': apiFastapi,
  'infra-cdk': infraCdk,
};

export type ModuleId = keyof typeof modules;

export function getModule(id: ModuleId) {
  return modules[id];
}

export function resolveModuleDependencies(moduleIds: ModuleId[]): ModuleId[] {
  const resolved = new Set<ModuleId>();
  const toResolve = [...moduleIds];

  while (toResolve.length > 0) {
    const id = toResolve.shift()!;
    if (resolved.has(id)) continue;

    const mod = modules[id];
    if (mod.dependencies) {
      for (const dep of mod.dependencies) {
        if (!resolved.has(dep as ModuleId)) {
          toResolve.unshift(dep as ModuleId);
        }
      }
    }
    resolved.add(id);
  }

  return Array.from(resolved);
}
