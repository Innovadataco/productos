import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prismaMock");
  return { prisma: createPrismaMock() };
});

import { prisma } from "@/lib/prisma";
import { auditLog } from "./audit";

/**
 * Casilla pendiente de §4.4 (spec 009, FR-006).
 *
 * Lo que de verdad importa probar de `auditLog` no es que escriba una fila:
 * es que **un fallo suyo no tumbe la operación que la invocó**. La auditoría es
 * un registro lateral; si la caída de la tabla de auditoría hiciera fallar un
 * PATCH, el remedio sería peor que la enfermedad.
 */
beforeEach(() => {
  vi.mocked(prisma.auditLog.create).mockReset();
});

describe("auditLog (spec 009, §4.4)", () => {
  it("persiste la acción con su entidad, usuario y estado", async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: "a1" } as never);

    await auditLog({
      action: "oportunidad.estado.cambio",
      entityType: "Licitacion",
      entityId: "lic1",
      userId: "usr_1",
      status: "success",
      message: "Estado 1 → 3",
    });

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.auditLog.create).mock.calls[0][0].data).toMatchObject({
      action: "oportunidad.estado.cambio",
      entityType: "Licitacion",
      entityId: "lic1",
      userId: "usr_1",
      status: "success",
      message: "Estado 1 → 3",
    });
  });

  it("atribuye a 'system' lo que no lleva usuario (procesos automáticos)", async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: "a1" } as never);

    await auditLog({ action: "documento.procesado", status: "info", message: "Encolado" });

    expect(vi.mocked(prisma.auditLog.create).mock.calls[0][0].data.userId).toBe("system");
  });

  it("serializa la metadata a JSON y nunca la guarda como objeto crudo", async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: "a1" } as never);

    await auditLog({
      action: "proyecto.fase.cambio",
      status: "success",
      message: "Fase movida",
      metadata: { faseAnterior: "initiation", faseNueva: "planning" },
    });

    const { metadata } = vi.mocked(prisma.auditLog.create).mock.calls[0][0].data;
    expect(typeof metadata).toBe("string");
    expect(JSON.parse(metadata as string)).toEqual({
      faseAnterior: "initiation",
      faseNueva: "planning",
    });
  });

  it("guarda un objeto vacío cuando no hay metadata, no undefined", async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: "a1" } as never);

    await auditLog({ action: "login", status: "success", message: "Entrada" });

    expect(vi.mocked(prisma.auditLog.create).mock.calls[0][0].data.metadata).toBe("{}");
  });

  it("NO propaga el fallo: si la auditoría se cae, la operación auditada sigue viva", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.auditLog.create).mockRejectedValue(new Error("tabla audit_log inaccesible"));

    await expect(
      auditLog({ action: "proyecto.eliminado", status: "success", message: "Borrado" }),
    ).resolves.toBeUndefined();

    expect(consola).toHaveBeenCalled();
  });
});
