// App-owned rendering of the original workshop's visual vocabulary. The data
// comes only from the teaching interpreter, never from executing lesson HTML.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = value => value === undefined ? 'undefined' : typeof value === 'string' ? value : JSON.stringify(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const escapePattern = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function kindName(kind) {
  return ({define:'Déclaration',declare:'Initialisation',read:'Lecture d’une case',condition:'Condition',assign:'Affectation',update:'Mise à jour',call:'Appel de fonction',return:'Retour de fonction',resume:'Reprise de l’appelant','foreach-start':'Début du parcours','foreach-item':'Élément suivant','foreach-next':'Retour au parcours',output:'Affichage','loop-end':'Fin de boucle','array-write':'Modification du tableau',done:'Terminé',error:'Arrêt de l’exécution'})[kind] || 'Étape du programme';
}

export function renderArray(values, current = -1, {battery = false, length = values.length} = {}) {
  return `<div class="array-cells">${values.length ? values.slice(0, 16).map((value, index) => `<div class="array-cell ${index === current ? 'current' : ''}" data-array-index="${index}" ${index === current ? 'aria-current="true"' : ''}><span class="idx">indice ${index}</span><span class="val ${typeof value !== 'number' ? 'text' : ''}">${esc(fmt(value))}</span><span class="value-caption">valeur</span>${battery && typeof value === 'number' && value >= 0 && value <= 100 ? `<div class="battery" aria-hidden="true"><i style="width:${value}%"></i></div>` : ''}</div>`).join('') : '<div class="empty-array">[] · aucun élément à parcourir</div>'}</div>${length > 16 ? `<p class="small">Les 16 premières cases sont affichées, sur ${esc(length)}.</p>` : ''}`;
}

function frameContext(frames, position) {
  let loops = [];
  const signature = frame => (frame.stack || []).map(x => `${x.name}@${x.line}`);
  const prefix = (a, b) => a.length <= b.length && a.every((x, i) => x === b[i]);
  for (let i = 0; i <= position && i < frames.length; i++) {
    const frame = frames[i], stack = signature(frame);
    loops = loops.filter(loop => prefix(loop.stack, stack));
    if (frame.kind === 'condition' && ['for', 'while'].includes(frame.context)) {
      const key = `${frame.context}:${frame.line}:${stack.join('/')}`;
      const present = loops.findIndex(loop => loop.key === key);
      if (present >= 0) loops = loops.slice(0, present + 1);
      else loops.push({key, type:frame.context, line:frame.line, stack, index:null});
    }
    if (frame.kind === 'foreach-start') loops.push({key:`forEach:${frame.line}:${stack.join('/')}`, type:'foreach', line:frame.line, stack, index:null, array:frame.array});
    if (frame.kind === 'foreach-item') {
      const loop = [...loops].reverse().find(x => x.type === 'foreach' && x.stack.length === stack.length);
      if (loop) Object.assign(loop, {index:frame.index, array:frame.array, callbackName:null});
    }
    if (frame.kind === 'call') {
      const loop = [...loops].reverse().find(x => x.type === 'foreach' && x.stack.length + 1 === stack.length);
      if (loop) loop.callbackName = frame.functionName;
    }
    if (frame.kind === 'loop-end') {
      const type = frame.context === 'forEach' ? 'foreach' : frame.context;
      const index = loops.findLastIndex(loop => loop.type === type && loop.stack.length === stack.length);
      if (index >= 0) loops = loops.slice(0, index);
    }
  }
  return {loop:loops.at(-1) || null, foreach:[...loops].reverse().find(x => x.type === 'foreach') || null};
}

// Mask comments and strings before looking at loop headers. These expressions
// are annotations only; the interpreter remains the source of executed values.
function maskedSource(code) {
  return code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, text => text.replace(/[^\n]/g, ' '));
}
function loopHeaders(code) {
  const masked = maskedSource(code), headers = [], pattern = /\b(for|while)\s*\(/g;
  const lineAt = index => masked.slice(0, index).split('\n').length;
  let match;
  while ((match = pattern.exec(masked))) {
    const open = masked.indexOf('(', match.index), semicolons = [];
    let depth = 1, braces = 0, brackets = 0, end = open + 1;
    for (; end < masked.length && depth; end++) {
      const ch = masked[end];
      if (ch === '(') depth++; else if (ch === ')') depth--; else if (ch === '{') braces++; else if (ch === '}') braces--; else if (ch === '[') brackets++; else if (ch === ']') brackets--;
      if (ch === ';' && depth === 1 && !braces && !brackets) semicolons.push(end);
    }
    if (depth) continue;
    const close = end - 1, updateStart = semicolons.length === 2 ? semicolons[1] + 1 : close;
    const conditionStart = semicolons.length === 2 ? semicolons[0] + 1 : open + 1, conditionEnd = semicolons.length === 2 ? semicolons[1] : close;
    const lineEnd = masked.indexOf('\n', close), after = masked.slice(close + 1, lineEnd < 0 ? masked.length : lineEnd).trim();
    headers.push({type:match[1], line:lineAt(match.index), endLine:lineAt(close), updateLine:lineAt(updateStart), update:masked.slice(updateStart, close), condition:masked.slice(conditionStart, conditionEnd), init:semicolons.length === 2 ? masked.slice(open + 1, semicolons[0]) : '', inlineBody:after !== '' && after !== '{'});
  }
  return headers;
}
function headerFor(headers, loop) {
  return loop && headers.find(h => h.type === loop.type && loop.line >= h.line && loop.line <= h.endLine);
}
function actualMechanism(frame, context, frames, position, headers, diagramType) {
  const foreach = context.foreach, depth = (frame.stack || []).length;
  const callbackFrame = foreach && depth === foreach.stack.length + 1;
  const callbackResume = foreach && frame.kind === 'resume' && frame.functionName === foreach.callbackName;
  if (callbackFrame || callbackResume || frame.kind.startsWith('foreach-')) return {type:'foreach', loop:foreach};
  if (['define', 'call', 'return', 'resume', 'done'].includes(frame.kind)) return {type:'function', loop:null};
  if (frame.kind === 'loop-end') return {type:frame.context === 'forEach' ? 'foreach' : frame.context, loop:null};
  if (frame.kind === 'condition' && ['for', 'while'].includes(frame.context)) return {type:frame.context, loop:context.loop};
  if (context.loop?.stack.length === depth) return {type:context.loop.type, loop:context.loop};
  if (frame.kind === 'declare') {
    const following = frames.slice(position + 1).find(next => ['condition', 'call', 'return', 'resume', 'foreach-start'].includes(next.kind));
    if (following?.kind === 'condition' && ['for', 'while'].includes(following.context)) {
      const loop = {type:following.context, line:following.line, initializing:true};
      const header = headerFor(headers, loop);
      if (header && (header.type === 'while' || new RegExp(`(^|\\W)${escapePattern(frame.name)}(\\W|$)`).test(header.init))) return {type:header.type, loop};
    }
  }
  return {type:diagramType === 'array' ? 'array' : 'function', loop:null};
}
function renderMechanism(frame, mechanism, headers) {
  const {type, loop} = mechanism;
  let labels, notes, selected = -1;
  if (type === 'for' || type === 'while') {
    labels = ['Départ', 'Condition', 'Corps', 'Évolution'];
    notes = ['une fois', 'avant chaque tour', 'si vrai', type === 'for' ? 'dans l’en-tête' : 'à prévoir dans le code'];
    const header = headerFor(headers, loop);
    if (loop?.initializing) selected = 0;
    else if (frame.kind === 'condition' && frame.context === type) selected = 1;
    else if (['declare', 'read', 'assign', 'update', 'output', 'expression'].includes(frame.kind)) {
      selected = 2;
      if (['assign', 'update'].includes(frame.kind) && header && frame.name) {
        const pattern = new RegExp(`(^|\\W)${escapePattern(frame.name)}(\\W|$)`);
        if (type === 'while' && pattern.test(header.condition)) selected = 3;
        if (type === 'for' && pattern.test(header.update) && frame.line >= header.updateLine && frame.line <= header.endLine) selected = header.inlineBody ? -1 : 3;
      }
    }
  } else if (type === 'foreach') {
    labels = ['Élément', 'Callback', 'Retour', 'Suivant'];
    notes = ['valeur et indice', 'une invocation', 'vers forEach', 'le parcours continue'];
    selected = frame.kind === 'foreach-item' ? 0 : frame.kind === 'return' ? 2 : frame.kind === 'foreach-next' ? 3 : ['call', 'read', 'assign', 'update', 'output', 'declare', 'condition'].includes(frame.kind) ? 1 : -1;
  } else if (type === 'function') {
    labels = ['Déclaration', 'Appel', 'Instructions', 'Retour'];
    notes = ['définit la tâche', 'arguments → paramètres', 'variables locales', 'vers l’appelant'];
    selected = frame.kind === 'define' ? 0 : frame.kind === 'call' ? 1 : ['return', 'resume'].includes(frame.kind) ? 3 : 2;
  } else return '';
  if (['done', 'loop-end', 'error'].includes(frame.kind)) selected = -1;
  const note = type === 'foreach' ? 'Un return quitte le callback courant ; forEach peut appeler le suivant.' : type === 'for' ? 'La condition est testée avant chaque tour. L’évolution de l’en-tête, si elle existe, s’exécute après le corps.' : type === 'while' ? 'La condition est testée avant chaque tour. Le code doit prévoir ce qui la fait évoluer.' : 'Définir une fonction n’exécute pas son corps. Un appel fournit les arguments.';
  return `<div data-mechanism="${type}"><div class="flow" aria-label="Étapes du mécanisme">${labels.map((label, index) => `<div class="flow-node ${selected === index ? 'active' : ''}" ${selected === index ? 'aria-current="step"' : ''}>${label}<small>${notes[index]}</small></div>`).join('')}</div><p class="flow-note">${note}</p></div>`;
}

function parameters(code, invoke) {
  const match = maskedSource(code).match(new RegExp(`\\bfunction\\s+${escapePattern(invoke || '')}\\s*\\(([^)]*)\\)`));
  return match ? match[1].split(',').map(x => x.trim()).filter(Boolean) : [];
}

export function renderProgrammingVisual({activity = {}, code = '', args, execution, position = 0, stale = false}) {
  const interactive = activity.interactive || activity, diagramType = interactive.diagramType || 'array';
  args = Array.isArray(args) ? args : interactive.args || [];
  const frames = execution?.trace || [], frame = frames[position], previous = frames[position - 1];
  const vars = frame?.variables || {}, context = frameContext(frames, position), headers = loopHeaders(code);
  const arrayArg = args.findIndex(Array.isArray), params = parameters(code, interactive.invoke);
  const arrays = Object.entries(vars).filter(([, value]) => Array.isArray(value));
  let arrayName = arrays.find(([name]) => name === params[arrayArg])?.[0] || arrays[0]?.[0] || params[arrayArg] || 'Données de l’appel';
  let array = vars[arrayName] || (arrayArg >= 0 ? args[arrayArg] : []), length = frame?.arrayLengths?.[arrayName] ?? array.length;
  if (!arrays.length && ['resume', 'done'].includes(frame?.kind)) {
    const last = frames.slice(0, position + 1).findLast(f => (f.stack || []).length === 1 && f.stack[0].name === interactive.invoke && Array.isArray(f.variables?.[arrayName]));
    if (last) { array = last.variables[arrayName]; length = last.arrayLengths?.[arrayName] ?? array.length; }
  }
  if (Array.isArray(frame?.array)) {
    array = frame.array;
    arrayName = frame.arrayName || arrays.find(([, value]) => same(value, array))?.[0] || arrayName;
    length = frame.arrayLength ?? frame.arrayLengths?.[arrayName] ?? frame.length ?? array.length;
  }
  let index = Number.isInteger(frame?.index) ? frame.index : -1;
  if (index < 0 && context.loop?.type === 'foreach' && Number.isInteger(context.loop.index)) index = context.loop.index;
  else if (index < 0 && context.loop && ['for', 'while'].includes(context.loop.type)) {
    const header = headerFor(headers, context.loop);
    const name = header?.init.match(/(?:let|const|var)\s+([\w$]+)\s*=/)?.[1] || header?.condition.match(/\b([\w$]+)\s*[<>]=?\s*[\w$]+\.length/)?.[1];
    if (name && Number.isInteger(vars[name])) index = vars[name];
  }
  const visible = Object.entries(vars).filter(([name, value]) => name !== arrayName && !(typeof value === 'string' && value.startsWith('[fonction'))).slice(-12);
  const variables = visible.map(([name, value]) => `<div class="variable ${previous && !same(previous.variables?.[name], value) ? 'changed' : ''}"><span>${esc(name)}</span><strong>${esc(fmt(value))}</strong></div>`).join('');
  const completed = frame && ['done', 'resume'].includes(frame.kind) && !frame.stack?.length;
  const variableContent = variables || (completed ? '<p class="small">L’appel est terminé : ses variables locales ne sont plus accessibles. La valeur renvoyée reste visible ci-dessous.</p>' : '');
  const stack = frame?.stack || [], call = stack.at(-1), binding = frame?.kind === 'call' ? frame : call ? {params:call.params, args:call.args, functionName:call.name} : null;
  const bindings = binding?.params?.length ? `<p class="small">Arguments de l’appel → paramètres de <code>${esc(binding.functionName)}</code></p><div class="bindings ${frame.kind === 'call' ? 'incoming' : ''}">${binding.params.map((name, n) => `<div class="binding"><div>${esc(fmt(binding.args?.[n]))}</div><span aria-hidden="true">→</span><div>${esc(name)}</div></div>`).join('')}</div>` : '';
  const isReturn = frame && ['return', 'resume', 'done'].includes(frame.kind);
  const returnLabel = frame?.kind === 'done' ? 'Résultat final de l’appel' : frame?.kind === 'return' ? 'Valeur renvoyée par cette fonction' : 'Valeur reçue par l’appelant';
  const caption = stale ? 'Trace périmée : le code ou les arguments ont changé. Exécute à nouveau.' : frame?.label || execution?.error || 'Prévois le résultat, puis avance pas à pas.';
  const mechanism = frame ? renderMechanism(frame, actualMechanism(frame, context, frames, position, headers, diagramType), headers) : '';
  return `<div data-diagram="${esc(diagramType)}"><div class="array-label"><code>${esc(arrayName)}</code><span>length = ${esc(length)}</span></div>${renderArray(array, index, {battery:/batter/i.test(arrayName), length})}<p class="legend"><span class="index-color">Violet : indice</span><span class="value-color">Bleu : valeur</span><span>Orange : variable</span></p><div class="variables">${variableContent}</div><div class="caption" role="status"><strong>${frame ? esc(kindName(frame.kind)) : 'À observer'}</strong>${esc(caption)}</div>${mechanism}${bindings}<div class="result-box" ${isReturn ? '' : 'hidden'}>${returnLabel}<code data-result aria-label="Valeur renvoyée">${isReturn ? esc(fmt(frame.value)) : ''}</code></div><div class="stack">${stack.length ? 'Appels en cours : ' + stack.map(s => esc(s.name)).join(' → ') : 'Aucun appel en cours.'}</div>${execution?.traceTruncated ? '<p class="small">Trace limitée : certaines étapes intermédiaires ne sont pas conservées.</p>' : ''}</div>`;
}

export function renderComparisonTable() {
  return '<table><thead><tr><th>Écriture</th><th>Qui organise le parcours ?</th><th>Pour s’arrêter avant la fin</th></tr></thead><tbody><tr><td>for</td><td>Tu écris le départ, le test et l’évolution.</td><td>Condition, break ou return de la fonction.</td></tr><tr><td>while</td><td>Tu écris le test ; l’évolution doit être prévue.</td><td>Condition, break ou return de la fonction.</td></tr><tr><td>forEach</td><td>La méthode appelle ton callback pour les éléments présents.</td><td>Un return du callback ne termine pas le parcours. Choisis une autre écriture si nécessaire.</td></tr></tbody></table>';
}
