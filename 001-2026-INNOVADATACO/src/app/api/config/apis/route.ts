import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET() {
  try {
    const apis = await prisma.agentApi.findMany({
      orderBy: [{ module: "asc" }, { submodule: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(apis);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error listando APIs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth();
    if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await req.json();
    const api = await prisma.agentApi.create({
      data: {
        key: body.key,
        name: body.name,
        description: body.description,
        module: body.module,
        submodule: body.submodule,
        category: body.category,
        method: body.method,
        path: body.path,
        authType: body.authType,
        active: body.active ?? true,
        docs: typeof body.docs === "string" ? body.docs : JSON.stringify(body.docs ?? {}),
        config: typeof body.config === "string" ? body.config : JSON.stringify(body.config ?? {}),
      },
    });

    return NextResponse.json(api, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error creando API" }, { status: 500 });
  }
}
