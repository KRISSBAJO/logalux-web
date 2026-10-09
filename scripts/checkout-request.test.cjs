const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const ts = require("typescript");

function storage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key: (i) => [...values.keys()][i] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  };
}
function load(relative, globals = {}, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", relative), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
    return dependencies[name];
  }, crypto: webcrypto, TextEncoder, FormData, URLSearchParams, ...globals });
  return exports;
}
function ticket(method = "cash") {
  const fd = new FormData();
  for (const [k,v] of Object.entries({ items: '[{"kind":"custom","name":"Private service","qty":1,"unit_cents":1000}]', client_id: "private-customer", client_name: "Private name", tip_cents: "100", method, back: "/business/checkout?sale=new" })) fd.set(k,v);
  return fd;
}

test("client: generate before submit, concurrent reuse, lost response and reload persist only opaque data", async () => {
  const saved = storage();
  const api = load("src/lib/checkout-request.ts", { localStorage: saved });
  const requests = await Promise.all(Array.from({ length: 8 }, () => api.checkoutRequest(ticket(),"business","merchant","customer")));
  assert.equal(new Set(requests.map((r) => r.id)).size,1);
  assert.equal(saved.length,1);
  const reloaded = load("src/lib/checkout-request.ts", { localStorage: saved });
  const retry = await reloaded.checkoutRequest(ticket(),"business","merchant","customer");
  assert.equal(retry.id,requests[0].id);
  assert.equal((await reloaded.pendingCheckouts("business","merchant","customer"))[0].id,retry.id);
  assert.match(retry.key,/^lx_checkout\.[a-f0-9]{64}\.[a-f0-9]{64}$/);
  assert.match(saved.getItem(retry.key),/^[a-f0-9-]{36}$/);
  assert.ok(!JSON.stringify([...saved.values]).includes("Private"));
  reloaded.completeCheckout(retry);
  assert.equal(saved.length,0);
  assert.notEqual((await reloaded.checkoutRequest(ticket(),"business","merchant","customer")).id,retry.id);
});

test("client: isolate business, merchant, customer and changed payload; transport metadata does not rotate ID", async () => {
  const api = load("src/lib/checkout-request.ts", { localStorage: storage() });
  const first = await api.checkoutRequest(ticket(),"business","merchant","customer");
  for (const scope of [["other","merchant","customer"],["business","other","customer"],["business","merchant","other"]]) {
    assert.notEqual((await api.checkoutRequest(ticket(),...scope)).id,first.id);
  }
  const changed = ticket(); changed.set("tip_cents","200");
  assert.notEqual((await api.checkoutRequest(changed,"business","merchant","customer")).id,first.id);
  const metadata = ticket(); metadata.set("back","/business/checkout?err=retry"); metadata.set("request_id","old"); metadata.set("business_scope","business"); metadata.set("merchant_scope","merchant");
  assert.equal((await api.checkoutRequest(metadata,"business","merchant","customer")).id,first.id);
});

test("client: blocked storage fails closed and can be retried after permission is restored", async () => {
  const saved = storage(), set = saved.setItem;
  saved.setItem = () => { throw new Error("Denied"); };
  const api = load("src/lib/checkout-request.ts", { localStorage: saved });
  await assert.rejects(api.checkoutRequest(ticket(),"business","merchant","customer"),/could not save/);
  assert.equal(saved.length,0);
  saved.setItem = set;
  assert.ok((await api.checkoutRequest(ticket(),"business","merchant","customer")).id);
});

test("client: separate tabs use the same storage reservation lock", async () => {
  const saved = storage(), queues = new Map();
  const navigator = { locks: { request(key, fn) {
    const next = (queues.get(key) ?? Promise.resolve()).then(fn); queues.set(key,next.catch(() => {})); return next;
  } } };
  const tab1 = load("src/lib/checkout-request.ts", { localStorage: saved, navigator });
  const tab2 = load("src/lib/checkout-request.ts", { localStorage: saved, navigator });
  const [a,b] = await Promise.all([tab1.checkoutRequest(ticket(),"business","merchant","customer"),tab2.checkoutRequest(ticket(),"business","merchant","customer")]);
  assert.equal(a.id,b.id);
});

function actions(post) {
  class MerchantApiError extends Error { constructor(status,message) { super(message); this.status=status; } }
  const merchant = { business_id: "business", id: "merchant" };
  return load("src/app/business/(app)/checkout/actions.ts", {}, {
    qrcode: { toDataURL: async () => "data:mock" },
    "@/lib/merchant-actions": { str: (fd,k) => String(fd.get(k) ?? "").trim(), int: (fd,k) => Number(fd.get(k) ?? 0), mPost: post },
    "@/lib/merchant-api": { getMe: async () => ({ merchant }), MerchantApiError, qs: (value) => "?" + new URLSearchParams(Object.entries(value).filter(([,v]) => v !== undefined)) },
  });
}
function submitting() {
  const fd = ticket(); fd.set("request_id","checkout_request_123456789"); fd.set("business_scope","business"); fd.set("merchant_scope","merchant"); return fd;
}
test("web action: forwards persisted ID, returns receipt only on acknowledgment, supports opaque recovery", async () => {
  const calls = [];
  const api = actions(async (route,body) => { calls.push({route,body}); return {sale_id:"sale-1",total_cents:1100}; });
  const fd = submitting();
  const out = await api.pay(fd);
  assert.equal(out.ok,true); assert.match(out.url,/receipt=sale-1/);
  assert.equal(calls[0].route,"/checkout"); assert.equal(calls[0].body.request_id,fd.get("request_id"));
  fd.set("replay_only","1"); assert.equal((await api.pay(fd)).ok,true);
  assert.equal(JSON.stringify(calls[1].body),JSON.stringify({ request_id:fd.get("request_id"), replay_only:true }));
});
test("web action: missing ID and stale business session cannot submit; lost responses remain retryable", async () => {
  let calls = 0;
  const api = actions(async () => { calls++; throw new Error("Lost response"); });
  assert.equal((await api.pay(ticket())).status,400);
  const fd = submitting(); fd.set("business_scope","other"); assert.equal((await api.pay(fd)).status,409); assert.equal(calls,0);
  fd.set("business_scope","business"); const result = await api.pay(fd); assert.equal(result.ok,false); assert.equal(result.status,503); assert.equal(calls,1);
});
test("web action: quote and makeLink omit request IDs and recovery/session metadata", async () => {
  const calls = [];
  const api = actions(async (route,body) => { calls.push({route,body}); return route.endsWith("quote") ? { quote: {} } : { url:"https://provider.invalid/fixture", reference:"mock", totals:{} }; });
  const fd = submitting(); fd.set("replay_only","1");
  assert.equal((await api.quote(fd)).ok,true);
  assert.equal((await api.makeLink(fd)).ok,true);
  assert.equal(calls[0].route,"/checkout/quote"); assert.equal(calls[1].route,"/checkout/link");
  for (const {body} of calls) { assert.ok(!("request_id" in body)); assert.ok(!("replay_only" in body)); assert.ok(!("business_scope" in body)); }
});

function tillHarness(pay) {
  const states=[], effects=[], refs=[];
  let cursor=0, refCursor=0, effectCursor=0;
  const react={ useState(initial) {
    const i=cursor++; if (!(i in states)) states[i]=typeof initial==="function"?initial():initial;
    return [states[i],(value)=>{ states[i]=typeof value==="function"?value(states[i]):value; }];
  }, useRef(initial) {
    const i=refCursor++; if (!(i in refs)) refs[i]={current:initial}; return refs[i];
  }, useEffect(fn,deps) {
    const i=effectCursor++; if (!(i in effects)) effects[i]={fn,deps};
  } };
  const requestAPI=load("src/lib/checkout-request.ts",{localStorage:storage()});
  const math=load("src/app/business/(app)/checkout/math.ts");
  const pushes=[];
  const jsx=(type,props)=>({type,props});
  const api=load("src/app/business/(app)/checkout/till.tsx",{setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{}},{
    react,
    "react/jsx-runtime":{jsx,jsxs:jsx,Fragment:"fragment"},
    "next/link":{default:"a"},
    "next/navigation":{useRouter:()=>({push:(url)=>pushes.push(url)})},
    "react-dom":{useFormStatus:()=>({pending:false})},
    "@/components/merchant-ui":{Avatar:"avatar",Empty:"empty",Topbar:"topbar"},
    "@/lib/merchant-format":{money:(x)=>String(x),firstName:(x)=>x,dateOnly:()=>"",dur:()=>""},
    "@/lib/checkout-request":requestAPI,
    "./math":math,
    "./actions":{checkoutScope:async()=>({business:"business",merchant:"merchant"}),pay,quote:async()=>({ok:true,quote:{}}),makeLink:async()=>{throw new Error("Unexpected provider call");}},
  });
  const props={ currency:"USD",taxBp:0,simulated:true,live:false,market:"US",loyalty:null,locations:[],services:[],products:[],packages:[],memberships:[],staff:[],visit:null,client:null,myStaffId:"",back:"/business/checkout?sale=new",canManage:true,canPay:true,topRight:null,above:null,below:null };
  function findForm(node) {
    if (!node||typeof node!=="object") return;
    if (node.type==="form") return node;
    const children=Array.isArray(node)?node:[node.props?.children].flat();
    for (const child of children) {const result=findForm(child);if(result)return result;}
  }
  function render() {cursor=0;refCursor=0;effectCursor=0;return findForm(api.Till(props));}
  return { render, pushes, effects };
}
test("till: confirmed submit stays locked during delayed navigation and cannot rotate request ID", async () => {
  const calls=[];
  const till=tillHarness(async(fd)=>{calls.push(fd.get("request_id"));return {ok:true,url:"/business/checkout?receipt=sale"};});
  till.render(); till.effects[0].fn();
  await new Promise((resolve)=>setImmediate(resolve));
  let form=till.render();
  await form.props.action(ticket());
  // Router push does not unmount this harness: a second submit must remain blocked.
  form=till.render(); await form.props.action(ticket());
  assert.equal(calls.length,1); assert.equal(till.pushes.length,1);
});
test("till: interrupted submit unlocks and retries with the persisted original request ID", async () => {
  const calls=[];
  const till=tillHarness(async(fd)=>{calls.push(fd.get("request_id"));return calls.length===1?{ok:false,error:"Lost response",status:503}:{ok:true,url:"/business/checkout?receipt=sale"};});
  till.render(); till.effects[0].fn();
  await new Promise((resolve)=>setImmediate(resolve));
  await till.render().props.action(ticket());
  await till.render().props.action(ticket());
  assert.equal(calls.length,2); assert.equal(calls[0],calls[1]); assert.equal(till.pushes.length,1);
});

test("checkout page: forward server pagination, render shared controls, show recovered receipt outside selected page", async () => {
  const requests=[], jsx=(type,props)=>({type,props});
  const receipt={id:"old-sale",client_name:"Recovered client",total_cents:1000,tip_cents:0,refunded_cents:0,method:"cash",created_at:"2026-10-06T12:00:00Z"};
  const api=load("src/app/business/(app)/checkout/page.tsx",{}, {
    "react/jsx-runtime":{jsx,jsxs:jsx,Fragment:"fragment"},
    "next/link":{default:"a"},
    "@/components/merchant-history-pagination":{MerchantHistoryPagination:"history"},
    "@/components/data-table":{DataTable:"tablewrapper"},
    "@/components/merchant-client":{Sheet:"sheet",SubmitButton:"submit"},
    "@/components/merchant-ui":Object.fromEntries(["Avatar","Empty","Flash","Fld","LoadError","Pill"].map((name)=>[name,name])),
    "@/lib/merchant-api":{
      getMe:async()=>({merchant:{timezone:"UTC",currency:"USD",market:"US",staff_id:"staff"}}),mCan:()=>true,
      qs:(value)=>"?"+new URLSearchParams(Object.entries(value).filter(([,v])=>v!==undefined)),
      mLoad:async(route)=>{requests.push(route);return {error:"",data:route.startsWith("/checkout/day")?{totals:{}}:{sales:[],queue:[],receipt,sales_pagination:{page:2,per_page:25,total:70,pages:3}}};},
    },
    "@/lib/merchant-format":{clock:()=>"12:00",dateOnly:()=>"Date",dur:()=>"",METHOD_LABEL:{cash:"Cash"},money:(n)=>String(n),plural:(n)=>`${n} sales`,ymd:()=>"2026-10-08"},
    "./actions":{refundSale:()=>{}},"./till":{Till:"till"},"../../css/checkout.css":{},
  });
  const result=await api.default({searchParams:Promise.resolve({sale:"new",receipt:"old-sale",sales_page:"2",sales_per_page:"25",sales_sort:"total_cents",sales_direction:"desc",sales_q:"needle"})});
  const query=new URL(requests.find((route)=>route.startsWith("/checkout?")),"http://fixture.invalid").searchParams;
  assert.equal(query.get("sales_page"),"2");assert.equal(query.get("sales_q"),"needle");assert.equal(query.get("sales_sort"),"total_cents");assert.equal(query.get("receipt"),"old-sale");
  const till=result.props.children;
  assert.equal(till.type,"till");
  assert.ok(JSON.stringify(till.props.above).includes("Recovered client"));
  const controls=till.props.below.props.children.find((node)=>node?.type==="history");
  assert.equal(controls.props.name,"sales");assert.equal(controls.props.pagination.total,70);assert.equal(controls.props.pagination.page,2);
});
