import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
const COOKIE_NAME = "wr-admin-session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function makeToken(password: string): string {
  // Simple hash: base64 of password + timestamp salt
  // In production you'd use a proper JWT, but this is sufficient for a single-password gate
  const encoder = new TextEncoder();
  const data = encoder.encode(`webreview-admin:${password}:${ADMIN_PASSWORD}`);
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data[i]) | 0;
  }
  return Buffer.from(`wr_${Math.abs(hash).toString(36)}_${ADMIN_PASSWORD.length}`).toString("base64");
}

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    if (!password || password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Mot de passe incorrect" },
        { status: 401 }
      );
    }

    const token = makeToken(password);

    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
