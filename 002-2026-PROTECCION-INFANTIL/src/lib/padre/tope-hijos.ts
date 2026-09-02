/**
 * SPEC-363 — El tope de menores del padre, en UN solo lugar.
 *
 * El texto aprobado por Jelkin y el número máximo salen del mismo par de
 * parámetros para las DOS puertas que aplican el cupo: registrar un menor nuevo
 * (`POST /api/padre/hijos`) y reactivar uno inactivo (`PATCH .../[id]`). Antes el
 * mensaje vivía inline en la ruta de alta; al aparecer la segunda puerta (BUG1)
 * habría que duplicarlo, y dos textos "iguales" siempre terminan divergiendo.
 *
 * No está en `hijos.ts` a propósito: ese módulo entra a la cadena de los workers
 * (SPEC-197 · I-88, imports relativos), y esto lee parámetros desde el área de
 * las rutas, que sí pueden usar el alias.
 */
import { getParametroSistemaValor } from "@/lib/parametros";

/** Texto aprobado por Jelkin (A-70 · F5). El parámetro es override, no reemplazo. */
const TEXTO_APROBADO_TOPE =
    "Tienes {{activos}} de {{maximo}} menores activos. Si quieres registrar otro, primero inactiva uno.";

/** Tope de menores ACTIVOS por cuenta (parámetro `padre.hijos.maximo`, default 5). */
export async function maximoHijosActivos(): Promise<number> {
    return parseInt((await getParametroSistemaValor("padre.hijos.maximo")) ?? "5", 10);
}

/**
 * Plantilla del mensaje del tope, con los marcadores `{{activos}}` / `{{maximo}}`
 * sin resolver. El parámetro `padre.hijos.maximo_mensaje` la sobrescribe SOLO si
 * ya está en el formato nuevo (trae `{{activos}}`): en las bases desplegadas
 * antes de SPEC-361 el parámetro tiene el texto viejo, que no debe revivir.
 */
export async function plantillaMensajeTope(): Promise<string> {
    const parametrizado = await getParametroSistemaValor("padre.hijos.maximo_mensaje");
    return parametrizado?.includes("{{activos}}") ? parametrizado : TEXTO_APROBADO_TOPE;
}

/** Resuelve la plantilla con los números concretos. */
export function resolverMensajeTope(plantilla: string, activos: number, maximo: number): string {
    return plantilla.replaceAll("{{maximo}}", String(maximo)).replaceAll("{{activos}}", String(activos));
}
