// leer-entrada + guardar + correr (src/alertas) contra la base de PRUEBAS y con los privilegios EXACTOS de inv_alertas
// (apoyo/rol-alertas.ts: un rol predefinido sin privilegios recibe los GRANT de privilegios.sql y un cliente de una conexión
// hace SET ROLE). Datos inventados (especies propias de la corrida); el reloj entra por `ahora` (días de 2026 ya pasados:
// la base no deja alertas de días futuros). Cubre: lee solo lo que tiene permitido, evalúa, guarda, la segunda corrida inserta 0
// y el registro no lleva nemotécnicos ni cifras.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cifrarCrudo } from "@/cifrado/campos";
import { correrAlertas } from "@/alertas/correr";
import { diaHabilAnterior, leerEntrada } from "@/alertas/leer-entrada";
import { UMBRALES_OMISION } from "@/alertas/umbrales";
import { importarArchivoTrii } from "@/importacion/trii/importar";
import { construirLotes } from "@/lotes/construir";
import { diaIso, esDiaHabil, fechaEnBogota } from "@/precios/horario";
import { limpiarEspecies } from "./apoyo/limpiar-especies";
import { limpiarPlan } from "./apoyo/limpiar-plan";
import { limpiarUmbrales } from "./apoyo/limpiar-umbrales";
import { conRolAlertas, type RolAlertas } from "./apoyo/rol-alertas";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const NEMO_A = `ZA${corrida}`;
const NEMO_B = `ZB${corrida}`;
const NEMO_C = `ZC${corrida}`;
const dia = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const dec = (v: string) => new Prisma.Decimal(v);
const ORD = "Fecha y hora,Símbolo de la acción,Tipo de orden,Estado,Acciones completadas,Acciones pendientes,Precio por acción,Total invertido,Valor comisión,Total estimado\n";
/**
 * Los días son los de HOY (Colombia): la base no deja guardar alertas de días futuros ni de hace más de un día al rol del servicio
 * (disparador inv_alerta_insercion). El reloj del motor entra por `ahora`, igual a HOY a las 18:30 (cierre) o a las 12:20 (rueda).
 */
const HOY = fechaEnBogota(new Date());
const HOY_ISO = diaIso(HOY);
const MS_DIA = 86_400_000;
const CIERRE_AHORA = new Date(HOY.getTime() + 23.5 * 3_600_000);
const RUEDA_AHORA = new Date(HOY.getTime() + 17 * 3_600_000 + 20 * 60_000);
/** El instante de la barra intradía: la medianoche de Colombia de HOY (nunca del futuro). */
const BARRA = new Date(HOY.getTime() + 5 * 3_600_000);

let rol: RolAlertas;
let duenoId = "";
let idA = "";
let idB = "";
let idC = "";
let previo = "";
let habil = false;
let idRegla = "";
let idPlan = "";
/** La versión de umbrales con los valores de omisión que siembra esta prueba (la vigente: la de mayor versión). */
let umbralSembrado = "";
let idDecreto = "";
/** La base de pruebas es compartida con otros archivos: se cuentan las alertas de la primera corrida, no se supone cuántas son. */
let evaluadasAlCierre = 0;
/** Las versiones de umbrales que crea una prueba (se borran al final). */
const nuevasVersiones: string[] = [];

async function sembrar(): Promise<void> {
  const dueno = await db.usuario.create({ data: { email: `dueno-alertas-leer-${corrida.toLowerCase()}@ejemplo.invalid`, rol: "DUENO" } });
  duenoId = dueno.id;
  const r = await importarArchivoTrii(db, {
    nombreArchivo: "o-alertas.ficticio.csv", usuarioId: dueno.id,
    contenido: new TextEncoder().encode(ORD + `"9 feb 2026, 10:00 a. m.",${NEMO_A},Compra,Aprobado,137,0,1013.17,138800.29,7.13,138807.42\n"10 feb 2026, 10:00 a. m.",${NEMO_B},Compra,Aprobado,53,0,2310.77,122470.81,7.13,122477.94\n"11 feb 2026, 10:00 a. m.",${NEMO_C},Compra,Aprobado,20,0,1500.37,30007.4,7.13,30014.53\n`),
  });
  if (r.estado !== "CARGADO") throw new Error(`siembra: ${r.estado}`);
  await construirLotes(db);
  idA = (await db.instrumento.findFirstOrThrow({ where: { nemotecnico: NEMO_A } })).id;
  idB = (await db.instrumento.findFirstOrThrow({ where: { nemotecnico: NEMO_B } })).id;
  idC = (await db.instrumento.findFirstOrThrow({ where: { nemotecnico: NEMO_C } })).id;
  const noHabiles = new Set((await db.calendarioBvc.findMany({ where: { esHabil: false }, select: { dia: true } })).map((f) => diaIso(f.dia)));
  habil = esDiaHabil(HOY, noHabiles);
  previo = diaIso(diaHabilAnterior(HOY, noHabiles)!);
  const plan = await db.planVersion.create({ data: { version: 700000 + (Date.now() % 90000), vigenteDesde: dia("2026-01-05"), motivo: "ficticio", aprobadaPorId: dueno.id } });
  idPlan = plan.id;
  const ultimaUmbral = await db.umbralVersion.findFirst({ orderBy: { version: "desc" }, select: { version: true } });
  umbralSembrado = (
    await db.umbralVersion.create({
      data: { version: (ultimaUmbral?.version ?? 0) + 1, alertaCercaPct: dec("3"), alertaCercaActiva: true, alertaNivelCruzadoActiva: true, alertaMovimientoPct: dec("3"), alertaMovimientoActiva: true, alertaCaidaPct: dec("2"), alertaCaidaActiva: true, alertaDatoViejoMin: 30, alertaDatoViejoActiva: true, alertaExDiasHabiles: 3, alertaExActiva: true, motivo: "ficticio", autorId: dueno.id },
    })
  ).id;
  idRegla = (await db.reglaPlan.create({ data: { planVersionId: plan.id, instrumentoId: idA, condicion: "CIERRE_BAJO", nivel: dec("1000"), accion: "NO_ACTUAR", detalle: "ficticio" } })).id;
  const cierre = (instrumentoId: string, fecha: string, precio: string) => db.precioCierre.create({ data: { instrumentoId, fecha: dia(fecha), precio, fuente: "yahoo", estado: "NO_VERIFICADO" } });
  await cierre(idA, previo, "1100.5");
  await cierre(idA, HOY_ISO, "990.25");
  await cierre(idB, previo, "2300.5");
  await cierre(idC, previo, "1100.5");
  await db.precioIntradia.create({ data: { instrumentoId: idC, instante: BARRA, precio: "1050.75", fuente: "yahoo", conRetraso: true } });
  const carga = await db.cargaArchivo.create({ data: { tipoFuente: "REGISTRO_DECRETOS", nombreArchivo: "decretos.ficticio.csv", sha256: "c".repeat(64), estado: "CARGADO", cargadoPorId: dueno.id } });
  const llave = { tipoFuente: "REGISTRO_DECRETOS" as const, claveNatural: `al${corrida}leer`.padStart(64, "0"), ocurrencia: 1 };
  const fila = await db.filaFuente.create({ data: { ...llave, primeraCargaId: carga.id, primeraFilaNo: 1, crudo: cifrarCrudo({ especie: NEMO_A, valor: "10" }, llave) } });
  idDecreto = (
    await db.dividendoDecretado.create({
      data: {
        filaFuenteId: fila.id, instrumentoId: idA, tipo: "ORDINARIO", valorPorAccion: dec("10"), fechaAnuncio: dia("2026-10-01"), cuota: 1, fechaEx: new Date(HOY.getTime() + MS_DIA),
        fechaPago: new Date(HOY.getTime() + 8 * MS_DIA), referenciaOficial: "https://www.superfinanciera.gov.co/ficticio/decreto",
      },
    })
  ).id;
}

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»: solo bases *_test`);
  await sembrar();
  rol = await conRolAlertas(db, "pg_signal_backend");
}, 60_000);

afterAll(async () => {
  await rol?.soltar();
  // La base de pruebas es compartida: el plan, las especies con sus lotes y órdenes, y las cargas sembradas no pueden quedar para los
  // archivos que siguen (las barras y la conciliación cuentan especies y órdenes de toda la base).
  await limpiarPlan(db, [idPlan]);
  const cargas = (await db.cargaArchivo.findMany({ where: { nombreArchivo: "o-alertas.ficticio.csv", cargadoPorId: duenoId }, select: { id: true } })).map((x) => x.id);
  await limpiarEspecies(db, { instrumentos: [idA, idB, idC], cargas, decretos: [idDecreto] });
  await limpiarUmbrales(db, [umbralSembrado, ...nuevasVersiones]);
  await db.$disconnect();
});

describe("leerEntrada con los privilegios de inv_alertas", () => {
  it("el cliente es de verdad el rol restringido", async () => {
    expect(await rol.usuario()).toBe("pg_signal_backend");
  });

  it("rige la versión de umbrales de mayor versión (la que sembró esta prueba, con los valores de la omisión)", async () => {
    const leida = await leerEntrada(rol.cliente, CIERRE_AHORA, false);
    expect(leida.umbralVersionId).toBe(umbralSembrado);
    expect(leida.entrada.umbrales).toEqual(UMBRALES_OMISION);
  });

  it("trae las especies con su regla, su tenencia, sus cierres y el decreto; el calendario como no hábiles", async () => {
    const { entrada, procedencia } = await leerEntrada(rol.cliente, CIERRE_AHORA, false);
    const a = entrada.especies.find((e) => e.instrumentoId === idA)!;
    const b = entrada.especies.find((e) => e.instrumentoId === idB)!;
    expect(a.reglas.map((r) => r.id)).toEqual([idRegla]);
    expect(String(a.cierreHoy)).toBe("990.25");
    expect(String(a.cierreAnterior)).toBe("1100.5");
    expect(b.cierreHoy).toBeNull();
    expect(String(b.cierreAnterior)).toBe("2300.5");
    expect(a.movimientos).toHaveLength(1);
    expect(entrada.decretos.map((d) => d.id)).toContain(idDecreto);
    expect(entrada.noHabiles.has("2026-11-16")).toBe(true);
    expect(entrada.intradiaActivo).toBe(false);
    expect(procedencia.get(idA)?.cierre?.fuente).toBe("yahoo");
  });

  it("la barra más reciente de cada especie solo se lee con el interruptor encendido", async () => {
    const encendido = await leerEntrada(rol.cliente, RUEDA_AHORA, true);
    const c = encendido.entrada.especies.find((e) => e.instrumentoId === idC)!;
    expect(c.intradia).toMatchObject({ instante: BARRA, conRetraso: true });
    expect(String(c.intradia?.precio)).toBe("1050.75");
    expect(encendido.entrada.especies.find((e) => e.instrumentoId === idA)!.intradia).toBeNull();
    const apagado = await leerEntrada(rol.cliente, RUEDA_AHORA, false);
    expect(apagado.entrada.especies.find((e) => e.instrumentoId === idC)!.intradia).toBeNull();
  });

  it("el cierre anterior es el del día hábil anterior, y falta si ese día no hay cierre", async () => {
    const { entrada } = await leerEntrada(rol.cliente, RUEDA_AHORA, true);
    expect(String(entrada.especies.find((e) => e.instrumentoId === idA)!.cierreAnterior)).toBe("1100.5");
    const { entrada: sinCierre } = await leerEntrada(rol.cliente, new Date(dia(previo).getTime() + 17 * 3_600_000), true);
    expect(sinCierre.especies.find((e) => e.instrumentoId === idA)!.cierreAnterior).toBeNull(); // el día hábil de antes no tiene cierre
  });
});

describe("correrAlertas con los privilegios de inv_alertas", () => {
  it("al cierre (intradía apagado): cruza el nivel, se mueve, falta el cierre de la otra (día hábil) y llega la fecha ex; sin caída (falla cerrada)", async () => {
    const r = await correrAlertas(rol.cliente, { ahora: CIERRE_AHORA, intradiaActivo: false });
    expect(r.codigoSalida).toBe(0);
    evaluadasAlCierre = r.resultado.evaluadas;
    expect(evaluadasAlCierre).toBeGreaterThanOrEqual(3);
    expect(r.resultado).toEqual({ evaluadas: evaluadasAlCierre, insertadas: evaluadasAlCierre, duplicadas: 0, fallidas: 0 });
    const filas = await db.alerta.findMany({ where: { dia: HOY, OR: [{ instrumentoId: { in: [idA, idB] } }, { instrumentoId: null }] }, orderBy: { tipo: "asc" } });
    const esperadas = ["FECHA_EX|A", "MOVIMIENTO_DIA|A", "NIVEL_CRUZADO|A", ...(habil ? ["DATO_VIEJO|B"] : [])].sort();
    expect(filas.filter((f) => f.instrumentoId === idA || f.instrumentoId === idB).map((f) => `${f.tipo}|${f.instrumentoId === idA ? "A" : "B"}`).sort()).toEqual(esperadas);
    expect(filas.some((f) => f.tipo === "CAIDA_PORTAFOLIO")).toBe(false);
    const cruzada = filas.find((f) => f.tipo === "NIVEL_CRUZADO")!;
    expect(cruzada).toMatchObject({ reglaId: idRegla, sentido: "BAJO", base: "CIERRE", fuente: "yahoo", motorVersion: "alertas-v1", umbralVersionId: umbralSembrado });
    expect(String(cruzada.precio)).toBe("990.25");
    expect(String(cruzada.referencia)).toBe("1000");
    expect(cruzada.traidoEn).not.toBeNull();
    expect(Math.abs(Date.now() - cruzada.detectadaEn.getTime())).toBeLessThan(120_000);
    expect(filas.find((f) => f.tipo === "FECHA_EX")).toMatchObject({ decretoId: idDecreto, reglaId: null, base: null });
  });

  it("la segunda corrida no inserta nada (ya estaban todas) y el registro no lleva nemotécnicos ni cifras de precios", async () => {
    const r = await correrAlertas(rol.cliente, { ahora: CIERRE_AHORA, intradiaActivo: false });
    expect(r.codigoSalida).toBe(0);
    expect(r.resultado).toEqual({ evaluadas: evaluadasAlCierre, insertadas: 0, duplicadas: evaluadasAlCierre, fallidas: 0 });
    const registro = r.lineas.join("\n");
    for (const prohibido of [NEMO_A, NEMO_B, idA, idB, "990", "1100", "2300", "1000"]) expect(registro).not.toContain(prohibido);
  });

  it("con el intradía encendido: el movimiento de la especie con barra sale de la barra (con su retraso)", async () => {
    const r = await correrAlertas(rol.cliente, { ahora: RUEDA_AHORA, intradiaActivo: true });
    expect(r.codigoSalida).toBe(0);
    expect(r.resultado.fallidas).toBe(0);
    const mov = await db.alerta.findFirstOrThrow({ where: { dia: HOY, tipo: "MOVIMIENTO_DIA", instrumentoId: idC } });
    expect(mov).toMatchObject({ sentido: "BAJO", base: "INTRADIA", conRetraso: true, fuente: "yahoo" });
    expect(mov.instanteDato).toEqual(BARRA);
    expect(mov.traidoEn).not.toBeNull();
    expect(mov.traidoEn!.getTime()).toBeGreaterThanOrEqual(BARRA.getTime());
    expect(String(mov.precio)).toBe("1050.75");
  });

  it("con el intradía apagado la barra no cuenta: la especie con barra no repite su movimiento", async () => {
    const r = await correrAlertas(rol.cliente, { ahora: RUEDA_AHORA, intradiaActivo: false });
    expect(r.resultado.fallidas).toBe(0);
    expect(await db.alerta.count({ where: { dia: HOY, tipo: "MOVIMIENTO_DIA", instrumentoId: idC } })).toBe(1);
  });

  it("una versión de umbrales nueva manda: se lee la de mayor versión", async () => {
    const ultima = await db.umbralVersion.findFirst({ orderBy: { version: "desc" }, select: { version: true } });
    const v = await db.umbralVersion.create({
      data: { version: (ultima?.version ?? 0) + 1, alertaCercaPct: dec("3"), alertaCercaActiva: true, alertaNivelCruzadoActiva: true, alertaMovimientoPct: dec("20"), alertaMovimientoActiva: true, alertaCaidaPct: dec("2"), alertaCaidaActiva: true, alertaDatoViejoMin: 30, alertaDatoViejoActiva: true, alertaExDiasHabiles: 3, alertaExActiva: true, motivo: "ficticio", autorId: duenoId },
    });
    nuevasVersiones.push(v.id);
    const leida = await leerEntrada(rol.cliente, CIERRE_AHORA, false);
    expect(leida.umbralVersionId).toBe(v.id);
    expect(leida.entrada.umbrales.alertaMovimientoPct).toBe(20);
    expect(leida.entrada.umbrales.alertaCercaPct).toBe(3);
  });
});

describe("el disparador de la inserción, con el rol del servicio", () => {
  const fila = (dia: string, extra = "") =>
    `INSERT INTO alerta (id, dia, tipo, "instrumentoId", sentido, base, "motorVersion"${extra ? ", \"traidoEn\"" : ""}) VALUES ('al-trg-${Math.random().toString(36).slice(2)}', ${dia}, 'MOVIMIENTO_DIA', '${idA}', 'SOBRE', 'CIERRE', 'alertas-v1'${extra ? `, ${extra}` : ""})`;
  const hoyCol = "(now() AT TIME ZONE 'UTC' - interval '5 hours')::date";

  it.each([
    ["un día futuro", fila(`${hoyCol} + 1`), /futuro/],
    ["un día de hace más de un día", fila(`${hoyCol} - 2`), /hace más de un día/],
    ["una hora de traída del futuro", fila(hoyCol, "now() + interval '1 hour'"), /futuro/],
  ])("rechaza %s", async (_n, sql, patron) => {
    await expect(rol.cliente.$executeRawUnsafe(sql)).rejects.toThrow(patron);
  });
});

describe("el rol restringido no puede más de lo suyo (control negativo)", () => {
  it.each([
    ["el motivo de los umbrales", "SELECT motivo FROM umbral_version"],
    ["la acción de las reglas", "SELECT accion FROM regla_plan"],
    ["el costo del lote", 'SELECT "costoTotal" FROM lote'],
    ["los usuarios", "SELECT email FROM usuario"],
    ["editar una alerta", "UPDATE alerta SET precio = 1"],
    ["borrar una alerta", "DELETE FROM alerta"],
    ["marcar una vista", `INSERT INTO alerta_vista (id, "alertaId", "usuarioId") VALUES ('x', 'y', 'z')`],
  ])("no puede %s", async (_n, sql) => {
    await expect(rol.cliente.$queryRawUnsafe(sql)).rejects.toThrow(/42501|permission denied/);
  });
});
