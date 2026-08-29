/**
 * SPEC-126 · Generador de `docs/architecture/02-roles-capacidades.md`.
 * Fuentes: `src/lib/proxy.ts` (ejecutado, nunca reimplementado), `src/lib/nav-items.ts`,
 * `src/lib/permisos-catalogo.ts`, `src/components/modules/NavHeader.tsx`, `prisma/seed.ts`
 * y el árbol `src/app/**`.
 *
 * Contenido: matriz rol × ruta con el veredicto REAL de `proxy()` (sesión canónica) y
 * del predicado `esDestinoPermitidoPorRol`; tabla módulo → ruta → rol (eje de BD);
 * nota de ejes NO reconciliados (decisión de ZEUS pendiente) y divergencias del eje
 * anónimo documentadas como nota (condición ZEUS 1: nunca son rojo).
 *
 * Uso CLI: `npx tsx scripts/arch/generar-roles-capacidades.ts` (escribe el artefacto).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { ARTEFACTOS, encabezadoGenerado } from "./artefactos";
import { ejecutarAsercionA } from "./asercion-puerta-predicado";
import { arraysNav, grantsSeedPorRol, parsearHeader } from "./lib/nav-fuentes";
import { RUTA_DOCS_ARCH } from "./lib/paths";
import { ROLES_BARRIDO } from "./lib/veredictos";

export async function generarRolesCapacidades(): Promise<string> {
    const propio = ARTEFACTOS.find((a) => a.archivo === "02-roles-capacidades.md")!;
    const asercion = await ejecutarAsercionA();
    const grants = grantsSeedPorRol();
    const header = parsearHeader();

    const lineas: string[] = [
        encabezadoGenerado(propio.generador, propio.fuentes),
        "# 02 · Roles y capacidades (puerta y permisos)",
        "",
        "Dos ejes documentados **por separado, sin reconciliar** (su reconciliación es",
        "decisión de ZEUS, fuera de SPEC-126):",
        "",
        "1. **Eje de rutas (la puerta)**: `proxy()` decide quién pasa; `esDestinoPermitidoPorRol`",
        "   es el MISMO criterio reusable fuera del middleware (lo consume toda la navegación, D-41).",
        "2. **Eje de módulos (la BD)**: `PermisoModulo` decide QUÉ se ofrece dentro de un área",
        "   (los menús filtran por módulo ∧ predicado desde la D-41).",
        "",
        "La matriz de abajo ejecuta el código real: `proxy()` con la sesión canónica (usuario",
        "activo, `debeCambiarPassword=false`, vigencia vigente; solo varía el rol) y el predicado.",
        "Alineación D5: permitir ≡ `true`; 401/403/redirect ≡ `false`.",
        "",
        `Inventario: ${ROLES_BARRIDO.length} roles (5 autenticados + anónimo) × ${asercion.rutasEvaluadas} rutas`,
        `(árbol \`src/app/**\` ∪ rutas declaradas en \`proxy.ts\`) = ${asercion.filas.length} combinaciones.`,
        "",
        `Estado de la aserción A al generar: **${asercion.desalineos.length === 0 ? "VERDE (puerta ≡ predicado)" : `ROJO (${asercion.desalineos.length} desalineos)`}**.`,
        "",
    ];

    if (asercion.desalineos.length > 0) {
        lineas.push("## Desalineos reales puerta ≠ predicado (ROJO)", "", "| Rol | Ruta | Puerta | Predicado |", "| --- | --- | --- | --- |");
        for (const d of asercion.desalineos) {
            lineas.push(`| ${d.rol} | ${d.ruta} | ${d.proxy} | ${d.predicadoPermite} |`);
        }
        lineas.push("");
    }

    lineas.push("## Matriz rol × ruta (veredicto real)", "");
    for (const rol of ROLES_BARRIDO) {
        const delRol = asercion.filas.filter((f) => f.rol === rol);
        lineas.push(`### ${rol}`, "", "| Ruta | Tipo | Puerta (`proxy()`) | Predicado | Alineado |", "| --- | --- | --- | --- | --- |");
        for (const f of delRol) {
            const tipo = f.ruta.startsWith("/api/") ? "api" : "página";
            lineas.push(
                `| \`${f.ruta}\` | ${tipo} | ${f.proxy} | ${f.predicadoPermite ? "permite" : "no permite"} | ${f.alineado ? "sí" : "**NO**"} |`
            );
        }
        lineas.push("");
    }

    if (asercion.notasAnonimo.length > 0) {
        lineas.push(
            "## Nota: divergencias del eje anónimo (NO son rojo)",
            "",
            "Sin sesión, la puerta exige login donde el predicado solo describe qué pintaría el",
            "menú (condición ZEUS 1: el rojo es SOLO desalineo real con sesión canónica).",
            "",
            "| Ruta | Puerta (anónimo) | Predicado (anónimo) |",
            "| --- | --- | --- |"
        );
        for (const n of asercion.notasAnonimo) {
            lineas.push(`| \`${n.ruta}\` | ${n.proxy} | ${n.predicadoPermite ? "permite" : "no permite"} |`);
        }
        lineas.push("");
    }

    lineas.push(
        "## Eje de módulos (BD): módulo → ruta → rol",
        "",
        "Módulos del catálogo enlazados a ítems de navegación (`nav-items.ts`) y grants por",
        "defecto del seed (`clavesPorRol` de `prisma/seed.ts`; los grants reales viven en BD).",
        "Desde la D-41, el menú pinta un ítem solo si (módulo concedido) ∧ (predicado permite).",
        "",
        "| Módulo | Ruta del menú | Roles con grant por defecto |",
        "| --- | --- | --- |"
    );
    const filasModulo: Array<{ modulo: string; href: string; roles: string }> = [];
    for (const nav of arraysNav()) {
        if (nav.filtroModulo !== "seed") continue;
        for (const item of nav.items) {
            const roles = Object.entries(grants)
                .filter(([, modulos]) => modulos.includes(item.modulo))
                .map(([rol]) => rol)
                .sort()
                .join(", ");
            filasModulo.push({ modulo: item.modulo, href: item.href, roles: roles || "—" });
        }
    }
    filasModulo.sort((a, b) => a.modulo.localeCompare(b.modulo) || a.href.localeCompare(b.href));
    for (const f of filasModulo) {
        lineas.push(`| ${f.modulo} | \`${f.href}\` | ${f.roles} |`);
    }
    lineas.push("");

    lineas.push(
        "## Hrefs del header (NavHeader.tsx)",
        "",
        "Hrefs literales con su guarda de rol (parseados del JSX; la cobertura es total: un",
        "href nuevo sin guarda declarada hace fallar la aserción B ruidosamente).",
        "",
        "| Href | Roles que lo ven (guarda JSX ∧ predicado) |",
        "| --- | --- |"
    );
    for (const href of header.literales) {
        const roles = ROLES_BARRIDO.filter((rol) => header.hrefsPintados(rol).includes(href)).join(", ") || "—";
        lineas.push(`| \`${href}\` | ${roles} |`);
    }
    lineas.push("");
    return lineas.join("\n");
}

async function main() {
    const destino = path.join(RUTA_DOCS_ARCH, "02-roles-capacidades.md");
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, await generarRolesCapacidades());
    console.log(`[Arch:gen] ${destino} escrito.`);
}

if (process.argv[1]?.endsWith("generar-roles-capacidades.ts")) {
    void main();
}
