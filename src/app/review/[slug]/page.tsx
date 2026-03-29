import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ReviewOverlay from "@/components/ReviewOverlay";

interface Props {
  params: { slug: string };
  searchParams: { mode?: string };
}

export default async function ReviewPage({ params, searchParams }: Props) {
  const project = await prisma.project.findUnique({
    where: { slug: params.slug },
  });

  if (!project) {
    notFound();
  }

  // ?mode=dev → freelancer view (can see comments + reply, cannot add pins)
  // ?mode=admin → admin view (full access)
  // default → reviewer view (can add comments + reply)
  const validModes = ["admin", "reviewer", "dev"] as const;
  const requestedMode = searchParams.mode as typeof validModes[number] | undefined;
  const mode = requestedMode && validModes.includes(requestedMode) ? requestedMode : "reviewer";

  return (
    <ReviewOverlay
      slug={project.slug}
      siteUrl={project.url}
      projectName={project.name}
      mode={mode}
    />
  );
}
