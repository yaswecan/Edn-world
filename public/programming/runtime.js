// Reviewed and maintained TweenTeach engine. Derived from the supplied teaching
// interpreter; never loaded from a lesson archive at runtime.
const FN=Symbol('function'), NATIVE=Symbol('native'), CONSOLE=Symbol('console');
let snapshotNodes=0,exportNodes=0;
let runtimeRun;
{
  'use strict';

  // Small, explicit JavaScript teaching interpreter. No eval / Function / network.
  // It executes the supported syntax, including student edits; traces are not
  // prerecorded. Unsupported language features stop with an explanatory error.
  // Snapshots use the strings "undefined", "NaN", "Infinity", and function labels
  // for values that JSON cannot represent. result retains the actual data value.
  const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const isFunction = value => !!(value && value[FN] === true);

  class LessonError extends Error {
    constructor(message, line, code) { super(message); this.line = line || 1; this.code=code||(/limite|Trop d’appels|interrompue après|dépasse/.test(message)?'LIMIT':/pas inclus|non pris|pas disponible|pas trac|pas tracée|ne sont pas|n’est pas incluse|spéciale|fléchées/.test(message)?'UNSUPPORTED':null); }
  }

  function tokenize(source) {
    const tokens = [];
    let index = 0, line = 1, column = 1;
    function advance() {
      const c = source[index++];
      if (c === '\n') { line++; column = 1; } else column++;
      return c;
    }
    const identifierStart = c => !!c && /[\p{L}_$]/u.test(c);
    const identifierPart = c => !!c && /[\p{L}\p{N}_$]/u.test(c);
    while (index < source.length) {
      const c = source[index];
      if (/\s/.test(c)) { advance(); continue; }
      if (c === '/' && source[index + 1] === '/') {
        while (index < source.length && source[index] !== '\n') advance();
        continue;
      }
      if (c === '/' && source[index + 1] === '*') {
        const initialLine = line;
        advance(); advance();
        while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) advance();
        if (index >= source.length) throw new LessonError('Le commentaire /* doit se terminer par */.', initialLine);
        advance(); advance(); continue;
      }
      const start = index, tokenLine = line, tokenColumn = column;
      if (identifierStart(c)) {
        let value = advance();
        while (identifierPart(source[index])) value += advance();
        tokens.push({ type: 'id', value, start, end: index, line: tokenLine, column: tokenColumn });
        continue;
      }
      if (/\d/.test(c) || (c === '.' && /\d/.test(source[index + 1] || ''))) {
        const number = source.slice(index).match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/)[0];
        for (let n = 0; n < number.length; n++) advance();
        if (identifierStart(source[index])) throw new LessonError('Sépare le nombre du nom qui le suit.', line);
        tokens.push({ type: 'number', value: Number(number), start, end: index, line: tokenLine, column: tokenColumn });
        continue;
      }
      if (c === '"' || c === "'") {
        const quote = advance();
        let value = '', closed = false;
        while (index < source.length) {
          const ch = advance();
          if (ch === quote) { closed = true; break; }
          if (ch === '\n' || ch === '\r') throw new LessonError('Ferme la chaîne de caractères avant le retour à la ligne.', tokenLine);
          if (ch === '\\') {
            if (index >= source.length) break;
            const escaped = advance();
            const escapes = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' };
            if (escaped === '\n') continue;
            if (escaped === 'u' || escaped === 'x') {
              const count = escaped === 'u' ? 4 : 2;
              const code = source.slice(index, index + count);
              if (!new RegExp('^[0-9a-fA-F]{' + count + '}$').test(code)) throw new LessonError('Séquence échappée incorrecte.', line);
              for (let n = 0; n < count; n++) advance();
              value += String.fromCharCode(parseInt(code, 16));
            } else value += own(escapes, escaped) ? escapes[escaped] : escaped;
          } else value += ch;
        }
        if (!closed) throw new LessonError('Une chaîne de caractères n’est pas fermée.', tokenLine);
        tokens.push({ type: 'string', value, start, end: index, line: tokenLine, column: tokenColumn });
        continue;
      }
      if (c === '`') throw new LessonError('Dans cet atelier, utilise des guillemets simples ou doubles pour les chaînes.', line);
      const operator = ['===', '!==', '>=', '<=', '==', '!=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '%=', '=>', '**'].find(op => source.startsWith(op, index));
      if (operator) {
        for (let n = 0; n < operator.length; n++) advance();
        tokens.push({ type: 'op', value: operator, start, end: index, line: tokenLine, column: tokenColumn });
        continue;
      }
      if ('{}[]();,.:?+-*/%<>=!'.includes(c)) {
        advance(); tokens.push({ type: 'op', value: c, start, end: index, line: tokenLine, column: tokenColumn }); continue;
      }
      throw new LessonError('Caractère non pris en charge dans cet atelier : ' + c, line);
    }
    tokens.push({ type: 'eof', value: '<fin>', start: index, end: index, line, column });
    return tokens;
  }

  class Parser {
    constructor(source) { this.source = source; this.tokens = tokenize(source); this.index = 0; this.functionDepth = 0; this.loopDepth = 0; }
    peek(offset) { return this.tokens[this.index + (offset || 0)]; }
    take() { return this.tokens[this.index++]; }
    match(value) { if (this.peek().value === value) { return this.take(); } return null; }
    expect(value) {
      if (this.peek().value !== value) throw new LessonError('« ' + value + ' » attendu ; trouvé « ' + this.peek().value + ' ».', this.peek().line);
      return this.take();
    }
    name() {
      const token = this.peek();
      if (token.type !== 'id' || ['let', 'const', 'var', 'for', 'while', 'if', 'else', 'return', 'function', 'break', 'continue', 'true', 'false', 'null', 'new', 'this', 'class', 'switch', 'do', 'try', 'throw', 'typeof', 'delete', 'in', 'of'].includes(token.value)) throw new LessonError('Un nom de variable ou de paramètre est attendu.', token.line);
      return this.take();
    }
    node(type, start, properties) { return Object.assign({ type, line: start.line, start: start.start, end: this.tokens[Math.max(0, this.index - 1)].end }, properties || {}); }
    semicolon() {
      if (this.match(';')) return;
      const previous = this.tokens[this.index - 1];
      if (this.peek().type === 'eof' || this.peek().value === '}' || (previous && this.peek().line > previous.line)) return;
      throw new LessonError('Un point-virgule ou une nouvelle ligne est attendu.', this.peek().line);
    }
    program() {
      const start = this.peek(), body = [];
      while (this.peek().type !== 'eof') body.push(this.statement());
      return this.node('Program', start, { body });
    }
    block() {
      const start = this.expect('{'), body = [];
      while (this.peek().value !== '}') {
        if (this.peek().type === 'eof') throw new LessonError('Il manque une accolade fermante }.', start.line);
        body.push(this.statement());
      }
      this.expect('}'); return this.node('Block', start, { body });
    }
    statement() {
      const start = this.peek();
      if (this.match(';')) return this.node('Empty', start);
      if (start.value === '{') return this.block();
      if (['let', 'const', 'var'].includes(start.value)) { const result = this.declaration(); this.semicolon(); return result; }
      if (start.value === 'function') return this.function(true);
      if (this.match('if')) {
        this.expect('('); const test = this.expression(); this.expect(')');
        const consequent = this.statement(), alternate = this.match('else') ? this.statement() : null;
        return this.node('If', start, { test, consequent, alternate });
      }
      if (this.match('for')) {
        this.expect('(');
        let init = null;
        if (this.peek().value !== ';') init = ['let', 'const', 'var'].includes(this.peek().value) ? this.declaration() : this.expression();
        if (['in', 'of'].includes(this.peek().value)) throw new LessonError('Cet atelier trace for (départ; condition; évolution). Les parcours for…of et for…in ne sont pas inclus.', this.peek().line);
        this.expect(';'); const test = this.peek().value === ';' ? null : this.expression(); this.expect(';');
        const update = this.peek().value === ')' ? null : this.expression(); this.expect(')');
        this.loopDepth++; const body = this.statement(); this.loopDepth--;
        return this.node('For', start, { init, test, update, body });
      }
      if (this.match('while')) {
        this.expect('('); const test = this.expression(); this.expect(')');
        this.loopDepth++; const body = this.statement(); this.loopDepth--;
        return this.node('While', start, { test, body });
      }
      if (this.match('return')) {
        if (!this.functionDepth) throw new LessonError('return s’utilise dans une fonction.', start.line);
        const argument = this.peek().line > start.line || [';', '}'].includes(this.peek().value) || this.peek().type === 'eof' ? null : this.expression();
        this.semicolon(); return this.node('Return', start, { argument });
      }
      if (this.match('break') || this.match('continue')) {
        if (!this.loopDepth) throw new LessonError(start.value + ' doit se trouver dans une boucle for ou while de la même fonction. Dans un callback forEach, return quitte seulement le callback.', start.line);
        this.semicolon(); return this.node(start.value === 'break' ? 'Break' : 'Continue', start);
      }
      if (['switch', 'do', 'try', 'throw', 'class', 'import', 'export', 'async', 'await', 'debugger', 'with'].includes(start.value)) throw new LessonError('La construction « ' + start.value + ' » n’est pas incluse dans cet atelier de boucles et de fonctions.', start.line);
      const expression = this.expression(); this.semicolon(); return this.node('ExpressionStatement', start, { expression });
    }
    declaration() {
      const start = this.take(), declarations = [];
      do {
        const id = this.name();
        const init = this.match('=') ? this.assignment() : null;
        if (start.value === 'const' && !init) throw new LessonError('Une constante doit recevoir une valeur lors de sa déclaration.', id.line);
        declarations.push({ name: id.value, init, line: id.line });
      } while (this.match(','));
      return this.node('Declaration', start, { kind: start.value, declarations });
    }
    function(declaration) {
      const start = this.expect('function');
      const id = this.peek().type === 'id' ? this.name().value : null;
      if (declaration && !id) throw new LessonError('Donne un nom à la fonction déclarée.', start.line);
      this.expect('('); const params = [];
      if (this.peek().value !== ')') {
        do { const p = this.name(); if (params.includes(p.value)) throw new LessonError('Chaque paramètre doit avoir un nom différent dans cet atelier.', p.line); params.push(p.value); } while (this.match(',') && this.peek().value !== ')');
      }
      this.expect(')');
      const outerLoops = this.loopDepth; this.loopDepth = 0; this.functionDepth++;
      const body = this.block(); this.functionDepth--; this.loopDepth = outerLoops;
      return this.node(declaration ? 'FunctionDeclaration' : 'FunctionExpression', start, { name: id, params, body });
    }
    expression() {
      const start = this.peek(), expressions = [this.assignment()];
      while (this.match(',')) expressions.push(this.assignment());
      return expressions.length === 1 ? expressions[0] : this.node('Sequence', start, { expressions });
    }
    assignment() {
      const start = this.peek(), left = this.conditional();
      if (['=', '+=', '-=', '*=', '/=', '%='].includes(this.peek().value)) {
        const operator = this.take().value;
        if (!['Identifier', 'Member'].includes(left.type)) throw new LessonError('La partie gauche d’une affectation doit être une variable ou une case de tableau.', start.line);
        return this.node('Assignment', start, { operator, left, right: this.assignment() });
      }
      if (this.peek().value === '=>') throw new LessonError('Pour cette séance, écris le callback avec function(valeur, indice) { … } ; les fonctions fléchées ne sont pas tracées.', this.peek().line);
      return left;
    }
    conditional() {
      const start = this.peek(), test = this.binary(0);
      if (!this.match('?')) return test;
      const consequent = this.assignment(); this.expect(':'); const alternate = this.assignment();
      return this.node('Conditional', start, { test, consequent, alternate });
    }
    binary(level) {
      const levels = [['||'], ['&&'], ['==', '!=', '===', '!=='], ['<', '<=', '>', '>='], ['+', '-'], ['*', '/', '%']];
      if (level === levels.length) return this.unary();
      const start = this.peek(); let left = this.binary(level + 1);
      while (levels[level].includes(this.peek().value)) {
        const operator = this.take().value, right = this.binary(level + 1);
        left = this.node('Binary', start, { operator, left, right });
      }
      return left;
    }
    unary() {
      const start = this.peek();
      if (['!', '+', '-', 'typeof'].includes(start.value)) { this.take(); return this.node('Unary', start, { operator: start.value, argument: this.unary() }); }
      if (['++', '--'].includes(start.value)) {
        this.take(); const argument = this.unary();
        if (!['Identifier', 'Member'].includes(argument.type)) throw new LessonError('++ et -- s’appliquent à une variable ou à une case.', start.line);
        return this.node('Update', start, { operator: start.value, argument, prefix: true });
      }
      return this.postfix();
    }
    postfix() {
      const start = this.peek(); let expression = this.primary();
      while (true) {
        if (this.match('[')) {
          const property = this.expression(); this.expect(']'); expression = this.node('Member', start, { object: expression, property, computed: true });
        } else if (this.match('.')) {
          const token = this.take(); if (token.type !== 'id') throw new LessonError('Un nom de propriété est attendu après le point.', token.line);
          expression = this.node('Member', start, { object: expression, property: token.value, computed: false });
        } else if (this.match('(')) {
          const args = [];
          if (this.peek().value !== ')') do { args.push(this.assignment()); } while (this.match(',') && this.peek().value !== ')');
          this.expect(')'); expression = this.node('Call', start, { callee: expression, arguments: args });
        } else break;
      }
      if (['++', '--'].includes(this.peek().value) && this.peek().line === this.tokens[this.index - 1].line) {
        const operator = this.take().value;
        if (!['Identifier', 'Member'].includes(expression.type)) throw new LessonError('++ et -- s’appliquent à une variable ou à une case.', start.line);
        expression = this.node('Update', start, { operator, argument: expression, prefix: false });
      }
      return expression;
    }
    primary() {
      const start = this.peek();
      if (start.type === 'number' || start.type === 'string') { this.take(); return this.node('Literal', start, { value: start.value }); }
      if (['true', 'false', 'null'].includes(start.value)) { this.take(); return this.node('Literal', start, { value: start.value === 'null' ? null : start.value === 'true' }); }
      if (start.value === 'function') return this.function(false);
      if (this.match('(')) { const result = this.expression(); this.expect(')'); return result; }
      if (this.match('[')) {
        const elements = [];
        while (this.peek().value !== ']') {
          if (this.match(',')) { elements.push(null); continue; }
          elements.push(this.assignment());
          if (!this.match(',')) break;
        }
        this.expect(']'); return this.node('Array', start, { elements });
      }
      if (this.match('{')) {
        const properties = [];
        while (this.peek().value !== '}') {
          const key = this.take();
          if (!['id', 'string', 'number'].includes(key.type)) throw new LessonError('Un nom de propriété est attendu.', key.line);
          if (FORBIDDEN.has(String(key.value))) throw new LessonError('Cette propriété spéciale n’est pas disponible dans l’atelier.', key.line);
          let value;
          if (this.match(':')) value = this.assignment();
          else if (key.type === 'id') value = this.node('Identifier', key, { name: key.value });
          else throw new LessonError('Deux-points attendu après la propriété.', key.line);
          properties.push({ key: String(key.value), value });
          if (!this.match(',')) break;
        }
        this.expect('}'); return this.node('Object', start, { properties });
      }
      if (start.value === 'new' || start.value === 'this') throw new LessonError('« ' + start.value + ' » n’est pas inclus dans cet atelier.', start.line);
      if (start.type === 'id') { const id = this.name(); return this.node('Identifier', start, { name: id.value }); }
      throw new LessonError('Une valeur, une variable ou un appel est attendu ; trouvé « ' + start.value + ' ».', start.line);
    }
  }

  class Environment {
    constructor(parent, kind) { this.parent = parent || null; this.kind = kind || 'block'; this.bindings = new Map(); }
    functionScope() { let scope = this; while (scope.parent && !['function', 'global'].includes(scope.kind)) scope = scope.parent; return scope; }
    find(name) { if (this.bindings.has(name)) return this; return this.parent ? this.parent.find(name) : null; }
    reserve(name, kind, line, value, initialized) {
      if (this.bindings.has(name)) {
        const old = this.bindings.get(name);
        if (kind === 'var' && ['var', 'parameter', 'function'].includes(old.kind)) return;
        if (kind === 'function' && ['var', 'function'].includes(old.kind)) { this.bindings.set(name, { kind, value, initialized: true }); return; }
        throw new LessonError('« ' + name + ' » est déjà déclaré dans ce bloc.', line);
      }
      this.bindings.set(name, { kind, value, initialized: initialized !== false });
    }
    get(name, line) {
      const scope = this.find(name);
      if (!scope) throw new LessonError('« ' + name + ' » n’est pas défini. Vérifie le nom et la portée.', line);
      const binding = scope.bindings.get(name);
      if (!binding.initialized) throw new LessonError('« ' + name + ' » est utilisé avant sa déclaration.', line);
      return binding.value;
    }
    set(name, value, line) {
      const scope = this.find(name);
      if (!scope) throw new LessonError('Déclare « ' + name + ' » avec let ou const avant de l’utiliser.', line);
      const binding = scope.bindings.get(name);
      if (!binding.initialized) throw new LessonError('« ' + name + ' » est utilisé avant sa déclaration.', line);
      if (binding.kind === 'const' || binding.kind === 'builtin') throw new LessonError('Impossible de réaffecter la constante « ' + name + ' ». Utilise let si cette valeur doit évoluer.', line);
      binding.value = value;
      return value;
    }
  }

  function snapshot(value, seen, depth) {
    if(++snapshotNodes>2500)return '[aperçu limité]';
    if(typeof value==='string'&&value.length>1000)return value.slice(0,1000)+'[… texte abrégé]';
    const level = depth || 0;
    if (value === undefined) return 'undefined';
    if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
    if (isFunction(value)) return '[fonction ' + (value.name || 'anonyme') + ']';
    if (value && value[NATIVE]) return '[fonction native ' + value.name + ']';
    if (typeof value !== 'object' || value === null) return value;
    if (level > 5) return '[…]';
    const visited = seen || new Set();
    if (visited.has(value)) return '[référence circulaire]';
    visited.add(value);
    let copy;
    if (Array.isArray(value)) {
      copy = [];
      for (let i = 0; i < Math.min(value.length, 80); i++) copy.push(own(value, i) ? snapshot(value[i], visited, level + 1) : '[case vide]');
      if (value.length > 80) copy.push('[… ' + (value.length - 80) + ' autres cases]');
    } else {
      copy = {};
      Object.keys(value).slice(0, 80).forEach(key => { if (!FORBIDDEN.has(key)) copy[key] = snapshot(value[key], visited, level + 1); });
    }
    visited.delete(value);
    return copy;
  }

  class Executor {
    constructor(source, options) {
      this.source = source;
      this.options = options;
      this.maxSteps = Math.max(10, Math.min(Number(options.maxSteps) || 6000, 12000));
      this.maxTrace = Math.max(10, Math.min(Number(options.maxTrace) || 600, 1500));
      this.maxLogs = Math.max(1, Math.min(Number(options.maxLogs) || 100, 500));
      this.traceBytes=0; this.allocated=0; this.steps = 0; this.trace = []; this.logs = []; this.stack = []; this.traceTruncated = false; this.logsTruncated = false;
      this.global = new Environment(null, 'global');
      this.current = this.global; this.lastNode = { line: 1 };
      this.global.reserve('undefined', 'builtin', 1, undefined);
      this.global.reserve('NaN', 'builtin', 1, NaN);
      this.global.reserve('Infinity', 'builtin', 1, Infinity);
      this.global.reserve('console', 'builtin', 1, { [CONSOLE]: true });
    }
    tick(node, env) {
      this.lastNode = node || this.lastNode; this.current = env || this.current;
      this.steps++;
      if (this.steps > this.maxSteps) throw new LessonError('Exécution interrompue après ' + this.maxSteps + ' opérations. Vérifie la condition d’arrêt et l’évolution des variables ; la limite peut aussi être atteinte par un calcul très long.', this.lastNode.line);
    }
    variables(env) {
      const chain = [], result = {};
      for (let scope = env; scope; scope = scope.parent) chain.unshift(scope);
      chain.forEach(scope => scope.bindings.forEach((binding, name) => {
        if (binding.kind !== 'builtin' && binding.initialized && !FORBIDDEN.has(name)) result[name] = snapshot(binding.value);
      }));
      return result;
    }
    arrayLengths(env){const lengths={};const chain=[];for(let scope=env;scope;scope=scope.parent)chain.unshift(scope);for(const scope of chain)for(const [name,b] of scope.bindings)if(Array.isArray(b.value))lengths[name]=b.value.length;return lengths;}
    emit(node, env, kind, label, extra) {
      snapshotNodes=0;
      const event = Object.assign({ line: node.line || 1, kind, label, variables: this.variables(env), arrayLengths:this.arrayLengths(env), stack: this.stack.map(frame => ({ name: frame.name, line: frame.line, params: frame.params.slice(), args: snapshot(frame.args) })), operation: this.steps }, extra || {});
      const bytes=JSON.stringify(event).length; this.traceBytes+=bytes;
      if(this.traceBytes>2000000&&['error','done'].includes(kind)){event.variables={};event.stack=[];this.traceTruncated=true;}
      if(this.traceBytes>2000000&&!['error','done'].includes(kind))throw new LessonError('La trace dépasse la limite de 2 Mo.',node.line,'LIMIT');
      if (this.trace.length < this.maxTrace) this.trace.push(event);
      else { this.traceTruncated = true; if (['error', 'done', 'return'].includes(kind)) this.trace[this.trace.length - 1] = event; }
    }
    text(node) { return this.source.slice(node.start || 0, node.end || 0).trim(); }
    makeFunction(node, env) { return { [FN]: true, name: node.name || 'callback', params: node.params, body: node.body, env, node, namedExpression: node.type === 'FunctionExpression' && !!node.name }; }
    hoistVars(node, env) {
      if (!node || ['FunctionDeclaration', 'FunctionExpression'].includes(node.type)) return;
      if (node.type === 'Declaration' && node.kind === 'var') node.declarations.forEach(d => env.functionScope().reserve(d.name, 'var', d.line, undefined));
      if (node.body) {
        if (Array.isArray(node.body)) node.body.forEach(child => this.hoistVars(child, env));
        else this.hoistVars(node.body, env);
      }
      if (node.init) this.hoistVars(node.init, env);
      if (node.consequent) this.hoistVars(node.consequent, env);
      if (node.alternate) this.hoistVars(node.alternate, env);
    }
    prepare(body, env) {
      body.forEach(statement => {
        if (statement.type === 'FunctionDeclaration') env.reserve(statement.name, 'function', statement.line, this.makeFunction(statement, env));
        if (statement.type === 'Declaration' && statement.kind !== 'var') statement.declarations.forEach(d => env.reserve(d.name, statement.kind, d.line, undefined, false));
      });
    }
    statements(body, env, prepared) {
      if (!prepared) this.prepare(body, env);
      for (const statement of body) this.execute(statement, env);
    }
    execute(node, env) {
      this.tick(node, env);
      switch (node.type) {
        case 'Program': this.hoistVars(node, env); this.statements(node.body, env); return;
        case 'Empty': return;
        case 'Block': { const block = new Environment(env, 'block'); this.statements(node.body, block); return; }
        case 'FunctionDeclaration': this.emit(node, env, 'define', 'La fonction ' + node.name + ' est définie. Son corps attend un appel.', { functionName: node.name, params: node.params.slice() }); return;
        case 'Declaration': {
          for (const declaration of node.declarations) {
            const scope = node.kind === 'var' ? env.functionScope() : env;
            if (!scope.bindings.has(declaration.name)) scope.reserve(declaration.name, node.kind, declaration.line, undefined, node.kind === 'var');
            const binding = scope.bindings.get(declaration.name);
            if (declaration.init) binding.value = this.evaluate(declaration.init, env);
            else if (node.kind !== 'var') binding.value = undefined;
            binding.initialized = true;
            this.emit({ line: declaration.line }, env, 'declare', declaration.name + ' reçoit ' + this.show(binding.value) + '.', { name: declaration.name, value: snapshot(binding.value) });
          }
          return;
        }
        case 'ExpressionStatement': {
          const value = this.evaluate(node.expression, env);
          if (!['Assignment', 'Update', 'Call'].includes(node.expression.type)) this.emit(node, env, 'expression', 'Expression évaluée : ' + this.show(value), { value: snapshot(value) });
          return;
        }
        case 'If': {
          const value = this.evaluate(node.test, env), pass = !!value;
          this.emit(node.test, env, 'condition', this.text(node.test) + ' → ' + pass, { value: pass, expression: this.text(node.test), context: 'if' });
          if (pass) this.execute(node.consequent, env); else if (node.alternate) this.execute(node.alternate, env);
          return;
        }
        case 'For': {
          let scope = new Environment(env, 'for');
          if (node.init) {
            if (node.init.type === 'Declaration') this.execute(node.init, scope); else this.evaluate(node.init, scope);
          }
          const letNames = node.init && node.init.type === 'Declaration' && node.init.kind === 'let' ? node.init.declarations.map(d => d.name) : [];
          while (true) {
            this.tick(node, scope);
            const value = node.test ? this.evaluate(node.test, scope) : true;
            this.emit(node.test || node, scope, 'condition', (node.test ? this.text(node.test) : 'Condition absente') + ' → ' + !!value, { value: !!value, expression: node.test ? this.text(node.test) : 'true', context: 'for' });
            if (!value) break;
            try { this.execute(node.body, scope); } catch (signal) {
              if (signal && signal.control === 'break') break;
              if (!(signal && signal.control === 'continue')) throw signal;
            }
            if (letNames.length) {
              const fresh = new Environment(env, 'for');
              letNames.forEach(name => fresh.reserve(name, 'let', node.line, scope.get(name, node.line)));
              scope = fresh;
            }
            if (node.update) this.evaluate(node.update, scope);
          }
          this.emit(node, env, 'loop-end', 'La boucle for est terminée.', { context: 'for' });
          return;
        }
        case 'While': {
          while (true) {
            this.tick(node, env);
            const value = this.evaluate(node.test, env);
            this.emit(node.test, env, 'condition', this.text(node.test) + ' → ' + !!value, { value: !!value, expression: this.text(node.test), context: 'while' });
            if (!value) break;
            try { this.execute(node.body, env); } catch (signal) {
              if (signal && signal.control === 'break') break;
              if (!(signal && signal.control === 'continue')) throw signal;
            }
          }
          this.emit(node, env, 'loop-end', 'La boucle while est terminée.', { context: 'while' });
          return;
        }
        case 'Return': {
          const value = node.argument ? this.evaluate(node.argument, env) : undefined;
          this.emit(node, env, 'return', 'return termine cet appel et renvoie ' + this.show(value) + '.', { value: snapshot(value), functionName: this.stack.length ? this.stack[this.stack.length - 1].name : '' });
          throw { control: 'return', value };
        }
        case 'Break': this.emit(node, env, 'break', 'break quitte immédiatement cette boucle.'); throw { control: 'break' };
        case 'Continue': this.emit(node, env, 'continue', 'continue passe à la suite du parcours sans terminer ce tour.'); throw { control: 'continue' };
        default: throw new LessonError('Instruction non prise en charge : ' + node.type, node.line);
      }
    }
    show(value) {
      const saved = snapshot(value);
      if (typeof saved === 'string') return saved;
      try { return JSON.stringify(saved); } catch (_) { return String(saved); }
    }
    property(object, key, node) {
      key = String(key);
      if (FORBIDDEN.has(key)) throw new LessonError('Cette propriété spéciale n’est pas disponible dans l’atelier.', node.line);
      if (object === null || object === undefined) throw new LessonError('Impossible de lire « ' + key + ' » sur ' + String(object) + '.', node.line);
      if(object[NATIVE])throw new LessonError('Objet interne non disponible.',node.line,'UNSUPPORTED');
      if (isFunction(object)) {
        if (key === 'name') return object.name;
        if (key === 'length') return object.params.length;
        throw new LessonError('Cette propriété de fonction n’est pas incluse dans l’atelier.', node.line);
      }
      if (object[CONSOLE]) {
        if (key === 'log') return { [NATIVE]: true, name: 'console.log' };
        throw new LessonError('Utilise console.log pour afficher une valeur dans cet atelier.', node.line);
      }
      if (Array.isArray(object) && ['push', 'pop', 'forEach', 'join', 'slice', 'includes', 'indexOf'].includes(key)) return { [NATIVE]: true, name: key, receiver: object };
      if (typeof object === 'string' && ['toUpperCase', 'toLowerCase', 'includes', 'slice'].includes(key)) return { [NATIVE]: true, name: key, receiver: object };
      if (typeof object === 'object' && !own(object, key) && key !== 'length') return undefined;
      const value = object[key];
      if (typeof value === 'function') throw new LessonError('La méthode « ' + key + ' » n’est pas tracée dans cet atelier.', node.line);
      return value;
    }
    reference(node, env) {
      if (node.type === 'Identifier') return { get: () => env.get(node.name, node.line), set: value => env.set(node.name, value, node.line), name: node.name };
      if (node.type === 'Member') {
        const object = this.evaluate(node.object, env), key = String(node.computed ? this.evaluate(node.property, env) : node.property);
        if (FORBIDDEN.has(key)) throw new LessonError('Cette propriété spéciale n’est pas disponible dans l’atelier.', node.line);
        if (object === null || typeof object !== 'object' || isFunction(object) || object[NATIVE] || object[CONSOLE]) throw new LessonError('Cette valeur ne permet pas de modifier une propriété.', node.line);
        return { get: () => this.property(object, key, node), set: value => {
          if(Array.isArray(object)&&key!=='length'&&!/^(0|[1-9][0-9]*)$/.test(key))throw new LessonError('Seules les cases et la longueur du tableau sont modifiables.',node.line,'UNSUPPORTED');
          if (Array.isArray(object) && key === 'length' && (!Number.isInteger(value) || value < 0 || value > 1000)) throw new LessonError('Dans cet atelier, la longueur doit être un entier de 0 à 1000.', node.line);
          if (Array.isArray(object) && /^\d+$/.test(key) && Number(key) >= 1000) throw new LessonError('Cet atelier limite les tableaux à 1000 cases.', node.line);
          this.allocate(1,node); object[key] = value; return value;
        }, name: this.text(node) };
      }
      throw new LessonError('Cette expression ne peut pas recevoir une nouvelle valeur.', node.line);
    }
    binary(operator, left, right, node) {
      let value;
      switch (operator) {
        case '+': value = left + right; break;
        case '-': value = left - right; break;
        case '*': value = left * right; break;
        case '/': value = left / right; break;
        case '%': value = left % right; break;
        case '<': value = left < right; break;
        case '<=': value = left <= right; break;
        case '>': value = left > right; break;
        case '>=': value = left >= right; break;
        case '===': value = left === right; break;
        case '!==': value = left !== right; break;
        // Intentional native coercion, matching the JavaScript operators.
        case '==': value = left == right; break; // eslint-disable-line eqeqeq
        case '!=': value = left != right; break; // eslint-disable-line eqeqeq
        default: throw new LessonError('Opérateur non pris en charge : ' + operator, node.line);
      }
      if (typeof value === 'string' && value.length > 10000) throw new LessonError('La chaîne dépasse la limite de 10 000 caractères de cet atelier.', node.line);
      return value;
    }
    allocate(n,node){this.allocated+=n;if(this.allocated>20000)throw new LessonError('Mémoire utile limitée à 20 000 cellules allouées.',node.line,'LIMIT');}
    bound(v,node){if(typeof v==='string'&&v.length>10000)throw new LessonError('Texte limité à 10 000 caractères.',node.line,'LIMIT');return v;}
    evaluate(node, env) {
      this.tick(node, env);
      switch (node.type) {
        case 'Literal': return node.value;
        case 'Identifier': return env.get(node.name, node.line);
        case 'Array': { this.allocate(node.elements.length,node); const array = new Array(node.elements.length); node.elements.forEach((element, index) => { if (element) array[index] = this.evaluate(element, env); }); return array; }
        case 'Object': { this.allocate(node.properties.length,node); const object = {}; node.properties.forEach(p => { object[p.key] = this.evaluate(p.value, env); }); return object; }
        case 'FunctionExpression': return this.makeFunction(node, env);
        case 'Sequence': { let value; node.expressions.forEach(expression => { value = this.evaluate(expression, env); }); return value; }
        case 'Conditional': return this.evaluate(this.evaluate(node.test, env) ? node.consequent : node.alternate, env);
        case 'Unary': {
          if (node.operator === 'typeof' && node.argument.type === 'Identifier' && !env.find(node.argument.name)) return 'undefined';
          const value = this.evaluate(node.argument, env);
          if (node.operator === '!') return !value;
          if (node.operator === '+') return +value;
          if (node.operator === '-') return -value;
          if (node.operator === 'typeof') return isFunction(value) || (value && value[NATIVE]) ? 'function' : typeof value;
          throw new LessonError('Opérateur non pris en charge.', node.line);
        }
        case 'Binary': {
          const left = this.evaluate(node.left, env);
          if (node.operator === '&&') return left ? this.evaluate(node.right, env) : left;
          if (node.operator === '||') return left ? left : this.evaluate(node.right, env);
          return this.binary(node.operator, left, this.evaluate(node.right, env), node);
        }
        case 'Member': {
          const object = this.evaluate(node.object, env), key = node.computed ? this.evaluate(node.property, env) : node.property;
          const value = this.property(object, key, node);
          if (Array.isArray(object) && node.computed) this.emit(node, env, 'read', this.text(node) + ' vaut ' + this.show(value) + '.', { arrayName: this.text(node.object), index: snapshot(key), value: snapshot(value), array: snapshot(object), arrayLength:object.length, inBounds: Number.isInteger(Number(key)) && Number(key) >= 0 && Number(key) < object.length });
          return value;
        }
        case 'Assignment': {
          const reference = this.reference(node.left, env);
          const before = reference.get();
          const right = this.evaluate(node.right, env);
          const value = node.operator === '=' ? right : this.binary(node.operator.slice(0, -1), before, right, node);
          reference.set(value);
          this.emit(node, env, 'assign', reference.name + ' reçoit ' + this.show(value) + '.', { name: reference.name, value: snapshot(value), previous: snapshot(before) });
          return value;
        }
        case 'Update': {
          const reference = this.reference(node.argument, env), previous = Number(reference.get()), value = previous + (node.operator === '++' ? 1 : -1);
          reference.set(value); this.emit(node, env, 'update', reference.name + ' passe de ' + this.show(previous) + ' à ' + this.show(value) + '.', { name: reference.name, previous: snapshot(previous), value: snapshot(value) });
          return node.prefix ? value : previous;
        }
        case 'Call': {
          const fn = this.evaluate(node.callee, env), args = node.arguments.map(argument => this.evaluate(argument, env));
          return this.call(fn, args, node, env);
        }
        default: throw new LessonError('Expression non prise en charge : ' + node.type, node.line);
      }
    }
    call(fn, args, node, env) {
      this.tick(node, env);
      if (fn && fn[NATIVE]) return this.native(fn, args, node, env);
      if (!isFunction(fn)) throw new LessonError('La valeur appelée n’est pas une fonction. Vérifie son nom et les parenthèses.', node.line);
      if (this.stack.length >= 24) throw new LessonError('Trop d’appels imbriqués. Vérifie la condition d’arrêt de ta fonction.', node.line);
      let parent = fn.env;
      if (fn.namedExpression) { parent = new Environment(fn.env, 'block'); parent.reserve(fn.name, 'const', fn.node.line, fn); }
      const scope = new Environment(parent, 'function');
      fn.params.forEach((parameter, index) => scope.reserve(parameter, 'parameter', fn.node.line, args[index]));
      this.stack.push({ name: fn.name, line: node.line, params: fn.params, args: args.slice() });
      this.emit(node, scope, 'call', 'Appel de ' + fn.name + ' : les arguments alimentent les paramètres.', { functionName: fn.name, args: snapshot(args), params: fn.params.slice(), bindings: Object.fromEntries(fn.params.map((p, i) => [p, snapshot(args[i])])) });
      let result, returned = false;
      try {
        this.hoistVars(fn.body, scope);
        this.statements(fn.body.body, scope);
      } catch (signal) {
        if (signal && signal.control === 'return') { result = signal.value; returned = true; }
        else throw signal;
      }
      if (!returned) this.emit(fn.body, scope, 'return', 'Fin de ' + fn.name + ' sans return : la valeur renvoyée est undefined.', { value: 'undefined', functionName: fn.name, implicit: true });
      this.stack.pop();
      this.emit(node, env, 'resume', 'L’appel de ' + fn.name + ' renvoie ' + this.show(result) + '.', { value: snapshot(result), functionName: fn.name });
      return result;
    }
    native(fn, args, node, env) {
      const array = fn.receiver;
      switch (fn.name) {
        case 'console.log': {
          const values = args.map(value => snapshot(value));
          if (this.logs.length < this.maxLogs) this.logs.push(values); else this.logsTruncated = true;
          this.emit(node, env, 'output', 'Console : ' + args.map(value => this.show(value)).join(' '), { output: values, value: 'undefined' });
          return undefined;
        }
        case 'forEach': {
          if (args.length > 1) throw new LessonError('Le paramètre thisArg de forEach n’est pas inclus dans cet atelier.', node.line);
          if (!isFunction(args[0]) && !(args[0] && args[0][NATIVE])) throw new LessonError('forEach attend une fonction à appeler pour chaque élément. Passe son nom sans l’appeler, ou écris function(valeur, indice) { … }.', node.line);
          const initialLength = array.length;
          this.emit(node, env, 'foreach-start', 'forEach mémorise ' + initialLength + ' cases à parcourir et appelle le callback pour les cases présentes.', { array: snapshot(array), length: initialLength });
          for (let index = 0; index < initialLength; index++) {
            this.tick(node, env);
            if (!(index in array)) continue;
            this.emit(node, env, 'foreach-item', 'forEach appelle le callback avec la valeur ' + this.show(array[index]) + ' et l’indice ' + index + '.', { index, value: snapshot(array[index]), array: snapshot(array) });
            const value = this.call(args[0], [array[index], index, array], node, env);
            this.emit(node, env, 'foreach-next', 'Le retour du callback (' + this.show(value) + ') est ignoré ; forEach poursuit le parcours.', { index, value: snapshot(value) });
          }
          this.emit(node, env, 'loop-end', 'forEach est terminé et renvoie undefined.', { context: 'forEach', value: 'undefined' });
          return undefined;
        }
        case 'push':
          if (array.length + args.length > 1000) throw new LessonError('Cet atelier limite les tableaux à 1000 cases.', node.line);
          this.allocate(args.length,node); array.push(...args);
          this.emit(node, env, 'array-write', 'push ajoute ' + args.length + ' valeur(s). La longueur devient ' + array.length + '.', { array: snapshot(array), value: array.length });
          return array.length;
        case 'pop': { const value = array.pop(); this.emit(node, env, 'array-write', 'pop retire la dernière case.', { array: snapshot(array), value: snapshot(value) }); return value; }
        case 'join': { const sep=args.length?String(args[0]):',';if(sep.length>1000)throw new LessonError('Séparateur trop long.',node.line,'LIMIT');return this.bound(array.join(sep),node); }
        case 'slice': this.allocate(array.length,node);return array.slice(...args);
        case 'includes': return array.includes(...args);
        case 'indexOf': return array.indexOf(...args);
        case 'toUpperCase': return array.toUpperCase();
        case 'toLowerCase': return array.toLowerCase();
        default: throw new LessonError('Appel natif non pris en charge.', node.line);
      }
    }
  }

  function exportValue(value,seen=new Set(),depth=0){
    if(++exportNodes>20000||depth>24)return '[résultat limité]';
    if(isFunction(value)||value?.[NATIVE])return '[fonction]';
    if(value?.[CONSOLE])return '[console]';
    if(!value||typeof value!=='object')return value;
    if(seen.has(value))return '[référence circulaire]';
    seen.add(value);const out=Array.isArray(value)?value.map(v=>exportValue(v,seen,depth+1)):Object.fromEntries(Object.entries(value).map(([k,v])=>[k,exportValue(v,seen,depth+1)]));seen.delete(value);return out;
  }
  function run(code, options) {
    const settings = options || {};
    snapshotNodes=0;exportNodes=0;
    let executor, result, error = null, errorCode=null, errorLine=null;
    const source = String(code == null ? '' : code);
    try {
      if (source.length > 10000) throw new LessonError('Cet atelier accepte au plus 10 000 caractères de code.', 1);
      if(JSON.stringify(settings.args||[]).length>16000)throw new LessonError('Arguments limités à 16 Ko.',1,'LIMIT');
      const tree = new Parser(source).program();
      executor = new Executor(source, settings);
      executor.execute(tree, executor.global);
      if (settings.invoke) {
        const fn = executor.global.get(String(settings.invoke), 1);
        result = executor.call(fn, Array.isArray(settings.args) ? structuredClone(settings.args) : [], { line: isFunction(fn) ? fn.node.line : 1, start: 0, end: 0 }, executor.global);
      }
      executor.emit({ line: executor.lastNode.line || 1 }, executor.global, 'done', 'Exécution terminée.', { value: snapshot(result) });
    } catch (problem) {
      errorCode=problem.code||(problem instanceof RangeError?'LIMIT':executor?'RUNTIME':'SYNTAX');
      const line = problem.line || (executor && executor.lastNode.line) || 1;
      errorLine=line; error = 'Ligne ' + line + ' — ' + (problem.message || 'L’exécution a rencontré une instruction invalide.');
      if (executor) {try{executor.emit({ line }, executor.current, 'error', error);}catch{ /* keep original bounded diagnostic */ }}
    }
    return {
      trace: executor ? executor.trace : [],
      logs: executor ? executor.logs : [],
      globals: executor ? executor.variables(executor.global) : {},
      result: exportValue(result),
      error, errorCode, errorLine,
      steps: executor ? executor.steps : 0,
      traceTruncated: !!(executor && executor.traceTruncated),
      logsTruncated: !!(executor && executor.logsTruncated)
    };
  }

  runtimeRun=run;
}
export const run=(code,options)=>runtimeRun(code,options);
export const version='1.0.0';

