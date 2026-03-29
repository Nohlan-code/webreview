import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ReviewOverlay from "@/components/ReviewOverlay";

interface Props {
  params: { slug: string };
}

export default async function ReviewPage({ params }: Props) {
  const project = await prisma.project.findUnique({
    where: { slug: params.slug },
  });

  if (!project) {
    notFound();
  }

  return (
    <ReviewOverlay
      slug={project.slug}
      siteUrl={project.url}
      projectName={project.name}
      mode="reviewer"
    />
  );
}
