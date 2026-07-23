import { NextRequest, NextResponse } from "next/server";
import { apiError, detalleDeError } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";
import { testModel } from "@/lib/modelClients";
import { auditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const model = await prisma.aiModel.findUnique({ where: { id } });
    if (!model) return NextResponse.json({ error: "Modelo no encontrado" }, { status: 404 });

    const result = await testModel(model);

    await auditLog({
      action: "test_model",
      entityType: "AiModel",
      entityId: model.id,
      status: result.ok ? "success" : "error",
      message: result.ok ? `Test OK (${result.latencyMs}ms)` : `Test fallido: ${result.error}`,
      metadata: { usage: result.usage, error: result.error },
      latencyMs: result.latencyMs,
      aiModelId: model.id,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    await auditLog({ action: "test_model", entityType: "AiModel", status: "error", message: detalleDeError(err) });
    return apiError("Configuración", "POST test modelo", "Error probando el modelo", 500, err, {
      ok: false,
      latencyMs: 0,
      text: "",
    });
  }
}
