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
  mode?: "admin" | "reviewer" | "dev";
}

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
  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollOffsetRef = useRef(0);
  const [scrollY, setScrollY] = useState(0);
  const rafRef = useRef<number>(0);

  // Dev mode: can view comments & reply, but cannot add new pins
  const canAddComments = mode !== "dev";

  // Helper: convert stored absolute yPercent to viewport-relative display position
  const getDisplayY = (absoluteYPercent: number) => {
    const overlayHeight = overlayRef.current?.clientHeight || 800;
    const absoluteYPx = (absoluteYPercent / 100) * overlayHeight;
    const viewportYPx = absoluteYPx - scrollY;
    return (viewportYPx / overlayHeight) * 100;
  };

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

  // Track iframe scroll via postMessage from injected snippet on target site
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "webreview-scroll") {
        scrollOffsetRef.current = e.data.scrollY || 0;
        // Throttled re-render for pin positions
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          setScrollY(scrollOffsetRef.current);
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCommenting || !overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    // Store absolute position: viewport click position + tracked scroll offset
    const viewportYPx = e.clientY - rect.top;
    const absoluteYPx = viewportYPx + scrollOffsetRef.current;
    const yPercent = (absoluteYPx / rect.height) * 100;

    setClickPos({ x: xPercent, y: yPercent });
    setActiveCommentId(null);
  };

  const handleSubmitComment = async (data: {
    content: string;
    author: string;
  }) => {
    if (!clickPos || isSubmitting) return;

    setIsSubmitting(true);
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
    <div
      className="h-screen flex flex-col"
      style={{ "--sidebar-width": "380px" } as React.CSSProperties}
    >
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
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>

          {/* Comment mode toggle - only for reviewer & admin */}
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
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {isCommenting ? "Mode commentaire actif" : "Ajouter commentaire"}
            </button>
          )}

          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="relative bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
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
        <div className="flex-1 relative" ref={containerRef}>
          {/* iframe - loads the real site */}
          <iframe
            src={`/api/proxy?url=${encodeURIComponent(siteUrl)}`}
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
            {/* Comment pins - positioned relative to tracked scroll */}
            {comments.map((comment, index) => {
              const displayY = getDisplayY(comment.yPercent);
              // Hide pins that are off-screen
              if (displayY < -5 || displayY > 105) return null;
              return (
                <CommentPin
                  key={comment.id}
                  number={index + 1}
                  xPercent={comment.xPercent}
                  yPercent={displayY}
                  resolved={comment.resolved}
                  isActive={activeCommentId === comment.id}
                  onClick={() => handleCommentClick(comment.id)}
                />
              );
            })}

            {/* New comment placement */}
            {clickPos && (() => {
              const displayY = getDisplayY(clickPos.y);
              return (
                <>
                  <div
                    className="absolute w-3 h-3 bg-orange-500 rounded-full z-30 -ml-1.5 -mt-1.5 animate-pulse"
                    style={{ left: `${clickPos.x}%`, top: `${displayY}%` }}
                  />
                  <CommentForm
                    xPercent={clickPos.x}
                    yPercent={displayY}
                    onSubmit={handleSubmitComment}
                    onCancel={() => setClickPos(null)}
                    isSubmitting={isSubmitting}
                  />
                </>
              );
            })()}
          </div>

          {/* Commenting mode banner */}
          {isCommenting && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-xl z-30 flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              Scrollez vers la zone souhaitee, puis cliquez pour commenter
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-30 pointer-events-none">
              <div className="bg-white rounded-xl shadow-lg px-6 py-4 flex items-center gap-3">
                <div className="w-5 h-5 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
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
