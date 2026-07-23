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

describe("ClienteStub.consultarIntegradora (solo lectura, sin red)", () => {
  it("devuelve un resumen con conductor1 y vehículo consultados", async () => {
    const cli = new ClienteStub();
    const r = await cli.consultarIntegradora(
      { placa: "ABC123", numeroIdentificacion1: "123", fechaConsulta: "2026-07-21" },
      "900853057",
      2,
    );
    expect(r.conductor1.persona.numeroIdentificacion).toBe("123");
    expect(r.conductor2).toBeNull();
    expect(r.vehiculo.placa).toBe("ABC123");
    expect(r.vehiculo.soatVencimiento).toBeTruthy();
    expect(r.tarjetaOperacion.estado).toBe("VIGENTE");
  });

  it("incluye conductor2 si se pasa numeroIdentificacion2", async () => {
    const cli = new ClienteStub();
    const r = await cli.consultarIntegradora(
      { placa: "XYZ789", numeroIdentificacion1: "1", numeroIdentificacion2: "2", fechaConsulta: "2026-07-21" },
      "900853057",
      2,
    );
    expect(r.conductor2?.persona.numeroIdentificacion).toBe("2");
  });
});

describe("ClienteStub mantenimientos (spec 005 — cabeceras propias, sin red)", () => {
  it("postMantenimiento base devuelve id externo (sin cabecera documento)", async () => {
    const cli = new ClienteStub();
    const r = await cli.postMantenimiento(
      "/guardar-mantenimieto",
      { vigiladoId: 900853057, placa: "ABC123", tipoId: 1 },
      "900853057",
      2,
    );
    expect(Number(r["id"])).toBeGreaterThan(0);
  });

  it("postMantenimiento detalle devuelve mantenimientoId", async () => {
    const cli = new ClienteStub();
    const r = await cli.postMantenimiento(
      "/guardar-preventivo",
      { placa: "ABC123", mantenimientoId: 9001 },
      "900853057",
      2,
      { conVigiladoId: true },
    );
    expect(Number(r["mantenimientoId"])).toBe(9001);
  });

  it("placa FAL* (formato válido, ej. FAL999) fuerza error (caída a cola)", async () => {
    const cli = new ClienteStub();
    await expect(
      cli.postMantenimiento("/guardar-mantenimieto", { placa: "FAL999", tipoId: 1 }, "900853057", 2),
    ).rejects.toThrow("Fallo simulado");
  });

  it("herencia rol 3: usa token y NIT del administrador", async () => {
    findFirst
      .mockResolvedValueOnce({
        id: 3,
        identificacion: "1010101010",
        tokenAutorizado: null,
        administradorId: 900853057,
      })
      .mockResolvedValueOnce({
        id: 2,
        identificacion: "900853057",
        tokenAutorizado: "TOK-ADMIN",
        administradorId: null,
      });
    const cli = new ClienteStub();
    const r = await cli.postMantenimiento(
      "/guardar-mantenimieto",
      { vigiladoId: 900853057, placa: "ABC123", tipoId: 1 },
      "1010101010",
      3,
    );
    expect(Number(r["id"])).toBeGreaterThan(0);
  });

  it("getMantenimiento listar-placas y listar-historial devuelven datos demo", async () => {
    const cli = new ClienteStub();
    const placas = await cli.getMantenimiento("/listar-placas", { tipoId: "1" }, "900853057", 2);
    expect(Array.isArray(placas["data"])).toBe(true);
    const hist = await cli.getMantenimiento(
      "/listar-historial",
      { tipoId: "1", placa: "ABC123" },
      "900853057",
      2,
    );
    expect((hist["data"] as unknown[]).length).toBeGreaterThan(0);
  });
});

describe("ClienteStub maestras (sin red)", () => {
  it("consultarRutasActivas devuelve rutas simuladas", async () => {
    const cli = new ClienteStub();
    const rutas = await cli.consultarRutasActivas("900853057");
    expect(rutas.length).toBeGreaterThan(0);
    expect(rutas[0].idRutaAutorizada).toBeTruthy();
  });

  it("consultarAutorizaciones devuelve lista (vacía por defecto)", async () => {
    const cli = new ClienteStub();
    const aut = await cli.consultarAutorizaciones("900853057", "ABC123", "2026-07-21");
    expect(Array.isArray(aut)).toBe(true);
  });
});
