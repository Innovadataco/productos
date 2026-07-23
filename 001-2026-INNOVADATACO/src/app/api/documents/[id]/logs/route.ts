import { NextRequest, NextResponse } from "next/server";
import { noAutenticado } from "@/lib/apiError";
import { verifyAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const { id } = await params;
    const logs = await prisma.auditLog.findMany({
      where: { entityType: "DocumentoOficial", entityId: id },
      orderBy: { createdAt: "desc" },
      include: { aiModel: { select: { name: true, provider: true } } },
    });
    return NextResponse.json(logs);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error listando logs" }, { status: 500 });
  }
}
