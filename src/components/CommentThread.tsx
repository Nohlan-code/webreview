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
  isActive: boolean;
  onClick: () => void;
}

export default function CommentThread({
  comment,
  number,
  onResolve,
  onReply,
  isActive,
  onClick,
}: CommentThreadProps) {
  const [replyContent, setReplyContent] = useState("");
  const [replyAuthor, setReplyAuthor] = useState("");
  const [showReply, setShowReply] = useState(false);

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !replyAuthor.trim()) return;
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
      className={`border rounded-xl p-4 transition-all cursor-pointer ${
        isActive
          ? "border-orange-400 bg-orange-50 shadow-md"
          : "border-gray-200 bg-white hover:border-gray-300"
      } ${comment.resolved ? "opacity-60" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
            comment.resolved ? "bg-green-500" : "bg-orange-500"
          }`}
        >
          {number}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{comment.author}</span>
            <span className="text-xs text-gray-400">
              {timeAgo(comment.createdAt)}
            </span>
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {comment.content}
          </p>

          {comment.replies.length > 0 && (
            <div className="mt-3 space-y-2 pl-3 border-l-2 border-gray-100">
              {comment.replies.map((reply) => (
                <div key={reply.id}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs">{reply.author}</span>
                    <span className="text-xs text-gray-400">
                      {timeAgo(reply.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{reply.content}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onResolve(comment.id, !comment.resolved);
              }}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                comment.resolved
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {comment.resolved ? "Resolu" : "Marquer resolu"}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowReply(!showReply);
              }}
              className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Repondre
            </button>
          </div>

          {showReply && (
            <form
              onSubmit={handleReply}
              className="mt-3 space-y-2"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                placeholder="Votre nom"
                value={replyAuthor}
                onChange={(e) => setReplyAuthor(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Votre reponse..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!replyContent.trim() || !replyAuthor.trim()}
                  className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                >
                  Envoyer
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
