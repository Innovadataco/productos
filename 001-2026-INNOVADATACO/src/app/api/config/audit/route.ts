import { NextRequest, NextResponse } from "next/server";
import { noAutenticado } from "@/lib/apiError";
import { verifyAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || undefined;
    const status = searchParams.get("status") || undefined;
    const take = Math.min(Number(searchParams.get("limit") || "50"), 200);
    const skip = Number(searchParams.get("offset") || "0");

    const logs = await prisma.auditLog.findMany({
      where: { action, status },
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: { aiModel: { select: { name: true, provider: true } } },
    });

    return NextResponse.json(logs);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error listando auditoría" }, { status: 500 });
  }
}
