import { Resend } from "resend";
import { requireEnv } from "./env";

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