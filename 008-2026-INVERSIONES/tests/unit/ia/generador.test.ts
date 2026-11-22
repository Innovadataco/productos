/**
 * El pedido de generación: lo arma el código desde el paquete completo (la vista ciega y el hash del prompt), y se
 * rechaza mal formado sin repetir lo recibido.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CODIGOS_ERROR_PEDIDO, ErrorPedido, LIMITE_MAX_MS, MAX_LARGO_PROMPT, MOTIVOS_FALLO, PUERTAS, armarPedido, revisarPedido, type CodigoErrorPedido, type PedidoGeneracion } from "@/ia/generador";
import { construirPaquete } from "@/ia/paquete";
import { ErrorVistaCiega, vistaCiega } from "@/ia/vista-ciega";
import { fugasEn, hayDigitosFueraDeIds } from "./apoyo/detectores";
import { entradaDiario } from "./apoyo/hechos.ficticio";
import { ESQUEMA_FICTICIO, LIMITE_FICTICIO_MS, PROMPT_FICTICIO } from "./apoyo/pedido.ficticio";

const paquete = () => construirPaquete(entradaDiario());
const entrada = () => ({ paquete: paquete(), prompt: PROMPT_FICTICIO, esquemaSalida: ESQUEMA_FICTICIO, limiteMs: LIMITE_FICTICIO_MS });

function codigoDe(accion: () => unknown): CodigoErrorPedido {
  try {
    accion();
  } catch (e) {
    if (e instanceof ErrorPedido) return e.codigo;
    throw e;
  }
  throw new Error("no lanzó");
}

describe("listas cerradas de las puertas", () => {
  it("las puertas, los motivos de fallo y los códigos del pedido son listas exactas y congeladas", () => {
    expect([...PUERTAS]).toEqual(["local", "nube"]);
    expect([...MOTIVOS_FALLO]).toEqual(["MODELO_NO_DISPONIBLE", "TIEMPO_AGOTADO", "TOPE_MENSUAL", "PUERTA_APAGADA", "ERROR_PROVEEDOR", "VISTA_NO_CIEGA"]);
    expect([...CODIGOS_ERROR_PEDIDO]).toEqual(["CAMPO_DESCONOCIDO", "PROMPT_INVALIDO", "PROMPT_HASH_NO_COINCIDE", "ESQUEMA_INVALIDO", "LIMITE_INVALIDO"]);
    expect(Object.isFrozen(PUERTAS) && Object.isFrozen(MOTIVOS_FALLO) && Object.isFrozen(CODIGOS_ERROR_PEDIDO)).toBe(true);
  });
});

describe("armarPedido", () => {
  it("lleva la vista ciega del paquete, el prompt con su hash calculado, el esquema y el límite; todo congelado", () => {
    const e = entrada();
    const pedido = armarPedido(e);
    expect(pedido.vista).toEqual(vistaCiega(e.paquete));
    expect(pedido.prompt).toEqual({ ...PROMPT_FICTICIO, hash: createHash("sha256").update(PROMPT_FICTICIO.texto, "utf8").digest("hex") });
    expect(pedido.esquemaSalida).toEqual(ESQUEMA_FICTICIO);
    expect(pedido.esquemaSalida).not.toBe(ESQUEMA_FICTICIO);
    expect(pedido.limiteMs).toBe(LIMITE_FICTICIO_MS);
    expect(Object.keys(pedido).sort()).toEqual(["esquemaSalida", "limiteMs", "prompt", "vista"]);
    expect(Object.isFrozen(pedido) && Object.isFrozen(pedido.prompt) && Object.isFrozen(pedido.esquemaSalida) && Object.isFrozen(pedido.vista)).toBe(true);
  });

  it("el pedido no lleva el paquete completo: su vista no tiene valores, presentaciones, nombres, fuentes ni fechas", () => {
    const e = entrada();
    const pedido = armarPedido(e);
    const json = JSON.stringify(pedido.vista);
    expect(hayDigitosFueraDeIds(json)).toBe(false);
    expect(fugasEn(json, e.paquete)).toEqual([]);
    expect(fugasEn(JSON.stringify(pedido.prompt.texto), e.paquete)).toEqual([]);
    expect(JSON.stringify(pedido)).not.toContain(e.paquete.hash);
    // Las presentaciones cortas («7») pueden aparecer por azar en el hash del prompt: se miran las largas.
    for (const h of e.paquete.hechos.filter((x) => x.presentacion.length > 3)) expect(JSON.stringify(pedido)).not.toContain(h.presentacion);
  });

  it("un paquete alterado (el hash no cuadra) no da pedido", () => {
    const e = entrada();
    expect(() => armarPedido({ ...e, paquete: { ...e.paquete, hoy: "2027-03-18" } })).toThrow(ErrorVistaCiega);
  });

  it.each([
    ["PROMPT_INVALIDO", "texto vacío", { prompt: { texto: "", version: "resumen-ficticio-v1" } }],
    ["PROMPT_INVALIDO", "texto demasiado largo", { prompt: { texto: "a".repeat(MAX_LARGO_PROMPT + 1), version: "resumen-ficticio-v1" } }],
    ["PROMPT_INVALIDO", "texto con sustituto suelto", { prompt: { texto: "a\uD800", version: "resumen-ficticio-v1" } }],
    ["PROMPT_INVALIDO", "versión sin número", { prompt: { texto: "a", version: "resumen-ficticio" } }],
    ["PROMPT_INVALIDO", "versión en mayúsculas", { prompt: { texto: "a", version: "Resumen-v1" } }],
    ["PROMPT_INVALIDO", "versión cero", { prompt: { texto: "a", version: "resumen-v0" } }],
    ["PROMPT_INVALIDO", "prompt que no es objeto", { prompt: "a" }],
    ["ESQUEMA_INVALIDO", "esquema que no es objeto", { esquemaSalida: [] }],
    ["ESQUEMA_INVALIDO", "esquema que no es de tipo object", { esquemaSalida: { type: "array" } }],
    ["ESQUEMA_INVALIDO", "esquema con un decimal", { esquemaSalida: { type: "object", minimum: 0.5 } }],
    ["ESQUEMA_INVALIDO", "esquema con una función", { esquemaSalida: { type: "object", f: () => 1 } }],
    ["ESQUEMA_INVALIDO", "esquema demasiado grande", { esquemaSalida: { type: "object", description: "a".repeat(40_000) } }],
    ["LIMITE_INVALIDO", "límite cero", { limiteMs: 0 }],
    ["LIMITE_INVALIDO", "límite por encima del máximo", { limiteMs: LIMITE_MAX_MS + 1 }],
    ["LIMITE_INVALIDO", "límite con decimales", { limiteMs: 1.5 }],
    ["LIMITE_INVALIDO", "límite NaN", { limiteMs: Number.NaN }],
  ])("%s: %s", (codigo, _caso, cambio) => {
    expect(codigoDe(() => armarPedido({ ...entrada(), ...(cambio as object) } as never))).toBe(codigo);
  });
});

describe("revisarPedido", () => {
  const pedido = (): PedidoGeneracion => armarPedido(entrada());

  it("acepta el pedido armado y devuelve una copia con solo los campos del contrato", () => {
    const original = pedido();
    const revisado = revisarPedido(original);
    expect(revisado).toEqual(original);
    expect(Object.keys(revisado.prompt).sort()).toEqual(["hash", "texto", "version"]);
  });

  it.each([
    ["CAMPO_DESCONOCIDO", "un campo de más en el pedido", (p: PedidoGeneracion) => ({ ...p, paquete: entrada().paquete })],
    ["CAMPO_DESCONOCIDO", "un campo de más en el prompt", (p: PedidoGeneracion) => ({ ...p, prompt: { ...p.prompt, datos: "x" } })],
    ["PROMPT_HASH_NO_COINCIDE", "un hash que no es el del texto", (p: PedidoGeneracion) => ({ ...p, prompt: { ...p.prompt, texto: `${p.prompt.texto} Más.` } })],
    ["PROMPT_INVALIDO", "un prompt sin versión válida", (p: PedidoGeneracion) => ({ ...p, prompt: { ...p.prompt, version: "x" } })],
    ["PROMPT_INVALIDO", "un pedido que no es objeto", () => null],
    ["ESQUEMA_INVALIDO", "un esquema roto", (p: PedidoGeneracion) => ({ ...p, esquemaSalida: { type: "string" } })],
    ["LIMITE_INVALIDO", "un límite negativo", (p: PedidoGeneracion) => ({ ...p, limiteMs: -7 })],
  ])("%s: %s", (codigo, _caso, mutar) => {
    expect(codigoDe(() => revisarPedido(mutar(pedido()) as PedidoGeneracion))).toBe(codigo);
  });

  it("el mensaje del error no repite lo recibido", () => {
    try {
      revisarPedido({ ...pedido(), prompt: { ...pedido().prompt, version: "FICTICIA-ALFA" } });
    } catch (e) {
      expect((e as Error).message).not.toContain("FICTICIA");
      expect((e as Error).message).toContain("PROMPT_INVALIDO");
    }
  });
});
