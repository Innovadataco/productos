import { notFound } from "next/navigation";
import { exigirPadre } from "@/lib/padre/guardia-padre";
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
    const usuario = await exigirPadre(); // SPEC-711: compuerta por rol (rol ≠ PARENT → su área)

    const dto = await detalleExpedientePadre(id, usuario.id);
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
