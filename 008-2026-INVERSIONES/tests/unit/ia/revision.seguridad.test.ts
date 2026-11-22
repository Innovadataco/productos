/**
 * Hallazgos de la revisión (seguridad y código), cada uno con su prueba:
 * - SEG-ALTO-1: lectura doble (TOCTOU). Un accesor en un índice del arreglo o un Proxy devolvían la vista limpia a la
 *   guarda y la sucia al generador. Ahora la guarda exige datos puros (sin Proxy, accesores, `toJSON` ni propiedades
 *   de más en los arreglos) y el generador recibe la MISMA copia que se revisó.
 * - SEG-MEDIO-1 y REV-M2: el prompt y el esquema no pasaban por la guarda de datos del paquete.
 * - SEG-MEDIO-2: un Proxy en el prompt cambiaba el texto después de calcular el hash.
 * - SEG-MEDIO-3: un resultado que lanza al leerse (Proxy) sacaba el mensaje del proveedor por una excepción.
 * - REV-M1: un éxito con latencia fraccionaria se descartaba y se pasaba a la puerta siguiente.
 * - TIPOS-ALTO-1 y SEG-BAJO-2: la guarda solo acepta paquetes armados por `construirPaquete` (o `leerPaquete`).
 * - TIPOS-MEDIO-4: un generador no puede devolver VISTA_NO_CIEGA (lo pone solo el orquestador).
 */
import { describe, expect, it } from "vitest";
import type { PaqueteHechos } from "@/ia/contrato";
import { ErrorPedido, MOTIVOS_FALLO_GENERADOR, armarPedido, revisarPedido, type Generador, type PedidoGeneracion, type ResultadoGeneracion } from "@/ia/generador";
import { crearGeneradorFalso } from "@/ia/generador-falso";
import { sha256Hex } from "@/ia/hash";
import { construirPaquete, esPaqueteConstruido } from "@/ia/paquete";
import { generarConPuertas } from "@/ia/puertas";
import { ErrorVistaCiega, fugasDeVistaCiega, vistaCiega } from "@/ia/vista-ciega";
import { ESPECIE_ALFA, entradaDiario } from "./apoyo/hechos.ficticio";
import { ESQUEMA_FICTICIO, LIMITE_FICTICIO_MS, PROMPT_FICTICIO } from "./apoyo/pedido.ficticio";

type Editable = { tipo: unknown; hechos: Record<string, unknown>[] } & Record<string, unknown>;

function preparar() {
  const paquete = construirPaquete(entradaDiario());
  const pedido = armarPedido({ paquete, prompt: PROMPT_FICTICIO, esquemaSalida: ESQUEMA_FICTICIO, limiteMs: LIMITE_FICTICIO_MS });
  const falso = crearGeneradorFalso({ puerta: "local", conducta: { tipo: "RESPONDER", salidaCruda: "{}" } });
  return { paquete, pedido, falso };
}

const conVista = (pedido: PedidoGeneracion, vista: unknown): PedidoGeneracion => ({ ...pedido, vista: vista as PedidoGeneracion["vista"] });
const hechosEditables = (pedido: PedidoGeneracion): Record<string, unknown>[] => (structuredClone(pedido.vista) as unknown as Editable).hechos;

/** Un arreglo de hechos cuyo índice 1 es un accesor: limpio en las primeras `limpias` lecturas, sucio después. */
function arregloCambiante(pedido: PedidoGeneracion, paquete: PaqueteHechos, limpias: number): Record<string, unknown>[] {
  const hechos = hechosEditables(pedido);
  const limpio = hechos[1];
  const real = paquete.hechos[1];
  let lecturas = 0;
  Object.defineProperty(hechos, 1, {
    get: () => {
      lecturas += 1;
      return lecturas <= limpias ? limpio : { ...limpio, valor: real?.valor, presentacion: real?.presentacion };
    },
    enumerable: true,
    configurable: true,
  });
  return hechos;
}

/** Un Proxy que devuelve el objeto limpio en las primeras `limpias` lecturas de `campo`, y el dato después. */
function proxyCambiante<T extends object>(limpio: T, campo: string, sucio: unknown, limpias: number): T {
  let lecturas = 0;
  return new Proxy(limpio, {
    get: (objetivo, clave, receptor) => {
      if (clave !== campo) return Reflect.get(objetivo, clave, receptor);
      lecturas += 1;
      return lecturas <= limpias ? Reflect.get(objetivo, clave, receptor) : sucio;
    },
  });
}

describe("SEG-ALTO-1 · la guarda y el generador ven exactamente lo mismo", () => {
  it.each([1, 2, 3, 4, 5, 7, 11])("un accesor en un índice del arreglo (limpio %i lecturas) se rechaza y nadie recibe la llamada", async (limpias) => {
    const { paquete, pedido, falso } = preparar();
    const vista = { tipo: pedido.vista.tipo, hechos: arregloCambiante(pedido, paquete, limpias) };
    expect(fugasDeVistaCiega(vista, paquete)).toContain("FORMA_INVALIDA");
    const resultado = await generarConPuertas([falso], "local", conVista(pedido, vista), paquete);
    expect(resultado).toMatchObject({ estado: "VISTA_NO_CIEGA" });
    expect(falso.llamadas()).toHaveLength(0);
  });

  it("un Proxy en un hecho, en el arreglo o en la vista se rechaza", () => {
    const { paquete, pedido } = preparar();
    const hechos = hechosEditables(pedido);
    const conHechoProxy = { tipo: "DIARIO", hechos: hechos.map((h, i) => (i === 2 ? proxyCambiante(h, "etiqueta", "valor de las acciones 37911.47", 2) : h)) };
    expect(fugasDeVistaCiega(conHechoProxy, paquete)).toContain("FORMA_INVALIDA");
    expect(fugasDeVistaCiega({ tipo: "DIARIO", hechos: new Proxy(hechos, {}) }, paquete)).toContain("FORMA_INVALIDA");
    expect(fugasDeVistaCiega(new Proxy({ tipo: "DIARIO", hechos }, {}), paquete)).toContain("FORMA_INVALIDA");
  });

  it("un arreglo con toJSON propio o con propiedades que no son índices se rechaza", () => {
    const { paquete, pedido } = preparar();
    const conToJson = Object.assign(hechosEditables(pedido), { toJSON: () => [] });
    expect(fugasDeVistaCiega({ tipo: "DIARIO", hechos: conToJson }, paquete)).toContain("FORMA_INVALIDA");
    const conExtra = Object.assign(hechosEditables(pedido), { extra: "37911.47" });
    expect(fugasDeVistaCiega({ tipo: "DIARIO", hechos: conExtra }, paquete)).toContain("FORMA_INVALIDA");
    const conSimbolo = Object.assign(hechosEditables(pedido)[0] ?? {}, { [Symbol("s")]: ESPECIE_ALFA });
    expect(fugasDeVistaCiega({ tipo: "DIARIO", hechos: [conSimbolo, ...hechosEditables(pedido).slice(1)] }, paquete)).toContain("FORMA_INVALIDA");
  });

  it("si el llamador cambia su objeto mientras corre la primera puerta, la segunda recibe lo revisado", async () => {
    const { paquete, pedido } = preparar();
    const editable = { ...pedido, vista: structuredClone(pedido.vista) as unknown as Editable };
    const recibidos: string[] = [];
    const local: Generador = {
      puerta: "local",
      generar: (recibido) => {
        recibidos.push(JSON.stringify(recibido.vista));
        (editable.vista.hechos[2] as Record<string, unknown>).valor = "37911.47";
        return Promise.resolve({ ok: false, puerta: "local", motivo: "MODELO_NO_DISPONIBLE", detalle: "SIN_RESPUESTA" });
      },
    };
    const nube = crearGeneradorFalso({ puerta: "nube", conducta: { tipo: "RESPONDER", salidaCruda: "{}" } });
    await generarConPuertas([local, nube], "local-luego-nube", editable as unknown as PedidoGeneracion, paquete);
    expect(JSON.stringify(nube.llamadas()[0]?.vista)).toBe(recibidos[0]);
    expect(JSON.stringify(nube.llamadas()[0])).not.toContain("37911.47");
  });
});

describe("SEG-MEDIO-1 · el prompt y el esquema tampoco llevan datos del paquete", () => {
  const pedidoConPrompt = (pedido: PedidoGeneracion, texto: string): PedidoGeneracion => ({ ...pedido, prompt: { texto, version: pedido.prompt.version, hash: sha256Hex(texto) } });

  it.each([
    ["el nombre de una especie", `Resuma lo de ${ESPECIE_ALFA}.`],
    ["el nombre en minúsculas", `Resuma lo de ${ESPECIE_ALFA.toLowerCase()}.`],
    ["una presentación", "El valor es $ 37.911."],
    ["un valor", "El valor es 37911.47."],
    ["una fecha del paquete", "Al cierre del 2027-03-16."],
  ])("un prompt con %s: VISTA_NO_CIEGA (DATOS_EN_EL_PEDIDO) y nadie recibe la llamada", async (_caso, texto) => {
    const { paquete, pedido, falso } = preparar();
    const resultado = await generarConPuertas([falso], "local", pedidoConPrompt(pedido, texto), paquete);
    expect(resultado).toMatchObject({ estado: "VISTA_NO_CIEGA", ok: false });
    if (resultado.estado === "VISTA_NO_CIEGA") expect(resultado.codigos).toContain("DATOS_EN_EL_PEDIDO");
    expect(falso.llamadas()).toHaveLength(0);
  });

  it("un esquema con un nombre de especie o una presentación: VISTA_NO_CIEGA y nadie recibe la llamada", async () => {
    const { paquete, pedido, falso } = preparar();
    for (const esquemaSalida of [{ type: "object", enum: [ESPECIE_ALFA] }, { type: "object", description: "$ 37.911" }]) {
      const resultado = await generarConPuertas([falso], "local", { ...pedido, esquemaSalida }, paquete);
      expect(resultado).toMatchObject({ estado: "VISTA_NO_CIEGA" });
    }
    expect(falso.llamadas()).toHaveLength(0);
  });

  it("armarPedido tampoco arma un pedido con datos del paquete en el prompt o en el esquema", () => {
    const paquete = construirPaquete(entradaDiario());
    const conNombre = { paquete, prompt: { texto: `Hable de ${ESPECIE_ALFA}.`, version: "resumen-ficticio-v1" }, esquemaSalida: ESQUEMA_FICTICIO, limiteMs: LIMITE_FICTICIO_MS };
    expect(() => armarPedido(conNombre)).toThrow(ErrorVistaCiega);
    expect(() => armarPedido({ ...conNombre, prompt: PROMPT_FICTICIO, esquemaSalida: { type: "object", description: "$ 37.911" } })).toThrow(ErrorVistaCiega);
  });

  it("las cifras cortas propias del prompt no son una fuga (sin falsos positivos con valores de una o dos cifras)", async () => {
    const { paquete, pedido, falso } = preparar();
    const resultado = await generarConPuertas([falso], "local", pedidoConPrompt(pedido, "Escriba de una a seis frases, hasta 7 por resumen, con hechos-v1."), paquete);
    expect(resultado).toMatchObject({ estado: "EXITO" });
    expect(falso.llamadas()).toHaveLength(1);
  });
});

describe("SEG-MEDIO-2 · un Proxy en el pedido no cambia el texto después del hash", () => {
  it("revisarPedido rechaza un prompt o un pedido que sea Proxy", () => {
    const { pedido } = preparar();
    const promptProxy = proxyCambiante({ ...pedido.prompt }, "texto", `FILTRA ${ESPECIE_ALFA} $ 4.613`, 2);
    expect(() => revisarPedido({ ...pedido, prompt: promptProxy })).toThrow(ErrorPedido);
    expect(() => revisarPedido(new Proxy({ ...pedido }, {}))).toThrow(ErrorPedido);
  });

  it("generarConPuertas con un prompt Proxy lanza ErrorPedido y nadie recibe la llamada", async () => {
    const { paquete, pedido, falso } = preparar();
    const promptProxy = proxyCambiante({ ...pedido.prompt }, "texto", `FILTRA ${ESPECIE_ALFA}`, 2);
    await expect(generarConPuertas([falso], "local", { ...pedido, prompt: promptProxy }, paquete)).rejects.toBeInstanceOf(ErrorPedido);
    expect(falso.llamadas()).toHaveLength(0);
  });
});

describe("SEG-MEDIO-3 · un resultado que lanza al leerse no saca el mensaje del proveedor", () => {
  it("un Proxy que lanza en getPrototypeOf o en ownKeys da ERROR_PROVEEDOR sin el mensaje", async () => {
    for (const trampa of ["getPrototypeOf", "ownKeys", "getOwnPropertyDescriptor"] as const) {
      const { paquete, pedido } = preparar();
      const hostil = new Proxy({ ok: true }, { [trampa]: () => { throw new Error(`SECRETO-DEL-PROVEEDOR ${ESPECIE_ALFA}`); } });
      const generador: Generador = { puerta: "local", generar: () => Promise.resolve(hostil as unknown as ResultadoGeneracion) };
      const resultado = await generarConPuertas([generador], "local", pedido, paquete);
      expect(resultado, trampa).toEqual({ estado: "FALLO", ok: false, fallos: [{ ok: false, puerta: "local", motivo: "ERROR_PROVEEDOR", detalle: "RESULTADO_INVALIDO" }] });
      expect(JSON.stringify(resultado)).not.toContain("SECRETO");
    }
  });
});

describe("REV-M1 · latencia fraccionaria", () => {
  it("un éxito con latencia fraccionaria es un éxito, con la latencia redondeada", async () => {
    const { paquete, pedido } = preparar();
    const falso = crearGeneradorFalso({ puerta: "local", conducta: { tipo: "RESPONDER", salidaCruda: "{}", latenciaMs: 812.4 } });
    const resultado = await generarConPuertas([falso], "local", pedido, paquete);
    expect(resultado).toMatchObject({ estado: "EXITO", exito: { latenciaMs: 812 } });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -0.5])("una latencia %s sigue siendo inválida", async (latenciaMs) => {
    const { paquete, pedido } = preparar();
    const falso = crearGeneradorFalso({ puerta: "local", conducta: { tipo: "RESPONDER", salidaCruda: "{}", latenciaMs } });
    await expect(generarConPuertas([falso], "local", pedido, paquete)).resolves.toMatchObject({ estado: "FALLO", fallos: [{ detalle: "RESULTADO_INVALIDO" }] });
  });
});

describe("TIPOS-ALTO-1 y SEG-BAJO-2 · solo paquetes armados por construirPaquete", () => {
  it("esPaqueteConstruido reconoce los paquetes de construirPaquete y no sus copias", () => {
    const paquete = construirPaquete(entradaDiario());
    expect(esPaqueteConstruido(paquete)).toBe(true);
    expect(esPaqueteConstruido({ ...paquete })).toBe(false);
    expect(esPaqueteConstruido(structuredClone(paquete))).toBe(false);
    for (const otro of [null, undefined, "x", {}]) expect(esPaqueteConstruido(otro)).toBe(false);
  });

  it("una copia a mano del paquete, aunque su hash cuadre, no da vista ni pasa la guarda", async () => {
    const { paquete, pedido, falso } = preparar();
    const copia = { ...paquete };
    expect(() => vistaCiega(copia)).toThrow(ErrorVistaCiega);
    expect(fugasDeVistaCiega(pedido.vista, copia)).toContain("PAQUETE_NO_CONSTRUIDO");
    const resultado = await generarConPuertas([falso], "local", pedido, copia);
    expect(resultado).toMatchObject({ estado: "VISTA_NO_CIEGA" });
    expect(falso.llamadas()).toHaveLength(0);
  });
});

describe("TIPOS-MEDIO-4 · VISTA_NO_CIEGA lo pone solo el orquestador", () => {
  it("la lista de motivos de un generador no incluye VISTA_NO_CIEGA", () => {
    expect([...MOTIVOS_FALLO_GENERADOR]).toEqual(["MODELO_NO_DISPONIBLE", "TIEMPO_AGOTADO", "TOPE_MENSUAL", "PUERTA_APAGADA", "ERROR_PROVEEDOR"]);
    expect(Object.isFrozen(MOTIVOS_FALLO_GENERADOR)).toBe(true);
  });

  it("un generador que devuelve VISTA_NO_CIEGA da ERROR_PROVEEDOR (MOTIVO_DESCONOCIDO)", async () => {
    const { paquete, pedido } = preparar();
    const falso = crearGeneradorFalso({ puerta: "local", conducta: { tipo: "DEVOLVER", resultado: { ok: false, puerta: "local", motivo: "VISTA_NO_CIEGA", detalle: "X" } } });
    await expect(generarConPuertas([falso], "local", pedido, paquete)).resolves.toEqual({
      estado: "FALLO", ok: false, fallos: [{ ok: false, puerta: "local", motivo: "ERROR_PROVEEDOR", detalle: "MOTIVO_DESCONOCIDO" }],
    });
  });
});

describe("REV-BAJO-2 y TIPOS-MEDIO-6 · el modo apagado también pasa por la guarda", () => {
  it("apagado con una vista no ciega da VISTA_NO_CIEGA, no APAGADO", async () => {
    const { paquete, pedido, falso } = preparar();
    const hechos = hechosEditables(pedido);
    (hechos[2] as Record<string, unknown>).valor = "37911.47";
    const resultado = await generarConPuertas([falso], "apagado", conVista(pedido, { tipo: "DIARIO", hechos }), paquete);
    expect(resultado).toMatchObject({ estado: "VISTA_NO_CIEGA", ok: false, motivo: "VISTA_NO_CIEGA" });
    expect(falso.llamadas()).toHaveLength(0);
  });
});
