import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');
const assetsDir = path.join(distDir, 'assets');

console.log('=== BasBuddy Frontend Build Verification Gate ===');

if (!fs.existsSync(distDir)) {
  console.error('✗ FAIL: dist directory does not exist.');
  process.exit(1);
}

// 1. Check CSS output for PostCSS & Tailwind compilation
const assetFiles = fs.readdirSync(assetsDir);
const cssFiles = assetFiles.filter((f) => f.endsWith('.css'));

if (cssFiles.length === 0) {
  console.error('✗ FAIL: No CSS asset found in dist/assets.');
  process.exit(1);
}

let cssContent = '';
for (const f of cssFiles) {
  cssContent += fs.readFileSync(path.join(assetsDir, f), 'utf8') + '\n';
}

// Negative Check: No uncompiled @tailwind directives
if (cssContent.includes('@tailwind')) {
  console.error('✗ FAIL: Uncompiled @tailwind directives found in output bundle.');
  process.exit(1);
}
console.log('✓ PASS: Zero uncompiled @tailwind directives.');

// Positive Canary Check: Active utility classes must exist in compiled CSS
const requiredCanaryPatterns = [
  { name: '.flex', regex: /\.flex\b/ },
  { name: '.relative', regex: /\.relative\b/ },
  { name: '.inset-0', regex: /\.inset-0\b/ },
];

for (const canary of requiredCanaryPatterns) {
  if (!canary.regex.test(cssContent)) {
    console.error(`✗ FAIL: Expected utility class '${canary.name}' missing from compiled CSS. Purge/content configuration may be broken.`);
    process.exit(1);
  }
}
console.log('✓ PASS: Positive utility canaries (.flex, .relative, .inset-0) verified in output CSS.');

// 2. Check PWA & static assets
const requiredStaticAssets = [
  'favicon.ico',
  'apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'manifest.webmanifest',
];

for (const asset of requiredStaticAssets) {
  const assetPath = path.join(distDir, asset);
  if (!fs.existsSync(assetPath)) {
    console.error(`✗ FAIL: Required static asset 'dist/${asset}' missing.`);
    process.exit(1);
  }
}
console.log('✓ PASS: All required PWA manifest and icon assets present in dist.');

console.log('🎉 Build Verification Passed Successfully!');
