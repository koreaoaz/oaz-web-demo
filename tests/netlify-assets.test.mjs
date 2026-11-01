import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyStaticAssets } from '../scripts/verify-static-assets.mjs';

test('Netlify 정적 경로, CSS·JS 내용, 빌드 ID와 서버 함수를 검증한다', async () => {
  const root = await mkdtemp(join(tmpdir(), 'oaz-static-'));
  const source = join(root, '.next', 'static');
  const target = join(root, '.netlify', 'static', '_next', 'static');
  try {
    for (const path of [join(source, 'chunks'), join(target, 'chunks'), join(target, 'build1'), join(root, '.netlify', 'functions'), join(root, '.next', 'server', 'app')]) await mkdir(path, { recursive: true });
    await writeFile(join(root, '.next', 'BUILD_ID'), 'build1');
    await writeFile(join(root, '.next', 'server', 'app', 'index.html'), '<link href="/_next/static/chunks/a.css"><script src="/_next/static/chunks/b.js"></script>');
    await writeFile(join(root, '.netlify', 'functions', '___netlify-server-handler.zip'), 'fixture');
    for (const file of ['a.css', 'b.js']) {
      await writeFile(join(source, 'chunks', file), file);
      await writeFile(join(target, 'chunks', file), file);
    }
    assert.deepEqual(await verifyStaticAssets(root), { count: 2, css: 1, js: 1 });
    await writeFile(join(root, '.next', 'server', 'app', 'index.html'), '<link href="https://example.test/_next/static/chunks/a.css"><script src="/_next/static/chunks/b.js"></script>');
    await assert.rejects(verifyStaticAssets(root));
    await writeFile(join(root, '.next', 'server', 'app', 'index.html'), '<link href="/_next/static/chunks/a.css"><script src="/_next/static/chunks/b.js"></script>');
    await assert.rejects(verifyStaticAssets(root, join(root, '.next')));
    await rm(join(target, 'chunks', 'a.css'));
    await assert.rejects(verifyStaticAssets(root));
    await writeFile(join(target, 'chunks', 'a.css'), 'modified');
    await assert.rejects(verifyStaticAssets(root));
  } finally { await rm(root, { recursive: true, force: true }); }
});
