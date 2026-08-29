/**
 * SPEC-126 · Generador de `docs/architecture/00-INDICE.md`.
 * Fuente única: `scripts/arch/artefactos.ts` (añadir un artefacto = añadir una fila ahí).
 *
 * Uso CLI: `npx tsx scripts/arch/generar-indice.ts` (escribe el artefacto).
 * Como librería: `generarIndice()` devuelve el contenido (lo usa arch:check).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { ARTEFACTOS, encabezadoGenerado } from "./artefactos";
import { RUTA_DOCS_ARCH } from "./lib/paths";

export function generarIndice(): string {
    const propio = ARTEFACTOS.find((a) => a.archivo === "00-INDICE.md")!;
    const lineas: string[] = [
        encabezadoGenerado(propio.generador, propio.fuentes),
        "# 00 · Índice de la línea base de arquitectura",
        "",
        "Documentación GENERADA leyendo el código (SPEC-126). Si el código cambia,",
        "se regenera; si lo commiteado difiere de la regeneración, `arch:check` falla.",
        "",
        "| Artefacto | Contenido | Fuentes de código | Regenerar |",
        "| --- | --- | --- | --- |",
    ];
    for (const a of ARTEFACTOS) {
        lineas.push(
            `| [${a.archivo}](${a.archivo}) | ${a.titulo} | ${a.fuentes.map((f) => `\`${f}\``).join("<br>")} | \`npx tsx ${a.generador}\` |`
        );
    }
    lineas.push(
        "",
        "## Compuerta",
        "",
        "`npm run arch:check` (cableada al CI de la raíz del monorepo) verifica:",
        "",
        "1. **Drift**: regenera los 5 artefactos y falla si difieren de lo commiteado.",
        "2. **Huérfanos**: un modelo Prisma sin relaciones fuera de `scripts/arch/excepciones.json` falla.",
        "3. **Aserción A (puerta ≡ predicado)**: `proxy()` y `esDestinoPermitidoPorRol` dan el mismo",
        "   veredicto en todo el inventario rol × ruta (sesión canónica).",
        "4. **Aserción B (el menú no miente)**: todo href que la navegación pinta para un rol es",
        "   alcanzable para ese rol según el proxy (regla de pintado D-41: módulo de BD ∧ predicado).",
        ""
    );
    return lineas.join("\n");
}

function main() {
    const destino = path.join(RUTA_DOCS_ARCH, "00-INDICE.md");
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, generarIndice());
    console.log(`[Arch:gen] ${destino} escrito.`);
}

if (process.argv[1]?.endsWith("generar-indice.ts")) {
    main();
}
