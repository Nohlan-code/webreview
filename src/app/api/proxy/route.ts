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
        Accept:
          request.headers.get("accept") ||
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": request.headers.get("accept-language") || "fr-FR,fr;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });

    const contentType = res.headers.get("content-type") || "text/html";

    // Non-HTML: pass through as-is (for proxied sub-resources)
    if (!contentType.includes("text/html")) {
      const body = await res.arrayBuffer();
      const headers: Record<string, string> = {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      };
      // Forward content-encoding if present
      const encoding = res.headers.get("content-encoding");
      if (encoding) headers["Content-Encoding"] = encoding;
      return new NextResponse(body, { status: res.status, headers });
    }

    let html = await res.text();

    // Remove any meta CSP that blocks framing
    html = html.replace(/<meta[^>]*http-equiv=["']content-security-policy["'][^>]*>/gi, "");

    // ============================================================
    // 1. Rewrite all root-relative URLs in HTML attributes to absolute
    //    src="/path" → src="https://target/path"
    //    href="/path" → href="https://target/path"
    //    But NOT protocol-relative: src="//cdn.example.com"
    // ============================================================
    html = html.replace(
      /(\s(?:src|href|action|poster|data|content)=["'])\/(?!\/)/gi,
      `$1${origin}/`
    );
    // Handle srcset which can have multiple URLs
    html = html.replace(
      /(\ssrcset=["'])\/(?!\/)/gi,
      `$1${origin}/`
    );

    // ============================================================
    // 2. Inject monkey-patch script AT THE TOP of <head>
    //    This MUST run before any other script to intercept:
    //    - fetch() calls with root-relative URLs
    //    - XMLHttpRequest with root-relative URLs
    //    - Dynamically created <script> src assignments
    //    - Dynamically created <link> href assignments
    // ============================================================
    const proxyBase = "/api/proxy?url=";
    const monkeyPatch = `<script data-webreview-patch="true">
(function(){
  var O="${origin}";
  var P="${proxyBase}";

  // --- Patch fetch ---
  var _f=window.fetch;
  window.fetch=function(u,o){
    if(typeof u==='string'){
      if(u.startsWith('/') && !u.startsWith('//')){
        u=P+encodeURIComponent(O+u);
      }
    } else if(u instanceof Request){
      var ru=u.url;
      try{
        var pu=new URL(ru);
        if(pu.origin===window.location.origin && pu.pathname.startsWith('/')){
          u=new Request(P+encodeURIComponent(O+pu.pathname+pu.search),u);
        }
      }catch(e){}
    }
    return _f.call(this,u,o);
  };

  // --- Patch XMLHttpRequest ---
  var _xo=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){
    if(typeof u==='string' && u.startsWith('/') && !u.startsWith('//')){
      u=P+encodeURIComponent(O+u);
    }
    return _xo.apply(this,arguments);
  };

  // --- Patch dynamic script.src ---
  try{
    var sd=Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype,'src');
    if(sd && sd.set){
      Object.defineProperty(HTMLScriptElement.prototype,'src',{
        set:function(v){
          if(typeof v==='string' && v.startsWith('/') && !v.startsWith('//')){
            v=O+v;
          }
          sd.set.call(this,v);
        },
        get:function(){return sd.get.call(this);}
      });
    }
  }catch(e){}

  // --- Patch dynamic link.href ---
  try{
    var ld=Object.getOwnPropertyDescriptor(HTMLLinkElement.prototype,'href');
    if(ld && ld.set){
      Object.defineProperty(HTMLLinkElement.prototype,'href',{
        set:function(v){
          if(typeof v==='string' && v.startsWith('/') && !v.startsWith('//')){
            v=O+v;
          }
          ld.set.call(this,v);
        },
        get:function(){return ld.get.call(this);}
      });
    }
  }catch(e){}

  // --- Patch dynamic img.src ---
  try{
    var id=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
    if(id && id.set){
      Object.defineProperty(HTMLImageElement.prototype,'src',{
        set:function(v){
          if(typeof v==='string' && v.startsWith('/') && !v.startsWith('//')){
            v=O+v;
          }
          id.set.call(this,v);
        },
        get:function(){return id.get.call(this);}
      });
    }
  }catch(e){}
})();
</script>`;

    // Inject monkey-patch as FIRST thing in <head>
    if (html.match(/<head[^>]*>/i)) {
      html = html.replace(/<head[^>]*>/i, (match) => `${match}${monkeyPatch}`);
    } else {
      html = monkeyPatch + html;
    }

    // ============================================================
    // 3. Inject scroll tracking + link interception before </body>
    // ============================================================
    const trackingScript = `<script data-webreview-track="true">
(function(){
  if(window.self===window.top)return;
  var O="${origin}";
  var P="${proxyBase}";

  // Scroll tracking
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

  // Intercept link clicks to stay in proxy
  document.addEventListener("click",function(e){
    var a=e.target.closest("a");
    if(!a)return;
    var h=a.getAttribute("href");
    if(!h||h.startsWith("#")||h.startsWith("javascript:")||h.startsWith("mailto:")||h.startsWith("tel:"))return;
    try{
      var u=new URL(h,O+"/");
      if(u.origin===O){
        e.preventDefault();
        e.stopPropagation();
        window.location.href=P+encodeURIComponent(u.href);
      }
    }catch(ex){}
  },true);
})();
</script>`;

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
        // No X-Frame-Options, no CSP frame-ancestors
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#666;background:#f5f5f5;">
        <div style="text-align:center;max-width:400px;">
          <p style="font-size:1.2em;margin-bottom:0.5em;">Impossible de charger le site</p>
          <p style="font-size:0.9em;color:#999;">${message}</p>
          <p style="font-size:0.8em;color:#bbb;margin-top:1em;">Le site est peut-etre protege par Cloudflare ou un pare-feu.</p>
        </div>
      </body></html>`,
      {
        status: 502,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
}
