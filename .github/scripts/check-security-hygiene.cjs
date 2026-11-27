const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "../..");
const allow = new Set([".git", "node_modules", "target", ".next"]);
const findings = [];
function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { if (allow.has(entry.name)) continue; const file = path.join(dir, entry.name); if (entry.isDirectory()) walk(file); else if (/\.(?:rs|ts|tsx|js|cjs|md|json|toml|ya?ml)$/i.test(entry.name)) { const text = fs.readFileSync(file, "utf8"); if (/(?:BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|(?:secret|private)[_-]?(?:key|token)\s*[:=]\s*["']?[A-Za-z0-9_\-]{20,})/i.test(text)) findings.push(path.relative(root, file)); } } }
walk(root);
for (const lock of ["package-lock.json", "Cargo.lock"]) if (!fs.existsSync(path.join(root, lock))) findings.push(`missing ${lock}`);
if (findings.length) { console.error("Security hygiene findings:\n" + findings.join("\n")); process.exit(1); }
console.log("Security hygiene check passed: lockfiles present and no credential-shaped values found.");
