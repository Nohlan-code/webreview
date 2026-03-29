"use client";

import { useState } from "react";

interface CommentFormProps {
  xPercent: number;
  yPercent: number;
  onSubmit: (data: { content: string; author: string }) => void;
  onCancel: () => void;
}

export default function CommentForm({
  xPercent,
  yPercent,
  onSubmit,
  onCancel,
}: CommentFormProps) {
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !author.trim()) return;
    onSubmit({ content: content.trim(), author: author.trim() });
  };

  // Position form to the right of pin, or left if too far right
  const formLeft = xPercent > 70 ? xPercent - 25 : xPercent + 2;

  return (
    <div
      className="absolute z-30 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-72 pointer-events-auto"
      style={{
        left: `${formLeft}%`,
        top: `${yPercent}%`,
        transform: "translateY(-50%)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            type="text"
            placeholder="Votre nom"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            autoFocus
          />
        </div>
        <div>
          <textarea
            placeholder="Votre commentaire..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!content.trim() || !author.trim()}
            className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Envoyer
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
