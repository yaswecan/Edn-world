import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const drive = fs.readFileSync(new URL('../lib/google-drive.ts', import.meta.url), 'utf8');
const scan = fs.readFileSync(new URL('../app/api/submissions/scan/route.ts', import.meta.url), 'utf8');
const download = fs.readFileSync(new URL('../app/api/submissions/download/route.ts', import.meta.url), 'utf8');

test('V6 expose les deux parcours simples', () => {
  assert.match(page, /Distribuer/);
  assert.match(page, /Récupérer les rendus/);
  assert.match(page, /Collecter les rendus/);
  assert.match(page, /Télécharger .*rendu/);
});

test('la collecte distingue rendu, dossier vide et non rendu', () => {
  assert.match(scan, /submitted/);
  assert.match(scan, /empty/);
  assert.match(scan, /not_submitted/);
  assert.match(scan, /listFilesRecursive/);
});

test('le ZIP est organisé par élève avec rapport CSV', () => {
  assert.match(download, /zip\.folder\(safeZipName\(student\.name\)\)/);
  assert.match(download, /_rapport\.csv/);
  assert.match(download, /downloadDriveFile/);
});

test('Drive sait télécharger récursivement et exporter les fichiers Google natifs', () => {
  assert.match(drive, /listFilesRecursive/);
  assert.match(drive, /application\/vnd\.google-apps\.document/);
  assert.match(drive, /application\/pdf/);
  assert.match(drive, /spreadsheetml\.sheet/);
  assert.match(drive, /presentationml\.presentation/);
});
