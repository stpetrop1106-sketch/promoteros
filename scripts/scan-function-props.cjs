// Scan for the I7 class: a server component passing a FUNCTION as a prop to a client component.
// Builds clean, passes every test, throws on every load. Only opening the page finds it — or this.
const fs = require('fs');
const path = require('path');

const files = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name)) files.push(p.split(path.sep).join('/'));
  }
}
walk('app');
walk('components');

const isClient = new Map();
const src = new Map();
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  src.set(f, s);
  isClient.set(f, /^\s*["']use client["']/m.test(s.slice(0, 200)));
}

function resolveImport(fromFile, spec) {
  let base;
  if (spec.startsWith('@/')) base = spec.slice(2);
  else if (spec.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec));
  else return null;
  for (const cand of [base + '.tsx', base + '.ts', base + '/index.tsx', base + '/index.ts']) {
    if (src.has(cand)) return cand;
  }
  return null;
}

const findings = [];
for (const f of files) {
  const s = src.get(f);
  if (isClient.get(f)) continue;

  const importedFrom = new Map();
  for (const m of s.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)) {
    const target = resolveImport(f, m[2]);
    if (!target) continue;
    for (const raw of m[1].split(',')) {
      const name = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop().trim();
      if (name) importedFrom.set(name, target);
    }
  }

  const localFns = new Set();
  for (const m of s.matchAll(/^\s*(?:const|let)\s+(\w+)\s*=\s*(?:translatorFor|\([^)]*\)\s*=>|async\s*\()/gm)) localFns.add(m[1]);
  for (const m of s.matchAll(/^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm)) localFns.add(m[1]);

  for (const m of s.matchAll(/<([A-Z]\w*)((?:\s+[^>]*?)?)\/?>/g)) {
    const comp = m[1];
    const attrs = m[2] || '';
    const target = importedFrom.get(comp);
    if (!target || !isClient.get(target)) continue;
    for (const a of attrs.matchAll(/(\w+)=\{(\w+)\}/g)) {
      if (localFns.has(a[2])) {
        const line = s.slice(0, m.index).split('\n').length;
        findings.push(f + ':' + line + '  <' + comp + ' ' + a[1] + '={' + a[2] + '}>  -> client component ' + target);
      }
    }
  }
}

if (findings.length === 0) console.log('CLEAN - no function prop crosses a server->client boundary.');
else { console.log('FOUND ' + findings.length + ':'); for (const x of findings) console.log('  ' + x); }
