/**
 * Propiedades del simulador con portafolios y operaciones AL AZAR (PRNG con semilla, reproducible), todo inventado:
 * - los pesos suman 100 % dentro de la tolerancia documentada (n × 10⁻¹⁶), antes y después;
 * - la caja cambia en ∓ valor − comisión, y el valor de las acciones en ± cantidad × cierre;
 * - comprar y luego vender lo mismo al mismo precio (o al revés) vuelve al estado de antes, salvo las dos comisiones;
 * - la misma semilla da los mismos casos.
 * No pasan en vacío: las corridas tienen que cubrir compras, ventas, ventas de todo, comisión estimada y sin
 * historia, los dos avisos y las tres afectaciones.
 */
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { simularOperacion } from "@/operar/simulador/simular";
import { TOLERANCIA_PESOS_POR_ESPECIE, type OperacionSimulada, type Simulacion } from "@/operar/simulador/tipos";
import { crearPrng } from "@/proyecciones/prng";
import { casoAlAzar, comoTexto, estadoDespues, exito, type CasoAlAzar } from "./apoyo/estado.ficticio";

const SEMILLA = 46_133;
const CORRIDAS = 613;
const CERO = new Prisma.Decimal(0);
const TOLERANCIA = new Prisma.Decimal(TOLERANCIA_PESOS_POR_ESPECIE);

function revisarPesos(s: Simulacion, cual: "pesoAntesPct" | "pesoDespuesPct", total: Prisma.Decimal, k: number): boolean {
  const conValor = s.especies.filter((e) => (cual === "pesoAntesPct" ? e.valorAntes : e.valorDespues) !== null);
  const pesos = conValor.map((e) => e[cual]);
  if (!total.gt(0)) {
    expect(pesos.every((p) => p === null), `corrida ${k}: sin valor, sin pesos`).toBe(true);
    return false;
  }
  const suma = pesos.reduce<Prisma.Decimal>((t, p) => t.add(p!), CERO);
  expect(suma.sub(100).abs().lte(TOLERANCIA.mul(conValor.length)), `corrida ${k}: Σ pesos = ${suma.toFixed()}`).toBe(true);
  return true;
}

const contraria = (op: OperacionSimulada): OperacionSimulada => ({ ...op, lado: op.lado === "COMPRAR" ? "VENDER" : "COMPRAR" });
const comisionDe = (s: Simulacion) => (s.comision.estado === "ESTIMADA" ? s.comision.valor : CERO);

describe("simulador · propiedades con casos al azar", () => {
  it(`en ${CORRIDAS} casos (semilla ${SEMILLA}) cuadran pesos, caja, valor y la ida y vuelta`, () => {
    const prng = crearPrng(SEMILLA);
    const vistos = new Map<string, number>();
    const ver = (clave: string) => vistos.set(clave, (vistos.get(clave) ?? 0) + 1);
    for (let k = 0; k < CORRIDAS; k += 1) {
      const { estado, operacion, contexto }: CasoAlAzar = casoAlAzar(prng, k);
      const s = exito(simularOperacion(estado, operacion, contexto));
      const signo = operacion.lado === "COMPRAR" ? 1 : -1;
      const operada = estado.posiciones.find((p) => p.instrumentoId === operacion.instrumentoId)!;

      if (revisarPesos(s, "pesoAntesPct", s.valorAccionesAntes, k)) ver("pesos antes");
      if (revisarPesos(s, "pesoDespuesPct", s.valorAccionesDespues, k)) ver("pesos después");

      expect(s.cajaDespues.eq(s.cajaAntes.sub(s.valorOrden.mul(signo)).sub(comisionDe(s))), `corrida ${k}: caja`).toBe(true);
      if (operada.cierre !== null) {
        const delta = operada.cierre.mul(operacion.cantidad.toString()).mul(signo);
        expect(s.valorAccionesDespues.sub(s.valorAccionesAntes).eq(delta), `corrida ${k}: valor`).toBe(true);
      }

      const vuelta = exito(simularOperacion(estadoDespues(estado, s), contraria(operacion), contexto));
      const final = estadoDespues(estadoDespues(estado, s), vuelta);
      expect(comoTexto(final.posiciones), `corrida ${k}: cantidades`).toBe(comoTexto(estado.posiciones));
      expect(final.caja.eq(estado.caja.sub(comisionDe(s)).sub(comisionDe(vuelta))), `corrida ${k}: caja de vuelta`).toBe(true);
      expect(comoTexto(vuelta.especies.map((e) => e.pesoDespuesPct)), `corrida ${k}: pesos de vuelta`).toBe(comoTexto(s.especies.map((e) => e.pesoAntesPct)));

      ver(operacion.lado);
      if (operacion.lado === "VENDER" && operacion.cantidad === operada.cantidad) ver("vende todo");
      ver(`comisión ${s.comision.estado}`);
      for (const a of s.avisos) ver(a.codigo);
      for (const r of s.reglasAfectadas) for (const a of r.afectaciones) ver(a.tipo);
    }
    for (const clave of [
      "pesos antes", "pesos después", "COMPRAR", "VENDER", "vende todo", "comisión ESTIMADA", "comisión SIN_HISTORIA",
      "COMPRA_SUPERA_CAJA", "ESPECIES_SIN_CIERRE", "MONTO_ORDEN_BAJO", "PRECIO_DEL_LADO_DEL_NIVEL", "OTRA_ACCION",
    ]) {
      expect(vistos.get(clave) ?? 0, clave).toBeGreaterThan(9);
    }
  });

  it("la misma semilla da los mismos casos y los mismos resultados", () => {
    const una = crearPrng(SEMILLA);
    const otra = crearPrng(SEMILLA);
    for (let k = 0; k < 37; k += 1) {
      const a = casoAlAzar(una, k);
      const b = casoAlAzar(otra, k);
      expect(comoTexto(a)).toBe(comoTexto(b));
      expect(comoTexto(simularOperacion(a.estado, a.operacion, a.contexto))).toBe(comoTexto(simularOperacion(b.estado, b.operacion, b.contexto)));
    }
  });
});
