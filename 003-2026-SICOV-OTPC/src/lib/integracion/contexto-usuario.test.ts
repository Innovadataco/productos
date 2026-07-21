import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findFirst: vi.fn() } } }));

import { prisma } from "@/lib/prisma";
import { resolverContextoEfectivo } from "@/lib/integracion/contexto-usuario";

const findFirst = prisma.usuario.findFirst as unknown as ReturnType<typeof vi.fn>;
beforeEach(() => findFirst.mockReset());

describe("resolverContextoEfectivo (herencia rol 3)", () => {
  it("rol 2 usa su propio token y NIT", async () => {
    findFirst.mockResolvedValueOnce({
      id: 2,
      identificacion: "900853057",
      tokenAutorizado: "TOK",
      administradorId: null,
    });
    const ctx = await resolverContextoEfectivo("900853057", 2);
    expect(ctx).toEqual({ tokenAutorizado: "TOK", nitVigilado: "900853057", usuarioId: 2 });
  });

  it("rol 3 HEREDA token+NIT del administrador (join por identificación)", async () => {
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
    const ctx = await resolverContextoEfectivo("1010101010", 3);
    expect(ctx).toEqual({ tokenAutorizado: "TOK-ADMIN", nitVigilado: "900853057", usuarioId: 2 });
    // segundo lookup por la identificación del administrador
    expect(findFirst).toHaveBeenLastCalledWith({ where: { identificacion: "900853057" } });
  });

  it("rol 3 sin administrador => error 400", async () => {
    findFirst.mockResolvedValueOnce({
      id: 3,
      identificacion: "x",
      tokenAutorizado: null,
      administradorId: null,
    });
    await expect(resolverContextoEfectivo("x", 3)).rejects.toThrow();
  });

  it("rol 2 sin token de autorización => error 400", async () => {
    findFirst.mockResolvedValueOnce({
      id: 2,
      identificacion: "900",
      tokenAutorizado: "",
      administradorId: null,
    });
    await expect(resolverContextoEfectivo("900", 2)).rejects.toThrow();
  });
});
