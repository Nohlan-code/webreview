import { nanoid } from "nanoid";

export function generateSlug(): string {
  return nanoid(10);
}

export function getReviewUrl(slug: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  return `${base}/review/${slug}`;
}
