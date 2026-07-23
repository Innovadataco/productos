import { NextRequest, NextResponse } from "next/server";
import { apiError, detalleDeError } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { encrypt } from "@/lib/crypto";
import { verifyAuth } from "@/lib/auth";

interface Params { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = await verifyAuth();
    if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

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
        apiKey: body.apiKey !== undefined ? (body.apiKey ? encrypt(body.apiKey) : null) : existing.apiKey,
        modelPath: body.modelPath ?? existing.modelPath,
        active: body.active !== undefined ? !!body.active : existing.active,
        config: body.config ? (typeof body.config === "string" ? body.config : JSON.stringify(body.config)) : existing.config,
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
      action: "update_model",
      entityType: "AiModel",
      entityId: model.id,
      status: "success",
      message: `Modelo ${model.name} actualizado`,
      aiModelId: model.id,
    });

    return NextResponse.json(model);
  } catch (err: unknown) {
    await auditLog({ action: "update_model", entityType: "AiModel", status: "error", message: detalleDeError(err) });
    return apiError("Configuración", "PATCH modelo", "Error actualizando modelo", 500, err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await verifyAuth();
    if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id } = await params;
    await prisma.aiModel.delete({ where: { id } });
    await auditLog({ action: "delete_model", entityType: "AiModel", entityId: id, status: "success", message: "Modelo eliminado" });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    await auditLog({ action: "delete_model", entityType: "AiModel", status: "error", message: detalleDeError(err) });
    return apiError("Configuración", "DELETE modelo", "Error eliminando modelo", 500, err);
  }
}
