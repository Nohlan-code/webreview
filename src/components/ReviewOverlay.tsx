"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import CommentPin from "./CommentPin";
import CommentForm from "./CommentForm";
import CommentSidebar from "./CommentSidebar";

interface Comment {
  id: string;
  content: string;
  author: string;
  resolved: boolean;
  createdAt: string;
  xPercent: number;
  yPercent: number;
  pagePath: string;
  replies: {
    id: string;
    content: string;
    author: string;
    createdAt: string;
  }[];
}

interface ReviewOverlayProps {
  slug: string;
  siteUrl: string;
  projectName: string;
  mode?: "admin" | "reviewer" | "dev";
}

const SIDEBAR_WIDTH = 380;

export default function ReviewOverlay({
  slug,
  siteUrl,
  projectName,
  mode = "reviewer",
}: ReviewOverlayProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isCommenting, setIsCommenting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clickPos, setClickPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [currentPagePath, setCurrentPagePath] = useState("/");

  // Iframe src approach - load proxy URL directly for full JS fidelity
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [siteLoading, setSiteLoading] = useState(true);
  const [siteError, setSiteError] = useState<string | null>(null);

  // Container size for scale calculation
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const scrollOffsetRef = useRef(0);
  const pageHeightRef = useRef(800);
  const [pageHeight, setPageHeight] = useState(800);
  const rafRef = useRef<number>(0);

  // Dev mode: can view comments & reply, but cannot add new pins
  const canAddComments = mode !== "dev";

  // Filter comments for the current page only
  const pageComments = comments.filter(
    (c) => c.pagePath === currentPagePath
  );

  // No scale - site always renders at full viewport width
  // Sidebar overlays on top (like Frame.io)
  const scale = 1;
  const scaleRef = useRef(1);

  // Track container size with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerSize({
        w: Math.round(entry.contentRect.width),
        h: Math.round(entry.contentRect.height),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Set proxy URL on mount (src approach - browser loads page natively for full JS fidelity)
  useEffect(() => {
    setSiteLoading(true);
    setSiteError(null);
    setProxyUrl(`/api/proxy?url=${encodeURIComponent(siteUrl)}`);
  }, [siteUrl]);

  // Listen for page change + navigation messages from the iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "webreview-page") {
        const newPath = e.data.pagePath || "/";
        setCurrentPagePath(newPath);
        setClickPos(null);
        setActiveCommentId(null);
      }
      // Handle internal navigation: update iframe src with new URL
      if (e.data?.type === "webreview-navigate" && e.data.url) {
        setSiteLoading(true);
        setProxyUrl(`/api/proxy?url=${encodeURIComponent(e.data.url)}`);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Direct scroll tracking via requestAnimationFrame
  // Updates CSS custom property directly - NO React re-renders during scroll
  useEffect(() => {
    if (!proxyUrl) return;

    const trackScroll = () => {
      try {
        const iframe = iframeRef.current;
        if (iframe?.contentWindow && iframe?.contentDocument) {
          const sy = iframe.contentWindow.scrollY || 0;
          scrollOffsetRef.current = sy;
          const ph = iframe.contentDocument.documentElement.scrollHeight;
          if (ph > 0) pageHeightRef.current = ph;
          if (overlayRef.current) {
            overlayRef.current.style.setProperty("--wr-scroll", String(sy));
          }
        }
      } catch {
        // ignore
      }
      rafRef.current = requestAnimationFrame(trackScroll);
    };

    const iframe = iframeRef.current;
    const startTracking = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(trackScroll);
    };

    if (iframe) {
      iframe.addEventListener("load", startTracking);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (iframe) iframe.removeEventListener("load", startTracking);
    };
  }, [proxyUrl]);

  // Sync pageHeightRef to state periodically (for pin rendering)
  useEffect(() => {
    const interval = setInterval(() => {
      if (pageHeightRef.current !== pageHeight) {
        setPageHeight(pageHeightRef.current);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [pageHeight]);

  // Keyboard shortcuts: Escape = cancel comment mode, C = toggle comment mode
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't capture when typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape") {
        if (clickPos) {
          setClickPos(null);
        } else if (isCommenting) {
          setIsCommenting(false);
        }
      }
      if (e.key === "c" || e.key === "C") {
        if (canAddComments && !e.metaKey && !e.ctrlKey) {
          setIsCommenting((prev) => !prev);
          setClickPos(null);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [clickPos, isCommenting, canAddComments]);

  // Forward wheel events from the container to the iframe content
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      e.preventDefault();
      iframe.contentWindow.scrollBy({
        top: e.deltaY,
        left: e.deltaX,
        behavior: "instant",
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?slug=${slug}`);
      if (res.ok) {
        setComments(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchComments();
    const interval = setInterval(fetchComments, 5000);
    return () => clearInterval(interval);
  }, [fetchComments]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCommenting || !overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    // Direct coordinates - no scale adjustment needed
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const viewportYPx = e.clientY - rect.top;
    const absoluteYPx = viewportYPx + scrollOffsetRef.current;
    setClickPos({ x: xPercent, y: absoluteYPx });
    setActiveCommentId(null);
  };

  const handleSubmitComment = async (data: {
    content: string;
    author: string;
  }) => {
    if (!clickPos || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const pageH = pageHeightRef.current;
      const yPercent = (clickPos.y / pageH) * 100;
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          slug,
          xPercent: clickPos.x,
          yPercent,
          pagePath: currentPagePath,
        }),
      });

      if (res.ok) {
        setClickPos(null);
        setIsCommenting(false);
        await fetchComments();
      }
    } catch {
      // handle error
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async (id: string, resolved: boolean) => {
    try {
      await fetch(`/api/comments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved }),
      });
      fetchComments();
    } catch {
      // handle error
    }
  };

  const handleReply = async (
    parentId: string,
    content: string,
    author: string
  ) => {
    const parent = comments.find((c) => c.id === parentId);
    if (!parent) return;

    try {
      await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          author,
          slug,
          xPercent: parent.xPercent,
          yPercent: parent.yPercent,
          parentId,
          pagePath: parent.pagePath,
        }),
      });
      fetchComments();
    } catch {
      // handle error
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/comments/${id}`, { method: "DELETE" });
      fetchComments();
    } catch {
      // handle error
    }
  };

  const handleCommentClick = (id: string) => {
    const isDeselecting = id === activeCommentId;
    setActiveCommentId(isDeselecting ? null : id);
    setSidebarOpen(true);

    // Scroll iframe to the comment position
    if (!isDeselecting) {
      const comment = comments.find((c) => c.id === id);
      if (comment && iframeRef.current?.contentWindow) {
        const targetY = (comment.yPercent / 100) * pageHeightRef.current;
        const viewportH = containerSize.h / scaleRef.current;
        // Scroll so pin is ~1/3 from top of viewport
        const scrollTo = Math.max(0, targetY - viewportH / 3);
        iframeRef.current.contentWindow.scrollTo({
          top: scrollTo,
          behavior: "smooth",
        });
      }
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="h-14 bg-gray-900 flex items-center justify-between px-4 flex-shrink-0 z-50">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg text-white">
            Web<span className="text-orange-400">Review</span>
          </span>
          <span className="text-gray-600">|</span>
          <span className="text-sm text-gray-300 truncate max-w-xs">
            {projectName}
          </span>
          {currentPagePath !== "/" && (
            <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full font-mono">
              {currentPagePath}
            </span>
          )}
          {mode === "dev" && (
            <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-medium">
              Mode Dev
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Open original site */}
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-2 rounded-lg text-sm transition-colors"
            title="Ouvrir le site original"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>

          {/* Comment mode toggle */}
          {canAddComments && (
            <button
              onClick={() => {
                setIsCommenting(!isCommenting);
                setClickPos(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isCommenting
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                  : "bg-gray-700 text-gray-200 hover:bg-gray-600"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              {isCommenting ? "Mode commentaire actif" : "Ajouter commentaire"}
            </button>
          )}

          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="relative bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            {pageComments.filter((c) => !c.resolved).length > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {pageComments.filter((c) => !c.resolved).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main area - site full width, sidebar overlays on top */}
      <div className="flex-1 relative overflow-hidden">
        {/* Site container - always full width */}
        <div className="absolute inset-0" ref={containerRef}>
          {/* Full-size wrapper - no scale, no transform */}
          {containerSize.w > 0 && (
            <div
              style={{
                width: `${containerSize.w}px`,
                height: `${containerSize.h}px`,
                position: "absolute",
                top: 0,
                left: 0,
              }}
            >
              {/* iframe - src approach for full JS fidelity */}
              {proxyUrl && (
                <iframe
                  ref={iframeRef}
                  src={proxyUrl}
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                  className="w-full h-full border-none"
                  title={projectName}
                  onLoad={() => {
                    setSiteLoading(false);
                    // Check if proxy returned an error page
                    try {
                      const doc = iframeRef.current?.contentDocument;
                      if (doc) {
                        const text = doc.body?.textContent || "";
                        if (text.includes("Impossible de charger le site")) {
                          const match = text.match(/(Ce site.*?\.)/);
                          setSiteError(match?.[1] || "Le site bloque les requetes du serveur.");
                        }
                      }
                    } catch {
                      // Cross-origin error - ignore
                    }
                  }}
                />
              )}

              {/* Overlay for clicking and pins */}
              <div
                ref={overlayRef}
                className={`absolute inset-0 overflow-hidden ${
                  isCommenting ? "cursor-crosshair" : "pointer-events-none"
                }`}
                onClick={handleOverlayClick}
                style={{ "--wr-scroll": "0" } as React.CSSProperties}
              >
                {/* Pins container - CSS transform handles scroll */}
                <div
                  className="absolute inset-x-0 top-0 pointer-events-none"
                  style={{
                    height: `${pageHeight}px`,
                    transform:
                      "translateY(calc(-1px * var(--wr-scroll, 0)))",
                    willChange: "transform",
                  }}
                >
                  {/* Pins for current page */}
                  {pageComments.map((comment, index) => {
                    const absoluteYPx =
                      (comment.yPercent / 100) * pageHeight;
                    return (
                      <CommentPin
                        key={comment.id}
                        number={index + 1}
                        xPercent={comment.xPercent}
                        yPx={absoluteYPx}
                        resolved={comment.resolved}
                        isActive={activeCommentId === comment.id}
                        onClick={() => handleCommentClick(comment.id)}
                      />
                    );
                  })}

                  {/* New comment placement */}
                  {clickPos && (
                    <>
                      <div
                        className="absolute w-3 h-3 bg-orange-500 rounded-full z-30 -ml-1.5 -mt-1.5 animate-pulse"
                        style={{
                          left: `${clickPos.x}%`,
                          top: `${clickPos.y}px`,
                        }}
                      />
                      <CommentForm
                        xPercent={clickPos.x}
                        yPx={clickPos.y}
                        onSubmit={handleSubmitComment}
                        onCancel={() => setClickPos(null)}
                        isSubmitting={isSubmitting}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* These are in container coordinates (not scaled) */}


          {/* Commenting mode banner */}
          {isCommenting && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-xl z-30 flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              Cliquez pour commenter
              <span className="text-gray-400 text-xs ml-1">(Echap pour annuler)</span>
            </div>
          )}

          {/* Site loading spinner */}
          {siteLoading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-30 pointer-events-none">
              <div className="bg-white rounded-xl shadow-lg px-6 py-4 flex items-center gap-3">
                <div className="w-5 h-5 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-600">
                  Chargement du site...
                </span>
              </div>
            </div>
          )}

          {/* Site error */}
          {siteError && (
            <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-30">
              <div className="bg-white rounded-xl shadow-lg px-8 py-6 max-w-md text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-6 h-6 text-red-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Impossible de charger le site
                </h3>
                <p className="text-sm text-gray-500 mb-4">{siteError}</p>
                <button
                  onClick={() => {
                    setSiteError(null);
                    setSiteLoading(true);
                    // Force reload by appending cache-bust param
                    setProxyUrl(`/api/proxy?url=${encodeURIComponent(siteUrl)}&_t=${Date.now()}`);
                  }}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Reessayer
                </button>
              </div>
            </div>
          )}

          {/* Comments loading */}
          {loading && !siteLoading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-30 pointer-events-none">
              <div className="bg-white rounded-xl shadow-lg px-6 py-4 flex items-center gap-3">
                <div className="w-5 h-5 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-600">Chargement...</span>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - overlay on the right, doesn't affect site layout */}
        {sidebarOpen && (
          <div
            className="absolute top-0 right-0 h-full z-40 shadow-2xl bg-white"
            style={{ width: SIDEBAR_WIDTH }}
          >
            <CommentSidebar
              comments={pageComments}
              activeCommentId={activeCommentId}
              onCommentClick={handleCommentClick}
              onResolve={handleResolve}
              onReply={handleReply}
              onDelete={handleDelete}
              isOpen={sidebarOpen}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
              mode={mode}
            />
          </div>
        )}
      </div>
    </div>
  );
}
