/**
 * `validarSalida`: una salida válida da el texto armado por el código (cada `{Hnn}` con la presentación del paquete
 * construido), el aviso fijo y las cifras usadas; cada código del validador tiene su rechazo; los códigos se juntan
 * todos, en el orden canónico y sin repetir; nada sale del texto del modelo en un rechazo.
 */
import { describe, expect, it } from "vitest";
import { TIPOS_DIARIOS, type PaqueteHechos } from "@/ia/contrato";
import { fecha as fechaEsCo } from "@/app/tablero/formato";
import { CODIGOS_VALIDADOR, ErrorValidador, VERSION_VALIDADOR, type CodigoValidador } from "@/ia/validador/codigos";
import { AVISOS } from "@/ia/validador/resumen";
import { validarSalida } from "@/ia/validador/validar";
import { FRASES_VALIDAS, frase, hechoDe, paqueteFicticio, renderizado, salida, salidaDe } from "./apoyo/salidas.ficticio";

const diario = (): PaqueteHechos<"DIARIO"> => paqueteFicticio("DIARIO");
const [VALOR_ACCIONES, ESPECIE, GANANCIA, ATRASADAS] = FRASES_VALIDAS.DIARIO as readonly [string, string, string, string];

function motivosDe(salidaCruda: unknown, paquete: PaqueteHechos = diario()): readonly CodigoValidador[] {
  const resultado = validarSalida(salidaCruda, paquete);
  return resultado.ok ? [] : resultado.motivos;
}

function patronesDe(salidaCruda: unknown, paquete: PaqueteHechos = diario()): readonly string[] {
  const resultado = validarSalida(salidaCruda, paquete);
  return resultado.ok ? [] : resultado.hallazgos.map((h) => h.patron);
}

describe("salida válida", () => {
  it.each(TIPOS_DIARIOS)("%s: publica el texto armado con las presentaciones del paquete", (tipo) => {
    const paquete = paqueteFicticio(tipo);
    const resultado = validarSalida(salidaDe(paquete, ...FRASES_VALIDAS[tipo]), paquete);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    const esperadas = FRASES_VALIDAS[tipo].map((p) => renderizado(paquete, p));
    expect(resultado.resumen.frases.map((f) => f.texto)).toEqual(esperadas);
    expect(resultado.resumen.texto).toBe(esperadas.join(" "));
    expect(resultado.resumen.tipo).toBe(tipo);
    expect(resultado.resumen.aviso).toBe(AVISOS[tipo]);
    expect(resultado.resumen.texto).not.toContain(AVISOS[tipo]);
    expect(resultado.resumen.hechosHash).toBe(paquete.hash);
    expect(resultado.resumen.validadorVersion).toBe(VERSION_VALIDADOR);
  });

  it("citados y cifras usadas salen del paquete: fuente, fecha es-CO, calidad y «fuente · fecha»", () => {
    const paquete = diario();
    const resultado = validarSalida(salidaDe(paquete, ...FRASES_VALIDAS.DIARIO), paquete);
    if (!resultado.ok) throw new Error("la salida válida debía pasar");
    const { resumen } = resultado;
    const claves = ["VALOR_ACCIONES", "ESPECIE_NOMBRE", "VALOR_ESPECIE", "PESO_ESPECIE", "GANANCIA_TOTAL", "ESPECIES_ATRASADAS"] as const;
    expect(resumen.citados).toEqual(claves.map((c) => hechoDe(paquete, c).id));
    expect(resumen.frases[1]?.citados).toEqual(["ESPECIE_NOMBRE", "VALOR_ESPECIE", "PESO_ESPECIE"].map((c) => hechoDe(paquete, c as "VALOR_ESPECIE").id));
    // El nombre no es una cifra: no va en «Cifras usadas».
    const sinNombre = claves.filter((c) => c !== "ESPECIE_NOMBRE").map((c) => hechoDe(paquete, c));
    expect(resumen.cifrasUsadas).toEqual(sinNombre.map((h) => ({
      id: h.id, etiqueta: h.etiqueta, presentacion: h.presentacion, fuente: h.fuente, fecha: h.fecha,
      fechaPresentada: fechaEsCo(h.fecha), calidad: h.calidad, fuenteFecha: `${h.fuente} · ${fechaEsCo(h.fecha)}`,
    })));
    expect(resumen.fuentes).toEqual([...new Set(sinNombre.map((h) => `${h.fuente} · ${fechaEsCo(h.fecha)}`))]);
  });

  it("el resultado está congelado y es determinista", () => {
    const paquete = diario();
    const cruda = salidaDe(paquete, ...FRASES_VALIDAS.DIARIO);
    const a = validarSalida(cruda, paquete);
    expect(validarSalida(cruda, paquete)).toEqual(a);
    expect(Object.isFrozen(a)).toBe(true);
    if (!a.ok) throw new Error("debía pasar");
    expect(Object.isFrozen(a.resumen)).toBe(true);
    expect(Object.isFrozen(a.resumen.frases)).toBe(true);
    expect(Object.isFrozen(a.resumen.frases[0])).toBe(true);
    expect(Object.isFrozen(a.resumen.cifrasUsadas[0])).toBe(true);
  });
});

describe("un rechazo por cada código", () => {
  const p = diario();
  /** Cada caso, con los otros códigos que puede traer además del suyo (vacío: exactamente ese código). */
  const CASOS: readonly (readonly [CodigoValidador, () => string, readonly CodigoValidador[]])[] = [
    ["SALIDA_INVALIDA", () => "esto no es un JSON", []],
    ["LONGITUD", () => salidaDe(p, ...Array.from({ length: 7 }, () => VALOR_ACCIONES)), []],
    ["CIFRA_SUELTA", () => salidaDe(p, "El valor de las acciones subió a {VALOR_ACCIONES} en el corte 7391."), ["RENDER_CIFRA"]],
    // Las palabras de cifra, recomendación, predicción y tú están además fuera del vocabulario cerrado (IDIOMA).
    ["CIFRA_EN_PALABRAS", () => salidaDe(p, "El valor de las acciones subió a {VALOR_ACCIONES} en marzo."), ["IDIOMA"]],
    ["HECHO_DESCONOCIDO", () => salida(frase(p, VALOR_ACCIONES), { texto: "Las comisiones pagadas suman {H99}.", hechos: ["H99"] }), ["HECHO_NO_CITADO", "RENDER_CIFRA"]],
    // Un obligatorio sin citar en el DIARIO lo escribe el código (T4): aquí el rechazo es una frase sin cita.
    ["HECHO_NO_CITADO", () => salida(frase(p, VALOR_ACCIONES), { texto: "El portafolio tuvo un día tranquilo.", hechos: [] }), ["IDIOMA"]],
    ["ETIQUETA_NO_COINCIDE", () => salidaDe(p, VALOR_ACCIONES, "Las comisiones pagadas bajaron a {GANANCIA_TOTAL}."), []],
    ["DIRECCION_CONTRADICE", () => salidaDe(p, VALOR_ACCIONES, "La ganancia total subió a {GANANCIA_TOTAL}."), []],
    ["RECOMENDACION", () => salidaDe(p, "El valor de las acciones subió a {VALOR_ACCIONES}, compre."), ["IDIOMA"]],
    ["PREDICCION", () => salidaDe(p, "El valor de las acciones subirá a {VALOR_ACCIONES}."), ["IDIOMA"]],
    ["TRATO", () => salidaDe(p, "Tu valor de las acciones subió a {VALOR_ACCIONES}."), ["IDIOMA"]],
    ["IDIOMA", () => salidaDe(p, "The valor de las acciones subió a {VALOR_ACCIONES}."), []],
    ["FORMATO", () => salidaDe(p, "El valor de las acciones subió a **{VALOR_ACCIONES}**."), []],
  ];

  it("la tabla cubre todos los códigos salvo RENDER_CIFRA (que tiene su prueba con el render cambiado)", () => {
    // RANGO_CONTRADICE, PARA_REVISAR y ATRIBUCION (validador-v4) son solo de SIMULACION: los prueban `simulacion/validador-v4*.test.ts`.
    expect([...CASOS.map(([c]) => c), "RENDER_CIFRA", "RANGO_CONTRADICE", "PARA_REVISAR", "ATRIBUCION"].sort()).toEqual([...CODIGOS_VALIDADOR].sort());
  });

  it.each(CASOS)("%s", (codigo, armar, otros) => {
    const motivos = motivosDe(armar(), p);
    expect(motivos).toContain(codigo);
    expect(motivos.filter((m) => m !== codigo && !otros.includes(m))).toEqual([]);
  });

  it("la cifra suelta también la ve el cotejo del texto final", () => {
    expect(motivosDe(salidaDe(p, "El valor de las acciones subió a {VALOR_ACCIONES} en el corte 7391."), p)).toEqual(["CIFRA_SUELTA", "RENDER_CIFRA"]);
  });

  it("una salida que no es JSON corta los demás controles", () => {
    expect(validarSalida("{\"frases\":", p)).toEqual({ ok: false, motivos: ["SALIDA_INVALIDA"], hallazgos: [{ codigo: "SALIDA_INVALIDA", frase: null, patron: "SALIDA_INVALIDA.LECTURA" }] });
  });
});

describe("LONGITUD", () => {
  const p = diario();
  it("cero frases, una frase vacía, una de más de doscientos ochenta y el total de más de mil doscientos", () => {
    expect(patronesDe(JSON.stringify({ frases: [] }), p)).toContain("LONGITUD.FRASES");
    expect(patronesDe(salida(frase(p, VALOR_ACCIONES), { texto: "", hechos: [] }), p)).toContain("LONGITUD.VACIA");
    const larga = `El valor de las acciones subió a {VALOR_ACCIONES}${", según el corte del portafolio".repeat(9)}.`;
    expect(patronesDe(salidaDe(p, larga), p)).toContain("LONGITUD.FRASE");
    const media = `El valor de las acciones subió a {VALOR_ACCIONES}${", según el corte del portafolio".repeat(7)}.`;
    expect(patronesDe(salidaDe(p, media, media, media, media, media), p)).toContain("LONGITUD.TOTAL");
  });

  it("se mide sobre el texto renderizado, en puntos de código", () => {
    const paquete = diario();
    const base = "El valor de las acciones subió a {VALOR_ACCIONES}, ";
    const conRelleno = (n: number): string => `${base}${"x".repeat(n)}.`;
    const largoRenderizado = (n: number): number => [...renderizado(paquete, conRelleno(n))].length;
    const justo = 280 - largoRenderizado(0);
    expect(largoRenderizado(justo)).toBe(280);
    // La cita (cinco caracteres) no es lo que se mide: se mide con la presentación puesta.
    expect(largoRenderizado(0)).not.toBe([...conRelleno(0)].length);
    expect(patronesDe(salidaDe(paquete, conRelleno(justo)), paquete)).not.toContain("LONGITUD.FRASE");
    expect(patronesDe(salidaDe(paquete, conRelleno(justo + 1)), paquete)).toContain("LONGITUD.FRASE");
  });
});

describe("todos los códigos, en orden y sin repetir", () => {
  it("una frase con varios problemas da todos sus códigos en el orden canónico", () => {
    const p = diario();
    const motivos = motivosDe(salidaDe(p, "Tu ganancia total subirá a {VALOR_ACCIONES} en marzo, compre."), p);
    expect(motivos).toEqual(["CIFRA_EN_PALABRAS", "ETIQUETA_NO_COINCIDE", "RECOMENDACION", "PREDICCION", "TRATO", "IDIOMA"]);
    const orden = motivos.map((m) => CODIGOS_VALIDADOR.indexOf(m));
    expect(orden).toEqual([...orden].sort((a, b) => a - b));
  });

  it("los hallazgos llevan el código, la frase y el id del control: sin texto del modelo ni dígitos", () => {
    const p = diario();
    const resultado = validarSalida(salidaDe(p, VALOR_ACCIONES, "La ganancia total subió a {GANANCIA_TOTAL}, compre."), p);
    if (resultado.ok) throw new Error("debía rechazar");
    for (const h of resultado.hallazgos) {
      expect(Object.keys(h).sort()).toEqual(["codigo", "frase", "patron"]);
      expect(h.patron).toMatch(/^[A-Z_]+\.[A-Z_]+$/);
      expect(CODIGOS_VALIDADOR).toContain(h.codigo);
    }
    expect(resultado.hallazgos).toContainEqual({ codigo: "RECOMENDACION", frase: 1, patron: "RECOMENDACION.COMPRA" });
    expect(resultado.hallazgos).toContainEqual({ codigo: "DIRECCION_CONTRADICE", frase: 1, patron: "DIRECCION.SUBE_VERBO" });
    expect(JSON.stringify(resultado.hallazgos.map((h) => [h.codigo, h.patron]))).not.toMatch(/\p{N}/u);
    expect(JSON.stringify(resultado)).not.toContain("compre");
    expect(Object.isFrozen(resultado.motivos)).toBe(true);
    expect(Object.isFrozen(resultado.hallazgos)).toBe(true);
  });
});

describe("el paquete", () => {
  it("un paquete que no salió de construirPaquete es un defecto del código: ErrorValidador, sin datos", () => {
    const p = diario();
    const copia = { ...p } as PaqueteHechos;
    expect(() => validarSalida(salidaDe(p, VALOR_ACCIONES), copia)).toThrow(ErrorValidador);
    const error = ((): unknown => {
      try {
        validarSalida("{}", copia);
      } catch (e) {
        return e;
      }
      return null;
    })();
    expect(error).toBeInstanceOf(ErrorValidador);
    expect((error as ErrorValidador).codigo).toBe("PAQUETE_NO_CONSTRUIDO");
    expect((error as Error).message).not.toMatch(/\p{N}/u);
  });

  it("la salida cruda que no es texto es SALIDA_INVALIDA, no una excepción", () => {
    const p = diario();
    for (const cruda of [undefined, null, 4613, {}, [], new Proxy({}, { get: () => { throw new Error("trampa"); } })]) {
      expect(motivosDe(cruda, p)).toEqual(["SALIDA_INVALIDA"]);
    }
  });
});
