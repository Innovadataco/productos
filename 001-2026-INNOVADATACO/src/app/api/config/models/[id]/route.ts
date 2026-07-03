import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

interface Params { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const existing = await prisma.aiModel.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Modelo no encontrado" }, { status: 404 });

    if (body.active) {
      await prisma.aiModel.updateMany({ data: { active: false } });
    }

    const model = await prisma.aiModel.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        provider: body.provider ?? existing.provider,
        scope: body.scope !== undefined ? (body.scope || "local") : existing.scope,
        baseUrl: body.baseUrl !== undefined ? (body.baseUrl || null) : existing.baseUrl,
        apiKey: body.apiKey !== undefined ? (body.apiKey || null) : existing.apiKey,
        modelPath: body.modelPath ?? existing.modelPath,
        active: body.active !== undefined ? !!body.active : existing.active,
        config: body.config ? (typeof body.config === "string" ? body.config : JSON.stringify(body.config)) : existing.config,
      },
    });

    await auditLog({
      action: "update_model",
      entityType: "AiModel",
      entityId: model.id,
      status: "success",
      message: `Modelo ${model.name} actualizado`,
      aiModelId: model.id,
    });

    return NextResponse.json(model);
  } catch (err: any) {
    console.error(err);
    await auditLog({ action: "update_model", entityType: "AiModel", status: "error", message: err.message });
    return NextResponse.json({ error: err.message || "Error actualizando modelo" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await prisma.aiModel.delete({ where: { id } });
    await auditLog({ action: "delete_model", entityType: "AiModel", entityId: id, status: "success", message: "Modelo eliminado" });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    await auditLog({ action: "delete_model", entityType: "AiModel", status: "error", message: err.message });
    return NextResponse.json({ error: err.message || "Error eliminando modelo" }, { status: 500 });
  }
}
