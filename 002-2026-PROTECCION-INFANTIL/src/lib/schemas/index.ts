import { z } from "zod";
import { NivelLog, EstadoNotificacion, CanalNotificacion } from "@prisma/client";
// SPEC-320: primitivas compartidas movidas a ./base (se re-exportan abajo para los
// consumidores de @/lib/schemas). También en ./identidad viven las de profesor.
import { cuidIdSchema, materiaIdSchema, emailSchema, parametroClaveSchema, estadoActivoSchema } from "./base";
import { profesorNuevoSchema } from "./identidad";

/**
 * Esquemas zod reutilizables para validación de entradas en rutas API.
 * Mantener aquí las reglas de validación comunes para evitar duplicación
 * y garantizar consistencia entre endpoints.
 */

export { cuidIdSchema, materiaIdSchema, emailSchema, parametroClaveSchema, estadoActivoSchema } from "./base";
export * from "./identidad";

// Body vacío para POST/PATCH que no esperan payload
export const emptyBodySchema = z.object({}).strict();

// Admin IA
export const ollamaProbarBodySchema = z.object({
    url: z.string().min(1).max(2000),
});

export const sandboxBodySchema = z.object({
    texto: z
        .string()
        .max(4000)
        .transform((s) => s.trim())
        .refine((s) => s.length > 0, { message: "texto es requerido" }),
    parametrosOverride: z.record(z.string(), z.unknown()).optional(),
    comparar: z.boolean().optional(),
});

// Admin operadores
export const operadorIdParamsSchema = z.object({
    id: cuidIdSchema,
});

// Admin padres (spec 117)
export const padreIdParamsSchema = z.object({
    id: cuidIdSchema,
});

// Admin padres — ventana de servicio (spec 119). Campo ausente = conservar el valor
// actual; null = limpiar (sin vigencia definida = acceso); string ISO = fijar.
export const padreVigenciaBodySchema = z.object({
    inicioServicio: z.string().datetime({ offset: true }).nullable().optional(),
    finServicio: z.string().datetime({ offset: true }).nullable().optional(),
});

// Configuración / parámetros
export const parametroTipoSchema = z.enum([
    "STRING",
    "INTEGER",
    "FLOAT",
    "BOOLEAN",
    "JSON",
    "STRING_ARRAY",
]);

export const parametroCategoriaSchema = z.enum([
    "VISIBILITY",
    "SECURITY",
    "LEGAL",
    "EMAIL",
    "SYSTEM",
]);

export const parametroClaveParamsSchema = z.object({
    clave: parametroClaveSchema,
});

export const parametroPatchBodySchema = z.object({
    valor: z.string().min(1).max(4000),
    motivo: z.string().max(500).optional(),
    tipo: parametroTipoSchema.optional(),
    categoria: parametroCategoriaSchema.optional(),
    esPublico: z.boolean().optional(),
    esSecreto: z.boolean().optional(),
    descripcion: z.string().max(500).optional(),
});

// Colegios
export const tipoPeriodoServicioSchema = z.enum(["MENSUAL", "SEMESTRAL", "ANUAL", "LIBRE"]);

export const colegioBodySchema = z.object({
    nombre: z.string().min(2).max(150),
    // SPEC-320 (§2.2-bis): NIT institucional obligatorio, único global.
    nit: z.string({ message: "Falta el NIT del colegio" }).min(1, "Falta el NIT del colegio").max(50),
    paisId: cuidIdSchema,
    departamentoId: cuidIdSchema.optional(),
    ciudadId: cuidIdSchema,
    direccion: z.string().max(255).optional(),
    representanteLegalNombre: z.string().min(2).max(150),
    representanteLegalIdentificacion: z.string().min(1).max(50),
    representanteLegalEmail: emailSchema,
    representanteLegalTelefono: z.string().max(50).optional(),
    inicioServicio: z.string().datetime(),
    finServicio: z.string().datetime(),
    tipoPeriodo: tipoPeriodoServicioSchema,
    adminEmail: emailSchema,
    adminNombre: z.string().min(2).max(150),
});

export const colegioIdParamsSchema = z.object({
    id: cuidIdSchema,
});

export const colegioUpdateBodySchema = z.object({
    nombre: z.string().min(2).max(150).optional(),
    paisId: cuidIdSchema.optional(),
    departamentoId: cuidIdSchema.optional().nullable(),
    ciudadId: cuidIdSchema.optional(),
    direccion: z.string().max(255).optional().nullable(),
    representanteLegalNombre: z.string().min(2).max(150).optional(),
    representanteLegalIdentificacion: z.string().min(1).max(50).optional(),
    representanteLegalEmail: emailSchema.optional(),
    representanteLegalTelefono: z.string().max(50).optional().nullable(),
    inicioServicio: z.string().datetime().optional(),
    finServicio: z.string().datetime().optional().nullable(),
    tipoPeriodo: tipoPeriodoServicioSchema.optional(),
    estado: z.enum(["activo", "inactivo"]).optional(),
}).refine((data) => Object.keys(data).length > 0, { message: "Debe enviar al menos un campo para actualizar", path: ["root"] });

export const cursoBodySchema = z.object({
    nombre: z.string().min(2).max(150),
    grado: z.string().max(100).optional(),
    anioLectivo: z.string().max(20).optional(),
    // SPEC-145 (D1=A): titular opcional; `null` ≡ sin titular. La ruta valida same-tenant.
    profesorTitularId: cuidIdSchema.optional().nullable(),
});

export const cursoUpdateBodySchema = z.object({
    nombre: z.string().min(2).max(150).optional(),
    grado: z.string().max(100).optional().nullable(),
    anioLectivo: z.string().max(20).optional().nullable(),
    // SPEC-145 (D1=A): `null` desasigna explícitamente; ausente ≡ no tocarlo.
    profesorTitularId: cuidIdSchema.optional().nullable(),
}).refine((data) => Object.keys(data).length > 0, { message: "Debe enviar al menos un campo para actualizar", path: ["root"] });

export const cursoIdParamsSchema = z.object({
    id: cuidIdSchema,
});

// SPEC-162: catálogo de materias configurable por colegio.
export const materiaBodySchema = z.object({
    nombre: z.string().min(1).max(150),
});

export const materiaUpdateBodySchema = z.object({
    nombre: z.string().min(1).max(150),
}).refine((data) => Object.keys(data).length > 0, { message: "Debe enviar al menos un campo para actualizar", path: ["root"] });

export const materiaIdParamsSchema = z.object({
    // SPEC-173 (corrección ZEUS, candado B): las materias sembradas por la
    // migración tienen id UUID; con cuidIdSchema los endpoints /materias/[id]
    // y /materias/[id]/estado daban 400 sobre el catálogo sembrado.
    id: materiaIdSchema,
});

// SPEC-163: acudiente de un estudiante (gestión post-alta).
export const acudienteParamsSchema = z.object({
    id: cuidIdSchema,
});

export const acudienteIdParamsSchema = z.object({
    id: cuidIdSchema,
    acudienteId: cuidIdSchema,
});

export const acudienteUpdateBodySchema = z
    .object({
        nombre: z.string().min(2).max(150).optional(),
        relacion: z.string().min(1).max(50).optional(),
        telefono: z.string().max(50).optional().nullable(),
        email: emailSchema.optional().nullable(),
        // SPEC-344 (A-69 · C1 · D-acud): documento del acudiente OPCIONAL.
        documentoTipo: z.string().min(1).max(20).optional().nullable(),
        documentoNumero: z.string().min(1).max(50).optional().nullable(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: "Debe enviar al menos un campo para actualizar", path: ["root"] });

// SPEC-163: identificador de un acudiente (matching de alertas Fase C).
export const identificadorAcudienteBodySchema = z.object({
    tipo: z.string().min(1).max(50).optional(),
    valor: z.string().min(1).max(255),
    plataformaId: cuidIdSchema.optional(),
    // SPEC-320 (§2.1): override del warn de identificador compartido en el colegio.
    confirmarCompartido: z.boolean().optional(),
});

export const identificadorAcudienteUpdateBodySchema = z
    .object({
        tipo: z.string().min(1).max(50).optional(),
        valor: z.string().min(1).max(255).optional(),
        plataformaId: cuidIdSchema.optional().nullable(),
        confirmarCompartido: z.boolean().optional(), // SPEC-320 (§2.1): override warn
    })
    .refine(
        (data) => Object.keys(data).some((k) => k !== "confirmarCompartido"),
        { message: "Debe enviar al menos un campo para actualizar", path: ["root"] }
    );

export const identificadorAcudienteIdParamsSchema = z.object({
    id: cuidIdSchema,
    identificadorId: cuidIdSchema,
});

// SPEC-164: identificador de un profesor (matching de alertas Fase C).
export const identificadorProfesorBodySchema = z.object({
    tipo: z.string().min(1).max(50).optional(),
    valor: z.string().min(1).max(255),
    plataformaId: cuidIdSchema.optional(),
    // SPEC-320 (§2.1): override del warn de identificador compartido en el colegio.
    confirmarCompartido: z.boolean().optional(),
});

export const identificadorProfesorUpdateBodySchema = z
    .object({
        tipo: z.string().min(1).max(50).optional(),
        valor: z.string().min(1).max(255).optional(),
        plataformaId: cuidIdSchema.optional().nullable(),
        confirmarCompartido: z.boolean().optional(), // SPEC-320 (§2.1): override warn
    })
    .refine(
        (data) => Object.keys(data).some((k) => k !== "confirmarCompartido"),
        { message: "Debe enviar al menos un campo para actualizar", path: ["root"] }
    );

export const identificadorProfesorIdParamsSchema = z.object({
    id: cuidIdSchema,
});

// SPEC-162: vínculo Curso × Materia × Profesor.
// El segmento dinámico del curso se llama [id] para no colisionar con otras
// carpetas bajo cursos/; en este contexto `id` es el identificador del curso.
export const cursoMateriaParamsSchema = z.object({
    id: cuidIdSchema,
});

// SPEC-344 (A-69 · C1 · D3): "Toda materia con profesor, sin excepción" —
// candado en servidor, sin migrar el schema Prisma (que mantiene profesorId
// nullable para no romper el histórico). El vínculo se rechaza en el
// endpoint y en el repositorio si `profesorId` viene nulo/vacío.
export const cursoMateriaBodySchema = z.object({
    materiaId: materiaIdSchema,
    profesorId: cuidIdSchema,
});

/** Reasignación de profesor en un vínculo curso↔materia existente (FR-031). */
export const cursoMateriaReasignarProfesorSchema = z.object({
    profesorId: cuidIdSchema,
});

export const cursoMateriaIdParamsSchema = z.object({
    id: cuidIdSchema,
    materiaId: materiaIdSchema,
});

// SPEC-144 (FR-010, D3): alta de estudiante — obligatorios solo nombre + apellidos;
// el resto es opcional y NUNCA bloquea el alta. Acudientes: máx 2 (D1, tabla hija).
// SPEC-320 (§2.3): documentoTipo del estudiante CONSUME el catálogo (clave); ya no es
// enum hardcode — acepta cualquier clave activa (metadato opcional sin FK).
export const documentoTipoEstudianteSchema = z.string().min(1).max(20);

export const acudienteEstudianteBodySchema = z.object({
    orden: z.union([z.literal(1), z.literal(2)]),
    nombre: z.string().min(2).max(150),
    relacion: z.string().min(1).max(50),
    telefono: z.string().max(50).optional(),
    email: emailSchema.optional(),
    // SPEC-344 (A-69 · C1 · D-acud): documento del acudiente OPCIONAL (mockup 1.6).
    // Aditivo, sin unicidad nueva — el mismo documento puede repetirse.
    documentoTipo: z.string().min(1).max(20).optional(),
    documentoNumero: z.string().min(1).max(50).optional(),
});

export const estudianteBodySchema = z.object({
    nombre: z.string().min(2).max(150),
    apellidos: z.string({ message: "Falta el apellido del estudiante" }).min(1, "Falta el apellido del estudiante").max(150),
    // SPEC-320 (§2.2-bis): documento del alumno OBLIGATORIO (consume el catálogo §2.3).
    documentoTipo: z.string({ message: "Falta el tipo de documento del estudiante" }).min(1, "Falta el tipo de documento del estudiante").max(20),
    documentoNumero: z.string({ message: "Falta el número de documento del estudiante" }).min(1, "Falta el número de documento del estudiante").max(50),
    acudientes: z.array(acudienteEstudianteBodySchema).max(2, "Máximo 2 acudientes por estudiante").optional(),
});

export const estudianteUpdateBodySchema = z.object({
    nombre: z.string().min(2).max(150).optional(),
    apellidos: z.string().min(1).max(150).optional(),
}).refine((data) => Object.keys(data).length > 0, { message: "Debe enviar al menos un campo para actualizar", path: ["root"] });

export const estudianteIdParamsSchema = z.object({
    id: cuidIdSchema,
});

// SPEC-320 (§2.2): sexoSchema y los esquemas de profesor (profesorBodySchema,
// profesorPatchSchema, profesorIdParamsSchema, profesoresQuerySchema) viven en
// ./identidad y se re-exportan arriba (export * from "./identidad").

// SPEC-144 (FR-003): el valor físico en BD sigue siendo 'ALUMNO' (@map); en código
// y en el wire el valor es ESTUDIANTE. El parser de carga acepta "ALUMNO" legado
// y lo normaliza a ESTUDIANTE (compatibilidad con plantillas viejas).
export const etiquetaRelacionEstudianteSchema = z.enum(["ESTUDIANTE", "MADRE", "PADRE", "PRIMO", "TUTOR", "OTRO"]);

export const identificadorEstudianteBodySchema = z.object({
    tipo: z.string().min(1).max(50).optional(),
    valor: z.string().min(1).max(255),
    plataformaId: cuidIdSchema.optional(),
    etiquetaRelacion: etiquetaRelacionEstudianteSchema.optional(),
    // SPEC-320 (§2.1): override del warn de identificador compartido en el colegio.
    confirmarCompartido: z.boolean().optional(),
});

export const identificadorEstudianteUpdateBodySchema = z.object({
    tipo: z.string().min(1).max(50).optional(),
    valor: z.string().min(1).max(255).optional(),
    plataformaId: cuidIdSchema.optional().nullable(),
    etiquetaRelacion: etiquetaRelacionEstudianteSchema.optional(),
    confirmarCompartido: z.boolean().optional(), // SPEC-320 (§2.1): override warn
}).refine(
    (data) => Object.keys(data).some((k) => k !== "confirmarCompartido"),
    { message: "Debe enviar al menos un campo para actualizar", path: ["root"] }
);

export const identificadorEstudianteIdParamsSchema = z.object({
    id: cuidIdSchema,
});

// SPEC-146 (FR-002): payload del wizard unificado — curso + estudiantes +
// identificadores en UNA escritura atómica. `profesorNuevoSchema` vive en ./identidad
// (deriva de profesorBodySchema) y se re-exporta arriba.
export const identificadorUnificadoSchema = identificadorEstudianteBodySchema.extend({
    // Índice (0-based) del estudiante dentro de `estudiantes` al que pertenece.
    estudianteIndex: z.number().int().min(0),
});

export const payloadUnificadoSchema = z
    .object({
        curso: cursoBodySchema,
        profesorNuevo: profesorNuevoSchema.optional(),
        // El wizard permite guardar el curso solo (estudiantes = 0) — "lo puedes
        // completar después" (spec, Edge Cases). Topes defensivos acordes al
        // límite de filas del pipeline de carga.
        estudiantes: z.array(estudianteBodySchema).max(500),
        identificadores: z.array(identificadorUnificadoSchema).max(2000),
    })
    .refine((data) => data.identificadores.every((i) => i.estudianteIndex < data.estudiantes.length), {
        message: "Un identificador apunta a un estudiante que no está en la lista",
        path: ["identificadores"],
    })
    .refine((data) => !(data.curso.profesorTitularId && data.profesorNuevo), {
        message: "Elige un profesor de la lista o crea uno nuevo, no ambos",
        path: ["profesorNuevo"],
    });

export type PayloadUnificado = z.infer<typeof payloadUnificadoSchema>;

export const confirmarCargaSchema = z.object({
    tokenConfirmacion: z.string(),
});

export const alertaEstadoSchema = z.object({
    estado: z.enum(["nueva", "vista", "gestionada", "escalada", "cerrada"]),
});

export const alertaAsignarSchema = z.object({
    asignadoAId: z.union([cuidIdSchema, z.literal("")]).optional(),
});

// SPEC-173 (H01/H06): el batch del rector solo permite "Revisar en lote".
// Escalar exige motivo caso por caso (endpoint individual); gestionar/asignar/
// cerrar salen de la superficie batch del rector.
export const alertaBatchSchema = z.object({
    ids: z.array(cuidIdSchema).min(1, "Selecciona al menos una alerta"),
    accion: z.enum(["vista"]),
    asignadoAId: cuidIdSchema.optional(),
});

export const alertaIdParamsSchema = z.object({
    id: cuidIdSchema,
});

export const alertaQuerySchema = z.object({
    estado: z.enum(["nueva", "vista", "gestionada", "escalada", "cerrada"]).optional(),
    tipoSujeto: z.enum(["ESTUDIANTE", "PROFESOR", "ACUDIENTE"]).optional(),
    prioridad: z.enum(["alta", "media", "baja"]).optional(),
    cursoId: cuidIdSchema.optional(),
    categoria: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

// SPEC-159 (FR-004): nota de la bitácora del caso — texto plano 1..1000
// (el cliente también valida; React escapa al renderizar).
export const notaSeguimientoSchema = z.object({
    texto: z
        .string()
        .trim()
        .min(1, "Escribe lo que hiciste antes de registrarlo")
        .max(1000, "La nota no puede superar 1000 caracteres"),
});

// SPEC-150 (FR-002): marca de observación especial — motivo opcional, texto
// plano ≤ 500 (solo visible para el colegio; React escapa al renderizar).
export const observacionBodySchema = z.object({
    motivo: z.string().trim().max(500, "El motivo no puede superar 500 caracteres").optional(),
});

// SPEC-168 (Fase F): cuenta compartida del Comité de Convivencia.
export const comiteCuentaSchema = z.object({
    email: emailSchema,
});

// SPEC-168 (Fase F): integrante documentado del Comité de Convivencia.
export const integranteComiteConvivenciaSchema = z.object({
    nombres: z.string().trim().min(1).max(100),
    apellidos: z.string().trim().min(1).max(100),
    tipoIdentificacion: z.enum(["CEDULA_CIUDADANIA", "CEDULA_EXTRANJERIA", "PASAPORTE", "OTRO"]),
    numeroIdentificacion: z.string().trim().min(1).max(100),
    email: emailSchema,
    cargo: z.string().trim().min(1).max(100),
});

// SPEC-168 (Fase F): motivo de escalamiento de una alerta al comité.
export const escalarAlertaSchema = z.object({
    motivo: z.string().trim().min(1, "Escribe el motivo del escalamiento").max(2000),
});

// SPEC-168 (Fase F): resolución documentada del comité al cerrar un caso.
export const resolverSolicitudSchema = z.object({
    resolucion: z.string().trim().min(1, "Escribe la decisión del comité").max(4000),
    // SPEC-319 §2.4: integrante activo del comité que firma el cierre (requerido).
    integranteFirmanteId: cuidIdSchema,
});

// SPEC-169 (Fase G): onboarding, cobertura y notificaciones in-app del colegio.
export const onboardingPatchSchema = z.object({
    estado: z.enum(["activo", "omitido"]),
});

export const notificacionFiltroSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    soloNoLeidas: z.coerce.boolean().optional(),
});

// SPEC-149 (FR-007): PATCH de preferencias de avisos del colegio. Upsert por
// tipo (tenant lo pone la sesión). Umbrales 1-100, ventanas 1-90 días; null en
// umbral/ventanaDias/emailDestino = volver al default. Mensajes humanos (§4.6).
export const tipoEventoAvisoSchema = z.enum(["REPORTE_NUEVO", "UMBRAL_CURSO", "ESTUDIANTE_REPETIDO", "RESUMEN_SEMANAL"]);

export const preferenciaAvisoBodySchema = z.object({
    tipoEvento: tipoEventoAvisoSchema,
    habilitado: z.boolean().optional(),
    emailDestino: emailSchema.nullable().optional(),
    umbral: z.number().int().min(1, "El umbral mínimo es 1").max(100, "El umbral máximo es 100").nullable().optional(),
    ventanaDias: z.number().int().min(1, "La ventana mínima es 1 día").max(90, "La ventana máxima es 90 días").nullable().optional(),
});

// SPEC-181 (Tarea C): query de la simulación anti-abuso del admin. Es un schema
// de query del área admin viviendo en este módulo (mayoría colegio): se ubica
// aquí porque `src/lib/validators.ts` está siendo editado por otro frente de
// trabajo en la misma spec y no debe tocarse desde esta vía.
// `orden` es un enum cerrado: el repo lo traduce a orderBy por mapa, nunca por
// interpolación. Default `recientes` = el orden histórico del repo
// (ultimoReporteEn desc).
export const nivelRiesgoFiltroSchema = z.enum(["BAJO", "MEDIO", "ALTO", "CRITICO"]);

export const ordenSimulacionSchema = z.enum(["recientes", "antiguos", "score"]);

export const antiAbusoSimulacionQuerySchema = z.object({
    q: z.string().trim().min(3).max(120).optional(),
    nivel: nivelRiesgoFiltroSchema.optional(),
    plataformaId: cuidIdSchema.optional(),
    orden: ordenSimulacionSchema.default("recientes"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type AntiAbusoSimulacionQuery = z.infer<typeof antiAbusoSimulacionQuerySchema>;

// SPEC-184 (002-PI-079): tablero operativo anti-abuso.
export const ventanaAntiAbusoSchema = z.enum(["24h", "7d", "30d"]).default("24h");

export const duracionBloqueoSchema = z.enum(["24h", "7d", "permanente"]);

function esIpValida(ip: string): boolean {
    const ipv4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
    if (ipv4.test(ip)) return true;
    const ipv6 =
        /^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$|^([a-fA-F0-9]{1,4}:){1,7}:$|^([a-fA-F0-9]{1,4}:){1,6}:[a-fA-F0-9]{1,4}$|^([a-fA-F0-9]{1,4}:){1,5}(:[a-fA-F0-9]{1,4}){1,2}$|^([a-fA-F0-9]{1,4}:){1,4}(:[a-fA-F0-9]{1,4}){1,3}$|^([a-fA-F0-9]{1,4}:){1,3}(:[a-fA-F0-9]{1,4}){1,4}$|^([a-fA-F0-9]{1,4}:){1,2}(:[a-fA-F0-9]{1,4}){1,5}$|^[a-fA-F0-9]{1,4}:((:[a-fA-F0-9]{1,4}){1,6})$|^:((:[a-fA-F0-9]{1,4}){1,7}|:)$/;
    return ipv6.test(ip);
}

// SPEC-196 (002-PI-090): bloqueo manual recibe la IP en claro; el backend calcula el hash.
export const bloquearIpBodySchema = z.object({
    ip: z
        .string()
        .trim()
        .min(1, "La IP es obligatoria")
        .refine(esIpValida, { message: "Debe ser una IPv4 o IPv6 válida" }),
    motivo: z.string().trim().min(1, "El motivo es obligatorio").max(500, "Máximo 500 caracteres"),
    duracion: duracionBloqueoSchema,
});

// SPEC-196 (002-PI-090): desbloqueo manual requiere motivo de al menos 20 caracteres.
export const desbloquearIpBodySchema = z.object({
    id: cuidIdSchema,
    motivo: z.string().trim().min(20, "El motivo debe tener al menos 20 caracteres").max(500, "Máximo 500 caracteres"),
});

// SPEC-184 (002-PI-079): simulador de abusos.
export const escenarioSimulacionAbusoSchema = z.enum([
    "robot_inundando",
    "ataque_coordinado",
    "bot_ips_rotativas",
    "denunciante_spam",
    "personalizado",
]);

// SPEC-185: validación estricta de IPv4 para simulaciones.
export const ipv4Schema = z
    .string()
    .regex(
        /^(\d{1,3}\.){3}\d{1,3}$/,
        "Debe ser una IPv4 válida (ej. 192.0.2.10)"
    )
    .refine(
        (ip) => ip.split(".").every((octeto) => {
            const n = Number(octeto);
            return Number.isFinite(n) && n >= 0 && n <= 255;
        }),
        "Cada octeto debe estar entre 0 y 255"
    );

export const simularAbusoBodySchema = z.object({
    escenario: escenarioSimulacionAbusoSchema,
    n: z.coerce.number().int().min(1).max(200).default(50),
    ip: ipv4Schema.optional(),
    identificador: z.string().min(3).max(100).optional(),
    plataforma: z.string().min(1).optional(),
    // SPEC-185: soporte para múltiples IPs/identificadores y usuario PARENT de prueba.
    usuarioId: z.string().cuid().optional(),
    identificadores: z.array(z.string().min(3).max(100)).max(200).optional(),
    ips: z.array(ipv4Schema).max(200).optional(),
    // SPEC-192: nota interna opcional para el operador.
    nota: z.string().max(200).optional(),
});

export const simulacionAbusoQuerySchema = z.object({
    estado: z.enum(["PENDIENTE", "EN_PROGRESO", "COMPLETADA", "CANCELADA", "FALLIDA"]).optional(),
    escenario: escenarioSimulacionAbusoSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

// SPEC-185: query de sugerencias de configuración por escenario.
export const sugerenciasSimulacionAbusoQuerySchema = z.object({
    escenario: escenarioSimulacionAbusoSchema,
});

// SPEC-151 (FR-002): parámetro ?mes=YYYY-MM para el informe PDF mensual.
// No futuro, no más de 12 meses atrás; mes actual permitido.
export const informeMensualQuerySchema = z.object({
    mes: z
        .string()
        .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El mes debe tener formato YYYY-MM")
        .refine((v) => {
            const [anio, mes] = v.split("-").map(Number);
            const ahora = new Date();
            const inicioMes = new Date(Date.UTC(anio, mes - 1, 1, 5, 0, 0, 0));
            const hace12Meses = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - 11, 1, 5, 0, 0, 0));
            const finMesActual = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 1, 5, 0, 0, 0));
            return inicioMes >= hace12Meses && inicioMes < finMesActual;
        }, "El mes debe estar entre los últimos 12 meses y no puede ser futuro"),
});

// SPEC-193 (Fase 2): administración de logs de workers.
export const monitoreoLogsQuerySchema = z.object({
    servicio: z.string().optional(),
    nivel: z.nativeEnum(NivelLog).optional(),
    desde: z.string().datetime().optional(),
    hasta: z.string().datetime().optional(),
    q: z.string().min(1).max(120).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
    offset: z.coerce.number().int().min(0).default(0),
});

export const monitoreoLogsPurgeSchema = z
    .object({
        hasta: z.string().datetime(),
        servicio: z.string().optional(),
        nivel: z.nativeEnum(NivelLog).optional(),
        motivo: z.string().min(20, "El motivo debe tener al menos 20 caracteres").max(500, "El motivo no puede superar los 500 caracteres"),
    })
    .refine(
        (data) => {
            const fecha = new Date(data.hasta);
            const hoy = new Date();
            hoy.setUTCHours(0, 0, 0, 0);
            return fecha < hoy;
        },
        {
            message: "La fecha límite debe ser anterior al día actual",
            path: ["hasta"],
        }
    )
    .refine(
        (data) => {
            if (data.nivel && !data.servicio) return false;
            return true;
        },
        {
            message: "Debes seleccionar un servicio para filtrar por nivel",
            path: ["servicio"],
        }
    );

// SPEC-193 (Fase 2): reasignación manual de reportes entre operadores.
export const reasignarOperadorBodySchema = z.object({
    reporteId: cuidIdSchema,
    operadorDestinoId: cuidIdSchema,
    motivo: z.string().min(20).max(500),
});

// SPEC-202 (002-PI-099): panel admin del motor de notificaciones.
export const notificacionIdParamsSchema = z.object({
    id: cuidIdSchema,
});

export const notificacionClaveParamsSchema = z.object({
    clave: z.string().min(1).max(120),
});

export const bandejaNotificacionesQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    evento: z.string().min(1).max(100).optional(),
    canal: z.nativeEnum(CanalNotificacion).optional(),
    estado: z.nativeEnum(EstadoNotificacion).optional(),
    destinatario: z.string().min(1).max(255).optional(),
    fechaDesde: z.string().date().optional(),
    fechaHasta: z.string().date().optional(),
});

export const plantillaPatchBodySchema = z.object({
    asunto: z.string().max(255).optional().nullable(),
    cuerpoMarkdown: z.string().min(1).max(8000),
    variablesSchema: z.record(z.string(), z.unknown()).optional(),
    activa: z.boolean().optional(),
});

export const plantillaPreviewBodySchema = z.object({
    variables: z.record(z.string(), z.unknown()).default({}),
});

export const reglaPatchBodySchema = z.object({
    offset: z.string().regex(/^[+-]\d+[dhm]$/, "Offset inválido: formato [+-]N[d|h|m]").optional(),
    canal: z.nativeEnum(CanalNotificacion).optional(),
    plantillaClave: z.string().min(1).max(120).optional(),
    obligatoria: z.boolean().optional(),
    activa: z.boolean().optional(),
});

export const reglaRecalcularBodySchema = z.object({
    motivo: z.string().min(1).max(200),
});

export const notificacionParametroPatchBodySchema = z.object({
    valor: z.string().min(1).max(4000),
});

// SPEC-237 (002-PI-mega-cola): bandeja comité CONSOLIDACION + aprobación multi-miembro.
export * from "./comite-consolidacion";

// SPEC-238 (002-PI-mega-cola): aclaración padre-comité (pedir/responder).
export * from "./aclaracion";

// SPEC-239 (002-PI-mega-cola): contactos de emergencia del padre (E.164).
export * from "./contacto-emergencia";
