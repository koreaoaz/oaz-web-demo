import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const engines = process.platform === 'win32' ? ['powershell.exe', process.env.OAZ_TEST_PWSH || 'pwsh.exe'] : [process.env.OAZ_TEST_PWSH || 'pwsh'];
for (const engine of engines) {
  const probe = spawnSync(engine, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], { encoding: 'utf8', timeout: 30000 });
  test(`${engine}: 실제 PowerShell의 UTF-8 BOM·LF/CRLF·승인/취소·명령 실패·버전 경계`, { skip: probe.error?.code === 'ENOENT' ? 'PowerShell 미설치; CI Windows에서는 두 엔진을 필수 검사' : false }, () => {
    assert.equal(probe.status, 0, probe.stderr);
    const temp = mkdtempSync(join(tmpdir(), 'oaz-release-flow-'));
    try {
      mkdirSync(join(temp, 'scripts'));
      for (const eol of ['\n', '\r\n']) {
        for (const file of ['scripts/release-lib.ps1', 'scripts/verify-release.ps1', 'scripts/deploy-release.ps1', 'tests/helpers/release-flow.ps1']) {
          const bytes = readFileSync(file);
          assert.equal(bytes.subarray(0, 3).toString('hex'), 'efbbbf', `${file}: UTF-8 BOM 필수`);
          if (file.endsWith('release-lib.ps1')) writeFileSync(join(temp, 'scripts/release-lib.ps1'), '\uFEFF' + bytes.toString('utf8').replace(/^\uFEFF/, '').replace(/\r?\n/g, eol), 'utf8');
        }
        const run = spawnSync(engine, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve('tests/helpers/release-flow.ps1'), '-Library', join(temp, 'scripts/release-lib.ps1')], { encoding: 'utf8', timeout: 90000 });
        assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
        const report = JSON.parse(run.stdout.trim().split(/\r?\n/).at(-1));
        assert.ok(report.cases >= 70);
        assert.equal(report.production, 'Production 배포를 승인하려면 전체 커밋 SHA를 입력하세요');
        assert.equal(report.cancel, '명시적인 배포 승인이 없어 중단했습니다.');
      }
    } finally { rmSync(temp, { recursive: true, force: true }); }
  });
}
