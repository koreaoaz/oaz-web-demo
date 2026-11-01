import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('CI에는 배포 토큰과 배포 작업이 없다', () => {
  const ci = readFileSync('.github/workflows/demo-ci-draft.yml', 'utf8');
  assert.match(ci, /contents:\s*read/);
  assert.doesNotMatch(ci, /NETLIFY_AUTH_TOKEN|pull_request_target|netlify deploy/);
});

test('배포 스크립트는 기존 Demo 사이트와 명시적 SHA 승인을 요구한다', () => {
  const verify = readFileSync('scripts/release-lib.ps1', 'utf8');
  const deploy = verify;
  assert.match(verify, /koreaoaz\/oaz-web-demo\.git/);
  assert.match(verify, /oneandzero-demo\.netlify\.app/);
  assert.match(verify, /'ls-remote','--exit-code','origin','refs\/heads\/main'/);
  assert.match(deploy, /Read-Host[\s\S]+?-cne \$verified.Sha/);
  assert.match(deploy, /'--site',\$verified.SiteId/);
  assert.match(verify, /2f66ba08-2dd6-4b5d-9156-8c1ad5fd54ad/);
  assert.match(deploy, /'deploy','--no-build','--site',\$verified.SiteId/);
  assert.doesNotMatch(deploy, /'deploy','--no-build','--context'/);
  assert.doesNotMatch(deploy, /--create-site|--allow-anonymous|--site-name/);
});
