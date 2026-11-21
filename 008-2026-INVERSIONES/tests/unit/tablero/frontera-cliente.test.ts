// Candado de la frontera servidor/cliente del tablero (frente tablero-cierres): el cálculo vive en el
// servidor (src/tablero/*, con Prisma y Decimal) y el componente de cliente solo da formato. Si un
// archivo de cliente importara un VALOR de esos módulos, @prisma/client entraría al paquete del navegador.
// Solo se admiten `import type` (se borran al compilar).
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DIR = fileURLToPath(new URL("../../../src/app/tablero/", import.meta.url));
/** Lo que no puede llegar al navegador como valor. */
const SOLO_SERVIDOR = /^(@prisma\/client|server-only|@\/tablero\/|@\/lib\/|@\/auth\/|\.\.\/)/;
const IMPORTACION = /^\s*import\s+(type\s+)?(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/gm;

interface Importacion { readonly desde: string; readonly soloTipo: boolean }

const leer = (archivo: string) => readFileSync(`${DIR}${archivo}`, "utf8");
const importaciones = (fuente: string): Importacion[] => [...fuente.matchAll(IMPORTACION)].map((m) => ({ soloTipo: Boolean(m[1]), desde: m[2]! }));

/** Archivos «use client» de la carpeta y todo lo que importan de la carpeta (./x), recursivo. */
function archivosDeCliente(): string[] {
  const todos = readdirSync(DIR).filter((f) => /\.(ts|tsx)$/.test(f));
  const resolver = (desde: string) => todos.find((f) => f.replace(/\.(ts|tsx)$/, "") === desde.replace(/^\.\//, ""));
  const pendientes = todos.filter((f) => /^\s*["']use client["']/.test(leer(f)));
  const vistos = new Set<string>();
  while (pendientes.length > 0) {
    const f = pendientes.pop()!;
    if (vistos.has(f)) continue;
    vistos.add(f);
    importaciones(leer(f)).filter((i) => i.desde.startsWith("./")).forEach((i) => { const r = resolver(i.desde); if (r) pendientes.push(r); });
  }
  return [...vistos].sort();
}

/** Importaciones de valor (no `import type`) desde módulos de servidor, por archivo. */
function fugasAlCliente(fuentes: Readonly<Record<string, string>>): string[] {
  return Object.entries(fuentes).flatMap(([archivo, fuente]) =>
    importaciones(fuente).filter((i) => !i.soloTipo && SOLO_SERVIDOR.test(i.desde)).map((i) => `${archivo} → ${i.desde}`),
  );
}

describe("frontera servidor/cliente de src/app/tablero", () => {
  const cliente = archivosDeCliente();

  it("encuentra los archivos de cliente (Tablero.tsx y lo que importa)", () => {
    expect(cliente).toEqual(expect.arrayContaining(["Tablero.tsx", "Graficas.tsx", "formato.ts", "tipos.ts"]));
    expect(cliente).not.toContain("serializar.ts"); // es del servidor: lo usa src/app/page.tsx
  });

  it("ningún archivo de cliente importa un valor de módulos del servidor", () => {
    expect(fugasAlCliente(Object.fromEntries(cliente.map((f) => [f, leer(f)])))).toEqual([]);
  });

  it("el candado muerde: una importación de valor desde @/tablero o @prisma/client se reporta", () => {
    expect(fugasAlCliente({
      "x.tsx": 'import type { A } from "@/tablero/movimiento";\nimport { calcularMovimiento } from "@/tablero/movimiento";\nimport { Prisma } from "@prisma/client";\nimport { n } from "./formato";\n',
    })).toEqual(["x.tsx → @/tablero/movimiento", "x.tsx → @prisma/client"]);
  });
});
