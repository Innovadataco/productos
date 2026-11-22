// Lectura de la conciliación para la pantalla (PR-C, GATE 1 aprobada) contra la base de PRUEBAS. Solo lectura, en
// una transacción REPEATABLE READ de solo lectura: la última conciliación guardada de un corte (con nemotécnico y
// nombre de cada control), si sigue al día frente a un recálculo, y las operaciones por liquidar (T+2) leídas en vivo.
// Nunca el encargo ni el crudo. Miércoles de 2025 (los demás archivos usan otros años; `fechaCorte` es única).
// Datos inventados.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { conciliarCertificacion } from "@/conciliacion/conciliar";
import * as esperado from "@/conciliacion/esperado";
import { MAX_CORTES, cortesDisponibles, enSoloLectura, leerConciliacion, ultimaConciliacion } from "@/conciliacion/leer";
import { importarCertificacion } from "@/importacion/av/importar";
import { importarArchivoTrii } from "@/importacion/trii/importar";
import { CERTIFICACION_FICTICIA, generarCertificacionPdf, type EspecCertificacion } from "../fixtures/av/certificacion.ficticio";

vi.mock("@/conciliacion/esperado", async (original) => {
  const real = await original<typeof import("@/conciliacion/esperado")>();
  return { ...real, leerEntradas: vi.fn(real.leerEntradas) };
});

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const digitos = corrida.replace(/\D/g, "").padEnd(3, "0").slice(0, 3);
const DIA = 86_400_000;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ENCARGO = "000777123";
let k = 0;
let duenoId = "";

const trii = (d: Date) => `"${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}, 10:00 a. m."`;
const orden = (d: Date, nemo: string, lado: "Compra" | "Venta", cantidad: number, precio: number) =>
  `${trii(d)},${nemo},${lado},Aprobado,${cantidad}/${cantidad},0,${precio}.0,${cantidad * precio}.0,0,${cantidad * precio}.0`;
const ENCABEZADO = "Fecha y hora,Símbolo de la acción,Tipo de orden,Estado,Acciones completadas,Acciones pendientes,Precio por acción,Total invertido,Valor comisión,Total estimado";

/** Un miércoles distinto de 2025 por caso: dos especies (B vende el día anterior al corte: T+2) y un fondo. */
async function caso() {
  k += 1;
  const fecha = new Date(Date.UTC(2025, 1, 5) + (k - 1) * 7 * DIA);
  const nemos = ["A", "B"].map((l) => `L${corrida}${k}${l}`);
  const antes = new Date(fecha.getTime() - 14 * DIA);
  const filas = [orden(antes, nemos[0]!, "Compra", 150, 1000), orden(antes, nemos[1]!, "Compra", 2600, 20), orden(new Date(fecha.getTime() - DIA), nemos[1]!, "Venta", 600, 20)];
  const t = await importarArchivoTrii(db, { nombreArchivo: `ordenes-leer-${k}.ficticio.csv`, contenido: new TextEncoder().encode(`${ENCABEZADO}\n${filas.join("\n")}\n`), usuarioId: duenoId });
  expect(t.estado).toBe("CARGADO");
  const fic = await db.instrumento.create({ data: { tipo: "FIC", codigoFic: `3${String(k).padStart(3, "0")}${digitos}`, nombre: `Fondo ficticio de lectura ${k}` } });
  const rv = CERTIFICACION_FICTICIA.rentaVariable;
  const espec: EspecCertificacion = {
    ...CERTIFICACION_FICTICIA,
    fondos: [{ ...CERTIFICACION_FICTICIA.fondos[0]!, nit: `99300${String(k).padStart(4, "0")}-0`, encargo: ENCARGO }],
    rentaVariable: [{ ...rv[0]!, nemo: nemos[0]! }, { ...rv[1]!, nemo: nemos[0]! }, { ...rv[2]!, nemo: nemos[1]! }],
    creadoEn: `D:${new Date(fecha.getTime() + DIA).toISOString().slice(0, 10).replace(/-/g, "")}101500-05'00'`,
  };
  const c = await importarCertificacion(db, { contenido: generarCertificacionPdf(espec), usuarioId: duenoId, fechaCorte: fecha, fondoCodigo: fic.codigoFic!, hoy: new Date(fecha.getTime() + 2 * DIA) });
  expect(c.errores).toEqual([]);
  const ids = await Promise.all(nemos.map(async (n) => (await db.instrumento.findUniqueOrThrow({ where: { nemotecnico: n } })).id));
  return { fecha, nemos, ids, fic };
}

const cierre = (instrumentoId: string, fecha: Date, precio: string) =>
  db.precioCierre.create({ data: { instrumentoId, fecha, precio: new Prisma.Decimal(precio), fuente: "yahoo", estado: "VERIFICADO" } });

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  duenoId = (await db.usuario.create({ data: { email: `dueno-leer-${corrida.toLowerCase()}@ejemplo.invalid`, rol: "DUENO" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("enSoloLectura", () => {
  it("abre REPEATABLE READ de solo lectura: muestra el modo y una escritura adentro falla", async () => {
    const modo = await enSoloLectura(db, (tx) => tx.$queryRaw<{ aislamiento: string; soloLectura: string }[]>`SELECT current_setting('transaction_isolation') AS "aislamiento", current_setting('transaction_read_only') AS "soloLectura"`);
    expect(modo).toEqual([{ aislamiento: "repeatable read", soloLectura: "on" }]);
    const correo = `no-debe-quedar-${corrida.toLowerCase()}@ejemplo.invalid`;
    await expect(enSoloLectura(db, (tx) => tx.usuario.create({ data: { email: correo, rol: "DUENO" } }))).rejects.toThrow(/read-only transaction/);
    expect(await db.usuario.count({ where: { email: correo } })).toBe(0);
  });
});

describe("leerConciliacion", () => {
  it("sin certificación en esa fecha devuelve null", async () => {
    expect(await leerConciliacion(db, new Date(Date.UTC(2025, 0, 8)))).toBeNull();
  });

  it("certificación sin conciliar: sin conciliación ni frescura, pero con lo que está por liquidar", async () => {
    const c = await caso();
    const l = await leerConciliacion(db, c.fecha);
    expect(l).toMatchObject({ fechaCorte: c.fecha, conciliacion: null, frescura: null });
    expect(l!.porLiquidar).toEqual([
      { nemotecnico: c.nemos[1], operacion: "VENTA", cantidad: 600n, fechaOperacion: new Date(c.fecha.getTime() - DIA), fechaLiquidacion: new Date(c.fecha.getTime() + DIA) },
    ]);
  });

  it("la última conciliación del corte, con nemotécnico y nombre de cada control, al día; nunca el encargo ni el crudo", async () => {
    const c = await caso();
    await cierre(c.ids[0]!, c.fecha, "1000");
    await cierre(c.ids[1]!, c.fecha, "20");
    const r = await conciliarCertificacion(db, { fechaCorte: c.fecha });
    const l = (await leerConciliacion(db, c.fecha))!;
    expect(l.frescura).toBe("AL_DIA");
    expect(l.conciliacion).toMatchObject({ id: r.conciliacionId, fechaCorte: c.fecha, versionCalculo: "conciliacion-v2", resultado: r.resultado });
    expect(l.conciliacion!.calculadaEn).toBeInstanceOf(Date);
    const de = (tipo: string, id: string | null) => l.conciliacion!.controles.find((x) => x.tipo === tipo && x.instrumentoId === id);
    expect(de("CANTIDAD", c.ids[0]!)).toMatchObject({ resultado: "CUADRA", instrumento: { nemotecnico: c.nemos[0], tipo: "ACCION" } });
    expect(de("CANTIDAD", c.ids[1]!)).toMatchObject({ resultado: "PENDIENTE_LIQUIDACION", codigoMotivo: "t_mas_2" });
    expect(de("FONDO", c.fic.id)).toMatchObject({ codigoMotivo: "fondo_sin_unidades", instrumento: { nombre: c.fic.nombre, tipo: "FIC", nemotecnico: null } });
    expect(de("EFECTIVO", null)).toMatchObject({ instrumento: null });
    expect(de("CANTIDAD", c.ids[0]!)!.esperado).toBeInstanceOf(Prisma.Decimal);
    const texto = JSON.stringify(l, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v));
    expect(texto).not.toContain(ENCARGO);
    expect(texto).not.toMatch(/"(encargo|crudo|cuenta|referenciaPdf)"/);
    const cifrado = (await db.certificacionFondo.findFirstOrThrow({ where: { instrumentoId: c.fic.id }, select: { encargo: true } })).encargo;
    expect(cifrado).not.toBe(ENCARGO);
    // JSON.stringify escapa las comillas del sobre: se busca también cada cadena larga del sobre por separado.
    const partes = Object.values(JSON.parse(cifrado) as Record<string, unknown>).filter((v): v is string => typeof v === "string" && v.length >= 12);
    expect(partes.length).toBeGreaterThanOrEqual(2);
    for (const prohibido of [cifrado, JSON.stringify(cifrado), ...partes]) expect(texto).not.toContain(prohibido);
  });

  it("si los datos cambian después de conciliar, queda DESACTUALIZADA; al volver a conciliar, lee la nueva y está al día", async () => {
    const c = await caso();
    await cierre(c.ids[0]!, c.fecha, "1000");
    const primera = await conciliarCertificacion(db, { fechaCorte: c.fecha });
    expect((await leerConciliacion(db, c.fecha))!.frescura).toBe("AL_DIA");
    await cierre(c.ids[1]!, c.fecha, "20");
    expect((await leerConciliacion(db, c.fecha))!.frescura).toBe("DESACTUALIZADA");
    const segunda = await conciliarCertificacion(db, { fechaCorte: c.fecha });
    const l = (await leerConciliacion(db, c.fecha))!;
    expect(segunda.conciliacionId).not.toBe(primera.conciliacionId);
    expect(l.conciliacion!.id).toBe(segunda.conciliacionId);
    expect(l.frescura).toBe("AL_DIA");
  });

  it("si el recálculo falla, NO_SE_PUDO_COMPROBAR y se muestra igual lo guardado; se registra solo el nombre del error", async () => {
    const c = await caso();
    const r = await conciliarCertificacion(db, { fechaCorte: c.fecha });
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(esperado.leerEntradas).mockRejectedValueOnce(new Error(`fallo ficticio con ${ENCARGO}`));
    try {
      const l = (await leerConciliacion(db, c.fecha))!;
      expect(l.frescura).toBe("NO_SE_PUDO_COMPROBAR");
      expect(l.conciliacion!.id).toBe(r.conciliacionId);
      expect(registro).toHaveBeenCalledTimes(1);
      expect(registro).toHaveBeenCalledWith("[conciliacion] no se pudo comprobar si está al día (error: Error)");
      expect(JSON.stringify(registro.mock.calls)).not.toContain(ENCARGO);
    } finally {
      registro.mockRestore();
    }
  });
});

describe("leerConciliacion: el recálculo falla en la base (code-reviewer MEDIO)", () => {
  it("un error SQL real dentro del recálculo no tumba la lectura: NO_SE_PUDO_COMPROBAR, lo guardado y lo por liquidar se muestran", async () => {
    const c = await caso();
    const r = await conciliarCertificacion(db, { fechaCorte: c.fecha });
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(esperado.leerEntradas).mockImplementationOnce(async (tx) => {
      await tx.$queryRawUnsafe("SELECT * FROM tabla_ficticia_que_no_existe");
      throw new Error("no se llega aquí");
    });
    try {
      const l = (await leerConciliacion(db, c.fecha))!;
      expect(l.frescura).toBe("NO_SE_PUDO_COMPROBAR");
      expect(l.conciliacion!.id).toBe(r.conciliacionId);
      expect(l.porLiquidar).toHaveLength(1);
      expect(registro).toHaveBeenCalledWith(expect.stringMatching(/^\[conciliacion\] no se pudo comprobar si está al día \(error: PrismaClientKnownRequestError\/P2010\)$/));
      expect((await leerConciliacion(db, c.fecha))!.frescura).toBe("AL_DIA");
    } finally {
      registro.mockRestore();
    }
  });
});

describe("cortesDisponibles y ultimaConciliacion", () => {
  it("lista los cortes del más reciente al más viejo, con el resultado de su última conciliación (o null), con tope", async () => {
    const sinConciliar = await caso();
    const conciliado = await caso();
    await conciliarCertificacion(db, { fechaCorte: conciliado.fecha });
    const cortes = await cortesDisponibles(db);
    expect(cortes.length).toBeLessThanOrEqual(MAX_CORTES);
    const fechas = cortes.map((x) => x.fechaCorte.getTime());
    expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
    const total = await db.certificacion.count();
    if (total <= MAX_CORTES) {
      expect(cortes).toContainEqual({ fechaCorte: sinConciliar.fecha, resultado: null });
      expect(cortes).toContainEqual({ fechaCorte: conciliado.fecha, resultado: expect.stringMatching(/^(CUADRA|NO_CUADRA|PARCIAL)$/) });
    }
  });

  it("la última conciliación es la del corte más reciente, con el resultado de su última corrida", async () => {
    const u = await ultimaConciliacion(db);
    // La más reciente VIGENTE: una retirada (corte equivocado) no cuenta (frente certificacion-corte-real).
    const reciente = await db.certificacion.findFirstOrThrow({
      where: { retiradaEn: null },
      orderBy: { fechaCorte: "desc" },
      select: { fechaCorte: true, conciliaciones: { select: { resultado: true }, orderBy: [{ calculadaEn: "desc" }, { id: "desc" }], take: 1 } },
    });
    expect(u).toEqual({ fechaCorte: reciente.fechaCorte, resultado: reciente.conciliaciones[0]?.resultado ?? null });
  });
});
