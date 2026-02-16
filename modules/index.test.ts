/**
 * Tests for module library
 * Run with: npx tsx modules/index.test.ts
 */

import { modules, getModule, resolveModuleDependencies, type ModuleId } from './index';

// Test: All 11 modules are exported
function testModuleCount() {
  const moduleIds = Object.keys(modules);
  const expected = 11;
  if (moduleIds.length !== expected) {
    throw new Error(`Expected ${expected} modules, got ${moduleIds.length}`);
  }
  console.log('PASS: All 11 modules are exported');
}

// Test: All expected module IDs exist
function testModuleIds() {
  const expectedIds: ModuleId[] = [
    'nextjs-base',
    'auth-clerk',
    'payments-stripe',
    'storage-s3',
    'ai-claude',
    'db-prisma',
    'email-resend',
    'analytics-posthog',
    'ui-shadcn',
    'api-fastapi',
    'infra-cdk',
  ];

  for (const id of expectedIds) {
    if (!modules[id]) {
      throw new Error(`Missing module: ${id}`);
    }
  }
  console.log('PASS: All expected module IDs exist');
}

// Test: getModule returns correct module
function testGetModule() {
  const mod = getModule('nextjs-base');
  if (mod.moduleId !== 'nextjs-base') {
    throw new Error(`Expected moduleId 'nextjs-base', got '${mod.moduleId}'`);
  }
  if (mod.displayName !== 'Next.js Base') {
    throw new Error(`Expected displayName 'Next.js Base', got '${mod.displayName}'`);
  }
  console.log('PASS: getModule returns correct module');
}

// Test: Module structure is valid
function testModuleStructure() {
  for (const [id, mod] of Object.entries(modules)) {
    if (!mod.moduleId) throw new Error(`${id}: missing moduleId`);
    if (!mod.displayName) throw new Error(`${id}: missing displayName`);
    if (!mod.description) throw new Error(`${id}: missing description`);
    if (!mod.category) throw new Error(`${id}: missing category`);
    if (!Array.isArray(mod.dependencies)) throw new Error(`${id}: dependencies must be array`);
    if (!Array.isArray(mod.workUnits)) throw new Error(`${id}: workUnits must be array`);
    if (!Array.isArray(mod.tags)) throw new Error(`${id}: tags must be array`);

    // Verify workUnits structure
    for (const wu of mod.workUnits) {
      if (!wu.workItemId) throw new Error(`${id}: workUnit missing workItemId`);
      if (!wu.title) throw new Error(`${id}: workUnit missing title`);
      if (!Array.isArray(wu.files)) throw new Error(`${id}: workUnit files must be array`);
    }
  }
  console.log('PASS: All modules have valid structure');
}

// Test: resolveModuleDependencies for module with no deps
function testResolveDepsNoDeps() {
  const resolved = resolveModuleDependencies(['api-fastapi']);
  if (resolved.length !== 1 || resolved[0] !== 'api-fastapi') {
    throw new Error(`Expected ['api-fastapi'], got ${JSON.stringify(resolved)}`);
  }
  console.log('PASS: resolveModuleDependencies handles no dependencies');
}

// Test: resolveModuleDependencies includes dependencies
function testResolveDepsWithDeps() {
  const resolved = resolveModuleDependencies(['auth-clerk']);
  // auth-clerk depends on nextjs-base
  if (!resolved.includes('nextjs-base')) {
    throw new Error(`Expected nextjs-base in resolved deps: ${JSON.stringify(resolved)}`);
  }
  if (!resolved.includes('auth-clerk')) {
    throw new Error(`Expected auth-clerk in resolved deps: ${JSON.stringify(resolved)}`);
  }
  console.log('PASS: resolveModuleDependencies includes dependencies');
}

// Test: resolveModuleDependencies handles transitive deps
function testResolveTransitiveDeps() {
  // payments-stripe depends on nextjs-base AND auth-clerk
  // auth-clerk depends on nextjs-base
  const resolved = resolveModuleDependencies(['payments-stripe']);
  if (!resolved.includes('nextjs-base')) {
    throw new Error(`Expected nextjs-base in resolved: ${JSON.stringify(resolved)}`);
  }
  if (!resolved.includes('auth-clerk')) {
    throw new Error(`Expected auth-clerk in resolved: ${JSON.stringify(resolved)}`);
  }
  if (!resolved.includes('payments-stripe')) {
    throw new Error(`Expected payments-stripe in resolved: ${JSON.stringify(resolved)}`);
  }
  console.log('PASS: resolveModuleDependencies handles transitive dependencies');
}

// Test: resolveModuleDependencies deduplicates
function testResolveDepsDeduplicates() {
  const resolved = resolveModuleDependencies(['auth-clerk', 'storage-s3']);
  // Both depend on nextjs-base, should only appear once
  const nextjsCount = resolved.filter(id => id === 'nextjs-base').length;
  if (nextjsCount !== 1) {
    throw new Error(`Expected nextjs-base to appear once, appeared ${nextjsCount} times`);
  }
  console.log('PASS: resolveModuleDependencies deduplicates shared dependencies');
}

// Run all tests
function runTests() {
  console.log('Running module library tests...\n');

  try {
    testModuleCount();
    testModuleIds();
    testGetModule();
    testModuleStructure();
    testResolveDepsNoDeps();
    testResolveDepsWithDeps();
    testResolveTransitiveDeps();
    testResolveDepsDeduplicates();

    console.log('\n========================================');
    console.log('All tests passed!');
    console.log('========================================');
  } catch (error) {
    console.error('\n========================================');
    console.error('TEST FAILED:', (error as Error).message);
    console.error('========================================');
    throw error;
  }
}

runTests();
