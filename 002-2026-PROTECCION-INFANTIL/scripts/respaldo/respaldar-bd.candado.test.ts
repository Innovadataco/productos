/**
 * CANDADO · SPEC-978 — el respaldo diario NUNCA deja un dump en claro, y falla cerrado.
 *
 * El radicado exige dos propiedades duras, verificadas aquí:
 *  1. ANÁLISIS ESTÁTICO DEL PIPE: toda línea con `pg_dump` del script vuelca el dump a `age -r`
 *     EN EL MISMO PIPE antes de cualquier `>`; jamás escribe el dump en claro a disco (ni por `>`,
 *     ni por `-f/--file`, ni por un `tee` intermedio). Se prueba con un checker PURO (`esPipeSeguro`)
 *     que se aplica a las líneas REALES del script (control positivo) y a mutaciones típicas (control
 *     negativo): si alguien «optimiza» el pipe a `pg_dump > dump` o mete un `tee`, el candado se enciende.
 *  2. ABORTA ante un flag desconocido (exit 2) y FALLA CERRADO sin destinatario age (exit != 0, sin
 *     escribir nada).
 *
 * Además ejercita por `source` (sin docker/BD) las funciones PURAS del script (ruta de destino, fecha
 * embebida, selección de retención por corte AAAAMMDD) y ancla el contrato del CEO (pipefail, destino,
 * nombres, 640 root:respaldo, flock, retención 14d). Unit puro (texto + bash + tmp) → `test:unit`/`pi-gate`.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SCRIPT = path.join(process.cwd(), "scripts/respaldo/respaldar-bd.sh");
const SRC = readFileSync(SCRIPT, "utf8");

/**
 * Checker PURO del pipe: ¿esta línea de shell escribe el dump SOLO cifrado?
 * `true` = segura (o no hay pg_dump); `false` = el dump podría tocar el disco en claro.
 */
export function esPipeSeguro(linea: string): boolean {
    if (!/\bpg_dump\b/.test(linea)) return true; // sin dump no hay nada que cifrar
    // pg_dump nunca debe escribir a fichero por sí mismo (-f / --file = dump en claro).
    if (/pg_dump[^|]*\s(?:-f|--file)[=\s]/.test(linea)) return false;
    const resto = linea.slice(linea.indexOf("pg_dump"));
    const idxAge = resto.search(/\|\s*age\s+-r\b/); // debe ir a `age -r`
    const idxRedir = resto.search(/>/); // primer redirect a fichero
    if (idxAge === -1) return false; // no se cifra
    if (idxRedir !== -1 && idxRedir < idxAge) return false; // redirige a disco ANTES de cifrar
    if (/\btee\b/.test(resto.slice(0, idxAge))) return false; // sink en claro entre dump y age
    return true;
}

/**
 * Líneas de COMANDO: ni comentario (`#`) ni emisoras de texto (log/echo/printf) — un `pg_dump` que se
 * EJECUTA nunca vive dentro de un `log "…"`, así que una mención de "pg_dump|age" en un mensaje no cuenta.
 */
function lineasDeComando(src: string): string[] {
    return src
        .split("\n")
        .filter((l) => !l.trim().startsWith("#"))
        .filter((l) => !/^\s*(?:log|echo|printf)\b/.test(l));
}

/** Corre una función PURA del script por `source` (sin ejecutar main/flock). */
function source(call: string, stdin = ""): string {
    return execFileSync("bash", ["-c", `source "${SCRIPT}"; ${call}`], { encoding: "utf8", input: stdin }).trim();
}

describe("SPEC-978 · candado · respaldo cifrado de las bases", () => {
    it("el script parsea (bash -n)", () => {
        execFileSync("bash", ["-n", SCRIPT]);
    });

    // ---- 1. El dump jamás toca el disco en claro (análisis estático del pipe) --------------------
    it("TODA línea real con pg_dump cifra en el mismo pipe (nunca escribe el dump en claro)", () => {
        const conDump = lineasDeComando(SRC).filter((l) => /\bpg_dump\b/.test(l));
        expect(conDump.length).toBeGreaterThan(0); // no vacuo: hay al menos un volcado
        for (const l of conDump) expect(esPipeSeguro(l)).toBe(true);
        // y existe el pipe cifrado de verdad hacia un artefacto .age
        expect(/pg_dump[^\n]*\|\s*age\s+-r[^\n]*>/.test(SRC)).toBe(true);
        expect(SRC).toContain(".dump.age");
    });

    it("MUTACIÓN: el checker detecta un dump en claro (>, -f o tee) — control negativo", () => {
        const seguro = "docker exec \"$c\" pg_dump -U u -Fc db | age -r \"$K\" >\"$tmp\"";
        expect(esPipeSeguro(seguro)).toBe(true); // control positivo
        // Mutaciones que DEBEN encenderse:
        expect(esPipeSeguro("docker exec \"$c\" pg_dump -U u -Fc db >\"$tmp\"")).toBe(false); // sin cifrar
        expect(esPipeSeguro("pg_dump -U u -Fc db -f /tmp/claro.dump && age -r \"$K\" ...")).toBe(false); // -f a disco
        expect(esPipeSeguro("pg_dump -U u --file=/tmp/x -Fc db | age -r \"$K\" >\"$tmp\"")).toBe(false); // --file
        expect(esPipeSeguro("pg_dump -Fc db | tee /tmp/claro | age -r \"$K\" >\"$tmp\"")).toBe(false); // tee en claro
        expect(esPipeSeguro("pg_dump -Fc db >\"$tmp\" | age -r \"$K\"")).toBe(false); // redirect antes de age
    });

    // ---- 2. Aborta ante flag desconocido / sin destinatario (fail-closed) ------------------------
    it("flag no reconocido → ABORTA (exit 2) sin tocar nada", () => {
        let code = 0;
        try {
            execFileSync("bash", [SCRIPT, "--borra-todo"], { encoding: "utf8", stdio: "pipe" });
        } catch (e: unknown) {
            code = (e as { status?: number }).status ?? -1;
        }
        expect(code).toBe(2);
    });

    it("sin destinatario age → FALLA CERRADO (exit != 0) y no escribe ningún respaldo", () => {
        const base = mkdtempSync(path.join(tmpdir(), "resp-978-"));
        const dir = path.join(base, "back");
        try {
            let code = 0;
            try {
                execFileSync("bash", [SCRIPT], {
                    encoding: "utf8",
                    stdio: "pipe",
                    env: {
                        ...process.env,
                        RESPALDO_AGE_PUBKEY: "",
                        RESPALDO_AGE_PUBKEY_FILE: path.join(base, "no-existe.pub"),
                        RESPALDO_DIR: dir,
                        RESPALDO_LOG: path.join(base, "log"),
                        RESPALDO_LOCK: path.join(base, "lock"),
                    },
                });
            } catch (e: unknown) {
                code = (e as { status?: number }).status ?? -1;
            }
            expect(code).not.toBe(0); // abortó
            let escritos: string[] = [];
            try {
                escritos = readdirSync(dir);
            } catch {
                escritos = []; // ni siquiera creó el directorio: perfecto
            }
            expect(escritos).toEqual([]); // nada en claro ni cifrado
        } finally {
            rmSync(base, { recursive: true, force: true, maxRetries: 3 });
        }
    });

    // ---- 3. Funciones puras (por source) --------------------------------------------------------
    it("ruta_respaldo arma <dir>/<label>/<proyecto>-<stamp>.dump.age (prefijo = nombre corto pi/bi)", () => {
        expect(source("ruta_respaldo /var/backups/idc pi pi 20261121-0300")).toBe(
            "/var/backups/idc/pi/pi-20261121-0300.dump.age",
        );
        expect(source("ruta_respaldo /var/backups/idc bi bi 20261121-0300")).toBe(
            "/var/backups/idc/bi/bi-20261121-0300.dump.age",
        );
    });

    it("retención: borra SOLO lo anterior al corte; conserva el corte y lo más nuevo; ignora lo sin fecha", () => {
        const nombres = [
            "pi-20261101-0300.dump.age", // viejo → borrar
            "pi-20261101-0300.dump.age.sha256", // viejo → borrar
            "pi-20261107-0300.dump.age", // == corte → conservar
            "pi-20261120-0300.dump.age", // nuevo → conservar
            "README.txt", // sin fecha → jamás se borra
        ].join("\n");
        const out = source("seleccionar_respaldos_a_borrar 20261107", nombres).split("\n").filter(Boolean);
        expect(out).toEqual(["pi-20261101-0300.dump.age", "pi-20261101-0300.dump.age.sha256"]);
    });

    it("fecha_de_nombre extrae el AAAAMMDD embebido (vacío si no casa)", () => {
        expect(source("fecha_de_nombre pi-20261121-0300.dump.age")).toBe("20261121");
        expect(source("fecha_de_nombre README.txt")).toBe("");
    });

    // ---- 4. Contrato del CEO anclado (una mutación del contrato enrojece) ------------------------
    it("ancla el contrato: pipefail, destino, 640 root:respaldo, sha256, flock, retención 14d, dry-run", () => {
        expect(SRC).toMatch(/set -uo pipefail/); // pg_dump que falla tumba el pipe
        expect(SRC).toContain("/var/backups/idc"); // destino
        expect(SRC).toContain("/var/lock/respaldo-bd.lock"); // flock
        expect(SRC).toMatch(/flock -n 9/);
        expect(SRC).toMatch(/chmod 640/);
        expect(SRC).toMatch(/chown "root:\$RESPALDO_GRUPO"/);
        expect(SRC).toMatch(/RESPALDO_GRUPO:-respaldo/);
        expect(SRC).toMatch(/RESPALDO_RETENCION_DIAS:-14/);
        expect(SRC).toContain(".sha256");
        expect(SRC).toMatch(/--dry-run/);
    });

    it("el prefijo del fichero es el nombre CORTO (pi/bi), no el de la base: el Mac/interino filtran por pi-*/bi-*", () => {
        // respaldar_una_base <label> <contenedor> <usuario> <base> <PROYECTO=prefijo>. La base (4º arg)
        // sigue siendo la BD a volcar; el 5º (prefijo) debe ser el nombre corto "pi"/"bi". Una regresión
        // a `… "$PI_DB_NAME" "$PI_DB_NAME"` (prefijo = nombre de base) rompería el filtro pi-*/bi-* → red.
        expect(SRC).toMatch(/respaldar_una_base "pi" [^\n]*"\$PI_DB_NAME" "pi";/);
        expect(SRC).toMatch(/respaldar_una_base "bi" [^\n]*"\$bi_db" "bi";/);
    });
});
