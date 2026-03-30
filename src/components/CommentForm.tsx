"use client";

import { useState, useEffect, useRef } from "react";

const AUTHOR_STORAGE_KEY = "webreview-author-name";

interface CommentFormProps {
  xPercent: number;
  yPx: number;
  onSubmit: (data: { content: string; author: string }) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export default function CommentForm({
  xPercent,
  yPx,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: CommentFormProps) {
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Load saved author name from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(AUTHOR_STORAGE_KEY);
    if (saved) {
      setAuthor(saved);
      // Focus textarea since name is already filled
      setTimeout(() => textareaRef.current?.focus(), 50);
    } else {
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !author.trim() || isSubmitting) return;
    // Save author name for next time
    localStorage.setItem(AUTHOR_STORAGE_KEY, author.trim());
    onSubmit({ content: content.trim(), author: author.trim() });
  };

  // Cmd/Ctrl+Enter to submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (content.trim() && author.trim() && !isSubmitting) {
        localStorage.setItem(AUTHOR_STORAGE_KEY, author.trim());
        onSubmit({ content: content.trim(), author: author.trim() });
      }
    }
  };

  // Position form to the right of pin, or left if too far right
  const formLeft = xPercent > 70 ? xPercent - 25 : xPercent + 2;

  return (
    <div
      className="absolute z-30 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-72 pointer-events-auto"
      style={{
        left: `${formLeft}%`,
        top: `${yPx}px`,
        transform: "translateY(-50%)",
      }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={handleKeyDown}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            ref={nameRef}
            type="text"
            placeholder="Votre nom"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            disabled={isSubmitting}
          />
        </div>
        <div>
          <textarea
            ref={textareaRef}
            placeholder="Votre commentaire..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
            disabled={isSubmitting}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!content.trim() || !author.trim() || isSubmitting}
            className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Envoi...
              </>
            ) : (
              "Envoyer"
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
        <p className="text-[10px] text-gray-400 text-center">
          ⌘+Entree pour envoyer
        </p>
      </form>
    </div>
  );
}
