import { test } from 'node:test';
import assert from 'node:assert/strict';
import { domTest, loadSource, Image } from './helpers/react-dom.mjs';

for (const field of ['text', 'description']) {
  test(`공지 ${field}: 더블클릭 편집, 정상 저장, 재조회와 다른 행 보존`, async () => domTest(async ({ render, container, window, act, unmount }) => {
    const rows = [
      { id: 17, text: '가상 제목', description: '가상 내용', is_noti: true },
      { id: 18, text: '다른 제목', description: '다른 내용', is_noti: true },
    ];
    const calls = [];
    const service = {
      fetchPosts: async () => rows.map((row) => ({ ...row })),
      updatePost: async (table, id, payload) => {
        calls.push({ table, id, payload: { ...payload } });
        Object.assign(rows.find((row) => row.id === id), payload);
        return rows.find((row) => row.id === id);
      },
      deletePost: async () => {}, insertPost: async () => {},
    };
    const { NoticeForm } = loadSource('src/app/editor/boards/0_notice/NoticeForm.tsx', { '../../services/board.service': service });
    await render(NoticeForm);
    let firstRow = container.querySelector('tbody tr');
    const cell = firstRow.querySelectorAll('td')[field === 'text' ? 1 : 2];
    await act(async () => cell.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true })));
    const input = firstRow.querySelector('textarea');
    assert.ok(input);
    assert.equal(input.value, field === 'text' ? '가상 제목' : '가상 내용');
    const changed = field === 'text' ? '변경된 제목' : '<script>가상 내용</script>';
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(input, changed);
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    await act(async () => [...firstRow.querySelectorAll('button')].find((button) => button.textContent === '저장').click());
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { table: 'editor_0_noti', id: 17, payload: { [field]: changed } });
    assert.equal(rows[0].id, 17); assert.equal(rows[1].id, 18);
    assert.equal(rows[1].text, '다른 제목'); assert.equal(rows[1].description, '다른 내용');
    firstRow = container.querySelector('tbody tr');
    assert.match(firstRow.textContent, field === 'text' ? /변경된 제목/ : /<script>가상 내용<\/script>/);
    assert.equal(firstRow.querySelector('script'), null);
    await unmount();
    await render(NoticeForm);
    assert.match(container.querySelector('tbody tr').textContent, field === 'text' ? /변경된 제목/ : /<script>가상 내용<\/script>/);
  }));
}

test('공지 저장 실패: 입력을 유지하고 기존 행을 바꾸지 않으며 오류를 표시한다', async () => domTest(async ({ render, container, window, act }) => {
  const row = { id: 4, text: '기존 제목', description: '기존 내용', is_noti: true };
  let calls = 0;
  const { NoticeForm } = loadSource('src/app/editor/boards/0_notice/NoticeForm.tsx', {
    '../../services/board.service': {
      fetchPosts: async () => [{ ...row }],
      updatePost: async () => { calls++; throw new Error('가상 권한 거부'); },
      insertPost: async () => {}, deletePost: async () => {},
    },
  });
  await render(NoticeForm);
  const cell = container.querySelector('tbody tr').querySelectorAll('td')[1];
  await act(async () => cell.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true })));
  const input = cell.querySelector('textarea');
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(input, '저장되지 않은 변경');
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  await act(async () => [...cell.querySelectorAll('button')].find((button) => button.textContent === '저장').click());
  assert.equal(calls, 1); assert.equal(row.text, '기존 제목');
  assert.equal(cell.querySelector('textarea').value, '저장되지 않은 변경');
  assert.match(container.querySelector('[role="alert"]').textContent, /저장하지 못했습니다/);
  await act(async () => [...cell.querySelectorAll('button')].find((button) => button.textContent === '취소').click());
  assert.match(cell.textContent, /기존 제목/);
}));

test('공지 수정 취소: DB 호출 없이 원래 내용을 표시한다', async () => domTest(async ({ render, container, act }) => {
  let calls = 0;
  const { NoticeForm } = loadSource('src/app/editor/boards/0_notice/NoticeForm.tsx', {
    '../../services/board.service': {
      fetchPosts: async () => [{ id: 5, text: '기존 제목', description: '기존 내용', is_noti: true }],
      updatePost: async () => { calls++; }, insertPost: async () => {}, deletePost: async () => {},
    },
  });
  await render(NoticeForm);
  const cell = container.querySelector('tbody tr').querySelectorAll('td')[1];
  await act(async () => cell.querySelector('button').click());
  await act(async () => [...cell.querySelectorAll('button')].find((button) => button.textContent === '취소').click());
  assert.equal(calls, 0); assert.match(cell.textContent, /기존 제목/);
  assert.equal(cell.querySelector('textarea'), null);
}));

test('공통 프로젝트 목록도 더블클릭으로 기존 값을 편집한다', async () => domTest(async ({ render, container, window, act }) => {
  const calls = [];
  const { PostList } = loadSource('src/app/editor/components/PostList.tsx', {
    'next/image': { default: Image, __esModule: true },
    '../services/board.service': { updatePost: async (...args) => calls.push(args) },
    '../services/order.service': {},
    '../services/storage.service': { getPublicImageUrl: () => '/mock/image.png' },
  });
  await render(PostList, { board: '프로젝트', posts: [{ id: 9, project_name: '가상 프로젝트', description: '가상 설명' }], loading: false, reload() {}, setPosts() {} });
  const cell = container.querySelector('tbody tr').querySelectorAll('td')[2];
  await act(async () => cell.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true })));
  const input = cell.querySelector('input');
  assert.equal(input.value, '가상 프로젝트');
  await act(async () => input.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true })));
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'editor_1_projects'); assert.equal(calls[0][1], 9);
  assert.equal(calls[0][2].project_name, '가상 프로젝트');
}));
