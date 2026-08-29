/**
 * SPEC-291 (002-PI-191) — POST /api/admin/servicios/<nombre>/start
 * Requiere permiso sistema_admin + header X-Confirm-Action: yes.
 * Audit: LOGS_MANTENIMIENTO_PURGA + metadatos.tipo="servicio_start".
 */
import { handlerAccionServicio } from "@/lib/servicios/api-accion";

export async function POST(request: Request, { params }: { params: Promise<{ nombre: string }> }) {
    return handlerAccionServicio(request, "start", params);
}
