import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertAnyModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { idSchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol, esComiteRol, puedeGestionarReporte } from "@/lib/operadores/permisos";
import { esEstadoCargaOperador } from "@/lib/operadores/estados";
import { conActor, actorDesdeRequest } from "@/lib/auditoria-lectura/actor";
import { descifrarCampoReporte } from "@/lib/dal/services/descifrar-contenido";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";
import { ENUM_A_FRANJA } from "@/lib/reportes/franja-enum";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        // SPEC-384 · I-278: `bandeja_reportes` (operador/admin) O
        // `comite_bandeja` (comité) — nunca sustituir, para no romper la
        // separación de poderes de I-274. La autorización fina por caso queda
        // intacta más abajo (rama `comiteId`).
        await assertAnyModulo(user, ["bandeja_reportes", "comite_bandeja"]);
        if (!esAdminRol(user.rol) && user.rol !== "OPERADOR" && !esComiteRol(user.rol)) {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id: rawId } = await params;
        const parsedId = idSchema.safeParse(rawId);
        if (!parsedId.success) {
            return NextResponse.json(
                { error: { message: "ID inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const id = parsedId.data;

        // E-8: las lecturas viven en el repo; la ruta no toca prisma.
        const permisosReporte = await new ReporteRepository().findPermisosRevision(id);

        if (!permisosReporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (user.rol === "COMITE_VALIDACION" && permisosReporte.comiteId !== user.id) {
            return NextResponse.json(
                { error: { message: "No tiene permiso para ver este caso", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        if (user.rol !== "COMITE_VALIDACION" && !puedeGestionarReporte(user, permisosReporte)) {
            return NextResponse.json(
                { error: { message: "No tiene permiso para ver este caso", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        // SPEC-734 (seguridad): el relato NO viaja en la carga por defecto. Se
        // descifra y se envía SOLO con `?revelar=true`; ese descifrado, por la
        // frontera auditada (conActor + descifrarCampoReporte), DEJA FILA en
        // LecturaReporte a nombre de quien reveló. Sin `revelar`: `texto: null` (la
        // UI pinta el marcador), sin descifrar y SIN fila.
        //
        // Refina —no revierte— el invariante de SPEC-701 (I-421): «no se ve el relato
        // sin dejar fila» sigue en pie (ver el texto exige revelar, y revelar escribe
        // la fila); lo único que cambia es que ABRIR el caso sin revelar ya no escribe
        // fila, porque no se vio el texto. El rastro pasa de «cada apertura» a «acto
        // deliberado de revelar».
        const revelar = new URL(request.url).searchParams.get("revelar") === "true";
        const reporteDetalle = await conActor(actorDesdeRequest(user, request), async () => {
            const detalle = await new ReporteRepository().findDetalleRevision(id);
            if (!detalle) return null;
            // SPEC-130 (BL-4, O-2): el texto sale descifrado SOLO por este camino
            // autorizado y SOLO al revelar; purgado → marcador tal cual.
            const texto = revelar ? await descifrarCampoReporte(detalle.contenidoId, "texto") : null;
            // SPEC-644: enum persistido → franja de dominio (server-side, como en la
            // capa de análisis) para que el detalle muestre lo GUARDADO, no la derivada.
            const franja = detalle.franjaHoraria ? ENUM_A_FRANJA[detalle.franjaHoraria] : null;
            return { ...detalle, texto, franja };
        });

        if (!reporteDetalle) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        return NextResponse.json({
            reporte: reporteDetalle,
            puedeRevelarOriginal: esAdminRol(user.rol) || user.rol === "OPERADOR" || esComiteRol(user.rol),
            puedeEscalar: (user.rol === "OPERADOR" && reporteDetalle.operador?.id === user.id && esEstadoCargaOperador(reporteDetalle.estado)) || esAdminRol(user.rol),
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
