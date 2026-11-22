// Candados comunes de los scripts de producción (scripts/produccion-comun.sh):
//  - proyecto Docker: solo inv-008-prod, o inv-008-prueba en local; nunca inv-008 (desarrollo) ni otro;
//  - raíz de producción DERIVADA de la ubicación del clon (<raíz>/repo/008-2026-INVERSIONES), con anclas
//    fatales: nunca una ruta fija en el repo público;
//  - rutas de escritura: solo bajo la raíz (en prueba, bajo INV_BASE), resueltas físicamente;
//  - la carpeta de respaldos sale de la configuración no secreta <raíz>/inv-008.conf, validada;
//  - lectura del archivo de producción sin ejecutarlo, y detección de un despliegue de PI en curso.
// Ninguna prueba usa rutas reales del VPS: todo es temporal o ficticio.
import { chmodSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { userInfo } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { realpathSync } from "node:fs";
import { arbolProduccionFalso, carpetaTemporal, confFicticia, DIR_008, envProduccionFicticio, funcion, idArchivo, leer008, ruta008, rutaEnPath } from "./falsos";
const readFileSync008 = leer008;

// Cada prueba corre scripts de bash con varios procesos: con la suite en paralelo puede pasar de 5 s.
vi.setConfig({ testTimeout: 60_000 });

const COMUN = ruta008("scripts/produccion-comun.sh");
/** El findmnt falso: un archivo fijo del repo (ver «montaje del host», abajo). */
const FINDMNT_FALSO = ruta008("tests/unit/produccion/falsos-montaje/findmnt");
const env = (extra: Record<string, string>) => {
  const limpio = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("INV_")));
  return { ...limpio, ...extra };
};
const esRoot = userInfo().username === "root";
const DUENO = userInfo().username;
const GID = String(userInfo().gid);
const PRUEBA = (base: string) => env({ INV_PROYECTO: "inv-008-prueba", INV_BASE: base });

describe("preparar_entorno · proyecto permitido y raíz derivada", () => {
  it("cargar el archivo nunca muere: la raíz se deriva y se valida solo dentro de preparar_entorno", () => {
    const r = funcion(COMUN, "echo cargado", env({}));
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout.trim()).toBe("cargado");
  });

  it("raiz_derivada: la raíz es la carpeta que contiene al clon «repo»", () => {
    const a = arbolProduccionFalso();
    const r = funcion(COMUN, `raiz_derivada "${a.dir008}"`);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toBe(a.raiz);
  });

  const malasRaices: Array<[string, string]> = [
    ["un clon que no se llama repo", "/srv/inv/productos/008-2026-INVERSIONES"],
    ["la raíz /", "/repo/008-2026-INVERSIONES"],
    ["una ruta relativa", "inv/repo/008-2026-INVERSIONES"],
    ["caracteres fuera de la lista", "/srv/a b/repo/008-2026-INVERSIONES"],
    ["una sustitución", "/srv/$(id)/repo/008-2026-INVERSIONES"],
    ["una carpeta que no es 008-2026-INVERSIONES", "/srv/inv/repo/otra"],
  ];
  for (const [nombre, ruta] of malasRaices) {
    it(`raiz_derivada rechaza ${nombre}`, () => {
      const r = funcion(COMUN, `raiz_derivada "${ruta}"`);
      expect(r.status).not.toBe(0);
      expect(r.stdout).toBe("");
    });
  }

  it("desde un clon de trabajo (este), producción se niega: el clon no se llama repo", () => {
    const r = funcion(COMUN, "preparar_entorno", env({}));
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/repo/);
  });

  it.skipIf(esRoot)("en producción, con un árbol que no es de root, se niega nombrando la raíz (anclas fatales)", () => {
    const a = arbolProduccionFalso();
    const r = funcion(a.comun, 'preparar_entorno; echo sigue', env({}));
    expect(r.status).not.toBe(0);
    expect(r.stdout).not.toContain("sigue");
    expect(r.stderr).toMatch(/anclas/);
    expect(r.stderr).toContain(a.raiz);
  });

  it.skipIf(esRoot)("con --pausa, las anclas rotas no matan: INV_ANCLAS_OK=0 y la pausa decide (último recurso)", () => {
    const a = arbolProduccionFalso();
    const r = funcion(a.comun, 'preparar_entorno --pausa; printf "%s|%s" "$INV_ANCLAS_OK" "${COMPOSE_PAUSA[*]}"', env({}));
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toBe("0|docker compose -p inv-008-prod");
    const desdeClon = funcion(COMUN, 'preparar_entorno --pausa; printf "%s" "$INV_ANCLAS_OK"', env({}));
    expect(desdeClon.status, desdeClon.stderr).toBe(0);
    expect(desdeClon.stdout).toBe("0");
  });

  for (const proyecto of ["inv-008", "pi", "002-2026-proteccion-infantil", "inv-008-prod2", ""]) {
    it(`rechaza el proyecto «${proyecto}»`, () => {
      const r = funcion(COMUN, "preparar_entorno", env({ INV_PROYECTO: proyecto || " " }));
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/proyecto no permitido/);
    });
  }

  it("en producción no acepta INV_BASE (ni siquiera igual a la raíz derivada) ni un override de compose", () => {
    const a = arbolProduccionFalso();
    const conBase = funcion(a.comun, "preparar_entorno", env({ INV_BASE: a.raiz }));
    expect(conBase.status).not.toBe(0);
    expect(conBase.stderr).toMatch(/INV_BASE/);
    const conOverride = funcion(a.comun, "preparar_entorno", env({ INV_COMPOSE_OVERRIDE: path.join(a.raiz, "x.yml") }));
    expect(conOverride.status).not.toBe(0);
    expect(conOverride.stderr).toMatch(/INV_COMPOSE_OVERRIDE/);
  });

  it("inv-008-prueba exige INV_BASE y la usa como raíz; COMPOSE_PAUSA es solo el nombre del proyecto", () => {
    expect(funcion(COMUN, "preparar_entorno", env({ INV_PROYECTO: "inv-008-prueba" })).status).not.toBe(0);
    const base = carpetaTemporal("comun");
    const r = funcion(COMUN, 'preparar_entorno; printf "%s|%s" "$INV_RAIZ" "${COMPOSE_PAUSA[*]}"', PRUEBA(base));
    expect(r.stdout).toBe(`${base}|docker compose -p inv-008-prueba`);
  });

  it("armar_compose pasa con env la carpeta de respaldos validada y la ruta de la pausa, y el archivo de producción como --env-file", () => {
    const base = carpetaTemporal("comun");
    envProduccionFicticio(base);
    const r = funcion(COMUN, 'preparar_entorno; armar_compose; printf "%s\\n" "${COMPOSE[@]}"', PRUEBA(base));
    expect(r.status, r.stderr).toBe(0);
    const d008 = realpathSync(DIR_008);
    expect(r.stdout.trim().split("\n")).toEqual([
      "env", `INV_RESPALDOS_DIR=${base}/respaldos`, `INV_RUTA_PAUSA=${path.join(d008, "scripts/pausar-008.sh")}`,
      "docker", "compose", "-p", "inv-008-prueba", "-f", path.join(d008, "docker-compose.prod.yml"),
      "--env-file", path.join(base, ".env.inversiones.production"),
    ]);
  });

  it("armar_compose aborta si no puede leer el archivo de producción", () => {
    const base = carpetaTemporal("comun");
    const r = funcion(COMUN, "preparar_entorno; armar_compose", PRUEBA(base));
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/no se puede leer/);
  });

  it("armar_compose --sin-respaldos no lee la configuración (aunque falte) y pasa el centinela, que no existe", () => {
    const base = carpetaTemporal("comun");
    envProduccionFicticio(base, {}, { sinConf: true });
    const r = funcion(COMUN, 'preparar_entorno; armar_compose --sin-respaldos; printf "%s|%s" "${COMPOSE[1]}" "$INV_RESPALDOS_CENTINELA"', PRUEBA(base));
    expect(r.status, r.stderr).toBe(0);
    const [arg, centinela] = r.stdout.split("|");
    expect(arg).toBe(`INV_RESPALDOS_DIR=${centinela}`);
    expect(centinela).toMatch(/^\/nonexistent\//);
    expect(funcion(COMUN, `test ! -e "${centinela}"`).status).toBe(0);
  });

  it("el centinela del script es el mismo valor por defecto del compose", () => {
    const centinela = funcion(COMUN, 'printf "%s" "$INV_RESPALDOS_CENTINELA"').stdout;
    expect(centinela).not.toBe("");
    expect(readFileSync008("docker-compose.prod.yml")).toContain(`\${INV_RESPALDOS_DIR:-${centinela}}`);
  });

  it("todo script que carga produccion-comun.sh corre sin volcados de memoria (ulimit -c 0)", () => {
    expect(funcion(COMUN, "ulimit -c", env({})).stdout.trim()).toBe("0");
  });
});

describe("configuración no secreta · la carpeta de respaldos (inv-008.conf)", () => {
  const conConf = (contenido?: string, respaldos?: string) => {
    const base = carpetaTemporal("conf");
    envProduccionFicticio(base, {}, { sinConf: true });
    confFicticia(base, respaldos ?? path.join(base, "respaldos"), contenido);
    return base;
  };
  const armar = (base: string) => funcion(COMUN, 'preparar_entorno; armar_compose; printf "%s" "$INV_RESPALDOS_DIR"', PRUEBA(base));

  it("válida: la toma tal cual y la deja en INV_RESPALDOS_DIR", () => {
    const base = conConf();
    const r = armar(base);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toBe(`${base}/respaldos`);
  });

  it("admite comentarios y líneas vacías, y respaldos de 008 ya existentes (.dump.age, .sha256, .parcial, .ultimo-diario)", () => {
    const base = conConf(undefined);
    writeFileSync(path.join(base, "inv-008.conf"), `# carpeta de respaldos\n\nINV_RESPALDOS_DIR=${base}/respaldos\n`);
    for (const n of ["inv-008-20261121-023000.dump.age", "inv-008-20261121-023000.dump.age.sha256", "inv-008-20261122-101010-pre-migracion.dump.age",
      ".inv-008-20261123-023000.dump.age.4242.parcial", ".ultimo-diario"]) writeFileSync(path.join(base, "respaldos", n), "x");
    const r = armar(base);
    expect(r.status, r.stderr).toBe(0);
  });

  it("sin el archivo: se niega y lo nombra", () => {
    const base = carpetaTemporal("conf");
    envProduccionFicticio(base, {}, { sinConf: true });
    const r = armar(base);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/inv-008\.conf/);
  });

  const malas: Array<[string, (b: string) => string]> = [
    ["relativa", () => "INV_RESPALDOS_DIR=respaldos\n"],
    ["con ..", (b) => `INV_RESPALDOS_DIR=${b}/x/../respaldos\n`],
    ["con .", (b) => `INV_RESPALDOS_DIR=${b}/./respaldos\n`],
    ["con //", (b) => `INV_RESPALDOS_DIR=${b}//respaldos\n`],
    ["que termina en /", (b) => `INV_RESPALDOS_DIR=${b}/respaldos/\n`],
    ["con un espacio", (b) => `INV_RESPALDOS_DIR=${b}/res paldos\n`],
    ["con una sustitución", (b) => `INV_RESPALDOS_DIR=${b}/$(id)\n`],
    ["entre comillas", (b) => `INV_RESPALDOS_DIR="${b}/respaldos"\n`],
    ["repetida", (b) => `INV_RESPALDOS_DIR=${b}/respaldos\nINV_RESPALDOS_DIR=${b}/respaldos\n`],
    ["con otra clave", (b) => `INV_RESPALDOS_DIR=${b}/respaldos\nINV_TAG=${"1".repeat(40)}\n`],
    ["vacía", () => "INV_RESPALDOS_DIR=\n"],
    ["fuera de la raíz de prueba", () => `INV_RESPALDOS_DIR=${carpetaTemporal("afuera")}\n`],
    ["igual a la raíz", (b) => `INV_RESPALDOS_DIR=${b}\n`],
    ["una carpeta que no existe", (b) => `INV_RESPALDOS_DIR=${b}/no-existe\n`],
  ];
  for (const [nombre, contenido] of malas) {
    it(`rechaza una carpeta ${nombre}`, () => {
      const base = carpetaTemporal("conf");
      envProduccionFicticio(base, {}, { sinConf: true });
      confFicticia(base, path.join(base, "respaldos"), contenido(base));
      const r = armar(base);
      expect(r.status).not.toBe(0);
      expect(r.stdout).toBe("");
    });
  }

  it("rechaza un enlace simbólico en cualquier componente de la ruta", () => {
    const base = conConf();
    const real = path.join(base, "real");
    mkdirSync(real);
    symlinkSync(real, path.join(base, "enlace"));
    writeFileSync(path.join(base, "inv-008.conf"), `INV_RESPALDOS_DIR=${base}/enlace\n`);
    expect(armar(base).status).not.toBe(0);
  });

  it("rechaza el archivo de configuración si es un enlace simbólico", () => {
    const base = conConf();
    const otro = path.join(base, "otra.conf");
    writeFileSync(otro, `INV_RESPALDOS_DIR=${base}/respaldos\n`);
    rmSync(path.join(base, "inv-008.conf"));
    symlinkSync(otro, path.join(base, "inv-008.conf"));
    expect(armar(base).status).not.toBe(0);
  });

  it("rechaza una carpeta con entradas que no son respaldos de 008 (no se apunta a otra carpeta)", () => {
    const base = conConf();
    writeFileSync(path.join(base, "respaldos", "passwd"), "x");
    const r = armar(base);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/1 entrada/);
    expect(r.stderr).not.toContain("passwd");
  });

  it("un nombre con salto de línea no se cuela por la lista blanca (se cuenta como ajeno)", () => {
    const base = conConf();
    writeFileSync(path.join(base, "respaldos", "inv-008-20261121-023000.dump.age\n.ultimo-diario"), "x");
    const r = armar(base);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/1 entrada/);
  });

  it.skipIf(esRoot)("si no se puede listar la carpeta, falla cerrado (nunca «sin entradas ajenas» a ciegas)", () => {
    const base = conConf();
    writeFileSync(path.join(base, "respaldos", "passwd"), "x");
    chmodSync(path.join(base, "respaldos"), 0o000);
    try {
      const r = armar(base);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/no se puede listar/);
    } finally {
      chmodSync(path.join(base, "respaldos"), 0o755);
    }
  });

  it("se niega si el archivo de producción define la carpeta o la ruta de la pausa (esas las pone el script)", () => {
    for (const clave of ["INV_RESPALDOS_DIR", "INV_RUTA_PAUSA"]) {
      const base = carpetaTemporal("conf");
      envProduccionFicticio(base, { [clave]: "/x" });
      const r = funcion(COMUN, "preparar_entorno; armar_compose --sin-respaldos", PRUEBA(base));
      expect(r.status, clave).not.toBe(0);
      expect(r.stderr).toContain(clave);
    }
  });

  describe("en producción: dueño, grupo, permisos y lugar (funciones con el dueño y el gid como parámetro)", () => {
    const carpeta = () => {
      const tope = carpetaTemporal("permisos");
      const dir = path.join(tope, "idc", "inversiones");
      mkdirSync(dir, { recursive: true });
      chmodSync(path.join(tope, "idc"), 0o750);
      chmodSync(dir, 0o750);
      return { tope, dir };
    };
    const permisos = (dir: string, tope: string, gid = GID) => funcion(COMUN, `problema_permisos_respaldos "${dir}" "${DUENO}" "${gid}" "${tope}"`);

    it("sana (de su dueño, del grupo de respaldo, 750, padres sanos): sin problemas", () => {
      const { tope, dir } = carpeta();
      const r = permisos(dir, tope);
      expect(r.status, r.stderr).toBe(0);
      expect(r.stdout).toBe("");
    });

    it("750 con setgid también sirve (el grupo lee y entra, nadie más)", () => {
      const { tope, dir } = carpeta();
      chmodSync(dir, 0o750 | 1024); // 1024 = el bit setgid (escrito así para no repetir un número de 4 cifras)
      expect(permisos(dir, tope).stdout).toBe("");
    });

    const casos: Array<[string, (c: { tope: string; dir: string }) => void, string?]> = [
      ["escribible por el grupo", ({ dir }) => chmodSync(dir, 0o770)],
      ["escribible por otros", ({ dir }) => chmodSync(dir, 0o757)],
      // La copia diaria de IDC baja los respaldos con el usuario del grupo respaldo: sin r-x del grupo se corta.
      ["sin lectura del grupo (la copia de IDC no podría listarla)", ({ dir }) => chmodSync(dir, 0o710)],
      ["sin entrada del grupo", ({ dir }) => chmodSync(dir, 0o740)],
      ["legible por otros (debe ser 750: nadie más que el grupo)", ({ dir }) => chmodSync(dir, 0o754)],
      ["con entrada para otros", ({ dir }) => chmodSync(dir, 0o751)],
      ["un padre escribible por el grupo", ({ tope }) => chmodSync(path.join(tope, "idc"), 0o770)],
      ["el tope escribible por otros", ({ tope }) => chmodSync(tope, 0o757)],
    ];
    for (const [nombre, romper] of casos) {
      it(`nombra la carpeta ${nombre}`, () => {
        const c = carpeta();
        romper(c);
        expect(permisos(c.dir, c.tope).stdout).not.toBe("");
      });
    }

    for (const gid of ["0", "", "abc", "-1", "1.5"]) {
      it(`rechaza INV_RESPALDO_GID «${gid}» (nunca 0: el respaldo correría con el grupo de root)`, () => {
        const { tope, dir } = carpeta();
        expect(permisos(dir, tope, gid).stdout).toMatch(/INV_RESPALDO_GID/);
      });
    }

    it("rechaza otro grupo distinto del de respaldo", () => {
      const { tope, dir } = carpeta();
      expect(permisos(dir, tope, String(Number(GID) + 7919)).stdout).not.toBe("");
    });

    it("no puede ser la raíz, ni quedar dentro de ella, ni ser un ancestro suyo", () => {
      const raiz = carpetaTemporal("raiz");
      for (const dir of [raiz, path.join(raiz, "respaldos"), path.dirname(raiz)]) {
        expect(funcion(COMUN, `problema_lugar_respaldos "${dir}" "${raiz}" inv-008-prod`).stdout, dir).not.toBe("");
      }
      expect(funcion(COMUN, `problema_lugar_respaldos "${carpetaTemporal("aparte")}" "${raiz}" inv-008-prod`).stdout).toBe("");
    });
  });
});

// Hallazgo del ensayo: nosuid y noexec en un bind de Docker no se aplican (el kernel ignora esos bits en el bind
// inicial), y además solo cubrirían la vista del contenedor. La protección real es el montaje del HOST de la carpeta
// de respaldos, que hace el CEO de PI. Mientras no lo confirme, los scripts AVISAN (no bloquean); volverlo fatal es
// cambiar una constante (INV_MONTAJE_RESPALDOS_FATAL=1).
describe("montaje del host de la carpeta de respaldos · nosuid y noexec (por ahora avisa)", () => {
  /** findmnt falso versionado: registra la llamada en `<dir>/registro.txt` e imprime `opciones`. */
  const findmntFalso = (opciones: string | null) => {
    const dir = carpetaTemporal("findmnt");
    // null: un findmnt que falla sin imprimir nada (el VPS no puede leer el montaje). Sus opciones serían las buenas:
    // si el falso no fallara, el caso no avisaría. Las tres variables siempre: env() no limpia las FALSO_* heredadas.
    const falso = {
      FALSO_REGISTRO: path.join(dir, "registro.txt"),
      FALSO_FINDMNT_OPCIONES: opciones ?? "rw,nosuid,nodev,noexec,relatime",
      FALSO_FINDMNT_RC: opciones === null ? "1" : "0",
    };
    return { dir, env: env({ PATH: `${path.dirname(FINDMNT_FALSO)}:/usr/bin:/bin`, ...falso }) };
  };
  const revisar = (opciones: string | null, extra = "") => {
    const f = findmntFalso(opciones);
    return { ...f, r: funcion(COMUN, `${extra} revisar_montaje_respaldos /srv/respaldos-ficticios; echo sigue`, f.env) };
  };

  // En macOS, la primera ejecución de cada ejecutable NUEVO pasa por la revisión del sistema, en una sola fila para
  // todo el Mac: con la máquina cargada son segundos por archivo. Por eso findmnt es un archivo fijo del repo.
  it("findmnt es el falso versionado (falsos-montaje/findmnt), el mismo archivo en todas las pruebas: no se crea uno nuevo", () => {
    const versionado = idArchivo(FINDMNT_FALSO);
    for (const opciones of ["rw,nosuid,noexec", null]) expect(idArchivo(rutaEnPath(findmntFalso(opciones).env, "findmnt")), String(opciones)).toBe(versionado);
  });

  it("faltan_opciones_montaje: nombra solo las que faltan, por opción entera", () => {
    const faltan = (o: string) => funcion(COMUN, `faltan_opciones_montaje "${o}"`).stdout.trim();
    expect(faltan("rw,nosuid,nodev,noexec,relatime")).toBe("");
    expect(faltan("rw,relatime")).toBe("nosuid noexec");
    expect(faltan("rw,nosuid,relatime")).toBe("noexec");
    expect(faltan("rw,noexecx,nosuidx")).toBe("nosuid noexec");
  });

  it("la constante empieza en 0 (aviso): volverla fatal es un PR de una línea", () => {
    expect(funcion(COMUN, 'printf "%s" "$INV_MONTAJE_RESPALDOS_FATAL"').stdout).toBe("0");
  });

  it("con nosuid y noexec: no dice nada y sigue", () => {
    const { r, dir } = revisar("rw,nosuid,nodev,noexec,relatime");
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("sigue");
    expect(r.stderr).toBe("");
    // Lee el montaje que contiene la carpeta (findmnt -T), solo sus opciones: no toca nada. Una sola llamada.
    expect(readFileSync(path.join(dir, "registro.txt"), "utf8")).toBe("findmnt\t-no\tOPTIONS\t-T\t/srv/respaldos-ficticios\n");
  });

  it("sin nosuid ni noexec, en modo aviso: avisa nombrando las que faltan y SIGUE (no bloquea el despliegue)", () => {
    const { r } = revisar("rw,relatime");
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("sigue");
    expect(r.stderr).toMatch(/⚠️.*nosuid noexec/);
  });

  it("con la constante en 1: el mismo caso aborta", () => {
    const { r } = revisar("rw,relatime", "INV_MONTAJE_RESPALDOS_FATAL=1;");
    expect(r.status).not.toBe(0);
    expect(r.stdout).not.toContain("sigue");
    expect(r.stderr).toMatch(/nosuid noexec/);
  });

  it("si no se puede leer el montaje (findmnt falla): avisa y sigue en modo aviso; aborta en modo fatal", () => {
    const aviso = revisar(null);
    expect(aviso.r.status, aviso.r.stderr).toBe(0);
    expect(aviso.r.stderr).toMatch(/no se pudo leer el montaje/);
    expect(revisar(null, "INV_MONTAJE_RESPALDOS_FATAL=1;").r.status).not.toBe(0);
  });

  it("leer_respaldos_dir la llama en producción, después de dueño, grupo y permisos", () => {
    const texto = readFileSync008("scripts/produccion-comun.sh");
    const leer = texto.slice(texto.indexOf("leer_respaldos_dir() {"), texto.indexOf("\n}\n", texto.indexOf("leer_respaldos_dir() {")));
    expect(leer).toMatch(/problema_permisos_respaldos[\s\S]*revisar_montaje_respaldos "\$valor"/);
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
    ["la carpeta de otro proyecto, junto a la raíz", `${path.dirname(base)}/otro-proyecto/x`],
    ["prefijo engañoso", `${base}-otra/x`],
  ];
  for (const [nombre, r] of malas) {
    it(`rechaza una ruta ${nombre}`, () => {
      const res = ruta(r);
      expect(res.status).not.toBe(0);
      expect(res.stdout).toBe("");
    });
  }

  it("en producción, desde un clon que no es <raíz>/repo, no hay raíz de escritura: rechaza la base de prueba", () => {
    expect(ruta(`${base}/estado/x`, env({})).status).not.toBe(0);
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
    "bash /ruta/de/pi/repo/002-2026-PROTECCION-INFANTIL/scripts/deploy-prod.sh --skip-pull",
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
  const permitido = (raiz: string, sistema: string, ci: string, euid = "501") => funcion(COMUN, `modo_prueba_permitido "${raiz}" "${sistema}" "${ci}" "${euid}"`).status;
  const sinProduccion = () => carpetaTemporal("raiz-derivada");
  const conProduccion = () => {
    const raiz = carpetaTemporal("raiz-derivada-vps");
    writeFileSync(path.join(raiz, ".env.inversiones.production"), "X=1\n", { mode: 0o600 });
    return raiz;
  };

  it("se acepta en el Mac (Darwin) si la raíz derivada del clon no tiene el archivo de producción", () => {
    expect(permitido(sinProduccion(), "Darwin", "")).toBe(0);
  });

  it("se acepta en GitHub Actions (Linux con GITHUB_ACTIONS=true), para el CI", () => {
    expect(permitido(sinProduccion(), "Linux", "true")).toBe(0);
  });

  it("se rechaza en un Linux que no es el CI", () => {
    expect(permitido(sinProduccion(), "Linux", "")).not.toBe(0);
  });

  it("se rechaza siempre que la raíz derivada tenga el archivo de producción (el VPS)", () => {
    expect(permitido(conProduccion(), "Darwin", "")).not.toBe(0);
    expect(permitido(conProduccion(), "Linux", "true")).not.toBe(0);
  });

  it("se rechaza siempre como root (euid 0): en el VPS todo corre con privilegio", () => {
    expect(permitido(sinProduccion(), "Darwin", "", "0")).not.toBe(0);
    expect(permitido(sinProduccion(), "Linux", "true", "0")).not.toBe(0);
  });

  it("preparar_entorno mira la raíz derivada de SU clon: en un árbol con archivo de producción, la prueba se niega", () => {
    const a = arbolProduccionFalso();
    const r = funcion(a.comun, "preparar_entorno", PRUEBA(carpetaTemporal("base-prueba")));
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/solo corre en el Mac o en el CI/);
  });
});

describe("ruta_escribible · en producción, solo tres destinos: la raíz, el candado común y la carpeta de respaldos configurada", () => {
  // Variables fijadas a mano (como haría preparar_entorno + armar_compose en el VPS), con rutas ficticias.
  const raiz = carpetaTemporal("raiz-prod-rutas");
  const respaldosBase = carpetaTemporal("respaldos-falsos");
  const respaldos = path.join(respaldosBase, "inversiones");
  mkdirSync(respaldos);
  const afuera = carpetaTemporal("afuera-prod");
  const enProd = (r: string, dirRespaldos = respaldos) =>
    funcion(COMUN, `INV_PROYECTO_ACTIVO=inv-008-prod; INV_RAIZ="${raiz}"; INV_CANDADO_COMUN="$INV_CANDADO_COMUN_PROD"; INV_RESPALDOS_PROD="${dirRespaldos}"; ruta_escribible "${r}"`);
  const candado = funcion(COMUN, 'printf "%s" "$INV_CANDADO_COMUN_PROD"').stdout;

  for (const buena of [() => candado, () => respaldos, () => path.join(respaldos, "inv-008-20261121-023000.dump.age"), () => path.join(raiz, "estado", "x")]) {
    it(`acepta ${buena() === candado ? "el candado común" : buena().replace(raiz, "<raíz>").replace(respaldosBase, "<respaldos>")}`, () => {
      const r = enProd(buena());
      expect(r.status, r.stderr).toBe(0);
      expect(r.stdout.trim()).toBe(buena());
    });
  }

  for (const [nombre, mala] of [
    ["otro candado", `${path.dirname(candado)}/otro.lock`],
    ["el candado con sufijo", `${candado}.x`],
    ["el candado con ..", `${path.dirname(candado)}/../x`],
    ["la carpeta del candado", path.dirname(candado)],
    ["el padre de los respaldos", respaldosBase],
    ["el padre de los respaldos con /", `${respaldosBase}/`],
    ["una vecina de los respaldos", `${respaldosBase}/pi`],
    ["un archivo de una vecina", `${respaldosBase}/pi/x.dump`],
    ["una carpeta con prefijo engañoso", `${respaldos}-otra/x`],
    ["una subcarpeta de los respaldos", `${respaldos}/sub/x`],
    ["los respaldos con ..", `${respaldos}/../pi/x`],
    ["una ruta fuera de todo", path.join(afuera, "config.yml")],
  ] as const) {
    it(`rechaza ${nombre}`, () => {
      expect(enProd(mala).status).not.toBe(0);
    });
  }

  it("con la carpeta de respaldos sin leer (vacía), no hay excepción: una ruta de primer nivel se rechaza", () => {
    expect(enProd("/inv-008-primer-nivel", "").status).not.toBe(0);
    expect(enProd(path.join(afuera, "x"), "").status).not.toBe(0);
    const dentro = enProd(path.join(raiz, "estado", "x"), "");
    expect(dentro.status, dentro.stderr).toBe(0);
  });

  it("rechaza un enlace simbólico que sale (dentro de la raíz de prueba)", () => {
    const base = carpetaTemporal("enlace-sale");
    const destino = carpetaTemporal("enlace-destino");
    symlinkSync(destino, path.join(base, "respaldos"));
    const r = funcion(COMUN, `preparar_entorno; ruta_escribible "${base}/respaldos/x.dump.age"`, PRUEBA(base));
    expect(r.status).not.toBe(0);
  });
});

describe("hay_despliegue_ajeno · también con opciones de bash", () => {
  const decidir = (ps: string) => funcion(COMUN, "hay_despliegue_ajeno", process.env, ps).stdout.trim();
  for (const linea of ["bash -x ./scripts/deploy-prod.sh", "/bin/bash -e -x /ruta/de/pi/repo/002-2026-PROTECCION-INFANTIL/scripts/deploy-prod.sh --skip-pull", "sh -eu scripts/deploy-prod.sh"]) {
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
    const conf = path.join(tope, "inv-008.conf");
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
    writeFileSync(conf, "INV_RESPALDOS_DIR=/x\n");
    // Permisos explícitos: no dependen del umask de quien corre las pruebas.
    for (const d of [tope, repo, d008, scripts, path.join(scripts, "ci"), git, path.join(git, "hooks")]) chmodSync(d, 0o755);
    for (const f of Object.values(archivos)) chmodSync(f, 0o644);
    chmodSync(envp, 0o600);
    chmodSync(conf, 0o644);
    return { tope, repo, d008, scripts, git, envp, conf, ...archivos };
  }
  type Arbol = ReturnType<typeof arbol>;
  const revisar = (a: Arbol, quien = dueno) => funcion(COMUN, `rutas_inseguras "${quien}" "${a.tope}" "${a.d008}" "${a.envp}" "${a.conf}"`);

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
    ["la configuración escribible por el grupo (decide un bind de escritura)", (a) => (chmodSync(a.conf, 0o664), a.conf)],
    ["la configuración es un enlace simbólico", (a) => (rmSync(a.conf), symlinkSync("/dev/null", a.conf), a.conf)],
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

  it("sin configuración (todavía no escrita) no la nombra: la exige armar_compose", () => {
    const a = arbol();
    rmSync(a.conf);
    expect(revisar(a).stdout).toBe("");
  });

  it.skipIf(dueno === "root")("con root como dueño, un árbol del usuario es inseguro entero", () => {
    const r = revisar(arbol(), "root");
    expect(r.stdout).toContain("008-2026-INVERSIONES");
  });
});

describe("anclas_inseguras · la raíz derivada y el archivo de producción, siempre fatales", () => {
  const dueno = userInfo().username;
  const arbol = () => {
    const a = arbolProduccionFalso();
    for (const d of [a.raiz, path.dirname(a.dir008), a.dir008]) chmodSync(d, 0o755);
    return a;
  };
  const anclas = (raiz: string, tope: string, quien = dueno) =>
    funcion(COMUN, `anclas_inseguras "${quien}" "${raiz}" "${raiz}/.env.inversiones.production" "${tope}"`);

  it("sanas: no nombra nada", () => {
    const a = arbol();
    const r = anclas(a.raiz, a.raiz);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toBe("");
  });

  const casos: Array<[string, (a: ReturnType<typeof arbol>) => void]> = [
    ["la raíz escribible por el grupo", (a) => chmodSync(a.raiz, 0o775)],
    ["la raíz escribible por otros", (a) => chmodSync(a.raiz, 0o757)],
    ["falta el archivo de producción", (a) => rmSync(path.join(a.raiz, ".env.inversiones.production"))],
    ["el archivo de producción legible por otros", (a) => chmodSync(path.join(a.raiz, ".env.inversiones.production"), 0o604)],
    ["el archivo de producción es un enlace", (a) => {
      const f = path.join(a.raiz, ".env.inversiones.production");
      rmSync(f);
      symlinkSync("/dev/null", f);
    }],
  ];
  for (const [nombre, romper] of casos) {
    it(`nombra ${nombre}`, () => {
      const a = arbol();
      romper(a);
      expect(anclas(a.raiz, a.raiz).stdout).not.toBe("");
    });
  }

  it("sube por los padres hasta el tope: un padre escribible por otros es un ancla rota", () => {
    const tope = carpetaTemporal("tope-anclas");
    const raiz = path.join(tope, "inv");
    mkdirSync(raiz);
    envProduccionFicticio(raiz);
    chmodSync(tope, 0o757);
    chmodSync(raiz, 0o755);
    expect(anclas(raiz, tope).stdout).toContain(tope);
  });

  it.skipIf(dueno === "root")("con root como dueño, un árbol del usuario no es un ancla", () => {
    const a = arbol();
    expect(anclas(a.raiz, a.raiz, "root").stdout).toContain(a.raiz);
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
