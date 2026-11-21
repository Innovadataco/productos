// El relé TCP de inv-008-entrada (docker-compose.prod.yml) se EJECUTA de verdad con el node de la prueba: el mismo
// texto que corre en producción (`node -e`), contra un eco local. La entrada es la única pieza con el puerto del
// túnel; la app queda solo en redes internal, sin salida a internet. Es capa 4: copia bytes sin leer el HTTP, así
// que Cf-Connecting-IP (los topes por IP), las cabeceras de seguridad y el Host llegan tal cual.
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import { leer008 } from "./falsos";

vi.setConfig({ testTimeout: 20_000 });

type Servicio = { entrypoint?: string[] };
const compose = parse(leer008("docker-compose.prod.yml")) as { services: Record<string, Servicio> };
const ENTRYPOINT = compose.services["inv-008-entrada"]?.entrypoint ?? [];
const POSICION_E = ENTRYPOINT.indexOf("-e");
const SCRIPT = POSICION_E >= 0 ? (ENTRYPOINT[POSICION_E + 1] ?? "") : "";
const ARGUMENTOS_PROD = POSICION_E >= 0 ? ENTRYPOINT.slice(POSICION_E + 2) : [];

// El relé corre sin ninguna variable de entorno, como en el compose.
const SIN_ENTORNO = {} as NodeJS.ProcessEnv;

const vivos: Array<ChildProcess | net.Server | net.Socket> = [];
afterEach(() => {
  for (const x of vivos.splice(0)) {
    if (x instanceof net.Server) x.close();
    else if (x instanceof net.Socket) x.destroy();
    else x.kill("SIGKILL");
  }
});

async function puertoLibre(): Promise<number> {
  const s = net.createServer();
  await new Promise<void>((ok) => s.listen(0, "127.0.0.1", ok));
  const { port } = s.address() as net.AddressInfo;
  await new Promise<void>((ok) => s.close(() => ok()));
  return port;
}

/** Eco: guarda lo que llega por conexión y, cuando el cliente termina de mandar, responde `respuesta` y cierra. */
async function eco(respuesta: Buffer, puerto = 0, alConectar?: (s: net.Socket) => void) {
  const recibidos: Buffer[] = [];
  const servidor = net.createServer({ allowHalfOpen: true }, (s) => {
    vivos.push(s);
    const partes: Buffer[] = [];
    s.on("data", (c: Buffer) => partes.push(c));
    s.on("end", () => {
      recibidos.push(Buffer.concat(partes));
      s.end(respuesta);
    });
    s.on("error", () => undefined);
    alConectar?.(s);
  });
  vivos.push(servidor);
  await new Promise<void>((ok) => servidor.listen(puerto, "127.0.0.1", ok));
  return { puerto: (servidor.address() as net.AddressInfo).port, recibidos };
}

type Rele = { puerto: number; salida: () => string; proceso: ChildProcess };

/** Arranca el relé con el script del compose: destino, puerto del destino, puerto propio, inactividad y máximo. */
async function rele(puertoDestino: number, opciones: { inactivoS?: string; maximo?: string } = {}): Promise<Rele> {
  const puerto = await puertoLibre();
  const args = ["-e", SCRIPT, "127.0.0.1", String(puertoDestino), String(puerto), opciones.inactivoS ?? "120", opciones.maximo ?? "64"];
  const proceso = spawn(process.execPath, args, { env: SIN_ENTORNO });
  vivos.push(proceso);
  let salida = "";
  proceso.stdout.on("data", (c: Buffer) => (salida += c));
  proceso.stderr.on("data", (c: Buffer) => (salida += c));
  await new Promise<void>((ok, mal) => {
    const reloj = setTimeout(() => mal(new Error(`el relé no quedó listo: ${salida}`)), 5_000);
    const mirar = () => {
      if (salida.includes("listo")) {
        clearTimeout(reloj);
        ok();
      }
    };
    proceso.stdout.on("data", mirar);
    proceso.once("exit", (codigo) => mal(new Error(`el relé salió con ${codigo}: ${salida}`)));
  });
  return { puerto, salida: () => salida, proceso };
}

/** Manda `pedido`, cierra la escritura y devuelve todo lo que llegó hasta el cierre. */
async function pedir(puerto: number, pedido: Buffer): Promise<Buffer> {
  return new Promise((ok, mal) => {
    const partes: Buffer[] = [];
    const s = net.connect({ host: "127.0.0.1", port: puerto, allowHalfOpen: true }, () => s.end(pedido));
    vivos.push(s);
    s.on("data", (c: Buffer) => partes.push(c));
    s.on("end", () => ok(Buffer.concat(partes)));
    s.on("error", mal);
  });
}

/** Milisegundos hasta que el relé cierra una conexión abierta sin mandar nada (o `tope` si no la cierra). */
async function msHastaCierre(puerto: number, tope: number): Promise<number> {
  return new Promise((ok) => {
    const inicio = Date.now();
    const s = net.connect({ host: "127.0.0.1", port: puerto });
    vivos.push(s);
    const reloj = setTimeout(() => ok(tope), tope);
    s.on("error", () => undefined);
    s.on("close", () => {
      clearTimeout(reloj);
      ok(Date.now() - inicio);
    });
  });
}

const PEDIDO = Buffer.from(
  [
    "GET /ingresar?x=1 HTTP/1.1",
    "Host: inversiones.ficticio.test",
    "Cf-Connecting-IP: 203.0.113.7",
    "X-Forwarded-For: 198.51.100.9",
    "X-Forwarded-Proto: https",
    "Cf-Ray: 0000000000000000-BOG",
    "",
    "",
  ].join("\r\n"),
);
const RESPUESTA = Buffer.from(
  [
    "HTTP/1.1 307 Temporary Redirect",
    "location: https://inversiones.ficticio.test/ingresar",
    "content-security-policy: default-src 'self'",
    "strict-transport-security: max-age=63072000; includeSubDomains; preload",
    "content-length: 0",
    "",
    "",
  ].join("\r\n"),
);

describe("inv-008-entrada · el relé del compose (argumentos de producción)", () => {
  it("node con el heap acotado y el script en línea: destino inv-008-app:5008, escucha 5008, inactividad 120 s y 64 conexiones", () => {
    expect(ENTRYPOINT.slice(0, POSICION_E + 1)).toEqual(["node", "--max-old-space-size=16", "-e"]);
    expect(ARGUMENTOS_PROD).toEqual(["inv-008-app", "5008", "5008", "120", "64"]);
  });

  it("el script no trae `$` (Compose lo interpolaría) ni lee variables de entorno, y no abre otra cosa que el puerto", () => {
    expect(SCRIPT.length).toBeGreaterThan(0);
    expect(SCRIPT).not.toContain("$");
    expect(SCRIPT).not.toMatch(/process\.env/);
    expect(SCRIPT).not.toMatch(/require\("node:(?:http|https|child_process|fs|dgram)"\)/);
    expect(SCRIPT.match(/\.listen\(/g)).toHaveLength(1);
  });
});

describe("inv-008-entrada · el relé ejecutado contra un eco", () => {
  it("pasa el pedido y la respuesta byte a byte: Host, Cf-Connecting-IP y X-Forwarded-For tal cual, sin cabeceras nuevas", async () => {
    const app = await eco(RESPUESTA);
    const r = await rele(app.puerto);
    const respuesta = await pedir(r.puerto, PEDIDO);
    expect(app.recibidos).toHaveLength(1);
    expect(app.recibidos[0]!.equals(PEDIDO)).toBe(true);
    expect(respuesta.equals(RESPUESTA)).toBe(true);
  });

  it("una respuesta grande que la app cierra apenas manda llega completa (no se pierde lo que estaba en camino)", async () => {
    const grande = Buffer.alloc(4 * 1024 * 1024, 7);
    const app = await eco(grande);
    const r = await rele(app.puerto);
    const respuesta = await pedir(r.puerto, PEDIDO);
    expect(respuesta.length).toBe(grande.length);
    expect(respuesta.equals(grande)).toBe(true);
  });

  it("no registra nada del cliente: ni la IP de Cf-Connecting-IP ni el pedido", async () => {
    const app = await eco(RESPUESTA);
    const r = await rele(app.puerto);
    await pedir(r.puerto, PEDIDO);
    expect(r.salida()).not.toMatch(/203\.0\.113\.7|ingresar|GET |Cf-Connecting|Cf-Ray/);
  });

  it("con la app caída, cierra la conexión del cliente enseguida y sigue atendiendo cuando la app vuelve", async () => {
    const destino = await puertoLibre();
    const r = await rele(destino);
    expect(await msHastaCierre(r.puerto, 3_000)).toBeLessThan(3_000);
    const app = await eco(RESPUESTA, destino);
    expect((await pedir(r.puerto, PEDIDO)).equals(RESPUESTA)).toBe(true);
    expect(app.recibidos).toHaveLength(1);
  });

  it("corta una conexión quieta pasado el plazo de inactividad", async () => {
    const app = await eco(RESPUESTA);
    const r = await rele(app.puerto, { inactivoS: "1" });
    const ms = await msHastaCierre(r.puerto, 5_000);
    expect(ms).toBeGreaterThanOrEqual(900);
    expect(ms).toBeLessThan(5_000);
  });

  it("no acepta más conexiones que el máximo: la de más se cierra y las otras siguen", async () => {
    const abiertas: net.Socket[] = [];
    const app = await eco(RESPUESTA, 0, (s) => abiertas.push(s));
    const r = await rele(app.puerto, { maximo: "2" });
    const primeras = [net.connect({ host: "127.0.0.1", port: r.puerto }), net.connect({ host: "127.0.0.1", port: r.puerto })];
    for (const s of primeras) {
      vivos.push(s);
      s.on("error", () => undefined);
    }
    await vi.waitFor(() => expect(abiertas).toHaveLength(2), { timeout: 3_000 });
    expect(await msHastaCierre(r.puerto, 3_000)).toBeLessThan(3_000);
    expect(primeras.every((s) => !s.destroyed)).toBe(true);
  });

  it("con argumentos inválidos no arranca (sale con 64) y lo dice sin eco de lo recibido", async () => {
    for (const args of [["inv-008-app", "5008", "5008", "120"], ["inv-008-app;x", "5008", "5008", "120", "64"], ["inv-008-app", "0", "5008", "120", "64"], ["inv-008-app", "5008", "5008", "0", "64"]]) {
      const proceso = spawn(process.execPath, ["-e", SCRIPT, ...args], { env: SIN_ENTORNO });
      vivos.push(proceso);
      let salida = "";
      proceso.stderr.on("data", (c: Buffer) => (salida += c));
      const codigo = await new Promise<number | null>((ok) => proceso.on("exit", ok));
      expect(codigo, args.join(" ")).toBe(64);
      expect(salida).toMatch(/argumentos inválidos/);
      expect(salida).not.toContain(";x");
    }
  });
});
