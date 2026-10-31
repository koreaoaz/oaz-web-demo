export const DEMO_URL = "https://ctbwaqtqubmjmltbxfzm.supabase.co";
const DEMO_REF = "ctbwaqtqubmjmltbxfzm";

export function validateDemoPublicConfig(url: string | undefined, key: string | undefined) {
  if (url !== DEMO_URL || !key || key.trim() !== key) throw new Error("Demo Supabase 설정이 없거나 대상이 올바르지 않습니다.");
  if (key.startsWith("sb_secret_")) throw new Error("공개 설정에는 비밀키를 사용할 수 없습니다.");
  if (key.startsWith("sb_publishable_")) return { url, key };
  try {
    const payload = JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.role !== "anon" || payload.ref !== DEMO_REF) throw new Error();
    return { url, key };
  } catch { throw new Error("Demo 프로젝트의 공개 키만 사용할 수 있습니다."); }
}

export function validateDemoServerKey(key: string | undefined) {
  if (!key) throw new Error("Demo 방문자 서버 키가 없습니다.");
  try {
    const payload = JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.role !== "service_role" || payload.ref !== DEMO_REF) throw new Error();
    return key;
  } catch { throw new Error("Demo 프로젝트의 서버 전용 키가 아닙니다."); }
}
