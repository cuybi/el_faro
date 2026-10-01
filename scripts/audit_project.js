const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
let issues = [];

function checkFileExists(referrer, target) {
  if (!target || target.startsWith('http:') || target.startsWith('https:') || target.startsWith('//') || 
      target.startsWith('#') || target.startsWith('data:') || target.startsWith('mailto:') || 
      target.startsWith('tel:') || target.startsWith('javascript:')) {
    return;
  }
  const clean = target.split('?')[0].split('#')[0];
  const abs = path.resolve(path.dirname(referrer), clean);
  if (!fs.existsSync(abs)) {
    issues.push({
      file: path.relative(root, referrer),
      brokenRef: target,
      resolvedPath: path.relative(root, abs)
    });
  }
}

function scanHtml(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Match src
  const srcMatches = content.matchAll(/src=["']([^"']+)["']/g);
  for (const m of srcMatches) checkFileExists(filePath, m[1]);
  // Match href in link or a (if local file)
  const hrefMatches = content.matchAll(/<(?:link|a)[^>]+href=["']([^"']+)["']/g);
  for (const m of hrefMatches) {
    if (!m[1].startsWith('#')) checkFileExists(filePath, m[1]);
  }
}

function scanCss(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const urlMatches = content.matchAll(/url\(["']?([^"')]+)["']?\)/g);
  for (const m of urlMatches) checkFileExists(filePath, m[1]);
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f.startsWith('.') || f === 'node_modules' || f === 'scripts') continue;
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (f.endsWith('.html')) {
      scanHtml(full);
    } else if (f.endsWith('.css')) {
      scanCss(full);
    }
  }
}

console.log('=== Iniciando Auditoría de Enlaces y Recursos Locales ===');
walk(root);

if (issues.length === 0) {
  console.log('[OK] No se encontraron enlaces rotos ni recursos faltantes en HTML/CSS.');
} else {
  console.log(`[ALERTA] Se encontraron ${issues.length} enlaces rotos o recursos faltantes:`);
  issues.forEach(i => console.log(`  - En ${i.file}: referencia a "${i.brokenRef}" no existe (${i.resolvedPath})`));
}
