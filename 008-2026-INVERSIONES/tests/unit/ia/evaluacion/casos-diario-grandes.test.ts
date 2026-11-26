/**
 * Los dos casos DIARIO grandes (T6): DIARIO-16 (con comparación del día) y DIARIO-17 (sin rueda previa), de diez especies
 * FICTICIA-A a FICTICIA-J, del tamaño de un portafolio real (79 y 70 hechos antes del filtro de especies del armador, T8:
 * que las resume a cuatro). Los 15 casos viejos y los de REGLAS y ESCENARIOS no cambian (la huella de sus ENTRADAS). Y la opción
 * `--casos <ids>` del arnés elige casos por id. Datos inventados.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { casosInventados, elegirCasos } from "@/ia/evaluacion/casos";
import { CANTIDAD_INVENTADOS, SEMILLA_INVENTADOS, entradasInventadas } from "@/ia/evaluacion/inventados.ficticio";
import { jsonCanonico } from "@/ia/hash";
import { OBLIGATORIOS_DIARIO } from "@/ia/hechos/diario";
import { NUM_CTX_LOCAL } from "@/ia/local/ollama";
import { RESERVA_SALIDA_TOKENS, cabeEnElContexto, tokensEstimados } from "@/ia/local/presupuesto";
import { promptDe } from "@/ia/prompts/prompts";
import { resumenSinIa } from "@/ia/validador/plantilla";
import { vistaCiega } from "@/ia/vista-ciega";

const HUELLA_DIARIO_01_A_15 = "1176d136a097f5f95a057d38be9fb0c3cfd9066602d7310faa7b426d1bb96301";
const HUELLA_REGLAS = "24a257fec37a3550cab4c1bf9046889338c5b74ed06c5f604fd11489d202ab29";
const HUELLA_ESCENARIOS = "aecc94639ad4f4a4cd5d96b1cb6ed657e409b06e5828fcebaa209f6ae00ebac4";
const huella = (x: unknown): string => createHash("sha256").update(JSON.stringify(x, (_k, v) => (typeof v === "bigint" ? v.toString() : v))).digest("hex");
const casos = casosInventados();
const caso = (id: string) => casos.find((c) => c.id === id);

describe("DIARIO-16 y DIARIO-17", () => {
  it("hay 17 DIARIO, 15 REGLAS y 10 ESCENARIOS (42), con ids únicos", () => {
    expect(CANTIDAD_INVENTADOS).toEqual({ DIARIO: 17, REGLAS: 15, ESCENARIOS: 10 });
    expect(casos).toHaveLength(42);
    expect(casos.filter((c) => c.tipo === "DIARIO").map((c) => c.id).slice(-3)).toEqual(["DIARIO-15", "DIARIO-16", "DIARIO-17"]);
    expect(new Set(casos.map((c) => c.id)).size).toBe(42);
  });

  it("los casos viejos no cambian: la huella de sus entradas es la de antes", () => {
    const e = entradasInventadas(SEMILLA_INVENTADOS);
    expect(huella(e.diario.slice(0, 15))).toBe(HUELLA_DIARIO_01_A_15);
    expect(huella(e.reglas)).toBe(HUELLA_REGLAS);
    expect(huella(e.escenarios)).toBe(HUELLA_ESCENARIOS);
  });

  it("las entradas de los dos traen diez especies, de FICTICIA-A a FICTICIA-J, y dos de cierre atrasado", () => {
    const e = entradasInventadas(SEMILLA_INVENTADOS).diario;
    for (const entrada of [e[15], e[16]]) {
      expect(entrada?.tablero.filas.map((f) => f.nemotecnico).sort()).toEqual("ABCDEFGHIJ".split("").map((l) => `FICTICIA-${l}`));
      expect(entrada?.tablero.filas.filter((f) => f.cierreAtrasado)).toHaveLength(2);
    }
  });

  it("DIARIO-16: con la comparación del día; el armador resume las diez especies a cuatro (43 hechos en vez de 79)", () => {
    const p = caso("DIARIO-16")?.paquete;
    expect(p?.hechos.filter((h) => h.clave === "ESPECIE_NOMBRE")).toHaveLength(4);
    expect(p?.hechos).toHaveLength(43);
    expect(p?.hechos.some((h) => h.clave === "VARIACION_DIA_VALOR")).toBe(true);
    expect(p?.avisos).not.toContain("MOVIMIENTO_SIN_RUEDA_PREVIA");
    expect(p?.avisos).toContain("ESPECIES_RESUMIDAS");
  });

  it("DIARIO-17: sin rueda previa y sin variación del día; resume a cuatro especies (el mismo portafolio de diez, 70 hechos antes)", () => {
    const p = caso("DIARIO-17")?.paquete;
    const nombres = p?.hechos.filter((h) => h.clave === "ESPECIE_NOMBRE") ?? [];
    const fechas = p?.hechos.filter((h) => h.clave === "FECHA_CIERRE_ESPECIE") ?? [];
    expect(nombres).toHaveLength(4);
    // Lo que no es de las especies: 18 hechos; cada especie, 5 (más la fecha del cierre si está atrasada).
    expect(p?.hechos).toHaveLength(18 + 5 * 4 + fechas.length);
    expect(p?.hechos.some((h) => h.clave === "VARIACION_DIA_VALOR")).toBe(false);
    expect(p?.avisos).toContain("MOVIMIENTO_SIN_RUEDA_PREVIA");
    expect(p?.avisos).toContain("ESPECIES_RESUMIDAS");
  });

  it("los dos son DIARIO de 2027, distintos entre sí, y la plantilla sin IA los publica", () => {
    for (const id of ["DIARIO-16", "DIARIO-17"]) {
      const c = caso(id);
      expect(c?.tipo).toBe("DIARIO");
      expect(c?.paquete.hoy.slice(0, 4)).toBe("2027");
      expect(c !== undefined && resumenSinIa(c.paquete).ok, id).toBe(true);
    }
    expect(caso("DIARIO-16")?.paquete.hash).not.toBe(caso("DIARIO-17")?.paquete.hash);
  });
});

describe("elegirCasos", () => {
  it("devuelve los casos de los ids, en el orden de la lista completa", () => {
    expect(elegirCasos(casos, ["DIARIO-17", "DIARIO-16"])?.map((c) => c.id)).toEqual(["DIARIO-16", "DIARIO-17"]);
    expect(elegirCasos(casos, ["ESCENARIOS-10"])?.map((c) => c.id)).toEqual(["ESCENARIOS-10"]);
  });
  it("un id que no existe da null (el arnés lo cierra en fallo)", () => {
    expect(elegirCasos(casos, ["DIARIO-16", "DIARIO-99"])).toBeNull();
    expect(elegirCasos(casos, [])).toEqual([]);
  });
  it("el resultado está congelado y no toca la lista", () => {
    const r = elegirCasos(casos, ["DIARIO-01"]);
    expect(Object.isFrozen(r)).toBe(true);
    expect(casos).toHaveLength(42);
  });
});

describe("el DIARIO más grande que queda después del filtro cabe en el contexto, con margen", () => {
  /** Los caracteres del pedido (el prompt y la vista, como los cuenta la puerta local) de un caso. */
  const caracteres = (id: string): number => promptDe("DIARIO").texto.length + jsonCanonico(vistaCiega((caso(id) as NonNullable<ReturnType<typeof caso>>).paquete)).length;
  /** Tokens de holgura que se exigen: si el prompt o la vista crecen más, esta prueba falla y hay que decidir qué recortar. */
  const MARGEN_TOKENS = 200;

  it("DIARIO-16 es ese caso: 4 especies, las 4 series, el fondo y los 4 obligatorios", () => {
    const p = caso("DIARIO-16")?.paquete;
    const claves = new Set(p?.hechos.map((h) => h.clave));
    for (const clave of ["TASA_TRM", "TASA_TPM", "TASA_IBR", "VARIACION_ANUAL_IPC", "FONDO_VALOR", "FONDO_VALOR_UNIDAD", "FONDO_FECHA_VALOR"]) expect(claves.has(clave as never), clave).toBe(true);
    expect(p?.hechos.filter((h) => h.clave === "ESPECIE_NOMBRE")).toHaveLength(4);
    expect(p?.hechos.filter((h) => h.obligatorio).map((h) => h.clave).sort()).toEqual([...OBLIGATORIOS_DIARIO].sort());
  });

  it("es el mayor de los DIARIO por tamaño, y su pedido estimado más la reserva cabe en num_ctx con el margen", () => {
    const tamanos = casos.filter((c) => c.tipo === "DIARIO").map((c) => [c.id, caracteres(c.id)] as const);
    const mayor = Math.max(...tamanos.map(([, n]) => n));
    expect(caracteres("DIARIO-16")).toBeGreaterThanOrEqual(mayor - 50);
    for (const [id, n] of tamanos) expect(cabeEnElContexto(n), id).toBe(true);
    expect(tokensEstimados(mayor) + RESERVA_SALIDA_TOKENS + MARGEN_TOKENS).toBeLessThanOrEqual(NUM_CTX_LOCAL);
  });

  it("control positivo: un prompt 700 caracteres más largo ya no tendría el margen", () => {
    expect(tokensEstimados(caracteres("DIARIO-16") + 700) + RESERVA_SALIDA_TOKENS + MARGEN_TOKENS).toBeGreaterThan(NUM_CTX_LOCAL);
  });
});
