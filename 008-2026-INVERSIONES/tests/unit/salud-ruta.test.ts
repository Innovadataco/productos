// GET /api/salud como la llama Next, con la base SIMULADA: la ruta es pública (D-014) y sirve para verificar
// despliegues. Con la base caída responde 503 «degradado», sin caché y sin el mensaje crudo del error (puede
// traer la URL de conexión con su clave), ni en el cuerpo ni en el registro. La ruta con la base arriba la
// prueba tests/integracion/reglas-base.test.ts. Datos inventados: host de documentación (RFC 5737).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const consultar = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: { $queryRaw: consultar } }));

const URL_CON_CLAVE = "postgresql://usuario-ficticio:clave-ficticia@192.0.2.10:5438/inversiones_ficticia";

/** Un error como el de Prisma sin conexión: mensaje con la URL y un código. */
function caida(): Error {
  return Object.assign(new Error(`Can't reach database server at ${URL_CON_CLAVE}`), { code: "P1001", name: "PrismaClientInitializationError" });
}

let registro: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules();
  registro = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  registro.mockRestore();
});

async function pedirSalud(): Promise<Response> {
  const { GET } = await import("@/app/api/salud/route");
  return GET();
}

describe("GET /api/salud con la base caída", () => {
  it("responde 503 con estado degradado y solo estado y versión", async () => {
    vi.stubEnv("APP_VERSION", "abc1234");
    consultar.mockRejectedValue(caida());
    const r = await pedirSalud();
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ estado: "degradado", version: "abc1234" });
  });

  it("el 503 también va sin caché (no-store)", async () => {
    consultar.mockRejectedValue(caida());
    expect((await pedirSalud()).headers.get("cache-control")).toBe("no-store");
  });

  it("ni el cuerpo ni el registro traen el mensaje crudo; el registro trae solo el código", async () => {
    consultar.mockRejectedValue(caida());
    const cuerpo = await (await pedirSalud()).text();
    const registrado = registro.mock.calls.flat().map(String).join("\n");
    for (const filtrado of ["clave-ficticia", "usuario-ficticio", "postgresql://", "192.0.2.10", "Can't reach"]) {
      expect(cuerpo, filtrado).not.toContain(filtrado);
      expect(registrado, filtrado).not.toContain(filtrado);
    }
    expect(registrado).toContain("código: P1001");
  });
});

describe("GET /api/salud con la base arriba", () => {
  it("responde 200 ok y, sin APP_VERSION, la versión «local»", async () => {
    vi.stubEnv("APP_VERSION", undefined);
    consultar.mockResolvedValue([{ "?column?": 1 }]);
    const r = await pedirSalud();
    expect([r.status, await r.json()]).toEqual([200, { estado: "ok", version: "local" }]);
    expect(consultar).toHaveBeenCalledTimes(1);
  });
});
