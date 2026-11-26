// Candado del servicio inv-008-alertas en docker-compose.prod.yml (contenedor propio, la misma imagen de la app con otro
// entrypoint): SOLO en la red interna (sin salida a internet, sin puertos), límites duros de 64 MiB, solo su credencial (el rol
// inv_alertas) y el mismo interruptor del intradía que el servicio de precios. Sin la credencial queda EN ESPERA, no se cae.
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { leer008 } from "./falsos";

type Servicio = Record<string, unknown> & { environment?: Record<string, string>; networks?: string[]; volumes?: string[]; entrypoint?: string[]; healthcheck?: { test: string[] }; tmpfs?: string[]; ports?: unknown };
type Compose = { services: Record<string, Servicio>; networks: Record<string, { internal?: boolean }>; volumes: Record<string, { driver?: string; driver_opts?: Record<string, string> } | null> };

const crudo = leer008("docker-compose.prod.yml");
const compose = parse(crudo) as Compose;
const alertas = compose.services["inv-008-alertas"] ?? ({} as Servicio);
const precios = compose.services["inv-008-precios"]!;
const BUNDLE = "/app/alertas/servicio-alertas.mjs";

describe("inv-008-alertas · imagen y arranque", () => {
  it("la imagen de la app, local; permanente, con init y la base sana antes", () => {
    expect(alertas.image).toBe("inv-008-app:${INV_TAG:-sin-desplegar}");
    expect(alertas.pull_policy).toBe("never");
    expect(alertas.restart).toBe("always");
    expect(alertas.init).toBe(true);
    expect(alertas.depends_on).toEqual({ "inv-008-db": { condition: "service_healthy" } });
    expect(alertas.user).toBe("10008:10008");
  });

  it("corre el bundle en modo bucle con un heap bajo; con una imagen anterior (sin el bundle) queda en espera, no en un bucle de reinicios", () => {
    const [sh, c, script] = alertas.entrypoint ?? [];
    expect([sh, c]).toEqual(["/bin/sh", "-c"]);
    expect(script).toMatch(new RegExp(`exec node --max-old-space-size=(3\\d|4\\d) ${BUNDLE.replaceAll("/", "\\/")} bucle`));
    expect(script).toContain(`[ -r ${BUNDLE} ]`);
    expect(script).toContain("sleep 3600");
    // Compose interpolaría un signo de dólar.
    expect(script).not.toContain("$");
  });

  it("salud: el latido de menos de 3 minutos (o la imagen sin el bundle)", () => {
    expect(alertas.healthcheck?.test).toEqual(["CMD-SHELL", `[ ! -r ${BUNDLE} ] || find /estado/bucle -mmin -3 | grep -q .`]);
  });

  it("/estado es un VOLUMEN NOMBRADO propio, de disco (no tmpfs): la marca del intento del cierre sobrevive a los reinicios del contenedor", () => {
    expect(alertas.volumes).toEqual(["inv-008-alertas-estado:/estado"]);
    expect(alertas.tmpfs).toBeUndefined();
    expect(compose.volumes).toHaveProperty("inv-008-alertas-estado");
    const v = compose.volumes["inv-008-alertas-estado"];
    expect(v?.driver_opts?.type).toBeUndefined();
    const usan = Object.entries(compose.services).filter(([, s]) => JSON.stringify(s.volumes ?? []).includes("inv-008-alertas-estado")).map(([n]) => n);
    expect(usan).toEqual(["inv-008-alertas"]);
  });
});

describe("inv-008-alertas · límites y endurecimiento", () => {
  it("mem = memswap = 64m, cpus y cpu_shares bajos, pids acotado, solo lectura, sin capacidades ni escalada", () => {
    expect(alertas).toMatchObject({ mem_limit: "64m", memswap_limit: "64m", read_only: true, cap_drop: ["ALL"], security_opt: ["no-new-privileges:true"], ulimits: { core: 0 } });
    expect(alertas.cpus as number).toBeGreaterThan(0);
    expect(alertas.cpus as number).toBeLessThanOrEqual(0.1);
    expect(alertas.cpu_shares as number).toBeLessThanOrEqual(128);
    expect(alertas.pids_limit as number).toBeGreaterThan(0);
    expect(alertas.pids_limit as number).toBeLessThanOrEqual(64);
  });

  it("no publica ni expone puertos", () => {
    expect(alertas.ports).toBeUndefined();
    expect(alertas.expose).toBeUndefined();
  });

  it("registro acotado, como los demás servicios", () => {
    expect(alertas.logging).toEqual({ driver: "json-file", options: { "max-size": "10m", "max-file": "5" } });
  });
});

describe("inv-008-alertas · solo la red interna (sin salida a internet)", () => {
  it("su única red es inv-008-red-interna, que es internal", () => {
    expect(alertas.networks).toEqual(["inv-008-red-interna"]);
    expect(compose.networks["inv-008-red-interna"]?.internal).toBe(true);
  });

  it("no usa las redes con salida (precios, IA, la pública), y las que ya había no ganan miembros", () => {
    for (const red of ["inv-008-red", "inv-008-red-precios", "inv-008-red-ia"]) {
      expect(alertas.networks).not.toContain(red);
      const usan = Object.entries(compose.services).filter(([, s]) => s.networks?.includes(red)).map(([n]) => n);
      expect(usan).not.toContain("inv-008-alertas");
    }
  });

  it("no hay una red nueva para el servicio", () => {
    expect(Object.keys(compose.networks).sort()).toEqual(["inv-008-red", "inv-008-red-entrada", "inv-008-red-ia", "inv-008-red-interna", "inv-008-red-precios"]);
  });
});

describe("inv-008-alertas · entorno y secretos", () => {
  it("solo su credencial (OPCIONAL, ${…:-}), el interruptor del intradía y la zona horaria", () => {
    expect(alertas.environment).toEqual({
      DATABASE_URL: "${INV_ALERTAS_DATABASE_URL:-}",
      INV_INTRADIA_ENCENDIDO: "${INV_INTRADIA_ENCENDIDO:-}",
      TZ: "America/Bogota",
    });
  });

  it("el interruptor del intradía es EXACTAMENTE el del servicio de precios (la misma variable del archivo de producción)", () => {
    expect(alertas.environment?.INV_INTRADIA_ENCENDIDO).toBe(precios.environment?.INV_INTRADIA_ENCENDIDO);
    expect(precios.environment?.INV_INTRADIA_ENCENDIDO).toBe("${INV_INTRADIA_ENCENDIDO:-}");
  });

  it("sin alias ni anclas de YAML: desplegar-prod.sh no podría comparar el compose para decidir la espera de la medición", () => {
    expect(crudo).not.toMatch(/^\s*(- +)?[\w.-]+:\s*[*&]/m);
    expect(crudo).not.toMatch(/^\s*<<\s*:/m);
  });

  it("la credencial de las alertas no la ve ningún otro servicio, y precios sigue con una sola credencial", () => {
    const con = Object.entries(compose.services).filter(([, s]) => JSON.stringify(s).includes("INV_ALERTAS_DATABASE_URL")).map(([n]) => n);
    expect(con).toEqual(["inv-008-alertas"]);
    expect(precios.environment?.DATABASE_URL).toBe("${INV_PRECIOS_DATABASE_URL:-}");
  });

  it("sin claves de cifrado, AUTH_SECRET, Telegram, la llave de la nube ni credenciales de otros roles", () => {
    expect(JSON.stringify(alertas)).not.toMatch(/CIFRADO|AUTH_SECRET|TELEGRAM|ANTHROPIC|INV_DUENO|INV_APP_|INV_PRECIOS_|INV_IA_/);
  });
});
