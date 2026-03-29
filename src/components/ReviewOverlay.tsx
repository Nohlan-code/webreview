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
}

export default function ReviewOverlay({
  slug,
  siteUrl,
  projectName,
}: ReviewOverlayProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isCommenting, setIsCommenting] = useState(false);
  const [clickPos, setClickPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Scroll tracking from iframe postMessage
  const [iframeScroll, setIframeScroll] = useState({
    scrollY: 0,
    scrollX: 0,
    viewportHeight: 1,
    viewportWidth: 1,
    pageHeight: 1,
  });

  // Proxy URL for iframe (same-origin, allows scroll tracking)
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(siteUrl)}`;

  // Listen for scroll messages from the proxied iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "webreview-scroll") {
        setIframeScroll({
          scrollY: e.data.scrollY || 0,
          scrollX: e.data.scrollX || 0,
          viewportHeight: e.data.viewportHeight || 1,
          viewportWidth: e.data.viewportWidth || 1,
          pageHeight: e.data.pageHeight || 1,
        });
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?slug=${slug}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchComments();
    const interval = setInterval(fetchComments, 30000);
    return () => clearInterval(interval);
  }, [fetchComments]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCommenting || !overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const xViewport = ((e.clientX - rect.left) / rect.width) * 100;
    const yViewport = ((e.clientY - rect.top) / rect.height) * 100;

    // Convert viewport-relative position to absolute page position
    // yAbsolute = viewport% + (scrollY / viewportHeight) * 100
    const yAbsolute =
      yViewport +
      (iframeScroll.scrollY / iframeScroll.viewportHeight) * 100;
    const xAbsolute =
      xViewport +
      (iframeScroll.scrollX / iframeScroll.viewportWidth) * 100;

    setClickPos({ x: xAbsolute, y: yAbsolute });
    setActiveCommentId(null);
  };

  // Convert absolute page position to current viewport position
  const toViewportY = (yAbsolute: number) => {
    return (
      yAbsolute -
      (iframeScroll.scrollY / iframeScroll.viewportHeight) * 100
    );
  };

  const toViewportX = (xAbsolute: number) => {
    return (
      xAbsolute -
      (iframeScroll.scrollX / iframeScroll.viewportWidth) * 100
    );
  };

  const handleSubmitComment = async (data: {
    content: string;
    author: string;
  }) => {
    if (!clickPos) return;

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          slug,
          xPercent: clickPos.x,
          yPercent: clickPos.y,
          pagePath: "/",
        }),
      });

      if (res.ok) {
        setClickPos(null);
        setIsCommenting(false);
        fetchComments();
      }
    } catch {
      // handle error
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
          pagePath: "/",
        }),
      });
      fetchComments();
    } catch {
      // handle error
    }
  };

  const handleCommentClick = (id: string) => {
    setActiveCommentId(id === activeCommentId ? null : id);
    setSidebarOpen(true);
  };

  // Forward wheel events to iframe when in commenting mode
  // (overlay blocks scroll, so we manually forward it)
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const handleWheel = (e: WheelEvent) => {
      if (!isCommenting) return;
      e.preventDefault();
      try {
        iframeRef.current?.contentWindow?.scrollBy(0, e.deltaY);
      } catch {
        // cross-origin fallback: ignore
      }
    };

    overlay.addEventListener("wheel", handleWheel, { passive: false });
    return () => overlay.removeEventListener("wheel", handleWheel);
  }, [isCommenting]);

  // Check if a pin is within the visible viewport
  const isPinVisible = (yAbsolute: number) => {
    const viewY = toViewportY(yAbsolute);
    return viewY >= -5 && viewY <= 105;
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0 z-50">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg">
            Web<span className="text-orange-500">Review</span>
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-600 truncate max-w-xs">
            {projectName}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsCommenting(!isCommenting);
              setClickPos(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isCommenting
                ? "bg-orange-500 text-white shadow-lg shadow-orange-200"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="relative bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm transition-colors"
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
            {comments.filter((c) => !c.resolved).length > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {comments.filter((c) => !c.resolved).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 relative overflow-hidden">
        {/* iframe loaded via proxy for scroll tracking */}
        <iframe
          ref={iframeRef}
          src={proxyUrl}
          className="w-full h-full border-none"
          style={{
            marginRight: sidebarOpen ? "var(--sidebar-width)" : 0,
            width: sidebarOpen
              ? "calc(100% - var(--sidebar-width))"
              : "100%",
            transition: "width 0.3s, margin-right 0.3s",
          }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title={projectName}
        />

        {/* Overlay for clicking and displaying pins */}
        <div
          ref={overlayRef}
          className={`absolute inset-0 ${
            isCommenting ? "cursor-crosshair" : "pointer-events-none"
          }`}
          style={{
            right: sidebarOpen ? "var(--sidebar-width)" : 0,
            transition: "right 0.3s",
          }}
          onClick={handleOverlayClick}
        >
          {/* Comment pins - positioned relative to current viewport */}
          {comments.map((comment, index) => {
            if (!isPinVisible(comment.yPercent)) return null;
            return (
              <CommentPin
                key={comment.id}
                number={index + 1}
                xPercent={toViewportX(comment.xPercent)}
                yPercent={toViewportY(comment.yPercent)}
                resolved={comment.resolved}
                isActive={activeCommentId === comment.id}
                onClick={() => handleCommentClick(comment.id)}
              />
            );
          })}

          {/* New comment form */}
          {clickPos && (
            <>
              <div
                className="absolute w-3 h-3 bg-orange-500 rounded-full z-30 -ml-1.5 -mt-1.5 animate-pulse"
                style={{
                  left: `${toViewportX(clickPos.x)}%`,
                  top: `${toViewportY(clickPos.y)}%`,
                }}
              />
              <CommentForm
                xPercent={toViewportX(clickPos.x)}
                yPercent={toViewportY(clickPos.y)}
                onSubmit={handleSubmitComment}
                onCancel={() => setClickPos(null)}
              />
            </>
          )}
        </div>

        {/* Commenting mode indicator */}
        {isCommenting && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-bounce z-30">
            Cliquez sur le site pour ajouter un commentaire
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-30 pointer-events-none">
            <div className="bg-white rounded-xl shadow-lg px-6 py-4 flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-600">
                Chargement...
              </span>
            </div>
          </div>
        )}

        {/* Sidebar */}
        <CommentSidebar
          comments={comments}
          activeCommentId={activeCommentId}
          onCommentClick={handleCommentClick}
          onResolve={handleResolve}
          onReply={handleReply}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
      </div>
    </div>
  );
}
