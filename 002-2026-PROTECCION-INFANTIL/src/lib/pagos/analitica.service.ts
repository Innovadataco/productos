/**
 * SPEC-218 (002-PI-118): servicio de la analítica dinero-vs-valor del Módulo
 * Pagos. Orquesta las queries del repositorio, aplica la caché en memoria por
 * widget (FR-006, TTL configurable vía `pagos.analitica.cache_segundos`) y
 * deriva variaciones/alertas con las funciones puras de `analitica-calculos.ts`
 * (reglas simples, SIN IA — FR-010).
 *
 * Este módulo NO importa `@/lib/prisma` ni el repositorio concreto: recibe una
 * interfaz estructural (`AnaliticaRepositorio`) que `PagosAnaliticaRepository`
 * satisface. Así el servicio y su test quedan libres de BD (unit) y la frontera
 * DAL (Q-3) se respeta: el `route.ts`/página es quien inyecta el repositorio.
 */
import type { EstadoSuscripcion, TipoTitular } from "@prisma/client";
import {
    DIAS_MORA_LARGA,
    DIAS_VENCIMIENTOS_SEMANA,
    MESES_HISTORICO_CRECIMIENTO,
    UMBRAL_CRECIMIENTO_PCT,
    construirSeriesCrecimiento,
    diasDeMora,
    diasRestantes,
    rangoMesUtc,
    ultimasEtiquetasMesBogota,
    variacionPct,
    type AlertaCrecimiento,
    type SerieCrecimiento,
} from "./analitica-calculos";

// ── Tipos de entrada (estructurales; los satisface PagosRepository) ──

export interface TitularAnalitica {
    id: string;
    nombre: string | null;
}

export interface SuscripcionAnalitica {
    id: string;
    tipoTitular: TipoTitular;
    estado: EstadoSuscripcion;
    fechaFin: Date;
    colegio: TitularAnalitica | null;
    usuario: (TitularAnalitica & { email: string }) | null;
}

export interface SuscripcionPadreColegioCaido {
    id: string;
    usuario: {
        id: string;
        nombre: string | null;
        email: string;
        tenant: {
            colegio: {
                id: string;
                nombre: string;
                representanteLegalNombre: string;
                representanteLegalEmail: string;
                suscripciones: { estado: EstadoSuscripcion }[];
            } | null;
        } | null;
    } | null;
}

export interface AltaPais {
    paisCliente: string;
    createdAt: Date;
}

export interface KpiBase {
    recaudoMesActualUSD: number;
    recaudoMesAnteriorUSD: number;
    conteoPorEstado: { estado: EstadoSuscripcion; total: number }[];
    nuevasEsteMes: number;
    renovacionesEsteMes: number;
    ticketPromedioMesUSD: number | null;
    recaudoTotalUSD: number;
    suscripcionesPagantes: number;
    freemiumTotal: number;
    freemiumConvertidas: number;
    conCodigoReferido: number;
    totalSuscripciones: number;
}

export interface AnaliticaRepositorio {
    listarSuscripcionesVencenEntre(desdeUtc: Date, hastaUtc: Date): Promise<SuscripcionAnalitica[]>;
    listarMoraLargaAntesDe(fechaFinLimiteUtc: Date): Promise<SuscripcionAnalitica[]>;
    listarPadresPagantesColegiosNoRenovados(): Promise<SuscripcionPadreColegioCaido[]>;
    listarAltasPorPaisDesde(desdeUtc: Date): Promise<AltaPais[]>;
    obtenerKpiAnalitica(rangos: {
        mesActual: { inicio: Date; fin: Date };
        mesAnterior: { inicio: Date; fin: Date };
    }): Promise<KpiBase>;
}

// ── DTOs de salida (contrato GET /api/admin/estadisticas/dinero-vs-valor) ──

export interface KpiPagosDto {
    recaudoMesActualUSD: number;
    recaudoMesAnteriorUSD: number;
    variacionRecaudoPct: number | null;
    activas: number;
    enGracia: number;
    suspendidas: number;
    canceladas: number;
    nuevasEsteMes: number;
    renovacionesEsteMes: number;
    ticketPromedioUSD: number | null;
    ltvUSD: number | null;
    conversionFreemiumPct: number | null;
    tasaReferidosPct: number | null;
}

export interface ItemVencimientoDto {
    suscripcionId: string;
    nombre: string;
    rol: TipoTitular;
    email: string | null;
    fechaFin: string;
    diasRestantes: number;
}

export interface ItemMoraDto {
    suscripcionId: string;
    nombre: string;
    rol: TipoTitular;
    diasMora: number;
    estado: EstadoSuscripcion;
}

export interface ItemPadreColegioCaidoDto {
    padreId: string;
    padreNombre: string;
    colegioId: string;
    colegioNombre: string;
    colegioEstado: EstadoSuscripcion | null;
    rectorNombre: string;
    rectorEmail: string;
}

export interface CrecimientoPaisCiudadDto {
    labels: string[];
    series: SerieCrecimiento[];
}

export interface AnaliticaDineroVsValor {
    kpi: KpiPagosDto;
    widgets: {
        vencimientosEstaSemana: { total: number; items: ItemVencimientoDto[] };
        moraLarga: { total: number; items: ItemMoraDto[] };
        padresPagantesColegiosCaidos: { total: number; items: ItemPadreColegioCaidoDto[] };
        crecimientoPaisCiudad: CrecimientoPaisCiudadDto;
    };
}

// ── Caché en memoria por widget (FR-006) ──
// Module-level a propósito: la página/route crean una instancia por request y
// la caché debe sobrevivir entre requests del mismo proceso. La invalidación
// manual es `invalidarCacheAnalitica()` (tests y ajuste de parámetro).

const cache = new Map<string, { expiraEn: number; valor: unknown }>();

export function invalidarCacheAnalitica(): void {
    cache.clear();
}

export interface OpcionesAnalitica {
    /** TTL de la caché por widget en segundos (default 60). */
    cacheSegundos?: number;
    /** Reloj inyectable para tests. */
    ahora?: () => Date;
    /** Días mínimos de mora para el widget 2 (default 30). */
    diasMoraLarga?: number;
    /** Umbral % de anomalía de crecimiento (default 25). */
    umbralCrecimientoPct?: number;
}

const DIA_MS = 24 * 60 * 60 * 1000;

function titularDe(s: SuscripcionAnalitica): { nombre: string; email: string | null } {
    if (s.colegio) return { nombre: s.colegio.nombre ?? "—", email: null };
    if (s.usuario) return { nombre: s.usuario.nombre ?? s.usuario.email, email: s.usuario.email };
    return { nombre: "—", email: null };
}

export class AnaliticaPagosService {
    private readonly repo: AnaliticaRepositorio;
    private readonly cacheSegundos: number;
    private readonly ahora: () => Date;
    private readonly diasMoraLarga: number;
    private readonly umbralCrecimientoPct: number;

    constructor(repo: AnaliticaRepositorio, opciones: OpcionesAnalitica = {}) {
        this.repo = repo;
        this.cacheSegundos = opciones.cacheSegundos ?? 60;
        this.ahora = opciones.ahora ?? (() => new Date());
        this.diasMoraLarga = opciones.diasMoraLarga ?? DIAS_MORA_LARGA;
        this.umbralCrecimientoPct = opciones.umbralCrecimientoPct ?? UMBRAL_CRECIMIENTO_PCT;
    }

    private async conCache<T>(clave: string, fn: () => Promise<T>): Promise<T> {
        const hit = cache.get(clave);
        if (hit && hit.expiraEn > this.ahora().getTime()) {
            return hit.valor as T;
        }
        const valor = await fn();
        cache.set(clave, { expiraEn: this.ahora().getTime() + this.cacheSegundos * 1000, valor });
        return valor;
    }

    /** KPIs de la fila superior (BRIEF §9.2). */
    async obtenerKpi(): Promise<KpiPagosDto> {
        return this.conCache("kpi", async () => {
            const [mesAnteriorEtiqueta, mesActualEtiqueta] = ultimasEtiquetasMesBogota(2, this.ahora());
            const base = await this.repo.obtenerKpiAnalitica({
                mesActual: rangoMesUtc(mesActualEtiqueta!),
                mesAnterior: rangoMesUtc(mesAnteriorEtiqueta!),
            });

            const porEstado = new Map(base.conteoPorEstado.map((c) => [c.estado, c.total]));
            const pct = (parte: number, total: number): number | null =>
                total > 0 ? Math.round((parte / total) * 100) : null;

            return {
                recaudoMesActualUSD: base.recaudoMesActualUSD,
                recaudoMesAnteriorUSD: base.recaudoMesAnteriorUSD,
                variacionRecaudoPct: variacionPct(base.recaudoMesActualUSD, base.recaudoMesAnteriorUSD),
                activas: porEstado.get("ACTIVA" as EstadoSuscripcion) ?? 0,
                enGracia: porEstado.get("EN_GRACIA" as EstadoSuscripcion) ?? 0,
                suspendidas: porEstado.get("SUSPENDIDA" as EstadoSuscripcion) ?? 0,
                canceladas: porEstado.get("CANCELADA" as EstadoSuscripcion) ?? 0,
                nuevasEsteMes: base.nuevasEsteMes,
                renovacionesEsteMes: base.renovacionesEsteMes,
                ticketPromedioUSD:
                    base.ticketPromedioMesUSD === null ? null : Math.round(base.ticketPromedioMesUSD * 100) / 100,
                ltvUSD:
                    base.suscripcionesPagantes > 0
                        ? Math.round((base.recaudoTotalUSD / base.suscripcionesPagantes) * 100) / 100
                        : null,
                conversionFreemiumPct: pct(base.freemiumConvertidas, base.freemiumTotal),
                tasaReferidosPct: pct(base.conCodigoReferido, base.totalSuscripciones),
            };
        });
    }

    /** Widget 1: vencimientos de esta semana (hoy → hoy+7, FR-003). */
    async obtenerVencimientosEstaSemana(): Promise<{ total: number; items: ItemVencimientoDto[] }> {
        return this.conCache("vencimientos", async () => {
            const ahora = this.ahora();
            const hasta = new Date(ahora.getTime() + DIAS_VENCIMIENTOS_SEMANA * DIA_MS);
            const suscripciones = await this.repo.listarSuscripcionesVencenEntre(ahora, hasta);
            const items = suscripciones.map((s) => {
                const titular = titularDe(s);
                return {
                    suscripcionId: s.id,
                    nombre: titular.nombre,
                    rol: s.tipoTitular,
                    email: titular.email,
                    fechaFin: s.fechaFin.toISOString().slice(0, 10),
                    diasRestantes: diasRestantes(s.fechaFin, ahora),
                };
            });
            return { total: items.length, items };
        });
    }

    /** Widget 2: mora larga (>30 días por defecto), más antigua primero. */
    async obtenerMoraLarga(): Promise<{ total: number; items: ItemMoraDto[] }> {
        return this.conCache("mora", async () => {
            const ahora = this.ahora();
            const limite = new Date(ahora.getTime() - this.diasMoraLarga * DIA_MS);
            const suscripciones = await this.repo.listarMoraLargaAntesDe(limite);
            const items = suscripciones.map((s) => ({
                suscripcionId: s.id,
                nombre: titularDe(s).nombre,
                rol: s.tipoTitular,
                diasMora: diasDeMora(s.fechaFin, ahora),
                estado: s.estado,
            }));
            return { total: items.length, items };
        });
    }

    /** Widget 3: padres pagantes de colegios no renovados (vínculo explícito por tenant). */
    async obtenerPadresPagantesColegiosCaidos(): Promise<{ total: number; items: ItemPadreColegioCaidoDto[] }> {
        return this.conCache("padres-colegios-caidos", async () => {
            const suscripciones = await this.repo.listarPadresPagantesColegiosNoRenovados();
            const items: ItemPadreColegioCaidoDto[] = [];
            for (const s of suscripciones) {
                const colegio = s.usuario?.tenant?.colegio;
                if (!s.usuario || !colegio) continue;
                items.push({
                    padreId: s.usuario.id,
                    padreNombre: s.usuario.nombre ?? s.usuario.email,
                    colegioId: colegio.id,
                    colegioNombre: colegio.nombre,
                    colegioEstado: colegio.suscripciones[0]?.estado ?? null,
                    rectorNombre: colegio.representanteLegalNombre,
                    rectorEmail: colegio.representanteLegalEmail,
                });
            }
            return { total: items.length, items };
        });
    }

    /** Widget 4: crecimiento por país de los últimos 6 meses con alertas >25%. */
    async obtenerCrecimientoPaisCiudad(): Promise<CrecimientoPaisCiudadDto> {
        return this.conCache("crecimiento", async () => {
            const labels = ultimasEtiquetasMesBogota(MESES_HISTORICO_CRECIMIENTO, this.ahora());
            const desde = rangoMesUtc(labels[0]!).inicio;
            const altas = await this.repo.listarAltasPorPaisDesde(desde);
            return { labels, series: construirSeriesCrecimiento(altas, labels, this.umbralCrecimientoPct) };
        });
    }

    /** Payload completo del contrato: KPIs + 4 widgets. */
    async obtenerAnalitica(): Promise<AnaliticaDineroVsValor> {
        const [kpi, vencimientosEstaSemana, moraLarga, padresPagantesColegiosCaidos, crecimientoPaisCiudad] =
            await Promise.all([
                this.obtenerKpi(),
                this.obtenerVencimientosEstaSemana(),
                this.obtenerMoraLarga(),
                this.obtenerPadresPagantesColegiosCaidos(),
                this.obtenerCrecimientoPaisCiudad(),
            ]);
        return {
            kpi,
            widgets: { vencimientosEstaSemana, moraLarga, padresPagantesColegiosCaidos, crecimientoPaisCiudad },
        };
    }
}

export type { AlertaCrecimiento };
