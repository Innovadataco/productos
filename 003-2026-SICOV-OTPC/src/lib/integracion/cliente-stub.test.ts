import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findFirst: vi.fn() } } }));

import { prisma } from "@/lib/prisma";
import { ClienteStub } from "@/lib/integracion/cliente-stub";
import { extraerIdDespachoExterno } from "@/lib/normalizar";
import { clearTokenProveedor } from "@/lib/integracion/token-proveedor";

const findFirst = prisma.usuario.findFirst as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  clearTokenProveedor();
  findFirst.mockReset();
  findFirst.mockResolvedValue({
    id: 2,
    identificacion: "900853057",
    tokenAutorizado: "TOK",
    administradorId: null,
  });
});

describe("ClienteStub (nunca toca red)", () => {
  it("reporta un despacho y devuelve id externo", async () => {
    const cli = new ClienteStub();
    const resp = await cli.postTransaccional(
      "http://stub.local/despachosempresa",
      { obj_vehiculo: { placa: "ABC123" } },
      "900853057",
      2,
    );
    expect(extraerIdDespachoExterno(resp)).toBeGreaterThan(0);
  });

  it("lanza ante placa FALLA* (para ejercitar reintentos)", async () => {
    const cli = new ClienteStub();
    await expect(
      cli.postTransaccional(
        "http://stub.local/despachosempresa",
        { obj_vehiculo: { placa: "FALLA01" } },
        "900853057",
        2,
      ),
    ).rejects.toThrow();
  });

  it("propaga el error de configuración si el vigilado no tiene token", async () => {
    findFirst.mockResolvedValue({
      id: 2,
      identificacion: "900853057",
      tokenAutorizado: "",
      administradorId: null,
    });
    const cli = new ClienteStub();
    await expect(
      cli.postTransaccional("http://x", { obj_vehiculo: { placa: "ABC123" } }, "900853057", 2),
    ).rejects.toThrow();
  });
});
