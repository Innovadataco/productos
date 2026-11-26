// Candado del componente común de la procedencia (frente fecha-hora-datos, src/app/_comun/fecha-dato/). Lo importan
// componentes de cliente (el tablero) y del servidor (plan, conciliación), así que:
// - no carga nada del servidor ni de la base: solo react, sus propios archivos, su hoja, los formatos del tablero y la tabla de fuentes (src/precios/fuentes.ts, pura);
// - lo que se pinta es determinista: sin Intl, toLocale*, la hora del navegador ni getters locales (la hidratación
//   pintaría otra cosa); solo hora.ts, que corre en los serializadores del servidor, usa Date, y en UTC;
// - sin directivas ni hooks (se pinta igual en el servidor), sin HTML crudo.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DIR = fileURLToPath(new URL("../../../src/app/_comun/fecha-dato/", import.meta.url));
const IMPORTACION = /^\s*(?:import|export)\s+(?:type\s+)?(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/gm;
const PERMITIDO = /^(react|\.\/[\w-]+(\.css)?|@\/app\/tablero\/formato|@\/precios\/fuentes)$/;
const LOCAL = /\bIntl\b|toLocale\w*|\.get(Hours|Minutes|Seconds|Date|Day|Month|FullYear|TimezoneOffset)\(|\bDate\.now\b/;
const DATE = /\bnew Date\b|\bDate\.(parse|UTC)\b/;
const DIRECTIVA = /^\s*["']use (client|server)["']/m;
const HOOK = /\buse(State|Effect|LayoutEffect|Memo|Callback|Ref|Reducer|Context|SyncExternalStore|Id|Transition|DeferredValue)\b/;
const CRUDO = /dangerouslySetInnerHTML/;

const sinComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

export function violaciones(archivo: string, fuente: string): string[] {
  const t = sinComentarios(fuente);
  const malas = [...t.matchAll(IMPORTACION)].map((m) => m[1]!).filter((d) => !PERMITIDO.test(d)).map((d) => `importa ${d}`);
  return [
    ...malas,
    ...(LOCAL.test(t) ? ["hora local o Intl"] : []),
    ...(archivo !== "hora.ts" && DATE.test(t) ? ["usa Date"] : []),
    ...(DIRECTIVA.test(t) ? ["directiva"] : []),
    ...(HOOK.test(t) ? ["hook"] : []),
    ...(CRUDO.test(t) ? ["HTML crudo"] : []),
  ];
}

const archivos = () => readdirSync(DIR).filter((f) => /\.(ts|tsx)$/.test(f)).sort();

describe("frontera de src/app/_comun/fecha-dato", () => {
  it("tiene sus archivos (si no, no probaría nada)", () => {
    expect(archivos()).toEqual(expect.arrayContaining(["FechaDato.tsx", "componer.ts", "hora.ts", "textos.ts", "tipos.ts"]));
  });

  it("ningún archivo importa del servidor ni pinta con la hora local, Intl, directivas, hooks ni HTML crudo", () => {
    for (const f of archivos()) expect(violaciones(f, readFileSync(`${DIR}${f}`, "utf8")), f).toEqual([]);
  });

  it("el candado muerde (prueba por mutación)", () => {
    expect(violaciones("x.tsx", 'import { Prisma } from "@prisma/client";\nimport "server-only";\nimport { n } from "../../tablero/formato";')).toEqual([
      "importa @prisma/client", "importa server-only", "importa ../../tablero/formato",
    ]);
    expect(violaciones("x.ts", "const h = new Intl.DateTimeFormat();")).toEqual(["hora local o Intl"]);
    expect(violaciones("x.ts", "const h = d.toLocaleString();")).toEqual(["hora local o Intl"]);
    expect(violaciones("x.ts", "const h = d.getHours();")).toEqual(["hora local o Intl"]);
    expect(violaciones("x.ts", "const h = new Date();")).toEqual(["usa Date"]);
    expect(violaciones("hora.ts", "const h = new Date(0);")).toEqual([]);
    expect(violaciones("hora.ts", "const h = Date.now();")).toEqual(["hora local o Intl"]);
    expect(violaciones("x.tsx", '"use client";\nexport const x = 1;')).toEqual(["directiva"]);
    expect(violaciones("x.tsx", 'import { useState } from "react";\nconst [a] = useState(0);')).toEqual(["hook"]);
    expect(violaciones("x.tsx", "<span dangerouslySetInnerHTML={{ __html: x }} />")).toEqual(["HTML crudo"]);
    expect(violaciones("x.tsx", '// "use client" en un comentario no cuenta\nimport "./fecha-dato.css";\nimport type { Procedencia } from "./tipos";')).toEqual([]);
  });
});
