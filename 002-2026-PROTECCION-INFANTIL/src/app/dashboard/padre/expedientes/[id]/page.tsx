import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { detalleExpedientePadre } from "@/lib/dal/services/expediente-detalle";
import { ExpedienteMadreClient, type ExpedienteMadreDto } from "@/components/modules/padre/ExpedienteMadreClient";

/**
 * SPEC-605 (pantalla madre del EXPEDIENTE): cinco bloques en orden — cabecera
 * con semáforo en lenguaje sencillo · línea de tiempo unificada (propios +
 * otras familias blindadas) · tu evidencia (texto tapado, step-up intacto) ·
 * el análisis con tendencia · acciones con canales oficiales. Diseño aprobado:
 * `design/expediente-final-mockup.html` §2.
 */
export default async function PadreExpedienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;

    if (!token) {
        redirect("/login");
    }

    const payload = await verifyToken(token);
    if (!payload?.sub || payload.rol !== "PARENT") {
        redirect("/login");
    }

    const dto = await detalleExpedientePadre(id, payload.sub as string);
    if (!dto) {
        notFound();
    }

    const detalle: ExpedienteMadreDto = {
        ...dto,
        expediente: {
            ...dto.expediente,
            fechaApertura: dto.expediente.fechaApertura.toISOString(),
            ultimoEventoEn: dto.expediente.ultimoEventoEn?.toISOString() ?? null,
        },
        timeline: dto.timeline.map((t) => ({ ...t, fecha: t.fecha.toISOString() })),
        evidencia: dto.evidencia.map((e) => ({ ...e, fecha: e.fecha.toISOString() })),
        ficha: { ...dto.ficha, abierto: dto.ficha.abierto.toISOString() },
    };

    return (
        <div className="p-4 sm:p-6">
            <ExpedienteMadreClient detalle={detalle} />
        </div>
    );
}
