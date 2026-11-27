'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_SCRIPTS = ['lint', 'typecheck', 'build', 'test'];

function validateWorkspace(root = process.cwd()) {
  const file = path.join(root, 'package.json');
  if (!fs.existsSync(file)) return { present: false, packages: [] };

  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!fs.existsSync(path.join(root, 'package-lock.json'))) {
    throw new Error('Missing package-lock.json. Commit an npm lockfile so CI can use npm ci.');
  }
  const workspaces = Array.isArray(pkg.workspaces)
    ? pkg.workspaces
    : (pkg.workspaces && pkg.workspaces.packages) || [];
  if (!Array.isArray(workspaces)) {
    throw new Error('package.json workspaces must be an array.');
  }
  if (workspaces.length === 0) {
    throw new Error('Declare npm workspaces for the web app and SDK in package.json.');
  }
  const names = new Set();
  for (const pattern of workspaces) {
    if (typeof pattern !== 'string') throw new Error('Workspace paths must be strings.');
    if (pattern.includes('*')) {
      // Require matching directory-level packages, rather than silently skipping a workspace.
      const prefix = pattern.slice(0, pattern.indexOf('*')).replace(/\/$/, '');
      const base = path.join(root, prefix);
      if (!fs.existsSync(base)) throw new Error(`Workspace directory does not exist: ${prefix}`);
      const children = fs.readdirSync(base, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(prefix, entry.name));
      for (const child of children) {
        if (fs.existsSync(path.join(root, child, 'package.json'))) names.add(child);
      }
    } else if (fs.existsSync(path.join(root, pattern, 'package.json'))) {
      names.add(pattern);
    } else {
      throw new Error(`Workspace package.json missing: ${pattern}`);
    }
  }
  if (names.size === 0) throw new Error('No workspace packages found.');
  for (const name of names) {
    const child = JSON.parse(fs.readFileSync(path.join(root, name, 'package.json'), 'utf8'));
    for (const command of REQUIRED_SCRIPTS) {
      if (typeof child.scripts?.[command] !== 'string' || !child.scripts[command].trim()) {
        throw new Error(`Workspace ${name} must define a nonempty "${command}" script.`);
      }
    }
  }
  return { present: true, packages: [...names] };
}

if (require.main === module) {
  try {
    const result = validateWorkspace();
    if (!result.present) throw new Error('package.json not found.');
    console.log(`Validated ${result.packages.length} npm workspaces.`);
  } catch (error) {
    console.error(`CI workspace configuration error: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { validateWorkspace };
