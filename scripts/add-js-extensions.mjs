#!/usr/bin/env node

/**
 * Script to add .js extensions to all relative imports for ESM migration.
 *
 * Usage:
 *   node scripts/add-js-extensions.mjs [--dry-run]
 *
 * Options:
 *   --dry-run    Show what would be changed without modifying files
 */

import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = dirname(__dirname);

const dryRun = process.argv.includes('--dry-run');

// Directories to process
const targetDirs = ['src', 'tests'];

// File extensions to process
const fileExtensions = ['.ts', '.mts', '.js', '.mjs'];

// Known file extensions to skip (already has extension)
const knownExtensions = ['.js', '.ts', '.json', '.css', '.mjs', '.cjs', '.mts', '.cts', '.node', '.wasm', '.html', '.ejs', '.png', '.svg', '.gif', '.jpg', '.jpeg'];

function hasKnownExtension(importPath) {
  return knownExtensions.some(ext => importPath.endsWith(ext));
}

function isRelativeImport(importPath) {
  return importPath.startsWith('./') || importPath.startsWith('../');
}

function addJsExtensions(content, filePath) {
  let modified = content;
  const changes = [];

  // Pattern for static imports/exports: from './path' or from "../path"
  const staticImportRegex = /(\bfrom\s+)(['"])(\.\.?\/[^'"]+)(\2)/g;

  modified = modified.replace(staticImportRegex, (match, prefix, quote, path, endQuote) => {
    if (!isRelativeImport(path) || hasKnownExtension(path)) {
      return match;
    }
    const newPath = `${path}.js`;
    changes.push({ type: 'static import/export', from: path, to: newPath });
    return `${prefix}${quote}${newPath}${endQuote}`;
  });

  // Pattern for side-effect imports: import './path' (not followed by 'from')
  // Match: import "./path"; or import './path';
  const sideEffectRegex = /(\bimport\s+)(['"])(\.\.?\/[^'"]+)(\2)(\s*;|\s*$)/gm;

  modified = modified.replace(sideEffectRegex, (match, prefix, quote, path, endQuote, suffix) => {
    if (!isRelativeImport(path) || hasKnownExtension(path)) {
      return match;
    }
    const newPath = `${path}.js`;
    changes.push({ type: 'side-effect import', from: path, to: newPath });
    return `${prefix}${quote}${newPath}${endQuote}${suffix}`;
  });

  // Pattern for dynamic imports: import('./path') or await import('./path')
  const dynamicImportRegex = /(\bimport\s*\(\s*)(['"])(\.\.?\/[^'"]+)(\2)(\s*\))/g;

  modified = modified.replace(dynamicImportRegex, (match, prefix, quote, path, endQuote, suffix) => {
    if (!isRelativeImport(path) || hasKnownExtension(path)) {
      return match;
    }
    const newPath = `${path}.js`;
    changes.push({ type: 'dynamic import', from: path, to: newPath });
    return `${prefix}${quote}${newPath}${endQuote}${suffix}`;
  });

  // Pattern for require('./path')
  const requireRegex = /(\brequire\s*\(\s*)(['"])(\.\.?\/[^'"]+)(\2)(\s*\))/g;

  modified = modified.replace(requireRegex, (match, prefix, quote, path, endQuote, suffix) => {
    if (!isRelativeImport(path) || hasKnownExtension(path)) {
      return match;
    }
    const newPath = `${path}.js`;
    changes.push({ type: 'require', from: path, to: newPath });
    return `${prefix}${quote}${newPath}${endQuote}${suffix}`;
  });

  return { content: modified, changes };
}

async function getFiles(dir, extensions) {
  const files = [];

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and .git directories
        // Note: We don't skip 'build' here because src/commands/build is a legitimate source directory
        if (!['node_modules', '.git'].includes(entry.name)) {
          await walk(fullPath);
        }
      } else if (entry.isFile() && extensions.includes(extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  return files;
}

async function processFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  const { content: newContent, changes } = addJsExtensions(content, filePath);

  if (changes.length > 0) {
    const relativePath = filePath.replace(rootDir + '/', '');
    console.log(`\n${relativePath}:`);
    for (const change of changes) {
      console.log(`  ${change.type}: "${change.from}" → "${change.to}"`);
    }

    if (!dryRun) {
      await writeFile(filePath, newContent, 'utf-8');
    }

    return { file: relativePath, changes: changes.length };
  }

  return null;
}

async function main() {
  console.log(dryRun ? '=== DRY RUN MODE ===' : '=== ADDING .js EXTENSIONS ===');
  console.log(`Processing directories: ${targetDirs.join(', ')}\n`);

  let totalFiles = 0;
  let totalChanges = 0;

  for (const dir of targetDirs) {
    const fullDir = join(rootDir, dir);

    try {
      await stat(fullDir);
    } catch {
      console.log(`Directory ${dir} not found, skipping...`);
      continue;
    }

    const files = await getFiles(fullDir, fileExtensions);

    for (const file of files) {
      const result = await processFile(file);
      if (result) {
        totalFiles++;
        totalChanges += result.changes;
      }
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Total files modified: ${totalFiles}`);
  console.log(`Total imports updated: ${totalChanges}`);

  if (dryRun) {
    console.log('\nRun without --dry-run to apply changes.');
  } else {
    console.log('\nChanges applied successfully!');
  }
}

main().catch(console.error);
