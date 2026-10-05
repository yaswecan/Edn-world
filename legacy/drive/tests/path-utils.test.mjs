import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeStudentPaths, normalizeSegments, safeFolderName } from '../lib/path-utils.mjs';

test('normalizeSegments accepte une chaîne et supprime les segments vides', () => {
  assert.deepEqual(normalizeSegments('01 - Tech / 02 - Exercices / '), ['01 - Tech', '02 - Exercices']);
});

test('mergeStudentPaths calcule la couverture sur tous les élèves', () => {
  const result = mergeStudentPaths([
    [['01 - Tech'], ['01 - Tech', '01 - Cours'], ['02 - Maths']],
    [['01 - Tech'], ['01 - Tech', '01 - Cours'], ['02 - Maths', 'Projets']],
    [['01 - Tech'], ['03 - Français']]
  ]);
  const tech = result.find((x) => x.path === '01 - Tech');
  const cours = result.find((x) => x.path === '01 - Tech / 01 - Cours');
  assert.equal(tech.availableStudents, 3);
  assert.equal(cours.availableStudents, 2);
  assert.equal(cours.totalStudents, 3);
});

test('safeFolderName neutralise les caractères problématiques', () => {
  assert.equal(safeFolderName(' BC04: Interfaces / responsive '), 'BC04- Interfaces - responsive');
});
