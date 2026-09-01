/**
 * SPEC-344 (A-69 · C1) — POST /api/auth/registro-colegio/completar.
 *
 * El rector abrió el enlace y eligió su contraseña. Acá:
 *  1. Se valida el token (RegistroEnlaceService.validarEnlace, no consume).
 *  2. Se crea Tenant + Colegio + Usuario(SCHOOL_ADMIN) + 15 materias + 11
 *     cursos por defecto en la misma withUnitOfWork (registrarPublico).
 *  3. Se marca el token como usado.
 *  4. Se emite la sesión, se sella `sesion_estado` (para caer directo en el
 *     Paso 1 del camino sin pasar por el rebote).
 *  5. Se envía la bienvenida.
 */
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { createToken, setSessionCookie } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { registroColegioCompletarSchema } from "@/lib/validators";
import { RegistroEnlaceService } from "@/lib/dal/services/registro-enlace";
import { RegistroColegioService } from "@/lib/dal/services/registro-colegio";
import { TokenRegistroRepository } from "@/lib/dal/repositories/token-registro";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { sellarCookieSesionEstado } from "@/lib/routing/sellar-sesion-estado";
import { enviarBienvenidaRector } from "@/lib/email-colegio";

type ResultadoRegistrar = Awaited<ReturnType<RegistroColegioService["registrarPublico"]>>;

function mapearErrorRegistrarPublico(resultado: ResultadoRegistrar): NextResponse | null {
    if (resultado.ok) return null;
    if (resultado.tipo === "existente") {
        return NextResponse.json(
            { error: { message: "Este correo ya tiene una cuenta. Ingrese con su correo y clave.", code: ERROR_CODES.CONFLICT } },
            { status: 409 },
        );
    }
    if (resultado.tipo === "nit_existente") {
        return NextResponse.json(
            { error: { message: "Este NIT ya está registrado con otro correo. Contáctenos.", code: ERROR_CODES.CONFLICT } },
            { status: 409 },
        );
    }
    return NextResponse.json(
        { error: { message: "No pudimos crear la cuenta. Intente más tarde.", code: ERROR_CODES.INTERNAL_ERROR } },
        { status: 500 },
    );
}

export async function POST(request: Request) {
    try {
        const rate = await checkRateLimit(request, "register");
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiados intentos. Intente más tarde.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers },
            );
        }

        const bodyRaw = await request.json().catch(() => undefined);
        const parsed = registroColegioCompletarSchema.safeParse(bodyRaw);
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
        const { token, password } = parsed.data;

        // 1) Validar el token (sin consumirlo): sirve para extraer el email y
        // confirmar que sigue vivo. Si el token es del padre, no permitimos
        // completar por esta ruta (candado de rol — el token trae rol propio).
        const enlace = new RegistroEnlaceService();
        const check = await enlace.validarEnlace(token);
        if (!check.valido || !check.email) {
            return NextResponse.json(
                { error: { message: "Este enlace ya no sirve. Pida uno nuevo y se lo enviamos al correo.", code: ERROR_CODES.AUTH_EXPIRED } },
                { status: 410 },
            );
        }
        const emailLower = check.email.toLowerCase();

        // 1.b) Verificar el rol del token: SPEC-344 exige que el enlace se haya
        // pedido por el flujo del colegio. Un token de PARENT no puede
        // consumirse por acá (candado de aislamiento por rol).
        const tokensRepo = new TokenRegistroRepository();
        const tokenActivo = (await tokensRepo.findActivos()).find(
            (t) => t.email.toLowerCase() === emailLower,
        );
        if (!tokenActivo || tokenActivo.rol !== "SCHOOL_ADMIN") {
            return NextResponse.json(
                { error: { message: "Este enlace no corresponde al registro de colegio.", code: ERROR_CODES.CONFLICT } },
                { status: 409 },
            );
        }
        // El nombre del colegio y el NIT viajan en el token, no en el body.
        // Sin ellos el token no es utilizable (garantía del solicitar).
        const nombreColegio = tokenActivo.nombreColegio;
        const nit = tokenActivo.nit;
        if (!nombreColegio || !nit) {
            return NextResponse.json(
                { error: { message: "Este enlace no incluye los datos del colegio. Pida uno nuevo.", code: ERROR_CODES.AUTH_EXPIRED } },
                { status: 410 },
            );
        }

        // 2) Crear Tenant + Colegio + Usuario. El servicio ya siembra 11
        // cursos por defecto (D-5) + 15 materias (SPEC existente) dentro de
        // la misma withUnitOfWork.
        const service = new RegistroColegioService();
        const resultado = await service.registrarPublico(
            emailLower,
            password,
            /* nombreRector */ emailLower.split("@")[0], // provisional; el Paso 1 del camino lo reemplaza
            nombreColegio,
            nit,
        );

        const errorPublico = mapearErrorRegistrarPublico(resultado);
        if (errorPublico) return errorPublico;

        // 3) Marcar el token como usado (single-use). Si esta línea falla el
        // token queda vivo un rato más, pero la cuenta ya existe y el próximo
        // intento fallará en el paso "email_existente" con 409.
        try {
            await tokensRepo.marcarUsado(tokenActivo.id);
        } catch (err) {
            logger.error(
                `[REGISTRO-COL] Falla marcando token usado tras crear cuenta — email=${emailLower}: ${err instanceof Error ? err.message : String(err)}`,
            );
        }

        // 4) Sesión + sellado de cookie de estado.
        const usuarioCreado = await new UsuarioRepository().findByEmail(emailLower);
        if (!usuarioCreado) {
            // Nunca debería pasar: la creación fue exitosa unos ms antes.
            return NextResponse.json(
                { error: { message: "Error interno tras crear la cuenta.", code: ERROR_CODES.INTERNAL_ERROR } },
                { status: 500 },
            );
        }

        const sessionToken = await createToken({ sub: usuarioCreado.id, rol: usuarioCreado.rol });
        await setSessionCookie(request, sessionToken);

        const res = NextResponse.json(
            {
                user: { id: usuarioCreado.id, email: usuarioCreado.email, rol: usuarioCreado.rol },
                redirectTo: "/camino/colegio/rector",
            },
            { status: 201 },
        );

        await sellarCookieSesionEstado(res, usuarioCreado.id);

        // 5) Bienvenida (cortesía, fallo silencioso).
        try {
            await enviarBienvenidaRector(usuarioCreado.email, nombreColegio);
        } catch (err) {
            logger.error(
                `[REGISTRO-COL] Bienvenida: envío fallido — ${err instanceof Error ? err.message : String(err)}`,
            );
        }

        return res;
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
