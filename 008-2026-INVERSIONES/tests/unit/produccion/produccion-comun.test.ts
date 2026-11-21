// Candados comunes de los scripts de producción (scripts/produccion-comun.sh):
//  - proyecto Docker: solo inv-008-prod, o inv-008-prueba en local; nunca inv-008 (desarrollo) ni otro;
//  - rutas de escritura: solo bajo /opt/inversiones-008/ (en prueba, bajo INV_BASE), resueltas físicamente;
//  - lectura del archivo de producción sin ejecutarlo, y detección de un despliegue de PI en curso.
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
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
