"use client";

import { useState } from "react";
import CommentThread from "./CommentThread";

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

interface CommentSidebarProps {
  comments: Comment[];
  activeCommentId: string | null;
  onCommentClick: (id: string) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onReply: (parentId: string, content: string, author: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export default function CommentSidebar({
  comments,
  activeCommentId,
  onCommentClick,
  onResolve,
  onReply,
  isOpen,
  onToggle,
}: CommentSidebarProps) {
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");

  const filtered = comments.filter((c) => {
    if (filter === "open") return !c.resolved;
    if (filter === "resolved") return c.resolved;
    return true;
  });

  const openCount = comments.filter((c) => !c.resolved).length;
  const resolvedCount = comments.filter((c) => c.resolved).length;

  return (
    <>
      {/* Toggle button when sidebar is closed */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed right-4 top-4 z-50 bg-white shadow-lg rounded-full w-12 h-12 flex items-center justify-center hover:bg-gray-50 transition-colors border border-gray-200"
          title="Ouvrir les commentaires"
        >
          <svg
            className="w-5 h-5 text-gray-700"
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
          {openCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {openCount}
            </span>
          )}
        </button>
      )}

      {/* Sidebar */}
      <div
        className={`fixed right-0 top-0 h-full bg-white shadow-2xl border-l border-gray-200 z-40 transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: "var(--sidebar-width)" }}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">Commentaires</h2>
            <button
              onClick={onToggle}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setFilter("all")}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === "all"
                  ? "bg-white shadow text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Tous ({comments.length})
            </button>
            <button
              onClick={() => setFilter("open")}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === "open"
                  ? "bg-white shadow text-orange-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Ouverts ({openCount})
            </button>
            <button
              onClick={() => setFilter("resolved")}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === "resolved"
                  ? "bg-white shadow text-green-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Resolus ({resolvedCount})
            </button>
          </div>
        </div>

        {/* Comments list */}
        <div
          className="p-4 space-y-3 overflow-y-auto sidebar-scroll"
          style={{ height: "calc(100% - 130px)" }}
        >
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <svg
                className="w-12 h-12 mx-auto mb-3 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p className="text-sm">Aucun commentaire</p>
              <p className="text-xs mt-1">
                Cliquez sur le site pour en ajouter
              </p>
            </div>
          ) : (
            filtered.map((comment, index) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                number={
                  comments.findIndex((c) => c.id === comment.id) + 1
                }
                onResolve={onResolve}
                onReply={onReply}
                isActive={activeCommentId === comment.id}
                onClick={() => onCommentClick(comment.id)}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
