import { Resend } from "resend";
import { requireEnv } from "./env";
import { prisma } from "./prisma";

const resend = new Resend(requireEnv("RESEND_API_KEY", 10));
const FROM = requireEnv("EMAIL_FROM", 5);

export async function enviarCodigoVerificacion(
    email: string,
    codigo: string
): Promise<void> {
    const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject: "Código de verificación",
        text: `Tu código de verificación es: ${codigo}\n\nVálido por 15 minutos.`,
    });

    if (result.error) {
        console.error("Resend error:", result.error);
        throw new Error("Error al enviar email de verificación");
    }
}

export async function enviarTokenRecuperacion(
    email: string,
    token: string
): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005";
    const url = `${baseUrl}/recuperar/${token}`;

    const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject: "Restablece tu contraseña",
        text: `Hola,\n\nRecibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente enlace:\n\n${url}\n\nEste enlace expira en 1 hora y solo puede usarse una vez. Si no solicitaste este cambio, ignora este mensaje.`,
    });

    if (result.error) {
        console.error("Resend error:", result.error);
        throw new Error("Error al enviar email de recuperación");
    }
}

async function getAdminEmails(): Promise<string[]> {
    const admins = await prisma.usuario.findMany({
        where: { rol: "ADMIN", estado: "activo" },
        select: { email: true },
    });
    return admins.map((a) => a.email);
}

async function alertasHabilitadas(clave: string): Promise<boolean> {
    const param = await prisma.parametroSistema.findUnique({ where: { clave } });
    return param ? param.valor === "true" : true;
}

export async function enviarAlertaRevision(reporte: {
    id: string;
    numeroSeguimiento: string | null;
    identificador: string;
    estado: string;
}): Promise<void> {
    if (!(await alertasHabilitadas("alerts.admin.enabled"))) return;

    const admins = await getAdminEmails();
    if (admins.length === 0) return;

    const result = await resend.emails.send({
        from: FROM,
        to: admins,
        subject: `Reporte ${reporte.numeroSeguimiento} requiere revisión manual`,
        text: `El reporte ${reporte.numeroSeguimiento} (${reporte.identificador}) requirió revisión manual con estado ${reporte.estado}.\n\nVer en el panel de administración: ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005"}/dashboard/admin`,
    });

    if (result.error) {
        console.error("Resend error:", result.error);
    }
}

export async function enviarAlertaScoreCritico(reporte: {
    id: string;
    identificador: string;
    plataformaId: string;
    score: number;
    nivelRiesgo: string;
}): Promise<void> {
    if (!(await alertasHabilitadas("alerts.critical_score.enabled"))) return;

    const admins = await getAdminEmails();
    if (admins.length === 0) return;

    const plataforma = await prisma.plataforma.findUnique({
        where: { id: reporte.plataformaId },
        select: { nombre: true },
    });

    const result = await resend.emails.send({
        from: FROM,
        to: admins,
        subject: `Score crítico: ${reporte.identificador}`,
        text: `El identificador ${reporte.identificador} en ${plataforma?.nombre ?? reporte.plataformaId} alcanzó un score de ${reporte.score} (${reporte.nivelRiesgo}).\n\nVer en el panel de administración: ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005"}/dashboard/admin`,
    });

    if (result.error) {
        console.error("Resend error:", result.error);
    }
}
