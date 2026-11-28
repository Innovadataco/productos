// El lector de /analisis (frente analisis-pantalla, A2) contra la base de PRUEBAS: órdenes ficticias importadas con el
// importador de Trii, lotes armados a mano (como operar/informe.test.ts), cierres ficticios y un fondo FIC con su ajuste
// de caja y su valor de unidad. La base la comparten todos los archivos, en un orden que no se garantiza: la prueba
// elige su «hoy» a partir de lo que ya hay (nada posterior queda fuera de la historia) y solo afirma sobre lo suyo
// (AN<corrida>*). Órdenes y el aporte al fondo en diciembre de 2027 (el año sembrado del calendario; después de los cortes
// de los demás archivos); cierres y valor de unidad en 2020. Datos inventados.
import { Prisma, PrismaClient } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { importarArchivoTrii } from "@/importacion/trii/importar";

const exigirSesion = vi.hoisted(() => vi.fn());
vi.mock("@/auth/sesion", () => ({ exigirSesion }));

import { datosDeAnalisis } from "@/app/analisis/datos";
import PaginaAnalisis from "@/app/analisis/page";
import type { VistaAnalisis } from "@/app/analisis/vista";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const NEMO = { a: `AN${corrida}A`, b: `AN${corrida}B` } as const;
const FONDO = `Fondo ficticio de análisis ${corrida}`;
const ENCABEZADO = "Fecha y hora,Símbolo de la acción,Tipo de orden,Estado,Acciones completadas,Acciones pendientes,Precio por acción,Total invertido,Valor comisión,Total estimado";
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
// Cierres y valor de unidad de 2020: antes de 2022 y sin mover la fecha de referencia del tablero de los demás archivos
// (tablero.test.ts la fija en el 16-nov-2027); dentro de la ventana de ANIOS_HISTORIA_MAX años de la historia.
const DIAS_CIERRE = ["2020-03-16", "2020-03-17", "2020-03-18", "2020-03-19", "2020-03-20"];
const VALOR_UNIDAD_DIA = "2020-03-18";
let hoy = dia("2027-12-17");
let vista: VistaAnalisis;

const orden = (nemo: string, cantidad: number, precio: string) => {
  const total = new Prisma.Decimal(precio).mul(cantidad).toFixed(2);
  return `"6 dic 2027, 10:00 a. m.",${nemo},Compra,Aprobado,${cantidad}/${cantidad},0,${precio},${total},0,${total}`;
};

async function sembrar(duenoId: string): Promise<void> {
  const csv = [ENCABEZADO, orden(NEMO.a, 37, "4296.37"), orden(NEMO.b, 113, "1165.59"), ""].join("\n");
  const r = await importarArchivoTrii(db, { nombreArchivo: `ordenes-analisis-${corrida}.ficticio.csv`, contenido: new TextEncoder().encode(csv), usuarioId: duenoId });
  if (r.estado !== "CARGADO") throw new Error(`Las órdenes quedaron ${r.estado}`);
  for (const [k, nemo] of Object.entries(NEMO)) {
    const o = await db.orden.findFirstOrThrow({ where: { instrumento: { nemotecnico: nemo }, lado: "COMPRA" } });
    await db.lote.create({
      data: {
        instrumentoId: o.instrumentoId, origen: "COMPRA", ordenId: o.id, fuenteCosto: "TRII_ORDEN", fechaCompra: o.fechaOperacion, fechaLiquidacion: o.fechaLiquidacion,
        cantidad: o.cantidadCompletada, costoUnitario: o.precioUnitario, costoTotal: o.totalInvertido, comision: o.comision,
      },
    });
    const base = k === "a" ? 4313.71 : 1171.13;
    await db.precioCierre.createMany({
      data: DIAS_CIERRE.map((d, j) => ({ instrumentoId: o.instrumentoId, fecha: dia(d), precio: new Prisma.Decimal((base + 3.17 * j).toFixed(2)), fuente: "yahoo", estado: "NO_VERIFICADO" as const })),
    });
  }
  const fondoId = (await db.instrumento.create({ data: { tipo: "FIC", codigoFic: `8${corrida}1`, nombre: FONDO } })).id;
  // Una constitución lleva su ajuste de caja APORTE_FIC de la misma fecha y con −monto (migración movimiento_fondo_reglas).
  const ajuste = await db.ajusteCaja.create({
    data: { fecha: dia("2027-12-13"), monto: new Prisma.Decimal("-3961.2273"), categoria: "APORTE_FIC", fuente: "MANUAL", motivo: "aporte ficticio", creadoPorId: duenoId },
  });
  await db.movimientoFondo.create({
    data: { fondoId, fecha: dia("2027-12-13"), unidades: new Prisma.Decimal("311.2468"), monto: new Prisma.Decimal("3961.2273"), tipo: "CONSTITUCION", fuente: "MANUAL", ajusteCajaId: ajuste.id },
  });
  await db.valorUnidadFondo.create({ data: { fondoId, fechaValor: dia(VALOR_UNIDAD_DIA), valorUnidad: new Prisma.Decimal("12.73144190") } });
}

/** «Hoy»: el día más reciente que ya hay en la base (cierres, valores de unidad, movimientos del fondo), nunca antes del de la prueba. */
async function elegirHoy(): Promise<Date> {
  const [c, v, m] = await Promise.all([
    db.precioCierre.aggregate({ where: { reemplazadoEn: null }, _max: { fecha: true } }),
    db.valorUnidadFondo.aggregate({ where: { reemplazadoEn: null }, _max: { fechaValor: true } }),
    db.movimientoFondo.aggregate({ _max: { fecha: true } }),
  ]);
  const candidatos = [hoy, c._max.fecha, v._max.fechaValor, m._max.fecha].filter((d): d is Date => d instanceof Date);
  return new Date(Math.max(...candidatos.map((d) => d.getTime())));
}

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  const dueno = await db.usuario.create({ data: { email: `dueno-an-${corrida}@ejemplo.invalid`, rol: "DUENO" } });
  await sembrar(dueno.id);
  hoy = await elegirHoy();
  vista = await datosDeAnalisis(db, hoy, new Date(hoy.getTime() + 15 * 3_600_000));
});

afterAll(async () => {
  await db.$disconnect();
});

describe("datosDeAnalisis contra la base", () => {
  it("las especies de esta corrida, por su nombre del tablero, con su peso", () => {
    const mias = vista.especies.filter((e) => e.nombre === NEMO.a || e.nombre === NEMO.b);
    expect(mias.map((e) => e.nombre).sort()).toEqual([NEMO.a, NEMO.b]);
    for (const e of mias) expect(e.peso).toMatch(/ %$/);
    expect(JSON.stringify(vista.especies)).not.toMatch(/"nombre":"una especie"/);
  });

  it("el fondo de la corrida entra en la composición con su valor y la procedencia de su valor de unidad (SFC)", () => {
    const fila = vista.composicion.filas.find((f) => f.nombre === FONDO);
    expect(fila).toBeDefined();
    expect(fila!.valor).toBe("$ 3.963");
    expect(fila!.procedencia).toMatchObject({ dia: VALOR_UNIDAD_DIA, fuente: "sfc:qhpu-8ixx" });
    expect(fila!.procedencia!.traidoEn).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(vista.composicion.total).not.toBeNull();
  });

  it("el cierre más viejo trae los días hábiles de atraso, aproximados: el calendario no cubre 2020 ni 2021 (frente fuente-retraso)", () => {
    const vieja = vista.procedenciaAcciones!.masVieja;
    expect(vieja.habilesAtras).toBeGreaterThan(1500);
    expect(vieja.aniosSinFestivos).toEqual(expect.arrayContaining([2020, 2021]));
  });

  it("la fecha de los cierres viene compuesta (fecha-dato) y las cuatro partes están", () => {
    expect(vista.procedenciaAcciones).not.toBeNull();
    expect(vista.decisiones.horizontes.map((h) => h.titulo)).toEqual(["A 30 días", "A 90 días"]);
    expect(vista.puntos.every((p) => p.umbral.startsWith("umbral: "))).toBe(true);
  });

  it("la página entera, con un familiar: «Solo lectura» y sin nada que escriba", async () => {
    vi.useFakeTimers({ now: new Date(hoy.getTime() + 15 * 3_600_000), toFake: ["Date"] });
    try {
      exigirSesion.mockResolvedValueOnce({ id: "u-familia", rol: "FAMILIA" });
      const html = renderToStaticMarkup(await PaginaAnalisis());
      expect(html).toContain("Solo lectura");
      expect(html).toContain(NEMO.a);
      expect(html).not.toMatch(/<(form|button|input|textarea|select)\b/);
    } finally {
      vi.useRealTimers();
    }
  });
});
