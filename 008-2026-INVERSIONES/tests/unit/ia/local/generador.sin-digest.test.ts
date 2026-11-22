/**
 * Con la lista REAL de modelos (sin mocks): `ornith:9b` está aprobado, pero su digest no se ha medido en el Mac. Hasta
 * que se mida (E7), la puerta local cierra en fallo sin tocar la red: generar y la sonda dicen DIGEST_POR_VERIFICAR.
 * Ningún otro modelo (ni un 32B) se puede configurar.
 */
import { describe, expect, it } from "vitest";
import { ErrorLocal } from "@/ia/local/errores";
import { crearGeneradorLocal } from "@/ia/local/generador";
import { generarConPuertas } from "@/ia/puertas";
import { crearOllamaFalso, guionFeliz, vigilarFalsos } from "./apoyo/ollama-falso";
import { MODELO_LOCAL_FICTICIO, ORIGEN_FICTICIO, pedidoFicticio } from "./apoyo/red.ficticio";

vigilarFalsos();

describe("puerta local con la lista real de modelos", () => {
  it("ornith:9b con el digest pendiente: generar da MODELO_NO_DISPONIBLE DIGEST_POR_VERIFICAR, sin red", async () => {
    const falso = crearOllamaFalso(guionFeliz());
    const local = crearGeneradorLocal({ destino: ORIGEN_FICTICIO, modelo: "ornith:9b" }, { fetch: falso.fetch });
    expect(await local.generar(pedidoFicticio().pedido, new AbortController().signal)).toEqual({ ok: false, puerta: "local", motivo: "MODELO_NO_DISPONIBLE", detalle: "DIGEST_POR_VERIFICAR" });
    expect(falso.llamadas()).toHaveLength(0);
  });

  it("por generarConPuertas también: FALLO, sin red", async () => {
    const falso = crearOllamaFalso(guionFeliz());
    const local = crearGeneradorLocal({ destino: ORIGEN_FICTICIO, modelo: "ornith:9b" }, { fetch: falso.fetch });
    const { pedido, paquete } = pedidoFicticio();
    expect(await generarConPuertas([local], "local", pedido, paquete)).toEqual({
      estado: "FALLO",
      ok: false,
      fallos: [{ ok: false, puerta: "local", motivo: "MODELO_NO_DISPONIBLE", detalle: "DIGEST_POR_VERIFICAR" }],
    });
    expect(falso.llamadas()).toHaveLength(0);
  });

  it("la sonda dice lo mismo en la etapa del ping, sin red", async () => {
    const falso = crearOllamaFalso(guionFeliz());
    const local = crearGeneradorLocal({ destino: ORIGEN_FICTICIO, modelo: "ornith:9b" }, { fetch: falso.fetch });
    expect(await local.sondaLocal({ smoke: true, limiteMs: 4613 })).toEqual({
      ok: false, etapa: "PING", motivo: "MODELO_NO_DISPONIBLE", detalle: "DIGEST_POR_VERIFICAR", latenciaMs: 0,
    });
    expect(falso.llamadas()).toHaveLength(0);
  });

  it.each(["ornith:32b", "qwen2.5:14b", "qwen2.5:32b", MODELO_LOCAL_FICTICIO, "ornith:latest"])("«%s» no se puede configurar: MODELO_NO_APROBADO", (modelo) => {
    const falso = crearOllamaFalso(guionFeliz());
    expect(() => crearGeneradorLocal({ destino: ORIGEN_FICTICIO, modelo }, { fetch: falso.fetch })).toThrow(new ErrorLocal("MODELO_NO_APROBADO"));
  });
});
