import { z } from "zod";

/**
 * Esquemas zod reutilizables para validación de entradas en rutas API.
 * Mantener aquí las reglas de validación comunes para evitar duplicación
 * y garantizar consistencia entre endpoints.
 */

// Identificadores y claves
export const cuidIdSchema = z.string().cuid();

export const emailSchema = z.string().email().max(255);

export const parametroClaveSchema = z.string().min(1).max(100);

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

export const estadoActivoSchema = z.enum(["activo", "inactivo"]);

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

// SPEC-144 (FR-010, D3): alta de estudiante — obligatorios solo nombre + apellidos;
// el resto es opcional y NUNCA bloquea el alta. Acudientes: máx 2 (D1, tabla hija).
export const documentoTipoEstudianteSchema = z.enum(["RC", "TI", "CC", "CE", "PASAPORTE", "OTRO"], {
    message: "Tipo de documento inválido. Valores aceptados: RC, TI, CC, CE, PASAPORTE, OTRO",
});

export const acudienteEstudianteBodySchema = z.object({
    orden: z.union([z.literal(1), z.literal(2)]),
    nombre: z.string().min(2).max(150),
    relacion: z.string().min(1).max(50),
    telefono: z.string().max(50).optional(),
    email: emailSchema.optional(),
});

export const estudianteBodySchema = z.object({
    nombre: z.string().min(2).max(150),
    apellidos: z.string({ message: "Falta el apellido del estudiante" }).min(1, "Falta el apellido del estudiante").max(150),
    documentoTipo: documentoTipoEstudianteSchema.optional(),
    documentoNumero: z.string().max(50).optional(),
    acudientes: z.array(acudienteEstudianteBodySchema).max(2, "Máximo 2 acudientes por estudiante").optional(),
});

export const estudianteUpdateBodySchema = z.object({
    nombre: z.string().min(2).max(150).optional(),
    apellidos: z.string().min(1).max(150).optional(),
}).refine((data) => Object.keys(data).length > 0, { message: "Debe enviar al menos un campo para actualizar", path: ["root"] });

export const estudianteIdParamsSchema = z.object({
    id: cuidIdSchema,
});

// SPEC-145 (FR-005): alta de profesor — obligatorios solo nombre + apellidos;
// email/teléfono opcionales y NUNCA bloquean el alta. Baja = estado "inactivo".
export const profesorBodySchema = z.object({
    nombre: z.string().min(2).max(150),
    apellidos: z.string({ message: "Falta el apellido del profesor" }).min(1, "Falta el apellido del profesor").max(150),
    email: emailSchema.optional(),
    telefono: z.string().max(50).optional(),
});

export const profesorPatchSchema = z.object({
    nombre: z.string().min(2).max(150).optional(),
    apellidos: z.string().min(1).max(150).optional(),
    email: emailSchema.optional().nullable(),
    telefono: z.string().max(50).optional().nullable(),
    estado: estadoActivoSchema.optional(),
}).refine((data) => Object.keys(data).length > 0, { message: "Debe enviar al menos un campo para actualizar", path: ["root"] });

export const profesorIdParamsSchema = z.object({
    id: cuidIdSchema,
});

export const profesoresQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    estado: z.enum(["activo", "inactivo", "todos"]).default("activo"),
});

// SPEC-144 (FR-003): el valor físico en BD sigue siendo 'ALUMNO' (@map); en código
// y en el wire el valor es ESTUDIANTE. El parser de carga acepta "ALUMNO" legado
// y lo normaliza a ESTUDIANTE (compatibilidad con plantillas viejas).
export const etiquetaRelacionEstudianteSchema = z.enum(["ESTUDIANTE", "MADRE", "PADRE", "PRIMO", "TUTOR", "OTRO"]);

export const identificadorEstudianteBodySchema = z.object({
    tipo: z.string().min(1).max(50).optional(),
    valor: z.string().min(1).max(255),
    plataformaId: cuidIdSchema.optional(),
    etiquetaRelacion: etiquetaRelacionEstudianteSchema.optional(),
});

export const identificadorEstudianteUpdateBodySchema = z.object({
    tipo: z.string().min(1).max(50).optional(),
    valor: z.string().min(1).max(255).optional(),
    plataformaId: cuidIdSchema.optional().nullable(),
    etiquetaRelacion: etiquetaRelacionEstudianteSchema.optional(),
}).refine((data) => Object.keys(data).length > 0, { message: "Debe enviar al menos un campo para actualizar", path: ["root"] });

export const identificadorEstudianteIdParamsSchema = z.object({
    id: cuidIdSchema,
});

// SPEC-146 (FR-002): payload del wizard unificado — curso + estudiantes +
// identificadores en UNA escritura atómica. Reusa los schemas de alta ya
// existentes (curso, estudiante con acudientes, identificador); el tipo del
// identificador es opcional (se infiere del valor en la ruta).
export const profesorNuevoSchema = profesorBodySchema.pick({ nombre: true, apellidos: true });

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
    estado: z.enum(["nueva", "vista", "gestionada"]),
});

export const alertaIdParamsSchema = z.object({
    id: cuidIdSchema,
});

export const alertaQuerySchema = z.object({
    estado: z.enum(["nueva", "vista", "gestionada"]).optional(),
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
