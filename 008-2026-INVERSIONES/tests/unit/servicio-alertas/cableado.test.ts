// El cableado real del servicio inv-008-alertas, con una base y un proceso falsos: la credencial se revisa sin repetir la URL, el
// interruptor del intradía sale de INV_INTRADIA_ENCENDIDO (el mismo de precios), el calendario decide el día hábil y el rol se
// revisa con current_user. Sin credencial no se crea la conexión. Datos inventados.
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { conUnaConexion, dependenciasReales, servir, servirAhora, type Proceso } from "@/servicio-alertas/cableado";

const CLAVE = "clave-ficticia-5120";
const URL_BUENA = `postgresql://inv_alertas:${CLAVE}@inv-008-db:5432/inversiones?connection_limit=2`;

function proceso(env: Record<string, string>) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "inv-008-alertas-cab-"));
  const salida: string[] = [];
  const manejadores: Array<(s: NodeJS.Signals) => void> = [];
  const p: Proceso = {
    env: { ALERTAS_ESTADO_DIR: dir, ...env },
    stdout: { write: (t: string) => void salida.push(t) },
    once: (_s, f) => void manejadores.push(f),
    removeListener: () => undefined,
  };
  return { p, dir, salida, manejadores, texto: () => salida.join("") };
}

const dbFalsa = (usuario: string, festivos: string[] = []) => ({
  $queryRaw: vi.fn(async () => [{ u: usuario }]),
  $disconnect: vi.fn(async () => undefined),
  calendarioBvc: { findMany: vi.fn(async () => festivos.map((d) => ({ dia: new Date(`${d}T00:00:00.000Z`) }))) },
});

describe("dependenciasReales", () => {
  it("la credencial buena sirve; la ajena no, sin repetir la URL en el motivo", () => {
    const buena = dependenciasReales(proceso({ DATABASE_URL: URL_BUENA }).p, dbFalsa("inv_alertas") as never);
    expect(buena.credencial).toEqual({ ok: true });
    const mala = dependenciasReales(proceso({ DATABASE_URL: URL_BUENA.replace("inv_alertas", "inv_app") }).p, null);
    expect(mala.credencial).toMatchObject({ ok: false, estado: "SECRETO_INVALIDO" });
    expect(JSON.stringify(mala.credencial)).not.toContain(CLAVE);
  });

  it("el interruptor del intradía: solo 1 o true encienden; vacío, ausente o raro apagan", () => {
    const con = (v: string | undefined) => dependenciasReales(proceso(v === undefined ? { DATABASE_URL: URL_BUENA } : { DATABASE_URL: URL_BUENA, INV_INTRADIA_ENCENDIDO: v }).p, null).intradia;
    expect([con("1"), con("true")]).toEqual([true, true]);
    expect([con(undefined), con(""), con("0"), con("quizas")]).toEqual([false, false, false, false]);
  });

  it("revisarRol: true con inv_alertas, false con otro usuario", async () => {
    const buena = dependenciasReales(proceso({ DATABASE_URL: URL_BUENA }).p, dbFalsa("inv_alertas") as never);
    expect(await buena.revisarRol()).toBe(true);
    const ajena = dependenciasReales(proceso({ DATABASE_URL: URL_BUENA }).p, dbFalsa("inv_app") as never);
    expect(await ajena.revisarRol()).toBe(false);
  });

  it("esHabil: festivo y fin de semana no; un día normal sí", async () => {
    const d = dependenciasReales(proceso({ DATABASE_URL: URL_BUENA }).p, dbFalsa("inv_alertas", ["2027-03-22"]) as never);
    expect(await d.esHabil(new Date("2027-03-22T00:00:00.000Z"))).toBe(false);
    expect(await d.esHabil(new Date("2027-03-20T00:00:00.000Z"))).toBe(false);
    expect(await d.esHabil(new Date("2027-03-17T00:00:00.000Z"))).toBe(true);
  });

  it("el registro lleva la hora de Colombia y la marca [alertas]", () => {
    const m = proceso({ DATABASE_URL: URL_BUENA });
    dependenciasReales(m.p, null).registrar("hola");
    expect(m.texto()).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} COT \[alertas\] hola\n$/);
  });
});

describe("servir", () => {
  it("sin la credencial no crea la conexión, deja el latido SIN_SECRETO y sale con 0 al detenerse", async () => {
    const m = proceso({ DATABASE_URL: "" });
    const crearDb = vi.fn();
    const fin = servir(m.p, crearDb);
    for (let i = 0; i < 50 && m.manejadores.length === 0; i += 1) await new Promise((r) => setTimeout(r, 10));
    m.manejadores[0]!("SIGTERM");
    expect(await fin).toBe(0);
    expect(crearDb).not.toHaveBeenCalled();
    expect(m.texto()).toContain("sin INV_ALERTAS_DATABASE_URL");
    expect(readFileSync(path.join(m.dir, "bucle"), "utf8")).toContain("estado=DETENIDO");
  });

  it("con la credencial crea la conexión, la revisa y la cierra al detenerse", async () => {
    const m = proceso({ DATABASE_URL: URL_BUENA });
    const db = dbFalsa("inv_alertas");
    const fin = servir(m.p, () => db as never);
    for (let i = 0; i < 50 && m.manejadores.length === 0; i += 1) await new Promise((r) => setTimeout(r, 10));
    m.manejadores[0]!("SIGTERM");
    expect(await fin).toBe(0);
    expect(db.$disconnect).toHaveBeenCalled();
    expect(m.texto()).not.toContain(CLAVE);
    expect(m.texto()).toContain("intradía apagado");
  });
});

describe("esHabil · solo el día pedido", () => {
  it("pregunta al calendario por los no hábiles de ESE día, no por todos", async () => {
    const db = dbFalsa("inv_alertas");
    const d = dependenciasReales(proceso({ DATABASE_URL: URL_BUENA }).p, db as never);
    await d.esHabil(new Date("2027-03-17T00:00:00.000Z"));
    expect(db.calendarioBvc.findMany).toHaveBeenCalledWith({ where: { esHabil: false, dia: new Date("2027-03-17T00:00:00.000Z") }, select: { dia: true } });
  });
});

describe("servirAhora · una sola evaluación", () => {
  it("sin la credencial: sale con 1, lo dice y no crea la conexión", async () => {
    const m = proceso({ DATABASE_URL: "" });
    const crearDb = vi.fn();
    expect(await servirAhora(m.p, crearDb)).toBe(1);
    expect(crearDb).not.toHaveBeenCalled();
    expect(m.texto()).toContain("sin INV_ALERTAS_DATABASE_URL");
  });

  it("con otra conexión (current_user no es inv_alertas): sale con 1, no evalúa y cierra la base", async () => {
    const m = proceso({ DATABASE_URL: URL_BUENA });
    const db = dbFalsa("inv_app");
    expect(await servirAhora(m.p, () => db as never)).toBe(1);
    expect(m.texto()).toContain("no es la del rol inv_alertas");
    expect(db.$disconnect).toHaveBeenCalled();
  });

  it("si la evaluación falla: sale con 1 con el nombre del error, sin su mensaje, y cierra la base", async () => {
    const m = proceso({ DATABASE_URL: URL_BUENA });
    const db = dbFalsa("inv_alertas");
    expect(await servirAhora(m.p, () => db as never)).toBe(1);
    expect(m.texto()).toContain("no se evaluó:");
    expect(m.texto()).not.toContain(CLAVE);
    expect(db.$disconnect).toHaveBeenCalled();
  });
});

describe("una sola conexión (el rol inv_alertas admite 2: una del bucle y una de `ahora`)", () => {
  it("conUnaConexion fuerza connection_limit=1 y conserva lo demás de la URL", () => {
    const u = new URL(conUnaConexion(URL_BUENA));
    expect(u.searchParams.get("connection_limit")).toBe("1");
    expect(u.username).toBe("inv_alertas");
    expect(u.hostname).toBe("inv-008-db");
    expect(conUnaConexion(`postgresql://inv_alertas:${CLAVE}@inv-008-db/inversiones`)).toContain("connection_limit=1");
  });

  it("servirAhora abre la base con connection_limit=1 aunque la URL diga 2", async () => {
    const m = proceso({ DATABASE_URL: URL_BUENA });
    const crearDb = vi.fn((_url: string) => dbFalsa("inv_app") as never);
    await servirAhora(m.p, crearDb);
    expect(new URL(crearDb.mock.calls[0]![0]!).searchParams.get("connection_limit")).toBe("1");
  });

  it("el bucle también: una conexión, para que ahora quepa en el límite de 2 del rol", async () => {
    const m = proceso({ DATABASE_URL: URL_BUENA });
    const crearDb = vi.fn((_url: string) => dbFalsa("inv_alertas") as never);
    const fin = servir(m.p, crearDb);
    for (let i = 0; i < 50 && m.manejadores.length === 0; i += 1) await new Promise((r) => setTimeout(r, 10));
    m.manejadores[0]!("SIGTERM");
    await fin;
    expect(new URL(crearDb.mock.calls[0]![0]!).searchParams.get("connection_limit")).toBe("1");
  });
});

describe("servirAhora · un error de conexiones (P2037) sale con 1", () => {
  it("con P2037 al revisar el rol o al evaluar: salida 1 y el código en el mensaje, sin el mensaje del error", async () => {
    const m = proceso({ DATABASE_URL: URL_BUENA });
    const db = dbFalsa("inv_alertas");
    db.$queryRaw.mockRejectedValue(Object.assign(new Error(`too many connections ${CLAVE}`), { code: "P2037" }));
    expect(await servirAhora(m.p, () => db as never)).toBe(1);
    expect(m.texto()).toContain("P2037");
    expect(m.texto()).not.toContain(CLAVE);
    expect(db.$disconnect).toHaveBeenCalled();
  });
});
