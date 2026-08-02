import { getParametroSistema } from "@/lib/parametros";
import { decryptParameter, isEncryptedValue } from "@/lib/param-encryption";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";
import { PasoProcesamientoRepository } from "@/lib/dal/repositories/paso-procesamiento";
import type {
    ClasificacionIA,
    ClasificacionRubricaVoto,
    EmbeddingReporte,
    FuenteReporte,
    PasoProcesamiento,
    ReintentoReporte,
    Reporte,
    TransicionReporte,
} from "@prisma/client";

/**
 * Ensamblador del expediente del reporte (spec 096-US1/US4).
 * Las etapas (orden, fase, nombre, ícono, campos visibles y gated) se leen del
 * parámetro `admin.expediente.etapas` — NADA de etiquetas quemadas en código
 * (ADR_004): renombrar o reordenar etapas en el parámetro cambia la salida
 * sin desplegar. Los campos se alimentan de los modelos existentes (Capa 1)
 * y de PasoProcesamiento (Capa 2, degrada a `sinInstrumentar` si no hay pasos).
 */

export interface EtapaConfig {
    orden: number;
    fase: string;
    faseNombre: string;
    clave: string;
    nombre: string;
    icono: string;
    capa: number;
    gated: boolean;
    campos: string[];
    camposGated?: string[];
}

export interface EtapaExpediente {
    orden: number;
    fase: string;
    faseNombre: string;
    clave: string;
    nombre: string;
    icono: string;
    capa: number;
    actividad: string;
    evaluacion: string;
    fechaHora: string | null;
    campos: Record<string, unknown>;
    /** true si la etapa tiene camposGated NO revelados en esta respuesta. */
    gated: boolean;
    /** true en etapas Capa 2 sin filas en PasoProcesamiento (degradación elegante). */
    sinInstrumentar: boolean;
}

export type ReporteExpediente = Reporte & {
    plataforma: { nombre: string };
    fuente: FuenteReporte | null;
    embedding: EmbeddingReporte | null;
    clasificacion: (ClasificacionIA & { rubricaVotos: ClasificacionRubricaVoto[] }) | null;
    transiciones: TransicionReporte[];
    reintentos: ReintentoReporte[];
};

export interface DatosExpediente {
    reporte: ReporteExpediente;
    pasos: PasoProcesamiento[];
}

function iso(fecha: Date | null | undefined): string | null {
    return fecha ? fecha.toISOString() : null;
}

/** Carga el reporte con las relaciones que alimentan las etapas + sus pasos. */
export async function cargarDatosExpediente(reporteId: string): Promise<DatosExpediente | null> {
    // E-8: las lecturas viven en los repos; el ensamblador no cambia.
    const reporte = await new ReporteRepository().findParaExpediente(reporteId);
    if (!reporte) return null;
    const pasos = await new PasoProcesamientoRepository().findPorReporteOrdenados(reporteId);
    return { reporte: reporte as ReporteExpediente, pasos };
}

/**
 * Lee y valida el parámetro `admin.expediente.etapas`. Devuelve las etapas
 * ordenadas por `orden`. Si el parámetro falta o es inválido, devuelve []
 * (degradación elegante: el expediente no rompe, solo sale sin etapas).
 */
export async function obtenerConfigEtapas(): Promise<EtapaConfig[]> {
    const param = await getParametroSistema("admin.expediente.etapas");
    if (!param) return [];
    return parsearEtapasConfig(param.valor);
}

export function parsearEtapasConfig(valor: string): EtapaConfig[] {
    try {
        const parsed: unknown = JSON.parse(valor);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((e): e is EtapaConfig =>
                typeof e === "object" && e !== null &&
                typeof (e as EtapaConfig).orden === "number" &&
                typeof (e as EtapaConfig).clave === "string" &&
                typeof (e as EtapaConfig).nombre === "string" &&
                Array.isArray((e as EtapaConfig).campos)
            )
            .sort((a, b) => a.orden - b.orden);
    } catch {
        return [];
    }
}

function pickCampos(disponibles: Record<string, unknown>, lista: string[]): Record<string, unknown> {
    const salida: Record<string, unknown> = {};
    for (const clave of lista) {
        salida[clave] = disponibles[clave] ?? null;
    }
    return salida;
}

function descifrarTextoOriginal(textoOriginal: string | null): string | null {
    if (!textoOriginal) return null;
    if (!isEncryptedValue(textoOriginal)) return textoOriginal; // compat pre-cifrado
    try {
        return decryptParameter(textoOriginal);
    } catch {
        return null;
    }
}

interface PartesEtapa {
    disponibles: Record<string, unknown>;
    disponiblesGated: Record<string, unknown>;
    actividad: string;
    evaluacion: string;
    fechaHora: string | null;
    sinInstrumentar: boolean;
}

function ultimoPaso(pasos: PasoProcesamiento[], etapa: string): PasoProcesamiento | undefined {
    const deEtapa = pasos.filter((p) => p.etapa === etapa);
    return deEtapa[deEtapa.length - 1];
}

function detallePaso(paso: PasoProcesamiento | undefined): Record<string, unknown> {
    if (!paso || typeof paso.detalle !== "object" || paso.detalle === null || Array.isArray(paso.detalle)) {
        return {};
    }
    return paso.detalle as Record<string, unknown>;
}

/** Partes de cada etapa según su clave. Las claves nuevas en el parámetro caen al caso genérico (pasos Capa 2). */
function construirPartes(config: EtapaConfig, datos: DatosExpediente): PartesEtapa {
    const { reporte: r, pasos } = datos;
    const c = r.clasificacion;
    const base: PartesEtapa = {
        disponibles: {},
        disponiblesGated: {},
        actividad: "",
        evaluacion: "",
        fechaHora: null,
        sinInstrumentar: false,
    };

    switch (config.clave) {
        case "recepcion":
            return {
                ...base,
                disponibles: {
                    creadoEn: iso(r.creadoEn),
                    numeroSeguimiento: r.numeroSeguimiento,
                    plataforma: r.plataforma.nombre,
                    pais: r.pais,
                    ciudad: r.ciudad,
                    esAnonimo: r.esAnonimo,
                    edadVictima: r.edadVictima,
                    estado: r.estado,
                },
                actividad: "Recepción y registro del reporte en la plataforma",
                evaluacion: `Reporte registrado con estado ${r.estado}`,
                fechaHora: iso(r.creadoEn),
            };
        case "peso_fuente":
            return {
                ...base,
                disponibles: r.fuente
                    ? {
                        pesoAplicado: r.fuente.pesoAplicado,
                        cuentaDiasAntiguedad: r.fuente.cuentaDiasAntiguedad,
                        reportesPrevios: r.fuente.reportesPrevios,
                        reportesConfirmados: r.fuente.reportesConfirmados,
                        reportesDescartados: r.fuente.reportesDescartados,
                    }
                    : {},
                disponiblesGated: {
                    ipHash: r.fuente?.ipHash ?? null,
                    fingerprintHash: r.fuente?.fingerprintHash ?? null,
                },
                actividad: "Cálculo del peso de la fuente (antigüedad de cuenta e historial de reportes)",
                evaluacion: r.fuente ? `Peso aplicado: ${r.fuente.pesoAplicado}` : "Sin datos de fuente registrados",
                fechaHora: iso(r.fuente?.creadoEn),
            };
        case "embedding":
            return {
                ...base,
                disponibles: r.embedding
                    ? { modeloUsado: r.embedding.modeloUsado, creadoEn: iso(r.embedding.creadoEn), latenciaMs: null }
                    : {},
                actividad: "Generación del embedding del texto para búsqueda semántica",
                evaluacion: r.embedding ? `Modelo ${r.embedding.modeloUsado}` : "Sin embedding registrado",
                fechaHora: iso(r.embedding?.creadoEn),
            };
        case "deduplicacion": {
            const paso = ultimoPaso(pasos, "deduplicacion");
            const detalle = detallePaso(paso);
            const evaluaciones: Record<string, string> = {
                duplicado: "Reporte duplicado de uno anterior",
                sin_duplicado: "Sin duplicados por similitud",
                no_aplica: "No aplica (reporte no anónimo)",
            };
            return {
                ...base,
                disponibles: {
                    reporteOrigenId: detalle.reporteOrigenId ?? r.reporteOrigenId ?? null,
                    scoreSimilitud: detalle.scoreSimilitud ?? null,
                },
                actividad: "Búsqueda de reportes duplicados por similitud semántica",
                evaluacion: (paso?.veredicto && evaluaciones[paso.veredicto]) || paso?.veredicto || "Sin evaluar",
                fechaHora: iso(paso?.creadoEn),
                sinInstrumentar: !paso,
            };
        }
        case "guardas": {
            const paso = ultimoPaso(pasos, "guardas");
            const n = r.keywordsDetectadas.length;
            return {
                ...base,
                disponibles: {
                    esRafaga: r.esRafaga,
                    keywordsDetectadas: r.keywordsDetectadas,
                    prioridadAlta: r.prioridadAlta,
                },
                actividad: "Guardas de ráfaga, doxing y keywords sobre el texto anonimizado",
                evaluacion: `${r.esRafaga ? "Ráfaga detectada" : "Sin ráfaga"} · ${n} ${n === 1 ? "keyword detectada" : "keywords detectadas"}${r.prioridadAlta ? " · prioridad alta" : ""}`,
                fechaHora: iso(paso?.creadoEn),
                sinInstrumentar: !paso,
            };
        }
        case "contexto_rag": {
            const paso = ultimoPaso(pasos, "contexto_rag");
            const detalle = detallePaso(paso);
            const casos = Array.isArray(detalle.casosSimilares) ? detalle.casosSimilares.length : 0;
            return {
                ...base,
                disponibles: {
                    casosSimilares: detalle.casosSimilares ?? null,
                    categoriasVecinas: detalle.categoriasVecinas ?? null,
                },
                actividad: "Recuperación de casos similares corregidos como contexto (RAG)",
                evaluacion: paso
                    ? paso.veredicto === "casos_recuperados"
                        ? `${casos} ${casos === 1 ? "caso similar recuperado" : "casos similares recuperados"}`
                        : "Sin casos similares recuperados"
                    : "Sin evaluar",
                fechaHora: iso(paso?.creadoEn),
                sinInstrumentar: !paso,
            };
        }
        case "clasificacion": {
            const secundarias = Array.isArray(c?.categoriasSecundarias) ? c.categoriasSecundarias : [];
            const categorias = c
                ? [
                    c.categoria,
                    ...secundarias
                        .map((s) => (typeof s === "object" && s !== null && "categoria" in s ? (s as { categoria: unknown }).categoria : null))
                        .filter((x): x is string => typeof x === "string"),
                ]
                : null;
            return {
                ...base,
                disponibles: {
                    categorias,
                    confianza: c?.confianza ?? null,
                    usoCascada: c?.usoCascada ?? null,
                    modeloCascada: c?.modeloCascada ?? null,
                    latenciaMs: c?.latenciaMs ?? null,
                    promptTokens: c?.promptTokens ?? null,
                    responseTokens: c?.responseTokens ?? null,
                },
                disponiblesGated: { rawResponse: c?.rawResponse ?? null },
                actividad: "Clasificación multi-modelo de la conducta según la rúbrica vigente",
                evaluacion: c ? `Categoría ${c.categoria} con confianza ${c.confianza}` : "Sin clasificación registrada",
                fechaHora: iso(c?.creadoEn),
            };
        }
        case "anonimizacion":
            return {
                ...base,
                disponibles: {
                    contienePii: c?.contienePii ?? null,
                    piiDetectada: c?.piiDetectada ?? null,
                    anonimizacionValidadaPorId: r.anonimizacionValidadaPorId,
                    anonimizacionValidadaEn: iso(r.anonimizacionValidadaEn),
                },
                disponiblesGated: { textoOriginal: r.textoOriginal },
                actividad: "Detección y anonimización de datos personales (PII) en el texto",
                evaluacion: c
                    ? c.contienePii
                        ? `PII detectada: ${c.piiDetectada.length > 0 ? c.piiDetectada.join(", ") : "sí"}`
                        : "Sin PII detectada"
                    : "Sin clasificación registrada",
                fechaHora: iso(r.anonimizacionValidadaEn) ?? iso(c?.creadoEn),
            };
        case "decision": {
            const paso = ultimoPaso(pasos, "decision");
            const ultimaTransicion = r.transiciones[r.transiciones.length - 1];
            return {
                ...base,
                disponibles: {
                    transiciones: r.transiciones.map((t) => ({
                        estadoAnterior: t.estadoAnterior,
                        estadoNuevo: t.estadoNuevo,
                        responsableTipo: t.responsableTipo,
                        motivo: t.motivo,
                        creadoEn: iso(t.creadoEn),
                    })),
                },
                actividad: "Aplicación de la regla de decisión y registro de transiciones de estado",
                evaluacion: paso?.veredicto
                    ? `Decisión: ${paso.veredicto}`
                    : ultimaTransicion
                        ? `${ultimaTransicion.estadoAnterior} → ${ultimaTransicion.estadoNuevo}`
                        : "Sin transiciones registradas",
                fechaHora: iso(paso?.creadoEn) ?? iso(ultimaTransicion?.creadoEn),
                sinInstrumentar: !paso,
            };
        }
        case "finalizacion":
            return {
                ...base,
                disponibles: {
                    estado: r.estado,
                    reintentos: r.reintentos.map((re) => ({
                        intento: re.intento,
                        exitoso: re.exitoso,
                        error: re.error,
                        creadoEn: iso(re.creadoEn),
                    })),
                    processingError: r.processingError,
                },
                actividad: "Cierre del procesamiento y actualización de agregados",
                evaluacion: r.processingError
                    ? "Finalizó con error de procesamiento"
                    : `Estado final: ${r.estado} · ${r.reintentos.length} ${r.reintentos.length === 1 ? "reintento" : "reintentos"}`,
                fechaHora: iso(r.actualizadoEn),
            };
        default: {
            // Clave desconocida (agregada al parámetro sin desplegar): se resuelve
            // genéricamente desde los pasos instrumentados con esa misma clave.
            const paso = ultimoPaso(pasos, config.clave);
            const detalle = detallePaso(paso);
            return {
                ...base,
                disponibles: detalle,
                actividad: config.nombre,
                evaluacion: paso?.veredicto ?? "Sin evaluar",
                fechaHora: iso(paso?.creadoEn),
                sinInstrumentar: config.capa === 2 && !paso,
            };
        }
    }
}

/**
 * Arma las etapas del expediente en el orden del parámetro.
 * `revelar: true` incluye los camposGated (textoOriginal se descifra aquí; el
 * AuditLog lo registra el caller — ver endpoint del expediente).
 */
export function armarEtapas(
    datos: DatosExpediente,
    config: EtapaConfig[],
    opciones: { revelar?: boolean } = {}
): EtapaExpediente[] {
    const revelar = opciones.revelar === true;
    return config.map((etapa) => {
        const partes = construirPartes(etapa, datos);
        const campos = pickCampos(partes.disponibles, etapa.campos);
        const camposGated = etapa.camposGated ?? [];
        if (revelar && camposGated.length > 0) {
            const gated = pickCampos(partes.disponiblesGated, camposGated);
            if (typeof gated.textoOriginal === "string") {
                gated.textoOriginal = descifrarTextoOriginal(gated.textoOriginal);
            }
            Object.assign(campos, gated);
        }
        return {
            orden: etapa.orden,
            fase: etapa.fase,
            faseNombre: etapa.faseNombre,
            clave: etapa.clave,
            nombre: etapa.nombre,
            icono: etapa.icono,
            capa: etapa.capa,
            actividad: partes.actividad,
            evaluacion: partes.evaluacion,
            fechaHora: partes.fechaHora,
            campos,
            gated: camposGated.length > 0 && !revelar,
            sinInstrumentar: partes.sinInstrumentar,
        };
    });
}

/** Atajo de una sola pasada: carga datos + parámetro y arma las etapas. */
export async function armarExpedienteEtapas(
    reporteId: string,
    opciones: { revelar?: boolean } = {}
): Promise<EtapaExpediente[] | null> {
    const datos = await cargarDatosExpediente(reporteId);
    if (!datos) return null;
    const config = await obtenerConfigEtapas();
    return armarEtapas(datos, config, opciones);
}
