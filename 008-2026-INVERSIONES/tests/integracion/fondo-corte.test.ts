// Regla del CEO (la SFC publica con T−2): la conciliación del corte NUNCA usa un valor de unidad de otro día como si
// fuera del corte. Si falta el del día exacto, el concepto FONDO queda «sin_valor_unidad_al_corte», aunque haya
// valores de los días de antes o de después que cuadrarían, o uno del corte ya reemplazado (historia). Con el del
// corte importado por la vía B, cuadra. Contra la base de PRUEBAS, con la certificación ficticia y la cadena real:
// registrar el fondo → certificación con --fondo → valores del fondo (CSV) → conciliar. Datos inventados.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conciliarCertificacion } from "@/conciliacion/conciliar";
import { escribirCsvValoresFondo, leerCsvValoresFondo } from "@/fondo/csv-valores";
import { importarValoresFondo } from "@/fondo/importar";
import { registrarFondo } from "@/fondo/registrar";
import type { ValorDia } from "@/fondo/sfc";
import { importarCertificacion } from "@/importacion/av/importar";
import { CERTIFICACION_FICTICIA, generarCertificacionPdf } from "../fixtures/av/certificacion.ficticio";

const db = new PrismaClient();
const corrida = String(Date.now()).slice(-4);
const DIA = 86_400_000;
const dec = (v: string) => new Prisma.Decimal(v);
/**
 * Un jueves hábil de la BVC que no usa ningún otro archivo de integración: la certificación es única por corte, y los
 * otros archivos toman miércoles seguidos de 2026 y 2027.
 */
const CORTE = new Date(Date.UTC(2025, 9, 16));
const HOY = new Date(CORTE.getTime() + 2 * DIA);
const AHORA = new Date(HOY.getTime() + 15 * 3_600_000);
const dias = (d: number) => new Date(CORTE.getTime() + d * DIA);
let fondoId = "";
let codigo = "";

/** Importa por la vía B (CSV del exportador → importador): el mismo camino que en producción. */
async function importar(vs: readonly ValorDia[]) {
  const w = escribirCsvValoresFondo([{ codigoFic: codigo, participacion: "907", valores: vs }], HOY);
  if (!w.ok) throw new Error(w.codigo);
  const leido = leerCsvValoresFondo(new TextEncoder().encode(w.texto), HOY);
  if (!leido.ok) throw new Error(JSON.stringify(leido));
  const r = await importarValoresFondo(db, leido, { ahora: AHORA });
  expect(r.guardado.fallidos).toEqual([]);
}

async function controlFondo() {
  const { conciliacionId } = await conciliarCertificacion(db, { fechaCorte: CORTE });
  const c = await db.controlConciliacion.findFirstOrThrow({ where: { conciliacionId, tipo: "FONDO", instrumentoId: fondoId } });
  return [c.resultado, c.codigoMotivo, c.esperado?.toString() ?? null, c.real?.toString() ?? null];
}

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  const duenoId = (await db.usuario.create({ data: { email: `dueno-fondo-corte-${corrida}@ejemplo.invalid`, rol: "DUENO" } })).id;
  codigo = `6${corrida}${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
  fondoId = (await registrarFondo(db, { codigo, participacion: "907", nombre: "Fondo ficticio del corte" }, HOY)).instrumentoId;
  const espec = {
    ...CERTIFICACION_FICTICIA,
    fondos: [{ ...CERTIFICACION_FICTICIA.fondos[0]!, nit: `99701${corrida}-0` }],
    creadoEn: `D:${new Date(CORTE.getTime() + DIA).toISOString().slice(0, 10).replace(/-/g, "")}101500-05'00'`,
  };
  const cert = await importarCertificacion(db, { contenido: generarCertificacionPdf(espec), usuarioId: duenoId, fechaCorte: CORTE, fondoCodigo: codigo, hoy: HOY });
  expect(cert.errores).toEqual([]);
  // Las unidades del fondo (1000) y el saldo certificado (6 250 000): cuadra solo con 6250 del día del corte.
  // La constitución lleva su ajuste de caja APORTE_FIC, de la misma fecha y con −monto (migración movimiento_fondo_reglas).
  // El monto, inventado: el control FONDO no lo usa.
  const aporte = await db.ajusteCaja.create({
    data: { fecha: dias(-20), monto: dec("-6173.4129"), categoria: "APORTE_FIC", fuente: "MANUAL", motivo: "aporte ficticio", creadoPorId: duenoId },
  });
  await db.movimientoFondo.create({
    data: { fondoId, fecha: dias(-20), unidades: dec("1000"), monto: dec("6173.4129"), tipo: "CONSTITUCION", fuente: "MANUAL", ajusteCajaId: aporte.id },
  });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("regla T−2: el valor de unidad de la conciliación es SOLO el del día del corte", () => {
  it("con valores de corte−2, corte−1 y corte+1 que cuadrarían, y el del corte reemplazado: sin_valor_unidad_al_corte; con el del corte: CUADRA", async () => {
    // Lo que trae la SFC con T−2 al día siguiente del corte: hasta corte−1. Los dos cuadrarían dentro del 0,5 %.
    await importar([{ fecha: dias(-2), valorUnidad: "6249", valorFondo: null }, { fecha: dias(-1), valorUnidad: "6249.5", valorFondo: null }]);
    expect(await controlFondo()).toEqual(["NO_CUADRA", "sin_valor_unidad_al_corte", null, "6250000"]);

    // Un valor del corte que ya es historia (reemplazado) tampoco cuenta; uno del día siguiente, tampoco.
    await db.valorUnidadFondo.create({ data: { fondoId, fechaValor: CORTE, valorUnidad: dec("6250"), reemplazadoEn: new Date() } });
    await importar([{ fecha: dias(1), valorUnidad: "6250", valorFondo: null }]);
    expect(await controlFondo()).toEqual(["NO_CUADRA", "sin_valor_unidad_al_corte", null, "6250000"]);

    // Con el valor del día exacto del corte (llega dos días hábiles después), cuadra.
    await importar([{ fecha: CORTE, valorUnidad: "6250", valorFondo: null }]);
    expect(await controlFondo()).toEqual(["CUADRA", null, "6250000", "6250000"]);
  });
});
