/**
 * EDEN Hub — contrôles de build indépendants des réglages effectifs de Vercel.
 *
 * npm run build : vérifier les fichiers réellement présents. L'absence d'un
 * réglage dans la copie de vercel.json n'est pas une preuve qu'il n'a pas été
 * appliqué par la plateforme. Un réglage explicitement incompatible est rejeté.
 *
 * node scripts/check-vercel.mjs --strict-config : auditer, AVANT déploiement,
 * toutes les valeurs attendues dans le fichier source versionné (CI GitHub).
 * Aucune connexion réseau, aucun secret ni changement de configuration ici.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, isAbsolute, posix, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { MIGRATIONS } from '../server/schema.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Pure function, also used by the regression tests. */
export function validateDeploymentConfig(config, { strict = false } = {}) {
  const errors = [], warnings = [];
  if (!object(config)) return { errors: ['vercel.json doit contenir un objet JSON.'], warnings };

  function missing(key, expected) {
    const message = `vercel.json : ${key} non renseigné ; valeur attendue dans le dépôt / Vercel : ${expected}.`;
    (strict ? errors : warnings).push(message);
  }

  if (config.outputDirectory == null) {
    missing('outputDirectory', 'docs');
  } else if (typeof config.outputDirectory !== 'string'
      || isAbsolute(config.outputDirectory)
      || posix.normalize(config.outputDirectory.trim()).replace(/\/$/, '') !== 'docs') {
    errors.push('vercel.json : outputDirectory doit viser "docs" (jamais la racine du dépôt).');
  }

  if (!own(config, 'framework')) {
    missing('framework', 'null, soit Other');
  } else if (config.framework !== null) {
    errors.push('vercel.json : framework doit être null (Other), pas un framework applicatif.');
  }

  if (config.installCommand == null) {
    missing('installCommand', 'npm ci');
  } else if (typeof config.installCommand !== 'string'
      || !/^npm\s+ci(?:\s+--[a-z][a-z0-9-]*(?:=[a-z0-9,.-]+)?)*$/i.test(config.installCommand.trim())) {
    errors.push('vercel.json : installCommand doit être npm ci, éventuellement avec des options npm.');
  }

  if (config.buildCommand == null) {
    missing('buildCommand', 'npm run build');
  } else if (typeof config.buildCommand !== 'string'
      || config.buildCommand.trim().replace(/\s+/g, ' ') !== 'npm run build') {
    errors.push('vercel.json : buildCommand attendu : npm run build.');
  }
  if (own(config, 'builds')) errors.push('vercel.json : retirer builds ; ce projet utilise api/ et functions.');
  return { errors, warnings };
}

/** Compare manifests structurally; object key ordering must not fail a build. */
export function validatePackageLock(pkg, lock) {
  const errors = [];
  if (!object(pkg) || !object(lock)) return ['package.json et package-lock.json doivent contenir des objets JSON.'];
  if (pkg.engines?.node !== '22.x') errors.push('package.json : conserver Node 22.x pour cette version du Hub.');
  if (![2, 3].includes(lock.lockfileVersion) || !object(lock.packages?.[''])) {
    errors.push('package-lock.json incomplet : lockfile npm v2/v3 et entrée packages[""] requis.');
    return errors;
  }
  const rootPackage = lock.packages[''];
  for (const key of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    if (!isDeepStrictEqual(pkg[key] ?? {}, rootPackage[key] ?? {})) {
      errors.push(`Lockfile désynchronisé : ${key}. Régénérer package-lock.json avec npm puis le committer.`);
    }
  }
  if (pkg.name !== rootPackage.name || pkg.version !== rootPackage.version
      || pkg.name !== lock.name || pkg.version !== lock.version) {
    errors.push('Version ou nom désynchronisé entre package.json et package-lock.json.');
  }
  if (rootPackage.engines?.node !== pkg.engines?.node) errors.push('Version Node désynchronisée dans le lockfile.');
  for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
    const entry = lock.packages[`node_modules/${name}`];
    if (!entry || entry.version !== version || !entry.integrity || !entry.resolved) {
      errors.push(`Dépendance verrouillée incomplète : ${name}.`);
    }
  }
  return errors;
}

export async function runChecks({ root = projectRoot, strictConfig = false } = {}) {
  const readJSON = async name => {
    try { return JSON.parse(await readFile(resolve(root, name), 'utf8')); }
    catch (error) {
      if (name === 'vercel.json' && error.code === 'ENOENT' && !strictConfig) return {};
      // Avoid echoing file contents: a configuration file might contain secrets.
      throw new Error(`${name} introuvable ou JSON invalide. Vérifier le fichier dans la racine du dépôt.`);
    }
  };
  const [config, pkg, lock] = await Promise.all([
    readJSON('vercel.json'), readJSON('package.json'), readJSON('package-lock.json'),
  ]);
  const { errors, warnings } = validateDeploymentConfig(config, { strict: strictConfig });
  errors.push(...validatePackageLock(pkg, lock));

  for (const name of ['docs/index.html', 'docs/prof.html', 'docs/config.js', 'docs/app/app.js']) {
    try {
      if (!(await stat(resolve(root, name))).isFile()) throw new Error();
    } catch { errors.push(`Fichier public indispensable absent : ${name}.`); }
  }

  async function walk(dir) {
    const entries = await readdir(resolve(root, dir), { withFileTypes: true });
    return (await Promise.all(entries.map(entry => entry.isDirectory()
      ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]))).flat();
  }
  const files = (await Promise.all(['server', 'api', 'scripts'].map(walk))).flat();
  for (const file of files.filter(name => /\.m?js$/.test(name))) {
    const absolute = resolve(root, file);
    try { execFileSync(process.execPath, ['--check', absolute], { stdio: 'pipe' }); }
    catch { errors.push(`Syntaxe JavaScript invalide : ${file}.`); }
    const text = await readFile(absolute, 'utf8');
    if (file.startsWith('api/')) {
      if (!text.includes('export default')) errors.push(`Handler par défaut manquant : ${file}.`);
      for (const [, specifier] of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) {
        if (!specifier.startsWith('.')) continue;
        try { await stat(resolve(dirname(absolute), specifier)); }
        catch { errors.push(`Import API introuvable : ${file} → ${specifier}.`); }
      }
    }
    if (file.startsWith('server/') && /node:sqlite|\.listen\(|setInterval\(/.test(text)) {
      errors.push(`Dépendance non serverless : ${file}.`);
    }
  }
  const sql = await readFile(resolve(root, 'database/schema.sql'), 'utf8');
  for (const query of MIGRATIONS) {
    if (!sql.includes(query + ';')) errors.push('SQL Editor et migration JavaScript non synchronisés.');
  }
  return { errors, warnings, handlers: files.filter(name => name.startsWith('api/') && name.endsWith('.js')).length };
}

const executedDirectly = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (executedDirectly) {
  try {
    const result = await runChecks({ strictConfig: process.argv.includes('--strict-config') });
    for (const warning of result.warnings) console.warn(`INFO déploiement : ${warning}`);
    if (result.errors.length) {
      console.error(result.errors.join('\n'));
      process.exitCode = 1;
    } else {
      console.log(`OK Vercel : ${result.handlers} handlers, docs/ présent, Node 22, migration SQL et lockfile cohérents. Aucun secret lu au build.`);
      if (result.warnings.length) console.log('La publication effective de docs/ reste à vérifier dans Vercel. Audit du dépôt : node scripts/check-vercel.mjs --strict-config.');
    }
  } catch (error) {
    console.error(`Contrôle de build : ${error.message}`);
    process.exitCode = 1;
  }
}
