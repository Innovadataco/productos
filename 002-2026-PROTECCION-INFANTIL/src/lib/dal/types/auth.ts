/**
 * SPEC-053 (data-model §1.4): DTOs del agregado Autenticación.
 */

export interface UsuarioSesionDto {
    id: string;
    email: string;
    nombre: string | null;
    rol: string;
    debeCambiarPassword?: boolean;
}

export type ResultadoLogin =
    | { ok: true; user: UsuarioSesionDto }
    | { ok: false; tipo: "credenciales" | "bloqueada" | "inactiva" };

export type ResultadoRegistro =
    | { ok: true; user: UsuarioSesionDto }
    | { ok: false; tipo: "existente" };

export type ResultadoCambioPassword =
    | { ok: true }
    | { ok: false; tipo: "incorrecta" };

export type ResultadoSolicitudRecuperacion =
    | { ok: true; tipo: "ok"; token: string }
    | { ok: true; tipo: "sin_usuario" }
    | { ok: false; tipo: "limite" };

export type ResultadoValidacionToken =
    | { valido: true; email: string }
    | { valido: false };

export type ResultadoRestablecer =
    // SPEC-322: email para aviso de seguridad. SPEC-318: userId para logAudit USUARIO_CAMBIO_PASSWORD.
    | { ok: true; email: string; userId: string }
    | { ok: false; tipo: "invalido" | "sin_usuario" };

export type ResultadoSolicitudCodigo =
    | { ok: true; tipo: "ok"; code: string }
    | { ok: true; tipo: "existente" }
    | { ok: false; tipo: "limite" };

export type ResultadoValidacionCodigo =
    | { ok: true }
    | { ok: false; tipo: "expirado" | "max_intentos" | "incorrecto" };
