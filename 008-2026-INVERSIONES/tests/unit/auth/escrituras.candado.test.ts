// Candado de escrituras (frente familia-lectura): la familia entra en SOLO LECTURA, y eso se cumple en el servidor.
// Recorre TODO src/app (también lo que agreguen otros frentes) y exige:
//  1. Cada route.ts declara sus métodos solo con `export [async] function <MÉTODO>(` (otra forma esquivaría el candado).
//  2. Cada route.ts que escribe (POST, PUT, PATCH, DELETE) llama al guardián del dueño `exigirDuenoApi(`, salvo una
//     lista CERRADA y justificada: las del ingreso y la cuenta propia (escriben solo la autenticación de quien llama) y
//     las de cálculo sin guardar (que además no pueden alcanzar ningún módulo que escriba en la base).
//  3. Ninguna entrada (página, layout, route…) que no llame al guardián alcanza un módulo que escriba en la base, salvo
//     las de la lista de arriba, cuyas escrituras solo pueden estar en src/auth/ (o en su propio archivo).
//  4. Server Actions: siguen prohibidas (tests/unit/auth/candados.test.ts); si alguna aparece, llama `exigirDueno(`.
//  5. La administración de accesos (alta y revocación de familiares, reinicio del TOTP, el acceso inicial) no es
//     alcanzable desde src/app: es solo de los comandos que corre Jelk.
//  6. En las rutas de la cuenta propia, el usuario sale de la sesión, nunca del cuerpo (IDOR).
// Cada regla tiene su control positivo con fuentes inventadas: si el clasificador deja de morder, esto se pone rojo.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  alcanzables,
  delegadosDelEsquema,
  detectorDeEscritura,
  escribe,
  esServerAction,
  exportacionesIrregulares,
  identificadoresUsados,
  importaDinamico,
  llamaGuardianApi,
  llamaGuardianPagina,
  metodosDeclarados,
  type Arbol,
} from "../../ayudas/superficie-escritura";

const RAIZ = fileURLToPath(new URL("../../../", import.meta.url));
const SRC = join(RAIZ, "src");
const APP = join(SRC, "app");
const leer = (ruta: string): string => readFileSync(ruta, "utf8");
const rel = (ruta: string): string => relative(RAIZ, ruta);
const ARBOL: Arbol = { src: SRC, existe: existsSync, leer };

function archivos(carpeta: string, filtro: (ruta: string) => boolean): string[] {
  if (!existsSync(carpeta)) return [];
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta, filtro) : filtro(ruta) ? [ruta] : [];
  });
}

const escribeEnBase = detectorDeEscritura(delegadosDelEsquema(leer(join(RAIZ, "prisma", "schema.prisma"))));
const FUENTES = archivos(SRC, (r) => /\.tsx?$/.test(r));
const ESCRITORES = new Set(FUENTES.filter((r) => escribeEnBase(leer(r))));
const RUTAS = archivos(APP, (r) => /\/route\.ts$/.test(r));
const ENTRADAS = archivos(APP, (r) => /\/(page|layout|template|default|not-found|error|loading|route)\.tsx?$/.test(r));

/** Escriben solo la autenticación de quien llama (su clave, su TOTP, sus códigos, su versión de sesión o sus intentos). */
const ESCRITURA_PROPIA: ReadonlyMap<string, string> = new Map([
  ["src/app/api/sesion/ingresar/route.ts", "primer paso: registra el intento y la pre-sesión de esa cuenta"],
  ["src/app/api/sesion/definir-clave/route.ts", "fija la clave con el enlace de un solo uso de esa cuenta"],
  ["src/app/api/sesion/totp/route.ts", "segundo paso: el último paso del TOTP o un código de recuperación de esa cuenta"],
  ["src/app/api/sesion/totp/enrolar/route.ts", "activa el TOTP propio en su ventana de 30 minutos"],
  ["src/app/api/sesion/totp/codigos/route.ts", "regenera los códigos de recuperación PROPIOS (exige un TOTP vigente)"],
  ["src/app/api/sesion/salir/route.ts", "cierra las sesiones propias (sube su sesionVersion)"],
]);
/** Calculan y responden sin guardar: además, no pueden alcanzar ningún módulo que escriba (regla 3). */
const CALCULO_SIN_GUARDAR: ReadonlyMap<string, string> = new Map([
  ["src/app/api/proyecciones/route.ts", "el simulador de Proyecciones: lo que se mueve no se guarda"],
]);
/** Las páginas del segundo paso: solo leen, pero alcanzan los módulos del TOTP (que escriben en otras funciones). */
const PAGINAS_DE_AUTENTICACION = new Set(["src/app/totp/page.tsx", "src/app/totp/enrolar/page.tsx"]);
/**
 * Constantes que las pantallas de lectura traen de un módulo que escribe (o que lo re-exporta): importarlas no ejecuta
 * ninguna escritura. Cada una es un literal en su módulo o una re-exportación de otra de esta lista (se verifica abajo).
 */
const GUARDAR_PRECIOS = join(SRC, "precios", "guardar.ts");
const ACTUALIZAR_PRECIOS = join(SRC, "precios", "actualizar.ts");
const CONSTANTES_DE_ESCRITORES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  [GUARDAR_PRECIOS, new Set(["FUENTE", "TOLERANCIA_VERIFICACION"])],
  [ACTUALIZAR_PRECIOS, new Set(["FUENTE"])],
]);
/** La administración de accesos: solo la corren los comandos de Jelk (scripts/), nunca la app. */
const ADMINISTRACION = ["src/auth/familia.ts", "src/auth/familia-cli.ts", "src/auth/acceso-cli.ts", "src/auth/reinicio-totp.ts", "src/auth/conexion-dueno.ts"];
const LLAMADAS_DE_ADMINISTRACION = /\b(?:emitirAcceso|emitirAccesoFamiliar|revocarFamiliar|reiniciarTotp|reiniciarTotpFamiliar)\s*\(/;

/** El módulo relativo del que `fuente` re-exporta `nombre` (`export { …, nombre, … } from "./x"`), o null. */
function reexportadaDesde(fuente: string, nombre: string): string | null {
  for (const m of fuente.matchAll(/^export\s*\{([^}]*)\}\s*from\s*["'](\.[^"']+)["']/gm)) {
    if ((m[1] ?? "").split(",").map((s) => s.trim()).includes(nombre)) return m[2] ?? null;
  }
  return null;
}

const fueraDeAuth = (escritores: readonly string[], propio: string): string[] =>
  escritores.filter((m) => !rel(m).startsWith("src/auth/") && m !== propio);

describe("candado de escrituras · el árbol real", () => {
  it("el esquema y el árbol se leen (control positivo del recorrido)", () => {
    expect(RUTAS.length).toBeGreaterThanOrEqual(8);
    expect(ENTRADAS.length).toBeGreaterThan(RUTAS.length);
    expect(ESCRITORES.size).toBeGreaterThan(10);
    expect([...ESCRITORES].map(rel)).toContain("src/plan/versiones.ts");
  });

  it("el guardián existe en src/auth/sesion.ts: exigirDueno() para páginas y exigirDuenoApi(pedido) para API", () => {
    const sesion = leer(join(SRC, "auth", "sesion.ts"));
    expect(sesion).toMatch(/export async function exigirDueno\(\)/);
    expect(sesion).toMatch(/export async function exigirDuenoApi\(/);
  });

  it("cada route.ts declara sus métodos solo con `export [async] function <MÉTODO>(`", () => {
    for (const ruta of RUTAS) {
      expect(exportacionesIrregulares(leer(ruta)), rel(ruta)).toEqual([]);
      expect(metodosDeclarados(leer(ruta)).length, rel(ruta)).toBeGreaterThan(0);
    }
  });

  it("cada route.ts que escribe llama exigirDuenoApi(, salvo la lista cerrada de la cuenta propia y del cálculo", () => {
    for (const ruta of RUTAS) {
      const fuente = leer(ruta);
      if (!escribe(metodosDeclarados(fuente))) continue;
      if (ESCRITURA_PROPIA.has(rel(ruta)) || CALCULO_SIN_GUARDAR.has(rel(ruta))) continue;
      expect(llamaGuardianApi(fuente), `${rel(ruta)} escribe y no llama exigirDuenoApi(`).toBe(true);
    }
  });

  it("las listas cerradas coinciden con archivos que existen y que escriben (sin entradas viejas)", () => {
    for (const ruta of [...ESCRITURA_PROPIA.keys(), ...CALCULO_SIN_GUARDAR.keys()]) {
      expect(existsSync(join(RAIZ, ruta)), ruta).toBe(true);
      expect(escribe(metodosDeclarados(leer(join(RAIZ, ruta)))), ruta).toBe(true);
    }
    for (const ruta of PAGINAS_DE_AUTENTICACION) expect(existsSync(join(RAIZ, ruta)), ruta).toBe(true);
    // Solo literales (un texto, un número o un Decimal de texto): nada que se ejecute al importarlas.
    const literal = `(?:"[^"]*"|\\d[\\d_.]*|new Prisma\\.Decimal\\("[\\d.]+"\\))`;
    for (const [modulo, nombres] of CONSTANTES_DE_ESCRITORES) {
      for (const nombre of nombres) {
        const fuente = leer(modulo);
        if (new RegExp(`^export const ${nombre} = ${literal};$`, "m").test(fuente)) continue;
        const origen = reexportadaDesde(fuente, nombre);
        expect(origen, `${rel(modulo)}: ${nombre} no es un literal ni una re-exportación`).not.toBeNull();
        expect(CONSTANTES_DE_ESCRITORES.get(join(dirname(modulo), `${origen ?? ""}.ts`))?.has(nombre), `${rel(modulo)}: ${nombre}`).toBe(true);
      }
    }
  });

  it("ninguna entrada sin guardián alcanza un módulo que escribe; la cuenta propia y el segundo paso, solo src/auth", () => {
    for (const entrada of ENTRADAS) {
      const fuente = leer(entrada);
      if (llamaGuardianApi(fuente) || llamaGuardianPagina(fuente)) continue;
      const alcanzados = [...alcanzables(ARBOL, entrada, CONSTANTES_DE_ESCRITORES)].filter((m) => ESCRITORES.has(m));
      if (ESCRITURA_PROPIA.has(rel(entrada)) || PAGINAS_DE_AUTENTICACION.has(rel(entrada))) {
        expect(fueraDeAuth(alcanzados, entrada).map(rel), rel(entrada)).toEqual([]);
        continue;
      }
      expect(alcanzados.map(rel), `${rel(entrada)} alcanza módulos que escriben y no llama al guardián`).toEqual([]);
    }
  });

  it("src/app no importa módulos de forma dinámica (el grafo no los vería)", () => {
    for (const ruta of FUENTES.filter((r) => r.startsWith(APP))) expect(importaDinamico(leer(ruta)), rel(ruta)).toBe(false);
  });

  it("toda Server Action (si alguna llega a existir) llama exigirDueno(", () => {
    for (const ruta of FUENTES.filter((r) => esServerAction(leer(r)))) expect(leer(ruta), rel(ruta)).toMatch(/\bexigirDueno\(/);
  });

  it("la administración de accesos no es alcanzable desde src/app ni se llama allí", () => {
    for (const ruta of FUENTES.filter((r) => r.startsWith(APP))) {
      const alcanzados = [...alcanzables(ARBOL, ruta)].map(rel);
      for (const prohibido of ADMINISTRACION) expect(alcanzados, `${rel(ruta)} alcanza ${prohibido}`).not.toContain(prohibido);
      expect(LLAMADAS_DE_ADMINISTRACION.test(leer(ruta)), rel(ruta)).toBe(false);
    }
  });

  it("en las rutas de la cuenta propia con sesión, el usuario sale de la sesión, nunca del cuerpo (IDOR)", () => {
    for (const ruta of ESCRITURA_PROPIA.keys()) {
      const fuente = leer(join(RAIZ, ruta));
      if (!/\b(?:exigirSesionApi|validarSesionApi)\(/.test(fuente)) continue;
      for (const id of identificadoresUsados(fuente)) expect(["usuario.id", "sesion.usuario.id"], `${ruta}: ${id}`).toContain(id);
    }
  });
});

describe("candado de escrituras · controles positivos (fuentes inventadas)", () => {
  const ruta = (cuerpo: string) => `import { db } from "@/lib/db";\n${cuerpo}\n`;

  it("detecta los métodos de escritura y si falta el guardián", () => {
    const sin = ruta("export async function POST(pedido: Request) { return new Response(null); }");
    expect(escribe(metodosDeclarados(sin))).toBe(true);
    expect(llamaGuardianApi(sin)).toBe(false);
    const con = ruta("export async function DELETE(p: Request) { const s = await exigirDuenoApi(p); return new Response(null); }");
    expect(llamaGuardianApi(con)).toBe(true);
    expect(escribe(metodosDeclarados(ruta("export function GET() { return new Response(null); }")))).toBe(false);
    expect(metodosDeclarados(ruta("export function PATCH() {}"))).toEqual(["PATCH"]);
  });

  it.each([
    ["export const POST = async () => new Response(null);", "método como variable"],
    ["const h = async () => new Response(null);\nexport { h as PUT };", "método re-exportado"],
    ["export * from \"./otro\";", "export *"],
    ["export default async function manejar() {}", "export default"],
  ])("una exportación irregular da rojo: %s", (fuente, esperado) => {
    expect(exportacionesIrregulares(fuente)).toContain(esperado);
  });

  it("detecta escrituras de Prisma y SQL, y no confunde un Set ni la transacción de solo lectura", () => {
    const detecta = detectorDeEscritura(["planVersion", "usuario"]);
    expect(detecta("await tx.planVersion.create({ data })")).toBe(true);
    expect(detecta("await db.usuario.updateMany({ where, data })")).toBe(true);
    expect(detecta("await tx . usuario . delete ({ where })")).toBe(true);
    expect(detecta("await db.$executeRaw`UPDATE usuario SET activo = false`")).toBe(true);
    expect(detecta("await db.$queryRaw`INSERT INTO x VALUES (1)`")).toBe(true);
    expect(detecta("await db.$executeRawUnsafe('DELETE FROM x')")).toBe(true);
    expect(detecta("await tx.$executeRaw`SET TRANSACTION READ ONLY`")).toBe(false);
    expect(detecta("estado.enVuelo.delete(id); db.usuario.findMany({})")).toBe(false);
    expect(() => detectorDeEscritura([])).toThrow();
    expect(delegadosDelEsquema("model TokenAcceso {\n}\nmodel Usuario {\n}")).toEqual(["tokenAcceso", "usuario"]);
  });

  it("el grafo baja por las importaciones, salvo las de tipos y las de constantes revisadas", () => {
    const src = "/v/src";
    const archivosVirtuales: Record<string, string> = {
      "/v/src/app/page.tsx": 'import { leer } from "@/a";\nimport type { T } from "@/escribe";\nimport { FUENTE } from "@/escribe2";\n',
      "/v/src/a.ts": 'import { guardar } from "./escribe";\n',
      "/v/src/escribe.ts": "export const guardar = () => tx.plan.create({});\n",
      "/v/src/escribe2.ts": 'export const FUENTE = "x";\nexport const borrar = () => tx.plan.delete({});\n',
    };
    const arbol: Arbol = { src, existe: (r) => r in archivosVirtuales, leer: (r) => archivosVirtuales[r] ?? "" };
    const constantes = new Map([["/v/src/escribe2.ts", new Set(["FUENTE"])]]);
    const alcanzados = alcanzables(arbol, "/v/src/app/page.tsx", constantes);
    expect(alcanzados.has("/v/src/escribe.ts")).toBe(true);
    expect(alcanzados.has("/v/src/escribe2.ts")).toBe(false);
    expect(alcanzables(arbol, "/v/src/app/page.tsx").has("/v/src/escribe2.ts")).toBe(true);
  });

  it("detecta Server Actions, importaciones dinámicas, el guardián de página y los identificadores (IDOR)", () => {
    expect(esServerAction('"use server";\nexport async function guardar() {}')).toBe(true);
    expect(esServerAction("const a = 1;")).toBe(false);
    expect(importaDinamico('const m = await import("@/plan/versiones");')).toBe(true);
    expect(importaDinamico('const m = require("x");')).toBe(true);
    expect(llamaGuardianPagina("const u = await exigirDueno();")).toBe(true);
    expect(llamaGuardianPagina("const u = await exigirSesion();")).toBe(false);
    expect(identificadoresUsados("f({ usuarioId: cuerpo.usuarioId }); db.usuario.update({ where: { id: sesion.usuario.id } })")).toEqual([
      "cuerpo.usuarioId",
      "sesion.usuario.id",
    ]);
  });
});
