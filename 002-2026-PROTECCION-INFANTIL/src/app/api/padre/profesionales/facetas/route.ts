/**
 * SPEC-392 (L3) · `GET /api/padre/profesionales/facetas` — dropdowns dinámicos.
 *
 * Deriva ciudades y especialidades de los perfiles ACTIVO. Sin catálogo cerrado
 * (especialidades es `text[]` en el schema); derivarlas evita listas fijas que
 * se desincronizan de la data real. Rol PARENT; exenta de vigencia como el resto
 * del directorio.
 *
 * Contrato H-2: NO devuelve ningún dato del profesional en sí — solo los valores
 * que sirven para armar los `<select>` de filtro. El barrido de tests lo firma.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";

export async function GET() {
    try {
        const user = await verifyAuth();
        if (user.rol !== "PARENT") {
            throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
        }
        const repo = new PerfilProfesionalRepository();
        return NextResponse.json(await repo.facetas());
    } catch (error) {
        return errorToResponse(error, "[PADRE/PROFESIONALES/FACETAS]");
    }
}
