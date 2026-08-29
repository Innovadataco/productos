/**
 * SPEC-053 (FR-004, US1): ReporteCreationService.
 * Orquesta la creación de un reporte: plataforma, deduplicación autenticada,
 * número de seguimiento, cifrado del texto original, persistencia y agregación
 * del identificador. La validación HTTP, rate-limiting, anti-abuso (fuente) y
 * el encolado (adaptador de infraestructura) quedan en la ruta / su adaptador.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { EstadoReporte, Prisma } from "@prisma/client";
import { generarNumeroSeguimiento } from "@/lib/reporte-utils";
import { encryptParameter } from "@/lib/param-encryption";
import { cifrarTextoReporte } from "@/lib/texto-reporte-cifrado";
import { logger } from "@/lib/logger";
import { ReporteRepository } from "../repositories/reporte";
import { IdentificadorReportadoRepository } from "../repositories/identificador-reportado";
import { PlataformaRepository } from "../repositories/plataforma";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_INTENTOS_NUMERO = 10;

export type EstadoInicialReporte = "PENDIENTE" | "POSIBLE_SPAM" | "REVISION_MANUAL";

export interface CrearReporteInput {
    identificador: string;
    plataformaId: string;
    plataformaClave: string;
    texto: string;
    fechaIncidente: string;
    ciudad: string;
    pais: string;
    paisId?: string | undefined;
    ciudadId?: string | undefined;
    otraPlataforma?: string | undefined;
    edadVictima?: number | undefined;
    esAnonimo: boolean;
    usuarioId: string | null;
    // SPEC-295 (002-PI-196 · I-146): rol del origen del reporte. "PARENT" para
    // padre autenticado; null para anónimos y otros orígenes.
    origenRol?: string | null;
    tenantId: string | null;
    estadoInicial: EstadoInicialReporte;
    prioridadAlta: boolean;
    keywordsDetectadas: string[];
}

export interface ReporteCreadoDto {
    id: string;
    numeroSeguimiento: string | null;
    estado: EstadoReporte;
}

export type ResultadoCreacion =
    | { ok: true; reporte: ReporteCreadoDto }
    | { ok: false; tipo: "duplicado"; reporteExistenteId: string }
    | { ok: false; tipo: "error_numero" }
    | { ok: false; tipo: "error_cifrado" };

export class ReporteCreationService {
    private readonly reportes: ReporteRepository;
    private readonly identificadores: IdentificadorReportadoRepository;
    private readonly plataformas: PlataformaRepository;

    constructor(tx?: Prisma.TransactionClient) {
        this.reportes = new ReporteRepository(tx);
        this.identificadores = new IdentificadorReportadoRepository(tx);
        this.plataformas = new PlataformaRepository(tx);
    }

    /** La ruta necesita la plataforma antes (rate-limit por identificador y fuente). */
    resolverPlataforma(clave: string) {
        return this.plataformas.findByClave(clave);
    }

    async crear(input: CrearReporteInput): Promise<ResultadoCreacion> {
        const { usuarioId, identificador } = input;

        // Deduplicación autenticada: mismo usuario + identificador en 30 días.
        if (usuarioId) {
            // SPEC-137 (E-5): advisory lock por (usuario, identificador) ANTES del
            // chequeo — la 2ª request concurrente espera aquí hasta el commit de la
            // 1ª y su dedup posterior ya la ve (cierre de carrera con read-committed).
            await this.reportes.tomarLockDedup(usuarioId, identificador);
            const desde = new Date(Date.now() - THIRTY_DAYS_MS);
            const existente = await this.reportes.findDuplicadoReciente(usuarioId, identificador, desde);
            if (existente) {
                return { ok: false, tipo: "duplicado", reporteExistenteId: existente.id };
            }
        }

        // Generar número de seguimiento único.
        let numeroSeguimiento: string;
        let intentos = 0;
        do {
            numeroSeguimiento = generarNumeroSeguimiento();
            if (!(await this.reportes.existeNumeroSeguimiento(numeroSeguimiento))) break;
            intentos++;
        } while (intentos < MAX_INTENTOS_NUMERO);

        if (intentos >= MAX_INTENTOS_NUMERO) {
            return { ok: false, tipo: "error_numero" };
        }

        // El texto original se cifra inmediatamente; la copia anonimizada la genera
        // el worker de procesamiento asíncrono.
        let textoOriginalCifrado: string;
        try {
            textoOriginalCifrado = encryptParameter(input.texto);
        } catch (err) {
            logger.error("[REPORTES] Error cifrando texto original:", err);
            return { ok: false, tipo: "error_cifrado" };
        }

        const reporte = await this.reportes.crear({
            identificador,
            plataformaId: input.plataformaId,
            // SPEC-130 (BL-4): el texto de trabajo también va cifrado en reposo
            // (el pipeline lo descifra por la capa de datos; la evidencia íntegra
            // sigue en textoOriginal, cifrada igual desde SPEC-110).
            texto: cifrarTextoReporte(input.texto),
            textoOriginal: textoOriginalCifrado,
            fechaIncidente: new Date(input.fechaIncidente),
            ciudad: input.ciudad,
            pais: input.pais,
            paisId: input.ciudadId === "otra" ? null : input.paisId || null,
            ciudadId: input.ciudadId === "otra" ? null : input.ciudadId || null,
            otraPlataforma: input.plataformaClave === "otro" ? input.otraPlataforma || null : null,
            edadVictima: input.edadVictima ?? null,
            esAnonimo: input.esAnonimo,
            usuarioId,
            origenRol: input.origenRol ?? null,
            numeroSeguimiento,
            tenantId: input.tenantId,
            estado: input.estadoInicial,
            prioridadAlta: input.prioridadAlta,
            keywordsDetectadas: input.keywordsDetectadas,
        });

        // Agregación del identificador (SPEC-110: un reporte nuevo levanta el
        // ocultamiento por comité; el repositorio encapsula el upsert exacto).
        await this.identificadores.upsertIncrementoReporte({
            identificador,
            plataformaId: input.plataformaId,
            esAnonimo: input.esAnonimo,
        });

        return {
            ok: true,
            reporte: { id: reporte.id, numeroSeguimiento: reporte.numeroSeguimiento, estado: reporte.estado },
        };
    }
}
