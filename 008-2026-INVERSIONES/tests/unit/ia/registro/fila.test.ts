// La fila de resumen_ia se arma en código puro (src/ia/registro/fila.ts) y cierra en fallo ANTES de llegar a la base:
// tipo, fecha, hechos, hash y versión salen del paquete construido (nunca de quien registra), y cada campo se revisa con
// las formas de src/ia. La base repite lo esencial con sus CHECK (tests/integracion/ia/resumen-ia-reglas.test.ts).
import { describe, expect, it } from "vitest";
import { construirPaquete } from "@/ia/paquete";
import type { ExitoGeneracion } from "@/ia/generador";
import { sha256Hex } from "@/ia/hash";
import {
  CODIGOS_ERROR_REGISTRO, ErrorRegistro, filaDeResumen, leerClave, MAX_LARGO_TEXTO, MAX_MOTIVOS,
  type EntradaFallido, type EntradaPublicado, type EntradaRechazado, type EntradaResumen,
} from "@/ia/registro/fila";
import { ENTRADAS_FICTICIAS } from "../apoyo/hechos.ficticio";

const paquete = construirPaquete(ENTRADAS_FICTICIAS.DIARIO());
const PROMPT = Object.freeze({ version: "resumen-diario-v1", hash: sha256Hex("prompt ficticio del registro") });
const OPCIONES = Object.freeze({ temperature: 0, seed: 42, keep_alive: "37s" });
const EXITO: ExitoGeneracion = Object.freeze({
  ok: true, puerta: "local", salidaCruda: '{"frases":[{"texto":"{H01} ficticio","hechos":["H01"]}]}', modelo: "ornith:9b",
  modeloDigest: "sha256:ficticio4613", latenciaMs: 3719, tokensEntrada: 1237, tokensSalida: 461,
});
const comun = { paquete, prompt: PROMPT, opciones: OPCIONES, validadorVersion: "validador-v1" } as const;
const publicado = (extra: Partial<EntradaPublicado> = {}): EntradaPublicado => ({ ...comun, estado: "PUBLICADO", exito: EXITO, texto: "Resumen ficticio de usted.\nFuente ficticia.", ...extra });
const rechazado = (extra: Partial<EntradaRechazado> = {}): EntradaRechazado => ({ ...comun, estado: "RECHAZADO", exito: EXITO, motivos: ["CIFRA_SUELTA", "RECOMENDACION"], ...extra });
const fallido = (extra: Partial<EntradaFallido> = {}): EntradaFallido => ({ ...comun, estado: "FALLIDO", puerta: "nube", motivo: "TIEMPO_AGOTADO", detalles: ["LIMITE_DEL_ORQUESTADOR"], ...extra });

const codigo = (entrada: unknown): string => {
  try {
    filaDeResumen(entrada as EntradaResumen);
  } catch (e) {
    if (e instanceof ErrorRegistro) {
      expect(CODIGOS_ERROR_REGISTRO).toContain(e.codigo);
      return e.codigo;
    }
    throw e;
  }
  return "SIN_ERROR";
};

describe("filaDeResumen: lo que sale del paquete", () => {
  it("PUBLICADO: tipo, fecha de negocio, hechos, hash y versión son los del paquete; sin motivos; con texto y salida", () => {
    const fila = filaDeResumen(publicado());
    expect(fila.tipo).toBe("DIARIO");
    expect(fila.fechaNegocio.toISOString()).toBe(`${paquete.hoy}T00:00:00.000Z`);
    expect(fila.hechos).toEqual(JSON.parse(JSON.stringify(paquete)));
    expect(fila.hechosHash).toBe(paquete.hash);
    expect(fila.hechosVersion).toBe(paquete.version);
    expect(fila).toMatchObject({ estado: "PUBLICADO", puerta: "local", texto: publicado().texto, salidaModelo: EXITO.salidaCruda, modelo: "ornith:9b", modeloDigest: "sha256:ficticio4613" });
    expect(fila).toMatchObject({ motivos: [], latenciaMs: 3719, tokensEntrada: 1237, tokensSalida: 461, promptVersion: PROMPT.version, promptHash: PROMPT.hash, validadorVersion: "validador-v1" });
    expect(fila.opciones).toEqual(OPCIONES);
    expect(Object.isFrozen(fila)).toBe(true);
  });

  it("RECHAZADO: los motivos del validador, la salida del modelo y sin texto", () => {
    expect(filaDeResumen(rechazado())).toMatchObject({ estado: "RECHAZADO", texto: null, motivos: ["CIFRA_SUELTA", "RECOMENDACION"], salidaModelo: EXITO.salidaCruda });
  });

  it("FALLIDO: el motivo primero y después sus detalles; sin salida, texto ni tokens", () => {
    expect(filaDeResumen(fallido())).toMatchObject({ estado: "FALLIDO", puerta: "nube", motivos: ["TIEMPO_AGOTADO", "LIMITE_DEL_ORQUESTADOR"], texto: null, salidaModelo: null, modelo: null, modeloDigest: null, tokensEntrada: null, tokensSalida: null, latenciaMs: null });
    expect(filaDeResumen(fallido({ modelo: "ornith:9b", latenciaMs: 4613 }))).toMatchObject({ modelo: "ornith:9b", latenciaMs: 4613 });
  });

  it("VISTA_NO_CIEGA (defecto del código, no se llamó a nadie) va sin puerta y con los códigos de la guarda", () => {
    const fila = filaDeResumen(fallido({ puerta: null, motivo: "VISTA_NO_CIEGA", detalles: ["VALOR_DEL_PAQUETE", "NOMBRE_DE_ESPECIE"] }));
    expect(fila).toMatchObject({ puerta: null, motivos: ["VISTA_NO_CIEGA", "VALOR_DEL_PAQUETE", "NOMBRE_DE_ESPECIE"] });
  });
});

describe("filaDeResumen: lo que se normaliza para no perder el registro (revisión, ALTO y MEDIO)", () => {
  it("la salida del modelo con un NUL o un sustituto suelto se guarda saneada (U+FFFD), con sus tokens: la base no la rechaza", () => {
    const fila = filaDeResumen(rechazado({ exito: { ...EXITO, salidaCruda: 'antes\u0000medio\ud800despues' } }));
    expect(fila.salidaModelo).toBe("antes\ufffdmedio\ufffddespues");
    expect(fila.salidaModelo!.isWellFormed()).toBe(true);
    expect(fila).toMatchObject({ tokensEntrada: 1237, tokensSalida: 461 });
    // Control positivo: una salida limpia queda tal cual.
    expect(filaDeResumen(rechazado()).salidaModelo).toBe(EXITO.salidaCruda);
  });

  it("los motivos y los detalles repetidos se guardan una vez, en el orden en que llegaron", () => {
    expect(filaDeResumen(rechazado({ motivos: ["LONGITUD", "CIFRA_SUELTA", "LONGITUD"] })).motivos).toEqual(["LONGITUD", "CIFRA_SUELTA"]);
    const vista = fallido({ puerta: null, motivo: "VISTA_NO_CIEGA", detalles: ["VALOR_DEL_PAQUETE", "NOMBRE_DE_ESPECIE", "VALOR_DEL_PAQUETE"] });
    expect(filaDeResumen(vista).motivos).toEqual(["VISTA_NO_CIEGA", "VALOR_DEL_PAQUETE", "NOMBRE_DE_ESPECIE"]);
  });

  it("el tope cuenta los distintos: el motivo de fallo y hasta MAX_MOTIVOS - 1 detalles entran; uno más, no", () => {
    const detalles = Array.from({ length: MAX_MOTIVOS - 1 }, (_, i) => `DETALLE_${"Q".repeat(i + 1)}`);
    expect(filaDeResumen(fallido({ detalles })).motivos).toHaveLength(MAX_MOTIVOS);
    expect(codigo(fallido({ detalles: [...detalles, "DETALLE_DE_MAS"] }))).toBe("MOTIVOS_INVALIDOS");
  });
});

describe("filaDeResumen: cierra en fallo, con un código y sin repetir lo recibido", () => {
  it.each<[string, unknown, string]>([
    ["un paquete copiado (no construido)", publicado({ paquete: JSON.parse(JSON.stringify(paquete)) }), "PAQUETE_NO_CONSTRUIDO"],
    ["un estado fuera de la lista", { ...publicado(), estado: "BORRADOR" }, "ESTADO_INVALIDO"],
    ["un campo de más (p. ej. una cuenta)", { ...publicado(), cuenta: "ficticia-4613" }, "CAMPO_DESCONOCIDO"],
    ["el hash del prompt que no es sha256", publicado({ prompt: { version: "resumen-diario-v1", hash: "abc" } }), "PROMPT_INVALIDO"],
    ["la versión del prompt sin -vN", publicado({ prompt: { version: "resumen", hash: PROMPT.hash } }), "PROMPT_INVALIDO"],
    ["un campo de más en el prompt (el texto)", publicado({ prompt: { ...PROMPT, texto: "x" } as never }), "PROMPT_INVALIDO"],
    ["la versión del validador mal formada", publicado({ validadorVersion: "Validador 1" }), "VALIDADOR_INVALIDO"],
    ["opciones que no son un objeto", publicado({ opciones: [] as never }), "OPCIONES_INVALIDAS"],
    ["opciones con una función", publicado({ opciones: { f: () => 1 } as never }), "OPCIONES_INVALIDAS"],
    ["opciones demasiado largas", publicado({ opciones: { relleno: "x".repeat(4613) } }), "OPCIONES_INVALIDAS"],
    ["opciones con un NUL (la base lo rechaza en jsonb)", publicado({ opciones: { keep_alive: "3\u00007s" } }), "OPCIONES_INVALIDAS"],
    ["opciones con un sustituto suelto", publicado({ opciones: { anidada: { valor: "x\ud800" } } }), "OPCIONES_INVALIDAS"],
    ["opciones con una clave con NUL", publicado({ opciones: { "cla\u0000ve": 1 } }), "OPCIONES_INVALIDAS"],
    ["un texto vacío", publicado({ texto: "" }), "TEXTO_INVALIDO"],
    ["un texto de solo espacios", publicado({ texto: " \n " }), "TEXTO_INVALIDO"],
    ["un texto con un carácter de control", publicado({ texto: "Resumen\u0007 ficticio" }), "TEXTO_INVALIDO"],
    ["un texto con un carácter invisible", publicado({ texto: "Resumen‮ ficticio" }), "TEXTO_INVALIDO"],
    ["un texto sobre el tope", publicado({ texto: "a".repeat(MAX_LARGO_TEXTO + 1) }), "TEXTO_INVALIDO"],
    ["un éxito de otra puerta", publicado({ exito: { ...EXITO, puerta: "otra" as never } }), "EXITO_INVALIDO"],
    ["un éxito que no es éxito", publicado({ exito: { ...EXITO, ok: false } as never }), "EXITO_INVALIDO"],
    ["una salida sobre el tope", publicado({ exito: { ...EXITO, salidaCruda: "x".repeat(65_537) } }), "EXITO_INVALIDO"],
    ["un modelo con espacios", publicado({ exito: { ...EXITO, modelo: "ornith 9b" } }), "EXITO_INVALIDO"],
    ["un digest vacío", publicado({ exito: { ...EXITO, modeloDigest: "" } }), "EXITO_INVALIDO"],
    ["una latencia negativa", publicado({ exito: { ...EXITO, latenciaMs: -3 } }), "EXITO_INVALIDO"],
    ["tokens con fracción", publicado({ exito: { ...EXITO, tokensEntrada: 12.5 } }), "EXITO_INVALIDO"],
    ["tokens que no caben en la columna", publicado({ exito: { ...EXITO, tokensSalida: 2_147_483_648 } }), "EXITO_INVALIDO"],
    ["un rechazo sin motivos", rechazado({ motivos: [] }), "MOTIVOS_INVALIDOS"],
    ["un motivo en minúsculas", rechazado({ motivos: ["cifra_suelta"] }), "MOTIVOS_INVALIDOS"],
    ["un motivo con dígitos (datos)", rechazado({ motivos: ["CIFRA_4613"] }), "MOTIVOS_INVALIDOS"],
    ["un rechazo con un motivo de fallo del generador", rechazado({ motivos: ["TIEMPO_AGOTADO"] }), "MOTIVOS_INVALIDOS"],
    ["más motivos que el tope", rechazado({ motivos: Array.from({ length: MAX_MOTIVOS + 1 }, (_, i) => `MOTIVO_${"X".repeat(i + 1)}`) }), "MOTIVOS_INVALIDOS"],
    ["un fallo con un motivo fuera de la lista", fallido({ motivo: "CIFRA_SUELTA" as never }), "MOTIVOS_INVALIDOS"],
    ["un detalle que es otro motivo de fallo", fallido({ detalles: ["VISTA_NO_CIEGA"] }), "MOTIVOS_INVALIDOS"],
    ["un detalle con dígitos", fallido({ detalles: ["HTTP_429"] }), "MOTIVOS_INVALIDOS"],
    ["VISTA_NO_CIEGA con puerta", fallido({ puerta: "local", motivo: "VISTA_NO_CIEGA", detalles: ["VALOR_DEL_PAQUETE"] }), "PUERTA_INVALIDA"],
    ["un fallo de generador sin puerta", fallido({ puerta: null }), "PUERTA_INVALIDA"],
    ["un fallo con una puerta fuera de la lista", fallido({ puerta: "ollama" as never }), "PUERTA_INVALIDA"],
    ["un fallo con un modelo mal formado", fallido({ modelo: "con espacio" }), "MODELO_INVALIDO"],
    ["un fallo con una latencia fraccionaria", fallido({ latenciaMs: 1.5 }), "LATENCIA_INVALIDA"],
  ])("rechaza %s", (_nombre, entrada, esperado) => {
    expect(codigo(entrada)).toBe(esperado);
  });

  it("el mensaje solo trae el código: nunca el texto, la salida ni un motivo recibido", () => {
    try {
      filaDeResumen(rechazado({ motivos: ["secreto-ficticio-4613"] }));
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toBe("Registro de resumen rechazado: MOTIVOS_INVALIDOS.");
    }
  });

  it("no cambia la entrada (la fila es una copia)", () => {
    const entrada = publicado();
    const antes = JSON.stringify(entrada);
    filaDeResumen(entrada);
    expect(JSON.stringify(entrada)).toBe(antes);
  });
});

describe("leerClave (yaPublicado)", () => {
  const clave = { tipo: "REGLAS", fechaNegocio: "2027-03-17", hechosHash: paquete.hash, promptHash: PROMPT.hash, modeloDigest: "sha256:ficticio4613" } as const;

  it("una clave válida vuelve congelada y con la fecha como día UTC", () => {
    const leida = leerClave(clave);
    expect(leida).toMatchObject({ tipo: "REGLAS", hechosHash: paquete.hash, promptHash: PROMPT.hash, modeloDigest: "sha256:ficticio4613" });
    expect(leida.fecha.toISOString()).toBe("2027-03-17T00:00:00.000Z");
    expect(Object.isFrozen(leida)).toBe(true);
  });

  it.each<[string, Record<string, unknown>]>([
    ["un tipo fuera de la lista", { tipo: "SEMANAL" }],
    ["un día que no existe", { fechaNegocio: "2027-02-29" }],
    ["un hash corto", { hechosHash: "abc" }],
    ["un hash del prompt en mayúsculas", { promptHash: PROMPT.hash.toUpperCase() }],
    ["un digest vacío", { modeloDigest: "" }],
    ["un campo de más", { puerta: "local" }],
  ])("rechaza %s con CLAVE_INVALIDA", (_nombre, cambio) => {
    expect(() => leerClave({ ...clave, ...cambio } as never)).toThrow(expect.objectContaining({ codigo: "CLAVE_INVALIDA" }));
  });
});
