// Candado del docker-compose.prod.yml de Inversiones en el VPS compartido con PI: proyecto, redes y base
// propios, la app SIN salida a internet (solo redes internal) detrás de la entrada, que es la única con el puerto
// 127.0.0.1:5008, endurecimiento, límites con mem = memswap, cpu_shares bajo y cada servicio con solo sus
// variables (el archivo de producción es solo para interpolar). El relé de la entrada se ejecuta en entrada.test.ts y lo
// propio del servicio de precios (D-018: su red con salida, su huella, su credencial opcional) en
// servicio-precios-compose.test.ts.
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { funcion, leer008, ruta008 } from "./falsos";

// El valor por defecto de la carpeta de respaldos: una ruta que no existe (el script la define en un solo lugar).
const CENTINELA = funcion(ruta008("scripts/produccion-comun.sh"), 'printf "%s" "$INV_RESPALDOS_CENTINELA"').stdout;
const BIND_RESPALDOS: Bind = {
  type: "bind",
  source: `\${INV_RESPALDOS_DIR:-${CENTINELA}}`,
  target: "/respaldos",
  bind: { create_host_path: false },
};

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
  pids_limit?: number;
  ports?: string[];
  networks?: string[];
  network_mode?: string;
  environment?: Record<string, string>;
  env_file?: unknown;
  volumes?: Array<string | Bind>;
  ulimits?: Record<string, number>;
  healthcheck?: { test: string[] };
  entrypoint?: string[];
  init?: boolean;
  depends_on?: Record<string, { condition: string }>;
  logging?: { driver: string; options?: Record<string, string> };
  profiles?: string[];
  privileged?: boolean;
  links?: unknown;
  group_add?: unknown;
  secrets?: unknown;
};
type Bind = { type: string; source: string; target: string; read_only?: boolean; bind?: { create_host_path?: boolean } };
type Compose = {
  name: string;
  services: Record<string, Servicio>;
  networks: Record<string, { internal?: boolean; external?: boolean; driver?: string; driver_opts?: Record<string, string> }>;
  volumes: Record<string, unknown>;
  secrets?: unknown;
};

const texto = leer008("docker-compose.prod.yml");
const compose = parse(texto) as Compose;
const s = (nombre: string): Servicio => {
  const srv = compose.services[nombre];
  if (!srv) throw new Error(`falta el servicio ${nombre}`);
  return srv;
};
const SERVICIOS = ["inv-008-db", "inv-008-app", "inv-008-entrada", "inv-008-migrador", "inv-008-respaldo", "inv-008-vigia", "inv-008-precios", "inv-008-ia", "inv-008-alertas"];
const internal = (red: string) => compose.networks[red]?.internal === true;
const quienes = (red: string) =>
  Object.entries(compose.services)
    .filter(([, srv]) => (srv.networks ?? []).includes(red))
    .map(([nombre]) => nombre)
    .sort();

describe("docker-compose.prod.yml · proyecto, red y base propios", () => {
  it("es el proyecto inv-008-prod, distinto del de desarrollo (inv-008)", () => {
    expect(compose.name).toBe("inv-008-prod");
  });

  it("tiene exactamente sus 9 servicios (la entrada es el relé del túnel hacia la app; precios, el servicio de D-018; IA, el de E6; alertas, el contenedor propio de PR-C)", () => {
    expect(Object.keys(compose.services).sort()).toEqual([...SERVICIOS].sort());
  });

  it("la base no publica ningún puerto y vive solo en la red interna", () => {
    expect(s("inv-008-db").ports).toBeUndefined();
    expect(s("inv-008-db").networks).toEqual(["inv-008-red-interna"]);
    expect(compose.networks["inv-008-red-interna"]?.internal).toBe(true);
  });

  it("solo la entrada publica un puerto, y solo 127.0.0.1:5008 (nunca 0.0.0.0); la app no publica nada", () => {
    expect(s("inv-008-entrada").ports).toEqual(["127.0.0.1:5008:5008"]);
    for (const [nombre, srv] of Object.entries(compose.services)) {
      if (nombre !== "inv-008-entrada") expect(srv.ports, nombre).toBeUndefined();
    }
  });

  it("la app vive solo en redes internal (sin salida a internet): la interna, con la base, y la de la entrada", () => {
    expect(s("inv-008-app").networks).toEqual(["inv-008-red-interna", "inv-008-red-entrada"]);
    for (const red of s("inv-008-app").networks ?? []) expect(internal(red), red).toBe(true);
  });

  it("inv-008-red-entrada es internal y solo la comparten la app y la entrada", () => {
    expect(compose.networks["inv-008-red-entrada"]?.internal).toBe(true);
    expect(quienes("inv-008-red-entrada")).toEqual(["inv-008-app", "inv-008-entrada"]);
  });

  it("las únicas redes con salida: inv-008-red (la entrada para publicar y el vigía para Telegram), inv-008-red-precios (solo precios) e inv-008-red-ia (solo IA)", () => {
    const conSalida = Object.keys(compose.networks).filter((red) => !internal(red));
    expect(conSalida.sort()).toEqual(["inv-008-red", "inv-008-red-ia", "inv-008-red-precios"]);
    expect(quienes("inv-008-red-ia")).toEqual(["inv-008-ia"]);
    expect(quienes("inv-008-red")).toEqual(["inv-008-entrada", "inv-008-vigia"]);
    expect(quienes("inv-008-red-precios")).toEqual(["inv-008-precios"]);
    expect(s("inv-008-entrada").networks).toEqual(["inv-008-red", "inv-008-red-entrada"]);
  });

  it("toda red internal aísla la puerta de enlace (gateway_mode_ipv4: isolated): desde ella no se llega al host", () => {
    const internas = Object.keys(compose.networks).filter(internal);
    expect(internas.sort()).toEqual(["inv-008-red-entrada", "inv-008-red-interna"]);
    for (const red of internas) {
      expect(compose.networks[red]?.driver_opts, red).toEqual({ "com.docker.network.bridge.gateway_mode_ipv4": "isolated" });
    }
  });

  it("las redes con salida no se aíslan: por su puerta de enlace publica la entrada y salen el vigía y precios", () => {
    expect(compose.networks["inv-008-red"]?.driver_opts?.["com.docker.network.bridge.gateway_mode_ipv4"]).toBeUndefined();
    expect(compose.networks["inv-008-red-precios"]?.driver_opts?.["com.docker.network.bridge.gateway_mode_ipv4"]).toBeUndefined();
  });

  it("quien publica un puerto tiene una red con salida (Docker no publica desde una red internal)", () => {
    for (const [nombre, srv] of Object.entries(compose.services)) {
      if (srv.ports) expect((srv.networks ?? []).some((red) => !internal(red)), nombre).toBe(true);
    }
  });

  it("la entrada: la imagen de la app (toda imagen anterior trae node, así sirve la vuelta atrás), sin variables, sin volúmenes y sin tmpfs", () => {
    const e = s("inv-008-entrada");
    expect(e.image).toBe("inv-008-app:${INV_TAG:-sin-desplegar}");
    expect(e.pull_policy).toBe("never");
    expect(e.environment).toBeUndefined();
    expect(e.volumes).toBeUndefined();
    expect(e.tmpfs).toBeUndefined();
    expect(e.entrypoint?.slice(0, 3)).toEqual(["node", "--max-old-space-size=16", "-e"]);
  });

  it("la entrada espera a la app healthy (entrega ordenada del puerto) y su healthcheck pasa por el relé con wget, nunca con un segundo node", () => {
    const e = s("inv-008-entrada");
    expect(e.depends_on).toEqual({ "inv-008-app": { condition: "service_healthy" } });
    expect(e.healthcheck?.test).toEqual(["CMD", "wget", "-qO", "/dev/null", "http://127.0.0.1:5008/api/salud"]);
    expect(JSON.stringify(e.healthcheck)).not.toMatch(/\bnode\b/);
  });

  it("ninguna red es externa (no se une a las redes de PI) y nadie usa links ni nombra a PI, BI, Gesmovil o Hermes", () => {
    for (const red of Object.values(compose.networks)) expect(red.external).toBeUndefined();
    for (const srv of Object.values(compose.services)) expect(srv.links).toBeUndefined();
    // Sobre lo que Compose interpreta (sin comentarios).
    expect(JSON.stringify(compose)).not.toMatch(/\bpi[-_]|\bbi[-_]|proteccion|gesmovil|hermes|docker\.sock|\/var\/lib\/docker/i);
  });

  it("el vigía no tiene el socket de Docker: solo /proc/meminfo, /sys/fs/cgroup y la huella de precios en solo lectura, y la red con salida", () => {
    expect(s("inv-008-vigia").volumes).toEqual(["/proc/meminfo:/host/meminfo:ro", "/sys/fs/cgroup:/host/cgroup:ro", "inv-008-precios-estado:/precios-estado:ro"]);
    expect(s("inv-008-vigia").networks).toEqual(["inv-008-red"]);
    expect((s("inv-008-vigia") as { cpus?: number }).cpus).toBe(0.05);
    expect(s("inv-008-respaldo").volumes).toEqual([BIND_RESPALDOS]);
    // precios: solo su volumen tmpfs de la huella (servicio-precios-compose.test.ts).
    expect(s("inv-008-precios").volumes).toEqual(["inv-008-precios-estado:/estado"]);
    for (const [nombre, srv] of Object.entries(compose.services)) {
      if (!["inv-008-vigia", "inv-008-db", "inv-008-respaldo", "inv-008-precios", "inv-008-app", "inv-008-ia", "inv-008-alertas"].includes(nombre)) expect(srv.volumes, nombre).toBeUndefined();
    }
    // alertas: su volumen nombrado de disco para la marca y la huella (servicio-alertas-compose.test.ts).
    expect(s("inv-008-alertas").volumes).toEqual(["inv-008-alertas-estado:/estado"]);
    // La app y el servicio de IA: solo la carpeta de la lista de modelos de PI, en solo lectura (servicio-ia-compose.test.ts).
    for (const nombre of ["inv-008-app", "inv-008-ia"]) {
      expect(s(nombre).volumes, nombre).toEqual(["${INV_IA_DIR_COMPARTIDA:-inv-008-ia-sin-lista}:/compartido-pi:ro"]);
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
    expect(r.volumes).toEqual([BIND_RESPALDOS]);
    expect((r as { privileged?: boolean }).privileged).toBeUndefined();
    const usuarios = Object.entries(compose.services).filter(([, x]) => /^0(:|$)/.test(x.user ?? "")).map(([n]) => n);
    expect(usuarios).toEqual(["inv-008-respaldo"]);
  });

  it("la carpeta de respaldos no está escrita en el compose: viene de la configuración por interpolación", () => {
    expect(CENTINELA).toMatch(/^\/nonexistent\/[a-z0-9-]+$/);
    // Sintaxis larga sin crear la carpeta: sin la variable, el up del respaldo falla cerrado (no crea nada).
    const [bind] = s("inv-008-respaldo").volumes as Bind[];
    expect(bind?.bind?.create_host_path).toBe(false);
    // Con el valor por defecto ningún comando falla al interpolar (la pausa y lo que se corre a mano).
    expect(texto).not.toMatch(/INV_RESPALDOS_DIR:\?/);
  });

  it("las únicas rutas del host son /proc/meminfo y /sys/fs/cgroup (vigía, solo lectura), la carpeta de respaldos y la compartida con PI (por interpolación)", () => {
    const delHost = Object.values(compose.services)
      .flatMap((srv) => srv.volumes ?? [])
      .map((v) => (typeof v === "string" ? v.split(":")[0]! : v.source))
      .filter((origen) => origen.startsWith("/") || origen.startsWith("$"));
    expect([...new Set(delHost)].sort()).toEqual(["/proc/meminfo", "/sys/fs/cgroup", BIND_RESPALDOS.source, "${INV_IA_DIR_COMPARTIDA"].sort());
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

  it("app, entrada, vigía y precios corren con init (las señales llegan y se detienen sin SIGKILL)", () => {
    expect(s("inv-008-precios").init).toBe(true);
    expect(s("inv-008-app").init).toBe(true);
    expect(s("inv-008-entrada").init).toBe(true);
    expect(s("inv-008-vigia").init).toBe(true);
  });

  it("el migrador y el respaldo solo usan la red interna (sin salida a internet)", () => {
    expect(s("inv-008-migrador").networks).toEqual(["inv-008-red-interna"]);
    expect(s("inv-008-respaldo").networks).toEqual(["inv-008-red-interna"]);
  });

  it("la base es PostgreSQL 16 fijada por digest, con su volumen propio", () => {
    expect(s("inv-008-db").image).toMatch(/^postgres:16-alpine@sha256:[0-9a-f]{64}$/);
    expect(s("inv-008-db").volumes).toEqual(["inv-008-db-datos:/var/lib/postgresql/data"]);
  });

  it("app, entrada, migrador, respaldo, vigía y precios usan imágenes locales de Inversiones, nunca descargadas", () => {
    for (const nombre of ["inv-008-app", "inv-008-entrada", "inv-008-migrador", "inv-008-respaldo", "inv-008-vigia", "inv-008-precios"]) {
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
      expect(srv.cpu_shares).toBeGreaterThan(0);
      expect(srv.cpu_shares).toBeLessThanOrEqual(256);
    });
  }

  it("límites medidos: app 384m, base 512m, migrador 256m, respaldo 128m, vigía 32m, entrada 32m con 32 pids y precios 96m con 64", () => {
    expect(s("inv-008-precios").mem_limit).toBe("96m");
    expect(s("inv-008-precios").pids_limit).toBe(64);
    expect(s("inv-008-vigia").mem_limit).toBe("32m");
    expect(s("inv-008-entrada").mem_limit).toBe("32m");
    expect(s("inv-008-entrada").pids_limit).toBe(32);
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

  it("la app recibe solo su URL (rol inv_app), AUTH_SECRET, las claves de cifrado, APP_ORIGEN y, de la IA, el token del servicio y la carpeta de la lista de PI", () => {
    const env = s("inv-008-app").environment ?? {};
    expect(claves("inv-008-app")).toEqual(["APP_ORIGEN", "AUTH_SECRET", "CIFRADO_CLAVE_ACTIVA", "CIFRADO_CLAVE_V1", "DATABASE_URL", "INV_IA_DIR_COMPARTIDA", "INV_IA_SERVICIO_TOKEN", "NODE_OPTIONS", "TZ"]);
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
    for (const [nombre, srv] of Object.entries(compose.services)) {
      for (const [k, v] of Object.entries(srv.environment ?? {})) {
        if (!/PASSWORD|SECRET|CLAVE|DATABASE_URL|AGE_|TOKEN|CHAT/.test(k)) continue;
        // ÚNICA excepción, exacta (D-018): la credencial de precios es opcional, vacía si falta. Sin el secreto el
        // servicio queda en espera; con :? se romperían la pausa y los up de todo el proyecto.
        if (nombre === "inv-008-precios" && k === "DATABASE_URL") expect(v).toBe("${INV_PRECIOS_DATABASE_URL:-}");
        // Y las del servicio de IA (E6), igual de exactas: su credencial y el token que comparte con la app.
        else if (nombre === "inv-008-ia" && k === "DATABASE_URL") expect(v).toBe("${INV_IA_DATABASE_URL:-}");
        // Y la del servicio de las alertas: opcional, vacía si falta (queda en espera).
        else if (nombre === "inv-008-alertas" && k === "DATABASE_URL") expect(v).toBe("${INV_ALERTAS_DATABASE_URL:-}");
        else if (["inv-008-ia", "inv-008-app"].includes(nombre) && k === "INV_IA_SERVICIO_TOKEN") expect(v).toBe("${INV_IA_SERVICIO_TOKEN:-}");
        else expect(v, `${nombre} · ${k}`).toMatch(/^\$\{[A-Z0-9_]+:\?[^}]+\}$/);
      }
    }
  });
});
