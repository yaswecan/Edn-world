import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateDeploymentConfig, validatePackageLock, runChecks } from '../scripts/check-vercel.mjs';
import { MIGRATIONS } from '../server/schema.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const config = {
  framework: null, outputDirectory: 'docs', installCommand: 'npm ci', buildCommand: 'npm run build',
};
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));

test('build : configuration complète acceptée', () => {
  assert.deepEqual(validateDeploymentConfig(config), { errors: [], warnings: [] });
});
test('build : audit strict de la configuration source', () => {
  assert.deepEqual(validateDeploymentConfig(config, { strict: true }), { errors: [], warnings: [] });
});
test('build : champs absents ne signifient pas installation échouée', () => {
  const result = validateDeploymentConfig({});
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.length, 4);
});
test('build : champs nuls délégués au réglage plateforme', () => {
  const result = validateDeploymentConfig({ framework: null, outputDirectory: null, installCommand: null, buildCommand: null });
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.length, 3);
});
test('build : audit strict refuse les réglages manquants', () => {
  assert.equal(validateDeploymentConfig({}, { strict: true }).errors.length, 4);
});
test('build : ./docs/ et docs sont équivalents', () => {
  assert.deepEqual(validateDeploymentConfig({ ...config, outputDirectory: './docs/' }).errors, []);
});
for (const output of ['.', '../docs', '/docs', 'dist', '']) {
  test(`build : sortie incorrecte ou non dédiée refusée (${JSON.stringify(output)})`, () => {
    assert.match(validateDeploymentConfig({ ...config, outputDirectory: output }).errors.join('\n'), /outputDirectory/);
  });
}
test('build : framework explicite incompatible reste bloquant', () => {
  assert.match(validateDeploymentConfig({ ...config, framework: 'nextjs' }).errors.join('\n'), /framework/);
});
test('build : npm ci avec des options garde une installation verrouillée', () => {
  assert.deepEqual(validateDeploymentConfig({ ...config, installCommand: ' npm   ci --no-audit --no-fund ' }).errors, []);
});
test('build : npm install et les commandes composées ne passent pas silencieusement', () => {
  for (const command of ['npm install', '', 'npm ci; echo ok', 'npm ci && npm install']) {
    assert.match(validateDeploymentConfig({ ...config, installCommand: command }).errors.join('\n'), /installCommand/);
  }
});
test('build : chaîne de build récursive refusée', () => {
  assert.match(validateDeploymentConfig({ ...config, buildCommand: 'vercel build' }).errors.join('\n'), /buildCommand/);
});
test('build : configuration legacy builds refusée', () => {
  assert.match(validateDeploymentConfig({ ...config, builds: [] }).errors.join('\n'), /builds/);
});
test('build : objet JSON requis', () => {
  for (const value of [null, [], 'docs', 42]) assert.equal(validateDeploymentConfig(value).errors.length, 1);
});
test('lockfile : métadonnées originales conservées et cohérentes', () => {
  assert.deepEqual(validatePackageLock(pkg, lock), []);
});
test('lockfile : un ordre de clés différent ne change pas les dépendances', () => {
  const p = structuredClone(pkg), l = structuredClone(lock);
  p.devDependencies = { a: '1.0.0', b: '2.0.0' };
  l.packages[''].devDependencies = { b: '2.0.0', a: '1.0.0' };
  assert.deepEqual(validatePackageLock(p, l), []);
});
test('lockfile : dépendance modifiée détectée', () => {
  const p = structuredClone(pkg);
  p.dependencies['@neondatabase/serverless'] = '9.9.9';
  assert.match(validatePackageLock(p, lock).join('\n'), /désynchronisé/);
});
test('lockfile : version Node et métadonnées incohérentes détectées', () => {
  const l = structuredClone(lock);
  l.packages[''].engines.node = '24.x';
  l.version = '0.0.0';
  assert.equal(validatePackageLock(pkg, l).length, 2);
});
test('lockfile : lockfile incomplet ou sans intégrité refusé', () => {
  assert.match(validatePackageLock(pkg, { lockfileVersion: 3 }).join('\n'), /incomplet/);
  const l = structuredClone(lock);
  delete l.packages['node_modules/@neondatabase/serverless'].integrity;
  assert.match(validatePackageLock(pkg, l).join('\n'), /incomplète/);
});

async function fixture(t, settings = config) {
  const root = await mkdtemp(resolve(tmpdir(), 'eden-build-regression-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = {
    'package.json': JSON.stringify(pkg),
    'package-lock.json': JSON.stringify(lock),
    'vercel.json': JSON.stringify(settings),
    'docs/index.html': '<h1>EDEN</h1>',
    'docs/prof.html': '<h1>Professeur</h1>',
    'docs/config.js': 'export default {};',
    'docs/app/app.js': 'export const ok = true;',
    'server/handler.mjs': 'export const handle = () => {};',
    'api/config.js': 'import {handle} from "../server/handler.mjs"; export default handle;',
    'scripts/noop.mjs': '// contrôle syntaxique',
    'database/schema.sql': MIGRATIONS.map(sql => sql + ';').join('\n'),
  };
  for (const [path, text] of Object.entries(files)) {
    const full = resolve(root, path);
    await mkdir(resolve(full, '..'), { recursive: true });
    await writeFile(full, text);
  }
  return root;
}

test('régression : reproduire les deux messages du log avec les anciens tests', () => {
  // Simulation contrôlée de champs absents ; ne prétend pas décrire le fichier lu chez Vercel.
  const copiedConfig = { ...config };
  delete copiedConfig.outputDirectory;
  delete copiedConfig.installCommand;
  const oldErrors = [];
  if (copiedConfig.outputDirectory !== 'docs' || copiedConfig.framework !== null) oldErrors.push('Sortie Vercel invalide.');
  if (copiedConfig.installCommand !== 'npm ci') oldErrors.push('Installation reproductible attendue.');
  assert.deepEqual(oldErrors, ['Sortie Vercel invalide.', 'Installation reproductible attendue.']);
  assert.deepEqual(validateDeploymentConfig(copiedConfig).errors, []);
});
test('régression : copie partielle, contenu réel présent, build accepté avec avertissements', async t => {
  const root = await fixture(t, { framework: null });
  const result = await runChecks({ root });
  assert.deepEqual(result.errors, []);
  assert.equal(result.handlers, 1);
  assert.equal(result.warnings.length, 3);
});
test('régression : JSON de configuration absent seulement toléré au build, jamais en audit strict', async t => {
  const root = await fixture(t);
  await rm(resolve(root, 'vercel.json'));
  assert.deepEqual((await runChecks({ root })).errors, []);
  await assert.rejects(runChecks({ root, strictConfig: true }), /vercel.json/);
});
test('régression : fichier public manquant reste bloquant', async t => {
  const root = await fixture(t);
  await rm(resolve(root, 'docs/index.html'));
  assert.match((await runChecks({ root })).errors.join('\n'), /docs\/index.html/);
});
test('régression : erreur de syntaxe serveur et import cassé restent bloquants', async t => {
  const root = await fixture(t);
  await writeFile(resolve(root, 'server/handler.mjs'), 'export const handle = ;');
  await writeFile(resolve(root, 'api/config.js'), 'import handle from "../server/absent.mjs"; export default handle;');
  const result = await runChecks({ root });
  assert.match(result.errors.join('\n'), /Syntaxe/);
  assert.match(result.errors.join('\n'), /Import API/);
});
test('régression : SQLite et migration désynchronisée restent bloquants', async t => {
  const root = await fixture(t);
  await writeFile(resolve(root, 'server/handler.mjs'), 'import {DatabaseSync} from "node:sqlite"; export const handle = () => {};');
  await writeFile(resolve(root, 'database/schema.sql'), '-- migration absente');
  const result = await runChecks({ root });
  assert.match(result.errors.join('\n'), /non serverless/);
  assert.match(result.errors.join('\n'), /migration/);
});
test('régression : JSON invalide refusé sans afficher son contenu', async t => {
  const root = await fixture(t);
  await writeFile(resolve(root, 'vercel.json'), 'ne-pas-afficher-un-secret');
  await assert.rejects(runChecks({ root }), error => /JSON invalide/.test(error.message) && !error.message.includes('ne-pas-afficher'));
});
test('régression : contrôle de configuration résolu depuis le script, pas le cwd', () => {
  const text = execFileSync(process.execPath, [resolve(projectRoot, 'scripts/check-vercel.mjs'), '--strict-config'], {
    cwd: tmpdir(), encoding: 'utf8', timeout: 15000,
  });
  assert.match(text, /OK Vercel : 12 handlers/);
});
