const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');
const source = ts.transpileModule(fs.readFileSync('src/lib/booking-request.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const stored = new Map();
const ids = [];
let fail = true;
function load() {
 const exports = {};
 vm.runInNewContext(source, { exports, TextEncoder, Uint8Array, crypto: webcrypto, AbortSignal,
  localStorage: { getItem: k => stored.get(k) ?? null, setItem: (k,v) => stored.set(k,v), removeItem: k => stored.delete(k) },
  fetch: async (_, req) => { ids.push(JSON.parse(req.body).request_id); if(fail) throw new Error('Disconnected'); return { ok:true, json:async()=>({booking:{id:'existing-booking'}}) }; }
 });
 return exports.sendBookingRequest;
}
(async()=>{
 const body = {business_id:'studio', date:'2026-11-01', phone:'+2348000000000'};
 await assert.rejects(load()(body,'customer-a'), /Disconnected/);
 assert.equal(stored.size,1);
 assert.ok(![...stored.entries()].flat().join('').includes(body.phone));
 fail=false;
 await load()(body,'customer-a');
 assert.equal(ids[0],ids[1], 'a page reload preserves the retry ID');
 assert.equal(stored.size,0);
 fail=true;
 const send=load();
 await Promise.all([assert.rejects(send(body,'customer-a')),assert.rejects(send(body,'customer-a'))]);
 assert.equal(ids[2],ids[3], 'concurrent attempts share an ID');
 await assert.rejects(send(body,'customer-b'));
 assert.notEqual(ids[2],ids[4], 'accounts have separate IDs');
 console.log('PASS: web booking retry survives reload, shares concurrent IDs, separates accounts and stores no contact details');
})().catch(e=>{console.error(e);process.exitCode=1;});
