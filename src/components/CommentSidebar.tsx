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
  onDelete: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  mode: "admin" | "reviewer";
}

export default function CommentSidebar({
  comments,
  activeCommentId,
  onCommentClick,
  onResolve,
  onReply,
  onDelete,
  isOpen,
  onToggle,
  mode,
}: CommentSidebarProps) {
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");

  const filtered = comments.filter((c) => {
    if (filter === "open") return !c.resolved;
    if (filter === "resolved") return c.resolved;
    return true;
  });

  const openCount = comments.filter((c) => !c.resolved).length;
  const resolvedCount = comments.filter((c) => c.resolved).length;

  if (!isOpen) return null;

  return (
    <div
      className="h-full bg-white border-l border-gray-200 flex flex-col flex-shrink-0"
      style={{ width: "var(--sidebar-width, 380px)" }}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-lg">Commentaires</h2>
            <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full">
              {openCount}
            </span>
          </div>
          <button
            onClick={onToggle}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setFilter("all")}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === "all" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Tous ({comments.length})
          </button>
          <button
            onClick={() => setFilter("open")}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === "open" ? "bg-white shadow text-orange-600" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Ouverts ({openCount})
          </button>
          <button
            onClick={() => setFilter("resolved")}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === "resolved" ? "bg-white shadow text-green-600" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Resolus ({resolvedCount})
          </button>
        </div>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 sidebar-scroll">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm">Aucun commentaire</p>
            <p className="text-xs mt-1">Cliquez sur le site pour en ajouter</p>
          </div>
        ) : (
          filtered.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              number={comments.findIndex((c) => c.id === comment.id) + 1}
              onResolve={onResolve}
              onReply={onReply}
              onDelete={onDelete}
              isActive={activeCommentId === comment.id}
              onClick={() => onCommentClick(comment.id)}
              mode={mode}
            />
          ))
        )}
      </div>
    </div>
  );
}
