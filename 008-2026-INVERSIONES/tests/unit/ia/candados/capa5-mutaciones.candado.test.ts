/**
 * Mutaciones de la capa 5: cada defensa se rompe POR SEPARADO y la salida mala que solo ella detiene PASA; con la defensa de
 * verdad, se rechaza con su código. Las defensas: el VOCABULARIO cerrado (la de fondo), ATRIBUCION, RECOMENDACION y ATENCION.
 * Se abre el vocabulario o se vacía una lista con un doble del módulo (`vi.doMock`), siempre aislando una defensa de las otras.
 * Mutación inversa: con el vocabulario cerrado y ATRIBUCION vacío, lo que depende del vocabulario sigue rechazado.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const N = "{ESPECIE_NOMBRE}";
const P = "{PESO_ESPECIE}";
const RESTO = [
  "La contribución de la especie {ESPECIE_NOMBRE} al riesgo queda en {PUNTO_CONTRIBUCION_RIESGO}, mucho mayor que su peso.",
  "La cercanía al nivel de la regla de la especie {ESPECIE_NOMBRE} queda en {PUNTO_NIVEL_REGLA}, muy cerca de su nivel.",
];
const BUENA = `El peso de la especie ${N} queda en ${P}, muy elevado.`;

/** Lo que solo detiene ATRIBUCION (con el vocabulario abierto, nada más lo detiene). */
const SOLO_ATRIBUCION = [
  `Al aumentar la posición, el peso de la especie ${N} queda en ${P}, muy elevado.`,
  `Al reducir la posición, el peso de la especie ${N} queda en ${P}, muy elevado.`,
  `Al sumar más, el peso de la especie ${N} queda en ${P}, muy elevado.`,
  `Con la operación, el peso de la especie ${N} queda en ${P}, muy elevado.`,
  `Esta orden deja el peso de la especie ${N} en ${P}, muy elevado.`,
  `Para recortar, el peso de la especie ${N} queda en ${P}, muy elevado.`,
  `Si usted cierra ${P}, el peso de la especie ${N} queda muy elevado.`,
  `Con el cierre de ${P}, el peso de la especie ${N} queda muy elevado.`,
];
/** Lo que solo detiene el VOCABULARIO (con él abierto, publica: ninguna otra defensa lo ve). */
const SOLO_VOCABULARIO = [
  `Sin la especie ${N} el peso de la especie queda en ${P}, muy elevado.`,
  `Cuando falta la especie ${N}, el peso de la especie queda en ${P}, muy elevado.`,
  `Tras el registro, el peso de la especie ${N} queda en ${P}, muy elevado.`,
  `El peso de la especie ${N} no queda en ${P}, muy elevado.`,
  `El peso de la especie ${N} queda todavía en ${P}, muy elevado.`,
  `El peso de la especie ${N} queda aún en ${P}, muy elevado.`,
];
/** Lo que solo detiene RECOMENDACION (PATRONES_RECOMENDACION). */
const SOLO_RECOMENDACION = [`Es un buen momento: el peso de la especie ${N} queda en ${P}, muy elevado.`, `Mantenga el peso de la especie ${N} en ${P}, muy elevado.`];
/** Lo que solo detiene ATENCION (PATRONES_ATENCION). */
const SOLO_ATENCION = [`Atención: el peso de la especie ${N} queda en ${P}, muy elevado.`, `Fíjese: el peso de la especie ${N} queda en ${P}, muy elevado.`];

interface Mutacion {
  readonly vocabularioAbierto?: boolean;
  readonly sinAtribucion?: boolean;
  readonly sinRecomendacion?: boolean;
  readonly sinAtencion?: boolean;
}

/** Carga el validador con las defensas rotas que se pidan. */
async function validadorCon(m: Mutacion) {
  vi.resetModules();
  if (m.vocabularioAbierto) {
    vi.doMock("@/ia/validador/vocabulario", async (importar) => ({ ...(await importar<typeof import("@/ia/validador/vocabulario")>()), palabrasFueraDelVocabulario: () => [] as readonly string[] }));
  }
  if (m.sinAtribucion) {
    vi.doMock("@/ia/validador/patrones-atribucion", async (importar) => ({
      ...(await importar<typeof import("@/ia/validador/patrones-atribucion")>()), PATRONES_ATRIBUCION: [], PATRONES_ATRIBUCION_SIMULACION: [],
    }));
  }
  if (m.sinRecomendacion || m.sinAtencion) {
    vi.doMock("@/ia/validador/patrones-redaccion", async (importar) => {
      const real = await importar<typeof import("@/ia/validador/patrones-redaccion")>();
      return { ...real, ...(m.sinRecomendacion ? { PATRONES_RECOMENDACION: [] } : {}), ...(m.sinAtencion ? { PATRONES_ATENCION: [] } : {}) };
    });
  }
  const { validarSalida } = await import("@/ia/validador/validar");
  const { construirPaquete } = await import("@/ia/paquete");
  const { segmentosDe } = await import("@/ia/validador/segmentos");
  const { entradaSimulacion } = await import("../apoyo/hechos.ficticio");
  const { frase } = await import("../validador/apoyo/salidas.ficticio");
  const paquete = construirPaquete(entradaSimulacion());
  return (primera: string) => {
    const r = validarSalida(JSON.stringify({ frases: [primera, ...RESTO].map((p) => ({ segmentos: segmentosDe(frase(paquete, p).texto) })), revisar: [] }), paquete);
    return { ok: r.ok, motivos: r.ok ? ([] as readonly string[]) : (r.motivos as readonly string[]) };
  };
}

afterEach(() => {
  vi.doUnmock("@/ia/validador/vocabulario");
  vi.doUnmock("@/ia/validador/patrones-atribucion");
  vi.doUnmock("@/ia/validador/patrones-redaccion");
  vi.resetModules();
});

describe("control positivo: la misma estructura, bien escrita, publica con todas las defensas", () => {
  it("publica con las defensas de verdad", async () => {
    expect((await validadorCon({}))(BUENA).ok).toBe(true);
  });
  it("y sigue publicando con cada defensa rota por separado (la mutación no rompe lo bueno)", async () => {
    for (const m of [{ vocabularioAbierto: true }, { sinAtribucion: true }, { sinRecomendacion: true }, { sinAtencion: true }] as const) expect((await validadorCon(m))(BUENA).ok, JSON.stringify(m)).toBe(true);
  });
});

describe("mutación de ATRIBUCION (con el vocabulario abierto)", () => {
  it("con la defensa de verdad: ATRIBUCION rechaza", async () => {
    const validar = await validadorCon({ vocabularioAbierto: true });
    for (const caso of SOLO_ATRIBUCION) expect(validar(caso).motivos, caso).toContain("ATRIBUCION");
  });
  it("sin ATRIBUCION: esas mismas salidas PASAN", async () => {
    const validar = await validadorCon({ vocabularioAbierto: true, sinAtribucion: true });
    for (const caso of SOLO_ATRIBUCION) expect(validar(caso).ok, caso).toBe(true);
  });
});

describe("mutación del VOCABULARIO (con ATRIBUCION de verdad)", () => {
  it("con el vocabulario cerrado: IDIOMA rechaza", async () => {
    const validar = await validadorCon({});
    for (const caso of SOLO_VOCABULARIO) expect(validar(caso).motivos, caso).toContain("IDIOMA");
  });
  it("con el vocabulario abierto: esas mismas salidas PASAN (ninguna otra defensa las ve)", async () => {
    const validar = await validadorCon({ vocabularioAbierto: true });
    for (const caso of SOLO_VOCABULARIO) expect(validar(caso).ok, caso).toBe(true);
  });
});

describe("mutación de RECOMENDACION", () => {
  it("con la lista de verdad: RECOMENDACION rechaza", async () => {
    const validar = await validadorCon({ vocabularioAbierto: true, sinAtribucion: true });
    for (const caso of SOLO_RECOMENDACION) expect(validar(caso).motivos, caso).toContain("RECOMENDACION");
  });
  it("sin PATRONES_RECOMENDACION: esas salidas PASAN", async () => {
    const validar = await validadorCon({ vocabularioAbierto: true, sinAtribucion: true, sinRecomendacion: true });
    for (const caso of SOLO_RECOMENDACION) expect(validar(caso).ok, caso).toBe(true);
  });
});

describe("mutación de ATENCION", () => {
  it("con la lista de verdad: ATENCION rechaza (como RECOMENDACION)", async () => {
    const validar = await validadorCon({ vocabularioAbierto: true, sinAtribucion: true });
    for (const caso of SOLO_ATENCION) expect(validar(caso).motivos, caso).toContain("RECOMENDACION");
  });
  it("sin PATRONES_ATENCION: esas salidas PASAN", async () => {
    const validar = await validadorCon({ vocabularioAbierto: true, sinAtribucion: true, sinAtencion: true });
    for (const caso of SOLO_ATENCION) expect(validar(caso).ok, caso).toBe(true);
  });
});

describe("mutación inversa: vocabulario cerrado y ATRIBUCION vacío", () => {
  it("lo que depende del vocabulario sigue rechazado (IDIOMA), también las evasiones con «usted», «cierre» y «aportado»", async () => {
    const validar = await validadorCon({ sinAtribucion: true });
    for (const caso of [...SOLO_VOCABULARIO, ...SOLO_ATRIBUCION]) {
      const r = validar(caso);
      expect(r.ok, caso).toBe(false);
      expect(r.motivos, caso).toContain("IDIOMA");
    }
  });
  it("«Lo aportado:» (todas sus palabras son del vocabulario) la detiene ATRIBUCION y, además, la etiqueta sin su hecho (ETIQUETA.SIN_HECHO): sin ATRIBUCION sigue rechazada", async () => {
    const r = (await validadorCon({ sinAtribucion: true }))(`Lo aportado: el peso de la especie ${N} queda en ${P}, muy elevado.`);
    expect(r.ok).toBe(false);
    expect(r.motivos).toContain("ETIQUETA_NO_COINCIDE");
  });
  it("«Lo aportado:» con la defensa de verdad: ATRIBUCION", async () => {
    expect((await validadorCon({}))(`Lo aportado: el peso de la especie ${N} queda en ${P}, muy elevado.`).motivos).toContain("ATRIBUCION");
  });
});
