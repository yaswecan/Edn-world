import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installLauncherBridge } from '../CONTRATS/launcher-bridge.mjs';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; };
function harness(overrides = {}) {
  const events = new EventTarget();
  const navigations = [], notices = [], logins = [], verifications = [];
  let calls = 0;
  const options = {
    eventTarget: events,
    origin: 'https://app.example.test',
    resolveLaunch: async () => { calls++; return {kind:'ready', destination:'/test-only/code-station'}; },
    isAllowedRoute: (id, target) => target.pathname === '/test-only/' + id && !target.search && !target.hash,
    navigate: (url) => { navigations.push(url); },
    notify: (message) => { notices.push(message); },
    onAuthRequired: (id) => { logins.push(id); },
    onVerificationRequired: (id) => { verifications.push(id); },
    ...overrides
  };
  const uninstall = installLauncherBridge(options);
  const emit = (id = 'code-station', cancelable = true) => {
    const event = new Event('worldarcade:launch', {cancelable});
    Object.defineProperty(event, 'detail', {value: {gameId:id}});
    const accepted = events.dispatchEvent(event);
    return {event, accepted};
  };
  return {events, emit, uninstall, navigations, notices, logins, verifications, get calls(){return calls;}};
}

test('missing dependencies are rejected', () => {
  assert.throws(() => installLauncherBridge({}), TypeError);
});
test('event is canceled synchronously before async approval', async () => {
  const d = deferred(); const h = harness({resolveLaunch: () => d.promise});
  const {event, accepted} = h.emit();
  assert.equal(event.defaultPrevented, true); assert.equal(accepted, false);
  assert.deepEqual(h.navigations, []);
  d.resolve({kind:'ready',destination:'/test-only/code-station'}); await tick();
  assert.equal(h.navigations.length,1);h.uninstall();
});
test('authorized route is opened once', async () => {
  const h=harness();h.emit();await tick();
  assert.deepEqual(h.navigations,['/test-only/code-station']);assert.equal(h.calls,1);h.uninstall();
});
test('unknown game is canceled and never sent to resolver', async () => {
  const h=harness();assert.equal(h.emit('unknown').accepted,false);await tick();
  assert.equal(h.calls,0);assert.equal(h.navigations.length,0);assert.equal(h.notices.length,1);h.uninstall();
});
test('in-flight double click cannot trigger duplicate launch', async () => {
  const d=deferred();let count=0;const h=harness({resolveLaunch:()=>{count++;return d.promise;}});
  h.emit();h.emit();assert.equal(count,1);
  d.resolve({kind:'ready',destination:'/test-only/code-station'});await tick();
  assert.equal(h.navigations.length,1);h.uninstall();
});
test('auth requirement opens the real auth callback without navigation', async () => {
  const h=harness({resolveLaunch:async()=>({kind:'auth_required'})});h.emit();await tick();
  assert.deepEqual(h.logins,['code-station']);assert.deepEqual(h.navigations,[]);h.uninstall();
});
test('verification requirement is routed separately', async () => {
  const h=harness({resolveLaunch:async()=>({kind:'verification_required'})});h.emit();await tick();
  assert.deepEqual(h.verifications,['code-station']);assert.deepEqual(h.navigations,[]);h.uninstall();
});
test('unavailable engine never falls back to demo', async () => {
  const h=harness({resolveLaunch:async()=>({kind:'unavailable'})});assert.equal(h.emit().accepted,false);await tick();
  assert.equal(h.navigations.length,0);assert.equal(h.notices.length,1);h.uninstall();
});
test('locked engine hides arbitrary backend hint', async () => {
  const h=harness({resolveLaunch:async()=>({kind:'locked',hint:'INTERNAL STACK TRACE'})});h.emit();await tick();
  assert.equal(h.navigations.length,0);assert.equal(h.notices.join('').includes('STACK'),false);h.uninstall();
});
test('resolver failure cancels launch without leaking error', async () => {
  const h=harness({resolveLaunch:async()=>{throw new Error('secret-value');}});assert.equal(h.emit().accepted,false);await tick();
  assert.equal(h.navigations.length,0);assert.equal(h.notices.join('').includes('secret-value'),false);h.uninstall();
});
for (const [name, url] of [
  ['external URL','https://other.example.test/play'],
  ['javascript URL','javascript:alert(1)'],
  ['protocol-relative external URL','//other.example.test/play'],
  ['credentialed URL','https://user:pass@app.example.test/test-only/code-station'],
  ['same-origin unlisted route','/teacher/private'],
  ['disallowed query','/test-only/code-station?returnTo=https://other.example.test']
]) {
  test(`${name} is rejected`,async()=>{
    const h=harness({resolveLaunch:async()=>({kind:'ready',destination:url})});h.emit();await tick();
    assert.equal(h.navigations.length,0);assert.equal(h.notices.length,1);h.uninstall();
  });
}
test('unmount aborts pending operation and ignores late response', async () => {
  const d=deferred();let capturedSignal;const h=harness({resolveLaunch:(_,signal)=>{capturedSignal=signal;return d.promise;}});
  h.emit();h.uninstall();assert.equal(capturedSignal.aborted,true);
  d.resolve({kind:'ready',destination:'/test-only/code-station'});await tick();
  assert.equal(h.navigations.length,0);assert.equal(h.notices.length,0);
});
test('uninstall is idempotent and removes listener', () => {
  const h=harness();h.uninstall();h.uninstall();assert.equal(h.emit().accepted,true);assert.equal(h.calls,0);
});
test('failed request can be retried', async () => {
  let attempts=0;const h=harness({resolveLaunch:async()=>{
    attempts++;if(attempts===1)throw new Error('offline');
    return {kind:'ready',destination:'/test-only/code-station'};
  }});
  h.emit();await tick();h.emit();await tick();assert.equal(attempts,2);assert.equal(h.navigations.length,1);h.uninstall();
});
test('malformed resolver result cannot navigate', async () => {
  const h=harness({resolveLaunch:async()=>({finished:true,score:999})});h.emit();await tick();
  assert.equal(h.navigations.length,0);assert.equal(h.notices.length,1);h.uninstall();
});
test('non-cancelable event is refused without resolving',async()=>{
  const h=harness();h.emit('code-station',false);await tick();assert.equal(h.calls,0);assert.equal(h.navigations.length,0);h.uninstall();
});
test('origin with a path is rejected',()=>{
  assert.throws(()=>harness({origin:'https://app.example.test/not-an-origin'}),TypeError);
});

test('async allowlist is not treated as permission', async () => {
  const h=harness({isAllowedRoute:async()=>false});h.emit();await tick();
  assert.equal(h.navigations.length,0);assert.equal(h.notices.length,1);h.uninstall();
});
