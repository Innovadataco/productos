// docker/respaldo/respaldo.sh (contenedor inv-008-respaldo, permanente): respaldo diario a la hora fijada
// (COT), semanal el domingo y extras con motivo. pg_dump -Fc | age -r <pública>, sin texto plano en disco,
// con la clave de la base por variables de libpq (nunca en los argumentos), archivos 0640 con el grupo de
// lectura y retención 14 diarios + 8 semanales + 5 extras. Se corre con `sh`, como en la imagen (busybox).
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { carpetaTemporal, ruta008 } from "./falsos";

vi.setConfig({ testTimeout: 60_000 });

const SCRIPT = ruta008("docker/respaldo/respaldo.sh");
const CLAVE = "f".repeat(64);
const PUBLICA = `age1${"q".repeat(58)}`;

function preparar(extra: Record<string, string> = {}) {
  const dir = carpetaTemporal("respaldo-cont");
  const bin = path.join(dir, "bin");
  const respaldos = path.join(dir, "respaldos");
  mkdirSync(bin);
  mkdirSync(respaldos);
  const registro = path.join(dir, "registro.txt");
  writeFileSync(registro, "");
  const falso = (nombre: string, cuerpo: string) => {
    writeFileSync(path.join(bin, nombre), `#!/bin/sh\nl="${nombre}"; for a in "$@"; do l="$l|$a"; done; printf '%s\\n' "$l" >>"$FALSO_REGISTRO"\n${cuerpo}\n`);
    chmodSync(path.join(bin, nombre), 0o755);
  };
  // FALSO_PGDUMP_ESPERA y FALSO_AGE_ESPERA: segundos que tardan (para las carreras entre dos respaldos).
  // FALSO_PGDUMP_SENAL: archivo que pg_dump deja justo antes de fallar (la prueba espera a verlo).
  falso("pg_dump", 'printf "%s\\n" "PG:$PGUSER@$PGHOST:$PGPORT/$PGDATABASE" >>"$FALSO_REGISTRO"; [ -z "${FALSO_PGDUMP_ESPERA:-}" ] || sleep "$FALSO_PGDUMP_ESPERA"; [ "${FALSO_PGDUMP_RC:-0}" = 0 ] || { [ -z "${FALSO_PGDUMP_SENAL:-}" ] || : >"$FALSO_PGDUMP_SENAL"; exit "$FALSO_PGDUMP_RC"; }; printf "PGDMP-TEXTO-PLANO-secreto"');
  falso("age", '[ "${FALSO_AGE_RC:-0}" = 0 ] || { cat >/dev/null; exit "$FALSO_AGE_RC"; }; printf "age-encryption.org/v1\\n"; tr "A-Za-z" "N-ZA-Mn-za-m"; [ -z "${FALSO_AGE_ESPERA:-}" ] || sleep "$FALSO_AGE_ESPERA"');
  // flock de verdad en el Mac (que no lo trae) y en Linux: flock(2) con perl sobre el descriptor heredado,
  // con la interfaz de BusyBox que usa la imagen (-n, -u y -x; sin -w). El candado queda tomado mientras el
  // descriptor siga abierto en el proceso que lo pidió, como con el flock real.
  falso(
    "flock",
    `modo=LOCK_EX; nb=0
while [ $# -gt 1 ]; do case "$1" in -n) nb=1 ;; -u) modo=LOCK_UN ;; -x) ;; *) break ;; esac; shift; done
exec perl -e 'use Fcntl qw(:flock); open(my $fh, ">&=", $ARGV[0]) or exit 2; my $op = $ARGV[1] eq "LOCK_UN" ? LOCK_UN : (LOCK_EX | ($ARGV[2] ? LOCK_NB : 0)); exit(flock($fh, $op) ? 0 : 1)' "$1" "$modo" "$nb"`,
  );
  const env: Record<string, string> = {
    PATH: `${bin}:${process.env.PATH}`,
    HOME: dir,
    FALSO_REGISTRO: registro,
    DATABASE_URL: `postgresql://inv_dueno:${CLAVE}@inv-008-db:5432/inversiones?schema=public&connection_limit=3`,
    AGE_PUBLICA: PUBLICA,
    RESPALDO_DIR: respaldos,
    RESPALDO_ESTADO_DIR: path.join(dir, "estado"),
    ...extra,
  };
  const correr = (args: string[], mas: Record<string, string> = {}) =>
    spawnSync("sh", [SCRIPT, ...args], { env: { ...env, ...mas } as unknown as NodeJS.ProcessEnv, encoding: "utf8" });
  const funcion = (codigo: string, entrada?: string) =>
    spawnSync("sh", ["-c", `. "$1"; ${codigo}`, "sh", SCRIPT], { env: { ...env, RESPALDO_CARGAR_SOLO: "1" } as unknown as NodeJS.ProcessEnv, input: entrada, encoding: "utf8" });
  /** Como correr, pero sin bloquear: para dos respaldos a la vez. */
  const lanzar = (args: string[], mas: Record<string, string> = {}) =>
    new Promise<{ status: number | null; stdout: string; stderr: string }>((ok) => {
      const hijo = spawn("sh", [SCRIPT, ...args], { env: { ...env, ...mas } as unknown as NodeJS.ProcessEnv });
      let stdout = "";
      let stderr = "";
      hijo.stdout.on("data", (c: Buffer) => (stdout += c));
      hijo.stderr.on("data", (c: Buffer) => (stderr += c));
      hijo.on("close", (status) => ok({ status, stdout, stderr }));
    });
  const candado = path.join(dir, "estado", "respaldo.candado");
  /** Toma el candado del respaldo desde fuera (como haría otro respaldo en curso) hasta que se suelte. */
  const sostener = () =>
    new Promise<{ soltar: () => Promise<void> }>((ok, mal) => {
      mkdirSync(path.dirname(candado), { recursive: true });
      const hijo = spawn("sh", ["-c", 'exec 7>"$1"; flock -n 7 || exit 9; echo tomado; read -r _', "sh", candado], {
        env: env as unknown as NodeJS.ProcessEnv,
      });
      const fin = new Promise<void>((r) => hijo.on("close", () => r()));
      hijo.stdout.on("data", (c: Buffer) => {
        if (String(c).includes("tomado")) ok({ soltar: () => (hijo.stdin.end("\n"), fin) });
      });
      hijo.on("close", (codigo) => mal(new Error(`no se tomó el candado (${codigo})`)));
    });
  return { dir, respaldos, registro, correr, funcion, lanzar, sostener, candado };
}

const archivosDe = (dir: string) => readdirSync(dir).sort();

describe("respaldo.sh --ahora", () => {
  it("deja el .age cifrado con su .sha256 y devuelve la ruta", () => {
    const r = preparar();
    const res = r.correr(["--ahora", "--motivo", "pre-migracion"]);
    expect(res.status, res.stderr).toBe(0);
    const archivos = archivosDe(r.respaldos);
    expect(archivos).toHaveLength(2);
    expect(archivos[0]).toMatch(/^inv-008-\d{8}-\d{6}-pre-migracion\.dump\.age$/);
    expect(res.stdout.trim()).toBe(path.join(r.respaldos, archivos[0]!));
    expect(readFileSync(path.join(r.respaldos, archivos[0]!), "utf8")).toMatch(/^age-encryption\.org\/v1\n/);
    expect(readFileSync(path.join(r.respaldos, archivos[1]!), "utf8")).toMatch(new RegExp(`^[0-9a-f]{64}  ${archivos[0]}\\n$`));
  });

  it("la clave de la base nunca va en los argumentos de pg_dump: van PGHOST/PGUSER/PGPASSWORD por el entorno", () => {
    const r = preparar();
    expect(r.correr(["--ahora"]).status).toBe(0);
    const registro = readFileSync(r.registro, "utf8");
    expect(registro).toContain("PG:inv_dueno@inv-008-db:5432/inversiones");
    expect(registro).not.toContain(CLAVE);
    expect(registro).toMatch(/^pg_dump\|-Fc$/m);
  });

  it("el texto plano nunca queda en disco", () => {
    const r = preparar();
    r.correr(["--ahora"]);
    for (const n of readdirSync(r.respaldos)) expect(readFileSync(path.join(r.respaldos, n), "utf8")).not.toContain("PGDMP-TEXTO-PLANO");
  });

  it("archivos 0640 (lectura para el grupo del usuario de copia); con RESPALDO_GID, ese grupo", () => {
    const gid = String(process.getgid!());
    const r = preparar({ RESPALDO_GID: gid });
    expect(r.correr(["--ahora"]).status).toBe(0);
    for (const n of readdirSync(r.respaldos)) {
      const st = statSync(path.join(r.respaldos, n));
      expect((st.mode & 0o777).toString(8), n).toBe("640");
      expect(String(st.gid)).toBe(gid);
    }
  });

  for (const [nombre, falla] of [
    ["pg_dump", { FALSO_PGDUMP_RC: "2" }],
    ["age", { FALSO_AGE_RC: "3" }],
  ] as const) {
    it(`si falla ${nombre}, no queda ningún archivo`, () => {
      const r = preparar();
      expect(r.correr(["--ahora"], falla).status).not.toBe(0);
      expect(archivosDe(r.respaldos)).toEqual([]);
    });
  }

  it("rechaza una clave pública inválida, una URL que no es postgresql y un motivo raro", () => {
    const r = preparar();
    expect(r.correr(["--ahora"], { AGE_PUBLICA: "AGE-SECRET-KEY-1NOESPUBLICA" }).status).not.toBe(0);
    expect(r.correr(["--ahora"], { DATABASE_URL: "mysql://x:y@h/z" }).status).not.toBe(0);
    expect(r.correr(["--ahora", "--motivo", "../../etc"]).status).not.toBe(0);
    expect(archivosDe(r.respaldos)).toEqual([]);
  });

  it("retención: borra el .age más viejo y su .sha256 cuando hay más de 14 diarios", () => {
    const r = preparar();
    for (let d = 1; d <= 15; d++) {
      const n = `inv-008-202601${String(d).padStart(2, "0")}-020000.dump.age`;
      writeFileSync(path.join(r.respaldos, n), "age-encryption.org/v1\n");
      writeFileSync(path.join(r.respaldos, `${n}.sha256`), "x");
    }
    expect(r.correr(["--ahora"]).status).toBe(0);
    const diarios = readdirSync(r.respaldos).filter((n) => /^inv-008-\d{8}-\d{6}\.dump\.age$/.test(n));
    expect(diarios).toHaveLength(14);
    expect(existsSync(path.join(r.respaldos, "inv-008-20260101-020000.dump.age"))).toBe(false);
    expect(existsSync(path.join(r.respaldos, "inv-008-20260101-020000.dump.age.sha256"))).toBe(false);
  });
});

describe("respaldo.sh · funciones puras", () => {
  it("nombre: semanal el domingo, extra con motivo", () => {
    const r = preparar();
    expect(r.funcion('nombre_respaldo 20261122-023000 7 ""').stdout.trim()).toBe("inv-008-20261122-023000-semanal.dump.age");
    expect(r.funcion('nombre_respaldo 20261123-023000 1 ""').stdout.trim()).toBe("inv-008-20261123-023000.dump.age");
    expect(r.funcion("nombre_respaldo 20261122-023000 7 pre-migracion").stdout.trim()).toBe("inv-008-20261122-023000-pre-migracion.dump.age");
  });

  it("retención: 14 diarios, 8 semanales y 5 extras", () => {
    const r = preparar();
    const nombres: string[] = [];
    for (let d = 1; d <= 20; d++) nombres.push(`inv-008-202611${String(d).padStart(2, "0")}-020000.dump.age`);
    for (let s = 1; s <= 10; s++) nombres.push(`inv-008-2026${String(s).padStart(2, "0")}01-020000-semanal.dump.age`);
    for (let e = 1; e <= 7; e++) nombres.push(`inv-008-202612${String(e).padStart(2, "0")}-040000-pre-migracion.dump.age`);
    nombres.push("otro.txt", ".inv-008-20261101-020000.dump.age.parcial");
    const borrar = r.funcion("respaldos_a_borrar", nombres.join("\n") + "\n").stdout.trim().split("\n").sort();
    expect(borrar).toEqual(
      [
        ...Array.from({ length: 6 }, (_, i) => `inv-008-202611${String(i + 1).padStart(2, "0")}-020000.dump.age`),
        "inv-008-20260101-020000-semanal.dump.age",
        "inv-008-20260201-020000-semanal.dump.age",
        "inv-008-20261201-040000-pre-migracion.dump.age",
        "inv-008-20261202-040000-pre-migracion.dump.age",
      ].sort(),
    );
  });

  it("toca_respaldo: una vez al día, a partir de la hora fijada", () => {
    const r = preparar();
    const toca = (hora: string, hoy: string, ultimo: string) => r.funcion(`toca_respaldo ${hora} ${hoy} "${ultimo}"`).status;
    expect(toca("0229", "20261121", "20261120")).not.toBe(0);
    expect(toca("0230", "20261121", "20261120")).toBe(0);
    expect(toca("1500", "20261121", "")).toBe(0);
    expect(toca("1500", "20261121", "20261121")).not.toBe(0);
  });
});

describe("respaldo.sh · salud y arranque", () => {
  it("sin DATABASE_URL o sin AGE_PUBLICA no arranca, sin imprimir valores", () => {
    const r = preparar();
    const res = r.correr(["--ahora"], { DATABASE_URL: "" });
    expect(res.status).not.toBe(0);
    expect(res.stderr).not.toContain(CLAVE);
  });

  it("--salud falla si no hay latido", () => {
    const r = preparar();
    expect(r.correr(["--salud"]).status).not.toBe(0);
  });
});

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Fecha y hora de Colombia (UTC-5, sin horario de verano) en el formato del nombre: AAAAMMDD-HHMMSS. */
const horaCot = (ms: number) => {
  const d = new Date(ms - 5 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
};
const conAge = (dir: string) => archivosDe(dir).filter((n) => n.endsWith(".dump.age"));

describe("respaldo.sh · un solo respaldo a la vez (manual y bucle diario en el mismo contenedor)", () => {
  it("control: el flock falso de la prueba muerde (si no, las carreras de abajo no prueban nada)", async () => {
    const r = preparar();
    const tomado = await r.sostener();
    const otro = spawnSync("sh", ["-c", 'exec 7>"$1"; flock -n 7', "sh", r.candado], { env: { ...process.env, PATH: `${path.join(r.dir, "bin")}:${process.env.PATH}`, FALSO_REGISTRO: r.registro } });
    expect(otro.status).toBe(1);
    await tomado.soltar();
  });

  it("un pg_dump fallido nunca se guarda, aunque otro respaldo arranque en medio (antes: «respaldo listo» con el volcado cortado)", async () => {
    const r = preparar();
    // B arranca recién cuando el pg_dump de A ya falló y A todavía no revisó su marca de fallo (age tarda 3 s).
    const senal = path.join(r.dir, "pg_dump-de-a-fallo");
    const a = r.lanzar(["--ahora", "--motivo", "a"], { FALSO_PGDUMP_RC: "2", FALSO_PGDUMP_ESPERA: "1", FALSO_AGE_ESPERA: "3", FALSO_PGDUMP_SENAL: senal });
    for (let i = 0; i < 200 && !existsSync(senal); i++) await esperar(50);
    expect(existsSync(senal)).toBe(true);
    const b = r.lanzar(["--ahora", "--motivo", "b"], { RESPALDO_ESPERA_S: "30" });
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra.status, ra.stderr).not.toBe(0);
    expect(ra.stdout).toBe("");
    expect(rb.status, rb.stderr).toBe(0);
    expect(conAge(r.respaldos)).toEqual([expect.stringMatching(/-b\.dump\.age$/)]);
    expect(archivosDe(r.respaldos).filter((n) => n.endsWith(".parcial"))).toEqual([]);
  });

  it("si otro respaldo está en curso y no se espera (RESPALDO_ESPERA_S=0): sale con 75 sin tocar los respaldos", async () => {
    const r = preparar();
    const tomado = await r.sostener();
    const res = r.correr(["--ahora"], { RESPALDO_ESPERA_S: "0" });
    await tomado.soltar();
    expect(res.status, res.stderr).toBe(75);
    expect(res.stderr).toMatch(/otro respaldo/);
    expect(archivosDe(r.respaldos)).toEqual([]);
  });

  it("con espera: el segundo respaldo termina después del primero, con otro nombre, y los dos son válidos", async () => {
    const r = preparar();
    const a = r.lanzar(["--ahora", "--motivo", "x"], { FALSO_PGDUMP_ESPERA: "2" });
    await esperar(300);
    const b = r.lanzar(["--ahora", "--motivo", "x"], { RESPALDO_ESPERA_S: "30" });
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra.status, ra.stderr).toBe(0);
    expect(rb.status, rb.stderr).toBe(0);
    expect(ra.stdout.trim()).not.toBe(rb.stdout.trim());
    const nombres = conAge(r.respaldos);
    expect(nombres).toHaveLength(2);
    for (const n of nombres) {
      expect(readFileSync(path.join(r.respaldos, n), "utf8")).toMatch(/^age-encryption\.org\/v1\n/);
      expect(readFileSync(path.join(r.respaldos, `${n}.sha256`), "utf8")).toMatch(new RegExp(`^[0-9a-f]{64}  ${n}\\n$`));
    }
  });

  it("RESPALDO_ESPERA_S que no es un entero: no arranca", () => {
    const r = preparar();
    expect(r.correr(["--ahora"], { RESPALDO_ESPERA_S: "1; id" }).status).toBe(64);
    expect(archivosDe(r.respaldos)).toEqual([]);
  });
});

describe("respaldo.sh · restos y nombres", () => {
  it("borra los .parcial de más de 60 minutos (un respaldo cortado) y deja los recientes", () => {
    const r = preparar();
    const viejo = path.join(r.respaldos, ".inv-008-20261101-020000.dump.age.parcial");
    const viejoConPid = path.join(r.respaldos, ".inv-008-20261102-020000.dump.age.4242.parcial");
    const reciente = path.join(r.respaldos, ".inv-008-20261121-000000.dump.age.4243.parcial");
    for (const f of [viejo, viejoConPid, reciente]) writeFileSync(f, "age-encryption.org/v1\n");
    const hace2h = (Date.now() - 2 * 3600_000) / 1000;
    utimesSync(viejo, hace2h, hace2h);
    utimesSync(viejoConPid, hace2h, hace2h);
    const res = r.correr(["--ahora"]);
    expect(res.status, res.stderr).toBe(0);
    expect(existsSync(viejo)).toBe(false);
    expect(existsSync(viejoConPid)).toBe(false);
    expect(existsSync(reciente)).toBe(true);
  });

  it("si el nombre final ya existe (dos respaldos en el mismo segundo), no lo sobrescribe: toma el segundo siguiente", () => {
    const r = preparar();
    const ahora = Date.now();
    const previos = [0, 1, 2].map((s) => path.join(r.respaldos, `inv-008-${horaCot(ahora + s * 1000)}-n.dump.age`));
    for (const f of previos) writeFileSync(f, "previo");
    const res = r.correr(["--ahora", "--motivo", "n"]);
    expect(res.status, res.stderr).toBe(0);
    for (const f of previos) expect(readFileSync(f, "utf8")).toBe("previo");
    const nuevo = res.stdout.trim();
    expect(previos).not.toContain(nuevo);
    expect(readFileSync(nuevo, "utf8")).toMatch(/^age-encryption\.org\/v1\n/);
  });
});

describe("respaldo.sh · pasada del bucle diario", () => {
  const PASADA = 'preparar_conexion; proximo_intento=0; pasada; echo "proximo=$proximo_intento"';

  it("con el candado tomado por otro respaldo: salta el minuto, sin marcar el día ni castigar 15 minutos", async () => {
    const r = preparar({ RESPALDO_HORA: "0000" });
    const tomado = await r.sostener();
    const res = r.funcion(PASADA);
    await tomado.soltar();
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).toMatch(/proximo=0/);
    expect(existsSync(path.join(r.respaldos, ".ultimo-diario"))).toBe(false);
    expect(conAge(r.respaldos)).toEqual([]);
  });

  it("libre: hace el diario y marca el día", () => {
    const r = preparar({ RESPALDO_HORA: "0000" });
    const res = r.funcion(PASADA);
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).toMatch(/proximo=0/);
    expect(existsSync(path.join(r.respaldos, ".ultimo-diario"))).toBe(true);
    expect(conAge(r.respaldos)).toHaveLength(1);
  });

  it("si el respaldo falla: castiga 15 minutos y no marca el día", () => {
    const r = preparar({ RESPALDO_HORA: "0000", FALSO_PGDUMP_RC: "2" });
    const res = r.funcion(PASADA);
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).not.toMatch(/proximo=0/);
    expect(existsSync(path.join(r.respaldos, ".ultimo-diario"))).toBe(false);
  });
});
