// Candado del docker-compose.prod.yml de Inversiones en el VPS compartido con PI: proyecto, red y base
// propios, la app solo en 127.0.0.1:5008, endurecimiento, límites con mem = memswap, cpu_shares bajo y
// cada servicio con solo sus variables (el archivo de producción es solo para interpolar).
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { funcion, leer008, ruta008 } from "./falsos";

// El valor por defecto de la carpeta de respaldos: una ruta que no existe (el script la define en un solo lugar).
const CENTINELA = funcion(ruta008("scripts/produccion-comun.sh"), 'printf "%s" "$INV_RESPALDOS_CENTINELA"').stdout;
// La carpeta de respaldos entra por un volumen local que la monta con bind, nosuid y noexec (pedido del CEO de PI):
// el bind corto no acepta esas opciones. Su origen es la carpeta de la configuración, interpolada.
const VOLUMEN_RESPALDOS = "inv-008-respaldos";
const DEVICE_RESPALDOS = `\${INV_RESPALDOS_DIR:-${CENTINELA}}`;
const MONTAJE_RESPALDOS = `${VOLUMEN_RESPALDOS}:/respaldos`;

type Servicio = {
  image: string;
  pull_policy?: string;
  user?: string;
  restart?: string;
  read_only?: boolean;
  tmpfs?: string[];
  cap_drop?: string[];
  cap_add?: string[];
  security_opt?: string[];
  mem_limit?: string;
  memswap_limit?: string;
  cpu_shares?: number;
  cpus?: number;
  ports?: string[];
  networks?: string[];
  network_mode?: string;
  environment?: Record<string, string>;
  env_file?: unknown;
  volumes?: Array<string | Bind>;
  ulimits?: Record<string, number>;
  healthcheck?: { test: string[] };
  logging?: { driver: string; options?: Record<string, string> };
  profiles?: string[];
  privileged?: boolean;
  links?: unknown;
  group_add?: unknown;
  secrets?: unknown;
};
type Bind = { type: string; source: string; target: string; read_only?: boolean };
type Volumen = { driver?: string; driver_opts?: Record<string, string>; external?: boolean; name?: string };
type Compose = {
  name: string;
  services: Record<string, Servicio>;
  networks: Record<string, { internal?: boolean; external?: boolean }>;
  volumes: Record<string, Volumen | null>;
  secrets?: unknown;
};

const texto = leer008("docker-compose.prod.yml");
const compose = parse(texto) as Compose;
const s = (nombre: string): Servicio => {
  const srv = compose.services[nombre];
  if (!srv) throw new Error(`falta el servicio ${nombre}`);
  return srv;
};
const SERVICIOS = ["inv-008-db", "inv-008-app", "inv-008-migrador", "inv-008-respaldo", "inv-008-vigia"];

describe("docker-compose.prod.yml · proyecto, red y base propios", () => {
  it("es el proyecto inv-008-prod, distinto del de desarrollo (inv-008)", () => {
    expect(compose.name).toBe("inv-008-prod");
  });

  it("tiene exactamente sus 5 servicios", () => {
    expect(Object.keys(compose.services).sort()).toEqual([...SERVICIOS].sort());
  });

  it("la base no publica ningún puerto y vive solo en la red interna", () => {
    expect(s("inv-008-db").ports).toBeUndefined();
    expect(s("inv-008-db").networks).toEqual(["inv-008-red-interna"]);
    expect(compose.networks["inv-008-red-interna"]?.internal).toBe(true);
  });

  it("la app publica solo 127.0.0.1:5008 (nunca 0.0.0.0)", () => {
    expect(s("inv-008-app").ports).toEqual(["127.0.0.1:5008:5008"]);
    for (const [nombre, srv] of Object.entries(compose.services)) {
      if (nombre !== "inv-008-app") expect(srv.ports, nombre).toBeUndefined();
    }
  });

  it("ninguna red es externa (no se une a las redes de PI) y nadie usa links ni nombra a PI, BI, Gesmovil o Hermes", () => {
    for (const red of Object.values(compose.networks)) expect(red.external).toBeUndefined();
    for (const srv of Object.values(compose.services)) expect(srv.links).toBeUndefined();
    // Sobre lo que Compose interpreta (sin comentarios).
    expect(JSON.stringify(compose)).not.toMatch(/\bpi[-_]|\bbi[-_]|proteccion|gesmovil|hermes|docker\.sock|\/var\/lib\/docker/i);
  });

  it("el vigía no tiene el socket de Docker: solo /proc/meminfo y /sys/fs/cgroup en solo lectura, y la red con salida", () => {
    expect(s("inv-008-vigia").volumes).toEqual(["/proc/meminfo:/host/meminfo:ro", "/sys/fs/cgroup:/host/cgroup:ro"]);
    expect(s("inv-008-vigia").networks).toEqual(["inv-008-red"]);
    expect((s("inv-008-vigia") as { cpus?: number }).cpus).toBe(0.05);
    expect(s("inv-008-respaldo").volumes).toEqual([MONTAJE_RESPALDOS]);
    for (const [nombre, srv] of Object.entries(compose.services)) {
      if (!["inv-008-vigia", "inv-008-db", "inv-008-respaldo"].includes(nombre)) expect(srv.volumes, nombre).toBeUndefined();
    }
  });

  it("vigía y respaldo usan la imagen mínima inv-008-vigia (sin node); app y migrador, las suyas", () => {
    expect(s("inv-008-vigia").image).toBe("inv-008-vigia:${INV_TAG:-sin-desplegar}");
    expect(s("inv-008-respaldo").image).toBe("inv-008-vigia:${INV_TAG:-sin-desplegar}");
    expect(s("inv-008-app").image).toBe("inv-008-app:${INV_TAG:-sin-desplegar}");
    expect(s("inv-008-migrador").image).toBe("inv-008-migrador:${INV_TAG:-sin-desplegar}");
  });

  it("ÚNICA excepción a «no root»: el respaldo corre como root DEL CONTENEDOR con el grupo respaldo, sin ninguna capacidad", () => {
    // Así deja los archivos root:respaldo 0640 en la carpeta root:respaldo 750 que montó el CEO de PI, sin
    // pedirle cambiarla. Sin capacidades, ese root no salta permisos (DAC) ni cambia dueños: solo escribe
    // donde root ya es dueño, y su único bind de escritura es la carpeta de respaldos (de la configuración).
    const r = s("inv-008-respaldo");
    expect(r.user).toBe("0:${INV_RESPALDO_GID:?falta INV_RESPALDO_GID}");
    expect(r.cap_drop).toEqual(["ALL"]);
    expect(r.cap_add).toBeUndefined();
    expect(r.security_opt).toEqual(["no-new-privileges:true"]);
    expect(r.read_only).toBe(true);
    expect(r.tmpfs).toEqual(["/run/respaldo", "/tmp"]);
    expect(r.volumes).toEqual([MONTAJE_RESPALDOS]);
    expect((r as { privileged?: boolean }).privileged).toBeUndefined();
    const usuarios = Object.entries(compose.services).filter(([, x]) => /^0(:|$)/.test(x.user ?? "")).map(([n]) => n);
    expect(usuarios).toEqual(["inv-008-respaldo"]);
  });

  it("la carpeta de respaldos no está escrita en el compose: viene de la configuración por interpolación", () => {
    expect(CENTINELA).toMatch(/^\/nonexistent\/[a-z0-9-]+$/);
    // Volumen local que monta la carpeta con bind,nosuid,noexec: sin la variable (o sin la carpeta), el mount
    // falla y el respaldo no arranca (Docker no crea el origen de un volumen local de tipo none).
    expect(compose.volumes[VOLUMEN_RESPALDOS]).toEqual({
      driver: "local",
      driver_opts: { type: "none", device: DEVICE_RESPALDOS, o: "bind,nosuid,noexec" },
    });
    // Con el valor por defecto ningún comando falla al interpolar (la pausa y lo que se corre a mano).
    expect(texto).not.toMatch(/INV_RESPALDOS_DIR:\?/);
  });

  it("las únicas rutas del host son /proc/meminfo y /sys/fs/cgroup (vigía, solo lectura) y la carpeta de respaldos", () => {
    const delHost = Object.values(compose.services)
      .flatMap((srv) => srv.volumes ?? [])
      .map((v) => (typeof v === "string" ? v.split(":")[0]! : v.source))
      .filter((origen) => origen.startsWith("/") || origen.startsWith("$"));
    expect(delHost.sort()).toEqual(["/proc/meminfo", "/sys/fs/cgroup"].sort());
    const dispositivos = Object.values(compose.volumes).flatMap((v) => (v?.driver_opts?.device ? [v.driver_opts.device] : []));
    expect(dispositivos).toEqual([DEVICE_RESPALDOS]);
  });

  it("el volumen de respaldos no cambia dueño ni permisos (sin uid, gid ni mode): la copia de IDC los necesita intactos", () => {
    expect(compose.volumes[VOLUMEN_RESPALDOS]?.driver_opts?.o).not.toMatch(/uid|gid|mode|umask/);
  });

  it("ningún servicio deja volcados de memoria (ulimits core 0): el host los escribiría en disco", () => {
    for (const nombre of SERVICIOS) expect(s(nombre).ulimits, nombre).toEqual({ core: 0 });
  });

  it("el respaldo es permanente (programación propia, sin systemd) y va solo por la red interna", () => {
    expect(s("inv-008-respaldo").profiles).toBeUndefined();
    expect(s("inv-008-respaldo").networks).toEqual(["inv-008-red-interna"]);
    expect((s("inv-008-respaldo") as { entrypoint?: string[] }).entrypoint).toEqual(["/usr/local/bin/inv-respaldo"]);
    expect((s("inv-008-respaldo") as { init?: boolean }).init).toBe(true);
  });

  it("app y vigía corren con init (las señales llegan y se detienen sin SIGKILL)", () => {
    expect((s("inv-008-app") as { init?: boolean }).init).toBe(true);
    expect((s("inv-008-vigia") as { init?: boolean }).init).toBe(true);
  });

  it("el migrador y el respaldo solo usan la red interna (sin salida a internet)", () => {
    expect(s("inv-008-migrador").networks).toEqual(["inv-008-red-interna"]);
    expect(s("inv-008-respaldo").networks).toEqual(["inv-008-red-interna"]);
  });

  it("la base es PostgreSQL 16 fijada por digest, con su volumen propio", () => {
    expect(s("inv-008-db").image).toMatch(/^postgres:16-alpine@sha256:[0-9a-f]{64}$/);
    expect(s("inv-008-db").volumes).toEqual(["inv-008-db-datos:/var/lib/postgresql/data"]);
  });

  it("app, migrador y respaldo usan imágenes locales de Inversiones, nunca descargadas", () => {
    for (const nombre of ["inv-008-app", "inv-008-migrador", "inv-008-respaldo", "inv-008-vigia"]) {
      expect(s(nombre).image).toMatch(/^inv-008-(app|migrador|vigia):\$\{INV_TAG:-sin-desplegar\}$/);
      expect(s(nombre).pull_policy).toBe("never");
    }
  });

  it("el migrador es de un solo uso (perfil, run --rm) y no arranca con up", () => {
    expect(s("inv-008-migrador").profiles).toEqual(["migrar"]);
  });
});

describe("docker-compose.prod.yml · endurecimiento en cada servicio", () => {
  for (const nombre of SERVICIOS) {
    it(`${nombre}: no root (salvo la excepción del respaldo), solo lectura, sin capacidades, sin escalar, restart y healthcheck`, () => {
      const srv = s(nombre);
      if (nombre === "inv-008-respaldo") expect(srv.user, "usuario").toBe("0:${INV_RESPALDO_GID:?falta INV_RESPALDO_GID}");
      else expect(srv.user, "usuario").toMatch(/^(70:70|10008:10008)$/);
      expect(srv.read_only).toBe(true);
      expect(srv.cap_drop).toEqual(["ALL"]);
      expect(srv.cap_add).toBeUndefined();
      expect(srv.privileged).toBeUndefined();
      expect(srv.security_opt).toEqual(["no-new-privileges:true"]);
      // Excepción documentada (capas-pi.md #5): el migrador es de un solo uso y lleva restart "no".
      expect(srv.restart).toBe(nombre === "inv-008-migrador" ? "no" : "always");
      expect(srv.healthcheck?.test?.length).toBeGreaterThan(0);
    });

    it(`${nombre}: mem_limit igual a memswap_limit y cpu_shares bajo (PI tiene prioridad)`, () => {
      const srv = s(nombre);
      expect(srv.mem_limit).toBeDefined();
      expect(srv.memswap_limit).toBe(srv.mem_limit);
      expect(srv.cpu_shares).toBe(256);
    });
  }

  it("límites medidos: app 384m, base 512m, migrador 256m, respaldo 128m, vigía 32m", () => {
    expect(s("inv-008-vigia").mem_limit).toBe("32m");
    expect(s("inv-008-app").mem_limit).toBe("384m");
    expect(s("inv-008-db").mem_limit).toBe("512m");
    expect(s("inv-008-migrador").mem_limit).toBe("256m");
    expect(s("inv-008-respaldo").mem_limit).toBe("128m");
  });

  it("logs json-file de 10m × 5 en todos los servicios", () => {
    for (const nombre of SERVICIOS) {
      expect(s(nombre).logging, nombre).toEqual({ driver: "json-file", options: { "max-size": "10m", "max-file": "5" } });
    }
  });

  it("tmpfs para lo que escribe en ejecución", () => {
    expect(s("inv-008-db").tmpfs).toEqual(expect.arrayContaining(["/tmp", "/var/run/postgresql:uid=70,gid=70,mode=0700"]));
    expect(s("inv-008-app").tmpfs).toEqual(expect.arrayContaining(["/tmp", "/app/.next/cache:uid=10008,gid=10008,mode=0700"]));
  });

  it("base: shared_buffers 64MB, effective_cache_size 256MB, max_connections 30 y checksums de datos", () => {
    expect(JSON.stringify((s("inv-008-db") as { command?: unknown }).command)).toMatch(/shared_buffers=64MB.*effective_cache_size=256MB.*max_connections=30/);
    expect(s("inv-008-db").environment?.POSTGRES_INITDB_ARGS).toBe("--data-checksums");
  });
});

describe("docker-compose.prod.yml · variables: un solo archivo de producción, cada servicio solo lo suyo", () => {
  it("ningún servicio usa env_file, secrets ni group_add", () => {
    for (const srv of Object.values(compose.services)) {
      expect(srv.env_file).toBeUndefined();
      expect(srv.secrets).toBeUndefined();
      expect(srv.group_add).toBeUndefined();
    }
    expect(compose.secrets).toBeUndefined();
  });

  const claves = (nombre: string) => Object.keys(s(nombre).environment ?? {}).sort();

  it("la base solo recibe su clave de superusuario", () => {
    expect(claves("inv-008-db")).toEqual(["POSTGRES_DB", "POSTGRES_INITDB_ARGS", "POSTGRES_PASSWORD", "POSTGRES_USER", "TZ"]);
    expect(s("inv-008-db").environment?.POSTGRES_PASSWORD).toBe("${INV_POSTGRES_CLAVE:?falta INV_POSTGRES_CLAVE}");
  });

  it("la app recibe solo su URL (rol inv_app), AUTH_SECRET, las claves de cifrado y APP_ORIGEN", () => {
    const env = s("inv-008-app").environment ?? {};
    expect(claves("inv-008-app")).toEqual(["APP_ORIGEN", "AUTH_SECRET", "CIFRADO_CLAVE_ACTIVA", "CIFRADO_CLAVE_V1", "DATABASE_URL", "NODE_OPTIONS", "TZ"]);
    expect(env.DATABASE_URL).toBe("${INV_APP_DATABASE_URL:?falta INV_APP_DATABASE_URL}");
    expect(env.AUTH_SECRET).toBe("${INV_AUTH_SECRET:?falta INV_AUTH_SECRET}");
    expect(env.CIFRADO_CLAVE_ACTIVA).toBe("${INV_CIFRADO_CLAVE_ACTIVA:?falta INV_CIFRADO_CLAVE_ACTIVA}");
    expect(env.CIFRADO_CLAVE_V1).toBe("${INV_CIFRADO_CLAVE_V1:?falta INV_CIFRADO_CLAVE_V1}");
    expect(env.APP_ORIGEN).toBe("${APP_ORIGEN:?falta APP_ORIGEN}");
    expect(env.NODE_OPTIONS).toBe("--max-old-space-size=256");
  });

  it("el migrador recibe solo su URL (rol inv_dueno), las claves de cifrado y APP_ORIGEN (enlace del acceso inicial)", () => {
    expect(claves("inv-008-migrador")).toEqual(["APP_ORIGEN", "CIFRADO_CLAVE_ACTIVA", "CIFRADO_CLAVE_V1", "DATABASE_URL", "TZ"]);
    expect(s("inv-008-migrador").environment?.DATABASE_URL).toBe("${INV_DUENO_DATABASE_URL:?falta INV_DUENO_DATABASE_URL}");
  });

  it("el respaldo recibe su URL (rol inv_dueno), la clave PÚBLICA de age, la hora y el grupo de lectura", () => {
    expect(claves("inv-008-respaldo")).toEqual(["AGE_PUBLICA", "DATABASE_URL", "RESPALDO_GID", "RESPALDO_HORA", "TZ"]);
    expect(s("inv-008-respaldo").environment?.AGE_PUBLICA).toBe("${INV_AGE_PUBLICA:?falta INV_AGE_PUBLICA}");
    expect(s("inv-008-respaldo").environment?.DATABASE_URL).toBe("${INV_DUENO_DATABASE_URL:?falta INV_DUENO_DATABASE_URL}");
    expect(s("inv-008-respaldo").environment?.RESPALDO_GID).toBe("${INV_RESPALDO_GID:?falta INV_RESPALDO_GID}");
  });

  it("el vigía recibe solo Telegram, su umbral (1024 MiB por defecto), su intervalo y la ruta de la pausa (la pasan los scripts)", () => {
    const env = s("inv-008-vigia").environment ?? {};
    expect(claves("inv-008-vigia")).toEqual(["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "VIGIA_INTERVALO_S", "VIGIA_RUTA_PAUSA", "VIGIA_UMBRAL_MEMAVAILABLE_MIB"]);
    expect(env.VIGIA_RUTA_PAUSA).toBe("${INV_RUTA_PAUSA:-}");
    expect(env.VIGIA_UMBRAL_MEMAVAILABLE_MIB).toBe("${INV_VIGIA_UMBRAL_MEMAVAILABLE_MIB:-1024}");
    expect(env.VIGIA_INTERVALO_S).toBe("${INV_VIGIA_INTERVALO_S:-60}");
  });

  it("APP_VERSION no viene de ninguna variable: va horneada en la imagen", () => {
    expect(JSON.stringify(compose)).not.toMatch(/APP_VERSION/);
  });

  it("ninguna clave escrita en el archivo: solo interpolaciones ${...}", () => {
    for (const srv of Object.values(compose.services)) {
      for (const [k, v] of Object.entries(srv.environment ?? {})) {
        if (/PASSWORD|SECRET|CLAVE|DATABASE_URL|AGE_|TOKEN|CHAT/.test(k)) expect(v, k).toMatch(/^\$\{[A-Z0-9_]+:\?[^}]+\}$/);
      }
    }
  });
});
