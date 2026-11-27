'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { validateWorkspace } = require('./check-ts-workspace.cjs');

function withFixture(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'solo-x-ci-'));
  try { fn(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
function put(root, file, content) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof content === 'string' ? content : JSON.stringify(content));
}
const scripts = { lint: 'echo lint', typecheck: 'echo types', build: 'echo build', test: 'echo tests' };

test('absence of a workspace is represented explicitly', () => withFixture(root => {
  assert.deepEqual(validateWorkspace(root), { present: false, packages: [] });
}));

test('valid workspace and npm lockfile pass', () => withFixture(root => {
  put(root, 'package.json', { workspaces: ['apps/*', 'packages/*'] });
  put(root, 'package-lock.json', '{}');
  put(root, 'apps/web/package.json', { scripts });
  put(root, 'packages/sdk/package.json', { scripts });
  assert.deepEqual(validateWorkspace(root).packages.sort(), ['apps/web', 'packages/sdk']);
}));

test('missing npm lockfile fails', () => withFixture(root => {
  put(root, 'package.json', { workspaces: ['apps/web'] });
  put(root, 'apps/web/package.json', { scripts });
  assert.throws(() => validateWorkspace(root), /package-lock.json/);
}));

test('missing workspace scripts fail', () => withFixture(root => {
  put(root, 'package.json', { workspaces: ['apps/web'] });
  put(root, 'package-lock.json', '{}');
  put(root, 'apps/web/package.json', { scripts: { ...scripts, test: undefined } });
  assert.throws(() => validateWorkspace(root), /"test" script/);
}));

test('missing workspace package fails', () => withFixture(root => {
  put(root, 'package.json', { workspaces: ['apps/web'] });
  put(root, 'package-lock.json', '{}');
  assert.throws(() => validateWorkspace(root), /Workspace package.json missing/);
}));
