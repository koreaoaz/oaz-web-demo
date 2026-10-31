import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

// 컴파일러는 메모리의 가상 파일만 검사한다. emit/DB/환경변수/실제 네트워크는 사용하지 않는다.
function diagnostics(source) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const fixture = path.join(root, 'tests', '__editor_schema_virtual__.ts');
  const host = ts.createCompilerHost(parsed.options);
  const read = host.readFile;
  const exists = host.fileExists;
  host.readFile = (file) => path.resolve(file) === fixture ? source : read(file);
  host.fileExists = (file) => path.resolve(file) === fixture || exists(file);
  const program = ts.createProgram([fixture], { ...parsed.options, incremental: false, noEmit: true }, host);
  return ts.getPreEmitDiagnostics(program);
}
const imports = `
import type { Dispatch, SetStateAction } from 'react';
import type { EditorRow, EditorInsert, EditorUpdate } from '@/types/editor';
import type { RawProjectRow } from '@/types/project';
import type { RawTimetableRow } from '@/types/timetable';
import { BOARD_TABLE_MAP } from '@/app/editor/constants';
import { useBoardPosts } from '@/app/editor/hooks/useBoardPosts';
import { PostList } from '@/app/editor/components/PostList';
import { fetchPosts, updatePost, deletePost, insertPost } from '@/app/editor/services/board.service';
`;

test('STEP 126: 10개 테이블의 Row/Insert/Update와 Hook Dispatch 적합성', () => {
  const boards = [
    ['공지', 'editor_0_noti'], ['프로젝트', 'editor_1_projects'], ['스터디', 'editor_2_studies'],
    ['학회실 사용 시간표', 'editor_3_study_timetable'], ['일정', 'editor_4_schedules'],
    ['명예의 전당', 'editor_5_donators'], ['행사', 'editor_6_events'],
    ['승인email', 'allowed_user'], ['등록회원', 'registered_member'], ['관리자id', 'supervisor_id'],
  ];
  const source = imports + `
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Check<T extends true> = T;
export type ProjectReuse = Check<Equal<EditorRow<'editor_1_projects'>, RawProjectRow>>;
export type TimetableReuse = Check<Equal<EditorRow<'editor_3_study_timetable'>, RawTimetableRow>>;
// INSERT의 검증 전 경계와 엄격한 DB 입력 타입을 혼동하지 않는다.
export type InsertBoundary = Check<Equal<Parameters<typeof insertPost>[1], unknown>>;
const notice: EditorInsert<'editor_0_noti'> = {};
const project: EditorInsert<'editor_1_projects'> = { tech_stack: { arbitrary: [null, 1, true, 'TS'] } };
const study: EditorInsert<'editor_2_studies'> = {};
const timetable: EditorInsert<'editor_3_study_timetable'> = { start_time: null, created_at: null };
const schedule: EditorInsert<'editor_4_schedules'> = { start_date: null };
const donor: EditorInsert<'editor_5_donators'> = { uuid: null };
const event: EditorInsert<'editor_6_events'> = { filenames: [1, null, { arbitrary: true }] };
const allowed: EditorInsert<'allowed_user'> = {};
const member: EditorInsert<'registered_member'> = { email: 'test@example.invalid' };
const manager: EditorInsert<'supervisor_id'> = { name: '가상', email: 'test@example.invalid' };
const update: EditorUpdate<'registered_member'> = { generation: null, is_manager: false };
declare const hook: ReturnType<typeof useBoardPosts<'공지'>>;
const setter: Dispatch<SetStateAction<EditorRow<'editor_0_noti'>[]>> = hook.setPosts;
const list: Promise<EditorRow<'editor_0_noti'>[]> = fetchPosts(BOARD_TABLE_MAP['공지']);
declare const eventList: Parameters<typeof PostList<'행사'>>[0];
const eventRows: EditorRow<'editor_6_events'>[] = eventList.posts;
const eventSetter: Dispatch<SetStateAction<EditorRow<'editor_6_events'>[]>> = eventList.setPosts;
updatePost('editor_0_noti', 1, { text: null, is_noti: false });
deletePost('editor_0_noti', 1);
` + boards.map(([board, table], i) => `
declare const state${i}: ReturnType<typeof useBoardPosts<${JSON.stringify(board)}>>;
const rows${i}: EditorRow<${JSON.stringify(table)}>[] = state${i}.posts;
const dispatch${i}: Dispatch<SetStateAction<EditorRow<${JSON.stringify(table)}>[]>> = state${i}.setPosts;
`).join('\n');
  const result = diagnostics(source);
  assert.equal(result.length, 0, result.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('\n'));
});

test('STEP 126: 잘못된 컬럼·NULL·JSON 가정·ID/UUID·기존 payload 충돌을 컴파일러가 거부한다', () => {
  const cases = [
    `const bad0: EditorInsert<'registered_member'> = {};`,
    `const bad1: EditorInsert<'supervisor_id'> = { name: '가상' };`,
    `const bad2: EditorInsert<'editor_1_projects'> = { members: ['가상'] };`,
    `const bad3: EditorInsert<'editor_1_projects'> = { semester: '2' };`,
    `const bad4: EditorInsert<'registered_member'> = { email: 'test@example.invalid', gen: '1' };`,
    `const bad5: EditorInsert<'registered_member'> = { email: 'test@example.invalid', phone: '000' };`,
    `const bad6: EditorUpdate<'allowed_user'> = { email: null };`,
    `const bad7: EditorUpdate<'supervisor_id'> = { uuid: 7 };`,
    `const bad8: EditorUpdate<'editor_0_noti'> = { is_noti: null };`,
    `updatePost('editor_0_noti', 'mock-uuid', { text: '가상' });`,
    `updatePost('allowed_user', 1, { is_manager: true });`,
    `updatePost('editor_0_noti', 1, { is_noti: 'true' });`,
    `declare const jsonRow: EditorRow<'editor_6_events'>; const bad12: string[] = jsonRow.filenames;`,
    `declare const userRow: EditorRow<'supervisor_id'>; const bad13: number = userRow.uuid;`,
    `insertPost('not_an_editor_table', {});`,
    `declare const noticeState: ReturnType<typeof useBoardPosts<'공지'>>; const badDispatch: Dispatch<SetStateAction<EditorRow<'editor_1_projects'>[]>> = noticeState.setPosts;`,
  ];
  const result = diagnostics(imports + cases.join('\n'));
  const lines = new Set(result.filter((d) => d.file?.fileName.endsWith('__editor_schema_virtual__.ts'))
    .map((d) => d.file.getLineAndCharacterOfPosition(d.start).line));
  const offset = imports.split('\n').length - 1;
  for (let i = 0; i < cases.length; i++) assert.ok(lines.has(offset + i), `부정 타입 사례 ${i}가 거부돼야 한다`);
});

function serviceFixture(row, error = null) {
  const calls = [];
  const payloads = [];
  const builder = {
    select: (...args) => { calls.push(['select', ...args]); return builder; },
    order: async (...args) => { calls.push(['order', ...args]); return { data: error ? null : [row], error }; },
    insert: (payload) => { calls.push(['insert']); payloads.push(payload); return builder; },
    update: (payload) => { calls.push(['update']); payloads.push(payload); return builder; },
    delete: () => { calls.push(['delete']); return builder; },
    eq: (...args) => { calls.push(['eq', ...args]); return builder; },
    single: async () => { calls.push(['single']); return { data: error ? null : row, error }; },
    then: (resolve, reject) => Promise.resolve({ data: null, error }).then(resolve, reject),
  };
  const source = readFileSync(new URL('../src/app/editor/services/board.service.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, console: { error() {} },
    require(name) {
      assert.equal(name, '@/lib/supabaseClient');
      return { supabase: { from: (table) => { calls.push(['from', table]); return builder; } } };
    },
    fetch() { throw new Error('실제 네트워크 금지'); },
  });
  return { ...exports, calls, payloads };
}

test('STEP 126: 서비스의 테이블명·조회 순서·추가/수정/삭제 payload와 ID 필터 유지', async () => {
  const payloads = {
    editor_0_noti: { text: '가상 공지', is_noti: false },
    editor_1_projects: { project_name: '가상', members: null, tech_stack: { stack: ['TS'] } },
    editor_2_studies: { study_name: '가상 스터디', year: 2026, semester: 1 },
    editor_3_study_timetable: { study_name: '가상', start_time: null, end_time: null },
    editor_4_schedules: { description: '가상 일정', start_date: null },
    editor_5_donators: { name: '가상', uuid: null },
    editor_6_events: { title: '가상 행사', filenames: [{ filename: 'mock.png', order: 0 }] },
    allowed_user: { name: '가상', email: 'test@example.invalid' },
    registered_member: { email: 'test@example.invalid', generation: null, is_manager: false },
    supervisor_id: { name: '가상', email: 'test@example.invalid' },
  };
  for (const table of ['editor_0_noti', 'editor_1_projects', 'editor_2_studies', 'editor_3_study_timetable',
    'editor_4_schedules', 'editor_5_donators', 'editor_6_events', 'allowed_user', 'registered_member', 'supervisor_id']) {
    const row = Object.freeze({ id: 27 });
    const f = serviceFixture(row);
    const data = await f.fetchPosts(table);
    assert.equal(data[0], row);
    const safeColumns = table === 'editor_5_donators' ? 'id,name,date,created_at' : '*';
    assert.deepEqual(JSON.parse(JSON.stringify(f.calls)), [['from', table], ['select', safeColumns], ['order', 'id', { ascending: true }]]);
    f.calls.length = 0;
    const payload = Object.freeze(payloads[table]);
    assert.equal(await f.insertPost(table, payload), row);
    assert.equal(f.payloads[0], payload);
    assert.deepEqual(f.calls, [['from', table], ['insert'], table === 'editor_5_donators' ? ['select', safeColumns] : ['select'], ['single']]);
    f.calls.length = 0;
    assert.equal(await f.updatePost(table, 27, payload), row);
    assert.equal(f.payloads[1], payload);
    assert.deepEqual(f.calls, [['from', table], ['update'], ['eq', 'id', 27], table === 'editor_5_donators' ? ['select', safeColumns] : ['select'], ['single']]);
    f.calls.length = 0;
    await f.deletePost(table, 27);
    assert.deepEqual(f.calls, [['from', table], ['delete'], ['eq', 'id', 27]]);
  }
});

test('STEP 126: 서비스 오류 반환/throw 계약을 유지한다 — DB 권한 검증을 의미하지 않음', async () => {
  const error = new Error('가상 권한 오류');
  const f = serviceFixture(null, error);
  // STEP 131: 실패를 빈 성공으로 숨기지 않아 로더가 오류 안내와 로딩 해제를 수행한다.
  await assert.rejects(f.fetchPosts('allowed_user'), (e) => e === error);
  await assert.rejects(f.insertPost('allowed_user', {}), (e) => e === error);
  await assert.rejects(f.updatePost('allowed_user', 1, {}), (e) => e === error);
  assert.equal((await f.deletePost('allowed_user', 1)).error, error);
});
