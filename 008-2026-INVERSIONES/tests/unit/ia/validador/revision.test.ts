/**
 * Hallazgos de la revisión (code-reviewer, security-reviewer y silent-failure-hunter): cada caso lo publicaba el
 * validador y ahora se rechaza con su código. Los casos están probados contra el paquete DIARIO ficticio (el valor de
 * las acciones SUBE; la ganancia total BAJA; el peso de la especie se mantiene IGUAL).
 */
import { describe, expect, it } from "vitest";
import type { CodigoValidador } from "@/ia/validador/codigos";
import { validarSalida } from "@/ia/validador/validar";
import { FRASES_VALIDAS, paqueteFicticio, salidaDe } from "./apoyo/salidas.ficticio";

const p = paqueteFicticio("DIARIO");
const VA = FRASES_VALIDAS.DIARIO[0] as string;
const conCola = (cola: string): string => `El valor de las acciones subió a {VALOR_ACCIONES}, ${cola}.`;

function rechazo(...plantillas: string[]): { readonly motivos: readonly CodigoValidador[]; readonly patrones: readonly string[] } {
  const r = validarSalida(salidaDe(p, ...plantillas), p);
  return r.ok ? { motivos: [], patrones: [] } : { motivos: r.motivos, patrones: r.hallazgos.map((h) => h.patron) };
}

describe("dirección: negación, sinónimos y comparativos", () => {
  it.each([
    ["negar una subida que sí ocurrió", "El valor de las acciones no subió a {VALOR_ACCIONES}."],
    ["negar una bajada que sí ocurrió", "La ganancia total no bajó, es {GANANCIA_TOTAL}."],
    ["sin subir", "El valor de las acciones, sin subir, es {VALOR_ACCIONES}."],
    ["dejó de subir", "El valor de las acciones dejó de subir en {VALOR_ACCIONES}."],
    ["nunca bajó", "La ganancia total nunca bajó de {GANANCIA_TOTAL}."],
    ["se disparó contra una bajada", "La ganancia total se disparó a {GANANCIA_TOTAL}."],
    ["ascendió contra una bajada", "La ganancia total ascendió a {GANANCIA_TOTAL}."],
    ["escaló contra una bajada", "La ganancia total escaló a {GANANCIA_TOTAL}."],
    ["se fortaleció contra una bajada", "La ganancia total se fortaleció hasta {GANANCIA_TOTAL}."],
    ["se desplomó contra una subida", "El valor de las acciones se desplomó a {VALOR_ACCIONES}."],
    ["se hundió contra una subida", "El valor de las acciones se hundió a {VALOR_ACCIONES}."],
    ["cedió contra una subida", "El valor de las acciones cedió a {VALOR_ACCIONES}."],
    ["es la misma contra una subida", "El valor de las acciones es la misma, {VALOR_ACCIONES}."],
    ["un comparativo sin dato", "El valor de las acciones es mayor que antes, {VALOR_ACCIONES}."],
    ["por encima sin dato", "El valor de las acciones quedó por encima, en {VALOR_ACCIONES}."],
    ["mejora contra una bajada (re-revisión)", "La ganancia total mejora, es {GANANCIA_TOTAL}."],
    ["mantuvo sin «se» contra una bajada (re-revisión)", "La ganancia total mantuvo {GANANCIA_TOTAL}."],
    ["sigue en contra una bajada (re-revisión)", "La ganancia total sigue en {GANANCIA_TOTAL}."],
    ["empeora contra una subida (re-revisión)", "El valor de las acciones empeora a {VALOR_ACCIONES}."],
    ["no se ha subido (dos palabras en medio)", "El valor de las acciones no se ha subido a {VALOR_ACCIONES}."],
    ["no llegó a subir", "El valor de las acciones no llegó a subir de {VALOR_ACCIONES}."],
    ["se estancó contra una subida", "El valor de las acciones se estancó en {VALOR_ACCIONES}."],
  ])("%s: DIRECCION_CONTRADICE", (_caso, plantilla) => {
    expect(rechazo(plantilla).motivos).toContain("DIRECCION_CONTRADICE");
  });

  it("la negación de un movimiento tiene su propio id; «no cambió» sigue siendo estabilidad", () => {
    expect(rechazo("El valor de las acciones no subió a {VALOR_ACCIONES}.").patrones).toContain("DIRECCION.NEGADA");
    const igual = "{ESPECIE_NOMBRE}: el peso de la especie en el portafolio no cambió, quedó en {PESO_ESPECIE}.";
    expect(rechazo(VA, igual).motivos).toEqual([]);
  });

  it("«igual de» ya no es una marca de estabilidad (falso positivo)", () => {
    expect(rechazo(conCola("igual de alto")).motivos).toEqual([]);
  });
});

describe("recomendación en otras formas e idiomas", () => {
  it.each([
    "buy", "sell now", "hold", "adquiera más", "adquirir más", "mantener", "es prudente mantenerlo", "desinvierta", "añada",
    "agregue", "deshágase", "es para venderla", "compraría", "cómprelo", "no compres", "vende", "siga sin vender", "salir",
    "vale la pena", "es atractivo", "es ideal", "la mejor opción", "lo mejor es esperar", "ahora o nunca", "es urgente",
    "es excelente", "muy sólido", "retenga", "aprovecha", "acheter", "comprare", "vendere",
  ])("«%s»: RECOMENDACION", (cola) => {
    expect(rechazo(conCola(cola)).motivos).toContain("RECOMENDACION");
  });

  it("«ganancia sin vender» y «ganancia por ventas» (etiquetas del catálogo) siguen pasando", () => {
    expect(rechazo(VA, "La ganancia total bajó a {GANANCIA_TOTAL}, sin contar la ganancia sin vender.").motivos).not.toContain("RECOMENDACION");
  });
});

describe("predicción: otras personas del futuro, puntuación entre palabras y tendencia", () => {
  it.each([
    "venderemos", "compraremos", "subiré", "verás", "veremos", "ganara", "perdera", "cerrara", "apunta a subir",
    "seguro, que sube", "va, a subir", "se, espera algo", "se (espera) algo", "tiende a bajar",
  ])("«%s»: PREDICCION", (cola) => {
    expect(rechazo(conCola(cola)).motivos).toContain("PREDICCION");
  });
});

describe("trato de tú en imperativo", () => {
  it.each(["revisa", "mira", "considera", "recuerda", "cuídate", "piensa"])("«%s»: TRATO", (cola) => {
    expect(rechazo(conCola(cola)).motivos).toContain("TRATO");
  });

  it("al inicio de la frase, con mayúscula", () => {
    expect(rechazo("Revisa el valor de las acciones, que subió a {VALOR_ACCIONES}.").motivos).toContain("TRATO");
  });
});

describe("cifras en palabras fundidas, romanas y «uno»", () => {
  it.each(["dosmil", "unmillon", "treintaycinco", "milesima", "trillones", "xii veces", "uno más", "una vez", "centésimo"])(
    "«%s»: CIFRA_EN_PALABRAS", (cola) => {
      expect(rechazo(conCola(cola)).motivos).toContain("CIFRA_EN_PALABRAS");
    },
  );

  it("las fundidas y las romanas tienen su id", () => {
    expect(rechazo(conCola("dosmil")).patrones).toContain("CIFRA_EN_PALABRAS.FUNDIDA");
    expect(rechazo(conCola("xii veces")).patrones).toContain("CIFRA_EN_PALABRAS.ROMANO");
  });

  it("palabras comunes que no son cifras pasan (control positivo)", () => {
    for (const cola of ["con todos los cortes", "según la familia de datos", "con similar ciencia", "en un día civil"]) {
      expect([cola, rechazo(conCola(cola)).motivos.filter((m) => m === "CIFRA_EN_PALABRAS")]).toEqual([cola, []]);
    }
  });
});

describe("frases y caracteres", () => {
  it("una frase que solo cita el nombre de una especie no cita ningún dato: HECHO_NO_CITADO", () => {
    expect(rechazo(VA, "{ESPECIE_NOMBRE} es una empresa.").patrones).toContain("HECHO_NO_CITADO.FRASE_SIN_CITA");
  });

  it.each([["ancho completo", "％"], ["árabe", "٪"], ["comercial", "⁒"]])("porcentaje %s: CIFRA_SUELTA.SIMBOLO", (_caso, simbolo) => {
    expect(rechazo(conCola(`en ${simbolo}`)).patrones).toContain("CIFRA_SUELTA.SIMBOLO");
  });

  it("una mayúscula después de una cita no es inicio de frase", () => {
    expect(rechazo(VA, "{ESPECIE_NOMBRE}: Valor de la especie subió a {VALOR_ESPECIE}.").patrones).toContain("FORMATO.MAYUSCULA_INTERNA");
  });
});

/**
 * Re-revisión de seguridad: con listas negras, cada ronda encuentra sinónimos nuevos. El vocabulario cerrado
 * (IDIOMA.VOCABULARIO) rechaza toda palabra que no sea de las etiquetas del catálogo, de las marcas cotejadas o de una
 * lista corta de palabras funcionales y verbos neutros: así se cierra la clase entera.
 */
describe("vocabulario cerrado (re-revisión de seguridad)", () => {
  it.each([
    "tome posición", "abra posición", "cierre su posición", "hágase con ella", "desprendase de ella", "entre ya", "entrar", "ingrese",
    "posiciónese", "sume", "recoja utilidades", "realice ganancias", "no se la pierda", "manténgase", "guárdela", "aguante", "apueste",
    "prefiera", "elija", "cúbrase", "protéjase", "tenga presente", "recuerde", "evite", "observe", "favorable", "rentable", "firme", "fuerte",
    "segura", "sensato", "según expertos", "yo creo", "pienso que sube",
    "se perfila", "se encamina", "rumbo a", "camino a", "promete", "augura", "anticipa", "descuenta", "proyecta", "estima", "apunta",
    "luce bien", "pinta bien", "puede subir", "podría bajar", "es probable", "riesgo de caer", "peligro",
    "trepó", "rebotó", "se elevó", "se apreció", "se encareció", "se revalorizó", "ganando terreno", "en ascenso", "escalada",
    "en recuperación", "cuadrillón", "septuagésimo", "nonagésimo", "millonésima", "tressientos", "dies", "onze", "kuatro", "twelve",
    "eleven", "three", "ten", "evita", "toma", "haz", "vete", "dime", "ve", "ven", "oye", "escucha", "pon", "sal", "tengas", "inviertas",
    "puedas", "debas", "quieras", "necesitas",
  ])("«%s»: IDIOMA.VOCABULARIO", (cola) => {
    expect(rechazo(conCola(cola)).patrones).toContain("IDIOMA.VOCABULARIO");
  });

  it("«fue a más» (todas sus palabras son comunes) es un comparativo sin dato", () => {
    expect(rechazo("La ganancia total fue a más, {GANANCIA_TOTAL}.").patrones).toContain("DIRECCION.COMPARATIVO");
  });

  it("los numerales compuestos con «i» son cifras fundidas", () => {
    for (const cola of ["treintaiuno", "cuarentaicinco", "ochentaicinco"]) expect(rechazo(conCola(cola)).patrones).toContain("CIFRA_EN_PALABRAS.FUNDIDA");
  });

  it("control positivo: las frases válidas de los tres tipos usan solo el vocabulario", () => {
    expect(rechazo(...FRASES_VALIDAS.DIARIO).patrones).toEqual([]);
  });
});
