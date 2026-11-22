// Bucle y corridas del servicio inv-008-precios (D-018): de lunes a viernes a las 18:00 COT, una vez al día, precios y
// luego fondo, sin reintentos; latido cada minuto aun durante la corrida; sin el secreto NO se cae (queda en espera);
// --ahora [--desde] para la carga histórica. Reloj, corredor y temporizador falsos; huella en una carpeta temporal.
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { SALIDA, TIC_MS, correrAhora, corridaRegistrada, crearBucle, type Dependencias } from "../../../src/servicio-precios/bucle";
import { hacerCorrida, resultadoDe } from "../../../src/servicio-precios/corrida";
import { leerClaveValor } from "../../../src/servicio-precios/estado";
import type { Corredor, ResultadoTarea, Tarea } from "../../../src/servicio-precios/tareas";

const cot = (texto: string): number => new Date(`${texto.replace(" ", "T")}:00-05:00`).getTime();
const seg = (ms: number): string => String(Math.floor(ms / 1000));
const carpeta = (): string => mkdtempSync(path.join(tmpdir(), "inv-008-precios-bucle-"));
const leer = (dir: string, nombre: string): Record<string, string> => leerClaveValor(readFileSync(path.join(dir, nombre), "utf8"));

type Llamada = { tarea: Tarea; args: readonly string[]; plazoMs: number };

/** Corredor falso: responde con los códigos dados; `retener` deja la tarea abierta hasta soltarla. */
function corredorFalso(codigos: Partial<Record<Tarea, string>> = {}, opciones: { retener?: boolean; alCorrer?: () => void } = {}) {
  const llamadas: Llamada[] = [];
  let detenido = 0;
  let soltar: () => void = () => undefined;
  const corredor: Corredor = {
    async correr(tarea, args, plazoMs) {
      // Como el corredor real: detenido, una tarea nueva no arranca.
      if (detenido > 0) return { tarea, codigo: "DETENIDO", duracionMs: 0 };
      llamadas.push({ tarea, args, plazoMs });
      opciones.alCorrer?.();
      if (opciones.retener) await new Promise<void>((ok) => (soltar = ok));
      return { tarea, codigo: codigos[tarea] ?? "0", duracionMs: 1237 } satisfies ResultadoTarea;
    },
    detener() {
      detenido += 1;
      soltar();
    },
  };
  return { corredor, llamadas, detenidos: () => detenido, soltar: () => soltar() };
}

function dependencias(extra: Partial<Dependencias> & { inicio?: number } = {}) {
  let t = extra.inicio ?? cot("2027-01-08 17:58");
  const mensajes: string[] = [];
  const programados: Array<{ fn: () => void; ms: number; cancelado: boolean }> = [];
  const falso = corredorFalso();
  const deps: Dependencias = {
    dir: carpeta(),
    ahora: () => t,
    registrar: (m) => mensajes.push(m),
    corredor: falso.corredor,
    credencial: { ok: true },
    programar: (fn, ms) => {
      const p = { fn, ms, cancelado: false };
      programados.push(p);
      return () => (p.cancelado = true);
    },
    ...extra,
  };
  return { deps, mensajes, programados, falso, ir: (texto: string) => (t = cot(texto)), adelantar: (ms: number) => (t += ms) };
}

/** Espera a que se cumpla una condición (la corrida corre sin bloquear el tic y escribe en disco). */
const hasta = (condicion: () => boolean): Promise<void> =>
  vi.waitFor(
    () => {
      if (!condicion()) throw new Error("todavía no");
    },
    { timeout: 5_000, interval: 5 },
  );

describe("resultadoDe y hacerCorrida", () => {
  const t = (precios: string, fondo: string): ResultadoTarea[] => [
    { tarea: "precios", codigo: precios, duracionMs: 1 },
    { tarea: "fondo", codigo: fondo, duracionMs: 1 },
  ];

  for (const [precios, fondo, esperado] of [
    ["0", "0", "OK"],
    ["0", "3", "AVISO"],
    ["3", "3", "AVISO"],
    ["1", "0", "FALLO"],
    ["0", "2", "FALLO"],
    ["TIEMPO", "0", "FALLO"],
    ["3", "SENAL_SIGKILL", "FALLO"],
    ["NO_ARRANCO", "0", "FALLO"],
    ["0", "DETENIDO", "FALLO"],
  ] as const) {
    it(`precios ${precios} y fondo ${fondo} → ${esperado} (el peor de los dos)`, () => {
      expect(resultadoDe(t(precios, fondo))).toBe(esperado);
    });
  }

  it("corre precios y LUEGO fondo, cada uno con su plazo; fondo corre aunque precios falle; código de salida 0 · 3 · 1", async () => {
    const f = corredorFalso({ precios: "1", fondo: "0" });
    const r = await hacerCorrida(f.corredor, null, 4613);
    expect(f.llamadas).toEqual([
      { tarea: "precios", args: [], plazoMs: 4613 },
      { tarea: "fondo", args: [], plazoMs: 4613 },
    ]);
    expect(r).toMatchObject({ resultado: "FALLO", codigoSalida: 1 });
    expect((await hacerCorrida(corredorFalso({ fondo: "3" }).corredor, null)).codigoSalida).toBe(3);
    expect((await hacerCorrida(corredorFalso().corredor, null)).codigoSalida).toBe(0);
  });

  it("con --desde, las dos tareas lo reciben; por defecto, el plazo de 15 minutos", async () => {
    const f = corredorFalso();
    await hacerCorrida(f.corredor, "2019-08-23");
    expect(f.llamadas.map((l) => [l.tarea, l.args, l.plazoMs])).toEqual([
      ["precios", ["--desde", "2019-08-23"], 15 * 60_000],
      ["fondo", ["--desde", "2019-08-23"], 15 * 60_000],
    ]);
  });
});

describe("corridaRegistrada · candado y huella de la última corrida", () => {
  it("deja ultima-corrida (modo, desde, resultado, inicio, fin, códigos) y suelta el candado", async () => {
    const { deps, mensajes, adelantar } = dependencias();
    const f = corredorFalso({ fondo: "3" }, { alCorrer: () => adelantar(1_237) });
    const inicio = deps.ahora();
    const r = await corridaRegistrada({ ...deps, corredor: f.corredor }, "ahora", "2019-08-23");
    expect(r?.resultado).toBe("AVISO");
    expect(leer(deps.dir, "ultima-corrida")).toEqual({
      formato: "1", modo: "ahora", desde: "2019-08-23", resultado: "AVISO", inicio: seg(inicio), fin: seg(inicio + 2 * 1_237), precios: "0", fondo: "3",
    });
    expect(existsSync(path.join(deps.dir, "corrida.candado"))).toBe(false);
    expect(mensajes.join("\n")).toContain("corrida (ahora) empieza desde 2019-08-23");
    expect(mensajes.join("\n")).toContain("corrida (ahora) terminó: precios → 0 · fondo → 3 · AVISO");
  });

  it("mientras corre, el candado existe y se refresca cada minuto; al terminar se cancela el refresco", async () => {
    const { deps, programados, mensajes } = dependencias();
    const f = corredorFalso({}, { retener: true });
    const enCurso = corridaRegistrada({ ...deps, corredor: f.corredor }, "bucle", null);
    await hasta(() => f.llamadas.length === 1);
    const ruta = path.join(deps.dir, "corrida.candado");
    expect(leer(deps.dir, "corrida.candado")).toMatchObject({ modo: "bucle" });
    const refresco = programados.at(-1)!;
    expect(refresco.ms).toBe(TIC_MS);
    const viejo = new Date(Date.now() - 2 * 60_000);
    utimesSync(ruta, viejo, viejo);
    refresco.fn();
    await hasta(() => Date.now() - statSync(ruta).mtimeMs < 60_000);
    // Si el refresco falla (no puede leer su candado), lo registra y sigue.
    chmodSync(ruta, 0o000);
    refresco.fn();
    await hasta(() => mensajes.some((m) => m.startsWith("no se pudo refrescar el candado: EACCES")));
    chmodSync(ruta, 0o600);
    f.soltar();
    await hasta(() => f.llamadas.length === 2);
    f.soltar();
    await enCurso;
    expect(refresco.cancelado).toBe(true);
    expect(existsSync(ruta)).toBe(false);
  });

  it("con el candado tomado por otra corrida (fresco): no corre, no escribe la huella y lo dice (sin reintento)", async () => {
    const { deps, mensajes, falso } = dependencias();
    writeFileSync(path.join(deps.dir, "corrida.candado"), "formato=1\nmodo=ahora\ntoken=ficticio\n");
    expect(await corridaRegistrada(deps, "bucle", null)).toBeNull();
    expect(falso.llamadas).toEqual([]);
    expect(existsSync(path.join(deps.dir, "ultima-corrida"))).toBe(false);
    expect(mensajes.join("\n")).toContain("otra corrida en curso");
  });

  it("si no puede escribir la huella ni soltar el candado, lo registra y devuelve el resultado igual", async () => {
    const { deps, mensajes } = dependencias();
    const f = corredorFalso({}, { alCorrer: () => chmodSync(deps.dir, 0o500) });
    try {
      const r = await corridaRegistrada({ ...deps, corredor: f.corredor }, "bucle", null);
      expect(r?.resultado).toBe("OK");
      expect(mensajes.join("\n")).toMatch(/no se pudo escribir la huella \(ultima-corrida\): E[A-Z]+/);
      expect(mensajes.join("\n")).toMatch(/no se pudo soltar el candado: E[A-Z]+/);
    } finally {
      chmodSync(deps.dir, 0o700);
    }
  });
});

describe("crearBucle · programa, latido y sin reintentos", () => {
  it("arranca, dice la próxima corrida y escribe el latido (ESPERANDO) con arranque, próxima y latido", async () => {
    const { deps, mensajes } = dependencias();
    const b = crearBucle(deps);
    await b.tic();
    expect(mensajes[0]).toBe("arranca: una corrida de lunes a viernes a las 18:00 COT (precios y luego fondo, sin reintentos); la próxima: 2027-01-08 18:00 COT");
    expect(leer(deps.dir, "bucle")).toEqual({
      formato: "1", estado: "ESPERANDO", arranque: seg(cot("2027-01-08 17:58")), proxima: seg(cot("2027-01-08 18:00")), latido: seg(cot("2027-01-08 17:58")),
    });
  });

  it("a las 18:00 corre una vez (sin esperarla: el latido sigue, en CORRIENDO) y la próxima pasa al lunes", async () => {
    const { deps, ir } = dependencias();
    const f = corredorFalso({}, { retener: true });
    const b = crearBucle({ ...deps, corredor: f.corredor });
    await b.tic();
    ir("2027-01-08 17:59");
    await b.tic();
    expect(f.llamadas).toEqual([]);
    ir("2027-01-08 18:00");
    await b.tic();
    expect(leer(deps.dir, "bucle")).toMatchObject({ estado: "CORRIENDO", proxima: seg(cot("2027-01-11 18:00")) });
    await hasta(() => f.llamadas.length === 1);
    expect(f.llamadas.map((l) => l.tarea)).toEqual(["precios"]);
    ir("2027-01-08 18:01");
    await b.tic();
    expect(leer(deps.dir, "bucle")).toMatchObject({ estado: "CORRIENDO", latido: seg(cot("2027-01-08 18:01")) });
    f.soltar();
    await hasta(() => f.llamadas.length === 2);
    f.soltar();
    await b.esperar();
    ir("2027-01-08 18:02");
    await b.tic();
    expect(leer(deps.dir, "bucle")).toMatchObject({ estado: "ESPERANDO" });
    expect(leer(deps.dir, "ultima-corrida")).toMatchObject({ modo: "bucle", resultado: "OK" });
    expect(f.llamadas.map((l) => l.tarea)).toEqual(["precios", "fondo"]);
  });

  it("sin reintentos: una corrida que falla no se repite hasta el lunes a las 18:00", async () => {
    const { deps, ir } = dependencias();
    const f = corredorFalso({ precios: "1", fondo: "TIEMPO" });
    const b = crearBucle({ ...deps, corredor: f.corredor });
    for (const hora of ["2027-01-08 18:00", "2027-01-08 18:37", "2027-01-08 23:59", "2027-01-09 18:00", "2027-01-10 18:00", "2027-01-11 17:59"]) {
      ir(hora);
      await b.tic();
      await b.esperar();
    }
    expect(f.llamadas.map((l) => l.tarea)).toEqual(["precios", "fondo"]);
    expect(leer(deps.dir, "ultima-corrida")).toMatchObject({ resultado: "FALLO", precios: "1", fondo: "TIEMPO" });
    ir("2027-01-11 18:00");
    await b.tic();
    await b.esperar();
    expect(f.llamadas).toHaveLength(4);
  });

  it("si arranca después de las 18:00, la de ese día no se recupera (la próxima es el día hábil siguiente)", async () => {
    const { deps, mensajes, falso } = dependencias({ inicio: cot("2027-01-08 18:05") });
    const b = crearBucle(deps);
    await b.tic();
    await b.esperar();
    expect(falso.llamadas).toEqual([]);
    expect(mensajes[0]).toContain("la próxima: 2027-01-11 18:00 COT");
  });

  it("con el candado tomado (un --ahora en curso) a las 18:00: la de ese día se omite y no se reintenta", async () => {
    const { deps, mensajes, falso, ir } = dependencias();
    writeFileSync(path.join(deps.dir, "corrida.candado"), "formato=1\nmodo=ahora\ntoken=ficticio\n");
    const b = crearBucle(deps);
    ir("2027-01-08 18:00");
    await b.tic();
    await b.esperar();
    rmSync(path.join(deps.dir, "corrida.candado"));
    ir("2027-01-08 18:13");
    await b.tic();
    await b.esperar();
    expect(falso.llamadas).toEqual([]);
    expect(mensajes.join("\n")).toContain("otra corrida en curso");
  });

  for (const [estado, credencial, aviso] of [
    ["SIN_SECRETO", { ok: false, estado: "SIN_SECRETO", motivo: "sin INV_PRECIOS_DATABASE_URL: el servicio queda en espera y no trae precios" }, "sin INV_PRECIOS_DATABASE_URL"],
    ["SECRETO_INVALIDO", { ok: false, estado: "SECRETO_INVALIDO", motivo: "INV_PRECIOS_DATABASE_URL no es la de inv_precios en inv-008-db (el usuario no es inv_precios)" }, "no es la de inv_precios"],
  ] as const) {
    it(`${estado}: NO se cae; lo dice al arrancar, sigue con latido y a las 18:00 omite la corrida (lo registra)`, async () => {
      const { deps, mensajes, falso, ir } = dependencias({ credencial });
      const b = crearBucle(deps);
      await b.tic();
      expect(mensajes.join("\n")).toContain(aviso);
      expect(leer(deps.dir, "bucle")).toMatchObject({ estado });
      ir("2027-01-08 18:00");
      await b.tic();
      await b.esperar();
      expect(falso.llamadas).toEqual([]);
      expect(mensajes.join("\n")).toContain(`corrida de las 2027-01-08 18:00 COT omitida: ${estado}`);
      expect(leer(deps.dir, "bucle")).toMatchObject({ estado, proxima: seg(cot("2027-01-11 18:00")) });
      expect(existsSync(path.join(deps.dir, "ultima-corrida"))).toBe(false);
    });
  }

  it("si no puede escribir el latido, lo registra y no se cae", async () => {
    const { deps, mensajes } = dependencias({ dir: path.join(carpeta(), "no-existe") });
    await crearBucle(deps).tic();
    expect(mensajes.join("\n")).toContain("no se pudo escribir la huella (bucle): ENOENT");
  });

  it("si la corrida misma falla (no puede tomar el candado), lo registra, no queda «en curso» y no hay rechazo suelto", async () => {
    const { deps, mensajes, falso, ir } = dependencias({ dir: path.join(carpeta(), "no-existe") });
    const b = crearBucle(deps);
    ir("2027-01-08 18:00");
    await b.tic();
    await b.esperar();
    expect(mensajes.join("\n")).toContain("la corrida no se pudo hacer: ENOENT");
    expect(falso.llamadas).toEqual([]);
  });

  it("detener: para al hijo en curso, espera la corrida, deja DETENIDO en el latido y los tics siguientes no hacen nada", async () => {
    const { deps, ir } = dependencias();
    const f = corredorFalso({}, { retener: true });
    const b = crearBucle({ ...deps, corredor: f.corredor });
    ir("2027-01-08 18:00");
    await b.tic();
    await hasta(() => f.llamadas.length === 1);
    await b.detener();
    expect(f.detenidos()).toBe(1);
    expect(leer(deps.dir, "bucle")).toMatchObject({ estado: "DETENIDO" });
    ir("2027-01-11 18:00");
    await b.tic();
    await b.esperar();
    expect(leer(deps.dir, "bucle")).toMatchObject({ estado: "DETENIDO" });
    expect(f.llamadas.map((l) => l.tarea)).toEqual(["precios"]);
    expect(leer(deps.dir, "ultima-corrida")).toMatchObject({ resultado: "FALLO", precios: "0", fondo: "DETENIDO" });
  });

  it("detener sin corrida en curso también deja DETENIDO", async () => {
    const { deps, falso } = dependencias();
    const b = crearBucle(deps);
    await b.detener();
    expect(falso.detenidos()).toBe(1);
    expect(leer(deps.dir, "bucle")).toMatchObject({ estado: "DETENIDO" });
  });
});

describe("correrAhora · --ahora [--desde AAAA-MM-DD]", () => {
  it("una corrida ya: 0 si todo bien, con la huella en modo ahora", async () => {
    const { deps, falso } = dependencias();
    expect(await correrAhora(deps, [])).toBe(SALIDA.BIEN);
    expect(falso.llamadas.map((l) => [l.tarea, l.args])).toEqual([["precios", []], ["fondo", []]]);
    expect(leer(deps.dir, "ultima-corrida")).toMatchObject({ modo: "ahora", desde: "", resultado: "OK" });
  });

  it("--desde: carga histórica desde ese día en las dos tareas", async () => {
    const { deps, falso } = dependencias();
    expect(await correrAhora(deps, ["--desde", "2019-08-23"])).toBe(SALIDA.BIEN);
    expect(falso.llamadas.map((l) => l.args)).toEqual([["--desde", "2019-08-23"], ["--desde", "2019-08-23"]]);
  });

  it("aviso → 3 · fallo → 1", async () => {
    expect(await correrAhora({ ...dependencias().deps, corredor: corredorFalso({ fondo: "3" }).corredor }, [])).toBe(SALIDA.AVISO);
    expect(await correrAhora({ ...dependencias().deps, corredor: corredorFalso({ precios: "TIEMPO" }).corredor }, [])).toBe(SALIDA.FALLO);
  });

  it("argumentos malos → 2, sin correr nada", async () => {
    const { deps, mensajes, falso } = dependencias();
    expect(await correrAhora(deps, ["--desde", "2019-02-30"])).toBe(SALIDA.USO);
    expect(falso.llamadas).toEqual([]);
    expect(mensajes.join("\n")).toContain("--ahora [--desde AAAA-MM-DD]");
  });

  it("sin secreto o con una credencial ajena → 64, sin correr nada", async () => {
    for (const estado of ["SIN_SECRETO", "SECRETO_INVALIDO"] as const) {
      const { deps, mensajes, falso } = dependencias({ credencial: { ok: false, estado, motivo: `motivo ficticio de ${estado}` } });
      expect(await correrAhora(deps, [])).toBe(SALIDA.CONFIGURACION);
      expect(falso.llamadas).toEqual([]);
      expect(mensajes.join("\n")).toContain(`motivo ficticio de ${estado}`);
    }
  });

  it("con otra corrida en curso (el bucle) → 75, sin correr nada", async () => {
    const { deps, falso } = dependencias();
    writeFileSync(path.join(deps.dir, "corrida.candado"), "formato=1\nmodo=bucle\ntoken=ficticio\n");
    expect(await correrAhora(deps, [])).toBe(SALIDA.OCUPADO);
    expect(falso.llamadas).toEqual([]);
  });

  it("las salidas son 0 · 1 · 2 · 3 · 64 · 75", () => {
    expect(SALIDA).toEqual({ BIEN: 0, FALLO: 1, USO: 2, AVISO: 3, CONFIGURACION: 64, OCUPADO: 75 });
  });
});
