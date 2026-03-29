import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
          Beta
        </div>
        <h1 className="text-5xl font-bold tracking-tight mb-4">
          Web<span className="text-orange-500">Review</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Partagez un lien, recevez des commentaires visuels directement sur
          votre site. Simple comme Figma, fait pour le web.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/admin"
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Ouvrir le Dashboard
          </Link>
        </div>
      </div>
      <div className="mt-16 text-sm text-gray-400">
        Cliquez. Commentez. Collaborez.
      </div>
    </div>
  );
}
