// inv-008-vigia (docker/vigia/vigia.sh): vigila la memoria del VPS compartido y los OOM de cualquier
// contenedor (memory.events de cada docker-*.scope) y AVISA por Telegram. Nunca actúa: el corte es manual.
// Máquina de estados sin spam: OK → ALERTA (una vez) → PEOR (solo si empeora) → RESUELTO (una vez).
// RESUELTO solo con MemAvailable ≥ umbral + 256 MiB durante 3 pasadas seguidas y sin OOM en la ventana de calma.
// El OOM se lee del contador JERÁRQUICO (system.slice o docker): persiste aunque el scope del contenedor muerto
// se borre. El token va a curl por stdin (-K -), nunca en sus argumentos.
// El Telegram falso escucha en un socket Unix (sin puertos TCP).
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, utimesSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { carpetaTemporal, crearFalsos, entorno, idArchivo, ruta008, rutaEnPath, type Entorno, type Falsos } from "./falsos";

// Cada prueba corre scripts de bash con varios procesos: con la suite en paralelo puede pasar de 5 s.
vi.setConfig({ testTimeout: 60_000 });

const VIGIA = ruta008("docker/vigia/vigia.sh");
/** El curl del vigía: un archivo fijo del repo, que registra la llamada y habla con el Telegram falso por el socket. */
const CURL_VIGIA = ruta008("tests/unit/produccion/falsos-vigia/curl");
const TOKEN = "123456:TOKEN-FICTICIO-NUNCA-EN-EL-MENSAJE";
const ID_OOM = "4f3c2b1a0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b";

type Mensaje = { url: string; cuerpo: { chat_id: string; text: string } };
let servidor: Server;
let socket: string;
let mensajes: Mensaje[] = [];
let responder = 200;

beforeAll(async () => {
  socket = path.join(carpetaTemporal("telegram"), "t.sock");
  servidor = createServer((req, res) => {
    let datos = "";
    req.on("data", (c) => (datos += c));
    req.on("end", () => {
      if (responder === 200) mensajes.push({ url: req.url ?? "", cuerpo: JSON.parse(datos) });
      res.statusCode = responder;
      res.end(JSON.stringify({ ok: responder === 200 }));
    });
  });
  await new Promise<void>((ok) => servidor.listen(socket, ok));
});
afterAll(() => new Promise<void>((ok) => servidor.close(() => ok())));

function preparar() {
  const dir = carpetaTemporal("vigia");
  const falsos: Falsos = crearFalsos(dir);
  const meminfo = path.join(dir, "meminfo");
  const cgroup = path.join(dir, "cgroup");
  const scope = path.join(cgroup, "system.slice", `docker-${ID_OOM}.scope`);
  mkdirSync(scope, { recursive: true });
  mkdirSync(path.join(cgroup, "user.slice", "otro.scope"), { recursive: true });
  writeFileSync(path.join(cgroup, "user.slice", "otro.scope", "memory.events"), "oom_kill 7\n");
  const estado = path.join(dir, "estado");
  const fijarMemoria = (mib: number, swapMib = 2470) =>
    writeFileSync(meminfo, `MemTotal: 8000000 kB\nMemAvailable: ${mib * 1024} kB\nSwapTotal: 4194300 kB\nSwapFree: ${swapMib * 1024} kB\n`);
  // Contador jerárquico (system.slice) y el del scope del contenedor. Un OOM real sube los dos; si el scope se
  // recrea (reinicio), el suyo vuelve a 0 y el jerárquico conserva el total.
  let jerarquico = 0;
  const escribirJerarquico = () => writeFileSync(path.join(cgroup, "system.slice", "memory.events"), `oom ${jerarquico}\noom_kill ${jerarquico}\n`);
  const fijarOom = (n: number) => {
    jerarquico += Math.max(0, n - oomScope);
    oomScope = n;
    writeFileSync(path.join(scope, "memory.events"), `low 0\nhigh 0\nmax 3\noom ${n}\noom_kill ${n}\n`);
    escribirJerarquico();
  };
  let oomScope = 0;
  /** OOM que mata el proceso principal: el contador jerárquico sube y el scope vuelve en 0 (recreado). */
  const oomConReinicio = () => {
    jerarquico += 1;
    oomScope = 0;
    writeFileSync(path.join(scope, "memory.events"), "oom 0\noom_kill 0\n");
    escribirJerarquico();
  };
  fijarMemoria(4000);
  fijarOom(0);
  const base = entorno(falsos, {
    VIGIA_MEMINFO: meminfo,
    VIGIA_CGROUP: cgroup,
    VIGIA_ESTADO_DIR: estado,
    TELEGRAM_BOT_TOKEN: TOKEN,
    TELEGRAM_CHAT_ID: "-100123",
    TELEGRAM_API: "http://telegram.falso",
    FALSO_TELEGRAM_SOCKET: socket,
    VIGIA_OOM_CALMA_S: "0",
  });
  // El curl del vigía, primero en el PATH: tapa al de falsos/ (la API de GitHub) sin tocarlo.
  const env: Entorno = { ...base, PATH: `${path.dirname(CURL_VIGIA)}:${base.PATH}` };
  const pasada = (extra: Record<string, string> = {}) =>
    new Promise<{ status: number | null; stdout: string; stderr: string }>((ok) => {
      const hijo = spawn("sh", [VIGIA, "--una-pasada"], { env: { ...env, ...extra } as NodeJS.ProcessEnv });
      let stdout = "";
      let stderr = "";
      hijo.stdout.on("data", (c: Buffer) => (stdout += c));
      hijo.stderr.on("data", (c: Buffer) => (stderr += c));
      hijo.on("close", (status: number | null) => ok({ status, stdout, stderr }));
    });
  return { dir, falsos, estado, fijarMemoria, fijarOom, oomConReinicio, pasada, env };
}

const textos = () => mensajes.map((m) => m.cuerpo.text);

describe("vigía · el curl falso", () => {
  // En macOS, la primera ejecución de cada ejecutable NUEVO pasa por la revisión del sistema, en una sola fila para
  // todo el Mac: con la máquina cargada son segundos por archivo, y un curl nuevo en cada prueba hacía este archivo
  // varias veces más lento. Por eso el curl es un archivo fijo del repo, el mismo en todas las pruebas.
  it("curl es el versionado (falsos-vigia/curl), el mismo archivo en todas las pruebas: no se crea uno nuevo", () => {
    for (const v of [preparar(), preparar()]) expect(idArchivo(rutaEnPath(v.env, "curl"))).toBe(idArchivo(CURL_VIGIA));
  });

  it("sin el socket del Telegram falso, el curl versionado sale con 97 sin llamar al curl del sistema (nunca a la red)", () => {
    const registro = path.join(carpetaTemporal("vigia-sin-socket"), "registro.txt");
    const sinSocket: Entorno = { PATH: process.env.PATH, FALSO_REGISTRO: registro };
    const r = spawnSync(CURL_VIGIA, ["--version"], { env: sinSocket as NodeJS.ProcessEnv, encoding: "utf8" });
    expect(r.status, r.stderr).toBe(97);
    expect(r.stdout).toBe("");
    expect(r.stderr).toMatch(/falta FALSO_TELEGRAM_SOCKET/);
  });
});

describe("vigía · máquina de estados sin spam", () => {
  it("OK no avisa; ALERTA avisa una vez; PEOR solo si baja 256 MiB más; RESUELTO una vez", async () => {
    mensajes = [];
    const v = preparar();
    expect((await v.pasada()).status).toBe(0);
    expect(mensajes).toHaveLength(0);

    v.fijarMemoria(900);
    await v.pasada();
    expect(textos()).toHaveLength(1);
    expect(textos()[0]).toMatch(/ALERTA/);

    v.fijarMemoria(700);
    await v.pasada();
    expect(textos()).toHaveLength(1);

    v.fijarMemoria(640);
    await v.pasada();
    expect(textos()).toHaveLength(2);
    expect(textos()[1]).toMatch(/PEOR/);

    v.fijarMemoria(500);
    await v.pasada();
    expect(textos()).toHaveLength(2);

    v.fijarMemoria(2900);
    await v.pasada();
    await v.pasada();
    expect(textos()).toHaveLength(2);
    await v.pasada();
    expect(textos()).toHaveLength(3);
    expect(textos()[2]).toMatch(/RESUELTO/);

    await v.pasada();
    expect(textos()).toHaveLength(3);
  });

  it("histéresis: en el vaivén alrededor del umbral avisa una sola ALERTA y un solo RESUELTO", async () => {
    mensajes = [];
    const v = preparar();
    await v.pasada();
    for (const mib of [900, 1100, 1300, 900, 1300, 1300, 1100, 1300, 1300]) {
      v.fijarMemoria(mib);
      await v.pasada();
    }
    expect(textos()).toHaveLength(1);
    v.fijarMemoria(1300);
    await v.pasada();
    expect(textos()).toHaveLength(2);
    expect(textos()[0]).toMatch(/ALERTA/);
    expect(textos()[1]).toMatch(/RESUELTO/);
  });

  it("una alerta de OOM no se resuelve mientras no pase la ventana de calma", async () => {
    mensajes = [];
    const v = preparar();
    await v.pasada();
    v.fijarOom(1);
    await v.pasada({ VIGIA_OOM_CALMA_S: "3600" });
    for (let i = 0; i < 5; i++) await v.pasada({ VIGIA_OOM_CALMA_S: "3600" });
    expect(textos()).toHaveLength(1);
    for (let i = 0; i < 3; i++) await v.pasada({ VIGIA_OOM_CALMA_S: "0" });
    expect(textos()).toHaveLength(2);
    expect(textos()[1]).toMatch(/RESUELTO/);
  });

  it("OOM típico: el proceso principal muere, el scope vuelve en 0 y el contador jerárquico lo delata", async () => {
    mensajes = [];
    const v = preparar();
    await v.pasada();
    v.fijarOom(2);
    await v.pasada();
    expect(textos()).toHaveLength(1);
    v.oomConReinicio();
    await v.pasada();
    expect(textos()).toHaveLength(2);
    expect(textos()[1]).toMatch(/PEOR/);
    expect(textos()[1]).toMatch(/recreado/);
    expect(textos()[1]).toContain(ID_OOM.slice(0, 12));
  });

  it("un oom_kill nuevo en un docker-*.scope dispara la alerta con el id corto y el comando para identificarlo", async () => {
    mensajes = [];
    const v = preparar();
    await v.pasada();
    expect(mensajes).toHaveLength(0);
    v.fijarOom(1);
    await v.pasada();
    expect(textos()).toHaveLength(1);
    expect(textos()[0]).toMatch(/OOM/);
    expect(textos()[0]).toContain(ID_OOM.slice(0, 12));
    expect(textos()[0]).toContain(`docker ps --no-trunc | grep ${ID_OOM.slice(0, 12)}`);
  });

  it("también entiende el driver cgroupfs (docker/<id>/memory.events), como Colima", async () => {
    mensajes = [];
    const v = preparar();
    const dirCgroupfs = path.join(v.env.VIGIA_CGROUP!, "docker", ID_OOM.replace(/^4f/, "9a"));
    mkdirSync(dirCgroupfs, { recursive: true });
    writeFileSync(path.join(dirCgroupfs, "memory.events"), "oom_kill 0\n");
    writeFileSync(path.join(v.env.VIGIA_CGROUP!, "docker", "memory.events"), "oom_kill 0\n");
    await v.pasada();
    writeFileSync(path.join(dirCgroupfs, "memory.events"), "oom_kill 1\n");
    writeFileSync(path.join(v.env.VIGIA_CGROUP!, "docker", "memory.events"), "oom_kill 1\n");
    await v.pasada();
    expect(textos()).toHaveLength(1);
    expect(textos()[0]).toContain(`docker ps --no-trunc | grep 9a3c2b1a0e9d`);
  });

  it("con la alerta abierta, otro OOM nuevo es PEOR", async () => {
    mensajes = [];
    const v = preparar();
    await v.pasada();
    v.fijarOom(1);
    await v.pasada();
    v.fijarMemoria(900);
    v.fijarOom(2);
    await v.pasada();
    expect(textos()).toHaveLength(2);
    expect(textos()[1]).toMatch(/PEOR/);
  });

  it("si Telegram falla, no cambia de estado: reintenta en la pasada siguiente", async () => {
    mensajes = [];
    const v = preparar();
    v.fijarMemoria(800);
    responder = 500;
    expect((await v.pasada()).status).toBe(0);
    responder = 200;
    expect(mensajes).toHaveLength(0);
    await v.pasada();
    expect(textos()).toHaveLength(1);
    expect(textos()[0]).toMatch(/ALERTA/);
  });
});

describe("vigía · contenido del mensaje", () => {
  it("trae hora COT, MemAvailable, SwapFree y el comando de corte; nunca el token", async () => {
    mensajes = [];
    const v = preparar();
    v.fijarMemoria(812, 1999);
    await v.pasada();
    const m = mensajes[0]!;
    expect(m.url).toBe(`/bot${TOKEN}/sendMessage`);
    expect(m.cuerpo.chat_id).toBe("-100123");
    expect(m.cuerpo.text).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2} COT/);
    expect(m.cuerpo.text).toMatch(/MemAvailable: 812 MiB/);
    expect(m.cuerpo.text).toMatch(/SwapFree: 1999 MiB/);
    // Sin VIGIA_RUTA_PAUSA (un vigía recreado a mano): el comando sin ninguna ruta del VPS, con el marcador.
    expect(m.cuerpo.text).toContain("ssh pi-vps sudo <raíz>/repo/008-2026-INVERSIONES/scripts/pausar-008.sh");
    expect(m.cuerpo.text).toContain("ver ESTADO en la gestión");
    expect(m.cuerpo.text).not.toContain(TOKEN);
    expect(m.cuerpo.text).not.toContain("TOKEN-FICTICIO");
  });

  it("con VIGIA_RUTA_PAUSA (la pasan los scripts, derivada del clon) el aviso trae el comando exacto", async () => {
    mensajes = [];
    const v = preparar();
    v.fijarMemoria(812, 1999);
    await v.pasada({ VIGIA_RUTA_PAUSA: "/srv/ficticia/repo/008-2026-INVERSIONES/scripts/pausar-008.sh" });
    expect(mensajes[0]!.cuerpo.text).toContain("ssh pi-vps sudo /srv/ficticia/repo/008-2026-INVERSIONES/scripts/pausar-008.sh");
    expect(mensajes[0]!.cuerpo.text).not.toContain("<raíz>");
  });

  for (const mala of ["relativa/pausar-008.sh", "/srv/x; reboot", "/srv/$(id)/pausar-008.sh", "/srv/a b/pausar-008.sh"]) {
    it(`una VIGIA_RUTA_PAUSA inválida («${mala}») no entra al mensaje: queda el marcador`, async () => {
      mensajes = [];
      const v = preparar();
      v.fijarMemoria(812, 1999);
      await v.pasada({ VIGIA_RUTA_PAUSA: mala });
      expect(mensajes[0]!.cuerpo.text).not.toContain(mala);
      expect(mensajes[0]!.cuerpo.text).toContain("<raíz>/repo/008-2026-INVERSIONES/scripts/pausar-008.sh");
    });
  }

  it("el token nunca va en los argumentos de curl (se vería en ps): va por stdin con -K -", async () => {
    mensajes = [];
    const v = preparar();
    v.fijarMemoria(700);
    await v.pasada();
    expect(mensajes).toHaveLength(1);
    const argumentos = readFileSync(v.falsos.registro, "utf8");
    expect(argumentos).toMatch(/^curl\t/m);
    expect(argumentos).toContain("-K\t-");
    expect(argumentos).not.toContain("TOKEN-FICTICIO");
  });

  it("el umbral es configurable (control positivo en el VPS con 7168 MiB)", async () => {
    mensajes = [];
    const v = preparar();
    v.fijarMemoria(4000);
    await v.pasada({ VIGIA_UMBRAL_MEMAVAILABLE_MIB: "7168" });
    expect(textos()).toHaveLength(1);
    expect(textos()[0]).toMatch(/umbral de 7168 MiB/);
  });
});

describe("vigía · sin contador OOM jerárquico falla ruidosamente (nunca suma scopes en silencio)", () => {
  it("avisa «vigía sin contador OOM» una vez, sale con error y el healthcheck queda en rojo; se recupera al volver el archivo", async () => {
    mensajes = [];
    const v = preparar();
    const jerarquico = path.join(v.env.VIGIA_CGROUP!, "system.slice", "memory.events");
    rmSync(jerarquico);
    const r1 = await v.pasada();
    expect(r1.status).not.toBe(0);
    expect(textos()).toHaveLength(1);
    expect(textos()[0]).toMatch(/vigía sin contador OOM/);
    const salud = () => new Promise<number | null>((ok) => spawn("sh", [VIGIA, "--salud"], { env: v.env as NodeJS.ProcessEnv }).on("close", ok));
    expect(await salud()).not.toBe(0);
    expect((await v.pasada()).status).not.toBe(0);
    expect(textos()).toHaveLength(1);
    writeFileSync(jerarquico, "oom 0\noom_kill 0\n");
    expect((await v.pasada()).status).toBe(0);
    expect(await salud()).toBe(0);
  });
});

describe("vigía · nunca actúa y deja su latido", () => {
  it("con alerta y OOM no llama a docker, ssh ni al script de corte", async () => {
    mensajes = [];
    const v = preparar();
    await v.pasada();
    v.fijarMemoria(100);
    v.fijarOom(5);
    await v.pasada();
    expect(v.falsos.llamadas().filter((l) => ["docker", "ssh", "flock", "ps", "wget"].includes(l[0]!))).toEqual([]);
  });

  it("deja el latido en su carpeta de estado y --salud lo valida", async () => {
    const v = preparar();
    await v.pasada();
    const latido = path.join(v.estado, "latido");
    expect(existsSync(latido)).toBe(true);
    const salud = (extra: Record<string, string> = {}) =>
      new Promise<number | null>((ok) => spawn("sh", [VIGIA, "--salud"], { env: { ...v.env, ...extra } as NodeJS.ProcessEnv }).on("close", ok));
    expect(await salud()).toBe(0);
    const viejo = new Date(Date.now() - 3600_000);
    utimesSync(latido, viejo, viejo);
    expect(await salud()).not.toBe(0);
  });

  it("sin token o sin chat no arranca (falla cerrada, sin imprimir valores)", async () => {
    const v = preparar();
    const r = await v.pasada({ TELEGRAM_BOT_TOKEN: "" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).not.toContain(TOKEN);
  });
});

describe("vigía · los precios cada minuto detenidos (huella intradia del servicio de precios)", () => {
  const huella = (limitados: string, estado = "LIMITADO"): string => `formato=1\nestado=${estado}\nultimo=1800000000\ncodigo=7\nciclos=9\nfallos=4\nlimitados=${limitados}\nespera=0\n`;
  function conHuella() {
    const v = preparar();
    const precios = path.join(v.dir, "precios-estado");
    mkdirSync(precios, { recursive: true });
    const escribir = (texto: string) => writeFileSync(path.join(precios, "intradia"), texto);
    const pasada = () => v.pasada({ VIGIA_PRECIOS_ESTADO_DIR: precios });
    return { v, precios, escribir, pasada };
  }

  it("sin huella (tmpfs vacío o servicio sin ciclos) no avisa", async () => {
    mensajes = [];
    const { pasada } = conHuella();
    expect((await pasada()).status).toBe(0);
    expect(mensajes).toHaveLength(0);
  });

  it("LIMITADO con menos de 4 bloqueos seguidos no avisa: el servicio todavía está esperando", async () => {
    mensajes = [];
    const { escribir, pasada } = conHuella();
    escribir(huella("3"));
    await pasada();
    expect(mensajes).toHaveLength(0);
  });

  it("LIMITADO con 4 bloqueos seguidos avisa UNA vez (sin spam) y, al volver el servicio, avisa el RESUELTO una vez", async () => {
    mensajes = [];
    const { escribir, pasada } = conHuella();
    escribir(huella("4"));
    await pasada();
    expect(textos()).toHaveLength(1);
    expect(textos()[0]).toMatch(/precios cada minuto/i);
    expect(textos()[0]).toMatch(/4 bloqueos seguidos/);
    expect(textos()[0]).toMatch(/INV_INTRADIA_ENCENDIDO=0/);
    expect(textos()[0]).not.toContain(TOKEN);
    await pasada();
    await pasada();
    expect(textos()).toHaveLength(1);
    escribir(huella("0", "ESPERANDO"));
    await pasada();
    expect(textos()).toHaveLength(2);
    expect(textos()[1]).toMatch(/RESUELTO/);
    await pasada();
    expect(textos()).toHaveLength(2);
  });

  it("si Telegram falla, no marca el aviso como enviado: lo reintenta en la pasada siguiente", async () => {
    mensajes = [];
    const { escribir, pasada } = conHuella();
    escribir(huella("4"));
    responder = 500;
    try {
      await pasada();
    } finally {
      responder = 200;
    }
    expect(mensajes).toHaveLength(0);
    await pasada();
    expect(textos()).toHaveLength(1);
  });

  it("una huella dañada (limitados no numérico) no tumba la pasada ni avisa", async () => {
    mensajes = [];
    const { escribir, pasada } = conHuella();
    escribir(huella("abc"));
    expect((await pasada()).status).toBe(0);
    expect(mensajes).toHaveLength(0);
  });

  it("es independiente de la memoria: las dos alertas conviven, cada una con su aviso", async () => {
    mensajes = [];
    const { v, escribir, pasada } = conHuella();
    escribir(huella("4"));
    v.fijarMemoria(900);
    await pasada();
    expect(textos().filter((t) => /precios cada minuto/i.test(t))).toHaveLength(1);
    expect(textos().filter((t) => /ALERTA/.test(t) && /MemAvailable/.test(t))).toHaveLength(1);
  });
});
