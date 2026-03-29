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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clickPos, setClickPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(true);
  const [screenshotError, setScreenshotError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Fetch screenshot directly from Microlink (client-side, avoids Vercel timeout)
  useEffect(() => {
    const fetchScreenshot = async () => {
      setScreenshotLoading(true);
      setScreenshotError(false);
      setImageLoaded(false);
      try {
        const microlinkUrl = `https://api.microlink.io/?url=${encodeURIComponent(
          siteUrl
        )}&screenshot=true&fullPage=true&meta=false&viewport.width=1280&viewport.height=800`;

        const res = await fetch(microlinkUrl);
        const data = await res.json();

        if (data.status === "success" && data.data?.screenshot?.url) {
          setScreenshotUrl(data.data.screenshot.url);
        } else {
          setScreenshotError(true);
        }
      } catch {
        setScreenshotError(true);
      } finally {
        setScreenshotLoading(false);
      }
    };
    fetchScreenshot();
  }, [siteUrl]);

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

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCommenting || !overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const overlayWidth = overlayRef.current.offsetWidth;
    const overlayHeight = overlayRef.current.offsetHeight;

    // Position relative to the full image (scroll is already accounted for by getBoundingClientRect)
    const xPercent = ((e.clientX - rect.left) / overlayWidth) * 100;
    const yPercent = ((e.clientY - rect.top) / overlayHeight) * 100;

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

  const refreshScreenshot = () => {
    setScreenshotUrl(null);
    setImageLoaded(false);
    setScreenshotLoading(true);
    setScreenshotError(false);

    const fetchAgain = async () => {
      try {
        const microlinkUrl = `https://api.microlink.io/?url=${encodeURIComponent(
          siteUrl
        )}&screenshot=true&fullPage=true&meta=false&viewport.width=1280&viewport.height=800&force=true`;

        const res = await fetch(microlinkUrl);
        const data = await res.json();

        if (data.status === "success" && data.data?.screenshot?.url) {
          setScreenshotUrl(data.data.screenshot.url);
        } else {
          setScreenshotError(true);
        }
      } catch {
        setScreenshotError(true);
      } finally {
        setScreenshotLoading(false);
      }
    };
    fetchAgain();
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
        </div>

        <div className="flex items-center gap-3">
          {/* Refresh screenshot */}
          <button
            onClick={refreshScreenshot}
            disabled={screenshotLoading}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 px-3 py-2 rounded-lg text-sm transition-colors"
            title="Rafraichir la capture"
          >
            <svg
              className={`w-4 h-4 ${screenshotLoading ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

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

          {/* Comment mode toggle */}
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
        {/* Screenshot + overlay container (scrollable) */}
        <div
          className={`flex-1 overflow-auto bg-gray-100 ${
            isCommenting ? "cursor-crosshair" : ""
          }`}
        >
          {screenshotLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500 text-sm font-medium">
                  Capture du site en cours...
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  Cela peut prendre quelques secondes
                </p>
              </div>
            </div>
          ) : screenshotError ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-sm">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-gray-600 font-medium mb-2">
                  Impossible de capturer le site
                </p>
                <p className="text-gray-400 text-sm mb-4">
                  Le site est peut-etre protege ou temporairement indisponible
                </p>
                <button
                  onClick={refreshScreenshot}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  Reessayer
                </button>
              </div>
            </div>
          ) : (
            <div className="relative inline-block min-w-full">
              {/* Screenshot image */}
              {screenshotUrl && (
                <img
                  src={screenshotUrl}
                  alt={`Capture de ${projectName}`}
                  className="w-full block"
                  draggable={false}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => {
                    setScreenshotError(true);
                    setScreenshotUrl(null);
                  }}
                />
              )}

              {/* Image loading spinner */}
              {screenshotUrl && !imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="text-center">
                    <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">Chargement de l&apos;image...</p>
                  </div>
                </div>
              )}

              {/* Overlay for pins and click capture */}
              {imageLoaded && (
                <div
                  ref={overlayRef}
                  className="absolute inset-0"
                  onClick={handleOverlayClick}
                  style={{
                    pointerEvents: isCommenting ? "auto" : "none",
                  }}
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
                        style={{
                          left: `${clickPos.x}%`,
                          top: `${clickPos.y}%`,
                        }}
                      />
                      <CommentForm
                        xPercent={clickPos.x}
                        yPercent={clickPos.y}
                        onSubmit={handleSubmitComment}
                        onCancel={() => setClickPos(null)}
                        isSubmitting={isSubmitting}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Commenting mode banner */}
          {isCommenting && imageLoaded && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-xl z-30 flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              Cliquez sur la page pour placer un commentaire
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
