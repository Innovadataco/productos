/**
 * SPEC-685 (PR2) · GET /api/profesional/catalogos.
 *
 * Devuelve los catálogos cerrados de la ficha (profesión · áreas de atención ·
 * rango etario) tal como los pinta el `<select>`. Salen del parámetro editable
 * por el admin, con fallback al DEFAULT (nunca 500 por parámetro ausente).
 *
 * Solo exige sesión (no rol): lo consume la ficha del profesional y, más
 * adelante, el filtro del directorio (padre). Es taxonomía de producto, no dato
 * reservado — pero no se expone sin autenticar.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { leerCatalogosFicha } from "@/lib/profesional/catalogos-lectura";

export async function GET() {
    try {
        await verifyAuth();
        const catalogos = await leerCatalogosFicha();
        return NextResponse.json({ catalogos });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/CATALOGOS/GET]");
    }
}
