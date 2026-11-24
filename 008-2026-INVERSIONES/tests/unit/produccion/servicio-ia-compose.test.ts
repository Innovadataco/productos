// Candado del servicio inv-008-ia en docker-compose.prod.yml (E6, D-026): la imagen de la app con el bundle de IA; su
// propio puente con nombre fijo (para la regla de firewall de PI) y la red interna (la base y la app); límites duros;
// solo la credencial de inv_ia y el token, opcionales (sin ellos queda EN ESPERA, no se cae); sin claves de cifrado.
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ARCHIVO_LISTA_PI, VARIABLE_DIR_COMPARTIDA } from "../../../src/ia/local/modelos";
import { HOST_SERVICIO_IA, PUERTO_SERVICIO_IA, VARIABLE_TOKEN_SERVICIO_IA } from "../../../src/ia/config/sonda-servicio";
import { leer008 } from "./falsos";

type Servicio = Record<string, unknown> & { environment?: Record<string, string>; networks?: string[]; volumes?: string[]; entrypoint?: string[]; healthcheck?: { test: string[] }; tmpfs?: string[]; ports?: unknown };
type Compose = { services: Record<string, Servicio>; networks: Record<string, { internal?: boolean; driver?: string; driver_opts?: Record<string, string>; ipam?: unknown; enable_ipv6?: boolean }>; volumes: Record<string, unknown> };

const compose = parse(leer008("docker-compose.prod.yml")) as Compose;
const ia = compose.services[HOST_SERVICIO_IA] ?? ({} as Servicio);
const app = compose.services["inv-008-app"]!;
const MONTAJE = "${INV_IA_DIR_COMPARTIDA:-inv-008-ia-sin-lista}:/compartido-pi:ro";

describe("inv-008-ia · imagen y arranque", () => {
  it("la imagen de la app, local; permanente, con init y la base sana antes", () => {
    expect(ia.image).toBe("inv-008-app:${INV_TAG:-sin-desplegar}");
    expect(ia.pull_policy).toBe("never");
    expect(ia.restart).toBe("always");
    expect(ia.init).toBe(true);
    expect(ia.depends_on).toEqual({ "inv-008-db": { condition: "service_healthy" } });
  });

  it("corre el bundle en modo bucle con 96 MiB de heap; con una imagen anterior (sin el bundle) queda en espera, no en un bucle de reinicios", () => {
    const [sh, c, script] = ia.entrypoint ?? [];
    expect([sh, c]).toEqual(["/bin/sh", "-c"]);
    expect(script).toContain("exec node --max-old-space-size=96 /app/ia/servicio-ia.mjs bucle");
    expect(script).toContain("[ -r /app/ia/servicio-ia.mjs ]");
    expect(script).toContain("sleep 3600");
    // Compose interpolaría un signo de dólar.
    expect(script).not.toContain("$");
  });

  it("salud: el latido de menos de 3 minutos (o la imagen sin el bundle), sin un segundo node", () => {
    expect(ia.healthcheck?.test).toEqual(["CMD-SHELL", "[ ! -r /app/ia/servicio-ia.mjs ] || find /estado/bucle -mmin -3 | grep -q ."]);
    expect(ia.tmpfs).toEqual(["/estado:uid=10008,gid=10008,mode=0700,size=64k,nosuid,nodev,noexec"]);
  });
});

describe("inv-008-ia · límites y endurecimiento", () => {
  it("mem = memswap = 128m, cpus 0.25, pids 64, usuario 10008, solo lectura, sin capacidades ni escalada", () => {
    expect(ia).toMatchObject({
      mem_limit: "128m", memswap_limit: "128m", cpus: 0.25, cpu_shares: 256, pids_limit: 64, user: "10008:10008", read_only: true,
      cap_drop: ["ALL"], security_opt: ["no-new-privileges:true"], ulimits: { core: 0 },
    });
  });

  it("no publica puertos: el endpoint es solo de la red interna", () => {
    expect(ia.ports).toBeUndefined();
    expect(ia.expose).toBeUndefined();
  });
});

describe("inv-008-ia · entorno y secretos", () => {
  it("solo la credencial de inv_ia y el token, OPCIONALES (${…:-}), la carpeta de la lista de PI y la zona horaria", () => {
    expect(ia.environment).toEqual({
      DATABASE_URL: "${INV_IA_DATABASE_URL:-}",
      [VARIABLE_TOKEN_SERVICIO_IA]: "${INV_IA_SERVICIO_TOKEN:-}",
      [VARIABLE_DIR_COMPARTIDA]: "/compartido-pi",
      TZ: "America/Bogota",
    });
  });

  it("sin las claves de cifrado, AUTH_SECRET, Telegram ni la llave de la nube", () => {
    expect(JSON.stringify(ia)).not.toMatch(/CIFRADO|AUTH_SECRET|TELEGRAM|ANTHROPIC|INV_DUENO|INV_APP_/);
  });

  it("el destino de Ollama no va en el compose (va en config_ia, en la base)", () => {
    expect(leer008("docker-compose.prod.yml")).not.toMatch(/OLLAMA_(HOST|URL|PUERTO)|:11434|:11435/);
  });
});

describe("inv-008-ia · redes", () => {
  it("la interna (la base y la app) y la suya, con salida y solo para él", () => {
    expect(ia.networks).toEqual(["inv-008-red-interna", "inv-008-red-ia"]);
    const usan = Object.entries(compose.services).filter(([, s]) => s.networks?.includes("inv-008-red-ia")).map(([n]) => n);
    expect(usan).toEqual([HOST_SERVICIO_IA]);
  });

  it("su puente tiene nombre fijo de 15 caracteres o menos, sin IPv6 ni ipam", () => {
    const red = compose.networks["inv-008-red-ia"]!;
    const nombre = red.driver_opts?.["com.docker.network.bridge.name"] ?? "";
    expect(nombre).toBe("br-inv008-ia");
    expect(nombre.length).toBeLessThanOrEqual(15);
    expect(red.driver).toBe("bridge");
    expect(red.internal).toBeUndefined();
    expect(red.ipam).toBeUndefined();
    expect(red.enable_ipv6).toBeUndefined();
  });

  it("la app sigue SIN salida: solo redes internal, y le habla al servicio por la interna", () => {
    expect(app.networks).toEqual(["inv-008-red-interna", "inv-008-red-entrada"]);
    for (const red of app.networks ?? []) expect(compose.networks[red]?.internal).toBe(true);
    expect(PUERTO_SERVICIO_IA).toBe(8008);
  });
});

describe("la lista de modelos de PI y el token en la app", () => {
  it("el servicio y la app montan la carpeta compartida de PI en solo lectura; sin configurar, un volumen vacío (sin lista, sin caerse)", () => {
    expect(ia.volumes).toEqual([MONTAJE]);
    expect(app.volumes).toEqual([MONTAJE]);
    expect(compose.volumes).toHaveProperty("inv-008-ia-sin-lista");
    expect(ARCHIVO_LISTA_PI).toBe("modelos-ia-local-permitidos.json");
  });

  it("la app recibe el token (opcional) y la carpeta de la lista; nunca la credencial de inv_ia", () => {
    expect(app.environment?.[VARIABLE_TOKEN_SERVICIO_IA]).toBe("${INV_IA_SERVICIO_TOKEN:-}");
    expect(app.environment?.[VARIABLE_DIR_COMPARTIDA]).toBe("/compartido-pi");
    expect(JSON.stringify(app.environment)).not.toContain("INV_IA_DATABASE_URL");
  });
});
