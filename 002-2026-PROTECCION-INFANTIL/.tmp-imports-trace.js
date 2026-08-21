const fs = require("fs");
const path = require("path");
const ROOT = "/Users/idc/Documents/GitHub/productos/002-2026-PROTECCION-INFANTIL";
const entries = [
  path.join(ROOT, "scripts/worker-supervisor.mjs"),
  path.join(ROOT, "scripts/worker-reportes.mjs"),
  path.join(ROOT, "scripts/monitor-probes.mjs"),
  path.join(ROOT, "scripts/simulador-abuso.mjs"),
];
const importRe = /import\s+(?:[^"'\r\n]*\s+from\s+)?["']([^"']+)["']/g;
const visited = new Set();
const aliasFiles = [];
function resolveImport(source, fromFile) {
  if (source.startsWith("@/")) {
    return path.join(ROOT, "src", source.slice(2));
  }
  if (source.startsWith("./") || source.startsWith("../")) {
    return path.resolve(path.dirname(fromFile), source);
  }
  return null;
}
function addExt(p) {
  const candidates = [p, p + ".ts", p + ".tsx", p + ".mjs", p + ".js"];
  for (const full of candidates) {
    if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  }
  const indexCandidates = [path.join(p, "index.ts"), path.join(p, "index.tsx"), path.join(p, "index.mjs"), path.join(p, "index.js")];
  for (const full of indexCandidates) {
    if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  }
  return null;
}
function traverse(file) {
  const real = addExt(file);
  if (!real) return;
  if (visited.has(real)) return;
  visited.add(real);
  const text = fs.readFileSync(real, "utf8");
  if (text.includes("@/lib/")) aliasFiles.push(real);
  let m;
  while ((m = importRe.exec(text)) !== null) {
    const src = m[1];
    const resolved = resolveImport(src, real);
    if (resolved) traverse(resolved);
  }
}
for (const e of entries) traverse(e);
console.log("Visited files:", visited.size);
console.log("Files with @/lib imports:");
for (const f of aliasFiles) console.log(path.relative(ROOT, f));
