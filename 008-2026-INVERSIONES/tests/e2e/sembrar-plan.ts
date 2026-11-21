/**
 * Siembra del plan y del diario para el E2E de /plan y /decisiones (fase B, corte 3). La llama tests/e2e/sembrar.ts
 * después de la conciliación. Todo por el dominio real (crearVersionPlan, registrarDecision, enlazarOrden) y con datos
 * inventados. No toca lo que miran el tablero y la conciliación: ni órdenes ni dividendos nuevos, ni cierres el 14 ni
 * el 22-nov-2024, ni cierres después del 22-nov-2024.
 *   v1 desde el 1-jul-2024: FICTA sobre 1.200 (vender 50) · FICTB bajo 2.000 (vender, plazo 31-dic-2024) ·
 *      FICTC bajo 480 (comprar 10) · portafolio: monto por orden menor a 1.234.000 · una regla escrita.
 *   v2 programada para dentro de 30 días.
 *   «No actuar» con 43 FICTA el 22-jul-2024 (excepción a su regla): cierres de Yahoo ficticios del 22-jul (953), el
 *      21-ago (989) y el 18-oct-2024 (1.063), y el dividendo ficticio de 1.200 del 17-oct-2024 dentro de los 90 días.
 *   Vender FICTB el 12-nov-2024, enlazada a la venta del 13-nov (FICTB no tiene cierres de Yahoo: sin precio).
 *   «No actuar» con 10 FICTB hace 3 días (pendiente).
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { registrarDecision } from "../../src/plan/decisiones";
import { enlazarOrden } from "../../src/plan/enlaces";
import { sumarDias } from "../../src/plan/fechas";
import { crearVersionPlan } from "../../src/plan/versiones";
import { hoyDelE2E } from "./base";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const CIERRES_YAHOO_FICTA = [["2024-07-22", 953], ["2024-08-21", 989], ["2024-10-18", 1063]] as const;

const regla = (instrumentoId: string | null, r: Partial<Parameters<typeof crearVersionPlan>[1]["reglas"][number]> & { detalle: string }) => ({
  instrumentoId, condicion: "NINGUNA" as const, nivel: null, accion: "NO_ACTUAR" as const, cantidad: null, plazoHasta: null, ...r,
});

export async function sembrarPlan(db: PrismaClient, autorId: string): Promise<void> {
  const id = async (nemo: string) => (await db.instrumento.findFirstOrThrow({ where: { nemotecnico: nemo }, select: { id: true } })).id;
  const [a, b, c] = [await id("FICTA"), await id("FICTB"), await id("FICTC")];
  const hoy = hoyDelE2E();
  const v1 = await crearVersionPlan(db, {
    vigenteDesde: dia("2024-07-01"), motivo: "Plan ficticio del E2E", autorId,
    reglas: [
      regla(a, { condicion: "CIERRE_SOBRE", nivel: "1200", accion: "VENDER", cantidad: 50n, detalle: "Si cierra sobre el nivel, vender 50 (ficticia)" }),
      regla(b, { condicion: "CIERRE_BAJO", nivel: "2000", accion: "VENDER", plazoHasta: dia("2024-12-31"), detalle: "Vender si cae bajo el nivel (ficticia)" }),
      regla(c, { condicion: "CIERRE_BAJO", nivel: "480", accion: "COMPRAR", cantidad: 10n, detalle: "Comprar 10 si cierra bajo el nivel (ficticia)" }),
      regla(null, { condicion: "MONTO_ORDEN_BAJO", nivel: "1234000", detalle: "No operar con menos de ese monto por orden (ficticia)" }),
      regla(null, { condicion: "LIBRE", detalle: "Siempre orden límite (ficticia)" }),
    ],
  }, { hoy });
  await crearVersionPlan(db, { vigenteDesde: sumarDias(hoy, 30), motivo: "Versión ficticia programada", autorId, reglas: [regla(a, { detalle: "Mantener FICTA (ficticia)" })] }, { hoy });
  await db.precioCierre.createMany({
    data: CIERRES_YAHOO_FICTA.map(([fecha, precio]) => ({ instrumentoId: a, fecha: dia(fecha), precio: new Prisma.Decimal(precio), fuente: "yahoo", estado: "NO_VERIFICADO" as const })),
  });
  const [reglaA, reglaB] = v1.reglaIds;
  await registrarDecision(db, { fechaDecision: dia("2024-07-22"), instrumentoId: a, accion: "NO_ACTUAR", cantidad: 43n, reglaId: reglaA!, excepcion: true, motivo: "Mantener hasta el dividendo de octubre (ficticio)", autorId }, { hoy });
  const venta = await registrarDecision(db, { fechaDecision: dia("2024-11-12"), instrumentoId: b, accion: "VENDER", reglaId: reglaB!, motivo: "Vender una parte de FICTB (ficticio)", autorId }, { hoy });
  const orden = await db.orden.findFirstOrThrow({ where: { instrumentoId: b, lado: "VENTA", fechaOperacion: dia("2024-11-13") }, select: { id: true } });
  await enlazarOrden(db, { ordenId: orden.id, decisionId: venta.id, autorId });
  await registrarDecision(db, { fechaDecision: sumarDias(hoy, -3), instrumentoId: b, accion: "NO_ACTUAR", cantidad: 10n, motivo: "Esperar (ficticio)", autorId }, { hoy });
}
