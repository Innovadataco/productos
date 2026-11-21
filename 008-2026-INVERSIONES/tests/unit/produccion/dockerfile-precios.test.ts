// Candado del bundle de precios en el Dockerfile: la etapa builder lo genera DESPUÉS de next build (que vacía
// .next), y la imagen de la app (runner) lo copia de root y de solo lectura y lo prueba con su usuario no root.
// El servicio inv-008-precios usará esta misma imagen con otro entrypoint: siguen tres imágenes.
import { describe, expect, it } from "vitest";
import { leer008 } from "./falsos";

const instrucciones = leer008("Dockerfile")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

type Etapa = { nombre: string; cuerpo: string[] };
const etapas: Etapa[] = [];
for (const l of instrucciones) {
  const m = /^FROM\s+\S+(?:\s+AS\s+(\S+))?/i.exec(l);
  if (m) etapas.push({ nombre: (m[1] ?? "").toLowerCase(), cuerpo: [] });
  else etapas.at(-1)?.cuerpo.push(l);
}
const etapa = (nombre: string): Etapa => {
  const e = etapas.find((x) => x.nombre === nombre);
  if (!e) throw new Error(`falta la etapa ${nombre}`);
  return e;
};

/** La salida de `build:precios` en package.json (la única fuente de la ruta). */
function salidaDelBundle(): string {
  const script = (JSON.parse(leer008("package.json")) as { scripts: Record<string, string> }).scripts["build:precios"] ?? "";
  const m = /--outfile=(\S+)/.exec(script);
  if (!m) throw new Error("build:precios no tiene --outfile");
  return m[1]!;
}

const BUNDLE = "precios/servicio-precios.mjs";
const COPIA = new RegExp(`^COPY --from=builder --chmod=0444 /app/(\\S+) \\./${BUNDLE.replace(/[.]/g, "\\.")}$`);

describe("Dockerfile · bundle de precios", () => {
  it("builder: corre build:precios después de npm run build (next build vacía .next al empezar)", () => {
    const cuerpo = etapa("builder").cuerpo.join("\n");
    const build = cuerpo.indexOf("npm run build &&");
    const precios = cuerpo.indexOf("npm run build:precios");
    expect(build).toBeGreaterThanOrEqual(0);
    expect(precios).toBeGreaterThan(build);
  });

  it("runner: copia el bundle desde la salida de build:precios a ./precios/, de root y de solo lectura (0444)", () => {
    const copias = etapa("runner").cuerpo.filter((l) => l.includes(BUNDLE));
    const copia = copias.find((l) => COPIA.test(l));
    expect(copia, copias.join("\n")).toBeDefined();
    expect(COPIA.exec(copia!)![1]).toBe(salidaDelBundle());
    expect(copia).not.toMatch(/--chown/);
  });

  it("runner: la copia va antes del USER 10008 y el humo (--ayuda) corre después, con ese usuario", () => {
    const cuerpo = etapa("runner").cuerpo;
    const copia = cuerpo.findIndex((l) => COPIA.test(l));
    const usuario = cuerpo.lastIndexOf("USER 10008:10008");
    const humo = cuerpo.indexOf(`RUN node ${BUNDLE} --ayuda >/dev/null`);
    expect(copia).toBeGreaterThanOrEqual(0);
    expect(usuario).toBeGreaterThan(copia);
    expect(humo).toBeGreaterThan(usuario);
  });

  it("solo la imagen de la app lleva el bundle; ninguna etapa final lleva tsx ni esbuild para él", () => {
    for (const nombre of ["migrador", "vigia"]) expect(etapa(nombre).cuerpo.join("\n")).not.toContain(BUNDLE);
    expect(etapa("runner").cuerpo.join("\n")).not.toMatch(/\btsx\b|esbuild/);
  });

  it("siguen tres imágenes finales: runner, migrador y vigia (el servicio de precios usa la de la app)", () => {
    // Final = ninguna otra etapa parte de ella (FROM) ni copia de ella (COPY --from).
    const usadas = new Set(instrucciones.map((l) => /^(?:FROM\s+|COPY\s+--from=)(\S+)/i.exec(l)?.[1]?.toLowerCase()).filter(Boolean));
    const finales = etapas.map((e) => e.nombre).filter((n) => !usadas.has(n));
    expect(finales.sort()).toEqual(["migrador", "runner", "vigia"]);
  });
});
