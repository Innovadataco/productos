// scripts/exportar-banrep.ts como proceso, SIN RED: cada caso usa --archivo (un XML ficticio que la prueba escribe en una
// carpeta temporal) o termina antes de pedir a BanRep (uso, terminal). El entorno del hijo es mínimo. stdout y stderr se
// miran por separado: el CSV va a stdout y nada más; por stderr nunca valores ni rutas. Fechas de 2021 (el hijo usa el
// hoy real) y cifras inventadas.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { TOPES_XML } from "@/lib/xml-acotado";
import { POR_CLI_MS, RAIZ, entornoMinimo } from "../../ayudas/cli";
import { CAPTCHA_FICTICIO, MENSAJE_TPM, SERIE_TPM, bytesDe, type ObsFicticia } from "./banrep.ficticio";

const TSX = join(RAIZ, "node_modules", ".bin", "tsx");
const SCRIPT = join("scripts", "exportar-banrep.ts");
const USO = "Uso: npx tsx scripts/exportar-banrep.ts --serie <TPM|IBR_3M_EA>";
const FUENTE = "banrep:DF_CBR_DAILY_HIST.IRCBRM01.PA";
const NUNCA_EN_STDERR = ["7.31", "7.29", "13.47", "carpeta-ficticia", "FICTMARCA"];
const carpeta = mkdtempSync(join(tmpdir(), "inv008-carpeta-ficticia-banrep-"));
afterAll(() => rmSync(carpeta, { recursive: true, force: true }));

const OBS_2021: readonly ObsFicticia[] = [
  { dia: "20210308", valor: "7.31" },
  { dia: "20210309", valor: "7.29" },
  { dia: "20210310", valor: "13.47" },
];
const xmlTpm = (obs: readonly ObsFicticia[] = OBS_2021) => bytesDe({ ...MENSAJE_TPM, series: [{ ...SERIE_TPM, obs }] });
const archivo = (nombre: string, contenido: string | Uint8Array) => {
  const ruta = join(carpeta, nombre);
  writeFileSync(ruta, contenido);
  return ruta;
};

interface Salida { readonly codigo: number | null; readonly stdout: string; readonly stderr: string }
function correr(args: readonly string[], extra: Record<string, string> = {}): Salida {
  const r = spawnSync(TSX, [SCRIPT, ...args], { cwd: RAIZ, env: entornoMinimo(extra), encoding: "utf8", timeout: POR_CLI_MS });
  return { codigo: r.status, stdout: r.stdout, stderr: r.stderr };
}
function comprobar(s: Salida, codigo: number, esperado: string): void {
  expect(s.codigo, `${s.stdout}${s.stderr}`).toBe(codigo);
  expect(s.stderr).toContain(esperado);
  for (const dato of NUNCA_EN_STDERR) expect(s.stderr, dato).not.toContain(dato);
}
const conArchivo = (ruta: string, ...mas: string[]) => ["--serie", "TPM", "--desde", "2021-03-01", "--hasta", "2021-03-10", "--archivo", ruta, ...mas];

describe("exportar-banrep · como proceso, sin red", { timeout: 12 * POR_CLI_MS }, () => {
  it("argumentos inválidos (ninguno, --ayuda, serie ajena, rango al revés): 2 con su uso y nada en stdout", () => {
    for (const args of [[], ["--ayuda"], ["--serie", "TRM", "--desde", "2021-03-01"], ["--serie", "TPM", "--desde", "2021-03-10", "--hasta", "2021-03-09"]]) {
      const s = correr(args);
      comprobar(s, 2, USO);
      expect(s.stdout).toBe("");
    }
  });

  it("npm se quedó con --archivo: 2, sin pedir a BanRep", () => {
    const s = correr(["--serie", "TPM", "--desde", "2021-03-01"], { npm_config_archivo: join(carpeta, "x.xml") });
    comprobar(s, 2, "npm se quedó con --archivo");
    expect(s.stdout).toBe("");
  });

  // Una terminal de verdad con script(1): BSD en macOS, util-linux en Linux (CI). Su entrada es /dev/null.
  it("con stdout en una terminal se niega con SALIDA_TERMINAL y 2, sin leer el archivo ni pedir a BanRep", () => {
    const comando = [TSX, SCRIPT, ...conArchivo(join(carpeta, "no-existe.xml"))];
    const args = process.platform === "darwin" ? ["-q", "/dev/null", ...comando] : ["-qec", comando.map((a) => `'${a}'`).join(" "), "/dev/null"];
    const r = spawnSync("script", args, { cwd: RAIZ, env: entornoMinimo({}), encoding: "utf8", timeout: POR_CLI_MS, stdio: ["ignore", "pipe", "pipe"] });
    const texto = `${r.stdout}${r.stderr}`;
    expect(r.status, texto).toBe(2);
    expect(texto).toContain("SALIDA_TERMINAL");
    expect(texto).not.toContain("ARCHIVO_ILEGIBLE");
  });

  it("--archivo inexistente o que no es regular: 2 con su código, sin la ruta y nada en stdout", () => {
    const s = correr(conArchivo(join(carpeta, "no-existe.xml")));
    comprobar(s, 2, "ARCHIVO_ILEGIBLE");
    expect(s.stdout).toBe("");
    comprobar(correr(conArchivo(carpeta)), 2, "ARCHIVO_NO_REGULAR");
  });

  it(`--archivo de más de ${TOPES_XML.bytes} bytes: 1 ARCHIVO_DEMASIADO_GRANDE, nada en stdout`, () => {
    const s = correr(conArchivo(archivo("grande.ficticio.xml", new Uint8Array(TOPES_XML.bytes + 1).fill(0x20))));
    comprobar(s, 1, "ARCHIVO_DEMASIADO_GRANDE");
    expect(s.stdout).toBe("");
  });

  it("un XML válido: 0 y en stdout exactamente el CSV canónico", () => {
    const s = correr(conArchivo(archivo("tpm.ficticio.xml", xmlTpm())));
    comprobar(s, 0, "✅ TPM · archivo");
    expect(s.stdout).toBe([
      "serie,desde,hasta,valor,fuente",
      `TPM,2021-03-08,2021-03-08,7.31,${FUENTE}`,
      `TPM,2021-03-09,2021-03-09,7.29,${FUENTE}`,
      `TPM,2021-03-10,2021-03-10,13.47,${FUENTE}`,
      "",
    ].join("\n"));
  });

  it("con un día no definitivo: 3 y el CSV sin ese día", () => {
    const obs: ObsFicticia[] = [OBS_2021[0]!, { ...OBS_2021[1]!, estado: "P" }, OBS_2021[2]!];
    const s = correr(conArchivo(archivo("tpm-p.ficticio.xml", xmlTpm(obs))));
    comprobar(s, 3, "no definitivas (OBS_STATUS distinto de A): 1");
    expect(s.stdout).not.toContain("2021-03-09");
    expect(s.stdout.split("\n")).toHaveLength(4);
  });

  it("el --archivo es la página del captcha: 1 BANREP_BLOQUEADO y nada en stdout", () => {
    const s = correr(conArchivo(archivo("captcha.ficticio.html", CAPTCHA_FICTICIO)));
    comprobar(s, 1, "BANREP_BLOQUEADO (HTML)");
    expect(s.stdout).toBe("");
  });

  it("el --archivo de la otra serie: 1 BANREP_OTRO_DATAFLOW", () => {
    const s = correr(["--serie", "IBR_3M_EA", "--desde", "2021-03-01", "--hasta", "2021-03-10", "--archivo", archivo("tpm-otra.ficticio.xml", xmlTpm())]);
    comprobar(s, 1, "BANREP_OTRO_DATAFLOW");
    expect(s.stdout).toBe("");
  });
});
