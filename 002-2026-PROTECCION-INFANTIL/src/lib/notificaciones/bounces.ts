/**
 * SPEC-201 (D-71): gestión de bounces. Al alcanzar el umbral configurado,
 * el destino se bloquea y se notifica a los administradores.
 */
import { getParametroSistemaValor } from "@/lib/parametros";
import { NotificacionContactoBloqueadoRepository } from "@/lib/dal/repositories/notificacion-contacto-bloqueado";
import { NotificacionRepository } from "@/lib/dal/repositories/notificacion";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";

const repoBloqueado = new NotificacionContactoBloqueadoRepository();
const repoNotif = new NotificacionRepository();
const repoUsuario = new UsuarioRepository();

async function getUmbralBloqueo(): Promise<number> {
    const raw = await getParametroSistemaValor("notificaciones.bounces.umbral_bloqueo");
    const parsed = parseInt(raw ?? "3", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}

async function getAdminEmails(): Promise<string[]> {
    const admins = await repoUsuario.findAdminEmails();
    return admins.map((a) => a.email);
}

/**
 * Registra un bounce para un email. Si se alcanza el umbral, bloquea el
 * destino y encola una notificación interna para admin.
 */
export async function registrarBounce(
    email: string,
    motivo: "hard_bounce" | "buzon_lleno" | "complaint" | string
): Promise<{ bloqueado: boolean; bounceCount: number }> {
    const registro = await repoBloqueado.incrementarBounce(email, motivo);
    const umbral = await getUmbralBloqueo();

    if (registro.bounceCount >= umbral && !(await repoBloqueado.estaBloqueado(email))) {
        // Asegurar fila de bloqueo (incrementarBounce ya la creó, pero la marca
        // notificadoAdminEn puede estar vacía).
        const admins = await getAdminEmails();
        for (const adminEmail of admins) {
            await repoNotif.crear({
                evento: "admin.contacto_bloqueado",
                destinatarioEmail: adminEmail,
                plantillaClave: "admin.contacto_bloqueado.email",
                canal: "EMAIL",
                variables: { email, motivo, bounceCount: registro.bounceCount },
                enviarEn: new Date(),
                estado: "ENCOLADA",
            });
        }
    }

    return { bloqueado: registro.bounceCount >= umbral, bounceCount: registro.bounceCount };
}

/**
 * Indica si un email está bloqueado por bounces reiterados.
 */
export function emailBloqueado(email: string): Promise<boolean> {
    return repoBloqueado.estaBloqueado(email);
}
