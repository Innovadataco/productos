// El cableado real del servicio inv-008-ia que se puede probar sin base ni red: el `fetch` acotado (solo el destino de
// la tailnet y las dos rutas de Ollama) y los digests de la clave de «ya publicado».
import { describe, expect, it, vi } from "vitest";
import { digestsDe, fetchAcotado, opcionesDe } from "@/servicio-ia/cableado";
import { DESTINO_FICTICIO, DIGEST_QWEN, LISTA_FICTICIA, SIN_LISTA, VIGENTE_FICTICIA } from "../ia/config/apoyo/config.ficticio";

const init = { method: "GET", headers: {}, signal: new AbortController().signal, redirect: "manual" } as const;

describe("fetchAcotado", () => {
  it("deja pasar solo /api/tags y /api/generate de un destino de la tailnet", async () => {
    const real = vi.fn(async () => ({ status: 200 }) as never);
    const buscar = fetchAcotado(real);
    await buscar(`${DESTINO_FICTICIO}/api/tags`, init);
    await buscar(`${DESTINO_FICTICIO}/api/generate`, init);
    expect(real).toHaveBeenCalledTimes(2);
  });

  it.each(["https://api.telegram.org/", "http://inv-008-db:5432/api/tags", `${DESTINO_FICTICIO}/api/pull`, `${DESTINO_FICTICIO}/api/tags?x=1`, "http://localhost:8008/api/tags"])(
    "rechaza %s sin salir a la red",
    async (url) => {
      const real = vi.fn();
      await expect(fetchAcotado(real as never)(url, init)).rejects.toThrow(/DESTINO_NO_PERMITIDO/);
      expect(real).not.toHaveBeenCalled();
    },
  );
});

describe("digestsDe y opcionesDe", () => {
  it("el digest de la lista de PI del modelo local de la tarea, si el modo usa la local", () => {
    expect(digestsDe({ ...VIGENTE_FICTICIA, modo: "local" }, "DIARIO", LISTA_FICTICIA)).toEqual([DIGEST_QWEN]);
    expect(digestsDe({ ...VIGENTE_FICTICIA, modo: "nube" }, "DIARIO", LISTA_FICTICIA)).toEqual([]);
    expect(digestsDe({ ...VIGENTE_FICTICIA, modo: "local" }, "ESCENARIOS", LISTA_FICTICIA)).toEqual([]);
    expect(digestsDe({ ...VIGENTE_FICTICIA, modo: "local" }, "DIARIO", SIN_LISTA)).toEqual([]);
  });

  it("las opciones del registro: las fijas de 008 (num_ctx 8192, semilla 42) y la temperatura de la configuración", () => {
    expect(opcionesDe({ ...VIGENTE_FICTICIA, temperaturaCentesimas: 37 })).toEqual({ num_ctx: 8192, seed: 42, temperaturaCentesimas: 37 });
  });
});

describe("servir · sin la credencial", () => {
  it("queda EN ESPERA: late, lo dice, no crea el cliente de la base y sale con 0 al recibir SIGTERM", async () => {
    const { mkdtempSync, readFileSync } = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const { servir, VARIABLE_ESTADO_DIR } = await import("@/servicio-ia/cableado");
    const dir = mkdtempSync(path.join(os.tmpdir(), "inv-008-ia-servir-"));
    const lineas: string[] = [];
    const oyentes = new Map<string, (s: NodeJS.Signals) => void>();
    const proceso = {
      env: { [VARIABLE_ESTADO_DIR]: dir } as unknown as NodeJS.ProcessEnv,
      stdout: { write: (t: string) => void lineas.push(t) },
      once: (s: string, f: (x: NodeJS.Signals) => void) => void oyentes.set(s, f),
      removeListener: (s: string) => void oyentes.delete(s),
    };
    const crearDb = vi.fn();
    const fin = servir(proceso, vi.fn() as never, crearDb as never);
    await vi.waitFor(() => expect(readFileSync(path.join(dir, "bucle"), "utf8")).toContain("estado=SIN_SECRETO"));
    oyentes.get("SIGTERM")?.("SIGTERM");
    expect(await fin).toBe(0);
    expect(crearDb).not.toHaveBeenCalled();
    expect(lineas.join("")).toContain("sin INV_IA_DATABASE_URL");
  });
});

describe("servirAhora", () => {
  const URL_FICTICIA = "postgresql://inv_ia:clave-ficticia-4613@inv-008-db:5432/inversiones?connection_limit=2";
  const procesoCon = (env: Record<string, string>) => {
    const lineas: string[] = [];
    return { lineas, proceso: { env: env as unknown as NodeJS.ProcessEnv, stdout: { write: (t: string) => void lineas.push(t) }, once: vi.fn(), removeListener: vi.fn() } };
  };

  it("sin la credencial: lo dice, no crea el cliente de la base y sale con 1", async () => {
    const { servirAhora } = await import("@/servicio-ia/cableado");
    const { proceso, lineas } = procesoCon({});
    const crearDb = vi.fn();
    expect(await servirAhora(proceso, vi.fn() as never, crearDb as never)).toBe(1);
    expect(crearDb).not.toHaveBeenCalled();
    expect(lineas.join("")).toContain("sin INV_IA_DATABASE_URL");
  });

  it("con la credencial: una sola conexión, la configuración de la base (apagada: nada) y cierra la base; nunca repite la URL", async () => {
    const { mkdtempSync } = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const { servirAhora, VARIABLE_ESTADO_DIR } = await import("@/servicio-ia/cableado");
    const dir = mkdtempSync(path.join(os.tmpdir(), "inv-008-ia-ahora-"));
    const { proceso, lineas } = procesoCon({ DATABASE_URL: URL_FICTICIA, [VARIABLE_ESTADO_DIR]: dir });
    const desconectar = vi.fn(async () => undefined);
    const db = { configIa: { findFirst: vi.fn(async () => null) }, $disconnect: desconectar };
    const crearDb = vi.fn(() => db);
    expect(await servirAhora(proceso, vi.fn() as never, crearDb as never)).toBe(0);
    expect(new URL(crearDb.mock.calls[0]![0] as string).searchParams.get("connection_limit")).toBe("1");
    expect(desconectar).toHaveBeenCalledTimes(1);
    const todo = lineas.join("");
    expect(todo).toMatch(/apagada/);
    expect(todo).not.toContain("clave-ficticia-4613");
  });
});
