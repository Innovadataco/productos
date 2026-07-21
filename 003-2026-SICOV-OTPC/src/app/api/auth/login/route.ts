import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createToken, setSessionCookie } from "@/lib/auth";
import { cargarModulos } from "@/lib/modulos";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { envBool } from "@/lib/env";

const MAX_INTENTOS = 3;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { usuario?: string; contrasena?: string };
    const usuario = body.usuario?.trim();
    const contrasena = body.contrasena;
    if (!usuario || !contrasena) {
      throw new AppError("Usuario y contraseña son requeridos", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const u = await prisma.usuario.findFirst({ where: { usuario } });
    // Mensaje genérico ante usuario inexistente o clave errada (no revelar cuál falló).
    const credInvalidas = new AppError(
      "Usuario o clave incorrectos",
      ERROR_CODES.AUTH_INVALID,
      401,
    );
    if (!u) throw credInvalidas;
    if (u.estado !== true) {
      throw new AppError("Usuario inactivo, contacte al administrador.", ERROR_CODES.FORBIDDEN, 403);
    }

    const bloqueoActivo = envBool("BLOQUEO_CREDENCIALES", false);
    const identificacion = u.identificacion ?? u.usuario ?? "";
    if (bloqueoActivo) {
      const reg = await prisma.bloqueoUsuario.findUnique({ where: { identificacion } });
      if (reg?.bloqueado) {
        throw new AppError(
          "El usuario se encuentra bloqueado por exceder el número de intentos de inicio de sesión",
          ERROR_CODES.LOCKED,
          423,
        );
      }
    }

    const ok = await verifyPassword(contrasena, u.clave ?? "");
    if (!ok) {
      if (bloqueoActivo) await registrarIntentoFallido(identificacion);
      throw credInvalidas;
    }

    if (bloqueoActivo) {
      await prisma.bloqueoUsuario.updateMany({
        where: { identificacion },
        data: { intentosFallidos: 0, bloqueado: false, actualizacion: new Date() },
      });
    }

    // NIT efectivo: subusuario (rol 3) hereda la identificación del administrador.
    const nitEfectivo =
      u.rolId === 3 && u.administradorId != null
        ? String(u.administradorId)
        : String(u.identificacion ?? "");

    const token = await createToken({ sub: u.id, rol: u.rolId ?? 0, nit: nitEfectivo });
    await setSessionCookie(token);

    const modulos = await cargarModulos(u.id, u.rolId ?? null);

    return NextResponse.json({
      usuario: {
        id: u.id,
        nombre: u.nombre,
        usuario: u.usuario,
        rol: u.rolId,
        identificacion: u.identificacion,
      },
      claveTemporal: u.claveTemporal === true,
      modulos,
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(err.toJSON(), { status: err.statusCode });
    }
    // Bug 3: un error interno NO debe traducirse en "login demo"; se reporta como 500 real.
    console.error("[Auth] Error en login:", safeErrorMessage(err));
    return NextResponse.json(
      { error: "Error interno del servidor", code: ERROR_CODES.INTERNAL_ERROR },
      { status: 500 },
    );
  }
}

async function registrarIntentoFallido(identificacion: string): Promise<void> {
  const reg = await prisma.bloqueoUsuario.findUnique({ where: { identificacion } });
  if (!reg) {
    await prisma.bloqueoUsuario.create({
      data: { identificacion, intentosFallidos: 1, bloqueado: false, ultimoIntento: new Date() },
    });
    return;
  }
  const intentos = (reg.intentosFallidos ?? 0) + 1;
  await prisma.bloqueoUsuario.update({
    where: { identificacion },
    data: {
      intentosFallidos: intentos,
      bloqueado: intentos >= MAX_INTENTOS,
      ultimoIntento: new Date(),
      actualizacion: new Date(),
    },
  });
}
