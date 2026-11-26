// El análisis a demanda del servicio inv-008-ia («Analizar con IA»): las condiciones de PI, cada una con su prueba.
//  - interruptor de config_ia (apagado por omisión: falla cerrada);
//  - como máximo 1 en curso y 1 en espera: los demás se descartan (OCUPADO);
//  - mínimo de 2 minutos entre análisis, en total y no por tarea (ESPERA_MINIMA con cuándo se puede);
//  - un pedido a la vez hacia el modelo (el que espera arranca cuando termina el que corre, y pasados los 2 minutos);
//  - un registro por llamada (inicio, fin, tarea, modelo y ms), sin cifras del portafolio.
// Reloj, temporizador y corrida son dobles: nada de base ni de red. Datos inventados.
import { describe, expect, it, vi } from "vitest";
import type { ConfigIaVigente } from "@/ia/config/leer";
import type { TipoResumen } from "@/ia/contrato";
import { ESPERA_MINIMA_MS, crearAnalisisDemanda, type DependenciasAnalisis } from "@/servicio-ia/analisis";
import type { EstadoTipo } from "@/servicio-ia/corrida";
import { VIGENTE_FICTICIA } from "../ia/config/apoyo/config.ficticio";

const T0 = Date.parse("2027-03-17T15:00:00.000Z");
const ENCENDIDA: ConfigIaVigente = { ...VIGENTE_FICTICIA, modo: "local", analisisDemanda: true };

interface Corrida {
  readonly tarea: TipoResumen;
  terminar(estado?: EstadoTipo): void;
  fallar(): void;
}

function montar(config: ConfigIaVigente | null = ENCENDIDA) {
  let ahora = T0;
  let vigente = config;
  const corridas: Corrida[] = [];
  const lineas: string[] = [];
  const temporizadores: { readonly ms: number; readonly accion: () => void }[] = [];
  let activas = 0;
  let maximoSimultaneas = 0;
  const deps: DependenciasAnalisis = {
    leerConfig: async () => vigente,
    correr: (_config, tarea) =>
      new Promise<EstadoTipo>((resolver, rechazar) => {
        activas += 1;
        maximoSimultaneas = Math.max(maximoSimultaneas, activas);
        corridas.push({
          tarea,
          terminar: (estado = "PUBLICADO") => { activas -= 1; resolver(estado); },
          fallar: () => { activas -= 1; rechazar(Object.assign(new Error("valor-real-4613"), { code: "P1001" })); },
        });
      }),
    ahora: () => ahora,
    programar: (accion, ms) => void temporizadores.push({ ms, accion }),
    registrar: (m) => void lineas.push(m),
  };
  const analisis = crearAnalisisDemanda(deps);
  const avanzar = (ms: number) => { ahora += ms; };
  const asentar = async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve(); };
  return { analisis, corridas, lineas, temporizadores, avanzar, asentar, cambiarConfig: (c: ConfigIaVigente | null) => { vigente = c; }, simultaneas: () => maximoSimultaneas };
}

describe("el interruptor de config_ia (falla cerrada)", () => {
  it.each([
    ["sin configuración", null],
    ["con el interruptor apagado (el valor de omisión)", { ...ENCENDIDA, analisisDemanda: false }],
    ["con la IA en modo apagado", { ...ENCENDIDA, modo: "apagado" as const }],
  ])("%s: APAGADO y no corre nada", async (_n, config) => {
    const m = montar(config);
    expect(await m.analisis.pedir("DIARIO")).toEqual({ ok: false, motivo: "APAGADO" });
    expect(m.corridas).toHaveLength(0);
    expect(m.lineas).toHaveLength(0);
  });

  it("una tarea inactiva en la configuración: TAREA_INACTIVA", async () => {
    const m = montar();
    expect(await m.analisis.pedir("ESCENARIOS")).toEqual({ ok: false, motivo: "TAREA_INACTIVA" });
    expect(m.corridas).toHaveLength(0);
  });

  it("lee la configuración en cada pedido: apagarla desde la pantalla vale sin reiniciar", async () => {
    const m = montar();
    m.cambiarConfig({ ...ENCENDIDA, analisisDemanda: false });
    expect(await m.analisis.pedir("DIARIO")).toEqual({ ok: false, motivo: "APAGADO" });
  });
});

describe("1 en curso y 1 en espera", () => {
  it("el primero corre; el segundo espera; el tercero se descarta (OCUPADO) y no corre nada", async () => {
    const m = montar();
    expect(await m.analisis.pedir("DIARIO")).toEqual({ ok: true, lugar: "EN_CURSO" });
    expect(await m.analisis.pedir("REGLAS")).toEqual({ ok: true, lugar: "EN_ESPERA" });
    expect(await m.analisis.pedir("DIARIO")).toEqual({ ok: false, motivo: "OCUPADO" });
    expect(await m.analisis.pedir("REGLAS")).toEqual({ ok: false, motivo: "OCUPADO" });
    expect(m.corridas.map((c) => c.tarea)).toEqual(["DIARIO"]);
    expect(m.analisis.estado()).toMatchObject({ enCurso: "DIARIO", enEspera: "REGLAS" });
  });

  it("un pedido a la vez hacia el modelo: el que espera no arranca mientras corre el otro, y arranca pasados los 2 minutos", async () => {
    const m = montar();
    await m.analisis.pedir("DIARIO");
    await m.analisis.pedir("REGLAS");
    expect(m.simultaneas()).toBe(1);
    m.avanzar(15_000);
    m.corridas[0]!.terminar();
    await m.asentar();
    // Terminó el primero: el segundo queda programado para cuando se cumpla la espera mínima, no antes.
    expect(m.corridas).toHaveLength(1);
    expect(m.temporizadores).toHaveLength(1);
    expect(m.temporizadores[0]!.ms).toBe(ESPERA_MINIMA_MS);
    expect(m.analisis.estado()).toMatchObject({ enCurso: null, enEspera: "REGLAS" });
    m.avanzar(ESPERA_MINIMA_MS);
    m.temporizadores[0]!.accion();
    await m.asentar();
    expect(m.corridas.map((c) => c.tarea)).toEqual(["DIARIO", "REGLAS"]);
    expect(m.analisis.estado()).toMatchObject({ enCurso: "REGLAS", enEspera: null });
    m.corridas[1]!.terminar();
    await m.asentar();
    expect(m.simultaneas()).toBe(1);
  });

  it("mientras el segundo espera su turno (ya sin nada en curso), otro clic se descarta", async () => {
    const m = montar();
    await m.analisis.pedir("DIARIO");
    await m.analisis.pedir("REGLAS");
    m.corridas[0]!.terminar();
    await m.asentar();
    expect(await m.analisis.pedir("DIARIO")).toEqual({ ok: false, motivo: "OCUPADO" });
  });

  it("si el interruptor se apaga mientras el segundo espera, no arranca", async () => {
    const m = montar();
    await m.analisis.pedir("DIARIO");
    await m.analisis.pedir("REGLAS");
    m.corridas[0]!.terminar();
    await m.asentar();
    m.cambiarConfig({ ...ENCENDIDA, analisisDemanda: false });
    m.avanzar(ESPERA_MINIMA_MS);
    m.temporizadores[0]!.accion();
    await m.asentar();
    expect(m.corridas).toHaveLength(1);
    expect(m.analisis.estado()).toMatchObject({ enCurso: null, enEspera: null });
  });
});

describe("la espera que arranca (carrera con un pedido nuevo)", () => {
  it("mientras el que espera lee la configuración, un pedido nuevo NO arranca otro: queda en espera y solo corre uno", async () => {
    let ahora = T0;
    const corridas: { terminar(): void }[] = [];
    const lineas: string[] = [];
    const temporizadores: (() => void)[] = [];
    let soltarConfig: (c: ConfigIaVigente) => void = () => undefined;
    let lecturas = 0;
    let activas = 0;
    let maximo = 0;
    const analisis = crearAnalisisDemanda({
      leerConfig: () => (++lecturas !== 3 ? Promise.resolve(ENCENDIDA) : new Promise((r) => { soltarConfig = r; })),
      correr: () => new Promise<EstadoTipo>((resolver) => { activas += 1; maximo = Math.max(maximo, activas); corridas.push({ terminar: () => { activas -= 1; resolver("PUBLICADO"); } }); }),
      ahora: () => ahora, programar: (a) => void temporizadores.push(a), registrar: (m) => void lineas.push(m),
    });
    await analisis.pedir("DIARIO");
    await analisis.pedir("REGLAS");
    corridas[0]!.terminar();
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
    ahora += ESPERA_MINIMA_MS;
    temporizadores[0]!();
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
    // El que espera está leyendo la configuración (tercera lectura, pendiente): entra un pedido nuevo.
    const intruso = analisis.pedir("DIARIO");
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
    soltarConfig(ENCENDIDA);
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
    // El lugar ya estaba reservado: el nuevo pasa a esperar, no arranca.
    expect(await intruso).toEqual({ ok: true, lugar: "EN_ESPERA" });
    expect(maximo).toBe(1);
  });

  it("si al arrancar el que espera la configuración ya no lo permite, queda registrado (no se pierde en silencio) y el servicio sigue libre", async () => {
    const m = montar();
    await m.analisis.pedir("DIARIO");
    await m.analisis.pedir("REGLAS");
    m.corridas[0]!.terminar();
    await m.asentar();
    m.cambiarConfig({ ...ENCENDIDA, analisisDemanda: false });
    m.avanzar(ESPERA_MINIMA_MS);
    m.temporizadores[0]!.accion();
    await m.asentar();
    expect(m.lineas.some((l) => l.includes("tarea=REGLAS") && l.includes("estado=DESCARTADO"))).toBe(true);
    expect(m.analisis.estado()).toMatchObject({ enCurso: null, enEspera: null });
  });

  it("un registrar que lanza no deja el servicio atascado: la espera igual se programa", async () => {
    let ahora = T0;
    const temporizadores: (() => void)[] = [];
    const corridas: { terminar(): void }[] = [];
    const analisis = crearAnalisisDemanda({
      leerConfig: async () => ENCENDIDA,
      correr: () => new Promise<EstadoTipo>((r) => void corridas.push({ terminar: () => r("PUBLICADO") })),
      ahora: () => ahora, programar: (a) => void temporizadores.push(a), registrar: () => { throw new Error("log caído"); },
    });
    await analisis.pedir("DIARIO");
    await analisis.pedir("REGLAS");
    corridas[0]!.terminar();
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
    expect(temporizadores).toHaveLength(1);
    expect(analisis.estado().enCurso).toBeNull();
    ahora += 1;
  });

  it("el nombre del modelo que no tiene la forma de siempre no va crudo al registro", async () => {
    const m = montar({ ...ENCENDIDA, tareas: { ...ENCENDIDA.tareas, DIARIO: { activo: true, modeloLocal: "falso\nlinea=inventada" } } });
    await m.analisis.pedir("DIARIO");
    m.corridas[0]!.terminar();
    await m.asentar();
    expect(m.lineas[0]).toContain("modelo=MODELO_INVALIDO");
    expect(m.lineas[0]).not.toContain("inventada");
  });
});

describe("mínimo de 2 minutos entre análisis, en total y no por tarea", () => {
  it("la espera es de 120 s", () => {
    expect(ESPERA_MINIMA_MS).toBe(120_000);
  });

  it("después de uno, otro (de CUALQUIER tarea) antes de 2 minutos: ESPERA_MINIMA con los segundos que faltan", async () => {
    const m = montar();
    await m.analisis.pedir("DIARIO");
    m.avanzar(30_000);
    m.corridas[0]!.terminar();
    await m.asentar();
    m.avanzar(45_000);
    expect(await m.analisis.pedir("REGLAS")).toEqual({ ok: false, motivo: "ESPERA_MINIMA", reintentarEnS: 75 });
    expect(await m.analisis.pedir("DIARIO")).toEqual({ ok: false, motivo: "ESPERA_MINIMA", reintentarEnS: 75 });
    expect(m.corridas).toHaveLength(1);
    expect(m.analisis.estado().reintentarEnS).toBe(75);
  });

  it("se cuenta desde que TERMINÓ el anterior; cumplidos los 120 s, el siguiente corre", async () => {
    const m = montar();
    await m.analisis.pedir("DIARIO");
    m.avanzar(50_000);
    m.corridas[0]!.terminar();
    await m.asentar();
    m.avanzar(ESPERA_MINIMA_MS - 1);
    expect((await m.analisis.pedir("REGLAS")).ok).toBe(false);
    m.avanzar(1);
    expect(await m.analisis.pedir("REGLAS")).toEqual({ ok: true, lugar: "EN_CURSO" });
  });

  it("un análisis que falló (la corrida lanzó) también cuenta: el modelo se usó", async () => {
    const m = montar();
    await m.analisis.pedir("DIARIO");
    m.corridas[0]!.fallar();
    await m.asentar();
    expect(await m.analisis.pedir("DIARIO")).toMatchObject({ ok: false, motivo: "ESPERA_MINIMA" });
    expect(m.analisis.estado().ultimo).toEqual({ tarea: "DIARIO", estado: "ERROR" });
  });
});

describe("un registro por llamada, sin cifras del portafolio", () => {
  it("una sola línea al terminar, con la tarea, el modelo, el inicio, el fin y los ms", async () => {
    const m = montar();
    await m.analisis.pedir("DIARIO");
    expect(m.lineas).toHaveLength(0);
    m.avanzar(4613);
    m.corridas[0]!.terminar("PUBLICADO");
    await m.asentar();
    expect(m.lineas).toHaveLength(1);
    expect(m.lineas[0]).toBe("análisis a demanda · tarea=DIARIO · modelo=qwen2.5:14b · inicio=2027-03-17T15:00:00.000Z · fin=2027-03-17T15:00:04.613Z · ms=4613 · estado=PUBLICADO");
  });

  it("una corrida que lanza queda en el registro con ERROR y su código, nunca el mensaje (que podría traer datos)", async () => {
    const m = montar();
    await m.analisis.pedir("REGLAS");
    m.corridas[0]!.fallar();
    await m.asentar();
    expect(m.lineas).toHaveLength(1);
    expect(m.lineas[0]).toContain("estado=ERROR");
    expect(m.lineas[0]).toContain("código=P1001");
    expect(m.lineas.join("\n")).not.toContain("valor-real-4613");
  });

  it("los pedidos descartados no escriben registro (no hubo llamada)", async () => {
    const m = montar();
    await m.analisis.pedir("DIARIO");
    await m.analisis.pedir("REGLAS");
    await m.analisis.pedir("DIARIO");
    expect(m.lineas).toHaveLength(0);
  });
});

describe("estado", () => {
  it("sin nada en curso: libre y sin último; después de uno, trae cómo terminó", async () => {
    const m = montar();
    expect(m.analisis.estado()).toEqual({ enCurso: null, enEspera: null, reintentarEnS: 0, ultimo: null });
    await m.analisis.pedir("DIARIO");
    m.corridas[0]!.terminar("YA_PUBLICADO");
    await m.asentar();
    expect(m.analisis.estado().ultimo).toEqual({ tarea: "DIARIO", estado: "YA_PUBLICADO" });
  });

  it("el estado es un valor congelado: quien lo lee no puede alterar el del servicio", async () => {
    const m = montar();
    expect(Object.isFrozen(m.analisis.estado())).toBe(true);
  });
});

describe("la lectura de la configuración falla", () => {
  it("si la base no responde, el pedido lanza (el servidor lo vuelve un 500 sin mensaje) y no queda nada en curso", async () => {
    const lanza = vi.fn(async () => { throw new Error("base caída"); });
    const analisis = crearAnalisisDemanda({ leerConfig: lanza, correr: vi.fn(), ahora: () => T0, programar: vi.fn(), registrar: vi.fn() });
    await expect(analisis.pedir("DIARIO")).rejects.toThrow();
    expect(analisis.estado()).toMatchObject({ enCurso: null, enEspera: null });
  });
});
