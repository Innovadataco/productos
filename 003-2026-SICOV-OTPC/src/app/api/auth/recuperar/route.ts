import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

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
      // STUB: en modo real aquí se enviaría el correo con la clave temporal.
      console.log(`[recuperar][stub] clave temporal generada para usuario=${usuario}`);
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
