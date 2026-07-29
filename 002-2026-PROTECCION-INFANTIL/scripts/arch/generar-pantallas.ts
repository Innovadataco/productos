/**
 * SPEC-126 · Generador de `docs/architecture/03-pantallas.md`.
 * Fuentes: árbol `src/app/**` (page.tsx), `src/lib/proxy.ts` (ejecutado para la
 * alcanzabilidad y parseado para `homeForRole`), `src/lib/nav-items.ts`.
 *
 * Contenido: pantallas por rol (quién las alcanza según la puerta real), home por
 * rol y grafo de transiciones (redirects del proxy) en Mermaid.
 *
 * Uso CLI: `npx tsx scripts/arch/generar-pantallas.ts` (escribe el artefacto).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { ARTEFACTOS, encabezadoGenerado } from "./artefactos";
import { RUTA_APP, RUTA_DOCS_ARCH, RUTA_PROXY } from "./lib/paths";
import { inventarioRutasApp } from "./lib/rutas-app";
import { ROLES_BARRIDO, veredictoPermite, veredictoProxy, textoVeredicto, type RolBarrido } from "./lib/veredictos";

/**
 * Home por rol, extraído de `homeForRole` en `proxy.ts` (no se exporta y proxy.ts NO
 * se toca: se parsea). Si la función cambia de forma, falla ruidoso (nunca se salta).
 */
export function homePorRol(): Array<{ rol: string; home: string }> {
    const texto = fs.readFileSync(RUTA_PROXY, "utf-8");
    const bloque = texto.match(/function homeForRole[\s\S]*?\n\}/);
    if (!bloque) {
        throw new Error("[Arch:gen] no se encontró `homeForRole` en src/lib/proxy.ts.");
    }
    const entradas: Array<{ rol: string; home: string }> = [];
    for (const m of bloque[0].matchAll(/if \(rol === "(\w+)"\) return "([^"]+)";/g)) {
        entradas.push({ rol: m[1], home: m[2] });
    }
    const porDefecto = bloque[0].match(/return "([^"]+)";\s*\n\}/);
    if (!porDefecto) {
        throw new Error("[Arch:gen] `homeForRole` de src/lib/proxy.ts no tiene retorno por defecto reconocible.");
    }
    entradas.push({ rol: "ADMIN, OPERADOR (por defecto)", home: porDefecto[1] });
    return entradas.sort((a, b) => a.rol.localeCompare(b.rol));
}

export async function generarPantallas(): Promise<string> {
    const propio = ARTEFACTOS.find((a) => a.archivo === "03-pantallas.md")!;
    const paginas = inventarioRutasApp(RUTA_APP).filter((r) => r.tipo === "pagina");
    const homes = homePorRol();

    // Alcanzabilidad real: cada página × cada rol contra la puerta (sesión canónica).
    const alcanzables = new Map<string, RolBarrido[]>();
    const bloqueos = new Map<string, Map<RolBarrido, string>>();
    for (const pagina of paginas) {
        const roles: RolBarrido[] = [];
        const detalle = new Map<RolBarrido, string>();
        for (const rol of ROLES_BARRIDO) {
            const veredicto = await veredictoProxy(rol, pagina.rutaEval);
            if (veredictoPermite(veredicto)) roles.push(rol);
            else detalle.set(rol, textoVeredicto(veredicto));
        }
        alcanzables.set(pagina.ruta, roles);
        bloqueos.set(pagina.ruta, detalle);
    }

    const lineas: string[] = [
        encabezadoGenerado(propio.generador, propio.fuentes),
        "# 03 · Pantallas por rol y transiciones",
        "",
        `${paginas.length} páginas (\`page.tsx\`) clasificadas por quién las alcanza según la`,
        "puerta real (`proxy()` ejecutado con la sesión canónica; segmentos `[x]` evaluados",
        "con un valor muestra fijo — al proxy solo le importa el prefijo).",
        "",
        "## Home por rol (`homeForRole` de `proxy.ts`)",
        "",
        "| Rol | Home (destino de los redirects) |",
        "| --- | --- |",
    ];
    for (const h of homes) {
        lineas.push(`| ${h.rol} | \`${h.home}\` |`);
    }
    lineas.push(
        "",
        "Sin sesión, toda ruta protegida redirige a `/login` (página) o 401 (API).",
        "",
        "## Pantallas y quién las alcanza",
        "",
        "| Pantalla | Roles que la alcanzan | Bloqueados (veredicto de la puerta) |",
        "| --- | --- | --- |"
    );
    for (const pagina of paginas) {
        const roles = alcanzables.get(pagina.ruta)!;
        const detalle = bloqueos.get(pagina.ruta)!;
        const bloqueadosTxt = [...detalle.entries()]
            .map(([rol, veredicto]) => `${rol} (${veredicto})`)
            .join("<br>");
        lineas.push(`| \`${pagina.ruta}\` | ${roles.join(", ") || "—"} | ${bloqueadosTxt || "—"} |`);
    }
    lineas.push("");

    lineas.push("## Grafo de transiciones (redirects de la puerta)", "", "```mermaid", "flowchart LR");
    lineas.push("    anon[sin sesión] -->|ruta protegida| login[/login]");
    for (const h of homes) {
        const nodo = h.rol.replace(/[^A-Z_]/g, "_");
        lineas.push(`    bloqueado_${nodo}[ruta no permitida] -->|${h.rol}| ${nodo}([${h.home}])`);
    }
    lineas.push("```", "");
    return lineas.join("\n");
}

async function main() {
    const destino = path.join(RUTA_DOCS_ARCH, "03-pantallas.md");
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, await generarPantallas());
    console.log(`[Arch:gen] ${destino} escrito.`);
}

if (process.argv[1]?.endsWith("generar-pantallas.ts")) {
    void main();
}
