import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';
const compile=(path)=>ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function config(){const x={};vm.runInNewContext(compile('src/lib/demoConfig.ts'),{exports:x,atob});return x}
const jwt=(p)=>`x.${Buffer.from(JSON.stringify(p)).toString('base64url')}.x`;
function fixture(enabled=true,result={data:1,error:null}){
 const calls=[];const c=config();const vars={NEXT_PUBLIC_SUPABASE_URL:c.DEMO_URL,NEXT_PUBLIC_SUPABASE_KEY:'sb_publishable_mock',NODE_ENV:'test'};
 if(enabled){vars.DEMO_VISITOR_HMAC_KEY='x'.repeat(40);vars.DEMO_VISITOR_SERVICE_KEY=jwt({role:'service_role',ref:'ctbwaqtqubmjmltbxfzm'})}
 const NextResponse={json:(body,opt={})=>({body,status:opt.status??200,cookies:{set:(...args)=>{calls.push(['cookie',...args])}}})};
 const require=(n)=>n==='node:crypto'?crypto:n==='next/server'?{NextResponse}:n==='@/lib/demoConfig'?c:n==='@supabase/supabase-js'?{createClient:()=>({rpc:async(name,args)=>{calls.push(['rpc',name,args]);return result}})}:(()=>{throw Error(n)})();
 const x={};vm.runInNewContext(compile('src/app/api/visitor/route.ts'),{exports:x,require,process:{env:vars},Date});
 return {x,calls};
}
const req=(origin='https://demo.example.test',value)=>({nextUrl:{origin:'https://demo.example.test'},headers:new Headers(origin?{origin}:{}),cookies:{get:()=>value?{value}:undefined}});
test('방문자 집계: 설정 누락은 503이며 DB 호출이 없다',async()=>{const f=fixture(false);assert.equal((await f.x.GET()).status,503);assert.equal((await f.x.POST(req())).status,503);assert.equal(f.calls.length,0)});
test('방문자 집계: 교차 출처와 인증되지 않은 POST는 차단한다',async()=>{const f=fixture();assert.equal((await f.x.POST(req('https://other.example.test'))).status,403);assert.equal((await f.x.POST(req(''))).status,403);assert.equal(f.calls.length,0)});
test('방문자 집계: 키가 있어도 DB 호출과 쿠키 발급이 차단된다',async()=>{const f=fixture();assert.equal((await f.x.POST(req(undefined,'a'.repeat(64)))).status,503);assert.equal((await f.x.POST(req(undefined,'a'.repeat(64)))).status,503);assert.equal(f.calls.length,0)});
test('방문자 집계: DB 오류나 잘못된 응답은 503이며 쿠키를 발급하지 않는다',async()=>{for(const result of [{data:null,error:{}},{data:'1',error:null},{data:1.5,error:null}]){const f=fixture(true,result);assert.equal((await f.x.GET()).status,503);assert.equal((await f.x.POST(req())).status,503);assert.equal(f.calls.some(x=>x[0]==='cookie'),false)}});
test('방문자 집계: 키와 DB 모의값이 있어도 503으로 차단한다',async()=>{const f=fixture(true,{data:-1,error:null});assert.equal((await f.x.GET()).status,503);assert.equal((await f.x.POST(req())).status,503);assert.equal(f.calls.length,0)});
test('방문자 집계: 교차 사이트 fetch는 같은 Origin을 주장해도 차단한다',async()=>{const f=fixture();const r=req();r.headers=new Headers({origin:'https://demo.example.test','sec-fetch-site':'cross-site'});assert.equal((await f.x.POST(r)).status,403);assert.equal(f.calls.length,0)});
test('방문자 집계: 잘못된 쿠키에도 식별자를 발급하지 않는다',async()=>{const f=fixture();assert.equal((await f.x.POST(req(undefined,'bad-cookie'))).status,503);assert.equal(f.calls.length,0)});
