/**
 * SPEC-053 (US3, módulo Autenticación): AutenticacionService.
 * Login con lockout parametrizado, registro, cambio de contraseña, recuperación
 * con token y verificación por código. Las sesiones (createToken/cookie) y la
 * autorización (verifyAuth, roles permitidos) quedan en las rutas; el envío de
 * email queda en su adaptador (`src/lib/email.ts`). Acepta tx opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { generarTokenRecuperacion, hashToken, verificarTokenHash } from "@/lib/token-recuperacion";
import { withUnitOfWork } from "../unit-of-work";
import { UsuarioRepository } from "../repositories/usuario";
import { TokenRecuperacionRepository } from "../repositories/token-recuperacion";
import { CodigoVerificacionRepository } from "../repositories/codigo-verificacion";
import { ParametroRepository } from "../repositories/parametro";
import type {
    ResultadoCambioPassword,
    ResultadoLogin,
    ResultadoRegistro,
    ResultadoRestablecer,
    ResultadoSolicitudCodigo,
    ResultadoSolicitudRecuperacion,
    ResultadoValidacionCodigo,
    ResultadoValidacionToken,
} from "../types/auth";

const LIMITE_SOLICITUDES = 3;
const VENTANA_MS = 60 * 60 * 1000;
const EXPIRACION_TOKEN_MS = 60 * 60 * 1000;
const EXPIRACION_CODIGO_MS = 15 * 60 * 1000;
const MAX_INTENTOS_CODIGO = 5;

function generateCode(): string {
    // E-6: CSPRNG — el código de verificación es un token de seguridad.
    // randomInt(100000, 1000000) ≡ [100000, 999999] uniforme (misma distribución).
    return randomInt(100000, 1000000).toString();
}

export class AutenticacionService {
    private readonly usuarios: UsuarioRepository;
    private readonly tokens: TokenRecuperacionRepository;
    private readonly codigos: CodigoVerificacionRepository;
    private readonly parametros: ParametroRepository;

    constructor(tx?: Prisma.TransactionClient) {
        this.usuarios = new UsuarioRepository(tx);
        this.tokens = new TokenRecuperacionRepository(tx);
        this.codigos = new CodigoVerificacionRepository(tx);
        this.parametros = new ParametroRepository(tx);
    }

    /**
     * POST /api/auth/login — credenciales + lockout parametrizado.
     * La vigencia del cliente (SPEC-119) y la emisión de la sesión quedan en la ruta.
     */
    async login(email: string, password: string): Promise<ResultadoLogin> {
        const user = await this.usuarios.findByEmail(email);
        if (!user) {
            return { ok: false, tipo: "credenciales" };
        }

        if (user.estado === "bloqueado" && user.bloqueadoHasta && user.bloqueadoHasta > new Date()) {
            return { ok: false, tipo: "bloqueada" };
        }

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
            const newAttempts = user.intentosFallidos + 1;
            const maxAttempts = parseInt(
                (await this.parametros.findByClave("security.max_login_attempts"))?.valor || "5",
                10
            );
            const lockoutMinutes = parseInt(
                (await this.parametros.findByClave("security.lockout_duration_minutes"))?.valor || "30",
                10
            );

            const updates: { intentosFallidos: number; estado?: never; bloqueadoHasta?: Date } = {
                intentosFallidos: newAttempts,
            };

            if (newAttempts >= maxAttempts) {
                (updates as Record<string, unknown>).estado = "bloqueado";
                (updates as Record<string, unknown>).bloqueadoHasta = new Date(Date.now() + lockoutMinutes * 60 * 1000);
            }

            await this.usuarios.actualizar(user.id, updates);
            return { ok: false, tipo: "credenciales" };
        }

        // Spec 117 (I-37): una cuenta desactivada por un admin no recupera acceso con
        // la contraseña correcta. Se verifica tras la contraseña para no filtrar
        // existencia/estado de la cuenta.
        if (user.estado === "inactivo") {
            return { ok: false, tipo: "inactiva" };
        }

        await this.usuarios.actualizar(user.id, {
            intentosFallidos: 0,
            estado: "activo",
            bloqueadoHasta: null,
            ultimaSesion: new Date(),
        });

        return {
            ok: true,
            user: {
                id: user.id,
                email: user.email,
                nombre: user.nombre,
                rol: user.rol,
                debeCambiarPassword: user.debeCambiarPassword,
            },
        };
    }

    /** POST /api/auth/register — alta por un admin (rol ya validado en la ruta). */
    async registrar(input: {
        email: string;
        nombre?: string | undefined;
        password: string;
        rol: string;
        tenantId?: string | undefined;
    }): Promise<ResultadoRegistro> {
        const email = input.email.toLowerCase();
        const existing = await this.usuarios.findByEmail(email);
        if (existing) {
            return { ok: false, tipo: "existente" };
        }

        const user = await this.usuarios.crear({
            email,
            nombre: input.nombre || null,
            passwordHash: await hashPassword(input.password),
            rol: input.rol as never,
            tenantId: input.tenantId || null,
        });

        return { ok: true, user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol } };
    }

    /** POST /api/auth/cambiar-password — verifica la actual y guarda el nuevo hash. */
    async cambiarPassword(input: {
        usuarioId: string;
        passwordActual: string;
        passwordNueva: string;
        passwordHashActual: string;
    }): Promise<ResultadoCambioPassword> {
        const valid = await verifyPassword(input.passwordActual, input.passwordHashActual);
        if (!valid) {
            return { ok: false, tipo: "incorrecta" };
        }

        const hash = await hashPassword(input.passwordNueva);
        await this.usuarios.actualizar(input.usuarioId, { passwordHash: hash, debeCambiarPassword: false });
        return { ok: true };
    }

    /**
     * POST /api/auth/recuperar/solicitar — crea el token de recuperación.
     * Devuelve el token en claro para que la RUTA lo envíe por email (adaptador)
     * o lo exponga como devToken si el envío falla.
     */
    async solicitarRecuperacion(email: string): Promise<ResultadoSolicitudRecuperacion> {
        const usuario = await this.usuarios.findByEmail(email);
        if (!usuario) {
            // Email no registrado: respuesta idéntica para evitar enumeración.
            return { ok: true, tipo: "sin_usuario" };
        }

        const desde = new Date(Date.now() - VENTANA_MS);
        const activosRecientes = await this.tokens.countActivosRecientes(email, desde);
        if (activosRecientes >= LIMITE_SOLICITUDES) {
            return { ok: false, tipo: "limite" };
        }

        await this.tokens.invalidarNoUsados(email);

        const token = generarTokenRecuperacion();
        const tokenHash = await hashToken(token);

        await this.tokens.crear({
            email,
            tokenHash,
            expiraEn: new Date(Date.now() + EXPIRACION_TOKEN_MS),
            usuarioId: usuario.id,
        });

        return { ok: true, tipo: "ok", token };
    }

    /** GET /api/auth/recuperar/validar — valida un token por comparación de hash. */
    async validarTokenRecuperacion(token: string): Promise<ResultadoValidacionToken> {
        const tokensActivos = await this.tokens.findActivos();
        for (const tokenRecuperacion of tokensActivos) {
            if (await verificarTokenHash(token, tokenRecuperacion.tokenHash)) {
                return { valido: true, email: tokenRecuperacion.email };
            }
        }
        return { valido: false };
    }

    /** POST /api/auth/recuperar/restablecer — nueva contraseña + token usado (UNA tx, D2). */
    async restablecerPassword(token: string, password: string): Promise<ResultadoRestablecer> {
        const tokensActivos = await this.tokens.findActivosConUsuario();

        let tokenEncontrado: (typeof tokensActivos)[number] | null = null;
        for (const tokenRecuperacion of tokensActivos) {
            if (await verificarTokenHash(token, tokenRecuperacion.tokenHash)) {
                tokenEncontrado = tokenRecuperacion;
                break;
            }
        }

        if (!tokenEncontrado) {
            return { ok: false, tipo: "invalido" };
        }
        if (!tokenEncontrado.usuario) {
            return { ok: false, tipo: "sin_usuario" };
        }

        const passwordHash = await hashPassword(password);
        const usuarioId = tokenEncontrado.usuario.id;
        const tokenId = tokenEncontrado.id;

        await withUnitOfWork(async (tx) => {
            await new UsuarioRepository(tx).actualizar(usuarioId, {
                passwordHash,
                intentosFallidos: 0,
                estado: "activo",
                bloqueadoHasta: null,
                // SPEC-315 (002-PI-215): el reset por email deja al usuario con su clave
                // definitiva elegida en el formulario; se limpia el flag para no mandarlo
                // al guard de /cambiar-password (que pide contraseña actual). Simetría con
                // cambiarPassword() (:157), que ya lo limpia.
                debeCambiarPassword: false,
            });
            await new TokenRecuperacionRepository(tx).marcarUsado(tokenId);
        });

        // SPEC-322: email para aviso. SPEC-318: userId para logAudit USUARIO_CAMBIO_PASSWORD.
        return { ok: true, email: tokenEncontrado.usuario.email, userId: usuarioId };
    }

    /**
     * POST /api/auth/verificar/solicitar — crea el código de verificación.
     * Devuelve el código en claro para que la RUTA lo envíe por email (adaptador)
     * o lo exponga como devCode si el envío falla.
     */
    async solicitarCodigo(email: string): Promise<ResultadoSolicitudCodigo> {
        const existingUser = await this.usuarios.findByEmail(email);
        if (existingUser) {
            return { ok: true, tipo: "existente" };
        }

        const oneHourAgo = new Date(Date.now() - VENTANA_MS);
        const recentCodes = await this.codigos.countRecientes(email, oneHourAgo);
        if (recentCodes >= LIMITE_SOLICITUDES) {
            return { ok: false, tipo: "limite" };
        }

        const code = generateCode();
        const codeHash = await bcrypt.hash(code, 12);

        await this.codigos.crear({
            email,
            codigoHash: codeHash,
            expiraEn: new Date(Date.now() + EXPIRACION_CODIGO_MS),
        });

        return { ok: true, tipo: "ok", code };
    }

    /** POST /api/auth/verificar/validar — valida el código (la ruta emite el token temporal). */
    async validarCodigo(email: string, codigo: string): Promise<ResultadoValidacionCodigo> {
        const codeRecord = await this.codigos.findUltimoNoUsado(email);

        if (!codeRecord || new Date() > codeRecord.expiraEn) {
            return { ok: false, tipo: "expirado" };
        }
        if (codeRecord.intentosFallidos >= MAX_INTENTOS_CODIGO) {
            return { ok: false, tipo: "max_intentos" };
        }

        const valid = await bcrypt.compare(codigo, codeRecord.codigoHash);
        if (!valid) {
            await this.codigos.incrementarIntentos(codeRecord.id);
            return { ok: false, tipo: "incorrecto" };
        }

        await this.codigos.marcarUsado(codeRecord.id);
        return { ok: true };
    }

    /** POST /api/auth/verificar/completar — alta del padre verificado (la ruta emite la sesión). */
    async completarRegistro(email: string, password: string, nombre?: string): Promise<ResultadoRegistro> {
        const existingUser = await this.usuarios.findByEmail(email);
        if (existingUser) {
            return { ok: false, tipo: "existente" };
        }

        const user = await this.usuarios.crear({
            email,
            nombre: nombre || null,
            passwordHash: await hashPassword(password),
            rol: "PARENT",
        });

        return { ok: true, user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol } };
    }
}
