/**
 * SPEC-340 (§3.3-bis) · S-C (D-116/D-117): el texto de TRABAJO del reporte PROPIO,
 * descifrado. La AUTORIDAD (step-up / sesión joven) la valida la ruta ANTES de
 * llamar; acá el gate de TITULARIDAD vive en el `where` (usuarioId + no eliminado)
 * y el descifrado sale por el único camino central (`descifrarCampo`, fail-loud).
 *
 * SPEC-653 (I-385): se retiraron `hechosDelExpediente` (ya estaba muerta: cero
 * llamadores) y `lecturaDelExpediente` (su ruta `/api/padre/expedientes/[id]/lectura`
 * quedó sin consumidor al borrarse la pantalla `ExpedienteVivo`). Una ruta viva sin
 * consumidor es superficie de ataque; se borró con su servicio. Queda solo el texto
 * propio, vivo vía `/api/padre/reportes/[id]/texto` (TextoSensible).
 */
import { prisma } from "../../prisma";
import { descifrarCampo } from "../../reporte-texto-contenido";

export async function textoDeReportePropio(usuarioId: string, reporteId: string): Promise<string | null> {
    const reporte = await prisma.reporte.findFirst({
        where: { id: reporteId, usuarioId, eliminado: false },
        select: { contenidoId: true },
    });
    if (!reporte) return null;
    return descifrarCampo(prisma, reporte.contenidoId, "texto");
}
