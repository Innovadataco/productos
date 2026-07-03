import { prisma } from "./prisma";

export interface AuditInput {
  action: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  status: "success" | "error" | "info";
  message: string;
  metadata?: Record<string, unknown>;
  latencyMs?: number;
  aiModelId?: string;
}

export async function auditLog(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        userId: input.userId,
        status: input.status,
        message: input.message,
        metadata: JSON.stringify(input.metadata ?? {}),
        latencyMs: input.latencyMs,
        aiModelId: input.aiModelId,
      },
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}
