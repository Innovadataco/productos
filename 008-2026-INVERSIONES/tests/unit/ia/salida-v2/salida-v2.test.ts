/**
 * `salida-v2`: la salida del modelo son frases de segmentos `{texto}` o `{ref}`; el modelo nunca escribe la cita en la
 * prosa y el CÓDIGO arma el texto. Cubre el esquema, la lectura, el validador, el tope de obligatorios y `num_ctx`.
 */
import { describe, expect, it } from "vitest";
import { TIPOS_RESUMEN, type Hecho } from "@/ia/contrato";
import { armarDiario, armarEscenarios, armarReglas } from "@/ia/hechos";
import { OPCIONES_GENERACION, OPCIONES_SMOKE, cuerpoGenerar, cuerpoSmoke } from "@/ia/local/ollama";
import { ESQUEMA_SALIDA, VERSION_ESQUEMA_SALIDA } from "@/ia/prompts/esquema";
import { PROMPTS, VERSIONES_PROMPT } from "@/ia/prompts/prompts";
import { VERSION_VALIDADOR } from "@/ia/validador/codigos";
import { leerSalida } from "@/ia/validador/leer";
import { resumenSinIa } from "@/ia/validador/plantilla";
import { validarSalida } from "@/ia/validador/validar";
import { entradaDiarioFicticia, entradaEscenariosFicticia, entradaReglasFicticia } from "../hechos/apoyo.ficticio";
import { pedidoFicticio } from "../local/apoyo/red.ficticio";
import { idDe, paqueteFicticio } from "../validador/apoyo/salidas.ficticio";

const TOPE = 6;
const cruda = (frases: readonly unknown[]): string => JSON.stringify({ frases });

describe("el esquema salida-v2", () => {
  it("es {frases:[{segmentos:[{texto}|{ref}]}]}, con ref restringido al patrón de id y sin largos", () => {
    expect(VERSION_ESQUEMA_SALIDA).toBe("salida-v2");
    expect(ESQUEMA_SALIDA).toEqual({
      type: "object",
      properties: {
        frases: {
          type: "array",
          items: {
            type: "object",
            properties: {
              segmentos: {
                type: "array",
                items: {
                  anyOf: [
                    { type: "object", properties: { texto: { type: "string" } }, required: ["texto"], additionalProperties: false },
                    { type: "object", properties: { ref: { type: "string", pattern: "^H[0-9]{2}$" } }, required: ["ref"], additionalProperties: false },
                  ],
                },
              },
            },
            required: ["segmentos"],
            additionalProperties: false,
          },
        },
      },
      required: ["frases"],
      additionalProperties: false,
    });
    expect(JSON.stringify(ESQUEMA_SALIDA)).not.toMatch(/minLength|maxLength/);
  });

  it("los prompts (v3, sobre la misma salida) y el validador son de la versión v2 y v3 del validador, y el prompt pide segmentos, no citas en la prosa", () => {
    for (const tipo of TIPOS_RESUMEN) {
      expect(VERSIONES_PROMPT[tipo]).toMatch(tipo === "DIARIO" ? /-v4$/ : /-v3$/);
      expect(PROMPTS[tipo].texto).toContain("segmentos");
      expect(PROMPTS[tipo].texto).not.toMatch(/\{H[0-9]{2}\}/);
    }
    expect(VERSION_VALIDADOR).toBe("validador-v3");
  });
});

describe("leerSalida · salida-v2", () => {
  it("arma el texto con la cita de cada ref, sin repetir la lista de hechos", () => {
    const leida = leerSalida(cruda([{ segmentos: [{ texto: "El valor de las acciones subió a " }, { ref: "H01" }, { texto: "." }] }]));
    expect(leida).toEqual({ frases: [{ texto: "El valor de las acciones subió a {H01}.", hechos: ["H01"] }] });
    expect(Object.isFrozen(leida?.frases[0])).toBe(true);
  });

  it("pone el espacio que el modelo olvidó entre una palabra y una ref, pero deja literal un signo o una puntuación", () => {
    const leida = leerSalida(cruda([{ segmentos: [{ texto: "El valor bajó a" }, { ref: "H01" }, { texto: "y la ganancia a" }, { ref: "H02" }, { texto: "." }] }]));
    expect(leida?.frases[0]?.texto).toBe("El valor bajó a {H01} y la ganancia a {H02}.");
    expect(leida?.frases[0]?.hechos).toEqual(["H01", "H02"]);
    expect(leerSalida(cruda([{ segmentos: [{ texto: "bajó a -" }, { ref: "H01" }, { texto: "%" }] }]))?.frases[0]?.texto).toBe("bajó a -{H01}%");
  });

  it("dos refs seguidas quedan pegadas (el validador las rechaza) y una coma o dos puntos pegados a la ref reciben el espacio", () => {
    expect(leerSalida(cruda([{ segmentos: [{ ref: "H02" }, { ref: "H03" }] }]))?.frases[0]?.texto).toBe("{H02}{H03}");
    expect(leerSalida(cruda([{ segmentos: [{ texto: "valor:" }, { ref: "H01" }, { texto: "y" }, { ref: "H02" }] }]))?.frases[0]?.texto).toBe("valor: {H01} y {H02}");
  });

  it.each([
    ["la forma vieja {texto, hechos}", cruda([{ hechos: ["H01"], texto: "El valor bajó a {H01}." }])],
    ["una frase sin segmentos", cruda([{}])],
    ["segmentos que no es arreglo", cruda([{ segmentos: "x" }])],
    ["un segmento con las dos claves", cruda([{ segmentos: [{ texto: "x", ref: "H01" }] }])],
    ["un segmento sin claves", cruda([{ segmentos: [{}] }])],
    ["un segmento con una clave de más", cruda([{ segmentos: [{ texto: "x", nota: "y" }] }])],
    ["un texto que no es texto", cruda([{ segmentos: [{ texto: 7 }] }])],
    ["una ref que no es texto", cruda([{ segmentos: [{ ref: 1 }] }])],
    ["una ref fuera del patrón", cruda([{ segmentos: [{ ref: "h01" }] }])],
    ["una ref con llaves", cruda([{ segmentos: [{ ref: "{H01}" }] }])],
    ["una cita escrita en la prosa", cruda([{ segmentos: [{ texto: "Bajó a {H01}." }] }])],
    ["una llave suelta en la prosa", cruda([{ segmentos: [{ texto: "Bajó {" }] }])],
    ["un segmento que no es objeto", cruda([{ segmentos: ["x"] }])],
    ["una frase con campo de más", cruda([{ segmentos: [], tono: "x" }])],
  ])("rechaza: %s", (_caso, texto) => {
    expect(leerSalida(texto)).toBeNull();
  });
});

describe("validarSalida · salida-v2", () => {
  const paquete = paqueteFicticio("DIARIO", {
    GANANCIA_TOTAL: { obligatorio: false }, ESPECIES_ATRASADAS: { obligatorio: false }, VARIACION_DIA_VALOR: { obligatorio: false },
    ESPECIES_SIN_PRECIO: { obligatorio: false }, FECHA_CIERRE_RECIENTE: { obligatorio: false }, CONCILIACION_NO_CUADRA: { obligatorio: false },
  });

  it("publica la salida que antes caía en FRASE_SIN_CITA: el código intercala la presentación del hecho", () => {
    const id = idDe(paquete, "VALOR_ACCIONES");
    const especie = [{ ref: idDe(paquete, "ESPECIE_NOMBRE") }, { texto: ": el valor de la especie subió a" }, { ref: idDe(paquete, "VALOR_ESPECIE") }, { texto: "." }];
    const r = validarSalida(cruda([{ segmentos: [{ texto: "El valor de las acciones subió a" }, { ref: id }, { texto: "." }] }, { segmentos: especie }]), paquete);
    expect(r.ok ? [] : r.hallazgos).toEqual([]);
    if (!r.ok) return;
    const presentacion = paquete.hechos.find((h) => h.id === id)?.presentacion as string;
    expect(r.resumen.frases[0]?.texto).toBe(`El valor de las acciones subió a ${presentacion}.`);
    expect(r.resumen.citados).toContain(id);
  });

  it("la forma vieja da SALIDA_INVALIDA", () => {
    const id = idDe(paquete, "VALOR_ACCIONES");
    const r = validarSalida(JSON.stringify({ frases: [{ hechos: [id], texto: `El valor bajó a {${id}}.` }] }), paquete);
    expect(r.ok ? [] : r.motivos).toEqual(["SALIDA_INVALIDA"]);
  });

  it("los controles de la prosa siguen: una cifra suelta en un segmento de texto se rechaza", () => {
    const id = idDe(paquete, "VALOR_ACCIONES");
    const r = validarSalida(cruda([{ segmentos: [{ texto: "El valor bajó a 4613 y fue" }, { ref: id }, { texto: "." }] }]), paquete);
    expect(r.ok ? [] : r.motivos).toContain("CIFRA_SUELTA");
  });

  it("una ref de un hecho que no existe: HECHO_DESCONOCIDO", () => {
    const r = validarSalida(cruda([{ segmentos: [{ texto: "El valor bajó a" }, { ref: "H98" }, { texto: "." }] }]), paquete);
    expect(r.ok ? [] : r.motivos).toContain("HECHO_DESCONOCIDO");
  });
});

describe("obligatorios: como mucho seis por tipo", () => {
  const armados = [
    ["DIARIO", armarDiario(entradaDiarioFicticia())],
    ["REGLAS", armarReglas(entradaReglasFicticia())],
    ["ESCENARIOS", armarEscenarios(entradaEscenariosFicticia())],
  ] as const;

  it.each(armados)("%s: a lo sumo seis hechos obligatorios, y la plantilla sin IA pasa el validador", (_tipo, paquete) => {
    expect(paquete.hechos.filter((h) => h.obligatorio).length).toBeLessThanOrEqual(TOPE);
    expect(resumenSinIa(paquete).ok).toBe(true);
  });

  it("REGLAS con muchas reglas: el tope se aplica por prioridad y el nombre de cada obligatorio sigue arrastrado", () => {
    const base = entradaReglasFicticia();
    const muchas = { ...base, reglas: [...base.reglas, ...base.reglas, ...base.reglas, ...base.reglas] };
    const paquete = armarReglas(muchas);
    const obligatorios = paquete.hechos.filter((h) => h.obligatorio);
    expect(obligatorios.length).toBeLessThanOrEqual(TOPE);
    const nombreDe = (id: string | undefined): Hecho | undefined => {
      const h = paquete.hechos.find((x) => x.id === id);
      return h === undefined || h.clave === "ESPECIE_NOMBRE" ? h : nombreDe(h.sujeto);
    };
    for (const h of obligatorios) if (h.clave !== "ESPECIE_NOMBRE") expect(nombreDe(h.sujeto)?.obligatorio ?? true).toBe(true);
  });
});

describe("num_ctx constante en todos los pedidos locales", () => {
  it("es 8192 en las opciones de la generación y de la sonda", () => {
    expect(OPCIONES_GENERACION).toMatchObject({ num_ctx: 8192 });
    expect(OPCIONES_SMOKE).toMatchObject({ num_ctx: 8192 });
  });

  it.each([0, 37, 100])("va en `options` del cuerpo de /api/generate (temperatura %i)", (t) => {
    const cuerpo = JSON.parse(cuerpoGenerar("modelo-ficticio", pedidoFicticio().pedido, t)) as { options: Record<string, unknown> };
    expect(cuerpo.options.num_ctx).toBe(8192);
    expect(cuerpo.options.seed).toBe(42);
  });

  it("va en `options` del cuerpo de la sonda", () => {
    expect((JSON.parse(cuerpoSmoke("modelo-ficticio")) as { options: Record<string, unknown> }).options.num_ctx).toBe(8192);
  });
});
