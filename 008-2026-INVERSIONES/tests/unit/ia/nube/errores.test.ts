/**
 * La traducción de los errores del SDK a un fallo del contrato: un motivo de la lista cerrada y un detalle que es un
 * código (sin dígitos), nunca el mensaje del proveedor ni la llave. Con las clases de error REALES del SDK. Y si una
 * llamada fallida pudo haberse cobrado (para la reserva del tope).
 */
import {
  APIConnectionError, APIConnectionTimeoutError, APIError, APIUserAbortError, AnthropicError, RateLimitError,
} from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { MAX_LARGO_DETALLE, MOTIVOS_FALLO_GENERADOR, PATRON_DETALLE, type MotivoFalloGenerador } from "@/ia/generador";
import { CODIGOS_APAGADO_NUBE } from "@/ia/nube/config";
import { DETALLES_NUBE, hayPosibleCobro, traducirError } from "@/ia/nube/respuesta";
import { ErrorTransporteNube } from "@/ia/nube/transporte";
import { LLAVE_FICTICIA, MENSAJE_DEL_PROVEEDOR, cuerpoErrorFicticio } from "./apoyo/datos.ficticio";

const viva = (): AbortSignal => new AbortController().signal;
const abortada = (): AbortSignal => AbortSignal.abort();
const deEstado = (estado: number, tipo: string, codigo?: string): APIError => APIError.generate(estado, cuerpoErrorFicticio(tipo, codigo), undefined, new Headers({ "request-id": "req_ficticio_alfa" }));

const TABLA: readonly (readonly [string, () => unknown, MotivoFalloGenerador, string, boolean])[] = [
  ["400", () => deEstado(400, "invalid_request_error"), "ERROR_PROVEEDOR", "PEDIDO_RECHAZADO", false],
  ["401", () => deEstado(401, "authentication_error"), "ERROR_PROVEEDOR", "NO_AUTORIZADO", false],
  ["402", () => deEstado(402, "billing_error"), "ERROR_PROVEEDOR", "PAGO_REQUERIDO", false],
  ["403", () => deEstado(403, "permission_error"), "ERROR_PROVEEDOR", "PROHIBIDO", false],
  ["404", () => deEstado(404, "not_found_error"), "MODELO_NO_DISPONIBLE", "MODELO_NO_ENCONTRADO", false],
  ["408", () => deEstado(408, "timeout_error"), "TIEMPO_AGOTADO", "TIEMPO_DEL_PROVEEDOR", false],
  ["409", () => deEstado(409, "conflict_error"), "ERROR_PROVEEDOR", "ERROR_DESCONOCIDO", false],
  ["413", () => deEstado(413, "request_too_large"), "ERROR_PROVEEDOR", "PEDIDO_DEMASIADO_GRANDE", false],
  ["418", () => deEstado(418, "invalid_request_error"), "ERROR_PROVEEDOR", "ERROR_DESCONOCIDO", false],
  ["422", () => deEstado(422, "invalid_request_error"), "ERROR_PROVEEDOR", "PEDIDO_RECHAZADO", false],
  ["429", () => deEstado(429, "rate_limit_error"), "MODELO_NO_DISPONIBLE", "LIMITE_DE_PEDIDOS", false],
  ["429 por el límite de gasto de la cuenta", () => deEstado(429, "rate_limit_error", "enforced_spend_limit_reached"), "TOPE_MENSUAL", "LIMITE_DE_GASTO_DEL_PROVEEDOR", false],
  ["500", () => deEstado(500, "api_error"), "ERROR_PROVEEDOR", "ERROR_DEL_SERVIDOR", false],
  ["501", () => deEstado(501, "api_error"), "ERROR_PROVEEDOR", "ERROR_DEL_SERVIDOR", false],
  ["503", () => deEstado(503, "api_error"), "MODELO_NO_DISPONIBLE", "SERVICIO_NO_DISPONIBLE", false],
  ["504", () => deEstado(504, "timeout_error"), "TIEMPO_AGOTADO", "TIEMPO_DEL_PROVEEDOR", false],
  ["529", () => deEstado(529, "overloaded_error"), "MODELO_NO_DISPONIBLE", "SOBRECARGA", false],
  ["el pedido abortado", () => new APIUserAbortError(), "TIEMPO_AGOTADO", "ABORTADO", true],
  ["el tiempo del cliente", () => new APIConnectionTimeoutError(), "TIEMPO_AGOTADO", "TIEMPO_DEL_CLIENTE", true],
  ["sin conexión", () => new APIConnectionError({ cause: new TypeError("fetch failed") }), "MODELO_NO_DISPONIBLE", "SIN_CONEXION", true],
  ["el transporte negó el destino", () => new APIConnectionError({ cause: new ErrorTransporteNube("DESTINO_NO_PERMITIDO") }), "ERROR_PROVEEDOR", "DESTINO_NO_PERMITIDO", false],
  ["la respuesta pasó del tope de bytes", () => new APIConnectionError({ cause: new ErrorTransporteNube("RESPUESTA_DEMASIADO_GRANDE") }), "ERROR_PROVEEDOR", "RESPUESTA_DEMASIADO_GRANDE", true],
  ["un error del SDK sin estado", () => new AnthropicError(MENSAJE_DEL_PROVEEDOR), "ERROR_PROVEEDOR", "EXCEPCION_INTERNA", true],
  ["un Error cualquiera", () => new Error(`${MENSAJE_DEL_PROVEEDOR} ${LLAVE_FICTICIA}`), "ERROR_PROVEEDOR", "EXCEPCION_INTERNA", true],
  ["un texto lanzado", () => LLAVE_FICTICIA, "ERROR_PROVEEDOR", "EXCEPCION_INTERNA", true],
  ["null lanzado", () => null, "ERROR_PROVEEDOR", "EXCEPCION_INTERNA", true],
];

describe("traducirError", () => {
  it.each(TABLA)("%s → el motivo y el detalle de la tabla", (_caso, crear, motivo, detalle) => {
    expect(traducirError(crear(), viva())).toEqual({ ok: false, puerta: "nube", motivo, detalle });
  });

  it("el 429 del límite de gasto llega como la subclase real del SDK (hija de RateLimitError)", () => {
    const error = deEstado(429, "rate_limit_error", "enforced_spend_limit_reached");
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.errorCode).toBe("enforced_spend_limit_reached");
  });

  it.each(TABLA)("con la señal ya abortada, %s es TIEMPO_AGOTADO · ABORTADO", (_caso, crear) => {
    expect(traducirError(crear(), abortada())).toEqual({ ok: false, puerta: "nube", motivo: "TIEMPO_AGOTADO", detalle: "ABORTADO" });
  });

  it.each(TABLA)("%s: el fallo no lleva el mensaje del proveedor, ni cifras, ni la llave", (_caso, crear) => {
    const json = JSON.stringify(traducirError(crear(), viva()));
    for (const prohibido of ["FICTICIA", "4613", "secreto", LLAVE_FICTICIA, "req_ficticio"]) expect(json).not.toContain(prohibido);
  });
});

describe("hayPosibleCobro", () => {
  it.each(TABLA)("%s → según la tabla (una respuesta HTTP de error no se cobra; lo que pudo llegar, sí)", (_caso, crear, _motivo, _detalle, cobro) => {
    expect(hayPosibleCobro(crear())).toBe(cobro);
  });
});

describe("DETALLES_NUBE", () => {
  it("es una lista cerrada y congelada que incluye los códigos de apagado y todos los de la tabla", () => {
    expect(Object.isFrozen(DETALLES_NUBE)).toBe(true);
    for (const codigo of CODIGOS_APAGADO_NUBE) expect(DETALLES_NUBE).toContain(codigo);
    for (const [, , , detalle] of TABLA) expect(DETALLES_NUBE).toContain(detalle);
    for (const detalle of ["TOPE_DEL_MES", "GASTO_NO_VERIFICABLE", "RESPUESTA_INVALIDA", "PEDIDO_INVALIDO", "VISTA_NO_CIEGA", "ESQUEMA_NO_ADMITIDO"]) expect(DETALLES_NUBE).toContain(detalle);
    expect(new Set(DETALLES_NUBE).size).toBe(DETALLES_NUBE.length);
  });

  it.each([...new Set([...CODIGOS_APAGADO_NUBE, "TOPE_DEL_MES", "GASTO_NO_VERIFICABLE", ...TABLA.map((fila) => fila[3])])])("«%s» cumple el patrón del detalle y su largo", (detalle) => {
    expect(PATRON_DETALLE.test(detalle)).toBe(true);
    expect(detalle.length).toBeLessThanOrEqual(MAX_LARGO_DETALLE);
  });

  it("todos los motivos de la tabla son del contrato", () => {
    for (const [, , motivo] of TABLA) expect(MOTIVOS_FALLO_GENERADOR).toContain(motivo);
  });
});
