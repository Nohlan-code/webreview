import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const slug = searchParams.get("slug");
  const resolved = searchParams.get("resolved");

  let where: Record<string, unknown> = { parentId: null };

  if (projectId) {
    where.projectId = projectId;
  } else if (slug) {
    const project = await prisma.project.findUnique({ where: { slug } });
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
    where.projectId = project.id;
  } else {
    return NextResponse.json(
      { error: "projectId or slug is required" },
      { status: 400 }
    );
  }

  if (resolved !== null && resolved !== undefined) {
    where.resolved = resolved === "true";
  }

  const comments = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      replies: { orderBy: { createdAt: "asc" } },
    },
  });

  return NextResponse.json(comments);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { content, author, xPercent, yPercent, projectId, slug, selector, pagePath, parentId } = body;

  let resolvedProjectId = projectId;

  if (!resolvedProjectId && slug) {
    const project = await prisma.project.findUnique({ where: { slug } });
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
    resolvedProjectId = project.id;
  }

  if (!content || !author || !resolvedProjectId) {
    return NextResponse.json(
      { error: "content, author, and projectId/slug are required" },
      { status: 400 }
    );
  }

  const comment = await prisma.comment.create({
    data: {
      content,
      author,
      xPercent: xPercent || 0,
      yPercent: yPercent || 0,
      selector: selector || null,
      pagePath: pagePath || "/",
      projectId: resolvedProjectId,
      parentId: parentId || null,
    },
    include: {
      replies: true,
    },
  });

  return NextResponse.json(comment, { status: 201 });
}
