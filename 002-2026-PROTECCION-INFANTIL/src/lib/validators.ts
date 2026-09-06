import { z } from "zod";
import { CategoriaConducta, EstadoReporte, AccionAudit, MotivoBajaReporte } from "@prisma/client";

const motivosBaja = Object.values(MotivoBajaReporte) as [string, ...string[]];
export const darDeBajaReporteSchema = z.object({
    motivo: z.enum(motivosBaja),
    nota: z.string().min(1).max(2000),
});
export type DarDeBajaReporteInput = z.infer<typeof darDeBajaReporteSchema>;

export const reactivarReporteSchema = z.object({
    nota: z.string().min(1).max(2000),
});
export type ReactivarReporteInput = z.infer<typeof reactivarReporteSchema>;

// SPEC-513 (PA-21): la cota de FUTURO de la fecha del hecho vive en UN solo
// lugar. Cualquier endpoint que reciba `fechaIncidente` reusa ESTO — no copia la
// línea: un `z.string().refine(Date.parse)` suelto en el evento derivó y aceptaba
// fecha futura. El cliente manda ISO completo (`new Date(valorLocal).toISOString()`),
// por eso `.datetime()` estricto lo acepta.
export const fechaIncidenteSchema = z.string().datetime().refine(
    (val) => new Date(val) <= new Date(),
    { message: "La fecha del incidente no puede ser futura" },
);
export type FechaIncidenteInput = z.infer<typeof fechaIncidenteSchema>;

export const crearReporteSchema = z.object({
    identificador: z.string().min(3).max(100),
    plataforma: z.string().min(1),
    // La longitud mínima efectiva se valida en la route desde ParametroSistema
    // (reportes.spam.min_text_length, spec 092-US5); aquí solo se exige no vacío.
    texto: z.string().min(1).max(5000),
    // SPEC-438 (I-305): obligatoria y nunca rellenada por el sistema. El
    // cliente ya no manda `new Date()` cuando el campo está vacío: si no hay
    // dato, no se envía y el reporte no sale.
    fechaIncidente: fechaIncidenteSchema,
    /**
     * SPEC-438: `true` cuando el reportante eligió una FRANJA (madrugada,
     * mañana, tarde, noche) en vez de recordar la hora exacta. El análisis
     * necesita poder distinguir una hora precisa de una estimada.
     */
    horaAproximada: z.boolean().optional(),
    ciudad: z.string().min(1).max(100),
    pais: z.string().min(1).max(100),
    paisId: z.string().optional(),
    ciudadId: z.string().optional(),
    otraPlataforma: z.string().max(100).optional(),
    edadVictima: z.number().int().min(0).max(120).optional(),
    reportePrevioId: z.string().min(1).optional(),
});

export type CrearReporteInput = z.infer<typeof crearReporteSchema>;

// IDs de Prisma: cuid() comienza con "c" y tiene 25 chars; también aceptamos UUIDs por compatibilidad.
export const idSchema = z.string().refine(
    (val) => /^[a-z0-9]{25}$/i.test(val) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val),
    { message: "ID inválido" }
);

export const restablecerPasswordSchema = z.object({
    token: z.string().min(1, "Token requerido"),
    password: z
        .string()
        .min(8, "Contraseña: mínimo 8 caracteres")
        .max(100, "Contraseña: máximo 100 caracteres")
        .refine(
            (val) => /[a-zA-Z]/.test(val) && /[0-9]/.test(val),
            { message: "Contraseña: al menos 1 letra y 1 número" }
        ),
}).strict();
export type RestablecerPasswordInput = z.infer<typeof restablecerPasswordSchema>;

export const authRegisterSchema = z.object({
    email: z.string().email("Email inválido").max(255, "Email: máximo 255 caracteres"),
    password: z
        .string()
        .min(8, "Contraseña: mínimo 8 caracteres")
        .max(100, "Contraseña: máximo 100 caracteres")
        .refine(
            (val) => /[a-zA-Z]/.test(val) && /[0-9]/.test(val),
            { message: "Contraseña: al menos 1 letra y 1 número" }
        ),
    nombre: z.string().max(100, "Nombre: máximo 100 caracteres").optional(),
    rol: z.enum(["ADMIN", "SCHOOL_ADMIN", "PARENT", "OPERADOR", "COMITE_VALIDACION"] as [string, ...string[]]),
    tenantId: idSchema.optional(),
}).strict();
export type AuthRegisterInput = z.infer<typeof authRegisterSchema>;

export const recuperarSolicitarSchema = z.object({
    email: z.string().email("Email inválido").max(255, "Email: máximo 255 caracteres"),
}).strict();
export type RecuperarSolicitarInput = z.infer<typeof recuperarSolicitarSchema>;

export const numeroSeguimientoSchema = z.string().regex(/^RPT-[A-Z0-9]{6}$/, "Número de seguimiento inválido");

const accionesPermitidas = Object.values(AccionAudit) as [string, ...string[]];
const accionesArraySchema = z.preprocess(
    (val) => (typeof val === "string" && val.length > 0 ? val.split(",") : undefined),
    z.array(z.enum(accionesPermitidas)).optional()
);
export const auditLogsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    accion: z.enum(accionesPermitidas).optional(),
    acciones: accionesArraySchema,
    usuarioId: idSchema.optional(),
    recursoId: idSchema.optional(),
    q: z.string().trim().min(2).max(120).optional(),
    fechaDesde: z.string().date().optional(),
    fechaHasta: z.string().date().optional(),
});

// Admin padres (spec 117, I-37): listado paginado con búsqueda por email/nombre
export const padresQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    q: z.string().trim().min(2).max(120).optional(),
});

// SPEC-194 (002-PI-088): listado admin de usuarios por rol (empieza por PARENT).
export const usuariosQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    rol: z.enum(["PARENT", "SCHOOL_ADMIN", "OPERADOR", "COMITE_VALIDACION", "COMITE_CONVIVENCIA", "ADMIN"]).default("PARENT"),
    q: z.string().trim().min(2).max(120).optional(),
    estado: z.enum(["activo", "inactivo", "bloqueado"]).optional(),
    desde: z.string().date().optional(),
    hasta: z.string().date().optional(),
    conReportes: z.enum(["true", "false"]).optional().transform((v) => (v === undefined ? undefined : v === "true")),
    colegioId: idSchema.optional(),
});
export type UsuariosQueryInput = z.infer<typeof usuariosQuerySchema>;

// SPEC-194 (002-PI-088): resumen de analítica por colegio.
export const analyticsColegiosQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    q: z.string().trim().min(2).max(120).optional(),
    ciudadId: idSchema.optional(),
    estado: z.enum(["activo", "inactivo"]).optional(),
    orden: z.enum(["nombre", "reportesTotal", "reportesUltimos30Dias", "alertasEscaladas", "casosProcesadosPct", "fechaRegistro"]).optional().default("nombre"),
    direccion: z.enum(["asc", "desc"]).optional().default("asc"),
});
export type AnalyticsColegiosQueryInput = z.infer<typeof analyticsColegiosQuerySchema>;

// SPEC-171 (Pilar B): incidentes de infraestructura, paginación estándar + filtro por estado
export const incidentesInfraQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    estado: z.enum(["ABIERTO", "RESUELTO"]).optional(),
});

const estadosPermitidos = Object.values(EstadoReporte) as [string, ...string[]];
const categoriasPermitidas = Object.values(CategoriaConducta) as [string, ...string[]];

// SPEC-181: orden cerrado de las bandejas del admin. El orderBy real vive en
// ORDENES_BANDEJA (repositorio de reportes); aquí solo se valida la clave.
export const ordenBandejaSchema = z.enum(["prioridad", "recientes", "antiguos"]).optional().default("prioridad");
export type OrdenBandeja = z.infer<typeof ordenBandejaSchema>;

export const reportesRevisionQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    estado: z.enum(estadosPermitidos).optional(),
    plataformaId: idSchema.optional(),
    categoria: z.enum(categoriasPermitidas).optional(),
    fechaDesde: z.string().date().optional(),
    fechaHasta: z.string().date().optional(),
    incluirEliminados: z.coerce.boolean().default(false),
    operadorId: idSchema.optional(),
    // N-2 (002-PI-056): filtro por padre (email o nombre del usuario denunciante).
    padre: z.string().min(3).max(120).optional(),
    q: z.string().min(3).max(120).optional(),
    orden: ordenBandejaSchema,
});

// SPEC-181 (Tarea B): bandeja de spam con barra completa (búsqueda, estado, orden, paginación).
export const spamPendientesQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    q: z.string().trim().min(3).max(120).optional(),
    estado: z.enum(["POSIBLE_SPAM", "REVISION_MANUAL"]).optional(),
    orden: ordenBandejaSchema,
    asignadoAMi: z.coerce.boolean().default(false),
});

// ---------------------------------------------------------------------------
// SPEC-125 (bloque R6): una sola forma de validar.
// Los mensajes de estos esquemas son CONTRATO del frontend
// (AuthContext.tsx y registro/page.tsx leen `error.message`): no cambiarlos.
// ---------------------------------------------------------------------------

// Nota Zod 4: un campo AUSENTE o de otro tipo produce `invalid_type` con el
// mensaje por defecto de Zod; el `error` a nivel de campo conserva el mensaje
// de contrato también en ese caso.
export const loginSchema = z.object({
    email: z.string({ error: "Email y contraseña requeridos" }).trim().toLowerCase().min(1, "Email y contraseña requeridos"),
    password: z.string({ error: "Email y contraseña requeridos" }).min(1, "Email y contraseña requeridos"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const verificarSolicitarSchema = z.object({
    email: z.string({ error: "Email inválido" }).trim().toLowerCase().min(1, "Email inválido")
        .refine((val) => val.includes("@"), { message: "Email inválido" }),
});
export type VerificarSolicitarInput = z.infer<typeof verificarSolicitarSchema>;

export const verificarValidarSchema = z.object({
    email: z.string({ error: "Email y código de 6 dígitos requeridos" }).trim().toLowerCase().min(1, "Email y código de 6 dígitos requeridos"),
    codigo: z.string({ error: "Email y código de 6 dígitos requeridos" }).length(6, "Email y código de 6 dígitos requeridos"),
});
export type VerificarValidarInput = z.infer<typeof verificarValidarSchema>;

export const verificarCompletarSchema = z.object({
    token: z.string({ error: "Token y contraseña requeridos" }).min(1, "Token y contraseña requeridos"),
    password: z.string({ error: "Token y contraseña requeridos" })
        .min(1, "Token y contraseña requeridos")
        .refine((val) => val.length >= 8 && /[a-zA-Z]/.test(val) && /[0-9]/.test(val), {
            message: "Contraseña: mínimo 8 caracteres, 1 letra y 1 número",
        }),
    nombre: z.string({ error: "Token y contraseña requeridos" }).optional(),
    // SPEC-240 (002-PI-143): registro público de colegio (paso 2 de verificación).
    nombreColegio: z.string().min(2, "Nombre del colegio: mínimo 2 caracteres").max(150).optional(),
    // SPEC-320 (§2.2-bis): NIT del colegio, obligatorio en el registro de colegio.
    nit: z.string().min(1, "Falta el NIT del colegio").max(50).optional(),
    rol: z.enum(["PARENT", "SCHOOL_ADMIN"]).optional(),
});
export type VerificarCompletarInput = z.infer<typeof verificarCompletarSchema>;

// SPEC-339 (A-67 §2.3): documento del padre (adulto — distinto del set del
// menor, que incluye RC/TI).
export const DOCUMENTO_TIPOS_PADRE = ["CC", "CE", "PASAPORTE", "NIT", "OTRO"] as const;
export type DocumentoTipoPadre = (typeof DOCUMENTO_TIPOS_PADRE)[number];

// SPEC-339 (A-67 §2.1): la puerta del padre por enlace. Las dos condiciones
// visibles del brief: 8 caracteres y que coincidan; se conserva letra+número
// del estándar del sitio.
export const registroSolicitarSchema = z.object({
    email: z.string({ error: "Email inválido" }).trim().toLowerCase().min(1, "Email inválido")
        .refine((val) => val.includes("@"), { message: "Email inválido" }),
});
export type RegistroSolicitarInput = z.infer<typeof registroSolicitarSchema>;

export const registroCompletarSchema = z
    .object({
        token: z.string({ error: "Enlace y contraseña requeridos" }).min(1, "Enlace y contraseña requeridos"),
        password: z.string({ error: "Enlace y contraseña requeridos" })
            .min(1, "Enlace y contraseña requeridos")
            .refine((val) => val.length >= 8 && /[a-zA-Z]/.test(val) && /[0-9]/.test(val), {
                message: "Contraseña: mínimo 8 caracteres, 1 letra y 1 número",
            }),
        passwordConfirmacion: z.string({ error: "Confirma tu contraseña" }).min(1, "Confirma tu contraseña"),
    })
    .refine((data) => data.password === data.passwordConfirmacion, {
        message: "Las contraseñas no coinciden",
        path: ["passwordConfirmacion"],
    });
export type RegistroCompletarInput = z.infer<typeof registroCompletarSchema>;

// SPEC-344 (A-69 · C1): registro por enlace del colegio. Reemplaza al código
// de 6 dígitos. Anti-enumeración por AMBAS dimensiones (correo Y NIT) — la
// respuesta hacia la pantalla es idéntica en las cuatro combinaciones
// (matiz CEO 03:18). El aviso, cuando corresponde, va SOLO al buzón.
export const registroColegioSolicitarSchema = z.object({
    email: z.string({ error: "Email inválido" }).trim().toLowerCase().min(1, "Email inválido")
        .refine((val) => val.includes("@"), { message: "Email inválido" }),
    nombreColegio: z.string().trim().min(2, "Nombre del colegio: mínimo 2 caracteres").max(150),
    nit: z.string().trim().min(1, "Falta el NIT del colegio").max(50),
});
export type RegistroColegioSolicitarInput = z.infer<typeof registroColegioSolicitarSchema>;

export const registroColegioCompletarSchema = z
    .object({
        token: z.string({ error: "Enlace y contraseña requeridos" }).min(1, "Enlace y contraseña requeridos"),
        password: z.string({ error: "Enlace y contraseña requeridos" })
            .min(1, "Enlace y contraseña requeridos")
            .refine((val) => val.length >= 8 && /[a-zA-Z]/.test(val) && /[0-9]/.test(val), {
                message: "Contraseña: mínimo 8 caracteres, 1 letra y 1 número",
            }),
        passwordConfirmacion: z.string({ error: "Confirme su contraseña" }).min(1, "Confirme su contraseña"),
        // nombreColegio y nit vienen del TokenRegistro (no del cliente): más
        // seguro y evita re-pedirlos.
    })
    .refine((data) => data.password === data.passwordConfirmacion, {
        message: "Las contraseñas no coinciden",
        path: ["passwordConfirmacion"],
    });
export type RegistroColegioCompletarInput = z.infer<typeof registroColegioCompletarSchema>;

export const activarSchema = z.object({
    token: z.string({ error: "Token requerido" }).min(1, "Token requerido"),
    password: z.string({ error: "Contraseña requerida" })
        .min(8, "Contraseña: mínimo 8 caracteres")
        .max(100, "Contraseña: máximo 100 caracteres")
        .refine((val) => /[a-zA-Z]/.test(val) && /[0-9]/.test(val), {
            message: "Contraseña: al menos 1 letra y 1 número",
        }),
}).strict();
export type ActivarInput = z.infer<typeof activarSchema>;

export const adminColegioNuevoSchema = z.object({
    nombreColegio: z.string().min(2, "Nombre del colegio: mínimo 2 caracteres").max(150),
    nombreRector: z.string().min(2, "Nombre del rector: mínimo 2 caracteres").max(150),
    emailRector: z.string().email("Email inválido").max(255, "Email: máximo 255 caracteres"),
    // SPEC-320 (§2.2-bis): NIT institucional obligatorio, único global.
    nit: z.string().min(1, "Falta el NIT del colegio").max(50),
}).strict();
export type AdminColegioNuevoInput = z.infer<typeof adminColegioNuevoSchema>;

export const recuperarValidarQuerySchema = z.object({
    token: z.string({ error: "Token requerido" }).min(1, "Token requerido"),
});

// SPEC-241 (002-PI-144): aceptación de consentimiento informado.
export const consentimientoAceptarSchema = z.object({
    documentoTipo: z.enum(["POLITICA_DATOS", "CONVENIO_INSTITUCIONAL"]),
    esRepresentanteLegal: z.boolean(),
}).strict();
export type ConsentimientoAceptarInput = z.infer<typeof consentimientoAceptarSchema>;

// Endpoints consumidos solo por el worker (scripts/worker-reportes.mjs).
export const procesarReporteSchema = z.object({
    reporteId: z.string({ error: "reporteId requerido" }).min(1, "reporteId requerido"),
    modeloClasificacion: z.string().optional(),
});
export type ProcesarReporteInput = z.infer<typeof procesarReporteSchema>;

export const fallbackReporteSchema = z.object({
    reporteId: z.string({ error: "reporteId requerido" }).min(1, "reporteId requerido"),
    error: z.string().optional(),
    errorCode: z.string().optional(),
});
export type FallbackReporteInput = z.infer<typeof fallbackReporteSchema>;

// Consulta pública (spec 091): el body NUNCA produce 400 — un body inválido
// equivale a identificador vacío. Por eso `.catch({})` y no safeParse + 400.
export const consultaBodySchema = z.object({
    identificador: z.string().optional(),
}).catch({});
export type ConsultaBodyInput = z.infer<typeof consultaBodySchema>;
