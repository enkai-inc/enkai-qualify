#!/usr/bin/env npx tsx
/**
 * sync-addons-from-template-factory.ts
 *
 * Syncs addon definitions from the template-factory repo.
 * Template-factory patches are converted to metis module format.
 *
 * Usage:
 *   npx tsx scripts/sync-addons-from-template-factory.ts
 *   npx tsx scripts/sync-addons-from-template-factory.ts --dry-run
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const TEMPLATE_FACTORY_OWNER = 'tegryan-ddo';
const TEMPLATE_FACTORY_REPO = 'template-factory';
const MODULES_DIR = path.join(__dirname, '..', 'modules');

interface TemplateFactoryPatch {
  name: string;
  path: string;
  category: string;
}

interface MetisModule {
  moduleId: string;
  displayName: string;
  description: string;
  category: string;
  dependencies: string[];
  workUnits: Array<{
    workItemId: string;
    title: string;
    files: string[];
  }>;
  tags: string[];
  source?: {
    repo: string;
    path: string;
  };
}

async function fetchPatchesFromRepo(): Promise<TemplateFactoryPatch[]> {
  const patches: TemplateFactoryPatch[] = [];

  // Get all patch categories
  const categories = [
    'ai',
    'analytics',
    'auth',
    'database',
    'ecs-saas',
    'email',
    'nextjs',
    'payments',
    'static-site',
    'storage',
    'ui',
  ];

  for (const category of categories) {
    try {
      const output = execSync(
        `gh api repos/${TEMPLATE_FACTORY_OWNER}/${TEMPLATE_FACTORY_REPO}/contents/patches/${category} --jq '.[].name'`,
        { encoding: 'utf-8' }
      ).trim();

      if (output) {
        const patchNames = output.split('\n').filter(n => n && n !== '.gitkeep');
        for (const name of patchNames) {
          patches.push({
            name,
            path: `patches/${category}/${name}`,
            category,
          });
        }
      }
    } catch {
      // Category might not exist
    }
  }

  return patches;
}

async function fetchPatchReadme(patchPath: string): Promise<string | null> {
  try {
    const output = execSync(
      `gh api repos/${TEMPLATE_FACTORY_OWNER}/${TEMPLATE_FACTORY_REPO}/contents/${patchPath}/README.md --jq '.content' | base64 -d`,
      { encoding: 'utf-8' }
    );
    return output;
  } catch {
    return null;
  }
}

async function fetchPatchFiles(patchPath: string): Promise<string[]> {
  try {
    const output = execSync(
      `gh api repos/${TEMPLATE_FACTORY_OWNER}/${TEMPLATE_FACTORY_REPO}/contents/${patchPath}/src --jq '.[].path'`,
      { encoding: 'utf-8' }
    ).trim();
    return output ? output.split('\n') : [];
  } catch {
    return [];
  }
}

function convertPatchToModule(patch: TemplateFactoryPatch, readme: string | null, files: string[]): MetisModule {
  // Parse description from README
  let description = `${patch.name} from template-factory`;
  if (readme) {
    const firstParagraph = readme.split('\n\n')[0]?.replace(/^#.*\n/, '').trim();
    if (firstParagraph) {
      description = firstParagraph.replace(/\n/g, ' ').slice(0, 200);
    }
  }

  // Generate work units from files
  const workUnits = files.map((file, idx) => ({
    workItemId: `${patch.name}-${String(idx + 1).padStart(3, '0')}`,
    title: `Add ${path.basename(file)}`,
    files: [file.replace(`patches/${patch.category}/${patch.name}/src/`, '')],
  }));

  // Determine dependencies based on category
  const dependencies: string[] = [];
  if (patch.category === 'auth') {
    dependencies.push('nextjs-base');
  }

  return {
    moduleId: patch.name,
    displayName: patch.name
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
    description,
    category: patch.category,
    dependencies,
    workUnits,
    tags: [patch.category, patch.name.split('-')[0]],
    source: {
      repo: `${TEMPLATE_FACTORY_OWNER}/${TEMPLATE_FACTORY_REPO}`,
      path: patch.path,
    },
  };
}

function getExistingModules(): Set<string> {
  const modules = new Set<string>();
  try {
    const files = fs.readdirSync(MODULES_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        modules.add(file.replace('.json', ''));
      }
    }
  } catch {
    // Directory might not exist
  }
  return modules;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('🔄 Syncing addons from template-factory...\n');

  // Fetch patches from template-factory
  const patches = await fetchPatchesFromRepo();
  console.log(`Found ${patches.length} patches in template-factory:`);
  patches.forEach(p => console.log(`  - ${p.category}/${p.name}`));

  // Get existing modules
  const existingModules = getExistingModules();
  console.log(`\nExisting modules in metis: ${existingModules.size}`);

  // Convert and save new modules
  const newModules: MetisModule[] = [];
  const updatedModules: MetisModule[] = [];

  for (const patch of patches) {
    const readme = await fetchPatchReadme(patch.path);
    const files = await fetchPatchFiles(patch.path);
    const module = convertPatchToModule(patch, readme, files);

    const modulePath = path.join(MODULES_DIR, `${module.moduleId}.json`);

    if (existingModules.has(module.moduleId)) {
      updatedModules.push(module);
    } else {
      newModules.push(module);
    }

    if (!dryRun) {
      fs.writeFileSync(modulePath, JSON.stringify(module, null, 2) + '\n');
    }
  }

  console.log(`\n✅ Sync complete:`);
  console.log(`  - New modules: ${newModules.length}`);
  console.log(`  - Updated modules: ${updatedModules.length}`);

  if (newModules.length > 0) {
    console.log('\nNew modules added:');
    newModules.forEach(m => console.log(`  + ${m.moduleId}`));
  }

  if (dryRun) {
    console.log('\n⚠️  Dry run - no files were written');
  }

  // Identify modules that metis has but template-factory doesn't
  const templateFactoryModules = new Set(patches.map(p => p.name));
  const missingInTemplateFactory: string[] = [];

  for (const moduleId of existingModules) {
    if (!templateFactoryModules.has(moduleId)) {
      missingInTemplateFactory.push(moduleId);
    }
  }

  if (missingInTemplateFactory.length > 0) {
    console.log('\n⚠️  Modules in metis not found in template-factory:');
    missingInTemplateFactory.forEach(m => console.log(`  - ${m}`));
    console.log('\nConsider requesting these from template-factory via pnyx.');
  }

  return { newModules, updatedModules, missingInTemplateFactory };
}

main().catch(console.error);
