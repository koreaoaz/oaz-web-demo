import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('PostgreSQL 탐색·미설치·오설정·서버 종료와 정리 경계를 실행한다', () => {
  const run = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['tests/postgres-harness.test.py'], { encoding: 'utf8', timeout: 30000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  assert.equal(run.status, 0, run.stdout + run.stderr);
});

test('두 DB 테스트는 개인 PC 경로나 외부 연결 문자열을 사용하지 않는다', () => {
  for (const file of ['tests/demo-role-db.test.py', 'tests/visitor-db.test.py', 'tests/helpers/local_postgres.py']) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /C:\\Users|OAZ_150_LOCAL_TEST|postgres(?:ql)?:\/\//i);
  }
  const helper = readFileSync('tests/helpers/local_postgres.py', 'utf8');
  assert.match(helper, /127\.0\.0\.1/);
  assert.match(helper, /OAZ_TEST_PG_BIN/);
});
