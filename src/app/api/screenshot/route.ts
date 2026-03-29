import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  try {
    const microlinkUrl = `https://api.microlink.io/?url=${encodeURIComponent(
      url
    )}&screenshot=true&fullPage=true&meta=false&viewport.width=1280&viewport.height=800&waitForTimeout=3000`;

    const res = await fetch(microlinkUrl);
    const data = await res.json();

    if (data.data?.screenshot?.url) {
      return NextResponse.json(
        { screenshotUrl: data.data.screenshot.url },
        {
          headers: {
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        }
      );
    }

    return NextResponse.json(
      { error: "Screenshot failed", details: data },
      { status: 502 }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to capture screenshot" },
      { status: 500 }
    );
  }
}
