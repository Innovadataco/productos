import { Resend } from "resend";
import { requireEnv } from "./env";

const resend = new Resend(requireEnv("RESEND_API_KEY", 10));

export async function enviarCodigoVerificacion(
    email: string,
    codigo: string
): Promise<void> {
    await resend.emails.send({
        from: "Protección Infantil <no-reply@proteccion.local>",
        to: email,
        subject: "Código de verificación",
        text: `Tu código de verificación es: ${codigo}\n\nVálido por 15 minutos.`,
    });
}