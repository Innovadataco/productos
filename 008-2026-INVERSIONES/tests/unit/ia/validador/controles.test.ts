/**
 * Los controles por frase, vistos desde `validarSalida` (por el id del control en los hallazgos): la lista blanca de
 * caracteres (cifras de cualquier sistema, símbolos, letras de otro alfabeto, invisibles), la forma de la frase, las
 * citas y sus hechos, el sujeto, y las marcas (dirección, cercanía y «hoy») atribuidas a la cita más cercana.
 */
import { describe, expect, it } from "vitest";
import type { PaqueteHechos } from "@/ia/contrato";
import { validarSalida } from "@/ia/validador/validar";
import { crearPrng } from "@/proyecciones/prng";
import { paqueteAlAzar } from "../apoyo/aleatorio.ficticio";
import { FRASES_VALIDAS, frase, hechoDe, paqueteFicticio, salida, salidaDe } from "./apoyo/salidas.ficticio";

const VA = FRASES_VALIDAS.DIARIO[0] as string;

function hallazgos(paquete: PaqueteHechos, ...plantillas: string[]): readonly string[] {
  const r = validarSalida(salidaDe(paquete, ...plantillas), paquete);
  return r.ok ? [] : r.hallazgos.map((h) => h.patron);
}

describe("lista blanca de caracteres", () => {
  const p = paqueteFicticio("DIARIO");
  const con = (insertado: string): readonly string[] => hallazgos(p, `El valor de las acciones subió a {VALOR_ACCIONES} ${insertado}.`);

  it.each([["dígitos ASCII", "4613"], ["arábigo índico", "٣"], ["ancho completo", "４"], ["superíndice", "²"], ["fracción", "½"], ["romano", "Ⅳ"], ["en círculo", "③"], ["devanagari", "७"]])(
    "%s: CIFRA_SUELTA", (_caso, cifra) => {
      expect(con(cifra)).toContain("CIFRA_SUELTA.DIGITO");
    },
  );

  it.each([["pesos", "$"], ["porcentaje", "%"], ["euro", "€"], ["por mil", "‰"]])("%s: CIFRA_SUELTA (símbolo de cifra)", (_caso, simbolo) => {
    expect(con(`en ${simbolo}`)).toContain("CIFRA_SUELTA.SIMBOLO");
  });

  it.each([["cirílico", "c\u043Empre"], ["ligadura", "\uFB01n"], ["ancho completo", "\uFF21"], ["matemático", "𝐀"], ["relleno hangul", "\u3164"], ["griego", "α"]])(
    "%s: IDIOMA (letra fuera del alfabeto español)", (_caso, texto) => {
      expect(con(texto)).toContain("IDIOMA.LETRA");
    },
  );

  it.each([["guion bajo", "VALOR_ACCIONES".toLowerCase()], ["blanco braille", String.fromCharCode(10240)], ["selector de variante", "\uFE0F"], ["etiqueta", "\u{E0041}"],
    ["espacio duro", "\u00A0"], ["espacio fino", "\u202F"], ["ancho cero", "\u200B"], ["salto de línea", "\n"], ["tabulador", "\t"], ["asterisco", "*"],
    ["etiqueta HTML", "<b>"], ["barra", "/"], ["comillas", '"'], ["guion", "-"], ["emoji", "📈"], ["interrogación", "?"]])(
    "%s: FORMATO", (_caso, texto) => {
      expect(con(texto)).toContain("FORMATO.CARACTER");
    },
  );

  it("un patrón escondido con un invisible se detecta igual (y el invisible es FORMATO)", () => {
    expect(hallazgos(p, "El valor de las acciones subió a {VALOR_ACCIONES}, com\u200Bpre.")).toEqual(expect.arrayContaining(["FORMATO.CARACTER", "RECOMENDACION.COMPRE"]));
  });

  it("el texto que no está en NFC es FORMATO, y se analiza ya normalizado", () => {
    const nfd = "El valor de las acciones subio\u0301 a {VALOR_ACCIONES}.";
    expect(hallazgos(p, nfd)).toEqual(["FORMATO.NO_NFC"]);
    expect(hallazgos(p, "La ganancia total subio\u0301 a {GANANCIA_TOTAL}.", VA)).toContain("DIRECCION.SUBE_VERBO");
  });
});

describe("forma de la frase", () => {
  const p = paqueteFicticio("DIARIO");

  it.each([
    ["signo pegado a la cita", "El valor de las acciones subió a -{VALOR_ACCIONES}."],
    ["dos citas pegadas", "Las especies con cierre atrasado son {ESPECIES_ATRASADAS}{ESPECIES_ATRASADAS}."],
    ["coma pegada entre citas", "Las especies con cierre atrasado son {ESPECIES_ATRASADAS},{ESPECIES_ATRASADAS}."],
    ["letra pegada a la cita", "El valor de las acciones subió a{VALOR_ACCIONES}."],
    ["letra después de la cita", "El valor de las acciones subió a {VALOR_ACCIONES}x."],
  ])("%s: FORMATO.CITA_PEGADA", (_caso, plantilla) => {
    expect(hallazgos(p, VA, plantilla)).toContain("FORMATO.CITA_PEGADA");
  });

  it("dos citas separadas por « y » o por «, » no son pegadas", () => {
    expect(hallazgos(p, VA, "Las especies con cierre atrasado son {ESPECIES_ATRASADAS}, en el corte de hoy.")).not.toContain("FORMATO.CITA_PEGADA");
  });

  it.each([
    ["llave suelta", "El valor de las acciones subió a {VALOR_ACCIONES} {.", "FORMATO.LLAVE_SUELTA"],
    ["cita mal formada", "El valor de las acciones subió a {VALOR_ACCIONES} y {Hx}.", "FORMATO.LLAVE_SUELTA"],
    ["sin punto final", "El valor de las acciones subió a {VALOR_ACCIONES}", "FORMATO.PUNTO_FINAL"],
    ["dos oraciones", "El valor de las acciones subió. Es {VALOR_ACCIONES}.", "FORMATO.PUNTO_INTERNO"],
    ["una dirección web", "El valor de las acciones subió a {VALOR_ACCIONES} en www.ejemplo.com.", "FORMATO.PUNTO_INTERNO"],
    ["espacios dobles", "El valor de las acciones  subió a {VALOR_ACCIONES}.", "FORMATO.ESPACIOS"],
    ["espacio al inicio", " El valor de las acciones subió a {VALOR_ACCIONES}.", "FORMATO.ESPACIOS"],
    ["mayúscula en medio", "El valor de las acciones SUBE a {VALOR_ACCIONES}.", "FORMATO.MAYUSCULA_INTERNA"],
    ["nombre propio en medio", "El valor de las acciones subió en Bogotá a {VALOR_ACCIONES}.", "FORMATO.MAYUSCULA_INTERNA"],
    ["palabra larguísima", `El valor de las acciones subió a {VALOR_ACCIONES} ${"desvalorizacion".repeat(3)}.`, "FORMATO.PALABRA_LARGA"],
  ])("%s", (_caso, plantilla, patron) => {
    expect(hallazgos(p, plantilla)).toContain(patron);
  });

  it("las siglas del catálogo sí van en mayúscula en medio de la frase", () => {
    const r = hallazgos(p, "El valor de las acciones subió a {VALOR_ACCIONES}, sin la TRM ni el IPC.");
    expect(r).not.toContain("FORMATO.MAYUSCULA_INTERNA");
  });

  it("la lista de hechos tiene que ser el conjunto de las citas, sin repetir", () => {
    const va = hechoDe(p, "VALOR_ACCIONES").id;
    const gt = hechoDe(p, "GANANCIA_TOTAL").id;
    const base = frase(p, VA);
    const conGanancia = frase(p, "La ganancia total bajó a {GANANCIA_TOTAL}.");
    const patrones = (cruda: string): readonly string[] => {
      const r = validarSalida(cruda, p);
      return r.ok ? [] : r.hallazgos.map((h) => h.patron);
    };
    expect(patrones(salida(base, { ...conGanancia, hechos: [] }))).toContain("FORMATO.LISTA_HECHOS");
    expect(patrones(salida(base, { ...conGanancia, hechos: [gt, va] }))).toContain("FORMATO.LISTA_HECHOS");
    expect(patrones(salida(base, { ...conGanancia, hechos: [gt, gt] }))).toContain("FORMATO.LISTA_HECHOS");
    expect(validarSalida(salida(base, conGanancia), p).ok).toBe(true);
  });

  it("la misma palabra dos veces seguidas en el texto renderizado (la unidad repetida) es FORMATO", () => {
    const reglas = paqueteFicticio("REGLAS");
    const ultima = hechoDe(reglas, "REGLA_DIAS_AL_PLAZO").presentacion.split(" ").at(-1) ?? "";
    expect(ultima).toMatch(/^\p{L}+$/u);
    const r = hallazgos(reglas, FRASES_VALIDAS.REGLAS[0] as string, `Faltan {REGLA_DIAS_AL_PLAZO} ${ultima} para el plazo de la regla.`);
    expect(r).toContain("FORMATO.PALABRA_REPETIDA");
  });
});

describe("citas y hechos", () => {
  const p = paqueteFicticio("DIARIO");

  it("una cita a un id que no está en el paquete, o un id de la lista que no está, es HECHO_DESCONOCIDO", () => {
    const enTexto = validarSalida(salida(frase(p, VA), { texto: "La ganancia total bajó a {H99}.", hechos: ["H99"] }), p);
    expect(enTexto.ok ? [] : enTexto.hallazgos.map((h) => h.patron)).toContain("HECHO_DESCONOCIDO.CITA");
    const cero = validarSalida(salida(frase(p, VA), { texto: "La ganancia total bajó a {H00}.", hechos: ["H00"] }), p);
    expect(cero.ok ? [] : cero.motivos).toContain("HECHO_DESCONOCIDO");
    const enLista = validarSalida(salida({ ...frase(p, VA), hechos: [hechoDe(p, "VALOR_ACCIONES").id, "VALOR"] }), p);
    expect(enLista.ok ? [] : enLista.hallazgos.map((h) => h.patron)).toContain("HECHO_DESCONOCIDO.LISTA");
  });

  it("un obligatorio sin citar y una frase sin ninguna cita son HECHO_NO_CITADO", () => {
    expect(hallazgos(p, "La ganancia total bajó a {GANANCIA_TOTAL}.")).toContain("HECHO_NO_CITADO.OBLIGATORIO");
    expect(hallazgos(p, VA, "El portafolio tuvo un día tranquilo.")).toContain("HECHO_NO_CITADO.FRASE_SIN_CITA");
  });

  it("un hecho de especie sin el nombre de su especie en la frase es ETIQUETA_NO_COINCIDE", () => {
    expect(hallazgos(p, VA, "El valor de la especie subió a {VALOR_ESPECIE}.")).toContain("ETIQUETA.SIN_SUJETO");
  });

  it("un nombre de especie junto a un hecho del portafolio es ETIQUETA_NO_COINCIDE", () => {
    expect(hallazgos(p, "El valor de las acciones de {ESPECIE_NOMBRE} subió a {VALOR_ACCIONES}.")).toContain("ETIQUETA.SUJETO_AJENO");
  });

  it("el nombre de OTRA especie junto a un hecho de especie es ETIQUETA_NO_COINCIDE", () => {
    const prng = crearPrng(4_613);
    for (let i = 0; i < 397; i += 1) {
      const paquete = paqueteAlAzar(prng, "DIARIO");
      const nombres = paquete.hechos.filter((h) => h.unidad === "NOMBRE");
      const deEspecie = paquete.hechos.find((h) => h.clave === "VALOR_ESPECIE" && h.sujeto !== undefined);
      const otro = nombres.find((n) => n.id !== deEspecie?.sujeto);
      if (deEspecie === undefined || otro === undefined) continue;
      const cruda = salida({ texto: `{${otro.id}}: el valor de la especie es {${deEspecie.id}}.`, hechos: [otro.id, deEspecie.id] });
      const r = validarSalida(cruda, paquete);
      expect(r.ok ? [] : r.hallazgos.map((h) => h.patron)).toEqual(expect.arrayContaining(["ETIQUETA.SUJETO_AJENO", "ETIQUETA.SIN_SUJETO"]));
      return;
    }
    throw new Error("ninguna semilla dio dos especies con un valor de especie");
  });
});

describe("marcas: dirección, cercanía y «hoy»", () => {
  const p = paqueteFicticio("DIARIO");

  it("cada palabra va a la cita más cercana de su cláusula", () => {
    expect(validarSalida(salidaDe(p, "El valor de las acciones subió a {VALOR_ACCIONES}, la ganancia total bajó a {GANANCIA_TOTAL}."), p).ok).toBe(true);
    expect(validarSalida(salidaDe(p, "El valor de las acciones {VALOR_ACCIONES} subió por la ganancia total {GANANCIA_TOTAL}."), p).ok).toBe(true);
    expect(validarSalida(salidaDe(p, VA, "La ganancia total, {GANANCIA_TOTAL}, bajó."), p).ok).toBe(true);
  });

  it("una palabra de dirección para un hecho sin dirección contradice", () => {
    expect(hallazgos(p, VA, "Las especies con cierre atrasado subieron a {ESPECIES_ATRASADAS}.")).toContain("DIRECCION.SUBE_VERBO");
  });

  it("una palabra de dirección sin ningún hecho al que atribuirla contradice", () => {
    expect(hallazgos(p, VA, "{ESPECIE_NOMBRE} subió.")).toContain("DIRECCION.SIN_HECHO");
  });

  it("igual contra un hecho que se mantuvo no contradice; contra uno que sube, sí", () => {
    expect(validarSalida(salidaDe(p, VA, "{ESPECIE_NOMBRE}: el peso de la especie en el portafolio se mantuvo en {PESO_ESPECIE}."), p).ok).toBe(true);
    expect(hallazgos(p, "El valor de las acciones se mantuvo en {VALOR_ACCIONES}.")).toContain("DIRECCION.IGUAL");
  });

  it("cerca y lejos contra la cercanía del hecho", () => {
    const reglas = paqueteFicticio("REGLAS");
    expect(validarSalida(salidaDe(reglas, ...FRASES_VALIDAS.REGLAS), reglas).ok).toBe(true);
    expect(hallazgos(reglas, "{ESPECIE_NOMBRE}: la distancia al nivel de la regla es {REGLA_DISTANCIA} y está lejos.")).toContain("CERCANIA.LEJOS");
    expect(hallazgos(reglas, FRASES_VALIDAS.REGLAS[0] as string, "Faltan {REGLA_DIAS_AL_PLAZO} para el plazo de la regla, que está cerca.")).toContain("CERCANIA.CERCA");
  });

  it("«hoy» solo con un hecho de frescura HOY", () => {
    expect(validarSalida(salidaDe(p, VA, "{ESPECIE_NOMBRE}: hoy el peso de la especie en el portafolio se mantuvo en {PESO_ESPECIE}."), p).ok).toBe(true);
    expect(hallazgos(p, "Hoy el valor de las acciones subió a {VALOR_ACCIONES}.")).toContain("FRESCURA.HOY");
    const deHoy = paqueteFicticio("DIARIO", { VALOR_ACCIONES: { frescura: "HOY" } });
    expect(validarSalida(salidaDe(deHoy, "Hoy el valor de las acciones subió a {VALOR_ACCIONES}."), deHoy).ok).toBe(true);
  });

  it("la dirección cambiada en el paquete cambia el veredicto (la marca sale del paquete, no del texto)", () => {
    const baja = paqueteFicticio("DIARIO", { VALOR_ACCIONES: { direccion: "BAJA" } });
    expect(hallazgos(baja, VA)).toContain("DIRECCION.SUBE_VERBO");
    expect(validarSalida(salidaDe(baja, "El valor de las acciones bajó a {VALOR_ACCIONES}."), baja).ok).toBe(true);
  });
});
