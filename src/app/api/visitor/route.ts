import { createHmac, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEMO_URL, validateDemoPublicConfig, validateDemoServerKey } from "@/lib/demoConfig";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const unavailable = () => NextResponse.json({ error: "방문자 집계를 사용할 수 없습니다." }, { status: 503, headers: { "Cache-Control": "no-store" } });
function client() {
  validateDemoPublicConfig(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_KEY);
  const key = validateDemoServerKey(process.env.DEMO_VISITOR_SERVICE_KEY);
  if (!process.env.DEMO_VISITOR_HMAC_KEY || process.env.DEMO_VISITOR_HMAC_KEY.length < 32) throw new Error("방문자 해시 설정이 필요합니다.");
  return createClient(DEMO_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function today() { return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); }
export async function GET() {
  try {
    const { data, error } = await client().rpc("demo_visit_read");
    if (error || typeof data !== "number" || !Number.isInteger(data)) return unavailable();
    if (data < 0) return NextResponse.json({ error: "요청이 많습니다." }, { status: 429 });
    return NextResponse.json({ count: data, date: today() }, { headers: { "Cache-Control": "no-store" } });
  } catch { return unavailable(); }
}
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin !== request.nextUrl.origin || request.headers.get("sec-fetch-site") === "cross-site") {
      return NextResponse.json({ error: "요청 출처가 올바르지 않습니다." }, { status: 403 });
    }
    const db = client();
    const current = request.cookies.get("oaz_demo_visitor")?.value;
    const id = current && /^[a-f0-9]{64}$/.test(current) ? current : randomBytes(32).toString("hex");
    const digest = createHmac("sha256", process.env.DEMO_VISITOR_HMAC_KEY!).update(id).digest("hex");
    const { data, error } = await db.rpc("demo_visit_record", { p_digest: digest });
    if (error || typeof data !== "number" || !Number.isInteger(data)) return unavailable();
    if (data < 0) return NextResponse.json({ error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
    const response = NextResponse.json({ count: data, date: today() }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set("oaz_demo_visitor", id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    return response;
  } catch { return unavailable(); }
}
