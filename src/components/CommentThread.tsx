"use client";

import { useState } from "react";

interface Reply {
  id: string;
  content: string;
  author: string;
  createdAt: string;
}

interface CommentThreadProps {
  comment: {
    id: string;
    content: string;
    author: string;
    resolved: boolean;
    createdAt: string;
    xPercent: number;
    yPercent: number;
    replies: Reply[];
  };
  number: number;
  onResolve: (id: string, resolved: boolean) => void;
  onReply: (parentId: string, content: string, author: string) => void;
  onDelete: (id: string) => void;
  isActive: boolean;
  onClick: () => void;
  mode: "admin" | "reviewer" | "dev";
}

export default function CommentThread({
  comment,
  number,
  onResolve,
  onReply,
  onDelete,
  isActive,
  onClick,
  mode,
}: CommentThreadProps) {
  const [replyContent, setReplyContent] = useState("");
  const [replyAuthor, setReplyAuthor] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("webreview-author-name") || "";
    }
    return "";
  });
  const [showReply, setShowReply] = useState(false);

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !replyAuthor.trim()) return;
    localStorage.setItem("webreview-author-name", replyAuthor.trim());
    onReply(comment.id, replyContent.trim(), replyAuthor.trim());
    setReplyContent("");
    setShowReply(false);
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor(
      (Date.now() - new Date(date).getTime()) / 1000
    );
    if (seconds < 60) return "A l'instant";
    if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)}min`;
    if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)}h`;
    return `Il y a ${Math.floor(seconds / 86400)}j`;
  };

  return (
    <div
      className={`rounded-xl transition-all cursor-pointer ${
        isActive
          ? "ring-2 ring-orange-400 shadow-md"
          : "hover:shadow-sm"
      } ${comment.resolved ? "opacity-60" : ""}`}
      onClick={onClick}
    >
      {/* Main comment */}
      <div className="p-4 bg-white border border-gray-200 rounded-xl">
        <div className="flex items-start gap-3">
          {/* Pin number */}
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
              comment.resolved ? "bg-green-500" : "bg-orange-500"
            }`}
          >
            {number}
          </div>

          <div className="flex-1 min-w-0">
            {/* Author + time */}
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm text-gray-900">
                {comment.author}
              </span>
              <span className="text-xs text-gray-400">
                {timeAgo(comment.createdAt)}
              </span>
              {comment.resolved && (
                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                  Resolu
                </span>
              )}
            </div>

            {/* Content */}
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {comment.content}
            </p>

            {/* Replies */}
            {comment.replies.length > 0 && (
              <div className="mt-3 space-y-3 pl-3 border-l-2 border-gray-100">
                {comment.replies.map((reply) => (
                  <div key={reply.id}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-xs text-gray-900">
                        {reply.author}
                      </span>
                      <span className="text-xs text-gray-400">
                        {timeAgo(reply.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {reply.content}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="mt-3 flex items-center gap-2">
              {/* Resolve button - admin only */}
              {mode === "admin" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onResolve(comment.id, !comment.resolved);
                  }}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                    comment.resolved
                      ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  }`}
                >
                  {comment.resolved ? "Reouvrir" : "Marquer resolu"}
                </button>
              )}

              {/* Reply button - everyone */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReply(!showReply);
                }}
                className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Repondre
              </button>

              {/* Delete button - admin only */}
              {mode === "admin" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Supprimer ce commentaire et ses reponses ?")) {
                      onDelete(comment.id);
                    }
                  }}
                  className="text-xs px-2 py-1 text-gray-400 hover:text-red-500 transition-colors ml-auto"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>

            {/* Reply form */}
            {showReply && (
              <form
                onSubmit={handleReply}
                className="mt-3 space-y-2 bg-gray-50 rounded-lg p-3"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  placeholder="Votre nom"
                  value={replyAuthor}
                  onChange={(e) => setReplyAuthor(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Votre reponse..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!replyContent.trim() || !replyAuthor.trim()}
                    className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Envoyer
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
