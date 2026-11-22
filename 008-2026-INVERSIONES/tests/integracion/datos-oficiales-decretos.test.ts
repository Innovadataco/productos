// La sección de dividendos decretados de /datos-oficiales (src/app/datos-oficiales/datos.ts; frente
// datos-oficiales-decretos-pantalla, C6b) contra la base de PRUEBAS. Siembra por los caminos únicos (importarArchivoTrii
// para las órdenes y los pagos, importarDecretos para los decretos, con una corrección) y comprueba:
// - las series y los decretos salen de UNA sola transacción REPEATABLE READ;
// - el cruce desde hoy − 365, lo más reciente primero, con la especie, la referencia y la versión de cada decreto: un
//   PENDIENTE, dos REVISAR por un pago en disputa (uno con su pago, el otro sin) y un pago SIN_DECRETO;
// - los próximos (ex ≥ hoy) con la tenencia de hoy, el bruto estimado y la versión vigente (la corrección, no la v1);
// - pintada, la referencia https es enlace y el radicado no.
// RECIBIDO y NO_RECIBIDO no se alcanzan aquí: piden que las cargas de Trii cubran la ex, y la cobertura (coberturaTrii)
// es la fecha REAL de la última carga de toda la base (hoy de verdad), anterior a estas fechas. Los prueban
// tests/unit/datos-oficiales/decretos/cruce.test.ts (el estado) y tests/unit/pantalla-datos-oficiales/ (la pantalla).
// La base se comparte con los demás archivos: todo se filtra por las especies de esta corrida. Datos INVENTADOS, cifras
// raras y fechas de 2027 (el año sembrado del calendario; el importador de Trii lo exige).
import { PrismaClient } from "@prisma/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ENCABEZADO_DECRETOS } from "@/datos-oficiales/decretos/csv";
import { importarDecretos } from "@/datos-oficiales/decretos/importar";
import { coberturaTrii } from "@/datos-oficiales/decretos/leer";
import { importarArchivoTrii } from "@/importacion/trii/importar";
import { DatosOficiales } from "@/app/datos-oficiales/DatosOficiales";
import { datosOficiales } from "@/app/datos-oficiales/datos";
import type { VistaDatosOficiales } from "@/app/datos-oficiales/tipos";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const nemo = { a: `DA${corrida}`, b: `DB${corrida}` };
const email = `dueno-c6b-${corrida}@ejemplo.invalid`;
const HOY = new Date("2027-10-29T00:00:00Z");
const AHORA = new Date("2027-10-29T15:00:00Z");
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const bytes = (t: string) => new TextEncoder().encode(t);
const ORD = "Fecha y hora,Símbolo de la acción,Tipo de orden,Estado,Acciones completadas,Acciones pendientes,Precio por acción,Total invertido,Valor comisión,Total estimado\n";
const DIV = "Fecha y hora,Ticker,Estado,Valor total\n";
const BVC = "https://www.bvc.com.co/ficticio/c6b";
const SFC = "https://www.superfinanciera.gov.co/ficticio/c6b";

/** especie,tipo,fecha_anuncio,cuota,valor_por_accion,moneda,forma,fecha_ex,fecha_pago,referencia,anulada,nota */
const decreto = (especie: string, tipo: string, cuota: number, valor: string, anuncio: string, ex: string, pago: string, referencia: string) =>
  [especie, tipo, anuncio, String(cuota), valor, "COP", "DINERO", ex, pago, referencia, "", ""].join(",");
async function registrar(filas: readonly string[]): Promise<void> {
  const r = await importarDecretos(db, { contenido: bytes(`${ENCABEZADO_DECRETOS.join(",")}\n${filas.join("\n")}\n`), email, aplicar: true }, { ahora: AHORA });
  if (r.estado !== "APLICADO") throw new Error(`no se registraron los decretos: ${JSON.stringify(r)}`);
}

let vista: VistaDatosOficiales;
let transacciones = 0;

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  const duenoId = (await db.usuario.create({ data: { email, rol: "DUENO" } })).id;
  const imp = (nombre: string, t: string) => importarArchivoTrii(db, { nombreArchivo: nombre, contenido: bytes(t), usuarioId: duenoId });
  await imp("o-c6b.ficticio.csv", ORD + [
    `"3 sep 2027, 10:00 a. m.",${nemo.a},Compra,Aprobado,1237,0,10.37,12827.69,7.13,12834.82`,
    `"3 sep 2027, 10:00 a. m.",${nemo.b},Compra,Aprobado,97,0,23.71,2299.87,7.13,2307.00`,
  ].join("\n") + "\n");
  // A: un pago que cabe en la ventana de sus dos decretos (disputa). B: un pago lejos de su decreto (sin decreto).
  await imp("d-c6b.ficticio.csv", `${DIV}2027-10-12,${nemo.a},,1517.29\n2027-09-08,${nemo.b},,37.91\n`);
  await registrar([
    decreto(nemo.a, "ORDINARIO", 1, "2.613719", "2027-09-15", "2027-09-28", "2027-10-05", `${BVC}-a1`),
    decreto(nemo.a, "ORDINARIO", 2, "1.371937", "2027-09-15", "2027-10-06", "2027-10-12", "sfc:FICTICIO-C6B-A2"),
    decreto(nemo.b, "ORDINARIO", 1, "23.785", "2027-10-01", "2027-10-15", "2027-10-22", `${SFC}-b1`),
    decreto(nemo.a, "ORDINARIO", 3, "3.719413", "2027-10-20", "2027-11-10", "2027-11-17", `${BVC}-a3`),
    decreto(nemo.b, "EXTRAORDINARIO", 1, "0.971313", "2027-10-20", "2027-11-24", "2027-12-01", "sfc:FICTICIO-C6B-B2"),
  ]);
  // Una corrección: la v2 retira a la v1 (la pantalla muestra la vigente, con su versión).
  await registrar([decreto(nemo.b, "EXTRAORDINARIO", 1, "1.374113", "2027-10-20", "2027-11-24", "2027-12-01", "sfc:FICTICIO-C6B-B2")]);
  const espia = vi.spyOn(db, "$transaction");
  vista = await datosOficiales(db, HOY);
  transacciones = espia.mock.calls.length;
  espia.mockRestore();
});

afterAll(async () => {
  await db.$disconnect();
});

const deEstaCorrida = <T extends { readonly especie: string }>(filas: readonly T[]) => filas.filter((f) => f.especie === nemo.a || f.especie === nemo.b);

describe("/datos-oficiales · los decretos contra la base", () => {
  it("las series y los decretos, en una sola transacción; el cruce, desde hoy − 365", () => {
    expect(transacciones).toBe(1);
    expect(vista.decretos.desde).toBe("2026-10-29");
  });

  it("la cobertura de Trii (la fecha real de la carga) no llega a estas ex: por eso no hay RECIBIDO ni NO_RECIBIDO aquí", async () => {
    const cubierto = await coberturaTrii(db);
    expect(cubierto).not.toBeNull();
    expect(cubierto!.getTime()).toBeLessThan(dia("2027-09-28").getTime());
  });

  it("el cruce: lo más reciente primero, con estado, motivos, bruto, neto y diferencia exactos", () => {
    expect(deEstaCorrida(vista.decretos.cruce).map((f) => [f.especie, f.fechaPago, f.estado, f.motivos, f.brutoEsperado, f.netoRecibido, f.diferenciaBrutoNeto])).toEqual([
      [nemo.b, "2027-10-22", "PENDIENTE", [], "2307.145", null, null],
      [nemo.a, "2027-10-12", "REVISAR", ["PAGO_EN_DISPUTA", "CARGA_NO_CUBRE_LA_EX"], "1697.086069", "1517.29", "179.796069"],
      [nemo.a, "2027-10-05", "REVISAR", ["PAGO_EN_DISPUTA"], "3233.170403", null, null],
      [nemo.b, "2027-09-08", "SIN_DECRETO", [], null, "37.91", null],
    ]);
  });

  it("cada decreto del cruce con su tenencia antes de la ex, su referencia y su versión; cada pago con su fecha", () => {
    const [pendiente, conPago, sinPago, suelto] = deEstaCorrida(vista.decretos.cruce);
    const resumen = (f: typeof pendiente) => f!.decretos.map((d) => [d.tipo, d.cuota, d.fechaEx, d.valorPorAccion, d.tenenciaAntesDeLaEx, d.bruto, d.referencia, d.version]);
    expect(resumen(pendiente)).toEqual([["ORDINARIO", 1, "2027-10-15", "23.785", "97", "2307.145", `${SFC}-b1`, 1]]);
    expect(resumen(conPago)).toEqual([["ORDINARIO", 2, "2027-10-06", "1.371937", "1237", "1697.086069", "sfc:FICTICIO-C6B-A2", 1]]);
    expect(resumen(sinPago)).toEqual([["ORDINARIO", 1, "2027-09-28", "2.613719", "1237", "3233.170403", `${BVC}-a1`, 1]]);
    expect(suelto!.decretos).toEqual([]);
    expect([conPago!.pagos.map((p) => [p.fechaPago, p.montoNeto]), suelto!.pagos.map((p) => [p.fechaPago, p.montoNeto])]).toEqual([[["2027-10-12", "1517.29"]], [["2027-09-08", "37.91"]]]);
  });

  it("los próximos: ex ≥ hoy, la versión vigente (la corrección), la tenencia de hoy y el bruto estimado", () => {
    expect(deEstaCorrida(vista.decretos.proximos).map((p) => [p.especie, p.tipo, p.cuota, p.valorPorAccion, p.fechaEx, p.fechaPago, p.version, p.referencia, p.tenencia, p.brutoEstimado])).toEqual([
      [nemo.a, "ORDINARIO", 3, "3.719413", "2027-11-10", "2027-11-17", 1, `${BVC}-a3`, "1237", "4600.913881"],
      [nemo.b, "EXTRAORDINARIO", 1, "1.374113", "2027-11-24", "2027-12-01", 2, "sfc:FICTICIO-C6B-B2", "97", "133.288961"],
    ]);
  });

  it("pintada: la referencia https es enlace; el radicado, texto; la diferencia nunca se llama «retención»", () => {
    const html = renderToStaticMarkup(createElement(DatosOficiales, { datos: vista, soloLectura: true }));
    expect(html).toContain(`href="${BVC}-a3"`);
    expect(html).toContain(`href="${SFC}-b1"`);
    expect(html).not.toMatch(/href="sfc:/);
    expect(html).toContain("FICTICIO-C6B-B2");
    expect(html).not.toMatch(/retenci[oó]n/i);
  });
});
