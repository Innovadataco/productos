import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth, verifyPassword, hashPassword, validarPassword } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

export async function POST(req: Request) {
  try {
    const u = await verifyAuth();
    const body = (await req.json().catch(() => ({}))) as {
      claveActual?: string;
      nuevaClave?: string;
    };
    const { claveActual, nuevaClave } = body;
    if (!claveActual || !nuevaClave) {
      throw new AppError("Clave actual y nueva son requeridas", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    const ok = await verifyPassword(claveActual, u.clave ?? "");
    if (!ok) {
      throw new AppError("La clave actual no es correcta", ERROR_CODES.AUTH_INVALID, 401);
    }
    if (!validarPassword(nuevaClave)) {
      throw new AppError(
        "La nueva clave no cumple la política (mín. 8, mayúscula, minúscula, dígito y símbolo)",
        ERROR_CODES.VALIDATION_ERROR,
        400,
      );
    }
    const hash = await hashPassword(nuevaClave);
    await prisma.usuario.update({
      where: { id: u.id },
      data: { clave: hash, claveTemporal: false, actualizacion: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
