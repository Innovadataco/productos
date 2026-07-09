import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { encrypt } from "@/lib/crypto";
import { verifyAuth } from "@/lib/auth";

export async function GET() {
  try {
    const models = await prisma.aiModel.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        provider: true,
        scope: true,
        baseUrl: true,
        modelPath: true,
        active: true,
        config: true,
        createdAt: true,
        updatedAt: true,
        // apiKey INTENCIONALMENTE EXCLUIDO
      },
    });
    return NextResponse.json(models);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error listando modelos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth();
    if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await req.json();
    const { name, provider, scope, baseUrl, apiKey, modelPath, active, config } = body;
    if (!name || !provider || !modelPath) {
      return NextResponse.json({ error: "Campos requeridos: name, provider, modelPath" }, { status: 400 });
    }

    if (active) {
      await prisma.aiModel.updateMany({ data: { active: false } });
    }

    const model = await prisma.aiModel.create({
      data: {
        name,
        provider,
        scope: scope || "local",
        baseUrl: baseUrl || null,
        apiKey: apiKey ? encrypt(apiKey) : null,
        modelPath,
        active: !!active,
        config: typeof config === "string" ? config : JSON.stringify(config ?? {}),
      },
      select: {
        id: true,
        name: true,
        provider: true,
        scope: true,
        baseUrl: true,
        modelPath: true,
        active: true,
        config: true,
        createdAt: true,
        updatedAt: true,
        // apiKey INTENCIONALMENTE EXCLUIDO
      },
    });

    await auditLog({
      action: "create_model",
      entityType: "AiModel",
      entityId: model.id,
      status: "success",
      message: `Modelo ${model.name} creado`,
      metadata: { provider, scope: model.scope, modelPath, active },
      aiModelId: model.id,
    });

    return NextResponse.json(model, { status: 201 });
  } catch (err: any) {
    console.error(err);
    await auditLog({ action: "create_model", entityType: "AiModel", status: "error", message: err.message });
    return NextResponse.json({ error: err.message || "Error creando modelo" }, { status: 500 });
  }
}
