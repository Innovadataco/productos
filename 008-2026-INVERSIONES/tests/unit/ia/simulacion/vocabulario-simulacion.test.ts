/**
 * El vocabulario de SIMULACION es una LISTA PERMITIDA EXPLÍCITA (`PALABRAS_SIMULACION`), escrita palabra por palabra: lo mínimo
 * para describir el estado del «después» en tercera persona, más las palabras de las etiquetas de SIMULACION y las de los
 * rangos. No hereda PALABRAS_BASE (que funcionaba como lista negra: cada palabra con sentido de acción abría una evasión).
 * Sin negaciones, sin continuidad ni tiempo, sin conectores causales, temporales o condicionales, sin agente y sin verbos de
 * acción o de registro. La lista queda fijada con una huella: ampliarla es otra versión del validador.
 * Los tres tipos de hoy no cambian: siguen con PALABRAS_BASE.
 */
import { describe, expect, it } from "vitest";
import { ETIQUETA_RANGO } from "@/analisis/puntos/etiquetas";
import { CATALOGO } from "@/ia/catalogo";
import { TIPOS_DIARIOS } from "@/ia/contrato";
import { sha256Hex } from "@/ia/hash";
import { plegarTildes } from "@/ia/validador/patron";
import { PALABRAS_BASE, PALABRAS_SIMULACION, palabrasFueraDelVocabulario, vocabularioDe } from "@/ia/validador/vocabulario";

const LISTA = ["el", "la", "los", "las", "de", "del", "en", "y", "su", "sus", "queda", "quedan", "es", "son", "esta", "estan"];
/** La huella de la lista: si cambia, es otra versión del validador (se sube `VERSION_VALIDADOR` y se escribe la nueva). */
const HUELLA = "ecc3ff735bc8ede75b4085ab7520008ba746b2a62483ff65e6611ad99237caa5";

const NEGACIONES = ["no", "ni", "nunca", "sin", "tampoco", "jamas"];
const TIEMPO_Y_CONTINUIDAD = ["todavia", "aun", "tambien", "ya", "antes", "ahora", "sigue", "siguen", "luego", "despues", "siempre"];
const CONECTORES = ["si", "cuando", "tras", "al", "mientras", "aunque", "porque", "pues", "para", "con", "segun", "ante", "como", "donde", "pero", "sino"];
const AGENTE = ["usted", "ustedes", "se", "le", "les", "lo"];
const RAICES_DE_ACCION_O_REGISTRO = /^(?:des|re)?(?:registr|falt|sum|cerr|cierr|pag|recib|tien|tuv|compr|vend|aport|liquid|invert|retir|aument|reduc)/u;

const palabrasDe = (t: string): readonly string[] => (t.toLowerCase().match(/\p{L}+/gu) ?? []).map(plegarTildes);
const ETIQUETAS = Object.values(CATALOGO.SIMULACION).map((e) => e.etiqueta);
const PALABRAS_DE_RANGO = Object.values(ETIQUETA_RANGO).flatMap((p) => Object.values(p) as string[]).flatMap(palabrasDe);

describe("PALABRAS_SIMULACION", () => {
  it("es exactamente esta lista, escrita palabra por palabra, congelada y con su huella", () => {
    expect([...PALABRAS_SIMULACION]).toEqual(LISTA);
    expect(Object.isFrozen(PALABRAS_SIMULACION)).toBe(true);
    expect(sha256Hex(JSON.stringify(PALABRAS_SIMULACION))).toBe(HUELLA);
  });

  it.each([
    ["negaciones", NEGACIONES], ["tiempo y continuidad", TIEMPO_Y_CONTINUIDAD], ["conectores", CONECTORES], ["agente", AGENTE],
  ])("no trae ninguna de las %s", (_grupo, palabras) => {
    for (const palabra of palabras) expect(PALABRAS_SIMULACION, palabra).not.toContain(palabra);
  });

  it("ninguna palabra suya tiene raíz de acción ni de registro (sume, registr, falt…)", () => {
    expect(PALABRAS_SIMULACION.filter((p) => RAICES_DE_ACCION_O_REGISTRO.test(p))).toEqual([]);
  });

  it("control positivo: el detector ve registro, falta, suma, cierra, paga y compra", () => {
    for (const planta of ["registro", "registra", "falta", "faltan", "suma", "cierra", "paga", "compra"]) expect(RAICES_DE_ACCION_O_REGISTRO.test(planta), planta).toBe(true);
  });

  it("no hereda PALABRAS_BASE: ninguna de sus palabras de acción, agente, negación, tiempo o conector entra al vocabulario", () => {
    const vocabulario = vocabularioDe("SIMULACION");
    const candidatas = ["usted", "se", "le", "tiene", "suma", "cierra", "paga", "registra", "falta", "todavia", "tambien", "mientras", "cuando", "tras", "con", "segun", "ante", "no", "sin", "ya", "aun"];
    const enBase = candidatas.filter((p) => PALABRAS_BASE.includes(p));
    expect(enBase.length).toBeGreaterThan(15);
    for (const palabra of enBase) expect(vocabulario.has(palabra), palabra).toBe(false);
  });
});

describe("vocabulario de SIMULACION", () => {
  it("es la lista, las palabras de sus etiquetas (con su plural y género) y las de los rangos; nada más", () => {
    const vocabulario = vocabularioDe("SIMULACION");
    for (const palabra of PALABRAS_SIMULACION) expect(vocabulario.has(palabra), palabra).toBe(true);
    for (const palabra of ETIQUETAS.flatMap(palabrasDe)) expect(vocabulario.has(palabra), palabra).toBe(true);
    for (const palabra of PALABRAS_DE_RANGO) expect(vocabulario.has(palabra), palabra).toBe(true);
  });

  it("las palabras de conector, de negación o de agente que entran son solo las que traen las etiquetas (al, por, lo)", () => {
    const vocabulario = vocabularioDe("SIMULACION");
    const prohibidas = [...NEGACIONES, ...TIEMPO_Y_CONTINUIDAD, ...CONECTORES, ...AGENTE];
    const dentro = prohibidas.filter((p) => vocabulario.has(p)).sort();
    const deEtiquetasYRangos = new Set([...ETIQUETAS.flatMap(palabrasDe), ...PALABRAS_DE_RANGO]);
    for (const palabra of dentro) expect(deEtiquetasYRangos.has(palabra), palabra).toBe(true);
    expect(dentro).toEqual(["al", "como", "lo", "por"].filter((p) => dentro.includes(p)));
  });

  it("cada etiqueta de SIMULACION y cada palabra de rango del paso 1 caben", () => {
    for (const etiqueta of ETIQUETAS) expect(palabrasFueraDelVocabulario(etiqueta, "SIMULACION"), etiqueta).toEqual([]);
    for (const palabra of PALABRAS_DE_RANGO) expect(palabrasFueraDelVocabulario(palabra, "SIMULACION"), palabra).toEqual([]);
  });

  it("una frase descriptiva legítima del «después» cabe", () => {
    expect(palabrasFueraDelVocabulario("El peso de la especie queda en muy elevado y la concentración del portafolio queda moderada.", "SIMULACION")).toEqual([]);
  });

  it.each([
    "Sin la especie", "Cuando falta la especie", "Tras el registro", "Con el registro de la especie", "no es muy elevado", "no queda en",
    "queda todavía en", "queda aún en", "Si usted cierra", "Usted paga", "Con el cierre de", "comprar", "incorporar", "aporte", "acciones", "venda",
  ])("«%s» tiene al menos una palabra de fuera", (frase) => {
    expect(palabrasFueraDelVocabulario(frase, "SIMULACION").length, frase).toBeGreaterThan(0);
  });

  it("los tres tipos de hoy no cambian: «usted», «cierra» y «tiene» siguen permitidas", () => {
    for (const tipo of TIPOS_DIARIOS) for (const palabra of ["usted", "cierra", "tiene", "suma", "todavia"]) expect(vocabularioDe(tipo).has(palabra), `${tipo} ${palabra}`).toBe(true);
  });
});
