import { NextResponse } from "next/server";

export async function GET() {
  const js = `
(function() {
  if (window.self === window.top) return; // Only run inside iframe
  var lastY = -1;
  function send() {
    if (window.scrollY !== lastY) {
      lastY = window.scrollY;
      window.parent.postMessage({
        type: "webreview-scroll",
        scrollY: window.scrollY,
        scrollX: window.scrollX,
        pageHeight: document.documentElement.scrollHeight
      }, "*");
    }
    requestAnimationFrame(send);
  }
  send();
})();
`.trim();

  return new NextResponse(js, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
