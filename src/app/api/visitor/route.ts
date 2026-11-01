import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const unavailable = () => NextResponse.json({ error: "방문자 집계를 사용할 수 없습니다." }, { status: 503, headers: { "Cache-Control": "no-store" } });

// 전용 최소 권한과 외부 요청 제한 검증 전까지 어떤 서버 키도 사용하지 않는다.
export async function GET() { return unavailable(); }
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "요청 출처가 올바르지 않습니다." }, { status: 403 });
  }
  return unavailable();
}
