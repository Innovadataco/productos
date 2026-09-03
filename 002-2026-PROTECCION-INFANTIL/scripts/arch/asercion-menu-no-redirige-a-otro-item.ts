/**
 * SPEC-404 (I-290) · Aserción B-bis: el page.tsx de un ítem de menú NO puede
 * `redirect("Y")` a otro ítem del mismo menú.
 *
 * El caso real (SPEC-378 + SPEC-404): el href "Bandeja de reportes"
 * (`/dashboard/admin`) tenía `redirect("/dashboard/admin/inicio")` en su
 * page.tsx. Ambos hrefs estaban en `ADMIN_NAV_ITEMS`, así que el admin con
 * `inicio_admin` no podía volver a la bandeja — click al menú → redirect a
 * Inicio → click en la casilla de Inicio (misma URL) → nada pasa. Enlace muerto.
 *
 * `arch:check (d)` (asercion-menu-no-miente) NO cazó esto porque el proxy sí
 * autoriza al admin en `/dashboard/admin`: la puerta pasa, la página no muestra
 * lo que promete. Alcanzable ≠ funcional.
 *
 * Esta aserción es puramente estática: para cada href del menú resuelve el
 * `page.tsx` correspondiente y lo escanea buscando `redirect("...")` con una
 * cadena literal que sea otro href del mismo menú. Falla ruidoso listando
 * origen → destino.
 *
 * Uso CLI: `npx tsx scripts/arch/asercion-menu-no-redirige-a-otro-item.ts`.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { arraysNav } from "./lib/nav-fuentes";
import type { NavItem } from "@/lib/nav-items";

export interface RedirectMuerto {
    origen: string;
    destino: string;
    archivo: string;
    menu: string;
}

export interface ResultadoAsercionBBis {
    evaluados: number;
    muertos: RedirectMuerto[];
}

const REDIRECT_LITERAL = /redirect\(\s*["'`]([^"'`]+)["'`]\s*\)/g;

/** Elimina comentarios de bloque y de línea (aprox.) para que ejemplos en la
 * documentación no disparen falsos positivos. No es un parser TS completo — es
 * lo bastante para no confundir `redirect("...")` de un JSDoc con código real. */
function sinComentarios(contenido: string): string {
    return contenido
        .replace(/\/\*[\s\S]*?\*\//g, "") // bloque
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1"); // linea (protege URLs `https://`)
}

function aplanar(items: NavItem[]): NavItem[] {
    return items.flatMap((i) => [i, ...aplanar(i.children ?? [])]);
}

function pageTsxParaHref(href: string, root: string): string | null {
    const rel = href.replace(/^\/+/, "");
    const candidatos = [
        path.join(root, "src", "app", rel, "page.tsx"),
        path.join(root, "src", "app", rel, "page.ts"),
    ];
    return candidatos.find((c) => fs.existsSync(c)) ?? null;
}

export function ejecutarAsercionBBis(rootProyecto: string = process.cwd()): ResultadoAsercionBBis {
    const muertos: RedirectMuerto[] = [];
    let evaluados = 0;

    for (const nav of arraysNav()) {
        const items = aplanar(nav.items);
        const hrefsDelMenu = new Set(items.map((i) => i.href));

        for (const item of items) {
            const archivo = pageTsxParaHref(item.href, rootProyecto);
            if (!archivo) continue; // href sin page.tsx: no hay redirect estático que revisar
            evaluados++;
            const contenido = sinComentarios(fs.readFileSync(archivo, "utf-8"));
            let match: RegExpExecArray | null;
            REDIRECT_LITERAL.lastIndex = 0;
            while ((match = REDIRECT_LITERAL.exec(contenido)) !== null) {
                const destino = match[1];
                if (destino === item.href) continue; // redirect a sí mismo: raro pero no cross-item
                if (hrefsDelMenu.has(destino)) {
                    muertos.push({
                        origen: item.href,
                        destino,
                        archivo: path.relative(rootProyecto, archivo),
                        menu: nav.nombre,
                    });
                }
            }
        }
    }

    return { evaluados, muertos };
}

async function main() {
    const resultado = ejecutarAsercionBBis();
    console.log(`[Arch:B-bis] ${resultado.evaluados} page.tsx de items de menú evaluados.`);
    if (resultado.muertos.length === 0) {
        console.log("[Arch:B-bis] VERDE: ningún item de menú redirige a otro item del mismo menú.");
    } else {
        console.error(`[Arch:B-bis] ROJO: ${resultado.muertos.length} redirects cross-item:`);
        for (const m of resultado.muertos) {
            console.error(`  ${m.menu} · ${m.origen} → ${m.destino} · ${m.archivo}`);
        }
        process.exitCode = 1;
    }
}

if (process.argv[1]?.endsWith("asercion-menu-no-redirige-a-otro-item.ts")) {
    void main();
}
