import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRuns, checkJobs, verifyCi } from '../scripts/check-release-ci.mjs';

const sha = 'a'.repeat(40);
const jobNames = ['회귀 테스트 및 빌드', '격리 PostgreSQL 보안 및 방문자 SQL'];
const run = () => ({ id: 123, run_attempt: 1, head_sha: sha, head_branch: 'main', event: 'push', path: '.github/workflows/demo-ci-draft.yml', repository: { full_name: 'koreaoaz/oaz-web-demo' }, head_repository: { full_name: 'koreaoaz/oaz-web-demo' }, status: 'completed', conclusion: 'success' });
const runs = (items = [run()]) => ({ total_count: items.length, workflow_runs: items });
const jobs = () => ({ total_count: 2, jobs: jobNames.map(name => ({ name, status: 'completed', conclusion: 'success' })) });

test('정확한 main SHA의 필수 CI 작업 성공만 허용', async () => {
  const paths = [];
  await verifyCi(sha, async path => { paths.push(path); return paths.length === 1 ? runs() : jobs(); });
  assert.match(paths[0], new RegExp(`event=push&branch=main&head_sha=${sha}`));
  assert.match(paths[1], /runs\/123\/attempts\/1\/jobs/);
});
test('실패, 진행 중 또는 누락된 병합 커밋 CI 차단', () => {
  for (const item of [{...run(), conclusion:'failure'}, {...run(), status:'in_progress', conclusion:null}]) assert.throws(() => checkRuns(runs([item]), sha));
  assert.throws(() => checkRuns(runs([]), sha));
  assert.throws(() => checkRuns(runs([run(), {...run(), id:124, conclusion:'failure'}]), sha));
});
test('SHA, 저장소, 브랜치, PR 이벤트 또는 워크플로 불일치 차단', () => {
  for (const item of [{...run(),head_sha:'b'.repeat(40)}, {...run(),repository:{full_name:'wrong/repo'}}, {...run(),head_repository:{full_name:'wrong/repo'}}, {...run(),head_branch:'other'}, {...run(),event:'pull_request'}, {...run(),path:'other'}]) assert.throws(() => checkRuns(runs([item]), sha));
  assert.throws(() => checkRuns(runs(), 'a'.repeat(7)));
});
test('조회 실패와 누락·실패한 필수 작업 차단', async () => {
  await assert.rejects(() => verifyCi(sha, async () => { throw new Error('unauthorized'); }));
  await assert.rejects(() => verifyCi(sha, async path => path.includes('/workflows/') ? runs() : {total_count:1,jobs:[jobs().jobs[0]]}));
  const failed = jobs(); failed.jobs[1].conclusion = 'failure';
  assert.throws(() => checkJobs(failed));
});
