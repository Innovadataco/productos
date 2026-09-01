/**
 * SPEC-339 (A-67 §2.1) — el enlace de registro del padre.
 *
 * Reemplaza al código de 6 dígitos SOLO para el padre: el registro de colegio
 * sigue usando `CodigoVerificacion` y sus tres rutas, intactos.
 *
 * Seguridad, mismo contrato que la recuperación de contraseña (SPEC-053):
 *  - del token se guarda SOLO el hash (bcrypt); el valor en claro viaja en el
 *    enlace del correo y nunca se persiste,
 *  - un solo uso, vence en 24 horas (brief §2.1), un enlace vivo por correo,
 *  - anti-enumeración (SPEC-338): pedir el enlace con un correo que YA tiene
 *    cuenta devuelve el MISMO resultado hacia la pantalla; el aviso va al buzón.
 */
import { hashPassword } from "@/lib/auth";
import {
    generarTokenRecuperacion as generarToken,
    hashToken,
    verificarTokenHash,
} from "@/lib/token-recuperacion";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { TokenRegistroRepository } from "@/lib/dal/repositories/token-registro";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import type { RolUsuario } from "@prisma/client";

/** 24 horas (brief §2.1). La recuperación usa 1 h; este enlace es la puerta de
 *  entrada de un padre que quizá abre el correo por la noche: se le da el día. */
const EXPIRACION_ENLACE_MS = 24 * 60 * 60 * 1000;
/** Mismo tope que la recuperación: 3 solicitudes vivas por hora. */
const VENTANA_MS = 60 * 60 * 1000;
const LIMITE_SOLICITUDES = 3;

export type ResultadoSolicitudEnlace =
    | { ok: true; tipo: "ok"; token: string }
    | { ok: true; tipo: "existente" }
    | { ok: false; tipo: "limite" };

export type ResultadoCompletarEnlace =
    | { ok: true; user: { id: string; email: string; nombre: string | null; rol: string } }
    | { ok: false; tipo: "invalido" | "usado" | "vencido" | "email_existente" | "rol_incorrecto" };

export class RegistroEnlaceService {
    private readonly tokens = new TokenRegistroRepository();
    private readonly usuarios = new UsuarioRepository();

    /**
     * Crea el enlace. Devuelve el token EN CLARO para que la ruta lo mande por
     * correo (adaptador); acá no se envía nada.
     *
     * SPEC-344 (A-69 · C1): el parámetro `rol` parametriza para qué tipo de
     * cuenta se emite el token (default `PARENT`, para retrocompatibilidad con
     * los callers de SPEC-339). El completar fuerza el rol guardado en el
     * token, no confía en el cliente.
     */
    async solicitarEnlace(
        email: string,
        rol: RolUsuario = "PARENT",
        extras?: { nombreColegio?: string; nit?: string },
    ): Promise<ResultadoSolicitudEnlace> {
        const existente = await this.usuarios.findByEmail(email);
        if (existente) {
            // La ruta manda el aviso "ya tienes una cuenta" (SPEC-338) y responde
            // a la pantalla EXACTAMENTE igual que en el caso nuevo.
            return { ok: true, tipo: "existente" };
        }

        const desde = new Date(Date.now() - VENTANA_MS);
        if ((await this.tokens.countActivosRecientes(email, desde)) >= LIMITE_SOLICITUDES) {
            return { ok: false, tipo: "limite" };
        }

        await this.tokens.invalidarNoUsados(email);

        const token = generarToken();
        await this.tokens.crear({
            email,
            tokenHash: await hashToken(token),
            expiraEn: new Date(Date.now() + EXPIRACION_ENLACE_MS),
            rol,
            nombreColegio: extras?.nombreColegio ?? null,
            nit: extras?.nit ?? null,
        });

        return { ok: true, tipo: "ok", token };
    }

    /**
     * Valida el enlace sin consumirlo — para que la pantalla de crear clave
     * pueda decir "este enlace ya se usó / venció" ANTES de pedir la contraseña.
     */
    async validarEnlace(token: string): Promise<{ valido: boolean; email?: string }> {
        for (const registro of await this.tokens.findActivos()) {
            if (await verificarTokenHash(token, registro.tokenHash)) {
                return { valido: true, email: registro.email };
            }
        }
        return { valido: false };
    }

    /**
     * Consume el enlace y crea la cuenta del padre, en UNA transacción.
     * La ruta emite la sesión, sella la cookie de estado y manda la bienvenida.
     */
    async completar(
        token: string,
        password: string,
        // SPEC-344 (candado espejo · OBS-1 auditoría #222): cada flujo consume
        // SOLO tokens de su rol. Un token SCHOOL_ADMIN por la ruta del padre
        // crearía un rector sin colegio y quemaría el correo.
        rolEsperado: RolUsuario = "PARENT",
    ): Promise<ResultadoCompletarEnlace> {
        // Buscar el token entre los activos (comparación de hash, como recuperar).
        let encontrado: Awaited<ReturnType<TokenRegistroRepository["findActivos"]>>[number] | null = null;
        for (const registro of await this.tokens.findActivos()) {
            if (await verificarTokenHash(token, registro.tokenHash)) {
                encontrado = registro;
                break;
            }
        }

        if (!encontrado) {
            // Distinguir "usado" y "vencido" de "nunca existió" exige conocer el
            // email, y el token no lo trae. Se responde el genérico; la pantalla
            // ofrece pedir un enlace nuevo en los tres casos.
            return { ok: false, tipo: "invalido" };
        }

        // Candado espejo: el rol del token debe ser el del flujo que lo consume.
        // NO se consume el token — el enlace sigue vivo para su flujo correcto.
        if ((encontrado.rol ?? "PARENT") !== rolEsperado) {
            return { ok: false, tipo: "rol_incorrecto" };
        }

        // Carrera posible: el mismo enlace abierto en dos pestañas/aparatos, o la
        // cuenta creada por un administrador entre pedir y abrir. El unique de
        // email en la BD es el árbitro final; esto es el error amable.
        const yaExiste = await this.usuarios.findByEmail(encontrado.email);
        if (yaExiste) {
            return { ok: false, tipo: "email_existente" };
        }

        const passwordHash = await hashPassword(password);
        const tokenId = encontrado.id;
        const email = encontrado.email;

        // SPEC-344: el rol vive en el token (aditivo). Si el token no lo trae
        // (registros previos a la migración) → PARENT por default, coherente
        // con el uso original de SPEC-339.
        const rolAcuenta: RolUsuario = encontrado.rol ?? "PARENT";

        const user = await withUnitOfWork(async (tx) => {
            const creado = await new UsuarioRepository(tx).crear({
                email,
                nombre: null,
                passwordHash,
                rol: rolAcuenta,
            });
            await new TokenRegistroRepository(tx).marcarUsado(tokenId);
            return creado;
        });

        return {
            ok: true,
            user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol },
        };
    }
}
