"use client";

interface CommentPinProps {
  number: number;
  xPercent: number;
  yPercent: number;
  resolved: boolean;
  isActive: boolean;
  onClick: () => void;
}

export default function CommentPin({
  number,
  xPercent,
  yPercent,
  resolved,
  isActive,
  onClick,
}: CommentPinProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`absolute z-20 w-8 h-8 -ml-4 -mt-4 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg transition-all hover:scale-110 ${
        resolved
          ? "bg-green-500 hover:bg-green-600"
          : "bg-orange-500 hover:bg-orange-600"
      } ${isActive ? "ring-4 ring-orange-300 scale-110" : ""}`}
      style={{
        left: `${xPercent}%`,
        top: `${yPercent}%`,
      }}
      title={`Commentaire #${number}`}
    >
      {number}
    </button>
  );
}
