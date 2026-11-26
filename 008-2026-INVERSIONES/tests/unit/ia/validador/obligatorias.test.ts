/**
 * Los obligatorios del DIARIO los escribe el CODIGO (T4): `validarSalida` compone la salida con las frases de la plantilla
 * para los obligatorios (los que no son nombre) que ninguna cita del modelo trae, primero las del código y después las
 * del modelo. Es determinista; si el modelo ya los cita todos no agrega nada; cada frase, de quien sea, pasa todos los
 * controles; el modelo tiene que traer al menos una frase; y REGLAS y ESCENARIOS no cambian. Datos inventados.
 */
import { describe, expect, it } from "vitest";
import type { Hecho, PaqueteHechos } from "@/ia/contrato";
import { VERSION_VALIDADOR } from "@/ia/validador/codigos";
import { diagnosticarSalida } from "@/ia/validador/diagnostico";
import { aportaElModelo, componerConObligatorias, escribeElCodigo, TIPOS_OBLIGATORIAS_DEL_CODIGO } from "@/ia/validador/obligatorias";
import { leerSalida } from "@/ia/validador/leer";
import { frasesParaLosHechos, resumenSinIa, salidaDePlantilla } from "@/ia/validador/plantilla";
import { validarSalida } from "@/ia/validador/validar";
import { crearPrng } from "@/proyecciones/prng";
import { construirPaquete } from "@/ia/paquete";
import { entradaAlAzar } from "../apoyo/aleatorio.ficticio";
import { paqueteAlAzarConTope, paqueteFicticio, renderizado, salidaDe, hechoDe } from "./apoyo/salidas.ficticio";

/** El DIARIO ficticio con tres obligatorios: el valor de las acciones, la ganancia total y las especies atrasadas. */
const diario = (): PaqueteHechos<"DIARIO"> => paqueteFicticio("DIARIO", { GANANCIA_TOTAL: { obligatorio: true }, ESPECIES_ATRASADAS: { obligatorio: true } });
/** Una frase del modelo que no cita ningún obligatorio. */
const SOLO_ESPECIE = "{ESPECIE_NOMBRE}: el valor de la especie subió a {VALOR_ESPECIE}.";
const VALOR = "El valor de las acciones subió a {VALOR_ACCIONES}.";
const GANANCIA = "La ganancia total bajó a {GANANCIA_TOTAL}.";
const ATRASADAS = "Las especies con cierre atrasado son {ESPECIES_ATRASADAS}.";

const obligatoriosDe = (p: PaqueteHechos): readonly Hecho[] => p.hechos.filter((h) => h.obligatorio && h.unidad !== "NOMBRE");
const validar = (p: PaqueteHechos, ...plantillas: string[]) => validarSalida(salidaDe(p, ...plantillas), p);
/** El texto de la plantilla con cada cita cambiada por su presentación (lo que publica el render). */
const presentado = (p: PaqueteHechos, texto: string): string => texto.replace(/\{(H[0-9]{2})\}/gu, (_c, id: string) => p.hechos.find((h) => h.id === id)?.presentacion ?? "");
const textosDe = (r: ReturnType<typeof validarSalida>): readonly string[] => (r.ok ? r.resumen.frases.map((f) => f.texto) : []);

describe("TIPOS_OBLIGATORIAS_DEL_CODIGO", () => {
  it("es solo el DIARIO y está congelada", () => {
    expect([...TIPOS_OBLIGATORIAS_DEL_CODIGO]).toEqual(["DIARIO"]);
    expect(Object.isFrozen(TIPOS_OBLIGATORIAS_DEL_CODIGO)).toBe(true);
  });
  it("la versión del validador subió a la v3", () => {
    expect(VERSION_VALIDADOR).toBe("validador-v4");
  });
});

describe("el código escribe los obligatorios que el modelo no cita", () => {
  it("el modelo no cita ninguno: se publica, con las frases del código primero (en el orden del paquete) y la del modelo después", () => {
    const p = diario();
    const r = validar(p, SOLO_ESPECIE);
    expect(r.ok, r.ok ? "" : r.motivos.join(",")).toBe(true);
    if (!r.ok) return;
    const delCodigo = leerSalida(salidaDePlantilla(p))?.frases.length ?? 0;
    expect(delCodigo).toBeGreaterThan(0);
    const textos = textosDe(r);
    expect(textos.at(-1)).toBe(renderizado(p, SOLO_ESPECIE));
    expect(textos).toHaveLength(delCodigo + 1);
    for (const h of obligatoriosDe(p)) expect(r.resumen.citados).toContain(h.id);
    // Lo que escribió el código sale en el orden del paquete: valor de las acciones, ganancia total, especies atrasadas.
    const orden = obligatoriosDe(p).map((h) => r.resumen.citados.indexOf(h.id));
    expect([...orden].sort((a, b) => a - b)).toEqual(orden);
  });

  it("el modelo cita todos: el código no agrega nada y sale lo del modelo", () => {
    const p = diario();
    const r = validar(p, VALOR, GANANCIA, ATRASADAS, SOLO_ESPECIE);
    expect(textosDe(r)).toEqual([VALOR, GANANCIA, ATRASADAS, SOLO_ESPECIE].map((t) => renderizado(p, t)));
  });

  it("el modelo cita algunos: el código escribe solo los que faltan", () => {
    const p = diario();
    const r = validar(p, GANANCIA, SOLO_ESPECIE);
    expect(r.ok).toBe(true);
    const textos = textosDe(r);
    const delCodigo = frasesParaLosHechos(p, [hechoDe(p, "VALOR_ACCIONES"), hechoDe(p, "ESPECIES_ATRASADAS")]).map((t) => presentado(p, t));
    expect(textos).toEqual([...delCodigo, renderizado(p, GANANCIA), renderizado(p, SOLO_ESPECIE)]);
  });

  it("es determinista: la misma salida da el mismo resultado", () => {
    const p = diario();
    expect(validar(p, SOLO_ESPECIE)).toEqual(validar(p, SOLO_ESPECIE));
  });

  it("componerConObligatorias dice cuántas frases escribió el código y no toca la salida si no falta nada", () => {
    const p = diario();
    const completa = leerSalida(salidaDe(p, VALOR, GANANCIA, ATRASADAS));
    const incompleta = leerSalida(salidaDe(p, SOLO_ESPECIE));
    if (completa === null || incompleta === null) throw new Error("la salida debía leerse");
    expect(componerConObligatorias(p, completa)).toEqual({ frases: completa.frases, delCodigo: 0 });
    const c = componerConObligatorias(p, incompleta);
    expect(c.delCodigo).toBeGreaterThan(0);
    expect(c.frases.slice(c.delCodigo)).toEqual(incompleta.frases);
  });
});

describe("el modelo sigue obligado a escribir", () => {
  it("{\"frases\":[]} es LONGITUD.FRASES aunque el código sí escribiría los obligatorios", () => {
    const p = diario();
    const r = validarSalida(JSON.stringify({ frases: [] }), p);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.hallazgos.map((h) => h.patron)).toContain("LONGITUD.FRASES");
  });

  it("más de seis frases entre el código y el modelo: LONGITUD.FRASES", () => {
    const p = diario();
    const r = validar(p, ...Array.from({ length: 6 }, () => SOLO_ESPECIE));
    expect(r.ok ? [] : r.hallazgos.map((h) => h.patron)).toContain("LONGITUD.FRASES");
  });

  it("cada frase del modelo pasa todos los controles, y el hallazgo lleva su número entre las frases compuestas", () => {
    const p = diario();
    const mala = "{ESPECIE_NOMBRE}: compre ya la especie con {VALOR_ESPECIE}.";
    const cruda = salidaDe(p, mala);
    const delCodigo = componerConObligatorias(p, leerSalida(cruda) ?? { frases: [] }).delCodigo;
    const r = validarSalida(cruda, p);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const reco = r.hallazgos.find((h) => h.codigo === "RECOMENDACION");
    expect(reco?.frase).toBe(delCodigo);
    const d = diagnosticarSalida(cruda, p).find((h) => h.codigo === "RECOMENDACION");
    expect(d).toMatchObject({ frase: delCodigo, parte: "MODELO" });
    expect(diagnosticarSalida(cruda, p).some((h) => h.parte === "CODIGO")).toBe(false);
  });
});

describe("el modelo tiene que aportar algo que no sea un obligatorio", () => {
  const patronesDe = (r: ReturnType<typeof validarSalida>): readonly string[] => (r.ok ? [] : r.hallazgos.map((h) => h.patron));

  it("si solo cita obligatorios, se rechaza: sería la plantilla publicada como IA", () => {
    const p = diario();
    const r = validar(p, VALOR, GANANCIA, ATRASADAS);
    expect(r.ok).toBe(false);
    expect(r.ok ? [] : r.motivos).toContain("LONGITUD");
    expect(patronesDe(r)).toContain("LONGITUD.SIN_APORTE_DEL_MODELO");
  });

  it("aportaElModelo: citar solo obligatorios y nombres no es aportar; un hecho que no lo es, sí", () => {
    const p = diario();
    const id = (c: Parameters<typeof hechoDe>[1]): string => hechoDe(p, c).id;
    const de = (...hechos: string[]) => ({ frases: [{ texto: "x", hechos }] });
    expect(aportaElModelo(p, de(id("ESPECIE_NOMBRE"), id("VALOR_ACCIONES")))).toBe(false);
    expect(aportaElModelo(p, de(id("ESPECIE_NOMBRE"), id("VALOR_ESPECIE")))).toBe(true);
    expect(aportaElModelo(p, de("H99"))).toBe(false);
  });

  it("un obligatorio y un hecho que no lo es: se publica", () => {
    const p = diario();
    expect(validar(p, GANANCIA, SOLO_ESPECIE).ok).toBe(true);
  });

  it("la salida de la plantilla sin IA sigue pasando (es la plantilla, no un modelo)", () => {
    const p = diario();
    expect(validarSalida(salidaDePlantilla(p), p).ok).toBe(true);
  });
});

describe("lo que no cambia", () => {
  it.each([["REGLAS", {}], ["ESCENARIOS", { ESCENARIO_CENTRAL_CORTO: { obligatorio: true } }]] as const)(
    "%s: un obligatorio sin citar sigue siendo HECHO_NO_CITADO.OBLIGATORIO (el código no lo escribe)",
    (tipo, marcas) => {
      const p = paqueteFicticio(tipo, marcas);
      const otro = p.hechos.find((h) => !h.obligatorio && h.unidad !== "NOMBRE" && h.sujeto === undefined);
      expect(obligatoriosDe(p).length).toBeGreaterThan(0);
      expect(otro).toBeDefined();
      const cruda = JSON.stringify({ frases: [{ segmentos: [{ texto: "La referencia es " }, { ref: otro?.id ?? "H01" }, { texto: "." }] }] });
      const r = validarSalida(cruda, p);
      expect(r.ok ? [] : r.hallazgos.map((h) => h.patron)).toContain("HECHO_NO_CITADO.OBLIGATORIO");
      expect(componerConObligatorias(p, leerSalida(cruda) ?? { frases: [] }).delCodigo).toBe(0);
    },
  );

  it("la plantilla sin IA sigue publicando y no repite lo que escribe el código", () => {
    const p = diario();
    const r = resumenSinIa(p);
    expect(r.ok).toBe(true);
    const lista = r.ok ? r.resumen.citados : [];
    expect(new Set(lista).size).toBe(lista.length);
  });
});

describe("HECHO_NO_CITADO.OBLIGATORIO solo salta si las frases del código no caben", () => {
  it("con todos los hechos obligatorios: rechaza siempre, y por HECHO_NO_CITADO solo si el código no alcanza a escribirlos", () => {
    const prng = crearPrng(4_613);
    let noCaben = 0;
    let caben = 0;
    for (let i = 0; i < 113; i += 1) {
      const entrada = entradaAlAzar(prng, "DIARIO");
      const p = construirPaquete({ ...entrada, hechos: entrada.hechos.map((h) => ({ ...h, obligatorio: true })) });
      const uno = p.hechos.find((h) => h.unidad !== "NOMBRE");
      if (uno === undefined) continue;
      const delModelo = frasesParaLosHechos(p, [uno]);
      const r = validarSalida(JSON.stringify({ frases: delModelo.map((t) => ({ segmentos: leerSegmentos(t) })) }), p);
      const citadosPorElModelo = new Set(delModelo.flatMap((t) => [...t.matchAll(/\{(H[0-9]{2})\}/gu)].map((m) => m[1])));
      const faltantes = p.hechos.filter((h) => !citadosPorElModelo.has(h.id));
      const escritos = new Set(frasesParaLosHechos(p, faltantes).flatMap((t) => [...t.matchAll(/\{(H[0-9]{2})\}/gu)].map((m) => m[1])));
      const sinLugar = faltantes.some((h) => h.unidad !== "NOMBRE" && !escritos.has(h.id)) || faltantes.some((h) => h.unidad === "NOMBRE" && !escritos.has(h.id));
      if (sinLugar) {
        noCaben += 1;
        expect(r.ok).toBe(false);
        expect(r.ok ? [] : r.motivos).toContain("HECHO_NO_CITADO");
      } else {
        caben += 1;
        if (!r.ok) expect(r.motivos, r.motivos.join(",")).not.toContain("HECHO_NO_CITADO");
      }
    }
    expect(noCaben).toBeGreaterThan(0);
    expect(caben).toBeGreaterThan(0);
  });
});

describe("propiedad: la salida del modelo con cualquier subconjunto de los obligatorios se completa", () => {
  it("211 DIARIO al azar: publica con todos los obligatorios citados, y si el modelo ya los cita todos, sin frases del código", () => {
    const prng = crearPrng(40_961);
    let completados = 0;
    let sinCambio = 0;
    for (let i = 0; i < 211; i += 1) {
      const p = paqueteAlAzarConTope(prng, "DIARIO");
      const obligatorios = obligatoriosDe(p);
      if (obligatorios.length === 0 || !resumenSinIa(p).ok) continue;
      const elegidos = obligatorios.filter((_h, j) => (prng.enteroMenorQue(2) === 1 ? true : j === 0));
      // El modelo tiene que aportar: además de los obligatorios elegidos, una frase de un hecho que no lo es (ni un nombre).
      const aporte = p.hechos.find((h) => !h.obligatorio && h.unidad !== "NOMBRE");
      if (aporte === undefined) continue;
      const delModelo = [...frasesParaLosHechos(p, elegidos), ...frasesParaLosHechos(p, [aporte])];
      const cruda = JSON.stringify({ frases: delModelo.map((t) => ({ segmentos: leerSegmentos(t) })) });
      const r = validarSalida(cruda, p);
      if (!r.ok) {
        // Solo puede rechazar por el largo conjunto (las frases del modelo y las del código no caben juntas).
        expect(r.motivos.every((m) => m === "LONGITUD" || m === "HECHO_NO_CITADO"), r.hallazgos.map((h) => h.patron).join(",")).toBe(true);
        continue;
      }
      for (const h of obligatorios) expect(r.resumen.citados, h.id).toContain(h.id);
      if (elegidos.length === obligatorios.length) sinCambio += 1;
      else completados += 1;
    }
    expect(completados).toBeGreaterThan(0);
    expect(sinCambio).toBeGreaterThan(0);
  });
});

function leerSegmentos(texto: string): readonly ({ texto: string } | { ref: string })[] {
  return texto.split(/(\{H[0-9]{2}\})/u).filter((x) => x !== "").map((x) => (/^\{H[0-9]{2}\}$/u.test(x) ? { ref: x.slice(1, -1) } : { texto: x }));
}
