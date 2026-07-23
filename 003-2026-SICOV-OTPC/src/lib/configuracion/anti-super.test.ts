import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/// G1 — garantía verificable de FR-008 / D-044: NINGÚN flujo de la spec 009 llama a la Super
/// (Fase 1, regla CEO AGENTS §6). El token solo se persiste; cero tráfico a *.supertransporte.gov.co.
/// Se ejercitan los altas (empresa y usuario) con un espía global de `fetch` y se afirma que jamás
/// se contacta ese host. (El correo cae a stub sin RESEND_API_KEY → tampoco hay red.)

vi.mock("@/lib/prisma", () => {
  const tx = {
    proveedorVigilado: { create: vi.fn(async () => ({ id: 1 })) },
    usuario: { create: vi.fn(async () => ({ id: 2 })) },
    usuarioModulo: { create: vi.fn(), deleteMany: vi.fn() },
  };
  return {
    prisma: {
      proveedorVigilado: { findFirst: vi.fn(async () => null) },
      usuario: { findFirst: vi.fn(async () => null) },
      usuarioModulo: { findMany: vi.fn(async () => []) },
      modulo: { findFirst: vi.fn(async () => ({ id: 8 })) },
      $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    },
  };
});
vi.mock("@/lib/auth", () => ({ hashPassword: vi.fn(async () => "HASH") }));

import { crearEmpresa } from "./empresas";
import { crearUsuario } from "./usuarios";

const SUPER_HOST = "supertransporte.gov.co";
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  delete process.env.RESEND_API_KEY; // fuerza el stub de correo → sin red
  fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function ningunaLlamadaALaSuper() {
  for (const call of fetchSpy.mock.calls) {
    const url = String(call[0] ?? "");
    expect(url).not.toContain(SUPER_HOST);
  }
}

describe("anti-Super (G1 / FR-008 / D-044)", () => {
  it("crearEmpresa no genera NINGUNA petición a la Super", async () => {
    await crearEmpresa({ empresa: "T", nit: "900111222", correo: "a@b.com", token: "11111111-1111-1111-1111-111111111111", modulos: [1] });
    ningunaLlamadaALaSuper();
  });

  it("crearUsuario (root) no genera NINGUNA petición a la Super", async () => {
    await crearUsuario(
      { id: 1, rolId: 1, identificacion: null },
      { nombre: "Op", identificacion: "111", correo: "o@e.com", rolId: 3, empresaNit: "900111222", permisos: [{ moduloId: 4 }] },
    );
    ningunaLlamadaALaSuper();
  });
});
