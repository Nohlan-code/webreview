import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// Retry fetch with exponential backoff for 429/503
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);

      // If rate-limited or temporarily unavailable, retry with backoff
      if ((res.status === 429 || res.status === 503) && attempt < maxRetries) {
        const retryAfter = res.headers.get("retry-after");
        const waitMs = retryAfter
          ? Math.min(parseInt(retryAfter, 10) * 1000, 5000)
          : Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, attempt))
        );
        continue;
      }
    }
  }

  throw lastError || new Error("Fetch failed after retries");
}

export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 }
    );
  }

  try {
    const parsedTarget = new URL(targetUrl);
    const origin = parsedTarget.origin;

    // Use a realistic browser User-Agent and full headers to avoid bot detection
    const ua =
      request.headers.get("user-agent") ||
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    const res = await fetchWithRetry(targetUrl, {
      headers: {
        "User-Agent": ua,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language":
          request.headers.get("accept-language") ||
          "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "Sec-CH-UA":
          '"Chromium";v="131", "Google Chrome";v="131", "Not_A Brand";v="24"',
        "Sec-CH-UA-Mobile": "?0",
        "Sec-CH-UA-Platform": '"macOS"',
      },
      redirect: "follow",
    });

    // If still getting an error after retries, return a friendly error
    if (!res.ok) {
      // Detect Vercel Attack Challenge Mode specifically
      const isVercelChallenge = res.headers.get("x-vercel-mitigated") === "challenge";

      let msg: string;
      if (isVercelChallenge) {
        msg = "Ce site a le mode \"Attack Challenge\" active sur Vercel, ce qui bloque le chargement. Pour corriger : allez dans les parametres Vercel du site cible → Firewall → desactivez Attack Challenge Mode.";
      } else {
        const statusMessages: Record<number, string> = {
          403: "Le site bloque l'acces depuis notre serveur (protection anti-bot). Si c'est votre site, ajoutez une exception pour les requetes serveur.",
          429: "Le site limite le nombre de requetes. Si c'est un site Vercel, verifiez que le mode Attack Challenge n'est pas active.",
          500: "Le site cible rencontre une erreur interne.",
          502: "Le site cible est temporairement inaccessible.",
          503: "Le site cible est en maintenance. Reessayez dans quelques instants.",
        };
        msg =
          statusMessages[res.status] ||
          `Le site a repondu avec l'erreur ${res.status}.`;
      }

      return new NextResponse(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
          body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#555;background:#fafafa;}
          .card{text-align:center;max-width:420px;padding:40px;background:white;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.08);}
          .icon{width:48px;height:48px;margin:0 auto 16px;background:#fff3e0;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;}
          h2{font-size:1.1em;margin:0 0 8px;color:#333;}
          p{font-size:0.9em;margin:0 0 16px;line-height:1.5;color:#888;}
          .code{font-size:0.75em;color:#bbb;font-family:monospace;}
        </style></head><body>
          <div class="card">
            <div class="icon">⚠️</div>
            <h2>Impossible de charger le site</h2>
            <p>${msg}</p>
            <p class="code">HTTP ${res.status} - ${origin}</p>
          </div>
        </body></html>`,
        {
          status: 200, // Return 200 so iframe displays our error page, not browser error
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache",
          },
        }
      );
    }

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
    // STRATEGY: Keep the site functional (carousels, animations, etc.)
    // Only strip framework hydration scripts that cause errors.
    // Keep third-party libs (Swiper, Slick, GSAP, etc.) + inline init scripts.
    // ============================================================

    // 1. Remove ONLY framework hydration/build scripts (Next.js, Nuxt, Gatsby, etc.)
    //    These cause errors when loaded in srcDoc context.
    const frameworkPatterns = [
      // Next.js
      /_next\//i,
      /__next/i,
      /next\/dist/i,
      /next-route-announcer/i,
      // Nuxt
      /_nuxt\//i,
      /__nuxt/i,
      // Gatsby
      /gatsby-/i,
      // Webpack/Vite chunk loaders
      /webpackJsonp/i,
      /webpack-/i,
      // React hydration
      /__NEXT_DATA__/i,
      /__NUXT__/i,
      // Vercel analytics/speed-insights (not needed in review)
      /vercel\/analytics/i,
      /vercel\/speed-insights/i,
      /@vercel\//i,
      /va\.vercel-scripts/i,
      /vitals\.vercel-insights/i,
    ];

    // Helper: check if a script tag matches a framework pattern
    const isFrameworkScript = (scriptTag: string): boolean => {
      return frameworkPatterns.some((pattern) => pattern.test(scriptTag));
    };

    // Remove framework scripts (both <script>...</script> and self-closing <script />)
    html = html.replace(
      /<script(?![^>]*data-webreview)[^>]*>[\s\S]*?<\/script>/gi,
      (match) => isFrameworkScript(match) ? "" : match
    );
    html = html.replace(
      /<script(?![^>]*data-webreview)[^>]*\/>/gi,
      (match) => isFrameworkScript(match) ? "" : match
    );

    // Also remove the __NEXT_DATA__ JSON script specifically (inline data)
    html = html.replace(
      /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>[\s\S]*?<\/script>/gi,
      ""
    );

    // 2. Wrap remaining third-party scripts in error protection
    //    so one broken script doesn't kill the whole page
    const errorWrapper = `<script data-webreview="true">
window.addEventListener('error', function(e) { e.stopPropagation(); }, true);
window.addEventListener('unhandledrejection', function(e) { e.preventDefault(); }, true);
</script>`;
    if (html.match(/<head[^>]*>/i)) {
      html = html.replace(/<head[^>]*>/i, `$&${errorWrapper}`);
    } else {
      html = errorWrapper + html;
    }

    // 3. Remove meta CSP that blocks framing
    html = html.replace(
      /<meta[^>]*http-equiv=["']content-security-policy["'][^>]*>/gi,
      ""
    );

    // 4. Remove noscript tags (they show fallback content meant for no-JS)
    html = html.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");

    // 5. Rewrite all root-relative URLs in HTML attributes to absolute
    html = html.replace(
      /(\s(?:src|href|action|poster|data-src|data-srcset|content)=["'])\/(?!\/)/gi,
      `$1${origin}/`
    );
    // Handle srcset
    html = html.replace(
      /(\ssrcset=["'])\/(?!\/)/gi,
      `$1${origin}/`
    );
    // Handle CSS url() with root-relative paths in inline styles
    html = html.replace(/(url\(["']?)\/(?!\/)/gi, `$1${origin}/`);

    // 6. Fix styles for review mode
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

    // 7. Inject our scroll tracking script (runs in the page)
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
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // Cache the proxied HTML for 5 minutes to avoid hitting rate limits
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue";
    return new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#555;background:#fafafa;}
        .card{text-align:center;max-width:420px;padding:40px;background:white;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.08);}
        .icon{width:48px;height:48px;margin:0 auto 16px;background:#fde8e8;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;}
        h2{font-size:1.1em;margin:0 0 8px;color:#333;}
        p{font-size:0.9em;margin:0;line-height:1.5;color:#888;}
      </style></head><body>
        <div class="card">
          <div class="icon">❌</div>
          <h2>Impossible de charger le site</h2>
          <p>${message}</p>
        </div>
      </body></html>`,
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
}
