/**
 * SPEC-935 (I-448) · Quién LEE los casos del comité y de qué colegio.
 *
 * VEREDICTO CEO: el menú (SPEC-173) y las páginas `comite/casos` ya admiten al rector (`ROLES_BANDEJA`); la API
 * de lista + detalle había quedado solo en `COMITE_CONVIVENCIA` → el rector veía la pantalla y un error. Acá:
 *   - `COMITE_CONVIVENCIA` → su `comiteColegioId`;
 *   - `SCHOOL_ADMIN` (rector) → su `colegioId` — SOLO LECTURA (lista + detalle);
 *   - cualquier otro rol → 403.
 * Notas, análisis, recomendación, cierre y firma siguen siendo SOLO del comité (`verifyAuth("COMITE_CONVIVENCIA")`
 * en sus rutas). El colegio sale SIEMPRE de la sesión, nunca del request: un caso de otro colegio da 404 en el
 * servicio (`obtenerDetalle` compara `solicitud.colegioId`).
 */
import { AppError, ERROR_CODES } from "@/lib/errors";

export const ROLES_LECTURA_CASOS_COMITE = ["COMITE_CONVIVENCIA", "SCHOOL_ADMIN"] as const;

export function colegioLecturaCasosComite(user: {
    rol: string;
    colegioId?: string | null;
    comiteColegioId?: string | null;
}): string {
    if (user.rol !== "COMITE_CONVIVENCIA" && user.rol !== "SCHOOL_ADMIN") {
        throw new AppError("Permisos insuficientes.", ERROR_CODES.FORBIDDEN, 403);
    }
    const colegioId = user.rol === "COMITE_CONVIVENCIA" ? user.comiteColegioId : user.colegioId;
    if (!colegioId) {
        throw new AppError("Cuenta no vinculada a un colegio", ERROR_CODES.FORBIDDEN, 403);
    }
    return colegioId;
}
