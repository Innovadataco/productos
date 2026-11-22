/**
 * Una llamada a la vez por instancia: el turno cubre el gasto, el tope y la llamada, para que dos pedidos no pasen el
 * tope al mismo tiempo. La espera del turno se puede abortar (el límite del orquestador corre mientras espera) y el
 * turno se libera pase lo que pase.
 */
import { APIUserAbortError } from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResultadoGeneracion } from "@/ia/generador";
import { LlaveNube, TECHO_TOPE_MICRO_USD } from "@/ia/nube/config";
import { crearGeneradorNube } from "@/ia/nube/generador-nube";
import { armarCuerpoNube } from "@/ia/nube/peticion";
import { costoMaximoMicroUsd, costoMicroUsd, type GastoDelMes } from "@/ia/nube/tope";
import { crearClienteDoble, diferida, esperarTurnos, type Diferida } from "./apoyo/cliente-doble";
import { GASTO_FICTICIO, LLAVE_FICTICIA, mensajeFicticio, pedidoFicticio } from "./apoyo/datos.ficticio";

const LLAVE = LlaveNube.desdeTexto(LLAVE_FICTICIA) as LlaveNube;
const pedido = () => pedidoFicticio().pedido;

function montarConDiferidas(tope = TECHO_TOPE_MICRO_USD) {
  const respuestas: Diferida<unknown>[] = [];
  const eventos: string[] = [];
  const doble = crearClienteDoble((_l, indice) => {
    eventos.push(`create-${indice}`);
    const d = diferida<unknown>();
    respuestas.push(d);
    return d.promesa;
  });
  let gastos = 0;
  const gastoDelMes = vi.fn((): Promise<GastoDelMes> => {
    eventos.push(`gasto-${gastos}`);
    gastos += 1;
    return Promise.resolve(GASTO_FICTICIO);
  });
  const generador = crearGeneradorNube({ lista: true, llave: LLAVE, topeMicroUsd: tope }, { gastoDelMes, crearCliente: doble.crearCliente });
  return { generador, doble, eventos, respuestas, gastoDelMes };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("una llamada a la vez", () => {
  it("la segunda no pide el gasto ni llama hasta que la primera termina; en orden", async () => {
    const m = montarConDiferidas();
    const primera = m.generador.generar(pedido(), new AbortController().signal);
    const segunda = m.generador.generar(pedido(), new AbortController().signal);
    const tercera = m.generador.generar(pedido(), new AbortController().signal);
    await esperarTurnos();
    expect(m.eventos).toEqual(["gasto-0", "create-0"]);
    m.respuestas[0]?.resolver(mensajeFicticio());
    await esperarTurnos();
    expect(m.eventos).toEqual(["gasto-0", "create-0", "gasto-1", "create-1"]);
    m.respuestas[1]?.rechazar(new Error("fallo ficticio"));
    await esperarTurnos();
    expect(m.eventos).toEqual(["gasto-0", "create-0", "gasto-1", "create-1", "gasto-2", "create-2"]);
    m.respuestas[2]?.resolver(mensajeFicticio());
    const resultados: ResultadoGeneracion[] = await Promise.all([primera, segunda, tercera]);
    expect(resultados.map((r) => r.ok)).toEqual([true, false, true]);
  });

  it("abortar mientras espera el turno: ABORTADO sin gasto ni llamada, y la fila sigue con la siguiente", async () => {
    const m = montarConDiferidas();
    const primera = m.generador.generar(pedido(), new AbortController().signal);
    const control = new AbortController();
    const segunda = m.generador.generar(pedido(), control.signal);
    const tercera = m.generador.generar(pedido(), new AbortController().signal);
    await esperarTurnos();
    control.abort();
    expect(await segunda).toEqual({ ok: false, puerta: "nube", motivo: "TIEMPO_AGOTADO", detalle: "ABORTADO" });
    expect(m.eventos).toEqual(["gasto-0", "create-0"]);
    m.respuestas[0]?.resolver(mensajeFicticio());
    await esperarTurnos();
    expect(m.eventos).toEqual(["gasto-0", "create-0", "gasto-1", "create-1"]);
    m.respuestas[1]?.resolver(mensajeFicticio());
    expect((await primera).ok && (await tercera).ok).toBe(true);
  });

  it("el turno se libera después de una excepción en la llamada misma", async () => {
    const doble = crearClienteDoble((_l, indice) => {
      if (indice === 0) throw new Error("fallo síncrono ficticio");
      return Promise.resolve(mensajeFicticio());
    });
    const generador = crearGeneradorNube({ lista: true, llave: LLAVE, topeMicroUsd: TECHO_TOPE_MICRO_USD }, { gastoDelMes: () => Promise.resolve(GASTO_FICTICIO), crearCliente: doble.crearCliente });
    expect(await generador.generar(pedido(), new AbortController().signal)).toMatchObject({ ok: false, detalle: "EXCEPCION_INTERNA" });
    expect(await generador.generar(pedido(), new AbortController().signal)).toMatchObject({ ok: true });
  });

  it("la segunda ve la reserva de la primera (abortada en vuelo) y ya no cabe", async () => {
    const armado = armarCuerpoNube(pedido());
    if (!armado.ok) throw new Error(armado.detalle);
    const maximo = costoMaximoMicroUsd(armado.json, 8192);
    const m = montarConDiferidas(costoMicroUsd(GASTO_FICTICIO) + 2n * maximo - 1n);
    const control = new AbortController();
    const primera = m.generador.generar(pedido(), control.signal);
    const segunda = m.generador.generar(pedido(), new AbortController().signal);
    await esperarTurnos();
    m.respuestas[0]?.rechazar(new APIUserAbortError());
    expect(await primera).toMatchObject({ motivo: "TIEMPO_AGOTADO" });
    expect(await segunda).toEqual({ ok: false, puerta: "nube", motivo: "TOPE_MENSUAL", detalle: "TOPE_DEL_MES" });
    expect(m.doble.llamadas()).toHaveLength(1);
  });
});
