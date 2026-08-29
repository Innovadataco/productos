/**
 * SPEC-151 (FR-003): renderiza el informe mensual a buffer usando
 * `@react-pdf/renderer`. Vive en un archivo .tsx para poder usar JSX.
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { formatoFechaLargaBogota } from "@/lib/fechas/formato-bogota";
import { calcularInformeMensual, etiquetaMes, type InformeMensualColegio } from "./informe-mensual";
import { InformeMensualPDF } from "./pdf-informe-mensual";

function fechaGeneracionColombia(): string {
    return formatoFechaLargaBogota(new Date());
}

export async function renderInformeMensualPDF(colegioId: string, mes: string): Promise<{ datos: InformeMensualColegio; buffer: Buffer }> {
    const datos = await calcularInformeMensual(colegioId, mes);
    const buffer = await renderToBuffer(
        <InformeMensualPDF datos={datos} etiquetaMes={etiquetaMes(mes)} generadoEl={fechaGeneracionColombia()} />
    );
    return { datos, buffer };
}
