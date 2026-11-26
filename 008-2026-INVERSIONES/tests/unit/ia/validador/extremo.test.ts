/**
 * De punta a punta, sin red: el paquete → `armarPedido` con el prompt y el esquema del tipo → `generarConPuertas` con un
 * generador falso → `validarSalida` sobre la salida cruda. El generador solo recibe la vista ciega (condición 1 de PI);
 * lo que publica el validador lo arma el código desde el paquete.
 */
import { describe, expect, it } from "vitest";
import { TIPOS_DIARIOS } from "@/ia/contrato";
import { armarPedido } from "@/ia/generador";
import { crearGeneradorFalso } from "@/ia/generador-falso";
import { generarConPuertas } from "@/ia/puertas";
import { ESQUEMA_SALIDA } from "@/ia/prompts/esquema";
import { PROMPTS } from "@/ia/prompts/prompts";
import { validarSalida } from "@/ia/validador/validar";
import { FRASES_VALIDAS, paqueteFicticio, renderizado, salidaDe } from "./apoyo/salidas.ficticio";

const LIMITE_MS = 4613;

describe.each(TIPOS_DIARIOS)("de punta a punta · %s", (tipo) => {
  it("una salida válida del generador falso se publica con las cifras del paquete", async () => {
    const paquete = paqueteFicticio(tipo);
    const pedido = armarPedido({ paquete, prompt: PROMPTS[tipo], esquemaSalida: ESQUEMA_SALIDA, limiteMs: LIMITE_MS });
    const falso = crearGeneradorFalso({ puerta: "local", conducta: { tipo: "RESPONDER", salidaCruda: salidaDe(paquete, ...FRASES_VALIDAS[tipo]) } });
    const resultado = await generarConPuertas([falso], "local", pedido, paquete);
    expect(resultado.estado).toBe("EXITO");
    if (resultado.estado !== "EXITO") return;
    const validado = validarSalida(resultado.exito.salidaCruda, paquete);
    expect(validado.ok).toBe(true);
    if (!validado.ok) return;
    expect(validado.resumen.texto).toBe(FRASES_VALIDAS[tipo].map((p) => renderizado(paquete, p)).join(" "));
    // Lo que recibió el generador: la vista ciega, el prompt del tipo con su hash y el esquema; ninguna cifra.
    const recibido = falso.llamadas()[0];
    expect(recibido?.prompt.hash).toBe(PROMPTS[tipo].hash);
    expect(JSON.stringify(recibido?.esquemaSalida)).toBe(JSON.stringify(ESQUEMA_SALIDA));
    const vista = JSON.stringify(recibido?.vista).replace(/"H[0-9]{2}"/g, '""');
    expect(vista).not.toMatch(/\p{N}/u);
    for (const h of paquete.hechos) expect(vista).not.toContain(h.presentacion);
  });

  it("una salida con una recomendación se rechaza aunque el generador haya respondido bien", async () => {
    const paquete = paqueteFicticio(tipo);
    const pedido = armarPedido({ paquete, prompt: PROMPTS[tipo], esquemaSalida: ESQUEMA_SALIDA, limiteMs: LIMITE_MS });
    const [primera, ...resto] = FRASES_VALIDAS[tipo];
    const conConsejo = (primera ?? "").replace(/\.$/u, ", conviene.");
    const falso = crearGeneradorFalso({ puerta: "nube", conducta: { tipo: "RESPONDER", salidaCruda: salidaDe(paquete, conConsejo, ...resto) } });
    const resultado = await generarConPuertas([falso], "nube", pedido, paquete);
    if (resultado.estado !== "EXITO") throw new Error("el falso debía responder");
    const validado = validarSalida(resultado.exito.salidaCruda, paquete);
    // «conviene» es una recomendación y, además, está fuera del vocabulario cerrado.
    expect(validado.ok ? [] : validado.motivos).toEqual(["RECOMENDACION", "IDIOMA"]);
  });
});
