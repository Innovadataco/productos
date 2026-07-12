import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "");

export async function enviarCodigoVerificacion(
    email: string,
    codigo: string
): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
        console.warn("RESEND_API_KEY no configurado, código:", codigo);
        return;
    }

    await resend.emails.send({
        from: "Protección Infantil <no-reply@proteccion.local>",
        to: email,
        subject: "Código de verificación",
        text: `Tu código de verificación es: ${codigo}\n\nVálido por 15 minutos.`,
    });
}