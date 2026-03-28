/**
 * build-protected.cjs
 * -------------------
 * Protected build script for El-Ahmed Retail Suite.
 * 1. Runs `vite build` to compile TypeScript → JS
 * 2. Uses bytenode to compile every JS file in dist-electron/ → .jsc (V8 bytecode)
 * 3. Deletes original .js source files (keeps only .jsc + small loader)
 * 4. Creates main-loader.cjs entry point
 *
 * Run: node scripts/build-protected.cjs
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─── Paths ───────────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..');
const DIST_ELECTRON = path.join(ROOT, 'dist-electron');

// ─── Step 1: Vite Build ───────────────────────────────────────────────────────
console.log('\n🔨 [1/3] Building with Vite...\n');
try {
  execSync('npx vite build', { cwd: ROOT, stdio: 'inherit' });
} catch (e) {
  console.error('❌ Vite build failed!');
  process.exit(1);
}

// ─── Step 2: Compile JS → JSC with bytenode ──────────────────────────────────
console.log('\n🔐 [2/3] Compiling Electron main process to V8 bytecode...\n');

let bytenode;
try {
  bytenode = require('bytenode');
} catch (e) {
  console.error('❌ bytenode not found. Run: npm install --save-dev bytenode');
  process.exit(1);
}

// Files to NOT compile (loaders must stay as plain JS)
const SKIP_FILES = ['main-loader.cjs', 'preload.cjs'];

// Get all .js files in dist-electron/
const jsFiles = fs.readdirSync(DIST_ELECTRON).filter(f => {
  return f.endsWith('.js') && !SKIP_FILES.includes(f);
});

if (jsFiles.length === 0) {
  console.warn('⚠️  No .js files found in dist-electron/. Did vite build succeed?');
  process.exit(1);
}

for (const file of jsFiles) {
  const inputPath = path.join(DIST_ELECTRON, file);
  const outputPath = path.join(DIST_ELECTRON, file.replace(/\.js$/, '.jsc'));

  try {
    bytenode.compileFile({ filename: inputPath, output: outputPath, electron: true });
    console.log(`  ✅ ${file} → ${path.basename(outputPath)}`);
    // Delete the original JS source
    fs.unlinkSync(inputPath);
    console.log(`  🗑️  Deleted ${file}`);
  } catch (err) {
    console.error(`  ❌ Failed to compile ${file}:`, err.message);
    process.exit(1);
  }
}

// ─── Step 3: Copy bytenode locally & Create main-loader.cjs ─────────────────
console.log('\n📝 [3/3] Setting up local bytenode & entry point...\n');

// Copy bytenode to dist-electron to avoid electron-builder dependency pruning issues
const bytenodeTarget = path.join(DIST_ELECTRON, 'bytenode');
if (!fs.existsSync(bytenodeTarget)) {
  fs.mkdirSync(bytenodeTarget);
}
const bytenodeSource = path.join(ROOT, 'node_modules', 'bytenode');
fs.copyFileSync(path.join(bytenodeSource, 'index.js'), path.join(bytenodeTarget, 'index.js'));
fs.copyFileSync(path.join(bytenodeSource, 'package.json'), path.join(bytenodeTarget, 'package.json'));

const loaderContent = `'use strict';
// El-Ahmed Retail Suite — Protected Entry Point
// Require local bytenode to avoid node_modules missing errors in production
require('./bytenode');
require('./main.jsc');
`;

const loaderPath = path.join(DIST_ELECTRON, 'main-loader.cjs');
fs.writeFileSync(loaderPath, loaderContent, 'utf-8');
console.log('  ✅ Local bytenode setup and main-loader.cjs created');

// ─── Done ─────────────────────────────────────────────────────────────────────
console.log('\n🎉 Protection complete! Summary:');
console.log(`   📁 dist-electron/ now contains .jsc bytecode files only`);
console.log(`   🔒 Original .js source files have been deleted`);
console.log(`   ▶️  Entry point: dist-electron/main-loader.cjs\n`);
console.log('👉 Now run: npx electron-builder\n');
