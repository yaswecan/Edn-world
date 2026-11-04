import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {run} from '../public/programming/runtime.js';
import {renderProgrammingVisual, renderArray, renderComparisonTable} from '../public/programming/visuals.js';

const course = JSON.parse(await readFile(new URL('../docs/programming/examples/tableaux.lesson.json', import.meta.url)));
const render = (code, invoke, args, diagramType, pick) => {
  const execution = run(code, {invoke, args});
  assert.equal(execution.error, null);
  const position = execution.trace.findIndex(pick);
  assert.ok(position >= 0, 'The execution must include the requested operation.');
  return renderProgrammingVisual({activity:{interactive:{invoke, args, diagramType}}, code, args, execution, position});
};

test('every source workshop renders the original visual structures from its own execution', () => {
  const kinds = new Set();
  for (const activity of course.activities.filter(a => a.interactive?.kind === 'code')) {
    kinds.add(activity.interactive.diagramType);
    const code = activity.reference, {invoke, args} = activity.interactive;
    const execution = run(code, {invoke, args});
    assert.equal(execution.error, null, activity.id);
    const initial = renderProgrammingVisual({activity, code, args});
    assert.match(initial, /class="array-cells"/);
    assert.match(initial, /Violet : indice/);
    for (let position = 0; position < execution.trace.length; position++) {
      const html = renderProgrammingVisual({activity, code, args, execution, position});
      assert.ok(html.includes(`data-diagram="${activity.interactive.diagramType}"`));
      assert.match(html, /class="caption" role="status"/);
      assert.match(html, /data-result/);
    }
  }
  assert.deepEqual(kinds, new Set(['array', 'for', 'function', 'while', 'foreach', 'decompose']));
});

test('loop highlights follow the executed phase and support a new induction variable name', () => {
  const code = 'function scan(stocks) {\n let cursor = 0;\n while (cursor < stocks.length) {\n  console.log(stocks[cursor]);\n  cursor++;\n }\n return cursor;\n}';
  const html = render(code, 'scan', [[12, 3]], 'while', frame => frame.kind === 'update');
  assert.match(html, /data-mechanism="while"/);
  assert.match(html, /class="flow-node active" aria-current="step">Évolution/);
  assert.match(html, /array-cell current" data-array-index="1"/);
  assert.doesNotMatch(html, /class="battery"|batteries|drone/);
  const condition = render(code, 'scan', [[12, 3]], 'while', frame => frame.kind === 'condition');
  assert.match(condition, /class="flow-node active" aria-current="step">Condition/);
});

test('callback argument names cannot swap value and iteration index in the picture', () => {
  const code = 'function visit(stocks) { stocks.forEach(function(index, value) { console.log(index); }); }';
  const html = render(code, 'visit', [[42, 8]], 'foreach', frame => frame.kind === 'call' && frame.functionName === 'callback');
  assert.match(html, /array-cell current" data-array-index="0"/);
  assert.match(html, /data-mechanism="foreach"/);
  assert.match(html, /<div>42<\/div><span aria-hidden="true">→<\/span><div>index<\/div>/);
  assert.match(html, /<div>0<\/div><span aria-hidden="true">→<\/span><div>value<\/div>/);
  assert.match(html, /Un return quitte le callback courant/);
});

test('nested calls show real parameters, local variables, return value and call stack', () => {
  const code = 'function count(stocks) { return stocks.length; }\nfunction report(stocks) { return count(stocks); }';
  const html = render(code, 'report', [[4, 6]], 'decompose', frame => frame.kind === 'return' && frame.functionName === 'count');
  assert.match(html, /data-diagram="decompose"/);
  assert.match(html, /paramètres de <code>count<\/code>/);
  assert.match(html, /Appels en cours : report → count/);
  assert.match(html, /Valeur renvoyée par cette fonction<code data-result aria-label="Valeur renvoyée">2<\/code>/);
});

test('displayed array length stays truthful when interpreter snapshots and cells are truncated', () => {
  const code = 'function total(stocks) { return stocks.length; }';
  const html = render(code, 'total', [Array.from({length:95}, (_, i) => i)], 'array', frame => frame.kind === 'call');
  assert.match(html, /length = 95/);
  assert.match(html, /16 premières cases sont affichées, sur 95/);
  assert.equal((html.match(/data-array-index=/g) || []).length, 16);
});

test('array contents and labels remain escaped; comparison retains the original return explanation', () => {
  const html = renderArray(['<img src=x onerror=alert(1)>', '" onclick="alert(1)'], 0);
  assert.doesNotMatch(html, /<img|<script/);
  assert.match(html, /&lt;img/);
  assert.match(renderArray([], -1), /aucun élément/);
  assert.match(renderComparisonTable(), /Un return du callback ne termine pas le parcours/);
});
