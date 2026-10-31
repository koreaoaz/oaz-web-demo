import { validateDemoPublicConfig } from "./lib/demoConfig";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const runtime = (name: string) => process.env[name];
    const checked = validateDemoPublicConfig(runtime("NEXT_PUBLIC_SUPABASE_URL"), runtime("NEXT_PUBLIC_SUPABASE_KEY"));
    if (checked.url !== process.env.NEXT_PUBLIC_SUPABASE_URL || checked.key !== process.env.NEXT_PUBLIC_SUPABASE_KEY) {
      throw new Error("빌드 설정과 서버 실행 설정이 일치하지 않습니다.");
    }
  }
}
