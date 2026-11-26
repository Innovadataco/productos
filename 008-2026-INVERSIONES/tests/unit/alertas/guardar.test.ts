// De la alerta del motor a la fila de la tabla (puro): la evidencia que se guarda, sin texto libre y sin montos del
// portafolio; el decreto de FECHA_EX va en decretoId; el umbral que disparó y la procedencia del dato (hora de traída y fuente).
import { Prisma } from "@prisma/client";
import { codigoDeError } from "@/alertas/guardar";
import { describe, expect, it, vi } from "vitest";
import { filaDeAlerta, guardarAlertas, MOTOR_VERSION, type ContextoGuardado } from "@/alertas/guardar";
import { claveDeAlerta, type Alerta } from "@/alertas/tipos";
import { UMBRALES_OMISION } from "@/alertas/umbrales";

const dec = (v: string) => new Prisma.Decimal(v);
const TRAIDO_CIERRE = new Date("2026-11-25T23:20:00.000Z");
const TRAIDO_BARRA = new Date("2026-11-25T16:31:10.000Z");
const BARRA = new Date("2026-11-25T16:10:00.000Z");
const ctx = (cambios: Partial<ContextoGuardado> = {}): ContextoGuardado => ({
  umbrales: UMBRALES_OMISION,
  umbralVersionId: "u-1",
  procedencia: new Map([["e-1", { cierre: { traidoEn: TRAIDO_CIERRE, fuente: "yahoo" }, intradia: { instante: BARRA, traidoEn: TRAIDO_BARRA, fuente: "yahoo" } }]]),
  ...cambios,
});
const base = (a: Partial<Alerta> & Pick<Alerta, "tipo">): Alerta => ({
  clave: claveDeAlerta("2026-11-25", a.tipo, a.instrumentoId ?? null, a.reglaId ?? null, a.sentido ?? null),
  dia: "2026-11-25", instrumentoId: "e-1", reglaId: null, sentido: null, base: null, datos: {}, ...a,
});

describe("filaDeAlerta", () => {
  it("nivel cruzado con el cierre: precio y nivel, sin umbral, con la procedencia del cierre", () => {
    const f = filaDeAlerta(base({ tipo: "NIVEL_CRUZADO", reglaId: "r-1", sentido: "BAJO", base: "CIERRE", datos: { nivel: dec("1100"), precio: dec("990.5") } }), ctx());
    expect(f).toMatchObject({ tipo: "NIVEL_CRUZADO", instrumentoId: "e-1", reglaId: "r-1", decretoId: null, sentido: "BAJO", base: "CIERRE", umbral: null, motorVersion: MOTOR_VERSION, umbralVersionId: "u-1", traidoEn: TRAIDO_CIERRE, fuente: "yahoo" });
    expect(f.dia).toEqual(new Date("2026-11-25T00:00:00.000Z"));
    expect(String(f.precio)).toBe("990.5");
    expect(String(f.referencia)).toBe("1100");
    expect(f.instanteDato).toBeNull();
  });

  it("nivel cerca con la barra intradía: la distancia va en variacionPct, el umbral de cerca, la hora de la barra y su retraso", () => {
    const f = filaDeAlerta(base({ tipo: "NIVEL_CERCA", reglaId: "r-1", sentido: "SOBRE", base: "INTRADIA", datos: { nivel: dec("1100"), precio: dec("1120"), distanciaPct: dec("1.82"), instante: BARRA, conRetraso: true } }), ctx());
    expect(String(f.variacionPct)).toBe("1.82");
    expect(String(f.umbral)).toBe("3");
    expect(f.instanteDato).toEqual(BARRA);
    expect(f.traidoEn).toEqual(TRAIDO_BARRA);
    expect(f.conRetraso).toBe(true);
  });

  it("movimiento: variación con signo, umbral de movimiento y si el día era fecha ex", () => {
    const f = filaDeAlerta(base({ tipo: "MOVIMIENTO_DIA", sentido: "BAJO", base: "CIERRE", datos: { precio: dec("90"), variacionPct: dec("-10"), esFechaEx: true } }), ctx());
    expect(String(f.variacionPct)).toBe("-10");
    expect(String(f.umbral)).toBe("3");
    expect(f.esFechaEx).toBe(true);
  });

  it("caída del portafolio: sin especie, sin montos (ni precio), solo el porcentaje y su umbral", () => {
    const f = filaDeAlerta(base({ tipo: "CAIDA_PORTAFOLIO", instrumentoId: null, sentido: "BAJO", base: "CIERRE", datos: { variacionPct: dec("-2.4") } }), ctx());
    expect(f).toMatchObject({ instrumentoId: null, precio: null, referencia: null, traidoEn: null, fuente: null });
    expect(String(f.variacionPct)).toBe("-2.4");
    expect(String(f.umbral)).toBe("2");
  });

  it("dato viejo con el intradía: los minutos de edad y el límite; sin barra, sin hora; con el cierre, sin límite", () => {
    const viejo = filaDeAlerta(base({ tipo: "DATO_VIEJO", sentido: "RUEDA", base: "INTRADIA", datos: { instante: BARRA, minutosDeEdad: 75, umbralMin: 30 } }), ctx());
    expect(viejo).toMatchObject({ minutosDeEdad: 75, instanteDato: BARRA, sentido: "RUEDA" });
    expect(String(viejo.umbral)).toBe("30");
    const sinBarra = filaDeAlerta(base({ tipo: "DATO_VIEJO", sentido: "RUEDA", base: "INTRADIA", datos: { minutosDeEdad: 100, umbralMin: 30 } }), ctx());
    expect(sinBarra.instanteDato).toBeNull();
    const cierre = filaDeAlerta(base({ tipo: "DATO_VIEJO", sentido: "CIERRE_FALTANTE", base: "CIERRE", datos: {} }), ctx());
    expect(cierre.umbral).toBeNull();
    expect(cierre.sentido).toBe("CIERRE_FALTANTE");
  });

  it("dato viejo sin ninguna barra de hoy: aunque exista una de otro día, no se le atribuye hora de traída ni fuente", () => {
    const f = filaDeAlerta(base({ tipo: "DATO_VIEJO", sentido: "RUEDA", base: "INTRADIA", datos: { minutosDeEdad: 100, umbralMin: 30 } }), ctx());
    expect(f).toMatchObject({ instanteDato: null, traidoEn: null, fuente: null });
  });

  it("una barra distinta de la última leída no hereda su hora de traída", () => {
    const otra = new Date("2026-11-25T15:00:00.000Z");
    const f = filaDeAlerta(base({ tipo: "NIVEL_CERCA", reglaId: "r-1", sentido: "SOBRE", base: "INTRADIA", datos: { nivel: dec("1100"), precio: dec("1120"), instante: otra } }), ctx());
    expect(f).toMatchObject({ instanteDato: otra, traidoEn: null, fuente: null });
  });

  it("fecha ex: el decreto (que en el motor viaja como reglaId) va en decretoId, sin regla ni sentido ni base", () => {
    const f = filaDeAlerta(base({ tipo: "FECHA_EX", reglaId: "d-1", datos: { fechaEx: new Date("2026-11-26T00:00:00Z"), esFechaEx: false } }), ctx());
    expect(f).toMatchObject({ reglaId: null, decretoId: "d-1", sentido: null, base: null, esFechaEx: false });
    expect(String(f.umbral)).toBe("3");
  });

  it("sin versión de umbrales (rigen las omisiones) la fila lo dice con null; una especie sin procedencia no inventa hora ni fuente", () => {
    const f = filaDeAlerta(base({ tipo: "MOVIMIENTO_DIA", instrumentoId: "e-2", sentido: "SOBRE", base: "CIERRE", datos: { precio: dec("5"), variacionPct: dec("4") } }), ctx({ umbralVersionId: null }));
    expect(f).toMatchObject({ umbralVersionId: null, traidoEn: null, fuente: null });
  });

  it("la fila no lleva ningún campo de texto libre (solo las listas cerradas y la fuente)", () => {
    const f = filaDeAlerta(base({ tipo: "NIVEL_CRUZADO", reglaId: "r-1", sentido: "BAJO", base: "CIERRE", datos: { nivel: dec("1"), precio: dec("1") } }), ctx());
    const textos = Object.entries(f).filter(([, v]) => typeof v === "string").map(([k]) => k).sort();
    expect(textos).toEqual(["base", "fuente", "instrumentoId", "motorVersion", "reglaId", "sentido", "tipo", "umbralVersionId"].sort());
  });
});

const restriccion = (code: string) => new Prisma.PrismaClientKnownRequestError("detalle con 4613", { code, clientVersion: "5.22.0" });
const checkDePostgres = () => Object.assign(new Error('Raw query failed. PostgresError { code: "23514", message: "alerta: el día no puede ser futuro" }'), { name: "PrismaClientUnknownRequestError" });

describe("guardarAlertas", () => {
  const una = base({ tipo: "MOVIMIENTO_DIA", sentido: "BAJO", base: "CIERRE", datos: { precio: dec("90"), variacionPct: dec("-10") } });
  const otra = base({ tipo: "MOVIMIENTO_DIA", instrumentoId: "e-3", sentido: "SOBRE", base: "CIERRE", datos: { precio: dec("90"), variacionPct: dec("10") } });

  it("sin alertas no toca la base", async () => {
    const createMany = vi.fn();
    expect(await guardarAlertas({ alerta: { createMany, create: vi.fn() } } as never, [], ctx())).toEqual({ evaluadas: 0, insertadas: 0, duplicadas: 0, fallidas: 0 });
    expect(createMany).not.toHaveBeenCalled();
  });

  it("guarda todas de una vez con skipDuplicates y cuenta lo duplicado", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const r = await guardarAlertas({ alerta: { createMany, create: vi.fn() } } as never, [una, otra], ctx());
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    expect(r).toEqual({ evaluadas: 2, insertadas: 1, duplicadas: 1, fallidas: 0 });
  });

  it("si el lote falla, guarda de a una: la que la base rechaza se cuenta como fallida y las demás quedan (sin perder el resto)", async () => {
    const createMany = vi.fn().mockRejectedValue(restriccion("P2004"));
    const create = vi.fn().mockRejectedValueOnce(restriccion("P2004")).mockResolvedValueOnce({});
    const r = await guardarAlertas({ alerta: { createMany, create } } as never, [una, otra], ctx());
    expect(r).toEqual({ evaluadas: 2, insertadas: 1, duplicadas: 0, fallidas: 1 });
  });

  it("una de a una que ya existía (violación única) cuenta como duplicada, no como fallida", async () => {
    const createMany = vi.fn().mockRejectedValue(restriccion("P2003"));
    const unica = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    const create = vi.fn().mockRejectedValueOnce(unica).mockResolvedValueOnce({});
    const r = await guardarAlertas({ alerta: { createMany, create } } as never, [una, otra], ctx());
    expect(r).toEqual({ evaluadas: 2, insertadas: 1, duplicadas: 1, fallidas: 0 });
  });

  it("una violación de CHECK de la base (23514, sin código de Prisma) también cae a «de a una»", async () => {
    const createMany = vi.fn().mockRejectedValue(checkDePostgres());
    const create = vi.fn().mockRejectedValueOnce(checkDePostgres()).mockResolvedValueOnce({});
    expect(await guardarAlertas({ alerta: { createMany, create } } as never, [una, otra], ctx())).toEqual({ evaluadas: 2, insertadas: 1, duplicadas: 0, fallidas: 1 });
  });

  it.each([
    ["la base no responde (P1001)", restriccion("P1001")],
    ["se agotó el tiempo (P1002)", restriccion("P1002")],
    ["se cerró la conexión (P1017)", restriccion("P1017")],
    ["permiso denegado (42501)", Object.assign(new Error('PostgresError { code: "42501", message: "permission denied for table alerta" }'), { name: "PrismaClientUnknownRequestError" })],
    ["un error cualquiera", new Error("boom")],
  ])("%s: se propaga (nada de «de a una») para que el script salga con 1", async (_n, error) => {
    const createMany = vi.fn().mockRejectedValue(error);
    const create = vi.fn();
    await expect(guardarAlertas({ alerta: { createMany, create } } as never, [una, otra], ctx())).rejects.toBe(error);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("codigoDeError (para el registro: solo el código, nunca el mensaje)", () => {
  it("el de Prisma, el SQLSTATE del mensaje o nada", () => {
    expect(codigoDeError(restriccion("P1001"))).toBe("P1001");
    expect(codigoDeError(checkDePostgres())).toBe("23514");
    expect(codigoDeError(new Error("sin código 4613"))).toBeNull();
    expect(codigoDeError("texto")).toBeNull();
  });
});
