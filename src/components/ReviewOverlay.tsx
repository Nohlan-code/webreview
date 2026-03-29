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
  mode?: "admin" | "reviewer";
}

export default function ReviewOverlay({
  slug,
  siteUrl,
  projectName,
  mode = "reviewer",
}: ReviewOverlayProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isCommenting, setIsCommenting] = useState(false);
  const [clickPos, setClickPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Track scroll offset when in commenting mode
  const scrollOffsetRef = useRef(0);
  const [scrollOffset, setScrollOffset] = useState(0);

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
    const interval = setInterval(fetchComments, 30000);
    return () => clearInterval(interval);
  }, [fetchComments]);

  // Reset scroll offset when toggling commenting mode
  useEffect(() => {
    if (isCommenting) {
      scrollOffsetRef.current = 0;
      setScrollOffset(0);
    }
  }, [isCommenting]);

  // Handle wheel events on overlay in commenting mode
  // Forward scroll to iframe and track offset
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const handleWheel = (e: WheelEvent) => {
      if (!isCommenting) return;
      e.preventDefault();

      // Track offset
      scrollOffsetRef.current += e.deltaY;
      setScrollOffset(scrollOffsetRef.current);

      // Try to forward scroll to iframe (works for same-origin)
      try {
        iframeRef.current?.contentWindow?.scrollBy(0, e.deltaY);
      } catch {
        // Cross-origin: can't forward scroll
      }
    };

    overlay.addEventListener("wheel", handleWheel, { passive: false });
    return () => overlay.removeEventListener("wheel", handleWheel);
  }, [isCommenting]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCommenting || !overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

    setClickPos({ x: xPercent, y: yPercent });
    setActiveCommentId(null);
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

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/comments/${id}`, { method: "DELETE" });
      fetchComments();
    } catch {
      // handle error
    }
  };

  const handleCommentClick = (id: string) => {
    setActiveCommentId(id === activeCommentId ? null : id);
    setSidebarOpen(true);
  };

  return (
    <div className="h-screen flex flex-col" style={{ "--sidebar-width": "380px" } as React.CSSProperties}>
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
        </div>

        <div className="flex items-center gap-3">
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
            {comments.filter((c) => !c.resolved).length > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {comments.filter((c) => !c.resolved).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Iframe + overlay container */}
        <div className="flex-1 relative">
          {/* iframe */}
          <iframe
            ref={iframeRef}
            src={siteUrl}
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title={projectName}
          />

          {/* Overlay for clicking and pins */}
          <div
            ref={overlayRef}
            className={`absolute inset-0 ${
              isCommenting ? "cursor-crosshair" : "pointer-events-none"
            }`}
            onClick={handleOverlayClick}
          >
            {/* Comment pins */}
            {comments.map((comment, index) => (
              <CommentPin
                key={comment.id}
                number={index + 1}
                xPercent={comment.xPercent}
                yPercent={comment.yPercent}
                resolved={comment.resolved}
                isActive={activeCommentId === comment.id}
                onClick={() => handleCommentClick(comment.id)}
              />
            ))}

            {/* New comment placement */}
            {clickPos && (
              <>
                <div
                  className="absolute w-3 h-3 bg-orange-500 rounded-full z-30 -ml-1.5 -mt-1.5 animate-pulse"
                  style={{ left: `${clickPos.x}%`, top: `${clickPos.y}%` }}
                />
                <CommentForm
                  xPercent={clickPos.x}
                  yPercent={clickPos.y}
                  onSubmit={handleSubmitComment}
                  onCancel={() => setClickPos(null)}
                />
              </>
            )}
          </div>

          {/* Commenting mode banner */}
          {isCommenting && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-xl z-30 flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              Cliquez sur la page pour placer un commentaire
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-30 pointer-events-none">
              <div className="bg-white rounded-xl shadow-lg px-6 py-4 flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-600">Chargement...</span>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <CommentSidebar
          comments={comments}
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
    </div>
  );
}
