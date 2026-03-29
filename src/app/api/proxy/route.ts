import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    const parsedTarget = new URL(targetUrl);
    const origin = parsedTarget.origin;

    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          request.headers.get("user-agent") ||
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": request.headers.get("accept-language") || "fr-FR,fr;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });

    const contentType = res.headers.get("content-type") || "text/html";

    // Non-HTML: pass through (for CSS, images, fonts, etc.)
    if (!contentType.includes("text/html")) {
      const body = await res.arrayBuffer();
      return new NextResponse(body, {
        status: res.status,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    let html = await res.text();

    // ============================================================
    // STRATEGY: Render site as STATIC HTML for review purposes.
    // Remove all scripts to prevent JS hydration errors.
    // Keep CSS, images, fonts → site looks exactly like the real one.
    // Inject only our scroll tracking + review scripts.
    // ============================================================

    // 1. Remove ALL <script> tags (inline and external) except ours
    //    This prevents any JS hydration errors from the target site
    html = html.replace(/<script(?![^>]*data-webreview)[^>]*>[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<script(?![^>]*data-webreview)[^>]*\/>/gi, "");

    // 2. Remove meta CSP that blocks framing
    html = html.replace(/<meta[^>]*http-equiv=["']content-security-policy["'][^>]*>/gi, "");

    // 3. Remove noscript tags (they show fallback content meant for no-JS)
    html = html.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");

    // 4. Rewrite all root-relative URLs in HTML attributes to absolute
    //    So CSS, images, fonts load from the original site
    html = html.replace(
      /(\s(?:src|href|action|poster|data-src|content)=["'])\/(?!\/)/gi,
      `$1${origin}/`
    );
    // Handle srcset
    html = html.replace(
      /(\ssrcset=["'])\/(?!\/)/gi,
      `$1${origin}/`
    );
    // Handle CSS url() with root-relative paths in inline styles
    html = html.replace(
      /(url\(["']?)\/(?!\/)/gi,
      `$1${origin}/`
    );

    // 5. Fix styles for review mode
    //    - Force instant scroll (no smooth scrolling that causes lag)
    //    - Fix Next.js Image component (shows broken without JS)
    const reviewStyles = `<style data-webreview="true">
      html { scroll-behavior: auto !important; }
      img[loading="lazy"] { loading: eager; }
      img { opacity: 1 !important; }
    </style>`;
    if (html.match(/<head[^>]*>/i)) {
      html = html.replace(/<head[^>]*>/i, `$&${reviewStyles}`);
    } else {
      html = reviewStyles + html;
    }

    // 6. Inject our scroll tracking script (runs in the static page)
    const trackingScript = `
<script data-webreview="true">
(function(){
  if(window.self===window.top)return;

  // --- Report current page path to parent ---
  try{
    window.parent.postMessage({
      type:"webreview-page",
      pagePath:${JSON.stringify(parsedTarget.pathname || "/")},
      url:${JSON.stringify(targetUrl)}
    },"*");
  }catch(e){}

  // --- Scroll tracking ---
  var lastY=-1;
  (function loop(){
    if(window.scrollY!==lastY){
      lastY=window.scrollY;
      try{
        window.parent.postMessage({
          type:"webreview-scroll",
          scrollY:window.scrollY,
          scrollX:window.scrollX,
          pageHeight:document.documentElement.scrollHeight
        },"*");
      }catch(e){}
    }
    requestAnimationFrame(loop);
  })();

  // --- Intercept link clicks to stay in proxy ---
  var O=${JSON.stringify(origin)};
  var P="/api/proxy?url=";
  document.addEventListener("click",function(e){
    var a=e.target.closest("a");
    if(!a)return;
    var h=a.getAttribute("href");
    if(!h||h.startsWith("#")||h.startsWith("javascript:")||h.startsWith("mailto:")||h.startsWith("tel:"))return;
    e.preventDefault();
    e.stopPropagation();
    try{
      var u=new URL(h,O+"/");
      if(u.origin===O){
        window.location.href=P+encodeURIComponent(u.href);
      } else {
        window.open(u.href,"_blank");
      }
    }catch(ex){}
  },true);

  // --- Make all interactive elements look normal (cursor) ---
  document.querySelectorAll("a,button,[role=button]").forEach(function(el){
    el.style.cursor="pointer";
  });
})();
</script>`;

    // Inject before </body> or at end
    if (html.match(/<\/body>/i)) {
      html = html.replace(/<\/body>/i, trackingScript + "</body>");
    } else {
      html += trackingScript;
    }

    return new NextResponse(html, {
      status: res.status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
        // No X-Frame-Options or CSP → allows iframe embedding
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#666;background:#f5f5f5;">
        <div style="text-align:center;max-width:400px;">
          <p style="font-size:1.2em;margin-bottom:0.5em;">Impossible de charger le site</p>
          <p style="font-size:0.9em;color:#999;">${message}</p>
        </div>
      </body></html>`,
      { status: 502, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}
