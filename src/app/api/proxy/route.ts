import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    let html = await response.text();

    // Parse base URL for relative resources
    const parsedUrl = new URL(url);
    const baseHref = `${parsedUrl.origin}${parsedUrl.pathname.replace(/\/[^/]*$/, "/") || "/"}`;

    // Script to track scroll and send to parent
    const injectedCode = `
<base href="${baseHref}">
<script>
(function(){
  function send(){
    window.parent.postMessage({
      type:'webreview-scroll',
      scrollY: window.scrollY||0,
      scrollX: window.scrollX||0,
      pageHeight: document.documentElement.scrollHeight||document.body.scrollHeight||0,
      viewportHeight: window.innerHeight||0,
      viewportWidth: window.innerWidth||0,
    },'*');
  }
  window.addEventListener('scroll',send,{passive:true});
  window.addEventListener('resize',send,{passive:true});
  window.addEventListener('load',send);
  setInterval(send,200);
  send();
})();
</script>`;

    // Inject into <head> or at the start of the document
    if (html.includes("</head>")) {
      html = html.replace("</head>", injectedCode + "</head>");
    } else if (html.includes("<head>")) {
      html = html.replace("<head>", "<head>" + injectedCode);
    } else if (html.includes("<html")) {
      html = html.replace(/<html[^>]*>/, (match) => match + "<head>" + injectedCode + "</head>");
    } else {
      html = injectedCode + html;
    }

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch the target URL" },
      { status: 502 }
    );
  }
}
