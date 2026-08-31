import { prisma } from "./prisma";
import { createToken, hashPassword } from "./auth";
import { normalizarNombreGeografico } from "./normalizar";
import type { RolUsuario } from "@prisma/client";

export async function crearUsuario(rol: RolUsuario = "PARENT", email?: string, password = "TestPass123") {
    const uniqueEmail = email || `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    return prisma.usuario.create({
        data: {
            email: uniqueEmail,
            nombre: "Usuario Test",
            passwordHash: await hashPassword(password),
            rol,
            estado: "activo",
        },
    });
}

export async function crearTokenUsuario(userId: string, rol: RolUsuario) {
    return createToken({ sub: userId, rol });
}

export function crearRequestAutenticado(
    method: string,
    url: string,
    body: unknown,
    token?: string
): Request {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
        headers.cookie = `token=${token}`;
    }
    return new Request(url, {
        method,
        headers,
        // Sin body cuando no hay (undefined explícito ≡ omitir en RequestInit).
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
}

export async function crearPlataforma(clave = "whatsapp", nombre = "WhatsApp", categoria = "mensajeria") {
    return prisma.plataforma.upsert({
        where: { clave },
        update: {},
        create: { clave, nombre, categoria },
    });
}

export async function crearColegioConAdmin() {
    const { pais, ciudad } = await crearPaisCiudad();
    const tenant = await prisma.tenant.create({
        data: { nombre: "Colegio Test", estado: "activo" },
    });
    const hoy = new Date();
    const inicio = new Date(hoy);
    inicio.setDate(inicio.getDate() - 1);
    const fin = new Date(hoy);
    fin.setFullYear(fin.getFullYear() + 1);
    const colegio = await prisma.colegio.create({
        data: {
            nombre: "Colegio Test",
            // SPEC-320 (§2.2-bis): NIT obligatorio y único global.
            nit: `TEST-NIT-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            paisId: pais.id,
            ciudadId: ciudad.id,
            representanteLegalNombre: "Representante Test",
            representanteLegalIdentificacion: "123456789",
            representanteLegalEmail: "rep@test.com",
            inicioServicio: inicio,
            finServicio: fin,
            tipoPeriodo: "ANUAL",
            estado: "activo",
            tenantId: tenant.id,
        },
    });
    const admin = await prisma.usuario.create({
        data: {
            email: `school-admin-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
            nombre: "Admin Colegio",
            passwordHash: await hashPassword("TestPass123"),
            rol: "SCHOOL_ADMIN",
            estado: "activo",
            tenantId: tenant.id,
            colegioId: colegio.id,
        },
    });
    return { colegio, admin, pais, ciudad, tenant };
}

export async function crearCurso(
    colegioId: string,
    data: { nombre?: string; grado?: string; anioLectivo?: string; estado?: string; profesorTitularId?: string | null } = {}
) {
    return prisma.curso.create({
        data: {
            colegioId,
            nombre: data.nombre ?? `Curso ${Date.now()}`,
            grado: data.grado ?? null,
            anioLectivo: data.anioLectivo ?? null,
            estado: data.estado ?? "activo",
            profesorTitularId: data.profesorTitularId ?? null,
        },
    });
}

// SPEC-145: fixture de profesor del colegio (mínimo: nombre + apellidos).
let profesorDocSeq = 0;
export async function crearProfesor(
    colegioId: string,
    data: {
        nombre?: string;
        apellidos?: string;
        email?: string;
        telefono?: string;
        estado?: string;
        tipoDocumento?: string;
        numeroDocumento?: string;
        anioNacimiento?: number;
        sexo?: string;
    } = {}
) {
    // SPEC-320 (§2.2): identidad del profesor obligatoria; el fixture provee defaults
    // (numeroDocumento único por secuencia para no chocar con el UNIQUE por colegio).
    const doc = data.numeroDocumento ?? `DOC${Date.now()}${profesorDocSeq++}`;
    return prisma.profesor.create({
        data: {
            colegioId,
            nombre: data.nombre ?? `Profesor ${Date.now()}`,
            apellidos: data.apellidos ?? "De Prueba",
            tipoDocumento: data.tipoDocumento ?? "CC",
            numeroDocumento: doc,
            anioNacimiento: data.anioNacimiento ?? 1985,
            sexo: data.sexo ?? "OTRO",
            email: data.email ?? `profesor${doc}@example.com`,
            telefono: data.telefono ?? "+573000000000",
            estado: data.estado ?? "activo",
        },
    });
}

let estudianteDocSeq = 0;
export async function crearEstudiante(
    cursoId: string,
    colegioId: string,
    data: { nombre?: string; apellidos?: string; estado?: string; documentoTipo?: string; documentoNumero?: string } = {}
) {
    // SPEC-320 (§2.2-bis): documento del alumno obligatorio; numero único por secuencia.
    return prisma.estudiante.create({
        data: {
            cursoId,
            colegioId,
            nombre: data.nombre ?? `Estudiante ${Date.now()}`,
            apellidos: data.apellidos ?? "De Prueba",
            documentoTipo: data.documentoTipo ?? "TI",
            documentoNumero: data.documentoNumero ?? `EST${Date.now()}${estudianteDocSeq++}`,
            estado: data.estado ?? "activo",
        },
    });
}

export async function crearIdentificadorEstudiante(
    estudianteId: string,
    data: { tipo?: string; valor?: string; plataformaId?: string | null; etiquetaRelacion?: string; estado?: string } = {}
) {
    // SPEC-320 (§2.1 · H1): IdentificadorEstudiante lleva colegioId denormalizado.
    // Se resuelve desde el estudiante para no cambiar la firma de este fixture.
    const estudiante = await prisma.estudiante.findUniqueOrThrow({
        where: { id: estudianteId },
        select: { colegioId: true },
    });
    return prisma.identificadorEstudiante.create({
        data: {
            estudianteId,
            colegioId: estudiante.colegioId,
            tipo: data.tipo ?? "telefono",
            valor: data.valor ?? `+57${Date.now()}`,
            plataformaId: data.plataformaId ?? null,
            etiquetaRelacion: (data.etiquetaRelacion as never) ?? "ESTUDIANTE",
            estado: data.estado ?? "activo",
        },
    });
}

// SPEC-163: fixture de acudiente del estudiante.
export async function crearAcudienteEstudiante(
    estudianteId: string,
    data: { orden?: 1 | 2; nombre?: string; relacion?: string; telefono?: string | null; email?: string | null; estado?: string } = {}
) {
    return prisma.acudienteEstudiante.create({
        data: {
            estudianteId,
            orden: data.orden ?? 1,
            nombre: data.nombre ?? `Acudiente ${Date.now()}`,
            relacion: data.relacion ?? "madre",
            telefono: data.telefono ?? null,
            email: data.email ?? null,
            estado: data.estado ?? "activo",
        },
    });
}

// SPEC-163: fixture de identificador de acudiente (colegioId denormalizado).
export async function crearIdentificadorAcudiente(
    acudienteId: string,
    colegioId: string,
    data: { tipo?: string; valor?: string; plataformaId?: string | null; estado?: string } = {}
) {
    return prisma.identificadorAcudiente.create({
        data: {
            acudienteId,
            colegioId,
            tipo: data.tipo ?? "telefono",
            valor: data.valor ?? `+57${Date.now()}`,
            plataformaId: data.plataformaId ?? null,
            estado: data.estado ?? "activo",
        },
    });
}

// SPEC-164: fixture de identificador de profesor (colegioId denormalizado).
export async function crearIdentificadorProfesor(
    profesorId: string,
    colegioId: string,
    data: { tipo?: string; valor?: string; plataformaId?: string | null; estado?: string } = {}
) {
    return prisma.identificadorProfesor.create({
        data: {
            profesorId,
            colegioId,
            tipo: data.tipo ?? "telefono",
            valor: data.valor ?? `+57${Date.now()}`,
            plataformaId: data.plataformaId ?? null,
            estado: data.estado ?? "activo",
        },
    });
}

export async function crearPaisCiudad() {
    const pais = await prisma.pais.upsert({
        where: { codigo: "CO" },
        update: {},
        create: { codigo: "CO", nombre: "Colombia" },
    });
    const ciudad = await prisma.ciudad.upsert({
        where: { nombre_paisId: { nombre: "Bogotá", paisId: pais.id } },
        update: { lat: 4.711, lng: -74.0721, nombreNormalizado: normalizarNombreGeografico("Bogotá") },
        create: { nombre: "Bogotá", paisId: pais.id, lat: 4.711, lng: -74.0721, nombreNormalizado: normalizarNombreGeografico("Bogotá") },
    });
    return { pais, ciudad };
}

export async function crearParametrosReportes() {
    const params = [
        { clave: "visibility.report_threshold", valor: "3", tipo: "INTEGER" as const, categoria: "VISIBILITY" as const, esPublico: true },
        { clave: "visibility.min_authenticated_ratio", valor: "0.5", tipo: "FLOAT" as const, categoria: "VISIBILITY" as const, esPublico: true },
        { clave: "reportes.classification_model", valor: "ornith:9b", tipo: "STRING" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "reportes.classification.umbral_revision", valor: "0.5", tipo: "FLOAT" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "clasificacion.umbral_spam", valor: "0.7", tipo: "FLOAT" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "reportes.classification.min_score_categoria", valor: "0.3", tipo: "FLOAT" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "reportes.classification.n_votos", valor: "5", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "reportes.classification.temperatura_votos", valor: "0.7", tipo: "FLOAT" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "reportes.classification.ollama_num_parallel", valor: "2", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "reportes.classification.rag_top_k", valor: "3", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "reportes.embedding_model", valor: "nomic-embed-text", tipo: "STRING" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "reportes.duplicate.similarity_threshold", valor: "0.92", tipo: "FLOAT" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "reportes.anonymization_model", valor: "ornith:9b", tipo: "STRING" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ranking.weight.count", valor: "10", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ranking.weight.recency", valor: "15", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ranking.weight.severity", valor: "50", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ranking.weight.authenticated", valor: "25", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ranking.recency_days", valor: "90", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ranking.threshold.low", valor: "30", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ranking.threshold.medium", valor: "70", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.weight.count", valor: "10", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.weight.recency", valor: "15", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.weight.severity", valor: "45", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.weight.authenticated", valor: "20", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.weight.diversity", valor: "10", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.recency_days", valor: "90", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.diversity.max_cities", valor: "5", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.threshold.low", valor: "35", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.threshold.medium", valor: "60", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.threshold.high", valor: "80", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.source_weight.enabled", valor: "false", tipo: "BOOLEAN" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.source_weight.anonymous", valor: "0.65", tipo: "FLOAT" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.source_weight.authenticated", valor: "1.0", tipo: "FLOAT" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.source_weight.new_account_factor", valor: "0.7", tipo: "FLOAT" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.source_weight.new_account_days_threshold", valor: "7", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.source_weight.burst_factor", valor: "0.4", tipo: "FLOAT" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.source_weight.burst_window_hours", valor: "24", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.source_weight.burst_max_reports", valor: "3", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.source_weight.confirmed_factor", valor: "1.2", tipo: "FLOAT" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.source_weight.discarded_factor", valor: "0.3", tipo: "FLOAT" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "anti_abuso.retencion_fuente_dias", valor: "90", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "operadores.cupo_maximo_default", valor: "10", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "operadores.estrategia_asignacion", valor: "ponderado_carga_inversa", tipo: "STRING" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "operadores.reconciliacion_intervalo_min", valor: "15", tipo: "INTEGER" as const, categoria: "SYSTEM" as const, esPublico: false },
        { clave: "operadores.reconciliacion_enabled", valor: "true", tipo: "BOOLEAN" as const, categoria: "SYSTEM" as const, esPublico: false },
        { clave: "ratelimit.report.window_seconds", valor: "3600", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.report.max_requests", valor: "5", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.login.window_seconds", valor: "300", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.login.max_requests", valor: "10", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.consulta.window_seconds", valor: "60", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.consulta.max_requests", valor: "30", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.register.window_seconds", valor: "3600", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.register.max_requests", valor: "10", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.ia_sandbox.window_seconds", valor: "600", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.ia_sandbox.max_requests", valor: "10", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.report_identificador.window_seconds", valor: "3600", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.report_identificador.max_requests", valor: "10", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.report_identificador.spam_threshold", valor: "20", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.report_fingerprint.window_seconds", valor: "3600", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.report_fingerprint.max_requests", valor: "5", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        // SPEC-185: id de usuario PARENT de prueba para el escenario denunciante_spam.
        { clave: "simulacion.spam.usuario_id", valor: "", tipo: "STRING" as const, categoria: "SYSTEM" as const, esPublico: false },
        { clave: "ratelimit.recuperar_solicitar.window_seconds", valor: "3600", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.recuperar_solicitar.max_requests", valor: "5", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.verificacion_solicitar.window_seconds", valor: "3600", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.verificacion_solicitar.max_requests", valor: "5", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "alerts.admin.enabled", valor: "true", tipo: "BOOLEAN" as const, categoria: "EMAIL" as const, esPublico: false },
        { clave: "alerts.critical_score.enabled", valor: "true", tipo: "BOOLEAN" as const, categoria: "EMAIL" as const, esPublico: false },
        { clave: "worker.max_reintentos", valor: "3", tipo: "INTEGER" as const, categoria: "SYSTEM" as const, esPublico: false },
        { clave: "worker.retry_delay_segundos", valor: "30", tipo: "INTEGER" as const, categoria: "SYSTEM" as const, esPublico: false },
        { clave: "worker.concurrencia", valor: "2", tipo: "INTEGER" as const, categoria: "SYSTEM" as const, esPublico: false },
        { clave: "worker.max_pendientes", valor: "100", tipo: "INTEGER" as const, categoria: "SYSTEM" as const, esPublico: false },
        { clave: "ui.sla_horas_procesamiento", valor: "24", tipo: "INTEGER" as const, categoria: "SYSTEM" as const, esPublico: true },
        { clave: "risk.umbral_medio", valor: "50", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: true },
        { clave: "risk.umbral_alto", valor: "75", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: true },
        { clave: "risk.min_reportes_alto", valor: "3", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: true },
        { clave: "risk.peso_confianza", valor: "50", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: true },
        { clave: "risk.peso_cantidad", valor: "30", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: true },
        { clave: "risk.peso_gravedad", valor: "20", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: true },
    ];

    for (const p of params) {
        await prisma.$executeRaw`
            INSERT INTO "ParametroSistema" (id, clave, valor, tipo, categoria, "esPublico", "creadoEn", "actualizadoEn")
            VALUES (${crypto.randomUUID()}, ${p.clave}, ${p.valor}, ${p.tipo}::"TipoParametro", ${p.categoria}::"CategoriaParametro", ${p.esPublico}, NOW(), NOW())
            ON CONFLICT (clave) DO NOTHING
        `;
    }
}

export function bodyToRequest(body: unknown): Request {
    return new Request("http://localhost:5005/api/reportes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

/**
 * Spec 096: siembra los parámetros del expediente (10 etapas, canales del
 * mensaje al padre) y una rúbrica mínima de prueba. Misma estructura que el
 * seed real (`prisma/seed.ts`), versión compacta para tests.
 */
export async function crearParametrosExpediente() {
    const etapas = [
        { orden: 1, fase: "A", faseNombre: "Ingesta", clave: "recepcion", nombre: "Recepción", icono: "inbox", capa: 1, gated: false,
            campos: ["creadoEn", "numeroSeguimiento", "plataforma", "pais", "ciudad", "esAnonimo", "edadVictima", "estado"] },
        { orden: 2, fase: "A", faseNombre: "Ingesta", clave: "peso_fuente", nombre: "Peso de fuente", icono: "scale", capa: 1, gated: false,
            campos: ["pesoAplicado", "cuentaDiasAntiguedad", "reportesPrevios", "reportesConfirmados", "reportesDescartados"],
            camposGated: ["ipHash", "fingerprintHash"] },
        { orden: 3, fase: "B", faseNombre: "Preparación", clave: "embedding", nombre: "Embedding", icono: "vector", capa: 1, gated: false,
            campos: ["modeloUsado", "creadoEn", "latenciaMs"] },
        { orden: 4, fase: "B", faseNombre: "Preparación", clave: "deduplicacion", nombre: "Deduplicación", icono: "copy", capa: 2, gated: false,
            campos: ["reporteOrigenId", "scoreSimilitud"] },
        { orden: 5, fase: "B", faseNombre: "Preparación", clave: "guardas", nombre: "Guardas baratas", icono: "shield", capa: 2, gated: false,
            campos: ["esRafaga", "keywordsDetectadas", "prioridadAlta"] },
        { orden: 6, fase: "C", faseNombre: "Evaluación", clave: "contexto_rag", nombre: "Contexto RAG", icono: "book", capa: 2, gated: false,
            campos: ["casosSimilares", "categoriasVecinas"] },
        { orden: 7, fase: "C", faseNombre: "Evaluación", clave: "clasificacion", nombre: "Clasificación por rúbrica", icono: "brain", capa: 1, gated: false,
            campos: ["categorias", "confianza", "usoCascada", "modeloCascada", "latenciaMs", "promptTokens", "responseTokens"],
            camposGated: ["rawResponse"] },
        { orden: 8, fase: "D", faseNombre: "Cierre", clave: "anonimizacion", nombre: "Anonimización PII", icono: "mask", capa: 1, gated: false,
            campos: ["contienePii", "piiDetectada", "anonimizacionValidadaPorId", "anonimizacionValidadaEn"],
            camposGated: ["textoOriginal"] },
        { orden: 9, fase: "D", faseNombre: "Cierre", clave: "decision", nombre: "Decisión", icono: "gavel", capa: 2, gated: false,
            campos: ["transiciones"] },
        { orden: 10, fase: "D", faseNombre: "Cierre", clave: "finalizacion", nombre: "Finalización", icono: "flag", capa: 1, gated: false,
            campos: ["estado", "reintentos", "processingError"] },
    ];
    const canales = [
        { nombre: "Línea 141 ICBF", contacto: "141",
            descripcion: "Línea gratuita del ICBF para reportar riesgos contra niños, niñas y adolescentes" },
        { nombre: "Te Protejo", contacto: "https://teprotejo.org",
            descripcion: "Canal para reportar material de abuso sexual infantil en internet" },
    ];
    const preguntasRubrica = {
        SOLICITUD_MATERIAL: [
            { texto: "¿Alguien pide fotos, videos o material visual a otra persona?", activo: true, tipo: "decisiva" },
            { texto: "¿La persona a quien se le pide es menor de edad?", activo: true, tipo: "contexto" },
        ],
        CONTACTO_INSISTENTE: [
            { texto: "¿Hay mensajes o llamadas repetidas a pesar de no recibir respuesta?", activo: true, tipo: "decisiva" },
        ],
    };
    const params = [
        { clave: "admin.expediente.etapas", valor: JSON.stringify(etapas) },
        { clave: "mensaje.padre.canales", valor: JSON.stringify(canales) },
        { clave: "ia.rubrica.preguntas", valor: JSON.stringify(preguntasRubrica) },
    ];
    for (const p of params) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: { valor: p.valor },
            create: { clave: p.clave, valor: p.valor, tipo: "JSON", categoria: "SYSTEM", esPublico: false },
        });
    }
}
