// Candados del área de edición (fase B, PR-B), sobre el árbol real de src/app/edicion:
//  1. Cada página llama `await exigirDueno()` antes de leer (la familia recibe 404; tampoco ve los formularios).
//  2. Los componentes de cliente ("use client") solo importan React, tipos y los módulos puros del área (textos y envío):
//     nunca la base, el dominio que escribe, la sesión ni módulos de servidor.
//  3. Sin Server Actions ni HTML crudo; las lecturas nunca seleccionan el crudo, el encargo ni secretos de la cuenta.
//  4. Las tres rutas de escritura existen y están bajo el candado de escrituras (tests/unit/auth/escrituras.candado.test.ts).
// Cada regla tiene su control positivo con fuentes inventadas.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = new URL("../../../", import.meta.url).pathname;
const EDICION = join(RAIZ, "src", "app", "edicion");
const leer = (r: string) => readFileSync(r, "utf8");
const rel = (r: string) => relative(RAIZ, r);

function archivos(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    return statSync(ruta).isDirectory() ? archivos(ruta) : /\.(ts|tsx)$/.test(n) ? [ruta] : [];
  });
}

/** Lo único que un componente de cliente del área puede importar (en valor): un hermano, salvo las lecturas y la página. */
const PERMITIDOS_CLIENTE = /^(react|\.\/(?!datos$|page$)[\w-]+|\.\.\/(textos|enviar|tipos|campos)|@\/app\/edicion\/(textos|enviar|tipos|campos))$/;

const esCliente = (t: string) => /^\s*["']use client["']/m.test(t);
/** Lo que el módulo trae en valor: `import … from`, `import "…"` y `export … from` (una re-exportación también trae). */
const importacionesDeValor = (t: string): string[] =>
  [
    ...t.matchAll(/^import\s+(?!type\b)[^"';]*?from\s+["']([^"']+)["']/gm),
    ...t.matchAll(/^import\s+["']([^"']+)["']/gm),
    ...t.matchAll(/^export\s+(?!type\b)[^"';]*?from\s+["']([^"']+)["']/gm),
  ].map((m) => m[1]!);

export function violacionesDeCliente(t: string): string[] {
  if (!esCliente(t)) return [];
  return importacionesDeValor(t).filter((m) => !PERMITIDOS_CLIENTE.test(m) && !m.endsWith(".css"));
}

const violacionesComunes = (t: string): string[] => [
  ...(/["']use server["']/.test(t) ? ["use server"] : []),
  ...(/dangerouslySetInnerHTML/.test(t) ? ["dangerouslySetInnerHTML"] : []),
  ...["crudo", "encargo", "claveHash", "totpSecreto"].filter((c) => new RegExp(`\\b${c}\\s*:`).test(t)),
];

const PAGINAS = [join(EDICION, "page.tsx"), ...["plan", "decision", "enlace", "tarifas"].map((p) => join(EDICION, p, "page.tsx"))];
const RUTAS = ["src/app/api/plan/versiones/route.ts", "src/app/api/decisiones/route.ts", "src/app/api/decisiones/enlaces/route.ts", "src/app/api/operar/tarifas/route.ts"];

describe("candados del área de edición · controles positivos", () => {
  it("el de cliente muerde: la base, el dominio o la sesión no entran; React, tipos y los módulos puros sí", () => {
    const fuente = (imports: string) => `"use client";\n${imports}\nexport function F() { return null; }\n`;
    expect(violacionesDeCliente(fuente('import { db } from "@/lib/db";'))).toEqual(["@/lib/db"]);
    expect(violacionesDeCliente(fuente('import { crearVersionPlan } from "@/plan/versiones";'))).toEqual(["@/plan/versiones"]);
    expect(violacionesDeCliente(fuente('import { exigirDueno } from "@/auth/sesion";'))).toEqual(["@/auth/sesion"]);
    expect(violacionesDeCliente(fuente('import { useState } from "react";\nimport type { X } from "@/plan/versiones";\nimport { MENSAJES } from "../textos";\nimport { Campo } from "./Campo";'))).toEqual([]);
    expect(violacionesDeCliente('import { db } from "@/lib/db";')).toEqual([]);
    expect(violacionesDeCliente(fuente('export { guardar } from "@/plan/versiones";'))).toEqual(["@/plan/versiones"]);
    // Un hermano de servidor (las lecturas de la página) tampoco, aunque sea relativo.
    expect(violacionesDeCliente(fuente('import { datosEdicionPlan } from "./datos";\nimport { PaginaEdicionPlan } from "./page";\nimport { leerEspecies } from "../lecturas";'))).toEqual(["./datos", "./page", "../lecturas"]);
  });

  it("el común muerde", () => {
    expect(violacionesComunes('"use server";')).toEqual(["use server"]);
    expect(violacionesComunes("<div dangerouslySetInnerHTML={{ __html: x }} />")).toEqual(["dangerouslySetInnerHTML"]);
    expect(violacionesComunes("select: { crudo: true }")).toEqual(["crudo"]);
  });
});

describe("candados del área de edición · el árbol real", () => {
  it("existen las tres páginas, sus formularios de cliente y las tres rutas", () => {
    for (const p of PAGINAS) expect(existsSync(p), rel(p)).toBe(true);
    expect(archivos(EDICION).filter((r) => esCliente(leer(r))).length).toBeGreaterThanOrEqual(3);
    for (const r of RUTAS) expect(existsSync(join(RAIZ, r)), r).toBe(true);
  });

  it("cada página exige al dueño antes de leer nada (la que lee, lee después del guardián; el índice no lee)", () => {
    for (const p of archivos(EDICION).filter((r) => r.endsWith("page.tsx"))) {
      const fuente = leer(p);
      const guardian = fuente.indexOf("await exigirDueno();");
      expect(guardian, rel(p)).toBeGreaterThanOrEqual(0);
      expect(fuente.slice(0, guardian), rel(p)).not.toMatch(/\bdatos\w*\(/);
      if (p !== join(EDICION, "page.tsx")) expect(fuente.slice(guardian), rel(p)).toMatch(/\bdatos\w*\(/);
      expect(fuente, rel(p)).not.toMatch(/exigirSesion\(/);
    }
  });

  it("el índice /edicion no lee nada más que la sesión: no importa la base ni las lecturas (revisión code-reviewer, BAJO)", () => {
    const fuente = leer(join(EDICION, "page.tsx"));
    expect(importacionesDeValor(fuente).filter((m) => /^@\/lib\/db$|lecturas|\/datos$|@prisma\/client/.test(m))).toEqual([]);
    expect(fuente).not.toMatch(/\bdb\./);
  });

  it("los componentes de cliente solo importan React, tipos y los módulos puros del área", () => {
    for (const r of archivos(EDICION)) expect(violacionesDeCliente(leer(r)), rel(r)).toEqual([]);
  });

  it("los módulos puros que el cliente importa no traen nada de servidor", () => {
    for (const nombre of ["textos.ts", "enviar.ts", "tipos.ts", "campos.ts"]) {
      const ruta = join(EDICION, nombre);
      if (!existsSync(ruta)) continue;
      const t = leer(ruta);
      // Los tipos de Prisma (`import type`) no traen nada al cliente; lo que se importa en valor lo mira la regla de abajo.
      expect(t, nombre).not.toMatch(/["']server-only["']|@\/lib\/db|@\/auth\/sesion|next\/headers/m);
      // Solo los textos y los formatos deterministas de las pantallas (puros: sin base, sin Intl ni Date).
      for (const m of importacionesDeValor(t)) expect(m, `${nombre} → ${m}`).toMatch(/^(\.\.\/_plan\/textos|\.\.\/_plan\/formato|\.\.\/tablero\/formato|\.\/[\w-]+)$/);
    }
  });

  it("sin Server Actions, HTML crudo ni lecturas del crudo o de secretos", () => {
    for (const r of archivos(EDICION)) expect(violacionesComunes(leer(r)), rel(r)).toEqual([]);
  });

  it("las rutas de escritura usan el guardián del dueño (el candado de escrituras también las recorre)", () => {
    for (const r of RUTAS) expect(leer(join(RAIZ, r)), r).toMatch(/const (\w+) = await exigirDuenoApi\(pedido\);\s*if \(!\1\.ok\) return \1\.respuesta;/);
  });
});
