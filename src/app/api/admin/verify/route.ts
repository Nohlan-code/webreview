import { NextRequest, NextResponse } from "next/server";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
const COOKIE_NAME = "wr-admin-session";

function makeToken(): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(`webreview-admin:${ADMIN_PASSWORD}:${ADMIN_PASSWORD}`);
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data[i]) | 0;
  }
  return Buffer.from(`wr_${Math.abs(hash).toString(36)}_${ADMIN_PASSWORD.length}`).toString("base64");
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const expected = makeToken();
  if (token !== expected) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true });
}
