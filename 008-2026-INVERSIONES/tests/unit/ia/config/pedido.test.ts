/**
 * Lo que manda el formulario de /edicion/ia, leído en el servidor (`leerPedidoConfig`): claves exactas, cada campo con
 * su forma y su lista cerrada, y las reglas de cada modo. La lista de modelos locales es la que publica PI (inyectada):
 * sin ella, ningún modelo local se puede elegir. Los errores llevan solo el campo y un código, nunca el valor. El
 * destino: solo su FORMATO (una IPv4 de la tailnet y un puerto); el control de seguridad está en la red de PI.
 */
import { describe, expect, it } from "vitest";
import { leerPedidoConfig, MAX_CUERPO_CONFIG_IA, type LecturaConfig } from "@/ia/config/pedido";
import { cuerpoFicticio, HOST_FICTICIO, ip, LISTA_FICTICIA, PUERTO_FICTICIO, SIN_LISTA } from "./apoyo/config.ficticio";

const errores = (r: LecturaConfig) => (r.ok ? [] : r.errores);

describe("leerPedidoConfig · control positivo", () => {
  it("una versión con la local y la nube: todo leído y convertido", () => {
    const r = leerPedidoConfig(cuerpoFicticio(), LISTA_FICTICIA);
    expect(r).toEqual({
      ok: true,
      versionBase: 7,
      valor: {
        modo: "local-luego-nube",
        ollamaHost: HOST_FICTICIO,
        ollamaPuerto: PUERTO_FICTICIO,
        temperaturaCentesimas: 0,
        tareas: { DIARIO: { activo: true, modeloLocal: "qwen2.5:14b" }, REGLAS: { activo: true, modeloLocal: "gemma2:27b" }, ESCENARIOS: { activo: false, modeloLocal: null } },
        modeloNube: "claude-sonnet-5-5",
        esfuerzoNube: "medium",
        topeMicroUsd: 4_610_000n,
        horaResumen: "19:00",
        limiteSegundos: 97,
        motivo: "Cambio ficticio de la configuración",
      },
    });
  });

  it("apagada sin destino, sin tope y sin lista de PI: se puede guardar", () => {
    const r = leerPedidoConfig(cuerpoFicticio({
      modo: "apagado", ollamaHost: "", ollamaPuerto: "", topeMensualUsd: "",
      tareas: { DIARIO: { activo: true, modeloLocal: "" }, REGLAS: { activo: false, modeloLocal: "" }, ESCENARIOS: { activo: false, modeloLocal: "" } },
    }), SIN_LISTA);
    expect(r).toMatchObject({ ok: true, valor: { modo: "apagado", ollamaHost: null, ollamaPuerto: null, topeMicroUsd: null } });
  });

  it("la temperatura y el tope aceptan coma o punto; los bordes entran", () => {
    for (const [t, c] of [["0,37", 37], ["0.05", 5], ["1", 100], ["1,00", 100], ["0", 0]] as const) {
      expect(leerPedidoConfig(cuerpoFicticio({ temperatura: t }), LISTA_FICTICIA)).toMatchObject({ ok: true, valor: { temperaturaCentesimas: c } });
    }
    for (const [t, m] of [["1", 1_000_000n], ["50", 50_000_000n], ["12,5", 12_500_000n], ["49.99", 49_990_000n]] as const) {
      expect(leerPedidoConfig(cuerpoFicticio({ topeMensualUsd: t }), LISTA_FICTICIA)).toMatchObject({ ok: true, valor: { topeMicroUsd: m } });
    }
    for (const l of ["10", "120"]) expect(leerPedidoConfig(cuerpoFicticio({ limiteSegundos: l }), LISTA_FICTICIA).ok).toBe(true);
  });

  it("el tope de bytes del cuerpo es chico (cabe el motivo largo y lo demás)", () => {
    expect(MAX_CUERPO_CONFIG_IA).toBeGreaterThan(7919);
    expect(MAX_CUERPO_CONFIG_IA).toBeLessThan(20_000);
  });
});

describe("leerPedidoConfig · cada error con su campo y su código", () => {
  it.each([
    ["un cuerpo que no es objeto", null, [{ campo: "cuerpo", codigo: "FORMATO_INVALIDO" }]],
    ["una clave de más (p. ej. la llave)", cuerpoFicticio({ llave: "sk-ficticia" }), [{ campo: "cuerpo", codigo: "FORMATO_INVALIDO" }]],
    ["una clave que falta", (() => { const c = cuerpoFicticio(); delete c.motivo; return c; })(), [{ campo: "cuerpo", codigo: "FORMATO_INVALIDO" }]],
  ])("%s", (_n, cuerpo, esperado) => {
    expect(errores(leerPedidoConfig(cuerpo, LISTA_FICTICIA))).toEqual(esperado);
  });

  it.each([
    ["modo", { modo: "nube-luego-local" }, "MODO_INVALIDO"],
    ["modeloNube", { modeloNube: "claude-opus-5" }, "MODELO_NUBE_INVALIDO"],
    ["esfuerzoNube", { esfuerzoNube: "high" }, "ESFUERZO_INVALIDO"],
    ["horaResumen", { horaResumen: "19:30" }, "HORA_INVALIDA"],
    ["limiteSegundos", { limiteSegundos: "9" }, "LIMITE_INVALIDO"],
    ["limiteSegundos", { limiteSegundos: "121" }, "LIMITE_INVALIDO"],
    ["limiteSegundos", { limiteSegundos: "97,5" }, "LIMITE_INVALIDO"],
    ["temperatura", { temperatura: "1,01" }, "TEMPERATURA_INVALIDA"],
    ["temperatura", { temperatura: "-0,1" }, "TEMPERATURA_INVALIDA"],
    ["temperatura", { temperatura: "0,375" }, "TEMPERATURA_INVALIDA"],
    ["temperatura", { temperatura: "" }, "TEMPERATURA_INVALIDA"],
    ["topeMensualUsd", { topeMensualUsd: "0,99" }, "TOPE_FUERA_DE_RANGO"],
    ["topeMensualUsd", { topeMensualUsd: "50,01" }, "TOPE_FUERA_DE_RANGO"],
    ["topeMensualUsd", { topeMensualUsd: "5,555" }, "TOPE_INVALIDO"],
    ["topeMensualUsd", { topeMensualUsd: "cinco" }, "TOPE_INVALIDO"],
    ["topeMensualUsd", { topeMensualUsd: "" }, "TOPE_FALTA"],
    ["motivo", { motivo: "   " }, "VACIO"],
    ["motivo", { motivo: "m".repeat(2001) }, "DEMASIADO_LARGO"],
    ["motivo", { motivo: "con\u0000nulo" }, "FORMATO_INVALIDO"],
    ["versionBase", { versionBase: -1 }, "FORMATO_INVALIDO"],
    ["versionBase", { versionBase: "7" }, "FORMATO_INVALIDO"],
  ])("%s · %j → %s", (campo, cambios, codigo) => {
    expect(errores(leerPedidoConfig(cuerpoFicticio(cambios), LISTA_FICTICIA))).toContainEqual({ campo, codigo });
  });

  it.each([
    ["un nombre DNS", { ollamaHost: "ollama.ficticio" }, "ollamaHost", "DESTINO_INVALIDO"],
    ["una IP privada", { ollamaHost: ip(192, 168, 41, 7) }, "ollamaHost", "DESTINO_FUERA_DE_FORMATO"],
    ["el bucle local", { ollamaHost: ip(127, 0, 0, 1) }, "ollamaHost", "DESTINO_FUERA_DE_FORMATO"],
    ["una IP pública", { ollamaHost: ip(8, 8, 4, 4) }, "ollamaHost", "DESTINO_FUERA_DE_FORMATO"],
    ["un host con puerto adentro", { ollamaHost: `${HOST_FICTICIO}:1` }, "ollamaHost", "DESTINO_INVALIDO"],
    ["un puerto 0", { ollamaPuerto: "0" }, "ollamaPuerto", "DESTINO_INVALIDO"],
    ["un puerto de más", { ollamaPuerto: "65536" }, "ollamaPuerto", "DESTINO_INVALIDO"],
    ["un puerto con letras", { ollamaPuerto: "47213a" }, "ollamaPuerto", "DESTINO_INVALIDO"],
    ["host sin puerto", { ollamaPuerto: "" }, "ollamaPuerto", "DESTINO_INCOMPLETO"],
    ["puerto sin host", { ollamaHost: "" }, "ollamaHost", "DESTINO_INCOMPLETO"],
  ])("el destino: %s → %s · %s", (_n, cambios, campo, codigo) => {
    expect(errores(leerPedidoConfig(cuerpoFicticio(cambios), LISTA_FICTICIA))).toContainEqual({ campo, codigo });
  });

  it("los errores nunca repiten el valor recibido", () => {
    const r = leerPedidoConfig(cuerpoFicticio({ ollamaHost: "ollama.ficticio", motivo: "  ", topeMensualUsd: "cuatro mil" }), LISTA_FICTICIA);
    expect(JSON.stringify(r)).not.toMatch(/ollama\.ficticio|cuatro mil/);
  });
});

describe("leerPedidoConfig · reglas de cada modo y la lista de PI", () => {
  it("la local sin destino: DESTINO_FALTA", () => {
    expect(errores(leerPedidoConfig(cuerpoFicticio({ ollamaHost: "", ollamaPuerto: "" }), LISTA_FICTICIA))).toContainEqual({ campo: "ollamaHost", codigo: "DESTINO_FALTA" });
  });

  it("la local con una tarea activa sin modelo: MODELO_LOCAL_FALTA en esa tarea", () => {
    const tareas = { DIARIO: { activo: true, modeloLocal: "" }, REGLAS: { activo: false, modeloLocal: "" }, ESCENARIOS: { activo: false, modeloLocal: "" } };
    expect(errores(leerPedidoConfig(cuerpoFicticio({ tareas }), LISTA_FICTICIA))).toContainEqual({ campo: "tareas.DIARIO.modeloLocal", codigo: "MODELO_LOCAL_FALTA" });
  });

  it("un modelo que no está en la lista de PI en una tarea activa con la local: MODELO_FUERA_DE_LISTA", () => {
    const tareas = { DIARIO: { activo: true, modeloLocal: "qwen2.5:32b" }, REGLAS: { activo: false, modeloLocal: "" }, ESCENARIOS: { activo: false, modeloLocal: "" } };
    expect(errores(leerPedidoConfig(cuerpoFicticio({ tareas }), LISTA_FICTICIA))).toContainEqual({ campo: "tareas.DIARIO.modeloLocal", codigo: "MODELO_FUERA_DE_LISTA" });
  });

  // Revisión (código, M2): si PI retira un modelo o falta la lista, el dueño igual puede apagar la IA o pasar a la nube
  // sin vaciar a mano cada tarea: la pertenencia se exige solo donde la local lo va a usar.
  it("un modelo viejo fuera de la lista en una tarea inactiva, o con un modo sin la local, no impide guardar", () => {
    const tareas = { DIARIO: { activo: true, modeloLocal: "ornith:9b" }, REGLAS: { activo: false, modeloLocal: "ornith:9b" }, ESCENARIOS: { activo: false, modeloLocal: "" } };
    expect(leerPedidoConfig(cuerpoFicticio({ modo: "nube", tareas }), LISTA_FICTICIA)).toMatchObject({ ok: true, valor: { tareas: { DIARIO: { modeloLocal: "ornith:9b" } } } });
    expect(leerPedidoConfig(cuerpoFicticio({ modo: "apagado", tareas }), SIN_LISTA).ok).toBe(true);
    const conLocal = { ...tareas, DIARIO: { activo: true, modeloLocal: "qwen2.5:14b" } };
    expect(leerPedidoConfig(cuerpoFicticio({ tareas: conLocal }), LISTA_FICTICIA).ok).toBe(true);
  });

  it("un modelo con otra forma (registro, mayúsculas) es FORMATO_INVALIDO en cualquier tarea y modo", () => {
    const tareas = { DIARIO: { activo: false, modeloLocal: "registro/Qwen:14B" }, REGLAS: { activo: false, modeloLocal: "" }, ESCENARIOS: { activo: false, modeloLocal: "" } };
    expect(errores(leerPedidoConfig(cuerpoFicticio({ modo: "apagado", tareas }), LISTA_FICTICIA))).toContainEqual({ campo: "tareas.DIARIO.modeloLocal", codigo: "FORMATO_INVALIDO" });
  });

  it("sin lista de PI, ningún modelo local: SIN_LISTA_DE_PI en el modo y en cada modelo elegido", () => {
    const e = errores(leerPedidoConfig(cuerpoFicticio(), SIN_LISTA));
    expect(e).toContainEqual({ campo: "modo", codigo: "SIN_LISTA_DE_PI" });
    expect(e).toContainEqual({ campo: "tareas.DIARIO.modeloLocal", codigo: "SIN_LISTA_DE_PI" });
  });

  it("la nube sin tope: TOPE_FALTA (sin tope, la nube no corre)", () => {
    expect(errores(leerPedidoConfig(cuerpoFicticio({ modo: "nube", topeMensualUsd: "" }), LISTA_FICTICIA))).toEqual([{ campo: "topeMensualUsd", codigo: "TOPE_FALTA" }]);
  });

  it("solo la local con su lista: un tope vacío no estorba; con la nube apagada, el tope escrito igual se revisa", () => {
    expect(leerPedidoConfig(cuerpoFicticio({ modo: "local", topeMensualUsd: "" }), LISTA_FICTICIA).ok).toBe(true);
    expect(errores(leerPedidoConfig(cuerpoFicticio({ modo: "local", topeMensualUsd: "51" }), LISTA_FICTICIA))).toContainEqual({ campo: "topeMensualUsd", codigo: "TOPE_FUERA_DE_RANGO" });
  });

  it.each([
    ["una tarea de más", { DIARIO: { activo: true, modeloLocal: "" }, REGLAS: { activo: true, modeloLocal: "" }, ESCENARIOS: { activo: true, modeloLocal: "" }, OPERAR: { activo: true, modeloLocal: "" } }],
    ["una tarea que falta", { DIARIO: { activo: true, modeloLocal: "" }, REGLAS: { activo: true, modeloLocal: "" } }],
    ["«activo» que no es booleano", { DIARIO: { activo: "sí", modeloLocal: "" }, REGLAS: { activo: true, modeloLocal: "" }, ESCENARIOS: { activo: true, modeloLocal: "" } }],
    ["un campo de más en la tarea", { DIARIO: { activo: true, modeloLocal: "", temperatura: 1 }, REGLAS: { activo: true, modeloLocal: "" }, ESCENARIOS: { activo: true, modeloLocal: "" } }],
  ])("las tareas: %s → FORMATO_INVALIDO", (_n, tareas) => {
    expect(errores(leerPedidoConfig(cuerpoFicticio({ modo: "apagado", tareas }), LISTA_FICTICIA))).toContainEqual({ campo: "tareas", codigo: "FORMATO_INVALIDO" });
  });
});
