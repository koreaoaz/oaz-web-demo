import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Netlify 설정은 Next 빌드와 Node 버전을 지정하고 서버 비밀을 포함하지 않는다', () => {
  const config = readFileSync('netlify.toml', 'utf8');
  assert.match(config, /command\s*=\s*"npm run build"/);
  assert.match(config, /publish\s*=\s*"\.next"/);
  assert.match(config, /NODE_VERSION\s*=\s*"22"/);
  assert.doesNotMatch(config, /DEMO_VISITOR_SERVICE_KEY\s*=/);
  assert.doesNotMatch(config, /DEMO_VISITOR_HMAC_KEY\s*=/);
});

test('공개 환경변수 예시는 실제 키가 없고 방문자 키는 서버 전용 이름이다', () => {
  const example = readFileSync('.env.example', 'utf8');
  assert.match(example, /^NEXT_PUBLIC_SUPABASE_KEY=\s*$/m);
  assert.doesNotMatch(example, /^DEMO_VISITOR_SERVICE_KEY=/m);
  assert.doesNotMatch(example, /^DEMO_VISITOR_HMAC_KEY=/m);
  assert.doesNotMatch(example, /^NEXT_PUBLIC_DEMO_VISITOR_/m);
});
