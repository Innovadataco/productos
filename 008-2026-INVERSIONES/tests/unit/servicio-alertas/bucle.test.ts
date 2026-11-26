// El bucle del servicio inv-008-alertas, con reloj, calendario y corredor falsos: la evaluación de las 18:15 COT en día hábil
// BVC; con el intradía encendido, además cada 5 minutos en la rueda; nunca dos ciclos a la vez; si falla, espera y reintenta sin
// caerse; sin la credencial (o con otro rol) en espera. El log y la huella solo traen conteos y códigos. Datos inventados.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ARCHIVO_MARCA, INTENTOS_RANURA, PAUSA_RANURA_MS, REINTENTO_TARDIO_MS, TOPE_CIERRE_MS, crearBucle, iniciarBucle, type DependenciasBucle, type ResumenEvaluacion } from "@/servicio-alertas/bucle";

const cot = (texto: string): number => new Date(`${texto}:00.000-05:00`).getTime();
const MINUTO = 60_000;
const BIEN: ResumenEvaluacion = { codigoSalida: 0, resultado: { evaluadas: 4, insertadas: 1, duplicadas: 3, fallidas: 0 } };

function montar(extra: Partial<DependenciasBucle> = {}, inicio = "2027-03-17T10:00") {
  const dir = mkdtempSync(path.join(os.tmpdir(), "inv-008-alertas-"));
  const lineas: string[] = [];
  const reloj = { t: cot(inicio) };
  const deps: DependenciasBucle = {
    dir,
    ahora: () => reloj.t,
    registrar: (m) => void lineas.push(m),
    credencial: { ok: true },
    programar: () => () => undefined,
    intradia: false,
    revisarRol: vi.fn(async () => true),
    esHabil: vi.fn(async () => true),
    correr: vi.fn(async () => BIEN),
    esperar: vi.fn(async () => undefined),
    ...extra,
  };
  const huella = (nombre: string): string => readFileSync(path.join(deps.dir, nombre), "utf8");
  return { deps, lineas, reloj, huella };
}

/** Avanza el reloj hasta `texto` de a un minuto (como el tic real), esperando lo que haya en curso en cada paso. */
async function avanzar(m: ReturnType<typeof montar>, bucle: ReturnType<typeof crearBucle>, hasta: string): Promise<void> {
  const fin = cot(hasta);
  while (m.reloj.t < fin) {
    m.reloj.t += MINUTO;
    await bucle.tic();
    await bucle.esperar();
  }
}

/** El primer tic (revisa el rol y, si toca, la recuperación de hoy) y lo que dispare. */
async function arrancar(m: ReturnType<typeof montar>) {
  const bucle = crearBucle(m.deps);
  await bucle.tic();
  await bucle.esperar();
  return bucle;
}

describe("la evaluación de las 18:15", () => {
  it("cada tic deja el latido; antes de la hora no corre nada", async () => {
    const m = montar();
    const bucle = await arrancar(m);
    await bucle.tic();
    expect(m.huella("bucle")).toContain("estado=ESPERANDO");
    expect(m.huella("bucle")).toContain("formato=1");
    expect(m.deps.correr).not.toHaveBeenCalled();
  });

  it("a las 18:15 en día hábil: una evaluación con la hora del tic; el log y la huella traen solo conteos", async () => {
    const m = montar();
    const bucle = await arrancar(m);
    await avanzar(m, bucle, "2027-03-17T18:15");
    expect(m.deps.correr).toHaveBeenCalledTimes(1);
    expect(m.deps.correr).toHaveBeenCalledWith(new Date(cot("2027-03-17T18:15")));
    expect(m.lineas.join("\n")).toContain("evaluadas 4 · nuevas 1 · ya guardadas 3 · fallidas 0");
    const ultima = m.huella("ultima-corrida");
    expect(ultima).toContain("resultado=OK");
    expect(ultima).toContain("ranura=CIERRE");
    expect(ultima).toMatch(/evaluadas=4\nnuevas=1\nduplicadas=3\nfallidas=0/);
  });

  it("en un festivo de la BVC no evalúa y lo dice", async () => {
    const m = montar({ esHabil: vi.fn(async () => false) }, "2027-03-22T10:00");
    const bucle = await arrancar(m);
    await avanzar(m, bucle, "2027-03-22T18:20");
    expect(m.deps.correr).not.toHaveBeenCalled();
    expect(m.lineas.join("\n")).toContain("no es día hábil");
  });

  it("un sábado no evalúa (la ranura salta al lunes) ni siquiera sin consultar el calendario", async () => {
    const m = montar({}, "2027-03-20T10:00");
    const bucle = await arrancar(m);
    await avanzar(m, bucle, "2027-03-20T23:00");
    expect(m.deps.correr).not.toHaveBeenCalled();
  });

  it("el día hábil se pregunta con la fecha de Colombia a medianoche UTC", async () => {
    const m = montar();
    const bucle = await arrancar(m);
    await avanzar(m, bucle, "2027-03-17T18:15");
    expect(m.deps.esHabil).toHaveBeenCalledWith(new Date("2027-03-17T00:00:00.000Z"));
  });
});

describe("la rueda con el intradía", () => {
  it("encendido: evalúa cada 5 minutos de 9:30 a 16:05 y no entre medias", async () => {
    const m = montar({ intradia: true }, "2027-03-17T09:00");
    const bucle = await arrancar(m);
    await avanzar(m, bucle, "2027-03-17T09:36");
    const horas = vi.mocked(m.deps.correr).mock.calls.map(([d]) => new Date(d.getTime() - 5 * 3_600_000).toISOString().slice(11, 16));
    expect(horas).toEqual(["09:30", "09:35"]);
  });

  it("encendido: 16:05 es la última de la rueda; 16:10 ya no; las 18:15 sí", async () => {
    const m = montar({ intradia: true }, "2027-03-17T16:00");
    const bucle = await arrancar(m);
    await avanzar(m, bucle, "2027-03-17T18:16");
    const horas = vi.mocked(m.deps.correr).mock.calls.map(([d]) => new Date(d.getTime() - 5 * 3_600_000).toISOString().slice(11, 16));
    expect(horas).toEqual(["16:05", "18:15"]);
  });

  it("encendido, un día entero: 81 evaluaciones (80 de la rueda y la de las 18:15)", async () => {
    const m = montar({ intradia: true }, "2027-03-17T09:00");
    const bucle = await arrancar(m);
    await avanzar(m, bucle, "2027-03-17T23:00");
    expect(m.deps.correr).toHaveBeenCalledTimes(81);
  });

  it("apagado: ninguna en la rueda; solo las 18:15", async () => {
    const m = montar({ intradia: false }, "2027-03-17T09:00");
    const bucle = await arrancar(m);
    await avanzar(m, bucle, "2027-03-17T18:16");
    expect(m.deps.correr).toHaveBeenCalledTimes(1);
  });

  it("encendido, en un festivo: ni la rueda ni el cierre", async () => {
    const m = montar({ intradia: true, esHabil: vi.fn(async () => false) }, "2027-03-22T09:00");
    const bucle = await arrancar(m);
    await avanzar(m, bucle, "2027-03-22T18:16");
    expect(m.deps.correr).not.toHaveBeenCalled();
  });

  it("la huella marca la ranura de la rueda", async () => {
    const m = montar({ intradia: true }, "2027-03-17T09:00");
    const bucle = await arrancar(m);
    await avanzar(m, bucle, "2027-03-17T09:31");
    expect(m.huella("ultima-corrida")).toContain("ranura=RUEDA");
  });
});

describe("un solo ciclo a la vez", () => {
  it("si la evaluación sigue en curso cuando llega la siguiente ranura, la omite y lo dice", async () => {
    let soltar: (r: ResumenEvaluacion) => void = () => undefined;
    const lenta = vi.fn(() => new Promise<ResumenEvaluacion>((r) => void (soltar = r)));
    const m = montar({ intradia: true, correr: lenta }, "2027-03-17T09:00");
    const bucle = await arrancar(m);
    while (m.reloj.t < cot("2027-03-17T09:36")) {
      m.reloj.t += MINUTO;
      await bucle.tic();
    }
    // Las de 9:30 y 9:35 llegaron con la primera todavía abierta: una sola llamada.
    expect(lenta).toHaveBeenCalledTimes(1);
    expect(m.lineas.join("\n")).toContain("omitida: la evaluación anterior sigue en curso");
    expect(m.huella("bucle")).toContain("estado=CORRIENDO");
    soltar(BIEN);
    await bucle.esperar();
    await bucle.tic();
    expect(m.huella("bucle")).toContain("estado=ESPERANDO");
  });
});

describe("fallos", () => {
  it("si falla, espera y reintenta sin caerse; el log trae el nombre y el código, nunca el mensaje", async () => {
    const error = Object.assign(new Error("clave-ficticia-5120 en postgresql://x"), { code: "P1001" });
    const correr = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(BIEN);
    const m = montar({ correr });
    const bucle = await arrancar(m);
    await avanzar(m, bucle, "2027-03-17T18:15");
    expect(correr).toHaveBeenCalledTimes(2);
    expect(m.deps.esperar).toHaveBeenCalledWith(PAUSA_RANURA_MS);
    expect(m.lineas.join("\n")).toContain("P1001");
    expect(m.lineas.join("\n")).not.toContain("clave-ficticia-5120");
    expect(m.lineas.join("\n")).not.toContain("postgresql://");
    expect(m.huella("ultima-corrida")).toContain("resultado=OK");
  });

  it("tras todos los intentos se rinde, queda el FALLO en la huella y el servicio sigue vivo para la próxima ranura", async () => {
    const correr = vi.fn().mockRejectedValue(new Error("no"));
    const m = montar({ correr, intradia: true }, "2027-03-17T09:00");
    const bucle = await arrancar(m);
    await avanzar(m, bucle, "2027-03-17T09:31");
    expect(correr).toHaveBeenCalledTimes(INTENTOS_RANURA);
    expect(m.huella("ultima-corrida")).toContain("resultado=FALLO");
    expect(m.lineas.join("\n")).toContain("no se pudo hacer");
    correr.mockResolvedValue(BIEN);
    await avanzar(m, bucle, "2027-03-17T09:36");
    expect(m.huella("ultima-corrida")).toContain("resultado=OK");
    expect(m.huella("bucle")).toContain("estado=ESPERANDO");
  });

  it("si el calendario falla también se reintenta (no se cae)", async () => {
    const esHabil = vi.fn().mockRejectedValueOnce(new Error("no")).mockResolvedValue(true);
    const m = montar({ esHabil });
    const bucle = await arrancar(m);
    await avanzar(m, bucle, "2027-03-17T18:15");
    expect(m.deps.correr).toHaveBeenCalledTimes(1);
  });

  it("la salida 3 (alguna alerta no se guardó) es un AVISO: se reintenta y, si sigue, queda como AVISO con sus conteos", async () => {
    const parcial: ResumenEvaluacion = { codigoSalida: 3, resultado: { evaluadas: 5, insertadas: 3, duplicadas: 0, fallidas: 2 } };
    const m = montar({ correr: vi.fn(async () => parcial) });
    const bucle = await arrancar(m);
    await avanzar(m, bucle, "2027-03-17T18:15");
    expect(m.deps.correr).toHaveBeenCalledTimes(INTENTOS_RANURA);
    const ultima = m.huella("ultima-corrida");
    expect(ultima).toContain("resultado=AVISO");
    expect(ultima).toContain("fallidas=2");
  });

  it("si no se puede escribir la huella, lo dice con el código y sigue", async () => {
    const m = montar({ dir: path.join(os.tmpdir(), "inv-008-alertas-no-existe", "x") });
    const bucle = await arrancar(m);
    await avanzar(m, bucle, "2027-03-17T18:15");
    expect(m.deps.correr).toHaveBeenCalledTimes(1);
    expect(m.lineas.join("\n")).toContain("no se pudo escribir");
    expect(m.lineas.join("\n")).toContain("ENOENT");
  });
});

describe("la credencial y el rol", () => {
  it("sin la credencial: EN ESPERA (SIN_SECRETO), con latido y sin tocar la base, aunque llegue la hora", async () => {
    const m = montar({ credencial: { ok: false, estado: "SIN_SECRETO", motivo: "sin INV_ALERTAS_DATABASE_URL: el servicio queda en espera" } });
    const bucle = crearBucle(m.deps);
    await bucle.tic();
    await avanzar(m, bucle, "2027-03-17T18:16");
    expect(m.huella("bucle")).toContain("estado=SIN_SECRETO");
    expect(m.deps.revisarRol).not.toHaveBeenCalled();
    expect(m.deps.esHabil).not.toHaveBeenCalled();
    expect(m.deps.correr).not.toHaveBeenCalled();
    expect(m.lineas.join("\n")).toContain("sin INV_ALERTAS_DATABASE_URL");
  });

  it("con una credencial ajena: SECRETO_INVALIDO y nada más", async () => {
    const m = montar({ credencial: { ok: false, estado: "SECRETO_INVALIDO", motivo: "la credencial no es la de inv_alertas" } });
    const bucle = crearBucle(m.deps);
    await avanzar(m, bucle, "2027-03-17T18:16");
    expect(m.huella("bucle")).toContain("estado=SECRETO_INVALIDO");
    expect(m.deps.correr).not.toHaveBeenCalled();
  });

  it("al arrancar revisa current_user: si la conexión no es la de inv_alertas, queda en SECRETO_INVALIDO y no evalúa", async () => {
    const m = montar({ revisarRol: vi.fn(async () => false) });
    const bucle = await arrancar(m);
    await avanzar(m, bucle, "2027-03-17T18:16");
    expect(m.huella("bucle")).toContain("estado=SECRETO_INVALIDO");
    expect(m.deps.correr).not.toHaveBeenCalled();
    expect(m.deps.revisarRol).toHaveBeenCalledTimes(1);
    expect(m.lineas.join("\n")).toContain("inv_alertas");
  });

  it("si la base no responde al revisar el rol, no se cae: lo reintenta en el siguiente tic y después evalúa", async () => {
    const revisarRol = vi.fn().mockRejectedValueOnce(Object.assign(new Error("clave-ficticia-5120"), { code: "P1001" })).mockResolvedValue(true);
    const m = montar({ revisarRol });
    const bucle = await arrancar(m);
    expect(m.lineas.join("\n")).toContain("P1001");
    expect(m.lineas.join("\n")).not.toContain("clave-ficticia-5120");
    await avanzar(m, bucle, "2027-03-17T18:15");
    expect(revisarRol).toHaveBeenCalledTimes(2);
    expect(m.deps.correr).toHaveBeenCalledTimes(1);
  });

  it("la ranura que llega con el rol aún sin verificar se omite y lo dice", async () => {
    const m = montar({ revisarRol: vi.fn().mockRejectedValue(new Error("no")) });
    const bucle = await arrancar(m);
    await avanzar(m, bucle, "2027-03-17T18:16");
    expect(m.deps.correr).not.toHaveBeenCalled();
    expect(m.lineas.join("\n")).toContain("omitida");
  });
});

describe("al arrancar después de las 18:15", () => {
  it("un día hábil: recupera la evaluación de hoy, una vez (lo ya guardado no se duplica en la base)", async () => {
    const m = montar({}, "2027-03-17T18:30");
    const bucle = await arrancar(m);
    expect(m.deps.correr).toHaveBeenCalledTimes(1);
    await avanzar(m, bucle, "2027-03-17T19:30");
    expect(m.deps.correr).toHaveBeenCalledTimes(1);
    expect(m.lineas.join("\n")).toContain("arrancó después de las 18:15");
  });

  it.each([
    ["antes de las 18:15", "2027-03-17T10:00", true],
    ["un sábado", "2027-03-20T19:00", true],
    ["un festivo", "2027-03-22T19:00", false],
  ])("%s: no recupera nada", async (_n, inicio, habil) => {
    const m = montar({ esHabil: vi.fn(async () => habil) }, inicio);
    await arrancar(m);
    expect(m.deps.correr).not.toHaveBeenCalled();
  });

  it("sin la credencial no recupera nada", async () => {
    const m = montar({ credencial: { ok: false, estado: "SIN_SECRETO", motivo: "sin credencial" } }, "2027-03-17T18:30");
    const bucle = crearBucle(m.deps);
    await bucle.tic();
    await bucle.esperar();
    expect(m.deps.correr).not.toHaveBeenCalled();
  });
});

describe("iniciarBucle", () => {
  const senales = () => {
    const manejadores: Array<(s: NodeJS.Signals) => void> = [];
    return {
      manejadores,
      once: vi.fn((_s: string, f: (s: NodeJS.Signals) => void) => void manejadores.push(f)),
      removeListener: vi.fn(),
    };
  };

  it("un tic ya y luego cada minuto; con SIGTERM deja DETENIDO, llama a alDetener y devuelve 0", async () => {
    const m = montar();
    const cancelar = vi.fn();
    const programar = vi.fn(() => cancelar);
    const s = senales();
    const alDetener = vi.fn(async () => undefined);
    const fin = iniciarBucle({ ...m.deps, programar }, s, alDetener);
    expect(programar).toHaveBeenCalledWith(expect.any(Function), MINUTO);
    s.manejadores[0]!("SIGTERM");
    expect(await fin).toBe(0);
    expect(cancelar).toHaveBeenCalled();
    expect(alDetener).toHaveBeenCalled();
    expect(m.huella("bucle")).toContain("estado=DETENIDO");
    expect(m.lineas.join("\n")).toContain("detenido por SIGTERM");
  });

  it("si el cierre se cuelga, sale igual al cumplirse el tope", async () => {
    vi.useFakeTimers();
    try {
      const m = montar();
      const s = senales();
      const fin = iniciarBucle({ ...m.deps, programar: () => () => undefined }, s, () => new Promise<void>(() => undefined));
      s.manejadores[0]!("SIGINT");
      await vi.advanceTimersByTimeAsync(TOPE_CIERRE_MS + 1);
      expect(await fin).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("la marca del intento del cierre (sin bucle de reinicios)", () => {
  it("dos arranques seguidos el mismo día: el primero recupera y deja la marca; el segundo no repite", async () => {
    const primero = montar({}, "2027-03-17T18:30");
    await arrancar(primero);
    expect(primero.deps.correr).toHaveBeenCalledTimes(1);
    expect(primero.huella(ARCHIVO_MARCA)).toContain("dia=2027-03-17");
    const segundo = montar({ dir: primero.deps.dir }, "2027-03-17T18:40");
    await arrancar(segundo);
    expect(segundo.deps.correr).not.toHaveBeenCalled();
    expect(segundo.lineas.join("\n")).toContain("ya hubo un intento del cierre");
  });

  it("una evaluación que mata el proceso (la marca queda y la corrida no termina): el reinicio no la repite", async () => {
    const colgada = montar({ correr: vi.fn(() => new Promise<ResumenEvaluacion>(() => undefined)), plazoMs: 30 }, "2027-03-17T18:30");
    const b = crearBucle(colgada.deps);
    await b.tic();
    for (let i = 0; i < 20 && !existsSync(path.join(colgada.deps.dir, ARCHIVO_MARCA)); i += 1) await new Promise((r) => setTimeout(r, 5));
    // «el proceso muere» aquí: otro arranque con el mismo volumen.
    const reinicio = montar({ dir: colgada.deps.dir }, "2027-03-17T18:31");
    await arrancar(reinicio);
    expect(reinicio.deps.correr).not.toHaveBeenCalled();
  });

  it("la marca de ayer no impide recuperar hoy", async () => {
    const m = montar({}, "2027-03-17T18:30");
    writeFileSync(path.join(m.deps.dir, ARCHIVO_MARCA), "formato=1\ndia=2027-03-16\n");
    await arrancar(m);
    expect(m.deps.correr).toHaveBeenCalledTimes(1);
  });

  it("si la marca no se puede escribir (volumen sin permiso), no recupera nada", async () => {
    const m = montar({ dir: path.join(os.tmpdir(), "inv-008-alertas-sin-volumen", "x") }, "2027-03-17T18:30");
    await arrancar(m);
    expect(m.deps.correr).not.toHaveBeenCalled();
    expect(m.lineas.join("\n")).toContain("no se pudo escribir la marca");
  });

  it("la evaluación de las 18:15 también deja la marca: un reinicio a las 18:20 no la repite", async () => {
    const m = montar();
    const bucle = await arrancar(m);
    await avanzar(m, bucle, "2027-03-17T18:15");
    expect(m.huella(ARCHIVO_MARCA)).toContain("dia=2027-03-17");
    const reinicio = montar({ dir: m.deps.dir }, "2027-03-17T18:20");
    await arrancar(reinicio);
    expect(reinicio.deps.correr).not.toHaveBeenCalled();
  });
});

describe("el plazo de la evaluación", () => {
  it("una evaluación que no termina vence (PlazoVencido), se reintenta y queda en FALLO sin caerse", async () => {
    const correr = vi.fn(() => new Promise<ResumenEvaluacion>(() => undefined));
    const m = montar({ correr, plazoMs: 15 });
    const bucle = await arrancar(m);
    await avanzar(m, bucle, "2027-03-17T18:15");
    expect(correr).toHaveBeenCalledTimes(INTENTOS_RANURA);
    expect(m.lineas.join("\n")).toContain("PlazoVencido");
    expect(m.huella("ultima-corrida")).toContain("resultado=FALLO");
  });
});

describe("el estado SIN_VERIFICAR", () => {
  it("mientras el rol no se verificó, el latido dice SIN_VERIFICAR (no ESPERANDO); verificado, ESPERANDO", async () => {
    const revisarRol = vi.fn().mockRejectedValueOnce(new Error("no")).mockResolvedValue(true);
    const m = montar({ revisarRol });
    const bucle = await arrancar(m);
    expect(m.huella("bucle")).toContain("estado=SIN_VERIFICAR");
    m.reloj.t += MINUTO;
    await bucle.tic();
    await bucle.esperar();
    await bucle.tic();
    expect(m.huella("bucle")).toContain("estado=ESPERANDO");
  });
});

describe("reintento tardío del cierre", () => {
  const horas = (m: ReturnType<typeof montar>) => vi.mocked(m.deps.correr).mock.calls.map(([d]) => new Date(d.getTime() - 5 * 3_600_000).toISOString().slice(11, 16));

  it("si las 18:15 quedan en FALLO se reintenta a los 10 min y, con un OK, ya no", async () => {
    const correr = vi.fn().mockRejectedValueOnce(new Error("a")).mockRejectedValueOnce(new Error("b")).mockRejectedValueOnce(new Error("c")).mockResolvedValue(BIEN);
    const m = montar({ correr });
    const bucle = await arrancar(m);
    await avanzar(m, bucle, "2027-03-17T18:24");
    expect(correr).toHaveBeenCalledTimes(3);
    await avanzar(m, bucle, "2027-03-17T18:25");
    expect(correr).toHaveBeenCalledTimes(4);
    expect(m.huella("ultima-corrida")).toContain("resultado=OK");
    await avanzar(m, bucle, "2027-03-17T19:30");
    expect(correr).toHaveBeenCalledTimes(4);
    expect(REINTENTO_TARDIO_MS).toBe(10 * 60_000);
  });

  it("sigue cada 10 min mientras falle y para a las 23:59", async () => {
    const m = montar({ correr: vi.fn().mockRejectedValue(new Error("no")) });
    const bucle = await arrancar(m);
    await avanzar(m, bucle, "2027-03-18T00:30");
    const h = horas(m);
    expect(h.length).toBeGreaterThan(INTENTOS_RANURA * 3);
    expect(h.every((x) => x >= "18:15" || x <= "00:30")).toBe(true);
    expect(h.filter((x) => x >= "23:59" || x < "18:00")).toEqual([]);
  });

  it("si las 18:15 se omitieron porque había otra evaluación en curso, se reintenta a los 10 min", async () => {
    let soltar: (r: ResumenEvaluacion) => void = () => undefined;
    const correr = vi.fn(() => new Promise<ResumenEvaluacion>((r) => void (soltar = r)));
    const m = montar({ intradia: true, correr }, "2027-03-17T16:00");
    const bucle = await arrancar(m);
    while (m.reloj.t < cot("2027-03-17T18:16")) {
      m.reloj.t += MINUTO;
      await bucle.tic();
    }
    expect(correr).toHaveBeenCalledTimes(1);
    soltar(BIEN);
    await bucle.esperar();
    correr.mockResolvedValue(BIEN);
    await avanzar(m, bucle, "2027-03-17T18:26");
    expect(correr).toHaveBeenCalledTimes(2);
  });
});

describe("SIGTERM con una evaluación en vuelo", () => {
  it("no deja la huella en FALLO si el cierre la hace fallar", async () => {
    let fallar: (e: unknown) => void = () => undefined;
    const correr = vi.fn(() => new Promise<ResumenEvaluacion>((_ok, mal) => void (fallar = mal)));
    const m = montar({ correr });
    const bucle = await arrancar(m);
    while (m.reloj.t < cot("2027-03-17T18:15")) {
      m.reloj.t += MINUTO;
      await bucle.tic();
    }
    await bucle.detener();
    fallar(new Error("la base se cerró"));
    await bucle.esperar();
    expect(existsSync(path.join(m.deps.dir, "ultima-corrida"))).toBe(false);
    expect(m.lineas.join("\n")).not.toContain("no se pudo hacer");
  });
});
