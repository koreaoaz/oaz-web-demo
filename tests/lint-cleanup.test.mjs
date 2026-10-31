import { visitorCase, sliderCase } from './helpers/timing-cases.mjs';
import { imageCase, gridCase } from './helpers/image-cases.mjs';
// STEP 131: 과거 setter 시점/응답 경합 기대값을 승인된 정상 동작의 실제 DOM 검사로 교체한다.
import { publicQueryCase, boardQueryCase, blogQueryCase } from './helpers/query-cases.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as XLSX from 'xlsx';

// 실제 소스를 분리해 실행한다. 허용하지 않은 import와 네트워크는 항상 차단한다.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
function tree(path) {
  return ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function find(root, predicate) {
  let result;
  function visit(node) {
    if (!result && predicate(node)) result = node;
    ts.forEachChild(node, visit);
  }
  visit(root);
  assert.ok(result, '대상 소스 노드를 찾아야 한다');
  return result;
}
function arrow(path, name) {
  const root = tree(path);
  const node = find(root, (n) => ts.isVariableDeclaration(n) && n.name.getText(root) === name);
  return node.initializer.getText(root);
}
function isolated(source, globals = {}) {
  const exports = {};
  vm.runInNewContext(compile(source), {
    exports,
    fetch: () => { throw new Error('실제 네트워크 금지'); },
    require: (name) => { throw new Error(`허용하지 않은 import: ${name}`); },
    ...globals,
  });
  return exports;
}
const { mergeNoticeOrder } = isolated(read('src/app/editor/utils/noticeOrder.ts'));
function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

// Hook의 상태/의존성/cleanup 계약을 제어하는 모형이다. 실제 브라우저의 paint는 검증하지 않는다.
function hookFixture(path, exportName, mocks = {}, globals = {}) {
  const slots = [];
  const pending = new Map();
  const effects = new Map();
  let cursor = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const hooks = {
    useState(initial) {
      const i = cursor++;
      if (!slots[i]) {
        slots[i] = { value: typeof initial === 'function' ? initial() : initial };
        slots[i].set = (update) => { slots[i].value = typeof update === 'function' ? update(slots[i].value) : update; };
      }
      return [slots[i].value, slots[i].set];
    },
    useRef(initial) {
      const i = cursor++;
      slots[i] ??= { current: initial };
      return slots[i];
    },
    useCallback(callback, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { callback, deps };
      return slots[i].callback;
    },
    useEffect(callback, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) {
        slots[i] = { deps };
        pending.set(i, callback);
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const loaded = isolated(read(path), {
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
      if (Object.hasOwn(mocks, name)) return mocks[name];
      throw new Error(`허용하지 않은 import: ${name}`);
    },
    ...globals,
  });
  return {
    render(...args) { cursor = 0; return loaded[exportName](...args); },
    flushEffects() {
      for (const [i, callback] of pending) {
        effects.get(i)?.cleanup?.();
        effects.set(i, { callback, cleanup: callback() });
      }
      pending.clear();
    },
    replayEffects() {
      for (const effect of effects.values()) { effect.cleanup?.(); effect.cleanup = effect.callback(); }
    },
    unmount() { for (const effect of effects.values()) effect.cleanup?.(); },
    state: (i) => slots[i].value,
    setState: (i, value) => slots[i].set(value),
  };
}
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

test('STEP 131: 프로젝트 초기 로딩·실패 안내·새 mount 로딩', async () => publicQueryCase('project', 'error', true));

test('STEP 131: 시간표 초기 로딩·실패 안내·새 mount 로딩', async () => publicQueryCase('timetable', 'error', true));

test('STEP 131: 스터디 페이지 이동은 카드를 즉시 닫는다', async () => gridCase('page'));

for (const path of ['src/app/editor/components/ImageFromStorage.tsx', 'src/app/events/archive/components/ImageFromStorage.tsx']) {
  test(`STEP 131: ${path}의 첫 표시·URL 교체·이미지 실패 대체`, async () => imageCase(path));
}

test('STEP 131: 블로그 입력·제출·페이지 이동과 중복 요청 방지', async () => blogQueryCase('search'));

test('데모: ID 재작성 정렬은 DB를 수정하지 않고 거부한다', async () => {
  const { persistOrder } = isolated(read('src/app/editor/services/order.service.ts'));
  const items = [{ id: 30 }, { id: 10 }, { id: 20 }];
  await assert.rejects(persistOrder('mock_table', items), /지원하지 않습니다/);
  assert.deepEqual(items, [{ id: 30 }, { id: 10 }, { id: 20 }]);
});

test('STEP 131: 게시판별 재조회와 응답 경합 차단', async () => boardQueryCase('race'));

test('8단계: 공지 소비 계약의 unknown은 truthiness와 부분 목록 재정렬을 유지한다', async () => {
  const path = 'src/app/editor/boards/0_notice/NoticeForm.tsx';
  const root = tree(path);
  const reorder = find(root, (n) => ts.isPropertyAssignment(n) && n.name.getText(root) === 'onReorder');
  const posts = [true, false, null, undefined, 0, '', '가상 참 값'].map((is_noti, i) => ({ id: i + 1, is_noti }));
  for (const filter of ['공지', '홍보']) {
    const trace = [];
    const { matches, reorder: run } = isolated(`const matchesFilter = ${arrow(path, 'matchesFilter')};
      export const matches = matchesFilter; export const reorder = ${reorder.initializer.getText(root)}`, {
      posts, filter,
      latestPosts: { current: posts }, dragSnapshot: { current: { posts, rows: [...posts], filter } }, mergeNoticeOrder,
      alert: () => assert.fail('정상 순열은 취소하지 않는다'),
      setPosts: (v) => trace.push(['posts', v]),
      persistOrder: async (table, v) => trace.push(['persist', table, v]),
      BOARD_TABLE_MAP: { 공지: 'mock_notice' }, loadPosts: () => trace.push(['reload']),
    });
    const selected = posts.filter((p) => filter === '공지' ? !!p.is_noti : !p.is_noti);
    assert.deepEqual(posts.map(matches), posts.map((p) => filter === '공지' ? !!p.is_noti : !p.is_noti));
    const reordered = [...selected].reverse();
    await run(reordered);
    const result = trace[0][1];
    assert.equal(result.length, posts.length);
    assert.deepEqual(Array.from(result.filter(matches), (p) => p.id), reordered.map((p) => p.id));
    assert.deepEqual(Array.from(result.filter((p) => !matches(p)), (p) => p.id), posts.filter((p) => !matches(p)).map((p) => p.id));
    assert.equal(trace[1][1], 'mock_notice');
    assert.equal(trace[1][2], result);
    assert.deepEqual(trace[2], ['reload']);
  }
});

for (const [path, active] of [
  ['src/app/editor/boards/1_project/ProjectForm.tsx', true],
  ['src/app/editor/boards/project/ProjectForm.tsx', false],
]) {
  test(`9단계: ${path}의 payload·업로드·반환 callback을 유지한다`, async () => {
    for (const withImage of [false, true]) {
      const writes = [];
      const callbacks = [];
      const returned = Object.freeze({ id: 17, project_name: '가상 프로젝트', members: null, tech_stack: null });
      const globals = {
        title: '가상 프로젝트', duration: '1개월', category: 'AI/ML', year: 2026,
        semester: 2, teamSize: 3, members: '가상A, 가상B',
        body: '가상 설명', detailedDescription: '가상 본문', techStack: ' TS, React, ', currentYear: 2026,
        BOARD_TABLE_MAP: { 프로젝트: 'mock_project' },
        image: { file: withImage ? { name: 'mock.png' } : null, reset: () => writes.push(['reset']) },
        uploadImage: async (bucket) => { writes.push(['upload', bucket]); return 'uploaded.png'; },
        insertPost: async (table, payload) => { writes.push(['insert', table, payload]); return returned; },
        onSuccess: (row) => callbacks.push(row),
      };
      for (const setter of ['Title', 'Duration', 'Category', 'Year', 'Semester', 'TeamSize', 'Members', 'Body', 'DetailedDescription', 'TechStack']) {
        globals[`set${setter}`] = () => {};
      }
      const { submit } = isolated(`export const submit = ${arrow(path, 'handleSubmit')}`, globals);
      await submit({ preventDefault() {} });
      const insertion = writes.find((entry) => entry[0] === 'insert');
      const payload = insertion[2];
      assert.equal(insertion[1], 'mock_project');
      assert.equal(payload.filename, withImage ? 'uploaded.png' : active ? 'one_and_zero_logo_white.png' : null);
      assert.deepEqual(JSON.parse(JSON.stringify(payload.tech_stack)), active ? { stack: ['TS', 'React'] } : ['TS', 'React']);
      assert.deepEqual(JSON.parse(JSON.stringify(payload.members)), '가상A, 가상B');
      assert.equal(payload.semester, 2);
      assert.equal(payload.year, active ? 2026 : undefined);
      assert.equal(callbacks.length, 1);
      assert.equal(callbacks[0], returned);
      assert.equal(writes.filter((entry) => entry[0] === 'upload').length, withImage ? 1 : 0);
      assert.equal(writes.at(-1)[0], 'reset');
      globals.insertPost = async () => { throw new Error('가상 INSERT 실패'); };
      callbacks.length = 0;
      const failing = isolated(`export const submit = ${arrow(path, 'handleSubmit')}`, globals);
      await assert.rejects(failing.submit({ preventDefault() {} }), /가상 INSERT 실패/);
      assert.equal(callbacks.length, 0);
    }
  });
}

test('9단계: Excel의 열 순서·숫자·선행0·빈값·날짜를 메모리 왕복으로 검증한다', async () => {
  const path = 'src/app/editor/components/PostList.tsx';
  const rows = [
    { name: '가상회원', student_id: '0012', department: '시험학과', generation: 0, email: 'test@example.invalid', phone_number: '000-0000' },
    { name: '검증', student_id: 12, department: '', generation: null, email: null, phone_number: '' },
    { name: '날짜검증', student_id: '0000', department: '가상', generation: new Date('2026-10-31T00:00:00Z'), email: '', phone_number: '' },
  ];
  const captured = [];
  const { download } = isolated(`const BOARD_COLUMNS = ${arrow(path, 'BOARD_COLUMNS')};
    export const download = ${arrow(path, 'handleExcelDownload')}`, {
    board: '등록회원', BOARD_TABLE_MAP: { 등록회원: 'mock_members' },
    fetchPosts: async (table) => { assert.equal(table, 'mock_members'); return rows; },
    XLSX: { utils: XLSX.utils, writeFile: (workbook, name) => captured.push({ workbook, name }) },
  });
  await download();
  assert.equal(captured.length, 1);
  assert.equal(captured[0].name, '등록회원.xlsx');
  const buffer = XLSX.write(captured[0].workbook, { bookType: 'xlsx', type: 'buffer' });
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  assert.deepEqual(workbook.SheetNames, ['등록회원']);
  const sheet = workbook.Sheets['등록회원'];
  assert.deepEqual(XLSX.utils.sheet_to_json(sheet, { header: 1 })[0], ['이름', '학번', '학과', '기수', '이메일', '전화번호']);
  assert.equal(sheet.B2.v, '0012'); assert.equal(sheet.B2.t, 's');
  assert.equal(sheet.B3.v, 12); assert.equal(sheet.B3.t, 'n');
  assert.equal(sheet.C3.v, ''); assert.equal(sheet.D2.v, 0);
  assert.equal(sheet.D4.t, 'n');
  assert.equal(sheet.D4.v, captured[0].workbook.Sheets['등록회원'].D4.v);
});

for (const scenario of [
  { name: '사용자 없음', user: null, registered: false, status: 'denied' },
  { name: '인증 오류', user: { id: 'mock-user' }, error: {}, registered: true, status: 'denied' },
  { name: '기존 회원', user: { id: 'mock-member' }, registered: true, status: 'allowed' },
  { name: '관리자', user: { id: 'mock-manager' }, registered: true, status: 'allowed' },
  { name: '이메일 불일치 기존 회원', user: { id: 'mock-legacy', email: 'different@example.invalid' }, registered: true, status: 'allowed' },
  { name: '미등록 회원', user: { id: 'mock-new' }, registered: false, status: 'denied' },
]) {
  test(`10단계: 로그인 callback의 UUID 판별 유지 — ${scenario.name}`, async () => {
    const calls = [];
    let router = { push: (path) => calls.push(['push', path]) };
    const h = hookFixture('src/app/login_callback/page.tsx', 'default', {
      'next/navigation': { useRouter: () => router },
      '@/lib/supabaseClient': { supabase: {
        auth: {
          getUser: async () => { calls.push(['getUser']); return { data: { user: scenario.user }, error: scenario.error }; },
          signOut: async () => { calls.push(['signOut']); },
        },
        from: (table) => {
          assert.equal(table, 'registered_member');
          return { select: (column) => {
            assert.equal(column, 'uuid');
            return { eq: (key, value) => {
              assert.equal(key, 'uuid'); assert.equal(value, scenario.user.id);
              return { maybeSingle: async () => ({ data: scenario.registered ? { uuid: value } : null }) };
            } };
          } };
        },
      } },
    });
    h.render(); h.flushEffects(); await settle();
    assert.equal(h.state(0), scenario.status);
    const expected = scenario.status === 'allowed' ? 'push' : scenario.user && !scenario.error ? 'signOut' : null;
    if (expected) assert.equal(calls.filter((c) => c[0] === expected).length, 1);
    h.render(); h.flushEffects(); await settle();
    assert.equal(calls.filter((c) => c[0] === 'getUser').length, 1);
    h.replayEffects(); await settle();
    assert.equal(calls.filter((c) => c[0] === 'getUser').length, 2);
    if (expected) assert.equal(calls.filter((c) => c[0] === expected).length, 2);
    router = { push: (path) => calls.push(['push', path]) };
    h.render(); h.flushEffects(); await settle();
    assert.equal(calls.filter((c) => c[0] === 'getUser').length, 3, 'router  교체 시 현재 객체로 다시 검증한다');
    h.unmount();
  });
}

test('STEP 131: 슬라이드 4000ms·699/700/701ms·무한 순환과 cleanup', async () => sliderCase('loop'));

test('STEP 131: 방문자 KST 날짜·집계 정책과 중복 POST 방지', async () => visitorCase('policy'));

for (const [name, user, supervisor, expected] of [
  ['익명', null, false, '/signin'],
  ['일반 회원', { id: 'mock-member' }, false, '/'],
  ['관리자', { id: 'mock-manager' }, true, null],
]) {
  test(`STEP 126: 기존 Editor 권한 경계 유지 — ${name}`, async () => {
    const path = 'src/app/editor/page.tsx';
    const mocks = {};
    for (const node of tree(path).statements.filter(ts.isImportDeclaration)) {
      const names = node.importClause?.namedBindings;
      mocks[node.moduleSpecifier.text] = names && ts.isNamedImports(names)
        ? Object.fromEntries(names.elements.map((n) => [n.name.text, () => null])) : { default: () => null };
    }
    const destinations = [];
    let reads = 0;
    const router = { replace: (route) => destinations.push(route) };
    mocks['next/navigation'] = { useRouter: () => router };
    mocks['@/lib/supabaseClient'] = { supabase: {
      auth: { getUser: async () => ({ data: { user }, error: null }) },
      from: (table) => {
        assert.equal(table, 'supervisor_id'); reads++;
        return { select: (column) => {
          assert.equal(column, 'uuid');
          return { eq: (key, value) => {
            assert.equal(key, 'uuid'); assert.equal(value, user.id);
            return { maybeSingle: async () => ({ data: supervisor ? { uuid: user.id } : null, error: null }) };
          } };
        } };
      },
    } };
    const h = hookFixture(path, 'default', mocks, { window: { alert() {} } });
    h.render(); h.flushEffects(); await settle();
    assert.equal(reads, user ? 1 : 0);
    if (expected) {
      assert.deepEqual(destinations, [expected]);
      assert.equal(h.state(0), 'checking');
    } else {
      assert.deepEqual(destinations, []);
      assert.equal(h.state(0), 'authorized');
      assert.equal(h.render().type.name, 'AuthorizedEditor');
    }
    h.unmount();
  });
}

test('STEP 127: 공지/홍보 순열 830가지에서 행 보존·비선택 위치·ID 저장 호출 유지', async () => {
  const path = 'src/app/editor/boards/0_notice/NoticeForm.tsx';
  const root = tree(path);
  const reorder = find(root, (n) => ts.isPropertyAssignment(n) && n.name.getText(root) === 'onReorder');
  function* permutations(items) {
    if (items.length === 0) { yield []; return; }
    for (let i = 0; i < items.length; i++) {
      for (const tail of permutations(items.filter((_, j) => j !== i))) yield [items[i], ...tail];
    }
  }
  let checked = 0;
  for (const filter of ['공지', '홍보']) {
    const posts = [];
    const trace = [];
    const latestPosts = { current: posts };
    const dragSnapshot = { current: null };
    const { matches, run } = isolated(`const matchesFilter = ${arrow(path, 'matchesFilter')};
      export const matches = matchesFilter; export const run = ${reorder.initializer.getText(root)}`, {
      posts, filter, latestPosts, dragSnapshot, mergeNoticeOrder,
      alert: () => assert.fail('정상 순열은 취소하지 않는다'), BOARD_TABLE_MAP: { 공지: 'mock_notice' },
      setPosts: (rows) => trace.push(['posts', rows]),
      persistOrder: async (table, rows) => trace.push(['persist', table, rows]),
      loadPosts: () => trace.push(['reload']),
    });
    for (let size = 0; size <= 5; size++) for (let mask = 0; mask < 2 ** size; mask++) {
      posts.splice(0, posts.length, ...Array.from({ length: size }, (_, i) => Object.freeze({
        id: i + 1, is_noti: Boolean(mask & (1 << i)), text: null, description: null, created_at: '2026-10-31T00:00:00Z',
      })));
      const selected = posts.filter(matches);
      for (const permutation of permutations(selected)) {
        trace.length = 0;
        latestPosts.current = posts;
        dragSnapshot.current = { posts, rows: [...posts], filter };
        await run(permutation);
        const result = Array.from(trace[0][1]);
        const positions = posts.map((p, i) => matches(p) ? i : -1).filter((i) => i !== -1);
        const expected = [...posts];
        positions.forEach((position, i) => { expected[position] = permutation[i]; });
        assert.deepEqual(result, expected);
        assert.equal(new Set(result).size, posts.length);
        assert.deepEqual(trace.map((entry) => entry[0]), ['posts', 'persist', 'reload']);
        assert.equal(trace[1][1], 'mock_notice');
        assert.equal(trace[1][2], trace[0][1]);
        checked++;
      }
    }
  }
  assert.equal(checked, 830);
});

test('STEP 127: 드래그 도중 목록 축소는 순열 불변식을 깨뜨릴 수 있음을 기록', async () => {
  let reordered;
  const capture = async (rows) => { reordered = rows; };
  const h = hookFixture('src/app/editor/hooks/useDragAndDrop.tsx', 'useDragAndDrop');
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const first = h.render({ items, onReorder: capture });
  first.handleDragStart({}, 2);
  const afterReload = h.render({ items: items.slice(0, 1), onReorder: capture });
  await afterReload.handleDrop({}, 0);
  assert.equal(reordered.length, 2);
  assert.equal(reordered[0], undefined);
  assert.equal(reordered[1], items[0]);
  h.unmount();
});

test('STEP 131: JSONB 이미지 파서는 표시 가능한 객체만 선택하고 원본을 보존한다', () => {
  const { getFirstImageFilename: first } = isolated(read('src/app/editor/utils/parsing_first.ts'), { console: { error() {} } });
  for (const value of [null, [], true, 1, { arbitrary: true }, 'broken']) assert.equal(first(value), null);
  assert.equal(first([{ order: 0, filename: 'mock.png' }]), 'mock.png');
  assert.equal(first('[{"order":0,"filename":"mock.png"}]'), 'mock.png');
  assert.equal(first([{ filename: 7 }]), null);
  assert.equal(first('[{"filename":7}]'), null);
  const unexpected = { arbitrary: true };
  assert.equal(first([{ filename: unexpected }]), null);
  const valid = Object.freeze({ filename: 'mock.png', order: 8 });
  const raw = Object.freeze([null, { filename: 7 }, valid, { filename: 'second.png', order: 2 }]);
  assert.equal(first(raw), 'mock.png');
  const { getEventImages } = isolated(read('src/app/editor/utils/parsing_first.ts'));
  const images = getEventImages(raw);
  assert.equal(images.length, 2); assert.equal(images[0], valid); assert.equal(images[0].order, 8);
  assert.equal(raw.length, 4);
});

test('Demo: 회원 Form이 실제 generation/phone_number 컬럼으로 저장', async () => {
  let payload;
  const globals = {
    name: '가상회원', department: '시험학과', student_id: '0000', gen: '0',
    uuid: '00000000-0000-4000-8000-000000000001', email: 'test@example.invalid', phone: '000',
    BOARD_TABLE_MAP: { 등록회원: 'registered_member' },
    insertPost: async (table, value) => { assert.equal(table, 'registered_member'); payload = value; },
  };
  for (const setter of ['Name', 'Department', 'Student_id', 'Gen', 'Uuid', 'Email', 'Phone']) globals[`set${setter}`] = () => {};
  const path = 'src/app/editor/boards/8_registered_member/Registered_mem.tsx';
  const { submit } = isolated(`export const submit = ${arrow(path, 'handleSubmit')}`, globals);
  await submit({ preventDefault() {} });
  assert.equal(payload.generation, '0'); assert.equal(payload.phone_number, '000');
  assert.equal(Object.hasOwn(payload, 'gen'), false);
  assert.equal(Object.hasOwn(payload, 'phone'), false);
});

function uiNodes(node, predicate) {
  if (Array.isArray(node)) return node.flatMap((child) => uiNodes(child, predicate));
  if (!node || typeof node !== 'object' || !node.props) return [];
  return [...(predicate(node) ? [node] : []), ...uiNodes(node.props.children, predicate)];
}
async function noticeFixture(rows) {
  const requests = [];
  const saved = [];
  const alerts = [];
  const events = [];
  let reorder;
  let h;
  const noop = () => {};
  h = hookFixture('src/app/editor/boards/0_notice/NoticeForm.tsx', 'NoticeForm', {
    '../../services/board.service': {
      fetchPosts: () => { const request = deferred(); requests.push(request); events.push('fetch'); return request.promise; },
      deletePost: noop, insertPost: noop,
    },
    '../../services/order.service': { persistOrder: async (table, value) => {
      assert.equal(table, 'editor_0_noti'); assert.equal(h.state(4), value);
      saved.push(value); events.push('persist');
    } },
    '../../hooks/useDragAndDrop': { useDragAndDrop: (params) => {
      reorder = params.onReorder;
      return { handleDragStart: noop, handleDragOver: noop, handleDrop: noop, handleDragEnd: noop };
    } },
    '../../constants': { BOARD_TABLE_MAP: { 공지: 'editor_0_noti' } },
    '../../components/common/FormField': { FormField: 'FormField' },
    '../../utils/inputformClasses': { textareaBase: '' }, '../../utils/cx': { cx: noop },
    '../../utils/noticeOrder': { mergeNoticeOrder },
  }, { alert: (message) => alerts.push(message) });
  h.render(); h.flushEffects(); requests[0].resolve(rows); await settle();
  let output = h.render();
  const start = () => {
    const row = uiNodes(output, (n) => n.props.draggable === false)[0];
    assert.ok(row); row.props.onDragStart({});
  };
  return {
    h, saved, alerts, events,
    start,
    drop: (value) => reorder(value),
    async replace(value, render = true) {
      h.replayEffects(); requests.at(-1).resolve(value); await settle();
      if (render) output = h.render();
    },
    render() { output = h.render(); },
  };
}
const noticeRows = () => [
  { id: 1, is_noti: true, text: '가상 A', description: null, created_at: '2026-10-31T00:00:00Z' },
  { id: 2, is_noti: true, text: '가상 B', description: null, created_at: '2026-10-31T00:00:00Z' },
  { id: 3, is_noti: false, text: '가상 홍보', description: null, created_at: '2026-10-31T00:00:00Z' },
];

test('STEP 128: 정상 공지 정렬은 상태 반영→ID 저장→재조회 순서를 유지', async () => {
  const rows = noticeRows();
  const f = await noticeFixture(rows);
  f.start(); f.events.length = 0;
  await f.drop([rows[1], rows[0]]);
  assert.deepEqual(Array.from(f.saved[0]), [rows[1], rows[0], rows[2]]);
  assert.deepEqual(f.events, ['persist', 'fetch']);
  assert.equal(f.alerts.length, 0);
  f.h.unmount();
});

for (const [name, change] of [
  ['감소', (rows) => rows.slice(0, 1)],
  ['증가', (rows) => [...rows, { ...rows[0], id: 4 }]],
  ['교체', (rows) => [{ ...rows[0], text: '갱신됨' }, ...rows.slice(1)]],
  ['순서 변경', (rows) => [...rows].reverse()],
  ['동일 배열의 감소', (rows) => { rows.pop(); return rows; }],
  ['동일 배열의 순서 변경', (rows) => { rows.reverse(); return rows; }],
]) {
  test(`STEP 128: 드래그 중 목록 ${name} 시 현재 목록을 유지하고 저장 금지`, async () => {
    const rows = noticeRows();
    const f = await noticeFixture(rows);
    f.start(); const updated = change(rows);
    await f.replace(updated); f.events.length = 0;
    await f.drop([rows[1], rows[0]]);
    assert.equal(f.h.state(4), updated);
    assert.equal(f.saved.length, 0); assert.equal(f.alerts.length, 1);
    assert.deepEqual(f.events, []);
    f.h.unmount();
  });
}

test('STEP 128: 응답 도착 후 렌더 전에도 최신 목록을 덮어쓰지 않는다', async () => {
  const rows = noticeRows();
  const f = await noticeFixture(rows);
  f.start(); const updated = rows.slice(0, 1);
  await f.replace(updated, false); f.events.length = 0;
  await f.drop([rows[1], rows[0]]);
  assert.equal(f.h.state(4), updated);
  assert.equal(f.saved.length, 0); assert.equal(f.alerts.length, 1);
  f.h.unmount();
});

for (const [name, change] of [
  ['빈 배열', () => []],
  ['undefined', (rows) => [undefined, rows[0]]],
  ['중복 행', (rows) => [rows[0], rows[0]]],
  ['다른 구성원', (rows) => [rows[0], { ...rows[1] }]],
  ['홍보 행 혼입', (rows) => [rows[0], rows[2]]],
  ['초과 길이', (rows) => [rows[0], rows[1], rows[2]]],
]) {
  test(`STEP 128: 불완전한 순열 ${name}은 상태·DB 변경 없이 거부`, async () => {
    const rows = noticeRows(); const f = await noticeFixture(rows);
    f.start(); f.events.length = 0;
    await f.drop(change(rows));
    assert.equal(f.h.state(4), rows);
    assert.equal(f.saved.length, 0); assert.equal(f.alerts.length, 1);
    assert.deepEqual(f.events, []);
    f.h.unmount();
  });
}

test('STEP 128: 필터 변경 또는 종료된 드래그의 후속 저장을 거부', async () => {
  for (const mode of ['filter', 'end']) {
    const rows = noticeRows(); const f = await noticeFixture(rows); f.start();
    if (mode === 'filter') { f.h.setState(8, '홍보'); f.render(); }
    else {
      const row = uiNodes(f.h.render(), (n) => n.props.draggable === false)[0]; row.props.onDragEnd();
    }
    await f.drop([rows[1], rows[0]]);
    assert.equal(f.h.state(4), rows); assert.equal(f.saved.length, 0);
    assert.equal(f.alerts.length, 1); f.h.unmount();
  }
});

for (const [board, row] of [
  ['공지', { id: 1, text: '가상 공지', description: null }],
  ['프로젝트', { id: 2, project_name: '가상 프로젝트', description: null, filename: 'mock.png' }],
  ['스터디', { id: 3, study_name: '가상 스터디', outline: null, filename: null }],
  ['행사', { id: 4, title: '가상 행사', description: null, filenames: [{ order: 0, filename: 'mock.png' }] }],
  ['일정', { id: 5, description: '가상 일정', start_date: null, end_date: null }],
  ['학회실 사용 시간표', { id: 6, study_name: '가상 시간표', leader: null, start_time: null, end_time: null }],
  ['명예의 전당', { id: 7, name: '가상 이름', date: null }],
  ['등록회원', { id: 8, name: '가상 회원', student_id: '0012', department: '시험학과', generation: null, email: 'test@example.invalid', phone_number: null }],
  ['승인email', { id: 9, name: '가상 승인', email: 'test@example.invalid' }],
  ['관리자id', { id: 10, name: '가상 관리자', email: 'test@example.invalid', uuid: '00000000-0000-4000-8000-000000000001' }],
]) {
  test(`STEP 128: PostList ${board}의 표시·기존 숫자 편집·삭제·Excel 흐름 유지`, async () => {
    const constants = isolated(read('src/app/editor/constants.ts'));
    const parser = isolated(read('src/app/editor/utils/parsing_first.ts'), { console: { error() {} } });
    const calls = [];
    const downloads = [];
    let reloads = 0;
    let confirmed = false;
    const noop = () => {};
    const h = hookFixture('src/app/editor/components/PostList.tsx', 'PostList', {
      '../constants': constants,
      '../hooks/useDragAndDrop': { useDragAndDrop: () => ({ handleDragStart: noop, handleDragOver: noop, handleDrop: noop, handleDragEnd: noop }) },
      '../services/order.service': { persistOrder: () => assert.fail('정렬은 별도 검사') },
      '../services/board.service': {
        fetchPosts: async (table) => { assert.equal(table, constants.BOARD_TABLE_MAP[board]); return [row]; },
        updatePost: async (...args) => calls.push(['update', ...args]),
        deletePost: async (...args) => calls.push(['delete', ...args]),
      },
      './ImageFromStorage': { ImageFromStorage: 'MockImage' },
      '../utils/cx': { cx: (...values) => values.filter(Boolean).join(' ') },
      '../utils/parsing_first': parser,
      xlsx: { utils: XLSX.utils, writeFile: (workbook, name) => downloads.push({ workbook, name }) },
    }, { confirm: () => confirmed, alert: () => assert.fail('정상 모의 요청은 실패하지 않는다') });
    const props = { board, posts: [row], loading: false, reload: () => reloads++, setPosts: () => assert.fail('편집/삭제는 직접 목록을 교체하지 않는다') };
    let output = h.render(props);
    const cells = uiNodes(output, (node) => node.type === 'td' && node.props.onClick);
    assert.ok(cells.length > 0);
    cells[0].props.onClick();
    const field = h.state(0).field;
    assert.equal(h.state(1), row[field] ?? '');
    output = h.render(props);
    const input = uiNodes(output, (node) => node.type === 'input')[0];
    input.props.onChange({ target: { value: '0012' } });
    output = h.render(props);
    await uiNodes(output, (node) => node.type === 'input')[0].props.onBlur();
    assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), ['update', constants.BOARD_TABLE_MAP[board], row.id, { [field]: 12 }]);
    assert.equal(reloads, 1);
    output = h.render(props);
    const remove = uiNodes(output, (node) => node.type === 'button' && node.props.children === '삭제')[0];
    await remove.props.onClick(); assert.equal(calls.length, 1);
    confirmed = true; await remove.props.onClick();
    assert.deepEqual(calls[1], ['delete', constants.BOARD_TABLE_MAP[board], row.id]);
    assert.equal(reloads, 2);
    const exportButton = uiNodes(output, (node) => node.type === 'button' && node.props.children === 'excel-download')[0];
    if (board === '등록회원') {
      await exportButton.props.onClick();
      assert.equal(downloads.length, 1); assert.equal(downloads[0].name, '등록회원.xlsx');
      assert.equal(downloads[0].workbook.Sheets['등록회원'].B2.v, '0012');
    } else assert.equal(exportButton, undefined);
    h.unmount();
  });
}
