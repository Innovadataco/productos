/**
 * La cadena entera del arnés con el cliente REAL de la puerta local (crearGeneradorLocal), sin red: el fetch es el
 * Ollama falso de las pruebas de E4a y pasa por la red vigilada del arnés. La lista de modelos se reemplaza con
 * `vi.mock` (como en las pruebas de la puerta local): en main solo está aprobado `ornith:9b`, sin digest.
 * Verifica: una sonda (solo tags) y después tags + generate por corrida, solo esas dos rutas, temperatura 0, semilla 42
 * y keep_alive corto, sin num_ctx; y que ni la IP ni el puerto inventados quedan en los registros.
 */
import { describe, expect, it, vi } from "vitest";
import { crearGeneradorLocal } from "@/ia/local/generador";
import { KEEP_ALIVE_LOCAL } from "@/ia/local/ollama";
import { salidaDePlantilla } from "@/ia/validador/plantilla";
import { casosInventados, limitarCasos } from "@/ia/evaluacion/casos";
import { evaluarModelo } from "@/ia/evaluacion/evaluar";
import { vigilarRed } from "@/ia/evaluacion/red";
import type { RegistroCorrida } from "@/ia/evaluacion/tipos";
import { crearOllamaFalso, generacionFicticia, json, tagsDelFicticio, vigilarFalsos } from "../local/apoyo/ollama-falso";
import { CONFIG_FICTICIA, IP_FICTICIA, MODELO_LOCAL_FICTICIO, ORIGEN_FICTICIO, PUERTO_FICTICIO, URL_GENERAR, URL_TAGS } from "../local/apoyo/red.ficticio";

vi.mock("@/ia/local/modelos", async (original) => {
  const real = await original<typeof import("@/ia/local/modelos")>();
  const red = await import("../local/apoyo/red.ficticio");
  return { ...real, MODELOS_APROBADOS: red.MODELOS_FICTICIOS, modeloAprobado: red.modeloAprobadoFicticio };
});

vigilarFalsos();

const casos = limitarCasos(casosInventados(), 2);

describe("la cadena del arnés con el cliente real de la puerta local", () => {
  it("sonda + (tags, generate) por corrida, solo las dos rutas, y todo publicado", async () => {
    // La generación responde la plantilla del caso que toca (en orden: pasada 1 y pasada 2).
    const salidas = [...casos, ...casos].map((c) => salidaDePlantilla(c.paquete));
    let generadas = 0;
    const ollama = crearOllamaFalso((llamada) => (llamada.url === URL_TAGS ? json(tagsDelFicticio()) : json(generacionFicticia({ response: salidas[generadas++] }))));
    const red = vigilarRed(ollama.fetch, ORIGEN_FICTICIO);
    const generador = crearGeneradorLocal(CONFIG_FICTICIA, { fetch: red.buscar });
    const registros: RegistroCorrida[] = [];
    let t = 0;
    const fin = await evaluarModelo(
      { casos, modelo: MODELO_LOCAL_FICTICIO, pasadas: 2, limiteMs: 4613, pausaMs: 0 },
      {
        generador, sondear: (limiteMs, senal) => generador.sondaLocal({ smoke: false, limiteMs }, senal), reloj: () => (t += 11),
        ahoraIso: () => "2027-03-17T19:00:00.000Z", esperar: () => Promise.resolve(), senal: new AbortController().signal, anotar: (r) => {
          registros.push(r);
        },
      },
    );
    expect(fin.estado).toBe("COMPLETA");
    expect(registros.map((r) => r.estado)).toEqual(["PUBLICADO", "PUBLICADO", "PUBLICADO", "PUBLICADO"]);
    expect(ollama.llamadas().map((l) => `${l.method} ${l.url}`)).toEqual([
      `GET ${URL_TAGS}`, ...Array.from({ length: 4 }, () => [`GET ${URL_TAGS}`, `POST ${URL_GENERAR}`]).flat(),
    ]);
    expect(red.conteo()).toEqual({ tags: 5, generar: 4, rechazados: 0 });
    for (const l of ollama.llamadas().filter((x) => x.method === "POST")) {
      const cuerpo = JSON.parse(l.body ?? "{}") as { options: Record<string, unknown>; keep_alive: string; stream: boolean };
      expect(cuerpo.options).toEqual({ seed: 42, temperature: 0 });
      expect(cuerpo.keep_alive).toBe(KEEP_ALIVE_LOCAL);
      expect(cuerpo.stream).toBe(false);
      expect(l.body).not.toContain("num_ctx");
    }
    const texto = JSON.stringify(registros);
    expect(texto).not.toContain(IP_FICTICIA);
    expect(texto).not.toContain(String(PUERTO_FICTICIO));
    expect(registros.every((r) => r.tokensEntrada === 613 && r.tokensSalida === 271)).toBe(true);
  });
});
