// docker/respaldo/respaldo.sh (contenedor inv-008-respaldo, permanente): respaldo diario a la hora fijada
// (COT), semanal el domingo y extras con motivo. pg_dump -Fc | age -r <pública>, sin texto plano en disco,
// con la clave de la base por variables de libpq (nunca en los argumentos), archivos 0640 con el grupo de
// lectura y retención 14 diarios + 8 semanales + extras (los de 48 h y el último de cada motivo nunca se
// borran; del resto, 10). Se corre con `sh`, como en la imagen (busybox).
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
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
  // chgrp que falla con FALSO_CHGRP_RC (y si no, el del sistema).
  falso("chgrp", '[ "${FALSO_CHGRP_RC:-0}" = 0 ] || exit "$FALSO_CHGRP_RC"; for d in /usr/bin /bin; do [ -x "$d/chgrp" ] && exec "$d/chgrp" "$@"; done; exit 127');
  // awk que, con FALSO_AWK_MUERE, imprime la última línea de su entrada (el respaldo más viejo) y muere: un
  // cálculo de retención cortado a mitad. Sin la variable, el del sistema.
  falso("awk", '[ -z "${FALSO_AWK_MUERE:-}" ] || { tail -n 1; exit 1; }; for d in /usr/bin /bin; do [ -x "$d/awk" ] && exec "$d/awk" "$@"; done; exit 127');
  // rm que falla, sin borrar nada, si algún argumento termina en FALSO_RM_FALLA (y si no, el del sistema).
  falso("rm", 'if [ -n "${FALSO_RM_FALLA:-}" ]; then for a in "$@"; do case "$a" in *"$FALSO_RM_FALLA") exit 1 ;; esac; done; fi; for d in /bin /usr/bin; do [ -x "$d/rm" ] && exec "$d/rm" "$@"; done; exit 127');
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
  /** Corre sh con esos argumentos sin bloquear el hilo de la prueba (con muchas corridas seguidas, un
   *  spawnSync deja al worker de vitest sin responder: «Timeout calling onTaskUpdate»). */
  const sinBloquear = (argumentos: string[], entorno: Record<string, string>, entrada?: string) =>
    new Promise<{ status: number | null; stdout: string; stderr: string }>((ok) => {
      const hijo = spawn("sh", argumentos, { env: entorno as unknown as NodeJS.ProcessEnv });
      let stdout = "";
      let stderr = "";
      hijo.stdout.on("data", (c: Buffer) => (stdout += c));
      hijo.stderr.on("data", (c: Buffer) => (stderr += c));
      hijo.on("close", (status) => ok({ status, stdout, stderr }));
      if (entrada !== undefined) hijo.stdin.end(entrada);
    });
  /** Como correr, pero sin bloquear: para dos respaldos a la vez y para las pruebas largas. */
  const lanzar = (args: string[], mas: Record<string, string> = {}) => sinBloquear([SCRIPT, ...args], { ...env, ...mas });
  /** Como funcion, pero sin bloquear. */
  const funcionSinBloquear = (codigo: string, entrada = "") =>
    sinBloquear(["-c", `. "$1"; ${codigo}`, "sh", SCRIPT], { ...env, RESPALDO_CARGAR_SOLO: "1" }, entrada);
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
  return { dir, respaldos, registro, correr, funcion, lanzar, funcionSinBloquear, sostener, candado };
}

const archivosDe = (dir: string) => readdirSync(dir).sort();

/** Un respaldo inventado con su .sha256 de verdad (`<hex>  <nombre>`, como lo deja el script); o dañado. */
function escribirRespaldo(dir: string, nombre: string, sha: "bueno" | "malo" | "falta" = "bueno") {
  const contenido = `age-encryption.org/v1\n${nombre}\n`;
  writeFileSync(path.join(dir, nombre), contenido);
  if (sha === "falta") return;
  const hex = createHash("sha256").update(sha === "malo" ? "otro contenido" : contenido).digest("hex");
  writeFileSync(path.join(dir, `${nombre}.sha256`), `${hex}  ${nombre}\n`);
}

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

  it("la carpeta de respaldos no cambia: sigue en 750 con su dueño y su grupo (la copia de IDC depende de eso)", () => {
    const gid = String(process.getgid!());
    const r = preparar({ RESPALDO_GID: gid });
    chmodSync(r.respaldos, 0o750);
    const antes = statSync(r.respaldos);
    expect(r.correr(["--ahora"]).status).toBe(0);
    expect(r.correr(["--ahora", "--motivo", "otro"]).status).toBe(0);
    const despues = statSync(r.respaldos);
    expect((despues.mode & 0o7777).toString(8)).toBe("750");
    expect([despues.uid, despues.gid]).toEqual([antes.uid, antes.gid]);
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

  it("retención: borra el .age más viejo y su .sha256 cuando hay más de 14 diarios, y la salida sigue siendo la ruta nueva", () => {
    const r = preparar();
    for (let d = 1; d <= 15; d++) escribirRespaldo(r.respaldos, `inv-008-202101${String(d).padStart(2, "0")}-021317.dump.age`);
    const res = r.correr(["--ahora"]);
    expect(res.status, res.stderr).toBe(0);
    const diarios = readdirSync(r.respaldos).filter((n) => /^inv-008-\d{8}-\d{6}\.dump\.age$/.test(n));
    expect(diarios).toHaveLength(14);
    expect(existsSync(path.join(r.respaldos, "inv-008-20210101-021317.dump.age"))).toBe(false);
    expect(existsSync(path.join(r.respaldos, "inv-008-20210101-021317.dump.age.sha256"))).toBe(false);
    const nuevo = res.stdout.trim();
    expect(nuevo).toMatch(new RegExp(`^${r.respaldos}/inv-008-\\d{8}-\\d{6}(-semanal)?\\.dump\\.age$`));
    expect(existsSync(nuevo) && existsSync(`${nuevo}.sha256`)).toBe(true);
  });
});

describe("respaldo.sh · funciones puras", () => {
  it("nombre: semanal el domingo, extra con motivo", () => {
    const r = preparar();
    expect(r.funcion('nombre_respaldo 20261122-023000 7 ""').stdout.trim()).toBe("inv-008-20261122-023000-semanal.dump.age");
    expect(r.funcion('nombre_respaldo 20261123-023000 1 ""').stdout.trim()).toBe("inv-008-20261123-023000.dump.age");
    expect(r.funcion("nombre_respaldo 20261122-023000 7 pre-migracion").stdout.trim()).toBe("inv-008-20261122-023000-pre-migracion.dump.age");
  });

  it("retención: 14 diarios y 8 semanales; 7 extras ya no se recortan; lo que no es un respaldo no se toca", () => {
    const r = preparar();
    const nombres: string[] = [];
    for (let d = 1; d <= 20; d++) nombres.push(`inv-008-202706${String(d).padStart(2, "0")}-023117.dump.age`);
    for (let s = 1; s <= 10; s++) nombres.push(`inv-008-2027${String(s).padStart(2, "0")}01-023117-semanal.dump.age`);
    for (let e = 1; e <= 7; e++) nombres.push(`inv-008-202707${String(e).padStart(2, "0")}-041309-pre-migracion.dump.age`);
    nombres.push("otro.txt", ".inv-008-20270601-023117.dump.age.parcial");
    const res = r.funcion("respaldos_a_borrar 20270708-122341", nombres.join("\n") + "\n");
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout.trim().split("\n").sort()).toEqual(
      [
        ...Array.from({ length: 6 }, (_, i) => `inv-008-202706${String(i + 1).padStart(2, "0")}-023117.dump.age`),
        "inv-008-20270101-023117-semanal.dump.age",
        "inv-008-20270201-023117-semanal.dump.age",
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

  it("si falla un paso después del cifrado (el grupo, el .sha256): no cuenta como respaldo, castiga y no deja archivos", () => {
    const r = preparar({ RESPALDO_HORA: "0000", RESPALDO_GID: String(process.getgid!()), FALSO_CHGRP_RC: "1" });
    const res = r.funcion(PASADA);
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).not.toMatch(/proximo=0/);
    expect(res.stderr).not.toMatch(/respaldo listo/);
    expect(existsSync(path.join(r.respaldos, ".ultimo-diario"))).toBe(false);
    expect(archivosDe(r.respaldos)).toEqual([]);
  });

  it("si el respaldo falla: castiga 15 minutos y no marca el día", () => {
    const r = preparar({ RESPALDO_HORA: "0000", FALSO_PGDUMP_RC: "2" });
    const res = r.funcion(PASADA);
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).not.toMatch(/proximo=0/);
    expect(existsSync(path.join(r.respaldos, ".ultimo-diario"))).toBe(false);
  });
});

const H = 3600_000;
const DIA = 24 * H;
const diario = (ms: number) => `inv-008-${horaCot(ms)}.dump.age`;
const semanal = (ms: number) => `inv-008-${horaCot(ms)}-semanal.dump.age`;
const extra = (ms: number, motivo: string) => `inv-008-${horaCot(ms)}-${motivo}.dump.age`;
/** «Ahora» inyectado de las pruebas de la función: 2027-09-17 12:23:41 COT. */
const AHORA = Date.UTC(2027, 8, 17, 17, 23, 41);

/** Lo que respaldos_a_borrar borraría de `nombres` con «ahora» inyectado (y el recién escrito, si se da), ordenado. */
async function aBorrar(nombres: string[], ahoraMs: number, nuevo?: string) {
  const r = preparar();
  const llamada = `respaldos_a_borrar ${horaCot(ahoraMs)}${nuevo === undefined ? "" : ` "${nuevo}"`}`;
  const res = await r.funcionSinBloquear(llamada, nombres.join("\n") + "\n");
  expect(res.status, res.stderr).toBe(0);
  return res.stdout.split("\n").filter(Boolean).sort();
}

// Lectura de la regla de los extras: un extra de las últimas 48 h y el más reciente de cada motivo nunca se
// borran (son «protegidos»); de los demás se conservan los 10 más nuevos. Los protegidos no ocupan esos 10.
describe("respaldo.sh · retención de extras (48 h, el último de cada motivo y 10 más)", () => {
  it("el caso de hoy: 7 extras el mismo día (cargas y despliegues) y ninguno se borra", async () => {
    const motivos = ["pre-migracion", "pre-carga", "post-carga", "pre-migracion", "post-precios", "pre-carga", "post-carga"];
    const nombres = [diario(AHORA - 10 * H), ...motivos.map((m, i) => extra(AHORA - i * 50 * 60_000, m))];
    expect(await aBorrar(nombres, AHORA)).toEqual([]);
  });

  it("14 extras de las últimas 48 h: ninguno se borra (el tope de 10 no los toca)", async () => {
    const nombres = Array.from({ length: 14 }, (_, k) => extra(AHORA - k * 3 * H, "pre-migracion"));
    expect(await aBorrar(nombres, AHORA)).toEqual([]);
  });

  it("el más reciente de cada motivo sobrevive aunque sea viejo (carga y pre-carga son motivos distintos)", async () => {
    const viejos = Array.from({ length: 12 }, (_, k) => extra(AHORA - 72 * H - k * H, "pre-migracion"));
    const otros = [extra(AHORA - 30 * DIA, "pre-carga"), extra(AHORA - 31 * DIA, "carga"), extra(AHORA - 40 * DIA, "post-carga")];
    const postCargaVieja = extra(AHORA - 41 * DIA, "post-carga");
    const borra = await aBorrar([...viejos, ...otros, postCargaVieja], AHORA);
    for (const n of otros) expect(borra, n).not.toContain(n);
    expect(borra).toEqual([viejos[11]!, postCargaVieja].sort());
  });

  it("fuera de los protegidos, se conservan los 10 extras más nuevos y se borra el resto", async () => {
    const quince = Array.from({ length: 15 }, (_, k) => extra(AHORA - 72 * H - k * H, "pre-migracion"));
    // quince[0] es el último de su motivo; de los otros 14 quedan los 10 más nuevos.
    expect(await aBorrar(quince, AHORA)).toEqual(quince.slice(11).sort());
    const recientes = [0, 1, 2].map((k) => extra(AHORA - k * H, "pre-migracion"));
    const doce = Array.from({ length: 12 }, (_, k) => extra(AHORA - 72 * H - k * H, "pre-migracion"));
    // Los 3 de 48 h no ocupan el tope: de los 12 viejos quedan 10.
    expect(await aBorrar([...recientes, ...doce], AHORA)).toEqual(doce.slice(10).sort());
  });

  it("diarios y semanales sin cambios: 14 y 8, aunque sean de las últimas 48 h y haya extras intercalados", async () => {
    const diarios = Array.from({ length: 20 }, (_, k) => diario(AHORA - k * H));
    const semanales = Array.from({ length: 10 }, (_, k) => semanal(AHORA - k * H - 60_000));
    const extras = [0, 5, 10].map((k) => extra(AHORA - k * H - 120_000, "pre-carga"));
    expect(await aBorrar([...diarios, ...semanales, ...extras], AHORA)).toEqual([...diarios.slice(14), ...semanales.slice(8)].sort());
  });

  it("a 48 h exactas un extra es reciente; a 48 h y 1 s, ya no (fin de mes, de año, 29 de febrero, 2000 y 2100)", async () => {
    const fechas = [
      Date.UTC(2020, 2, 1, 5),
      Date.UTC(2000, 2, 1, 5),
      Date.UTC(2100, 2, 1, 5),
      Date.UTC(2027, 2, 1, 5),
      Date.UTC(2028, 0, 1, 17),
      Date.UTC(2027, 4, 1, 5),
      Date.UTC(2027, 7, 1, 5),
    ];
    for (const ahora of fechas) {
      // El último del motivo es de hace 1 h; detrás, 11 más, uno por minuto, desde el corte de 48 h (+ corrimiento).
      const bloque = (corrimiento: number) => [
        extra(ahora - H, "m"),
        ...Array.from({ length: 11 }, (_, i) => extra(ahora - 48 * H - corrimiento - i * 60_000, "m")),
      ];
      expect(await aBorrar(bloque(0), ahora), horaCot(ahora)).toEqual([]);
      const fuera = bloque(1000);
      expect(await aBorrar(fuera, ahora), horaCot(ahora)).toEqual([fuera[11]!]);
    }
  });

  it("un extra con fecha futura (reloj corrido) cuenta como reciente", async () => {
    const futuros = Array.from({ length: 12 }, (_, k) => extra(AHORA + (k + 1) * DIA, "pre-migracion"));
    expect(await aBorrar(futuros, AHORA)).toEqual([]);
  });

  it("el recién escrito nunca se imprime, pero cuenta en el tope: 15 diarios viejos más el nuevo dejan 14", async () => {
    const viejos = Array.from({ length: 15 }, (_, k) => diario(AHORA - (k + 1) * DIA));
    const nuevo = diario(AHORA);
    expect(await aBorrar([nuevo, ...viejos], AHORA, nuevo)).toEqual(viejos.slice(13).sort());
  });

  it("el recién escrito no se borra aunque haya 14 diarios u 8 semanales con fecha futura", async () => {
    const diariosFuturos = Array.from({ length: 14 }, (_, k) => diario(AHORA + (k + 1) * DIA));
    const nuevoDiario = diario(AHORA);
    expect(await aBorrar([...diariosFuturos, nuevoDiario], AHORA, nuevoDiario)).toEqual([]);
    const semanalesFuturos = Array.from({ length: 8 }, (_, k) => semanal(AHORA + (k + 1) * 7 * DIA));
    const nuevoSemanal = semanal(AHORA);
    expect(await aBorrar([...semanalesFuturos, nuevoSemanal], AHORA, nuevoSemanal)).toEqual([]);
  });

  it("un motivo que termina en «-semanal» es un extra: no desplaza a los semanales ni pierde su protección", async () => {
    const semanales = Array.from({ length: 9 }, (_, k) => semanal(AHORA - (k + 1) * 7 * DIA));
    const raro = extra(AHORA - 100 * DIA, "x-semanal");
    expect(await aBorrar([...semanales, raro], AHORA)).toEqual([semanales[8]!]);
  });

  it("con «ahora» ausente, vacío, corto, largo, con letras o con un salto de línea: no imprime nada y falla", async () => {
    const r = preparar();
    const entrada = Array.from({ length: 20 }, (_, k) => extra(AHORA - 100 * DIA - k * H, "pre-migracion")).join("\n") + "\n";
    const llamadas = [
      "respaldos_a_borrar",
      'respaldos_a_borrar ""',
      "respaldos_a_borrar 73723602-07333",
      "respaldos_a_borrar 20270917-1200000",
      "respaldos_a_borrar 2027091a-122341",
      `respaldos_a_borrar "$(printf '20270917-120000\\nx')"`,
    ];
    for (const llamada of llamadas) {
      const res = await r.funcionSinBloquear(llamada, entrada);
      expect(res.stdout, llamada).toBe("");
      expect(res.status, llamada).not.toBe(0);
    }
  });
});

describe("respaldo.sh · retención al guardar un respaldo (de punta a punta)", () => {
  it("el caso de hoy: 6 extras de hoy y un --ahora --motivo post-carga; quedan los 7, cada uno con su .sha256", async () => {
    const r = preparar();
    const ahora = Date.now();
    const motivos = ["pre-migracion", "pre-carga", "post-carga", "pre-migracion", "pre-carga", "post-precios"];
    motivos.forEach((m, i) => escribirRespaldo(r.respaldos, extra(ahora - (i + 1) * 30 * 60_000, m)));
    const res = await r.lanzar(["--ahora", "--motivo", "post-carga"]);
    expect(res.status, res.stderr).toBe(0);
    expect(conAge(r.respaldos)).toHaveLength(7);
    for (const n of conAge(r.respaldos)) expect(existsSync(path.join(r.respaldos, `${n}.sha256`)), n).toBe(true);
    expect(res.stderr).not.toMatch(/retención: borrado/);
  });

  it("el respaldo recién escrito nunca se borra, aunque 14 diarios y 8 semanales tengan fecha futura", async () => {
    const r = preparar();
    const ahora = Date.now();
    const futuros = [
      ...Array.from({ length: 14 }, (_, k) => diario(ahora + (k + 1) * DIA)),
      ...Array.from({ length: 8 }, (_, k) => semanal(ahora + (k + 1) * 7 * DIA)),
    ];
    for (const n of futuros) escribirRespaldo(r.respaldos, n);
    const res = await r.lanzar(["--ahora"]);
    expect(res.status, res.stderr).toBe(0);
    const nuevo = res.stdout.trim();
    expect(existsSync(nuevo), nuevo).toBe(true);
    expect(existsSync(`${nuevo}.sha256`)).toBe(true);
    for (const n of futuros) expect(existsSync(path.join(r.respaldos, n)), n).toBe(true);
  });

  it("un .sha256 que no cuadra o que falta: ese respaldo no se borra y queda en el registro; los demás sí", async () => {
    const r = preparar();
    const ahora = Date.now();
    const viejos = Array.from({ length: 15 }, (_, k) => extra(ahora - 72 * H - k * H, "pre-migracion"));
    viejos.forEach((n, k) => escribirRespaldo(r.respaldos, n, k === 12 ? "malo" : k === 13 ? "falta" : "bueno"));
    const res = await r.lanzar(["--ahora", "--motivo", "otro"]);
    expect(res.status, res.stderr).toBe(0);
    const quedan = new Set(archivosDe(r.respaldos));
    for (const k of [11, 14]) {
      expect(quedan.has(viejos[k]!), viejos[k]).toBe(false);
      expect(quedan.has(`${viejos[k]}.sha256`), viejos[k]).toBe(false);
    }
    for (const k of [12, 13]) {
      expect(quedan.has(viejos[k]!), viejos[k]).toBe(true);
      expect(res.stderr).toContain(viejos[k]);
    }
    expect(quedan.has(`${viejos[12]}.sha256`)).toBe(true);
    for (const n of viejos.slice(0, 11)) expect(quedan.has(n), n).toBe(true);
  });

  it("si el cálculo de la retención muere a mitad (awk), no se borra nada y el respaldo nuevo queda bien", async () => {
    const r = preparar();
    const ahora = Date.now();
    const viejos = Array.from({ length: 15 }, (_, k) => extra(ahora - 72 * H - k * H, "pre-migracion"));
    for (const n of viejos) escribirRespaldo(r.respaldos, n);
    const res = await r.lanzar(["--ahora", "--motivo", "x"], { FALSO_AWK_MUERE: "1" });
    expect(res.status, res.stderr).toBe(0);
    const nuevo = res.stdout.trim();
    expect(existsSync(nuevo) && existsSync(`${nuevo}.sha256`), nuevo).toBe(true);
    for (const n of viejos) expect(existsSync(path.join(r.respaldos, n)), n).toBe(true);
    expect(res.stderr).toMatch(/retención: .*no se borra nada/);
    expect(res.stderr).toMatch(/respaldo listo/);
  });

  it("pasada: si la retención falla, el diario igual cuenta (marca el día, sin castigo) y no se borra nada", async () => {
    const r = preparar({ RESPALDO_HORA: "0000", FALSO_AWK_MUERE: "1" });
    const ahora = Date.now();
    const viejos = Array.from({ length: 15 }, (_, k) => extra(ahora - 72 * H - k * H, "pre-migracion"));
    for (const n of viejos) escribirRespaldo(r.respaldos, n);
    const res = await r.funcionSinBloquear('preparar_conexion; proximo_intento=0; pasada; echo "proximo=$proximo_intento"');
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).toMatch(/proximo=0/);
    expect(existsSync(path.join(r.respaldos, ".ultimo-diario"))).toBe(true);
    for (const n of viejos) expect(existsSync(path.join(r.respaldos, n)), n).toBe(true);
  });

  it("un enlace simbólico con nombre de respaldo no se borra (ni lo que apunta)", async () => {
    const r = preparar();
    const ahora = Date.now();
    const viejos = Array.from({ length: 12 }, (_, k) => extra(ahora - 72 * H - k * H, "pre-migracion"));
    for (const n of viejos.slice(0, 11)) escribirRespaldo(r.respaldos, n);
    const objetivo = path.join(r.dir, "objetivo.ficticio.txt");
    writeFileSync(objetivo, "no es un respaldo\n");
    symlinkSync(objetivo, path.join(r.respaldos, viejos[11]!));
    const res = await r.lanzar(["--ahora", "--motivo", "x"]);
    expect(res.status, res.stderr).toBe(0);
    expect(lstatSync(path.join(r.respaldos, viejos[11]!)).isSymbolicLink()).toBe(true);
    expect(readFileSync(objetivo, "utf8")).toBe("no es un respaldo\n");
  });

  it("si no se puede borrar el .age, el par queda entero; si falla el .sha256, queda suelto; los dos se registran", async () => {
    const ahora = Date.now();
    const viejos = Array.from({ length: 12 }, (_, k) => extra(ahora - 72 * H - k * H, "pre-migracion"));
    for (const [falla, quedaAge] of [[`${viejos[11]}`, true], [`${viejos[11]}.sha256`, false]] as const) {
      const r = preparar();
      for (const n of viejos) escribirRespaldo(r.respaldos, n);
      const res = await r.lanzar(["--ahora", "--motivo", "x"], { FALSO_RM_FALLA: falla });
      expect(res.status, res.stderr).toBe(0);
      expect(existsSync(path.join(r.respaldos, viejos[11]!)), falla).toBe(quedaAge);
      expect(existsSync(path.join(r.respaldos, `${viejos[11]}.sha256`)), falla).toBe(true);
      expect(res.stderr).toContain(`no se pudo borrar ${viejos[11]}`);
      expect(res.stderr).toMatch(/retención: no se completó/);
      expect(existsSync(res.stdout.trim())).toBe(true);
    }
  });
});
