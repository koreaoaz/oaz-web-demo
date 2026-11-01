import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyNetlifySite } from '../.github/scripts/verify-netlify-site.mjs';

const id = '00000000-0000-0000-0000-000000000000';
const env = { NETLIFY_AUTH_TOKEN: '가짜-토큰', NETLIFY_SITE_ID: id, NEXT_PUBLIC_SUPABASE_URL: 'https://ctbwaqtqubmjmltbxfzm.supabase.co', NEXT_PUBLIC_SUPABASE_KEY: '가짜-공개키' };
const site = { id, name: 'oneandzero-demo', ssl_url: 'https://oneandzero-demo.netlify.app' };
const response = data => async () => ({ ok: true, json: async () => data });

test('기존 Demo 사이트만 승인한다', async () => {
  await verifyNetlifySite(env, response(site));
  for (const changed of [{ ...site, id: '다름' }, { ...site, name: '다름' }, { ...site, ssl_url: 'https://example.com' }]) {
    await assert.rejects(verifyNetlifySite(env, response(changed)));
  }
});

test('운영 URL과 누락된 인증 설정은 네트워크 요청 전에 차단한다', async () => {
  let called = false;
  const request = async () => { called = true; throw new Error('호출 금지'); };
  for (const changed of [{ ...env, NEXT_PUBLIC_SUPABASE_URL: 'https://maoefmwpdcnugyenyiea.supabase.co' }, { ...env, NETLIFY_AUTH_TOKEN: '' }, { ...env, NETLIFY_SITE_ID: '' }]) {
    await assert.rejects(verifyNetlifySite(changed, request));
  }
  assert.equal(called, false);
});

test('사이트 조회 오류는 배포 전에 차단한다', async () => {
  await assert.rejects(verifyNetlifySite(env, async () => ({ ok: false })));
});
