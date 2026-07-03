import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const apis = await prisma.agentApi.findMany({
      orderBy: [{ module: "asc" }, { submodule: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(apis);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: "Error listando APIs" }, { status: 500 });
  }
}
