/**
 * SPEC-126 · Aserción A (puerta ≡ predicado): para cada (rol, ruta) del inventario,
 * `proxy()` (la puerta real, ejecutada con la sesión canónica) y `esDestinoPermitidoPorRol`
 * (el predicado del menú) deben dar el MISMO veredicto (alineación D5: permitir ≡ true;
 * 401/403/redirect ≡ false).
 *
 * Condición ZEUS 1: el rojo es SOLO un desalineo real sobre la sesión canónica
 * (usuario activo, debeCambiarPassword=false, vigencia vigente; solo varía el rol).
 * El eje ANONIMO (sin sesión) se evalúa y se documenta como NOTA: sus divergencias
 * son de estado (no hay sesión), no desalineos.
 *
 * Uso CLI: `npx tsx scripts/arch/asercion-puerta-predicado.ts` (exit 1 si hay desalineos).
 */
import { inventarioRutasApp, type RutaApp } from "./lib/rutas-app";
import { RUTA_APP } from "./lib/paths";
import {
    ROLES_BARRIDO,
    ROLES_AUTENTICADOS,
    predicadoPermite,
    rutasDeclaradasEnProxy,
    textoVeredicto,
    veredictoPermite,
    veredictoProxy,
    type RolBarrido,
} from "./lib/veredictos";

export interface FilaAsercionA {
    rol: RolBarrido;
    ruta: string;
    proxy: string;
    proxyPermite: boolean;
    predicadoPermite: boolean;
    alineado: boolean;
}

export interface ResultadoAsercionA {
    filas: FilaAsercionA[];
    /** Desalineos reales (roles autenticados, sesión canónica): el rojo de la compuerta. */
    desalineos: FilaAsercionA[];
    /** Divergencias del eje anónimo (sin sesión): se documentan, nunca son rojo. */
    notasAnonimo: FilaAsercionA[];
    rutasEvaluadas: number;
}

/** Inventario rol × ruta: árbol src/app/** (páginas + APIs) ∪ rutas declaradas en proxy.ts. */
export function inventarioRutas(): RutaApp[] {
    const delArbol = inventarioRutasApp(RUTA_APP);
    const cubiertas = new Set(delArbol.map((r) => r.rutaEval));
    const delProxy = rutasDeclaradasEnProxy()
        .filter((r) => !cubiertas.has(r))
        .map((r): RutaApp => ({ ruta: r, rutaEval: r, tipo: r.startsWith("/api/") ? "api" : "pagina", archivo: "src/lib/proxy.ts" }));
    return [...delArbol, ...delProxy].sort((a, b) => a.ruta.localeCompare(b.ruta) || a.tipo.localeCompare(b.tipo));
}

export async function ejecutarAsercionA(): Promise<ResultadoAsercionA> {
    const rutas = inventarioRutas();
    const filas: FilaAsercionA[] = [];
    for (const rol of ROLES_BARRIDO) {
        for (const ruta of rutas) {
            const veredicto = await veredictoProxy(rol, ruta.rutaEval);
            const proxyPermite = veredictoPermite(veredicto);
            const predicado = predicadoPermite(rol, ruta.rutaEval);
            filas.push({
                rol,
                ruta: ruta.ruta,
                proxy: textoVeredicto(veredicto),
                proxyPermite,
                predicadoPermite: predicado,
                alineado: proxyPermite === predicado,
            });
        }
    }
    return {
        filas,
        desalineos: filas.filter((f) => f.rol !== "ANONIMO" && !f.alineado),
        notasAnonimo: filas.filter((f) => f.rol === "ANONIMO" && !f.alineado),
        rutasEvaluadas: rutas.length,
    };
}

async function main() {
    const resultado = await ejecutarAsercionA();
    const roles = ROLES_AUTENTICADOS.length;
    console.log(
        `[Arch:A] Inventario: ${roles} roles autenticados (sesión canónica) + anónimo × ${resultado.rutasEvaluadas} rutas ` +
            `= ${resultado.filas.length} combinaciones evaluadas.`
    );
    if (resultado.desalineos.length === 0) {
        console.log("[Arch:A] VERDE: puerta ≡ predicado en todas las combinaciones de la sesión canónica.");
    } else {
        console.error(`[Arch:A] ROJO: ${resultado.desalineos.length} desalineos reales puerta ≠ predicado:`);
        for (const d of resultado.desalineos) {
            console.error(`  ${d.rol} · ${d.ruta} · proxy=${d.proxy} · predicado=${d.predicadoPermite}`);
        }
    }
    if (resultado.notasAnonimo.length > 0) {
        console.log(
            `[Arch:A] Nota (NO es rojo): ${resultado.notasAnonimo.length} divergencias del eje anónimo ` +
                "(sin sesión; la puerta exige login donde el predicado solo describe el menú). Documentadas en 02-roles-capacidades.md."
        );
    }
    if (resultado.desalineos.length > 0) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("asercion-puerta-predicado.ts")) {
    void main();
}
