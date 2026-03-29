"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Reply {
  id: string;
  content: string;
  author: string;
  createdAt: string;
}

interface Comment {
  id: string;
  content: string;
  author: string;
  resolved: boolean;
  createdAt: string;
  xPercent: number;
  yPercent: number;
  replies: Reply[];
}

interface Project {
  id: string;
  name: string;
  url: string;
  slug: string;
  createdAt: string;
  comments: Comment[];
}

export default function ProjectDetailPage() {
  const params = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [copied, setCopied] = useState(false);
  const [copiedDev, setCopiedDev] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${params.id}`);
      if (res.ok) {
        setProject(await res.json());
      }
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleResolve = async (id: string, resolved: boolean) => {
    await fetch(`/api/comments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved }),
    });
    fetchProject();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce commentaire ?")) return;
    await fetch(`/api/comments/${id}`, { method: "DELETE" });
    fetchProject();
  };

  const copyLink = async () => {
    if (!project) return;
    await navigator.clipboard.writeText(
      `${window.location.origin}/review/${project.slug}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyDevLink = async () => {
    if (!project) return;
    await navigator.clipboard.writeText(
      `${window.location.origin}/review/${project.slug}?mode=dev`
    );
    setCopiedDev(true);
    setTimeout(() => setCopiedDev(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Projet introuvable</h2>
          <Link href="/admin" className="text-orange-500 hover:underline">
            Retour au dashboard
          </Link>
        </div>
      </div>
    );
  }

  const comments = project.comments.filter((c) => {
    if (filter === "open") return !c.resolved;
    if (filter === "resolved") return c.resolved;
    return true;
  });

  const openCount = project.comments.filter((c) => !c.resolved).length;
  const resolvedCount = project.comments.filter((c) => c.resolved).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="font-bold text-xl">
              Web<span className="text-orange-500">Review</span>
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-gray-600">{project.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyLink}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                copied
                  ? "bg-green-50 text-green-600 border border-green-200"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {copied ? "Lien copie !" : "Lien client"}
            </button>
            <button
              onClick={copyDevLink}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                copiedDev
                  ? "bg-green-50 text-green-600 border border-green-200"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              {copiedDev ? "Lien copie !" : "Lien freelance"}
            </button>
            <Link
              href={`/review/${project.slug}`}
              target="_blank"
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Ouvrir la review
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Project info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">{project.name}</h1>
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-orange-500 hover:underline"
              >
                {project.url}
              </a>
            </div>
            <div className="flex gap-3 text-center">
              <div className="bg-orange-50 rounded-lg px-4 py-2">
                <div className="text-2xl font-bold text-orange-600">
                  {openCount}
                </div>
                <div className="text-xs text-orange-500">Ouverts</div>
              </div>
              <div className="bg-green-50 rounded-lg px-4 py-2">
                <div className="text-2xl font-bold text-green-600">
                  {resolvedCount}
                </div>
                <div className="text-xs text-green-500">Resolus</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm text-gray-500 mr-2">Filtrer :</span>
          {(["all", "open", "resolved"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f === "all"
                ? `Tous (${project.comments.length})`
                : f === "open"
                ? `Ouverts (${openCount})`
                : `Resolus (${resolvedCount})`}
            </button>
          ))}
        </div>

        {/* Comments table */}
        {comments.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p>Aucun commentaire</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment, index) => (
              <div
                key={comment.id}
                className={`bg-white rounded-xl border p-5 ${
                  comment.resolved ? "border-green-200" : "border-gray-200"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${
                      comment.resolved ? "bg-green-500" : "bg-orange-500"
                    }`}
                  >
                    {project.comments.indexOf(comment) + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{comment.author}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(comment.createdAt).toLocaleString("fr-FR")}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          comment.resolved
                            ? "bg-green-100 text-green-700"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {comment.resolved ? "Resolu" : "Ouvert"}
                      </span>
                    </div>
                    <p className="text-gray-700 mb-2">{comment.content}</p>
                    <p className="text-xs text-gray-400">
                      Position : {comment.xPercent.toFixed(1)}% x{" "}
                      {comment.yPercent.toFixed(1)}%
                    </p>

                    {comment.replies.length > 0 && (
                      <div className="mt-3 pl-4 border-l-2 border-gray-100 space-y-2">
                        {comment.replies.map((reply) => (
                          <div key={reply.id}>
                            <span className="font-medium text-sm">
                              {reply.author}
                            </span>
                            <span className="text-xs text-gray-400 ml-2">
                              {new Date(reply.createdAt).toLocaleString(
                                "fr-FR"
                              )}
                            </span>
                            <p className="text-sm text-gray-600">
                              {reply.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        handleResolve(comment.id, !comment.resolved)
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        comment.resolved
                          ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                          : "bg-green-100 text-green-700 hover:bg-green-200"
                      }`}
                    >
                      {comment.resolved ? "Reouvrir" : "Resoudre"}
                    </button>
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
