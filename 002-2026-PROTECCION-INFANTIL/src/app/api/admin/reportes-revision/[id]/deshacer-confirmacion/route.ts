/**
 * SPEC-557 (I-345) · Deshacer una CONFIRMACIÓN de clasificación.
 *
 * Un clic perdido en «Confirmar clasificación» cambia el estado de la denuncia de
 * un menor y —lo más grave— dispara `actualizarVisibilidadPublica`: puede volver
 * PÚBLICO el reporte. Este endpoint es el rollback real del [Deshacer] del toast.
 *
 * Reglas (decisión CEO):
 *  - (a) SOLO deshace CONFIRMACIONES (`CorreccionAdmin.confirmada === true`). Las
 *    correcciones no se deshacen por acá (arrastran dataset/embedding).
 *  - (b) Puede deshacerlo CUALQUIERA con el módulo, no solo quien confirmó — si el
 *    operador que se equivocó cierra sesión, el reporte no puede quedar atascado
 *    (potencialmente público). Por eso NO se aplica `puedeGestionarReporte`; la
 *    responsabilidad la cubre la auditoría (la transición registra responsableId).
 *  - (c) Precondición de ESTADO, no de reloj: se acepta mientras exista la fila
 *    `confirmada` Y el reporte siga en `CLASIFICADO` (sin transición posterior).
 *    Los 8 s del toast son del cliente. No agrega dependencia del reloj de pared.
 *
 * El CORAZÓN del arreglo es re-correr visibilidad y score para SACAR de público el
 * reporte: si el deshacer lo dejara visible, no serviría de nada.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { idSchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { actualizarVisibilidadPublica } from "@/lib/visibility";
import { recalcularYGuardarScore } from "@/lib/scoring";
import { registrarTransicion, responsableTipoFromRol } from "@/lib/reporte-transiciones";
import { esAdminRol } from "@/lib/operadores/permisos";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";
import { CorreccionAdminRepository } from "@/lib/dal/repositories/correccion-admin";

function requireOperadorOAdmin(user: { rol: string }) {
    if (!esAdminRol(user.rol) && user.rol !== "OPERADOR") {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "bandeja_reportes");
        requireOperadorOAdmin(user);

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas acciones. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
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

        const reporte = await new ReporteRepository().findByIdConClasificacion(id);
        if (!reporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const clasificacion = reporte.clasificacion;
        if (!clasificacion) {
            return NextResponse.json(
                { error: { message: "El reporte no tiene clasificación", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const correcciones = new CorreccionAdminRepository();
        const correccion = await correcciones.findByClasificacionId(clasificacion.id);
        if (!correccion) {
            return NextResponse.json(
                { error: { message: "No hay una confirmación que deshacer", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }
        // (a) solo confirmaciones: una corrección de categoría no se deshace por acá.
        if (!correccion.confirmada) {
            return NextResponse.json(
                { error: { message: "Esto es una corrección, no una confirmación: no se puede deshacer desde aquí", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }
        // (c) precondición de estado: la confirmación llevó el reporte a CLASIFICADO;
        // si ya cambió de estado (otra acción posterior), no hay confirmación reciente
        // que deshacer sin pisar esa acción.
        if (reporte.estado !== "CLASIFICADO") {
            return NextResponse.json(
                { error: { message: "El reporte cambió de estado; la confirmación ya no se puede deshacer", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        // Rollback atómico: revertir estado + BORRAR la fila de confirmación (libera
        // el slot @unique → corregir vuelve a estar disponible; el deshacer NO gasta
        // la única corrección). La transición registra quién deshizo (auditoría).
        const responsableTipo = responsableTipoFromRol(user.rol) ?? "ADMIN";
        await withUnitOfWork(async (tx) => {
            await registrarTransicion({
                reporteId: id,
                estadoAnterior: "CLASIFICADO",
                estadoNuevo: "REVISION_MANUAL",
                responsableTipo,
                responsableId: user.id,
                motivo: "Confirmación deshecha por operador/admin",
                tx,
            });
            await new ReporteRepository(tx).actualizarEstado(id, { estado: "REVISION_MANUAL" });
            await new CorreccionAdminRepository(tx).eliminarPorClasificacionId(clasificacion.id);
        });

        // EL CORAZÓN: SACAR de público el reporte (la confirmación lo pudo haber
        // vuelto visible). ORDEN clave: primero recalcular el score —que reescribe
        // `reportesAprobados` en el agregado ahora que el reporte ya NO está
        // aprobado— y DESPUÉS visibilidad, que LEE ese conteo. Al revés (como en el
        // confirm) leería el agregado viejo y podría dejar el reporte visible, que
        // es justo lo que este endpoint existe para impedir.
        const scoreResult = await recalcularYGuardarScore(reporte.identificador, reporte.plataformaId);
        await actualizarVisibilidadPublica(reporte.identificador, reporte.plataformaId);

        return NextResponse.json({
            reporteId: id,
            estado: "REVISION_MANUAL",
            score: scoreResult.score,
            nivelRiesgo: scoreResult.nivelRiesgo,
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
