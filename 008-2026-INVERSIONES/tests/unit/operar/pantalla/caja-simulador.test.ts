// @vitest-environment jsdom
// La caja del simulador «¿Y si…?» es el saldo que el dueño escribe (el de Trii), no la certificada por Acciones & Valores,
// que puede ser otra cosa (y salir negativa). El formulario lo dice, y la respuesta dice de dónde sale la caja y, si es la
// de A&V y es negativa, lo avisa. Datos inventados (FICTICIA-*, 2027).
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { aRespuestaSimulacion, AVISO_CAJA_AV_NEGATIVA, CAJA_ESCRITA, CAJA_SIN_CERTIFICACION, textoCajaCertificada } from "@/app/operar/serializar-simulacion";
import { Simulador } from "@/app/operar/Simulador";
import { TEXTOS_SIMULADOR as T } from "@/app/operar/textos-simulador";
import { simularOperacion } from "@/operar/simulador/simular";
import type { EstadoSimulado } from "@/operar/simulador/tipos";
import { prohibidasEn } from "../informe/lenguaje";
import { montar, texto } from "../../graficas/dom";
import { A, B, CONTEXTO, D, ESTADO, idDe, operacion } from "../simulador/apoyo/estado.ficticio";

describe("el formulario dice que la caja es el saldo que se escribe", () => {
  it("el rótulo y la ayuda del saldo nombran a Trii, dicen que no se guarda y de dónde sale la caja si se deja vacío", async () => {
    expect(T.SALDO).toBe("Su saldo disponible en el comisionista ($, opcional)");
    expect(T.AYUDA_SALDO).toBe(
      "Escriba el saldo que ve en Trii, como en la ficha (37.911,47), sin signo $: esa es la caja de la simulación y no se guarda. " +
        "Si lo deja vacío, la caja es la certificada por Acciones & Valores, que puede no ser su saldo en Trii.",
    );
    const m = montar();
    try {
      await m.pintar(createElement(Simulador, { especies: [{ id: "id-ficticia-a", nemotecnico: "FICTICIA-A", cantidad: "1.237" }] }));
      expect(texto(m.contenedor.querySelector("label[for=sim-saldo]"))).toBe(T.SALDO);
      const ayuda = m.contenedor.querySelector("#sim-ayuda-saldo");
      expect(texto(ayuda)).toBe(T.AYUDA_SALDO);
      expect(m.contenedor.querySelector("#sim-saldo")?.getAttribute("aria-describedby")).toBe("sim-ayuda-saldo");
    } finally {
      m.desmontar();
    }
  });
});

describe("la respuesta dice de dónde sale la caja", () => {
  it("escrita: «el saldo que usted escribió, no la de Acciones & Valores»", () => {
    expect(CAJA_ESCRITA).toBe("Caja de la simulación: el saldo que usted escribió, no la de Acciones & Valores (no se guarda).");
  });

  it("de Acciones & Valores: dice que no es su saldo en Trii y que lo escriba; sin certificación, que la caja es 0", () => {
    expect(textoCajaCertificada("2027-03-12")).toBe("Caja certificada por Acciones & Valores al 12-mar-2027; no es su saldo en Trii. Escríbalo en «Su saldo disponible en el comisionista» para simular con él.");
    expect(CAJA_SIN_CERTIFICACION).toBe("Sin certificación de Acciones & Valores: la caja de antes es 0. Escriba su saldo en Trii en «Su saldo disponible en el comisionista» para simular con él.");
  });

  it("si la caja de A&V es negativa, lo avisa; con el saldo escrito no avisa (aunque sea 0)", () => {
    const negativa: EstadoSimulado = { ...ESTADO, caja: D("-6202.92") };
    const op = operacion(A, "COMPRAR", 3n, "4613.27");
    const deAV = aRespuestaSimulacion(simularOperacion(negativa, op, CONTEXTO), idDe(A), negativa.posiciones, new Date(Date.UTC(2027, 2, 12)));
    expect(deAV.ok && deAV.vista.avisos).toContain(AVISO_CAJA_AV_NEGATIVA);
    expect(AVISO_CAJA_AV_NEGATIVA).toBe("La caja certificada por Acciones & Valores es negativa y no es su saldo en Trii: escríbalo en «Su saldo disponible en el comisionista» para simular con él.");
    const escrita = aRespuestaSimulacion(simularOperacion({ ...ESTADO, caja: D("0") }, op, CONTEXTO), idDe(A), ESTADO.posiciones, "ESCRITA");
    expect(escrita.ok && escrita.vista.avisos).not.toContain(AVISO_CAJA_AV_NEGATIVA);
    const positiva = aRespuestaSimulacion(simularOperacion(ESTADO, operacion(B, "VENDER", 1n, "11.71"), CONTEXTO), idDe(B), ESTADO.posiciones, new Date(Date.UTC(2027, 2, 12)));
    expect(positiva.ok && positiva.vista.avisos).not.toContain(AVISO_CAJA_AV_NEGATIVA);
  });

  it("ningún texto nuevo aconseja (candado de lenguaje con control positivo)", () => {
    expect(prohibidasEn("Le conviene escribir su saldo.")).not.toEqual([]);
    for (const t of [T.SALDO, T.AYUDA_SALDO, CAJA_ESCRITA, CAJA_SIN_CERTIFICACION, AVISO_CAJA_AV_NEGATIVA, textoCajaCertificada("2027-03-12")]) expect(prohibidasEn(t)).toEqual([]);
  });
});

