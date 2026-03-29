import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge"; // Faster + no 10s timeout

export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    const parsedTarget = new URL(targetUrl);

    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          request.headers.get("user-agent") ||
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          request.headers.get("accept") ||
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": request.headers.get("accept-language") || "fr-FR,fr;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });

    const contentType = res.headers.get("content-type") || "text/html";

    // Only process HTML responses
    if (!contentType.includes("text/html")) {
      const body = await res.arrayBuffer();
      return new NextResponse(body, {
        status: res.status,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    let html = await res.text();
    const origin = parsedTarget.origin;
    const proxyBase = "/api/proxy?url=";

    // Add <base> tag so all relative URLs resolve to the target site
    const baseTag = `<base href="${origin}/">`;
    if (html.match(/<head[^>]*>/i)) {
      html = html.replace(/<head[^>]*>/i, (match) => `${match}${baseTag}`);
    } else {
      html = baseTag + html;
    }

    // Inject scroll tracking + link interception script
    const injectedScript = `
<script data-webreview="true">
(function() {
  // --- Scroll tracking ---
  if (window.self !== window.top) {
    var lastY = -1;
    (function loop() {
      if (window.scrollY !== lastY) {
        lastY = window.scrollY;
        try {
          window.parent.postMessage({
            type: "webreview-scroll",
            scrollY: window.scrollY,
            scrollX: window.scrollX,
            pageHeight: document.documentElement.scrollHeight
          }, "*");
        } catch(e) {}
      }
      requestAnimationFrame(loop);
    })();
  }

  // --- Route internal links through proxy ---
  var ORIGIN = ${JSON.stringify(origin)};
  var PROXY = ${JSON.stringify(proxyBase)};

  function shouldProxy(href) {
    if (!href) return false;
    if (href.startsWith("javascript:") || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;
    try {
      var u = new URL(href, window.location.href);
      // Proxy same-origin links (the target site's origin, resolved via <base>)
      return u.origin === ORIGIN;
    } catch(e) { return false; }
  }

  function proxyHref(href) {
    try {
      var u = new URL(href, ORIGIN + "/");
      return PROXY + encodeURIComponent(u.href);
    } catch(e) { return href; }
  }

  // Intercept clicks
  document.addEventListener("click", function(e) {
    var link = e.target.closest("a");
    if (link && shouldProxy(link.getAttribute("href"))) {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = proxyHref(link.href);
    }
  }, true);

  // Intercept form submissions
  document.addEventListener("submit", function(e) {
    var form = e.target;
    if (form.action && shouldProxy(form.action)) {
      e.preventDefault();
      // For GET forms, build proxy URL with query params
      if (!form.method || form.method.toLowerCase() === "get") {
        var fd = new FormData(form);
        var url = new URL(form.action);
        fd.forEach(function(v, k) { url.searchParams.set(k, v); });
        window.location.href = proxyHref(url.href);
      }
    }
  }, true);

  // Intercept pushState/replaceState for SPAs
  var origPush = history.pushState;
  var origReplace = history.replaceState;
  history.pushState = function(state, title, url) {
    if (url && shouldProxy(url)) {
      origPush.call(history, state, title, proxyHref(url));
    } else {
      origPush.call(history, state, title, url);
    }
  };
  history.replaceState = function(state, title, url) {
    if (url && shouldProxy(url)) {
      origReplace.call(history, state, title, proxyHref(url));
    } else {
      origReplace.call(history, state, title, url);
    }
  };
})();
</script>`;

    // Inject before </body> or at end of HTML
    if (html.match(/<\/body>/i)) {
      html = html.replace(/<\/body>/i, injectedScript + "</body>");
    } else {
      html += injectedScript;
    }

    return new NextResponse(html, {
      status: res.status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // Explicitly NO X-Frame-Options or CSP frame-ancestors
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(
      `<html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#666;">
        <div style="text-align:center;">
          <p style="font-size:1.2em;margin-bottom:0.5em;">Impossible de charger le site</p>
          <p style="font-size:0.9em;color:#999;">${message}</p>
        </div>
      </body></html>`,
      {
        status: 502,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
}
