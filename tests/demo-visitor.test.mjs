import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';
const compile=(path)=>ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function config(){const x={};vm.runInNewContext(compile('src/lib/demoConfig.ts'),{exports:x,atob});return x}
const jwt=(p)=>`x.${Buffer.from(JSON.stringify(p)).toString('base64url')}.x`;
function fixture(enabled=true){
 const calls=[];const c=config();const vars={NEXT_PUBLIC_SUPABASE_URL:c.DEMO_URL,NEXT_PUBLIC_SUPABASE_KEY:'sb_publishable_mock',NODE_ENV:'test'};
 if(enabled){vars.DEMO_VISITOR_HMAC_KEY='x'.repeat(40);vars.DEMO_VISITOR_SERVICE_KEY=jwt({role:'service_role',ref:'ctbwaqtqubmjmltbxfzm'})}
 const NextResponse={json:(body,opt={})=>({body,status:opt.status??200,cookies:{set:(...args)=>{calls.push(['cookie',...args])}}})};
 const require=(n)=>n==='node:crypto'?crypto:n==='next/server'?{NextResponse}:n==='@/lib/demoConfig'?c:n==='@supabase/supabase-js'?{createClient:()=>({rpc:async(name,args)=>{calls.push(['rpc',name,args]);return {data:1,error:null}}})}:(()=>{throw Error(n)})();
 const x={};vm.runInNewContext(compile('src/app/api/visitor/route.ts'),{exports:x,require,process:{env:vars},Date});
 return {x,calls};
}
const req=(origin='https://demo.example.test',value)=>({nextUrl:{origin:'https://demo.example.test'},headers:new Headers(origin?{origin}:{}),cookies:{get:()=>value?{value}:undefined}});
test('방문자 집계: 설정 누락은 503이며 DB 호출이 없다',async()=>{const f=fixture(false);assert.equal((await f.x.GET()).status,503);assert.equal((await f.x.POST(req())).status,503);assert.equal(f.calls.length,0)});
test('방문자 집계: 교차 출처와 인증되지 않은 POST는 차단한다',async()=>{const f=fixture();assert.equal((await f.x.POST(req('https://other.example.test'))).status,403);assert.equal((await f.x.POST(req(''))).status,403);assert.equal(f.calls.length,0)});
test('방문자 집계: 같은 쿠키는 같은 해시만 전달하고 보안 쿠키를 사용한다',async()=>{const f=fixture();const id='a'.repeat(64);assert.equal((await f.x.POST(req(undefined,id))).status,200);assert.equal((await f.x.POST(req(undefined,id))).status,200);const r=f.calls.filter(x=>x[0]==='rpc');assert.equal(r.length,2);assert.equal(r[0][2].p_digest,r[1][2].p_digest);assert.notEqual(r[0][2].p_digest,id);assert.equal(f.calls.find(x=>x[0]==='cookie')[3].httpOnly,true)});
