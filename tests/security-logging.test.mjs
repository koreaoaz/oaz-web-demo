import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('관리자 오류와 시간표 진단에 원본 행이나 예외를 출력하지 않는다', () => {
  for (const path of [
    'src/app/editor/components/PostList.tsx',
    'src/app/editor/boards/7_allowed_user/Allowed_user.tsx',
    'src/app/editor/boards/6_event/EventForm.tsx',
    'src/app/editor/boards/event/EventForm.tsx',
    'src/components/home/features/Timetable.tsx',
  ]) {
    const active = readFileSync(path, 'utf8').split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
    assert.doesNotMatch(active, /console\.(?:log|warn|error)\(\s*(?:err|error|item|studyKey)\s*\)|console\.(?:log|warn|error)\([^\n]*,\s*(?:err|error|item|studyKey)\b/);
  }
});
