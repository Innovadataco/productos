/**
 * SPEC-344 (A-69 · C1) — POST /api/auth/registro-colegio/solicitar.
 *
 * El rector deja correo + nombre del colegio + NIT y recibe un ENLACE (no un
 * código que transcribe). Reemplaza al flujo de código de 6 dígitos que existía
 * en /api/auth/verificar/* para el registro de colegio.
 *
 * ANTI-ENUMERACIÓN POR AMBAS DIMENSIONES (matiz CEO 03:18, patrón SPEC-338
 * extendido). Las cuatro combinaciones dan la MISMA respuesta 202 con el mismo
 * `MENSAJE_EXITO`:
 *   correo nuevo + NIT nuevo    → enlace al buzón nuevo
 *   correo YA existe            → aviso "cuenta_existente" al buzón existente
 *   NIT YA existe               → aviso "nit_ya_registrado" al buzón del rector dueño
 *   ambos YA existen            → aviso "cuenta_existente" al buzón existente
 * El aviso viaja SOLO al buzón; la pantalla nunca revela cuál condición se dio.
 */
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { registroColegioSolicitarSchema } from "@/lib/validators";
import {
    enviarEnlaceRegistroColegio,
    enviarCuentaExistenteColegio,
    enviarNitYaRegistradoColegio,
} from "@/lib/email-colegio";
import { RegistroEnlaceService } from "@/lib/dal/services/registro-enlace";
import { ColegioRepository } from "@/lib/dal/repositories/colegio";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";

const MENSAJE_EXITO =
    "Si los datos son correctos, le enviamos un enlace a su correo para crear la contraseña.";

function maskEmail(email: string): string {
    return email.replace(/^(.{1})(.*)(@.*)$/, "$1***$3");
}

export async function POST(request: Request) {
    try {
        const bodyRaw = await request.json().catch(() => undefined);
        const parsed = registroColegioSolicitarSchema.safeParse(bodyRaw);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: {
                        message: parsed.error.issues[0]?.message ?? "Datos inválidos",
                        code: ERROR_CODES.VALIDATION_ERROR,
                    },
                },
                { status: 400 },
            );
        }
        const { email, nombreColegio, nit } = parsed.data;

        // Mismos límites que el registro por enlace del padre.
        const rateIp = await checkRateLimit(request, "verificacion_solicitar");
        if (!rateIp.allowed) {
            return NextResponse.json(
                {
                    message: MENSAJE_EXITO,
                    error: { message: "Demasiadas solicitudes. Intente más tarde.", code: ERROR_CODES.RATE_LIMITED },
                },
                { status: 429, headers: rateIp.headers },
            );
        }
        const rateEmail = await checkRateLimit(request, "verificacion_solicitar", { identifier: email });
        if (!rateEmail.allowed) {
            return NextResponse.json(
                {
                    message: MENSAJE_EXITO,
                    error: { message: "Demasiadas solicitudes. Intente más tarde.", code: ERROR_CODES.RATE_LIMITED },
                },
                { status: 429, headers: rateEmail.headers },
            );
        }

        // Lookup anti-enum: correo y NIT en paralelo. La pantalla NUNCA sabrá
        // cuál de las cuatro combinaciones se cumplió.
        const [usuarioExistente, colegioExistente] = await Promise.all([
            new UsuarioRepository().findByEmail(email),
            new ColegioRepository().buscarPorNit(nit),
        ]);

        // Caso A · correo YA existe (con o sin NIT registrado): aviso al buzón
        // del correo registrado, sin crear ni tocar tokens.
        if (usuarioExistente) {
            try {
                await enviarCuentaExistenteColegio(email, nombreColegio);
            } catch {
                logger.error(`[REGISTRO-COL] Aviso cuenta-existente: envío fallido — ${maskEmail(email)}`);
            }
            return NextResponse.json({ message: MENSAJE_EXITO }, { status: 202 });
        }

        // Caso B · correo NUEVO pero NIT YA existe: aviso al correo del rector
        // dueño del NIT (para que sepa que alguien intentó registrar su colegio
        // desde otro correo). Sin crear tokens.
        if (colegioExistente) {
            const emailRector = colegioExistente.representanteLegalEmail;
            try {
                await enviarNitYaRegistradoColegio(emailRector, nit);
            } catch {
                logger.error(`[REGISTRO-COL] Aviso NIT-ya-registrado: envío fallido — NIT=${nit}`);
            }
            return NextResponse.json({ message: MENSAJE_EXITO }, { status: 202 });
        }

        // Caso C · correo NUEVO y NIT NUEVO: creamos el token con rol
        // SCHOOL_ADMIN y enviamos el enlace real.
        const resultado = await new RegistroEnlaceService().solicitarEnlace(email, "SCHOOL_ADMIN", { nombreColegio, nit });

        if (!resultado.ok) {
            // Límite de enlaces vivos por email: se mantiene la misma
            // respuesta neutra, con un código de rate-limit.
            return NextResponse.json(
                { error: { message: "Límite de solicitudes excedido", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429 },
            );
        }

        // El servicio ya devolvió `existente` en su rama interna; acá siempre
        // cae en tipo "ok" (usuarioExistente ya se descartó arriba).
        if (resultado.tipo !== "ok") {
            return NextResponse.json({ message: MENSAJE_EXITO }, { status: 202 });
        }

        try {
            await enviarEnlaceRegistroColegio(email, resultado.token, nombreColegio);
        } catch (err) {
            logger.error(
                `[REGISTRO-COL] Envío del enlace: fallido — ${maskEmail(email)}: ${err instanceof Error ? err.message : String(err)}`,
            );
        }

        return NextResponse.json({ message: MENSAJE_EXITO }, { status: 202 });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 },
        );
    }
}
