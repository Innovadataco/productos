// Candado del servicio inv-008-precios en docker-compose.prod.yml (D-018, GATE 1 del CEO y del CEO de PI): la imagen de
// la app con otro entrypoint y el modo «bucle»; solo la credencial de inv_precios, con ${…:-} (sin el secreto NO se cae:
// un :? rompería la pausa y los up de todo el proyecto); endurecido; la red interna para la base y una red NUEVA con
// salida solo para él (del pool de Docker); la huella en un volumen tmpfs para el vigía (PR 4). Lo común de todos los
// servicios (endurecimiento, logs, core 0) lo revisa compose-prod.test.ts.
import { spawnSync } from "node:child_process";
import { mkdirSync, utimesSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ARCHIVO_BUCLE, ESTADO_DIR_POR_DEFECTO } from "../../../src/servicio-precios/estado";
import { GRACIA_MS } from "../../../src/servicio-precios/tareas";
import { TIC_MS } from "../../../src/servicio-precios/bucle";
import { carpetaTemporal, leer008 } from "./falsos";

type Servicio = Record<string, unknown> & {
  image?: string;
  entrypoint?: string[];
  command?: string[];
  environment?: Record<string, string>;
  networks?: string[];
  volumes?: string[];
  healthcheck?: { test: string[]; interval?: string; timeout?: string; retries?: number; start_period?: string };
  depends_on?: Record<string, { condition: string }>;
};
type Red = { internal?: boolean; driver?: string; driver_opts?: Record<string, string>; ipam?: unknown; enable_ipv6?: boolean };
type Compose = { services: Record<string, Servicio>; networks: Record<string, Red>; volumes: Record<string, { driver?: string; driver_opts?: Record<string, string> } | null> };

const texto = leer008("docker-compose.prod.yml");
const compose = parse(texto) as Compose;
/** Lo que Compose interpreta: sin las líneas de comentario. */
const sinComentarios = texto
  .split("\n")
  .filter((l) => !l.trim().startsWith("#"))
  .join("\n");
const precios = compose.services["inv-008-precios"] ?? ({} as Servicio);
const segundos = (t: unknown): number => {
  const m = /^(\d+)(s|m)$/.exec(String(t));
  if (!m) throw new Error(`duración sin entender: ${String(t)}`);
  return Number(m[1]) * (m[2] === "m" ? 60 : 1);
};

describe("inv-008-precios · imagen, arranque y modo", () => {
  it("existe y usa la imagen de la app, local (nunca descargada)", () => {
    expect(precios.image).toBe("inv-008-app:${INV_TAG:-sin-desplegar}");
    expect(precios.pull_policy).toBe("never");
  });

  it("entrypoint node --max-old-space-size=64 con el bundle de la imagen, y el modo bucle como comando", () => {
    expect(precios.entrypoint).toEqual(["node", "--max-old-space-size=64", "/app/precios/servicio-precios.mjs"]);
    expect(precios.command).toEqual(["bucle"]);
  });

  it("permanente: restart always, con init (las señales llegan al bucle) y la base sana antes de arrancar", () => {
    expect(precios.restart).toBe("always");
    expect(precios.init).toBe(true);
    expect(precios.profiles).toBeUndefined();
    expect(precios.depends_on).toEqual({ "inv-008-db": { condition: "service_healthy" } });
  });

  it("le da tiempo al bucle para detener al hijo (SIGTERM, gracia y SIGKILL) antes de que Docker lo mate", () => {
    expect(segundos(precios.stop_grace_period)).toBeGreaterThanOrEqual(GRACIA_MS / 1000 + 5);
  });
});

describe("inv-008-precios · solo la credencial de inv_precios (sin el secreto no se cae)", () => {
  it("su entorno es DATABASE_URL, TZ y las 7 variables INV_INTRADIA_* del ciclo por minuto: ni claves de cifrado, ni AUTH_SECRET, ni Telegram, ni age", () => {
    expect(Object.keys(precios.environment ?? {}).sort()).toEqual(
      [
        "DATABASE_URL", "TZ", "INV_INTRADIA_CICLO_SEG", "INV_INTRADIA_DESDE_COT", "INV_INTRADIA_ENCENDIDO", "INV_INTRADIA_HASTA_COT", "INV_INTRADIA_PAUSA_MS",
        "INV_INTRADIA_RETENCION_DIAS", "INV_INTRADIA_URL_YAHOO",
      ].sort(),
    );
    expect(precios.environment?.TZ).toBe("America/Bogota");
    // Todas opcionales (${…:-valor}), nunca obligatorias (:?): sin ellas el servicio arranca igual, con los valores por omisión.
    for (const [nombre, valor] of Object.entries(precios.environment ?? {}).filter(([n]) => n.startsWith("INV_INTRADIA_"))) {
      expect(valor, nombre).toMatch(new RegExp(`^\\$\\{${nombre}:-[^}]*\\}$`));
    }
    expect(precios.environment?.INV_INTRADIA_ENCENDIDO).toBe("${INV_INTRADIA_ENCENDIDO:-1}");
    expect(precios.environment?.INV_INTRADIA_CICLO_SEG).toBe("${INV_INTRADIA_CICLO_SEG:-60}");
    expect(JSON.stringify(precios)).not.toMatch(/CIFRADO|AUTH_SECRET|TELEGRAM|AGE_|POSTGRES_PASSWORD|INV_DUENO|INV_APP/);
  });

  it("DATABASE_URL es ${INV_PRECIOS_DATABASE_URL:-}: vacía si falta, nunca obligatoria (:?) ni con un valor escrito", () => {
    expect(precios.environment?.DATABASE_URL).toBe("${INV_PRECIOS_DATABASE_URL:-}");
    expect(texto).not.toMatch(/INV_PRECIOS_DATABASE_URL:\?/);
    expect(sinComentarios.match(/INV_PRECIOS_DATABASE_URL/g)).toHaveLength(1);
  });

  it("el compose se interpola SIN la variable (como en la pausa y antes del secreto) y el servicio queda con DATABASE_URL vacía", () => {
    const vars = path.join(carpetaTemporal("compose-precios"), "prueba.ficticio.vars");
    writeFileSync(
      vars,
      [
        "INV_POSTGRES_CLAVE=clave-ficticia", "INV_APP_DATABASE_URL=postgresql://ficticio:ficticio@inv-008-db:5432/ficticia_test",
        "INV_DUENO_DATABASE_URL=postgresql://ficticio:ficticio@inv-008-db:5432/ficticia_test", "INV_AUTH_SECRET=ficticio",
        "INV_CIFRADO_CLAVE_ACTIVA=v1", "INV_CIFRADO_CLAVE_V1=ficticia", "APP_ORIGEN=https://ficticio.invalid", "INV_AGE_PUBLICA=age1ficticia",
        "INV_RESPALDO_GID=14613", "INV_TELEGRAM_BOT_TOKEN=ficticio", "INV_TELEGRAM_CHAT_ID=1237", "",
      ].join("\n"),
    );
    const r = spawnSync("docker", ["compose", "-p", "inv-008-prueba", "-f", "-", "--env-file", vars, "config", "--format", "json", "inv-008-precios"], {
      input: texto,
      encoding: "utf8",
      env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", NODE_ENV: "test" },
    });
    if (r.error || /unknown (shorthand )?flag|is not a docker command/.test(r.stderr)) return; // sin docker compose (p. ej. en el CI): lo cubre el texto
    expect(r.status, r.stderr).toBe(0);
    const env = (JSON.parse(r.stdout) as { services: Record<string, { environment: Record<string, string | null> }> }).services["inv-008-precios"]?.environment;
    expect(env?.DATABASE_URL ?? "").toBe("");
  });
});

describe("inv-008-precios · endurecimiento y límites (diseño aprobado)", () => {
  it("no root, solo lectura, sin capacidades ni escalada, sin puertos y sin volcados de memoria", () => {
    expect(precios.user).toBe("10008:10008");
    expect(precios.read_only).toBe(true);
    expect(precios.cap_drop).toEqual(["ALL"]);
    expect(precios.cap_add).toBeUndefined();
    expect(precios.privileged).toBeUndefined();
    expect(precios.security_opt).toEqual(["no-new-privileges:true"]);
    expect(precios.ports).toBeUndefined();
    expect(precios.ulimits).toEqual({ core: 0 });
    expect(precios.tmpfs).toBeUndefined();
  });

  it("96m de memoria sin swap (mem_limit = memswap_limit), 64 pids, 0.25 CPU y cpu_shares 256 (PI tiene prioridad)", () => {
    expect(precios.mem_limit).toBe("96m");
    expect(precios.memswap_limit).toBe("96m");
    expect(precios.pids_limit).toBe(64);
    expect(precios.cpus).toBe(0.25);
    expect(precios.cpu_shares).toBe(256);
  });
});

describe("inv-008-precios · redes: la interna para la base y una nueva con salida solo para él", () => {
  it("está en la red interna (la base) y en inv-008-red-precios, nada más (ni la de la entrada ni inv-008-red)", () => {
    expect(precios.networks).toEqual(["inv-008-red-interna", "inv-008-red-precios"]);
  });

  it("inv-008-red-precios es un puente con salida, con la subred del pool de Docker (sin ipam), sin IPv6 y sin aislar la puerta de enlace", () => {
    const red = compose.networks["inv-008-red-precios"];
    expect(red).toEqual({ driver: "bridge", driver_opts: { "com.docker.network.bridge.name": "br-inv008-prec" } });
    expect(red?.internal).toBeUndefined();
    expect(red?.ipam).toBeUndefined();
    expect(red?.enable_ipv6).toBeUndefined();
  });

  it("el puente tiene nombre fijo, br-inv008-prec (pedido de PI para su regla de firewall del host): cabe en los 15 caracteres de Linux y no lo repite otra red", () => {
    const nombre = compose.networks["inv-008-red-precios"]?.driver_opts?.["com.docker.network.bridge.name"] ?? "";
    expect(nombre).toBe("br-inv008-prec");
    expect(nombre.length).toBeLessThanOrEqual(15);
    expect(nombre).toMatch(/^[a-z0-9-]+$/);
    const otros = Object.entries(compose.networks).filter(([n]) => n !== "inv-008-red-precios").map(([, r]) => r.driver_opts?.["com.docker.network.bridge.name"]);
    expect(otros).not.toContain(nombre);
  });

  it("solo él usa inv-008-red-precios", () => {
    const quienes = Object.entries(compose.services).filter(([, s]) => (s.networks ?? []).includes("inv-008-red-precios")).map(([n]) => n);
    expect(quienes).toEqual(["inv-008-precios"]);
  });

  it("no hay ninguna red llamada app_default ni externa", () => {
    expect(Object.keys(compose.networks)).not.toContain("app_default");
    expect(sinComentarios).not.toMatch(/app_default|external:/);
  });
});

describe("inv-008-precios · la huella para el vigía (PR 4)", () => {
  it("monta solo el volumen inv-008-precios-estado en /estado (la carpeta por defecto del servicio)", () => {
    expect(precios.volumes).toEqual([`inv-008-precios-estado:${ESTADO_DIR_POR_DEFECTO}`]);
  });

  it("el volumen es un tmpfs local de 64k del usuario 10008 (0700), nosuid, nodev y noexec: sin disco y sin crecer", () => {
    expect(compose.volumes["inv-008-precios-estado"]).toEqual({
      driver: "local",
      driver_opts: { type: "tmpfs", device: "tmpfs", o: "size=64k,uid=10008,gid=10008,mode=0700,nosuid,nodev,noexec" },
    });
  });

  it("healthcheck: el latido (archivo bucle) de menos de 3 minutos, con el find y el grep de busybox, sin $ (Compose lo interpolaría)", () => {
    expect(precios.healthcheck?.test).toEqual(["CMD-SHELL", `find ${ESTADO_DIR_POR_DEFECTO}/${ARCHIVO_BUCLE} -mmin -3 | grep -q .`]);
    expect(JSON.stringify(precios.healthcheck)).not.toMatch(/\$|\bnode\b/);
    expect(TIC_MS).toBeLessThan(3 * 60_000);
    expect(precios.healthcheck).toMatchObject({ interval: "60s", timeout: "5s", retries: 3, start_period: "30s" });
  });

  it("el comando del healthcheck muerde: latido fresco → 0; de 4 minutos o ausente → distinto de 0", () => {
    const comando = precios.healthcheck?.test[1] ?? "";
    const dir = carpetaTemporal("salud-precios");
    const latido = path.join(dir, "estado", ARCHIVO_BUCLE);
    const correr = () => spawnSync("sh", ["-c", comando.replace(ESTADO_DIR_POR_DEFECTO, path.join(dir, "estado"))], { encoding: "utf8" }).status;
    mkdirSync(path.dirname(latido));
    expect(correr()).not.toBe(0);
    writeFileSync(latido, "formato=1\n");
    expect(correr()).toBe(0);
    const viejo = new Date(Date.now() - 4 * 60_000);
    utimesSync(latido, viejo, viejo);
    expect(correr()).not.toBe(0);
  });
});
