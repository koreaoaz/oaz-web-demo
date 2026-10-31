import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browserPath, runBrowserSlider } from './helpers/browser-slider.mjs';

test('STEP 131 격리 Chrome: CSS 자동 이동·무한 순환 보정·다음 전환 재시작', { skip: browserPath ? false : '설치된 테스트용 Chromium 실행 파일 없음', timeout: 90000 }, async (context) => {
  const result = await runBrowserSlider();
  context.diagnostic(`격리 Chrome 시작: ${result.startupMilliseconds}ms`);
  assert.deepEqual(result.errors, []); assert.ok(result.forward >= 3, '실제 transitionend 이벤트');
  assert.equal(result.midpoint, true, '300px 카드 사이의 중간 프레임');
  assert.equal(result.jump, true, '가짜 마지막 슬라이드에서 transition 없이 첫 슬라이드로 보정');
  assert.equal(result.restarted, true, '보정 이후 다음 슬라이드도 정방향으로 전환');
});
