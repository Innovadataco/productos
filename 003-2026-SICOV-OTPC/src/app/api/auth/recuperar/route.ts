import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getCorreo } from "@/lib/correo/correo";

/// Genera una clave temporal y (en modo real) la enviaría por correo. En P1 el envío de correo
/// queda tras interfaz stub. Respuesta genérica: no revela si el usuario existe.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { usuario?: string; correo?: string };
    const usuario = body.usuario?.trim();
    const correo = body.correo?.trim();
    if (!usuario || !correo) {
      throw new AppError("Usuario y correo son requeridos", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const u = await prisma.usuario.findFirst({ where: { usuario } });
    if (u && u.correo && u.correo.toLowerCase() === correo.toLowerCase()) {
      const temporal = generarClaveTemporal();
      await prisma.usuario.update({
        where: { id: u.id },
        data: { clave: await hashPassword(temporal), claveTemporal: true, actualizacion: new Date() },
      });
      // Interfaz única de correo (D-048): con RESEND_API_KEY sale real; sin ella cae a stub/log.
      // Un fallo de envío NO altera la respuesta genérica (no se filtra existencia del usuario).
      await getCorreo().enviarCorreo({
        para: u.correo,
        asunto: "Recuperación de clave — SICOV-OTPC",
        texto: `Su clave temporal es: ${temporal}\nDeberá cambiarla al iniciar sesión.`,
      });
    }

    // Siempre respuesta genérica.
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

function generarClaveTemporal(): string {
  // Cumple la política: mayúscula, minúscula, dígito, símbolo, ≥8.
  const rnd = Math.floor(Date.now() % 1_000_000);
  return `Sic0v-${rnd}!`;
}
