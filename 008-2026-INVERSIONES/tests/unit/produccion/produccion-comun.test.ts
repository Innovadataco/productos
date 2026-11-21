// Candados comunes de los scripts de producción (scripts/produccion-comun.sh):
//  - proyecto Docker: solo inv-008-prod, o inv-008-prueba en local; nunca inv-008 (desarrollo) ni otro;
//  - rutas de escritura: solo bajo /opt/inversiones-008/ (en prueba, bajo INV_BASE), resueltas físicamente;
//  - lectura del archivo de producción sin ejecutarlo, y detección de un despliegue de PI en curso.
import { chmodSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { userInfo } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { realpathSync } from "node:fs";
import { carpetaTemporal, DIR_008, funcion, ruta008 } from "./falsos";

// Cada prueba corre scripts de bash con varios procesos: con la suite en paralelo puede pasar de 5 s.
vi.setConfig({ testTimeout: 60_000 });

const COMUN = ruta008("scripts/produccion-comun.sh");
const env = (extra: Record<string, string>) => {
  const limpio = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("INV_")));
  return { ...limpio, ...extra };
};

describe("preparar_entorno · proyecto permitido", () => {
  it("por defecto es inv-008-prod con raíz fija /opt/inversiones-008", () => {
    const r = funcion(COMUN, 'preparar_entorno; printf "%s|%s|%s" "$INV_PROYECTO_ACTIVO" "$INV_RAIZ" "$INV_ENV_PROD"', env({}));
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("inv-008-prod|/opt/inversiones-008|/opt/inversiones-008/.env.inversiones.production");
  });

  for (const proyecto of ["inv-008", "pi", "002-2026-proteccion-infantil", "inv-008-prod2", ""]) {
    it(`rechaza el proyecto «${proyecto}»`, () => {
      const r = funcion(COMUN, "preparar_entorno", env({ INV_PROYECTO: proyecto || " " }));
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/proyecto no permitido/);
    });
  }

  it("en producción no acepta otra raíz (INV_BASE) ni un override de compose", () => {
    expect(funcion(COMUN, "preparar_entorno", env({ INV_BASE: "/tmp/otra" })).status).not.toBe(0);
    expect(funcion(COMUN, "preparar_entorno", env({ INV_COMPOSE_OVERRIDE: "/tmp/x.yml" })).status).not.toBe(0);
  });

  it("inv-008-prueba exige INV_BASE y la usa como raíz", () => {
    expect(funcion(COMUN, "preparar_entorno", env({ INV_PROYECTO: "inv-008-prueba" })).status).not.toBe(0);
    const base = carpetaTemporal("comun");
    const r = funcion(COMUN, 'preparar_entorno; printf "%s" "$INV_RAIZ"', env({ INV_PROYECTO: "inv-008-prueba", INV_BASE: base }));
    expect(r.stdout).toBe(base);
  });

  it("armar_compose fija -p, el compose del clon y el archivo de producción como --env-file", () => {
    const base = carpetaTemporal("comun");
    writeFileSync(path.join(base, ".env.inversiones.production"), "X=1\n");
    const r = funcion(COMUN, 'preparar_entorno; armar_compose; printf "%s\\n" "${COMPOSE[@]}"', env({ INV_PROYECTO: "inv-008-prueba", INV_BASE: base }));
    expect(r.status).toBe(0);
    expect(r.stdout.trim().split("\n")).toEqual([
      "docker", "compose", "-p", "inv-008-prueba", "-f", path.join(realpathSync(DIR_008), "docker-compose.prod.yml"),
      "--env-file", path.join(base, ".env.inversiones.production"),
    ]);
  });

  it("armar_compose aborta si no puede leer el archivo de producción", () => {
    const base = carpetaTemporal("comun");
    const r = funcion(COMUN, "preparar_entorno; armar_compose", env({ INV_PROYECTO: "inv-008-prueba", INV_BASE: base }));
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/no se puede leer/);
  });
});

describe("ruta_escribible · toda escritura bajo la raíz de Inversiones", () => {
  const base = carpetaTemporal("rutas");
  const afuera = carpetaTemporal("afuera");
  mkdirSync(path.join(base, "estado"));
  symlinkSync(afuera, path.join(base, "estado", "enlace-dir"));
  symlinkSync(path.join(afuera, "x"), path.join(base, "estado", "enlace-archivo"));
  const prueba = env({ INV_PROYECTO: "inv-008-prueba", INV_BASE: base });
  const ruta = (r: string, e = prueba) => funcion(COMUN, `preparar_entorno; ruta_escribible "${r}"`, e);

  it("acepta rutas dentro de la raíz, existan o no", () => {
    expect(ruta(`${base}/estado/sha-actual`).stdout.trim()).toBe(`${base}/estado/sha-actual`);
    expect(ruta(`${base}/respaldos/nuevo/archivo.age`).stdout.trim()).toBe(`${base}/respaldos/nuevo/archivo.age`);
  });

  const malas: Array<[string, string]> = [
    ["fuera de la raíz", "/tmp/inv-008-fuera.txt"],
    ["con ..", `${base}/estado/../../salida`],
    ["con .", `${base}/./estado/x`],
    ["relativa", "estado/x"],
    ["por un directorio enlazado afuera", `${base}/estado/enlace-dir/x`],
    ["un archivo enlazado", `${base}/estado/enlace-archivo`],
    ["la raíz de PI", "/opt/proteccion-infantil/x"],
    ["prefijo engañoso", `${base}-otra/x`],
  ];
  for (const [nombre, r] of malas) {
    it(`rechaza una ruta ${nombre}`, () => {
      const res = ruta(r);
      expect(res.status).not.toBe(0);
      expect(res.stdout).toBe("");
    });
  }

  it("en producción la raíz es /opt/inversiones-008: rechaza el scratch y /opt/proteccion-infantil", () => {
    expect(ruta(`${base}/estado/x`, env({})).status).not.toBe(0);
    expect(ruta("/opt/proteccion-infantil/repo/x", env({})).status).not.toBe(0);
  });
});

describe("leer_variable_env · lee el archivo de producción sin ejecutarlo", () => {
  const base = carpetaTemporal("env");
  const archivo = path.join(base, ".env.inversiones.production");
  writeFileSync(archivo, ['# comentario', 'A=uno', 'B="dos"', "C='tres'", "D=$(touch " + path.join(base, "ejecutado") + ")", "A=ultimo"].join("\n"));

  it("devuelve el último valor, sin comillas, y nunca ejecuta lo que hay dentro", () => {
    const r = funcion(COMUN, `printf '%s|' "$(leer_variable_env "${archivo}" A)" "$(leer_variable_env "${archivo}" B)" "$(leer_variable_env "${archivo}" C)" "$(leer_variable_env "${archivo}" D)"`);
    expect(r.stdout).toBe(`ultimo|dos|tres|$(touch ${path.join(base, "ejecutado")})|`);
    expect(funcion(COMUN, `test ! -e "${path.join(base, "ejecutado")}"`).status).toBe(0);
  });

  it("falla si la variable no está", () => {
    expect(funcion(COMUN, `leer_variable_env "${archivo}" NO_ESTA`).status).not.toBe(0);
  });
});

describe("hay_despliegue_ajeno · no tocar Inversiones mientras PI despliega o construye", () => {
  const decidir = (ps: string) => funcion(COMUN, "hay_despliegue_ajeno", process.env, ps).stdout.trim();

  it("LIBRE si no hay despliegues ajenos (los compose de Inversiones no cuentan)", () => {
    expect(decidir("bash\n/usr/bin/dockerd\ndocker compose -p inv-008-prod ps\n")).toBe("LIBRE");
  });

  for (const linea of [
    "/bin/zsh -c source snapshot.sh && eval 'echo docker compose build; ./scripts/deploy-prod.sh'",
    "vim scripts/deploy-prod.sh",
    "grep docker compose notas.txt",
  ]) {
    it(`LIBRE con «${linea}» (el texto suelto no es un despliegue)`, () => {
      expect(decidir(`bash\n${linea}\n`)).toBe("LIBRE");
    });
  }

  for (const linea of [
    "/bin/bash ./scripts/deploy-prod.sh",
    "bash /opt/proteccion-infantil/repo/002-2026-PROTECCION-INFANTIL/scripts/deploy-prod.sh --skip-pull",
    "docker compose --env-file .env.production -f docker-compose.prod.yml build",
    "/usr/libexec/docker/cli-plugins/docker-compose compose up -d",
    "docker build -t pi-app:abc .",
    "docker buildx build .",
    "/usr/libexec/docker/cli-plugins/docker-buildx buildx build -t pi-app:x .",
  ]) {
    it(`OCUPADO con «${linea}»`, () => {
      expect(decidir(`bash\n${linea}\n`)).toBe("OCUPADO");
    });
  }
});

describe("modo_prueba_permitido · el modo de prueba nunca corre en el VPS", () => {
  const permitido = (raiz: string, sistema: string, ci: string) => funcion(COMUN, `modo_prueba_permitido "${raiz}" "${sistema}" "${ci}"`).status;
  const noExiste = "/no/existe/inversiones-008";

  it("se acepta en el Mac (Darwin) si no existe la raíz de producción", () => {
    expect(permitido(noExiste, "Darwin", "")).toBe(0);
  });

  it("se acepta en GitHub Actions (Linux con GITHUB_ACTIONS=true), para el CI", () => {
    expect(permitido(noExiste, "Linux", "true")).toBe(0);
  });

  it("se rechaza en un Linux que no es el CI", () => {
    expect(permitido(noExiste, "Linux", "")).not.toBe(0);
  });

  it("se rechaza siempre que exista la raíz de producción (el VPS)", () => {
    const existe = carpetaTemporal("raiz-prod");
    expect(permitido(existe, "Darwin", "")).not.toBe(0);
    expect(permitido(existe, "Linux", "true")).not.toBe(0);
  });
});

describe("ruta_escribible · en producción, solo tres destinos: /opt/inversiones-008/, el candado común y los respaldos", () => {
  const ruta = (r: string) => funcion(COMUN, `preparar_entorno; ruta_escribible "${r}"`, env({}));

  for (const buena of ["/var/lock/despliegue-vps.lock", "/var/backups/idc/inversiones", "/var/backups/idc/inversiones/inv-008-20261121-023000.dump.age"]) {
    it(`acepta ${buena}`, () => {
      const r = ruta(buena);
      expect(r.status, r.stderr).toBe(0);
      expect(r.stdout.trim()).toBe(buena);
    });
  }

  for (const mala of [
    "/var/lock/otro.lock",
    "/var/lock/despliegue-vps.lock.x",
    "/var/lock/../etc/passwd",
    "/var/lock",
    "/var/backups/idc",
    "/var/backups/idc/",
    "/var/backups/idc/pi",
    "/var/backups/idc/pi/x.dump",
    "/var/backups/idc/inversiones-otra/x",
    "/var/backups/idc/inversiones/sub/x",
    "/var/backups/idc/inversiones/../pi/x",
    "/var/backups/otro",
    "/etc/cloudflared/config.yml",
  ]) {
    it(`rechaza ${mala}`, () => {
      expect(ruta(mala).status).not.toBe(0);
    });
  }

  it("rechaza un enlace simbólico que sale (dentro de la raíz de prueba)", () => {
    const base = carpetaTemporal("enlace-sale");
    const afuera = carpetaTemporal("enlace-destino");
    symlinkSync(afuera, path.join(base, "respaldos"));
    const r = funcion(COMUN, `preparar_entorno; ruta_escribible "${base}/respaldos/x.dump.age"`, env({ INV_PROYECTO: "inv-008-prueba", INV_BASE: base }));
    expect(r.status).not.toBe(0);
  });

  it("los respaldos van a /var/backups/idc/inversiones en producción y bajo INV_BASE en prueba", () => {
    expect(funcion(COMUN, 'preparar_entorno; printf "%s" "$INV_RESPALDOS_DIR"', env({})).stdout).toBe("/var/backups/idc/inversiones");
    const base = carpetaTemporal("respaldos-prueba");
    expect(funcion(COMUN, 'preparar_entorno; printf "%s" "$INV_RESPALDOS_DIR"', env({ INV_PROYECTO: "inv-008-prueba", INV_BASE: base })).stdout).toBe(`${base}/respaldos`);
  });
});

describe("hay_despliegue_ajeno · también con opciones de bash", () => {
  const decidir = (ps: string) => funcion(COMUN, "hay_despliegue_ajeno", process.env, ps).stdout.trim();
  for (const linea of ["bash -x ./scripts/deploy-prod.sh", "/bin/bash -e -x /opt/proteccion-infantil/repo/002-2026-PROTECCION-INFANTIL/scripts/deploy-prod.sh --skip-pull", "sh -eu scripts/deploy-prod.sh"]) {
    it(`OCUPADO con «${linea}»`, () => {
      expect(decidir(`${linea}\n`)).toBe("OCUPADO");
    });
  }
  it("LIBRE con «bash -c 'echo deploy-prod.sh'» (texto, no el script)", () => {
    expect(decidir("bash -c 'echo deploy-prod.sh'\n")).toBe("LIBRE");
  });
});

describe("oom_total · OOM jerárquico del cgroup (persiste aunque el scope del contenedor se borre)", () => {
  it("suma oom_kill de system.slice (driver systemd) y de docker (driver cgroupfs)", () => {
    const raiz = carpetaTemporal("cgroup");
    mkdirSync(path.join(raiz, "system.slice"));
    mkdirSync(path.join(raiz, "docker"));
    writeFileSync(path.join(raiz, "system.slice", "memory.events"), "low 0\nhigh 0\nmax 4\noom 3\noom_kill 3\n");
    writeFileSync(path.join(raiz, "docker", "memory.events"), "oom 1\noom_kill 1\n");
    expect(funcion(COMUN, `oom_total "${raiz}"`).stdout.trim()).toBe("4");
  });

  it("sin archivos jerárquicos, falla (no se vigila a ciegas)", () => {
    expect(funcion(COMUN, `oom_total "${carpetaTemporal("cgroup-vacio")}"`).status).not.toBe(0);
  });

  it("el umbral de corte (1 GiB) vive en un solo lugar", () => {
    expect(funcion(COMUN, 'printf "%s" "$UMBRAL_CORTE_KB"').stdout).toBe("1048576");
  });
});

// Lo que corre con sudo no puede depender de rutas que otro pueda cambiar. En producción el dueño es root y
// se sube hasta /; en las pruebas, el usuario actual y un tope temporal (por encima, /tmp es 1777 en Linux).
describe("rutas_inseguras · lo que corre con sudo es solo de su dueño", () => {
  const dueno = userInfo().username;
  function arbol() {
    const tope = carpetaTemporal("arbol");
    const repo = path.join(tope, "repo");
    const d008 = path.join(repo, "008-2026-INVERSIONES");
    const scripts = path.join(d008, "scripts");
    const git = path.join(repo, ".git");
    const envp = path.join(tope, ".env.inversiones.production");
    mkdirSync(path.join(scripts, "ci"), { recursive: true });
    mkdirSync(path.join(git, "hooks"), { recursive: true });
    const archivos = {
      script: path.join(scripts, "x.sh"),
      scriptCi: path.join(scripts, "ci", "y.sh"),
      compose: path.join(d008, "docker-compose.prod.yml"),
      config: path.join(git, "config"),
      hook: path.join(git, "hooks", "post-index-change"),
    };
    for (const f of Object.values(archivos)) writeFileSync(f, "#\n");
    writeFileSync(envp, "X=1\n");
    // Permisos explícitos: no dependen del umask de quien corre las pruebas.
    for (const d of [tope, repo, d008, scripts, path.join(scripts, "ci"), git, path.join(git, "hooks")]) chmodSync(d, 0o755);
    for (const f of Object.values(archivos)) chmodSync(f, 0o644);
    chmodSync(envp, 0o600);
    return { tope, repo, d008, scripts, git, envp, ...archivos };
  }
  type Arbol = ReturnType<typeof arbol>;
  const revisar = (a: Arbol, quien = dueno) => funcion(COMUN, `rutas_inseguras "${quien}" "${a.tope}" "${a.d008}" "${a.envp}"`);

  it("árbol sano: no nombra nada (y no sube más allá del tope)", () => {
    const r = revisar(arbol());
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toBe("");
  });

  const casos: Array<[string, (a: Arbol) => string]> = [
    ["un script escribible por el grupo", (a) => (chmodSync(a.script, 0o664), a.script)],
    ["un script de scripts/ci escribible por otros", (a) => (chmodSync(a.scriptCi, 0o646), a.scriptCi)],
    ["un enlace simbólico dentro de scripts/", (a) => (symlinkSync("/bin/sh", path.join(a.scripts, "z.sh")), path.join(a.scripts, "z.sh"))],
    ["el compose escribible por el grupo", (a) => (chmodSync(a.compose, 0o664), a.compose)],
    ["un padre (la raíz del repo) escribible por el grupo", (a) => (chmodSync(a.repo, 0o775), a.repo)],
    ["el tope (un padre lejano) escribible por otros", (a) => (chmodSync(a.tope, 0o757), a.tope)],
    [".git escribible por otros", (a) => (chmodSync(a.git, 0o757), a.git)],
    [".git/config escribible por el grupo (core.fsmonitor correría como root)", (a) => (chmodSync(a.config, 0o664), a.config)],
    ["un hook escribible por el grupo (git status puede correr post-index-change)", (a) => (chmodSync(a.hook, 0o664), a.hook)],
    ["el archivo de producción legible por el grupo (debe ser 600)", (a) => (chmodSync(a.envp, 0o640), a.envp)],
    ["el archivo de producción es un enlace simbólico", (a) => (rmSync(a.envp), symlinkSync("/dev/null", a.envp), a.envp)],
    ["falta scripts/", (a) => (rmSync(a.scripts, { recursive: true }), a.scripts)],
  ];
  for (const [nombre, romper] of casos) {
    it(`nombra ${nombre}`, () => {
      const a = arbol();
      const ruta = romper(a);
      const r = revisar(a);
      expect(r.status, r.stderr).toBe(0);
      expect(r.stdout.split("\n"), r.stdout).toEqual(expect.arrayContaining([expect.stringContaining(ruta)]));
    });
  }

  it.skipIf(dueno === "root")("con root como dueño, un árbol del usuario es inseguro entero", () => {
    const r = revisar(arbol(), "root");
    expect(r.stdout).toContain("008-2026-INVERSIONES");
  });
});

describe("revisar_arbol · en producción aborta (la pausa solo avisa); en prueba no revisa", () => {
  const arbolMalo = () => {
    const tope = carpetaTemporal("arbol-malo");
    const d008 = path.join(tope, "repo", "008-2026-INVERSIONES");
    mkdirSync(path.join(d008, "scripts"), { recursive: true });
    writeFileSync(path.join(d008, "docker-compose.prod.yml"), "#\n");
    const envp = path.join(tope, "env");
    writeFileSync(envp, "X=1\n", { mode: 0o600 });
    return { d008, envp };
  };
  const enProyecto = (proyecto: string, extra = "") => {
    const { d008, envp } = arbolMalo();
    return funcion(COMUN, `INV_PROYECTO_ACTIVO=${proyecto}; INV_DIR_008="${d008}"; INV_ENV_PROD="${envp}"; revisar_arbol ${extra}; echo sigue`);
  };

  it.skipIf(userInfo().username === "root")("en producción, un clon que no es de root: aborta nombrando las rutas", () => {
    const r = enProyecto("inv-008-prod");
    expect(r.status).not.toBe(0);
    expect(r.stdout).not.toContain("sigue");
    expect(r.stderr).toMatch(/solo de root/);
    expect(r.stderr).toContain("008-2026-INVERSIONES");
  });

  it.skipIf(userInfo().username === "root")("en producción con --solo-avisar (la pausa): avisa y sigue", () => {
    const r = enProyecto("inv-008-prod", "--solo-avisar");
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("sigue");
    expect(r.stderr).toMatch(/⚠️/);
  });

  it("en el proyecto de prueba no revisa nada", () => {
    const r = enProyecto("inv-008-prueba");
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("sigue");
    expect(r.stderr).toBe("");
  });
});
