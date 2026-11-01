import { pathToFileURL } from 'node:url';

export async function verifyNetlifySite(env, request = fetch) {
  const { NETLIFY_AUTH_TOKEN: token, NETLIFY_SITE_ID: id, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_KEY: key } = env;
  if (!token || !id || !/^[0-9a-f-]{36}$/i.test(id) || url !== 'https://ctbwaqtqubmjmltbxfzm.supabase.co' || !key) {
    throw new Error('Demo 배포 설정이 없거나 올바르지 않습니다.');
  }
  const response = await request(`https://api.netlify.com/api/v1/sites/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Netlify 사이트를 확인할 수 없습니다.');
  const site = await response.json();
  if (site.id !== id || site.name !== 'oneandzero-demo' || site.ssl_url !== 'https://oneandzero-demo.netlify.app') {
    throw new Error('지정된 사이트가 Demo 사이트와 일치하지 않습니다.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await verifyNetlifySite(process.env);
  console.log('기존 Demo 사이트 및 프로젝트 설정 확인 완료');
}
