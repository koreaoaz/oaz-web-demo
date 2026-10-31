import { NextResponse } from "next/server";

// 운영 회원 RSS를 Demo로 수집하지 않는다.
export async function GET() {
  return NextResponse.json({ total: 0, items: [] });
}
