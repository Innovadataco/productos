/**
 * SPEC-126 · Aserción B (el menú no miente): todo href que el header o el menú de área
 * pinta para un rol debe ser alcanzable para ese rol según el proxy (la puerta real).
 *
 * Fuentes (se LEEN, no se tocan):
 * - `NavHeader.tsx`: hrefs literales con su guarda de rol + dinámicos resueltos
 *   (`dashboardHref`, `logoHref`). Condición ZEUS 2: un href no resoluble
 *   estáticamente FALLA RUIDOSO listándolo (parsearHeader lanza); nunca se salta.
 * - `nav-items.ts` (arrays importados): el menú los pinta filtrando por módulos de
 *   BD; la aproximación estática son los grants por defecto del seed
 *   (`clavesPorRol` en `prisma/seed.ts`), documentada en el informe.
 *
 * Uso CLI: `npx tsx scripts/arch/asercion-menu-no-miente.ts` (exit 1 si hay muertos).
 */
import {
    NOTA_IA_TABS,
    arraysNav,
    grantsSeedPorRol,
    parsearHeader,
} from "./lib/nav-fuentes";
import {
    ROLES_BARRIDO,
    predicadoPermite,
    textoVeredicto,
    veredictoPermite,
    veredictoProxy,
} from "./lib/veredictos";

export interface HrefMuerto {
    rol: string;
    origen: string;
    href: string;
    veredicto: string;
}

export interface ResultadoAsercionB {
    evaluados: number;
    muertos: HrefMuerto[];
    notaIaTabs: string;
}

export async function ejecutarAsercionB(): Promise<ResultadoAsercionB> {
    const header = parsearHeader(); // lanza (fallo ruidoso) si un href no se resuelve estáticamente
    const grants = grantsSeedPorRol();
    const muertos: HrefMuerto[] = [];
    let evaluados = 0;

    for (const rol of ROLES_BARRIDO) {
        // 1) Header: hrefs pintados (guarda JSX) que además pasan el predicado del propio header.
        for (const href of header.hrefsPintados(rol)) {
            if (!predicadoPermite(rol, href)) continue; // esEnlaceNavegable no lo pinta
            evaluados++;
            const veredicto = await veredictoProxy(rol, href);
            if (!veredictoPermite(veredicto)) {
                muertos.push({ rol, origen: "NavHeader", href, veredicto: textoVeredicto(veredicto) });
            }
        }
        // 2) Logo: siempre pintado (su destino no pasa por esEnlaceNavegable).
        for (const href of header.hrefsLogo(rol)) {
            evaluados++;
            const veredicto = await veredictoProxy(rol, href);
            if (!veredictoPermite(veredicto)) {
                muertos.push({ rol, origen: "NavHeader (logo)", href, veredicto: textoVeredicto(veredicto) });
            }
        }
        // 3) Menús de área y submenús (nav-items + tabs fijas). D-41 (SPEC-126):
        //    el componente pinta (módulo de BD, si filtra por módulo) ∧ predicado
        //    del proxy; la aserción reproduce exactamente esa regla de pintado.
        const modulosDelRol = new Set(grants[rol] ?? []);
        for (const nav of arraysNav()) {
            const veredictoArea = await veredictoProxy(rol, nav.area);
            if (!veredictoPermite(veredictoArea)) continue; // el menú del área no se pinta para este rol
            for (const item of nav.items) {
                if (nav.filtroModulo === "seed" && !modulosDelRol.has(item.modulo)) continue; // módulo no concedido: no se pinta
                if (!predicadoPermite(rol, item.href)) continue; // D-41: el predicado tiene la última palabra
                evaluados++;
                const veredicto = await veredictoProxy(rol, item.href);
                if (!veredictoPermite(veredicto)) {
                    muertos.push({
                        rol,
                        origen: nav.filtroModulo === "seed" ? `${nav.nombre} (módulo ${item.modulo})` : nav.nombre,
                        href: item.href,
                        veredicto: textoVeredicto(veredicto),
                    });
                }
            }
        }
    }
    return { evaluados, muertos, notaIaTabs: NOTA_IA_TABS };
}

async function main() {
    const resultado = await ejecutarAsercionB();
    console.log(`[Arch:B] ${resultado.evaluados} hrefs pintados evaluados contra el proxy.`);
    console.log(`[Arch:B] Nota: ${resultado.notaIaTabs}`);
    if (resultado.muertos.length === 0) {
        console.log("[Arch:B] VERDE: todo href pintado es alcanzable según el proxy.");
    } else {
        console.error(`[Arch:B] ROJO: ${resultado.muertos.length} hrefs muertos (pintados pero bloqueados por la puerta):`);
        for (const m of resultado.muertos) {
            console.error(`  ${m.rol} · ${m.href} · ${m.origen} · proxy=${m.veredicto}`);
        }
        process.exitCode = 1;
    }
}

if (process.argv[1]?.endsWith("asercion-menu-no-miente.ts")) {
    void main();
}
