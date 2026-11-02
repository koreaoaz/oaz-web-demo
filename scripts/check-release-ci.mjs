import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const repo = 'koreaoaz/oaz-web-demo';
const workflow = '.github/workflows/demo-ci-draft.yml';
const requiredJobs = ['회귀 테스트 및 빌드', '격리 PostgreSQL 보안 및 방문자 SQL'];

// PR의 가상 병합 결과는 실제 main push 결과를 대신할 수 없다.
export function checkRuns(payload, sha) {
  if (!/^[a-f0-9]{40}$/.test(sha) || !Array.isArray(payload?.workflow_runs) ||
      !Number.isInteger(payload.total_count) || payload.total_count < 1 ||
      payload.total_count > 100 || payload.workflow_runs.length !== payload.total_count) throw new Error('CI 실행 목록을 확인할 수 없습니다.');
  const runs = payload.workflow_runs;
  if (runs.some(r => r.head_sha !== sha || r.head_branch !== 'main' || r.event !== 'push' ||
      r.path !== workflow || r.repository?.full_name !== repo || r.head_repository?.full_name !== repo ||
      !Number.isSafeInteger(r.id) || !Number.isSafeInteger(r.run_attempt) || r.run_attempt < 1)) throw new Error('CI 실행의 저장소 또는 커밋이 일치하지 않습니다.');
  // 가장 최근에 생성된 실행을 사용한다. 재실행은 동일 id의 최신 attempt로 반환된다.
  const latest = [...runs].sort((a, b) => b.id - a.id)[0];
  if (latest.status !== 'completed' || latest.conclusion !== 'success') throw new Error('최신 main CI가 완료 및 성공 상태가 아닙니다.');
  return latest;
}

export function checkJobs(payload) {
  if (!Number.isInteger(payload?.total_count) || payload.total_count !== 2 || !Array.isArray(payload.jobs) || payload.jobs.length !== 2) throw new Error('필수 CI 작업을 확인할 수 없습니다.');
  for (const name of requiredJobs) {
    const matches = payload.jobs.filter(j => j.name === name);
    if (matches.length !== 1 || matches[0].status !== 'completed' || matches[0].conclusion !== 'success') throw new Error('필수 CI 작업이 성공하지 않았습니다.');
  }
}

export async function verifyCi(sha, getJson) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('배포 SHA가 올바르지 않습니다.');
  const root = `/repos/${repo}/actions`;
  const run = checkRuns(await getJson(`${root}/workflows/demo-ci-draft.yml/runs?event=push&branch=main&head_sha=${sha}&per_page=100`), sha);
  checkJobs(await getJson(`${root}/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`));
}

async function main() {
  const sha = process.argv[2];
  if (process.argv.length !== 3 || !/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error('전체 배포 SHA가 필요합니다.');
  // 기존 Git Credential Manager만 사용하며 사용자 입력, 토큰 출력 및 파일 저장은 하지 않는다.
  const credential = spawnSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', timeout: 15000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
  });
  if (credential.status !== 0 || credential.error) throw new Error('GitHub 읽기 인증을 확인하세요.');
  const lines = Object.fromEntries(credential.stdout.split(/\r?\n/).filter(s => s.includes('=')).map(s => { const i = s.indexOf('='); return [s.slice(0, i), s.slice(i + 1)]; }));
  if (lines.protocol !== 'https' || lines.host !== 'github.com' || !lines.username || !lines.password) throw new Error('GitHub 읽기 인증을 확인하세요.');
  const authorization = 'Basic ' + Buffer.from(`${lines.username}:${lines.password}`).toString('base64');
  const getJson = async path => {
    const response = await fetch(`https://api.github.com${path}`, { headers: { Authorization: authorization, Accept: 'application/vnd.github+json', 'User-Agent': 'oaz-demo-release-ci' }, redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('GitHub CI 조회 실패');
    return response.json();
  };
  await verifyCi(sha, getJson);
  console.log('지정 main 커밋의 GitHub CI 확인 완료');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('GitHub CI 확인 실패: 인증, 네트워크, 대상 커밋 및 main CI 결과를 확인하세요.'); process.exitCode = 1; });
}
