import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const load=(path)=>{const source=fs.readFileSync(path,'utf8');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const out={};vm.runInNewContext(code,{exports:out,atob});return out};
const {validateDemoPublicConfig,validateDemoServerKey,DEMO_URL}=load('src/lib/demoConfig.ts');
const {assertDemoStoragePath}=load('src/lib/storagePath.ts');
const jwt=(payload)=>`x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.x`;
const demo='ctbwaqtqubmjmltbxfzm';
test('데모 URL과 공개 키만 허용한다',()=>{
 assert.equal(validateDemoPublicConfig(DEMO_URL,'sb_publishable_mock').url,DEMO_URL);
 assert.throws(()=>validateDemoPublicConfig('https://maoefmwpdcnugyenyiea.supabase.co','sb_publishable_mock'));
 assert.throws(()=>validateDemoPublicConfig(undefined,'sb_publishable_mock'));
 assert.throws(()=>validateDemoPublicConfig(DEMO_URL,undefined));
 assert.throws(()=>validateDemoPublicConfig(DEMO_URL,'sb_secret_mock'));
 assert.throws(()=>validateDemoPublicConfig(DEMO_URL,jwt({role:'service_role',ref:demo})));
 assert.throws(()=>validateDemoPublicConfig(DEMO_URL,jwt({role:'anon',ref:'maoefmwpdcnugyenyiea'})));
 assert.equal(validateDemoPublicConfig(DEMO_URL,jwt({role:'anon',ref:demo})).url,DEMO_URL);
});
test('서버 키는 Demo ref의 service_role JWT만 받는다',()=>{
 assert.throws(()=>validateDemoServerKey(undefined));assert.throws(()=>validateDemoServerKey('sb_secret_mock'));
 assert.throws(()=>validateDemoServerKey(jwt({role:'service_role',ref:'maoefmwpdcnugyenyiea'})));
 assert.throws(()=>validateDemoServerKey(jwt({role:'anon',ref:demo})));
 assert.equal(typeof validateDemoServerKey(jwt({role:'service_role',ref:demo})),'string');
});
test('Storage 경로와 버킷은 허용 목록에서만 동작한다',()=>{
 assert.doesNotThrow(()=>assertDemoStoragePath('project_img','valid/file.png'));
 for(const name of ['', '/absolute', '../a', 'a/../b', 'a//b', '%2e%2e%2fsecret', 'a\\\\b'])assert.throws(()=>assertDemoStoragePath('project_img',name));
 assert.throws(()=>assertDemoStoragePath('other','a.png'));
});
test('OAuth 리다이렉트는 현재 사이트 원본을 사용한다',()=>{
 const nav=fs.readFileSync('src/components/home/Navigation.tsx','utf8');const signup=fs.readFileSync('src/app/signin/page.tsx','utf8');
 assert.match(nav,/window\.location\.origin.*login_callback/);assert.match(signup,/window\.location\.origin.*oauth_callback/);assert.match(signup,/provider: 'github'/);
});
test('Demo 서버 방문자 설정이 없으면 데이터 요청이 차단되는 구조다',()=>{
 const route=fs.readFileSync('src/app/api/visitor/route.ts','utf8');assert.match(route,/validateDemoServerKey/);assert.match(route,/status: 503/);assert.doesNotMatch(route,/today_visitor/);
});
