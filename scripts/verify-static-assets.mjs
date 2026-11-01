import { readdir, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

async function files(root, dir = root) {
  const entries = await readdir(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error('정적 산출물의 심볼릭 링크는 허용되지 않습니다.');
    if (entry.isDirectory()) result.push(...await files(root, path));
    else if (entry.isFile()) result.push(relative(root, path));
  }
  return result;
}

export async function verifyStaticAssets(root, publish = join(root, '.netlify', 'static')) {
  const expectedPublish = resolve(root, '.netlify', 'static');
  if (resolve(publish) !== expectedPublish) throw new Error('Netlify 정적 배포 경로가 아닙니다.');
  const source = join(root, '.next', 'static');
  const target = join(expectedPublish, '_next', 'static');
  const entries = await files(source);
  if (!entries.some(x => x.endsWith('.css')) || !entries.some(x => x.endsWith('.js'))) throw new Error('CSS 또는 JavaScript 산출물이 없습니다.');
  for (const entry of entries) {
    const sourceBytes = await readFile(join(source, entry));
    const targetBytes = await readFile(join(target, entry));
    const digest = value => createHash('sha256').update(value).digest('hex');
    if (digest(sourceBytes) !== digest(targetBytes)) throw new Error(`정적 파일 불일치: ${entry.split(sep).join('/')}`);
  }
  const html = await readFile(join(root, '.next', 'server', 'app', 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:href|src)=["']([^"']*\/_next\/static\/[^"']+)["']/g)].map(match => match[1]);
  if (!refs.some(x => x.split('?')[0].endsWith('.css')) || !refs.some(x => x.split('?')[0].endsWith('.js'))) throw new Error('홈페이지의 CSS 또는 JavaScript 참조가 없습니다.');
  for (const ref of refs) {
    if (!ref.startsWith('/_next/static/') || ref.startsWith('//')) throw new Error('정적 리소스가 다른 호스트를 참조합니다.');
    const path = new URL(ref, 'http://localhost').pathname;
    if (!path.startsWith('/_next/static/')) throw new Error('정적 리소스 경로가 올바르지 않습니다.');
    const file = resolve(expectedPublish, '.' + decodeURIComponent(path));
    if (!file.startsWith(target + sep)) throw new Error('정적 리소스 경로가 배포 경로 밖입니다.');
    if (!(await stat(file)).isFile()) throw new Error('홈페이지 정적 리소스가 없습니다.');
  }
  const buildId = (await readFile(join(root, '.next', 'BUILD_ID'), 'utf8')).trim();
  if (!buildId || !(await stat(join(target, buildId))).isDirectory()) throw new Error('정적 산출물의 빌드 ID가 일치하지 않습니다.');
  await stat(join(root, '.netlify', 'functions', '___netlify-server-handler.zip'));
  return { count: entries.length, css: entries.filter(x => x.endsWith('.css')).length, js: entries.filter(x => x.endsWith('.js')).length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { const result = await verifyStaticAssets(process.cwd()); console.log(`정적 산출물 확인: 파일 ${result.count}개, CSS ${result.css}개, JS ${result.js}개`); }
  catch { console.error('정적 산출물 검증에 실패했습니다. Netlify 빌드를 다시 확인하세요.'); process.exitCode = 1; }
}
