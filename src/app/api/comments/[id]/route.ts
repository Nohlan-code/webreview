import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const comment = await prisma.comment.update({
    where: { id: params.id },
    data: body,
  });
  return NextResponse.json(comment);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.comment.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
