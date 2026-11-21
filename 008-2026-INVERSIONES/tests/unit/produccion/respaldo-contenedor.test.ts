// docker/respaldo/respaldo.sh (contenedor inv-008-respaldo, permanente): respaldo diario a la hora fijada
// (COT), semanal el domingo y extras con motivo. pg_dump -Fc | age -r <pública>, sin texto plano en disco,
// con la clave de la base por variables de libpq (nunca en los argumentos), archivos 0640 con el grupo de
// lectura y retención 14 diarios + 8 semanales + 5 extras. Se corre con `sh`, como en la imagen (busybox).
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
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
  falso("pg_dump", 'printf "%s\\n" "PG:$PGUSER@$PGHOST:$PGPORT/$PGDATABASE" >>"$FALSO_REGISTRO"; [ "${FALSO_PGDUMP_RC:-0}" = 0 ] || exit "$FALSO_PGDUMP_RC"; printf "PGDMP-TEXTO-PLANO-secreto"');
  falso("age", '[ "${FALSO_AGE_RC:-0}" = 0 ] || { cat >/dev/null; exit "$FALSO_AGE_RC"; }; printf "age-encryption.org/v1\\n"; tr "A-Za-z" "N-ZA-Mn-za-m"');
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
  return { dir, respaldos, registro, correr, funcion };
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
