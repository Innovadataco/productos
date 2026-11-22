/**
 * Condición de PI para la fase E: el candado de los hechos ciegos prueba la CONDUCTA, con control positivo, y corre
 * en el CI. Se arma a mano un pedido con una vista que lleva un dato plantado (un decimal inventado, una presentación
 * es-CO inventada, un nombre de especie ficticio o una clave prohibida): `generarConPuertas` la rechaza ANTES de
 * llamar a cualquier generador, devuelve el estado VISTA_NO_CIEGA con todos los códigos y el generador falso no
 * recibe ninguna llamada. El caso limpio sí llega al generador.
 */
import { describe, expect, it } from "vitest";
import type { PaqueteHechos } from "@/ia/contrato";
import { armarPedido, type PedidoGeneracion } from "@/ia/generador";
import { crearGeneradorFalso } from "@/ia/generador-falso";
import { construirPaquete } from "@/ia/paquete";
import { generarConPuertas, type ModoPuertas } from "@/ia/puertas";
import { CODIGOS_FUGA_VISTA, fugasDeVistaCiega } from "@/ia/vista-ciega";
import { ESPECIE_ALFA, entradaDiario } from "./apoyo/hechos.ficticio";
import { ESQUEMA_FICTICIO, LIMITE_FICTICIO_MS, PROMPT_FICTICIO } from "./apoyo/pedido.ficticio";

type VistaEditable = { tipo: unknown; hechos: Record<string, unknown>[] } & Record<string, unknown>;

function preparar() {
  const paquete: PaqueteHechos = construirPaquete(entradaDiario());
  const pedido = armarPedido({ paquete, prompt: PROMPT_FICTICIO, esquemaSalida: ESQUEMA_FICTICIO, limiteMs: LIMITE_FICTICIO_MS });
  const local = crearGeneradorFalso({ puerta: "local", conducta: { tipo: "RESPONDER", salidaCruda: '{"frases":[]}' } });
  const nube = crearGeneradorFalso({ puerta: "nube", conducta: { tipo: "RESPONDER", salidaCruda: '{"frases":[]}' } });
  return { paquete, pedido, local, nube };
}

/** El pedido con la vista editada a mano (el resto, tal cual: el prompt con su hash sigue válido). */
function conVista(pedido: PedidoGeneracion, plantar: (v: VistaEditable) => void): PedidoGeneracion {
  const vista = structuredClone(pedido.vista) as unknown as VistaEditable;
  plantar(vista);
  return { ...pedido, vista: vista as unknown as PedidoGeneracion["vista"] };
}

const PLANTADOS: readonly (readonly [string, (v: VistaEditable) => void, string])[] = [
  ["un decimal inventado", (v) => { v.hechos[2]!.etiqueta = "valor de las acciones 7391.53"; }, "DIGITO_FUERA_DE_REFERENCIA"],
  ["un decimal del paquete", (v) => { v.hechos[2]!.valor = "37911.47"; }, "VALOR_DEL_PAQUETE"],
  ["una presentación es-CO inventada", (v) => { v.hechos[3]!.etiqueta = "ganancia total −$ 2.917"; }, "DIGITO_FUERA_DE_REFERENCIA"],
  ["una presentación es-CO del paquete", (v) => { v.hechos[6]!.presentacion = "12,4 %"; }, "PRESENTACION_DEL_PAQUETE"],
  ["un nombre de especie ficticio del paquete", (v) => { v.hechos[0]!.etiqueta = `nombre de la especie ${ESPECIE_ALFA}`; }, "NOMBRE_DE_ESPECIE"],
  ["una clave prohibida", (v) => { v.hechos[4]!.cuenta = "cuenta-ficticia"; }, "CLAVE_PROHIBIDA"],
];

describe("guarda en generarConPuertas · control positivo", () => {
  it.each(PLANTADOS)("con %s: VISTA_NO_CIEGA con todos sus códigos y ningún generador recibe la llamada", async (_caso, plantar, codigo) => {
    const { paquete, pedido, local, nube } = preparar();
    const plantado = conVista(pedido, plantar);
    expect(fugasDeVistaCiega(plantado.vista, paquete)).toContain(codigo);
    const resultado = await generarConPuertas([local, nube], "local-luego-nube", plantado, paquete);
    expect(resultado).toMatchObject({ estado: "VISTA_NO_CIEGA", ok: false, motivo: "VISTA_NO_CIEGA" });
    if (resultado.estado !== "VISTA_NO_CIEGA") return;
    expect(resultado.codigos).toContain(codigo);
    for (const c of resultado.codigos) expect(CODIGOS_FUGA_VISTA).toContain(c);
    expect(local.llamadas()).toHaveLength(0);
    expect(nube.llamadas()).toHaveLength(0);
    // El resultado lleva solo códigos: el dato plantado no sale.
    expect(JSON.stringify(resultado)).not.toMatch(/\p{N}/u);
    expect(JSON.stringify(resultado).toLowerCase()).not.toContain("ficticia");
  });

  it.each(["local", "nube"] as const)("con una sola puerta (%s) también corta antes de llamar", async (modo: ModoPuertas) => {
    const { paquete, pedido, local, nube } = preparar();
    const resultado = await generarConPuertas([local, nube], modo, conVista(pedido, (v) => { v.hechos[2]!.valor = "37911.47"; }), paquete);
    expect(resultado).toEqual({ estado: "VISTA_NO_CIEGA", ok: false, motivo: "VISTA_NO_CIEGA", codigos: ["CAMPO_NO_PERMITIDO", "DIGITO_FUERA_DE_REFERENCIA", "VALOR_DEL_PAQUETE"] });
    expect(local.llamadas().length + nube.llamadas().length).toBe(0);
  });

  it("la vista de otro paquete tampoco pasa: NO_CORRESPONDE y cero llamadas", async () => {
    const { paquete, local } = preparar();
    const otro = construirPaquete({ ...entradaDiario(), hechos: entradaDiario().hechos.slice(0, 3) });
    const pedidoDeOtro = armarPedido({ paquete: otro, prompt: PROMPT_FICTICIO, esquemaSalida: ESQUEMA_FICTICIO, limiteMs: LIMITE_FICTICIO_MS });
    const resultado = await generarConPuertas([local], "local", pedidoDeOtro, paquete);
    expect(resultado).toEqual({ estado: "VISTA_NO_CIEGA", ok: false, motivo: "VISTA_NO_CIEGA", codigos: ["NO_CORRESPONDE"] });
    expect(local.llamadas()).toHaveLength(0);
  });

  it("el caso limpio pasa: el generador recibe una sola llamada, con la vista ciega y sin datos", async () => {
    const { paquete, pedido, local, nube } = preparar();
    const resultado = await generarConPuertas([local, nube], "local-luego-nube", pedido, paquete);
    expect(resultado).toMatchObject({ estado: "EXITO", ok: true, exito: { puerta: "local" } });
    expect(local.llamadas()).toHaveLength(1);
    expect(nube.llamadas()).toHaveLength(0);
    const sinIds = JSON.stringify(local.llamadas()[0]?.vista).replace(/"H[0-9]{2}"/g, '""');
    expect(sinIds).not.toMatch(/\p{N}/u);
    for (const h of paquete.hechos) expect(sinIds).not.toContain(h.presentacion);
    expect(sinIds.toLowerCase()).not.toContain("ficticia");
  });
});
