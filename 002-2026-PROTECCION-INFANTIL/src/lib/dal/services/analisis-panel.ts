/**
 * SPEC-222 (002-PI-123): servicio del panel principal Análisis (Dinero vs
 * Valor). Orquesta el repositorio DAL (`analisis-panel-repository`), los
 * helpers puros (`@/lib/analisis/panel-calculos`) y los parámetros
 * `analisis.panel.*` / `analisis.anomalias.crecimiento_pct_umbral`.
 *
 * Agregados exclusivamente comerciales: nunca texto de reportes ni PII de
 * menores/denunciantes (FR-015). Los scores son métricas comerciales de uso
 * del servicio, visibles solo para ADMIN; nunca se presentan como veredictos
 * de personas (presunción de inocencia).
 */
import type { EstadoSuscripcion, TipoTitular } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { getParametroSistemaValor } from "@/lib/parametros";
import {
    calcularCuadrante,
    calcularSemaforo,
    claveCohorteBogota,
    clasificarCanal,
    deltaPct,
    mediana,
    mensualizarPrecio,
    periodoScoreDeRango,
    rangoAnteriorEquivalente,
    resolverRangoPeriodo,
    CANALES_ORDENADOS,
    type CanalCliente,
    type Cuadrante,
    type Semaforo,
} from "@/lib/analisis/panel-calculos";
import { ZONA_BOGOTA } from "@/lib/analisis/periodos";
import type {
    AnomaliasQuery,
    DineroVsValorQuery,
    DispersionQuery,
    GranularidadPanel,
    KpisQuery,
} from "@/lib/schemas/analisis-panel";
import {
    AnalisisPanelRepository,
    type FiltrosPanel,
    type SuscripcionBasePanel,
} from "../repositories/analisis-panel-repository";
import type {
    AnomaliaItem,
    FilaGranularidad,
    Paginacion,
    ResultadoAnomalias,
    ResultadoDineroVsValor,
    ResultadoDispersion,
    ResultadoKpis,
    TopDecisionItem,
} from "./analisis-panel-tipos";

// Los tipos de respuesta viven en `analisis-panel-tipos.ts` (techo E-8); se
// re-exportan para que los consumidores sigan importando del servicio.
export type {
    AnomaliaItem,
    FilaGranularidad,
    KpiValor,
    Paginacion,
    PuntoDispersion,
    ResultadoAnomalias,
    ResultadoDineroVsValor,
    ResultadoDispersion,
    ResultadoKpis,
    TopDecisionItem,
} from "./analisis-panel-tipos";

// ── Constantes ─────────────────────────────────────────────────────────────

const PESO_SEVERIDAD: Record<string, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };
const UMBRAL_CAIDA_DEFAULT = 25;
const DISPERSION_MAX_PUNTOS_DEFAULT = 500;
const ETIQUETA_SIN_CIUDAD = "Sin ciudad";
const ETIQUETA_CANAL: Record<CanalCliente, string> = {
    referido: "Referido",
    bono: "Bono",
    freemium_convertido: "Freemium convertido",
    directo: "Directo",
};

function parseParamFloat(valor: string | null): number | null {
    if (!valor) return null;
    const n = parseFloat(valor);
    return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseParamEntero(valor: string | null, fallback: number): number {
    if (!valor) return fallback;
    const n = parseInt(valor, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function redondear2(n: number): number {
    return Math.round(n * 100) / 100;
}

/** Contacto derivado de `datosContexto` (Json) si trae teléfono/email. */
function extraerContacto(datosContexto: unknown): TopDecisionItem["contacto"] {
    if (typeof datosContexto !== "object" || datosContexto === null) return null;
    const ctx = datosContexto as Record<string, unknown>;
    const telefono = typeof ctx.telefono === "string" ? ctx.telefono : null;
    const email = typeof ctx.email === "string" ? ctx.email : null;
    if (!telefono && !email) return null;
    return { telefono, email };
}

function paginar<T>(items: T[], page: number, pageSize: number): { items: T[]; pagination: Paginacion } {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const inicio = (page - 1) * pageSize;
    return { items: items.slice(inicio, inicio + pageSize), pagination: { page, pageSize, total, totalPages } };
}

export class AnalisisPanelService {
    private readonly repo: AnalisisPanelRepository;

    constructor(repo?: AnalisisPanelRepository) {
        this.repo = repo ?? new AnalisisPanelRepository();
    }

    // ── Top 5 decisiones (US-1, FR-003) ─────────────────────────────────────

    async topDecisiones(): Promise<{ items: TopDecisionItem[] }> {
        const recomendaciones = await this.repo.listarTopDecisiones(new Date());
        return {
            items: recomendaciones.map((r) => ({
                id: r.id,
                titulo: r.titulo,
                descripcion: r.descripcion,
                categoria: r.categoria,
                prioridad: r.prioridad,
                generadaEn: r.generadaEn.toISOString(),
                expiraEn: r.expiraEn.toISOString(),
                sujetoTipo: r.sujetoTipo,
                sujetoId: r.sujetoId,
                accionSugerida: r.accionSugerida,
                contacto: extraerContacto(r.datosContexto),
            })),
        };
    }

    // ── Agregación por granularidad (US-3, FR-005/FR-006) ───────────────────

    async dineroVsValor(query: DineroVsValorQuery): Promise<ResultadoDineroVsValor> {
        const rango = resolverRangoPeriodo(query);
        const periodoScore = periodoScoreDeRango(rango);
        const filtros: FiltrosPanel = {
            estado: query.estado === "todas" ? undefined : (query.estado as EstadoSuscripcion),
            tipoTitular: query.tipoTitular === "ambos" ? undefined : (query.tipoTitular as TipoTitular),
            paisId: query.paisId,
            ciudadId: query.ciudadId,
            colegioId: query.colegioId,
        };

        const [base, umbralCaidaParam] = await Promise.all([
            this.repo.listarBaseSuscripciones(filtros, rango, periodoScore),
            getParametroSistemaValor("analisis.anomalias.crecimiento_pct_umbral"),
        ]);
        const umbralCaida = parseParamFloat(umbralCaidaParam) ?? UMBRAL_CAIDA_DEFAULT;

        // Padres bajo filtro geográfico: solo si su `paisCliente` coincide con
        // el país del nivel (su única geografía confiable, Edge Case del spec).
        const filtradas = await this.filtrarPadresPorGeografia(base, query.paisId, query.ciudadId);

        // Variación de recaudo vs período anterior equivalente (UN groupBy).
        const ids = filtradas.map((s) => s.id);
        const recaudoAnterior = await this.repo.sumarRecaudoPorSuscripcion(ids, rangoAnteriorEquivalente(rango));

        const grupos = this.agrupar(filtradas, query.granularidad);
        const filas: FilaGranularidad[] = grupos.map((grupo) =>
            this.construirFila(grupo, query.granularidad, recaudoAnterior, umbralCaida, query)
        );
        // FR-018: la granularidad canal conserva el orden de precedencia fijo
        // (ya ordenado en `agrupar`); el resto se ordena por recaudo desc.
        if (query.granularidad !== "canal") {
            filas.sort((a, b) => b.recaudoUSD - a.recaudoUSD || a.etiqueta.localeCompare(b.etiqueta));
        }

        const { items, pagination } = paginar(filas, query.page, query.pageSize);
        const conScore = filtradas.filter((s) => s.scoreClientes.length > 0);
        return {
            items,
            pagination,
            totales: {
                suscripciones: filtradas.length,
                recaudoUSD: redondear2(filtradas.reduce((acc, s) => acc + recaudoDe(s), 0)),
                scorePromedio: promedio(conScore.map((s) => s.scoreClientes[0]!.scoreTotal)),
                sinScore: filtradas.length - conScore.length,
            },
            breadcrumb: await this.construirBreadcrumb(query),
        };
    }

    /** Filtra padres según el nivel geográfico activo (paisCliente vs país del nivel). */
    private async filtrarPadresPorGeografia(
        base: SuscripcionBasePanel[],
        paisId?: string,
        ciudadId?: string
    ): Promise<SuscripcionBasePanel[]> {
        if (!paisId && !ciudadId) return base;
        let codigoPais: string | null = null;
        if (paisId) {
            codigoPais = await this.repo.obtenerCodigoPais(paisId);
        } else if (ciudadId) {
            const ciudad = await this.repo.obtenerCiudadConPais(ciudadId);
            codigoPais = ciudad ? await this.repo.obtenerCodigoPais(ciudad.paisId) : null;
        }
        if (!codigoPais) {
            // País/ciudad desconocido: sin referencia no se puede contrastar;
            // se excluyen los padres (los colegios ya filtró la query).
            return base.filter((s) => s.tipoTitular !== "PADRE");
        }
        return base.filter((s) => {
            if (s.tipoTitular !== "PADRE") return true;
            if (ciudadId && s.colegioId) return true; // padre vinculado a colegio: ya filtró la query
            return s.paisCliente === codigoPais;
        });
    }

    /** Agrupa la base según la granularidad activa. */
    private agrupar(
        base: SuscripcionBasePanel[],
        granularidad: GranularidadPanel
    ): { clave: string; etiqueta: string; miembros: SuscripcionBasePanel[] }[] {
        const mapa = new Map<string, { clave: string; etiqueta: string; miembros: SuscripcionBasePanel[] }>();
        const push = (clave: string, etiqueta: string, s: SuscripcionBasePanel) => {
            const existente = mapa.get(clave);
            if (existente) existente.miembros.push(s);
            else mapa.set(clave, { clave, etiqueta, miembros: [s] });
        };
        for (const s of base) {
            switch (granularidad) {
                case "pais":
                    if (s.colegio) push(`pais-${s.colegio.paisId}`, s.colegio.pais.nombre, s);
                    else push(`pais-cliente-${s.paisCliente}`, s.paisCliente, s);
                    break;
                case "ciudad":
                    if (s.colegio) push(`ciudad-${s.colegio.ciudadId}`, s.colegio.ciudad.nombre, s);
                    else push(`sin-ciudad-${s.paisCliente}`, ETIQUETA_SIN_CIUDAD, s);
                    break;
                case "colegio":
                    if (s.colegio) push(`colegio-${s.colegio.id}`, s.colegio.nombre, s);
                    break;
                case "padre":
                    if (s.tipoTitular === "PADRE") push(`padre-${s.id}`, s.usuario?.nombre ?? "Cliente", s);
                    break;
                case "plan":
                    push(`plan-${s.planActual.tipoTitular}-${s.planActual.duracion}`, `${s.planActual.nombre}`, s);
                    break;
                case "cohorte":
                    push(`cohorte-${claveCohorteBogota(s.fechaInicio)}`, claveCohorteBogota(s.fechaInicio), s);
                    break;
                case "canal": {
                    const canal = clasificarCanal({
                        codigoReferidoUsado: s.codigoReferidoUsado,
                        tieneBono: s.bonosAplicados.length > 0,
                        esFreemiumConPagoAutorizado: s.esFreemium && s._count.pagos > 0,
                    });
                    push(`canal-${canal}`, ETIQUETA_CANAL[canal], s);
                    break;
                }
            }
        }
        // Canal: orden fijo por precedencia documentada (FR-018).
        const grupos = [...mapa.values()];
        if (granularidad === "canal") {
            grupos.sort(
                (a, b) =>
                    CANALES_ORDENADOS.indexOf(a.clave.replace("canal-", "") as CanalCliente) -
                    CANALES_ORDENADOS.indexOf(b.clave.replace("canal-", "") as CanalCliente)
            );
        }
        return grupos;
    }

    private construirFila(
        grupo: { clave: string; etiqueta: string; miembros: SuscripcionBasePanel[] },
        granularidad: GranularidadPanel,
        recaudoAnterior: Map<string, number>,
        umbralCaida: number,
        query: DineroVsValorQuery
    ): FilaGranularidad {
        const recaudo = grupo.miembros.reduce((acc, s) => acc + recaudoDe(s), 0);
        const anterior = grupo.miembros.reduce((acc, s) => acc + (recaudoAnterior.get(s.id) ?? 0), 0);
        const variacion = deltaPct(recaudo, anterior);
        const conScore = grupo.miembros.filter((s) => s.scoreClientes.length > 0);

        const fila: FilaGranularidad = {
            clave: granularidad === "cohorte" ? grupo.etiqueta : grupo.clave,
            etiqueta: grupo.etiqueta,
            suscripciones: grupo.miembros.length,
            recaudoUSD: redondear2(recaudo),
            scorePromedio: promedio(conScore.map((s) => s.scoreClientes[0]!.scoreTotal)),
            variacionRecaudoPct: variacion === null ? null : redondear2(variacion),
            semaforo: calcularSemaforo(variacion, umbralCaida),
            drill: drillDeFila(grupo, granularidad, query),
            suscripcionId:
                granularidad === "colegio" || granularidad === "padre"
                    ? (grupo.miembros[0]?.id ?? null)
                    : null,
        };
        if (granularidad === "cohorte") {
            const retenidos = grupo.miembros.filter((s) => s.estado === "ACTIVA" || s.estado === "EN_GRACIA").length;
            fila.retenidosPct = grupo.miembros.length > 0 ? redondear2((retenidos / grupo.miembros.length) * 100) : 0;
        }
        if (granularidad === "plan") {
            const renovadas = grupo.miembros.filter((s) => s._count.pagos > 1).length;
            fila.renovacionPct = grupo.miembros.length > 0 ? redondear2((renovadas / grupo.miembros.length) * 100) : 0;
        }
        return fila;
    }

    /** Breadcrumb derivado de los filtros de drill activos (FR-006). */
    private async construirBreadcrumb(
        query: DineroVsValorQuery
    ): Promise<ResultadoDineroVsValor["breadcrumb"]> {
        const niveles: ResultadoDineroVsValor["breadcrumb"] = [];
        if (query.paisId) {
            const nombre = await this.repo.obtenerNombrePais(query.paisId);
            if (nombre) niveles.push({ nivel: "pais", id: query.paisId, etiqueta: nombre });
        }
        if (query.ciudadId) {
            const ciudad = await this.repo.obtenerCiudadConPais(query.ciudadId);
            if (ciudad) niveles.push({ nivel: "ciudad", id: query.ciudadId, etiqueta: ciudad.nombre });
        }
        if (query.colegioId) {
            const nombre = await this.repo.obtenerNombreColegio(query.colegioId);
            if (nombre) niveles.push({ nivel: "colegio", id: query.colegioId, etiqueta: nombre });
        }
        return niveles;
    }

    // ── Dispersión (US-2, FR-007/FR-008) ────────────────────────────────────

    async dispersion(query: DispersionQuery): Promise<ResultadoDispersion> {
        const rango = resolverRangoPeriodo(query);
        const periodoScore = periodoScoreDeRango(rango);
        const filtros: FiltrosPanel = {
            estado: query.estado === "todas" ? undefined : (query.estado as EstadoSuscripcion),
            tipoTitular: query.tipoTitular === "ambos" ? undefined : (query.tipoTitular as TipoTitular),
        };

        const [base, umbralMontoParam, umbralScoreParam, maxPuntosParam] = await Promise.all([
            this.repo.listarBaseSuscripciones(filtros, rango, periodoScore),
            getParametroSistemaValor("analisis.panel.umbral_monto_usd"),
            getParametroSistemaValor("analisis.panel.umbral_score"),
            getParametroSistemaValor("analisis.panel.dispersion_max_puntos"),
        ]);
        const maxPuntos = parseParamEntero(maxPuntosParam, DISPERSION_MAX_PUNTOS_DEFAULT);

        const conScore = base.filter((s) => s.scoreClientes.length > 0);
        const candidatos = conScore.map((s) => ({
            suscripcionId: s.id,
            cliente: s.colegio?.nombre ?? s.usuario?.nombre ?? "Cliente",
            tipoTitular: s.tipoTitular,
            montoUSD: redondear2(recaudoDe(s)),
            scoreTotal: s.scoreClientes[0]!.scoreTotal,
        }));

        // Cortes: parámetros si AMBOS existen; si no, mediana del dataset (FR-008).
        const corteMontoParam = parseParamFloat(umbralMontoParam);
        const corteScoreParam = parseParamFloat(umbralScoreParam);
        const desdeParametros = corteMontoParam !== null && corteScoreParam !== null;
        const corteMonto = corteMontoParam ?? mediana(candidatos.map((c) => c.montoUSD)) ?? 0;
        const corteScore = corteScoreParam ?? mediana(candidatos.map((c) => c.scoreTotal)) ?? 0;

        // Truncado determinístico: muestra ordenada por suscripcionId.
        const ordenados = [...candidatos].sort((a, b) => a.suscripcionId.localeCompare(b.suscripcionId));
        const muestra = ordenados.slice(0, maxPuntos);

        return {
            puntos: muestra.map((c) => ({
                ...c,
                cuadrante: calcularCuadrante(c.montoUSD, c.scoreTotal, corteMonto, corteScore),
            })),
            cortes: { montoUSD: corteMonto, score: corteScore, fuente: desdeParametros ? "parametro" : "mediana" },
            truncado: ordenados.length > maxPuntos,
            totalSuscripciones: base.length,
            sinScore: base.length - conScore.length,
        };
    }

    // ── KPIs (US-4, FR-009) ─────────────────────────────────────────────────

    async kpis(query: KpisQuery): Promise<ResultadoKpis> {
        const rango = resolverRangoPeriodo(query);
        const anterior = rangoAnteriorEquivalente(rango);

        const [
            mau,
            mauAnterior,
            activas,
            canceladas,
            canceladasAnterior,
            activasAlInicio,
            activasAlInicioAnterior,
            ltvActual,
            ltvAnterior,
            pagosPeriodo,
            pagosAnterior,
            primerPago,
            freemium,
            freemiumConvertidas,
            referidos,
            referidosAnterior,
        ] = await Promise.all([
            this.repo.contarMau(rango),
            this.repo.contarMau(anterior),
            this.repo.listarSuscripcionesActivasConPlan(),
            this.repo.contarCanceladas(rango),
            this.repo.contarCanceladas(anterior),
            this.repo.contarActivasAlInicio(rango.desde),
            this.repo.contarActivasAlInicio(anterior.desde),
            this.repo.sumarRecaudoHistoricoPorSuscripcion(),
            this.repo.sumarRecaudoHistoricoPorSuscripcion(anterior.hasta),
            this.repo.listarPagosAutorizados(rango),
            this.repo.listarPagosAutorizados(anterior),
            this.repo.primerPagoAutorizadoPorSuscripcion(),
            this.repo.contarFreemium(),
            this.repo.contarFreemiumConvertidas(),
            this.repo.contarReferidos(rango),
            this.repo.contarReferidos(anterior),
        ]);

        // MRR: suscripciones ACTIVA mensualizadas. El valor "anterior" es la
        // aproximación documentada: activas actuales que ya existían al cierre
        // del período anterior (no hay snapshots históricos de estado).
        const mrr = activas.reduce((acc, s) => acc + mensualizarPrecio(s.planActual.precioBaseUSD, s.planActual.duracion), 0);
        const mrrAnterior = activas
            .filter((s) => s.fechaInicio < anterior.hasta)
            .reduce((acc, s) => acc + mensualizarPrecio(s.planActual.precioBaseUSD, s.planActual.duracion), 0);

        const churn = activasAlInicio > 0 ? (canceladas / activasAlInicio) * 100 : 0;
        const churnAnterior = activasAlInicioAnterior > 0 ? (canceladasAnterior / activasAlInicioAnterior) * 100 : 0;

        const ltv = ltvActual.length > 0 ? ltvActual.reduce((a, b) => a + b, 0) / ltvActual.length : 0;
        const ltvAnt = ltvAnterior.length > 0 ? ltvAnterior.reduce((a, b) => a + b, 0) / ltvAnterior.length : 0;

        const renovaciones = porcentajeRenovaciones(pagosPeriodo, primerPago);
        const renovacionesAnterior = porcentajeRenovaciones(pagosAnterior, primerPago);

        const conversionFreemium = freemium > 0 ? (freemiumConvertidas / freemium) * 100 : 0;
        const referidosPct = referidos.total > 0 ? (referidos.activados / referidos.total) * 100 : 0;
        const referidosPctAnterior =
            referidosAnterior.total > 0 ? (referidosAnterior.activados / referidosAnterior.total) * 100 : 0;

        return {
            kpis: {
                mau: { valor: mau, deltaPct: deltaPct(mau, mauAnterior) },
                mrrUSD: { valor: redondear2(mrr), deltaPct: deltaPct(mrr, mrrAnterior) },
                churnRatePct: { valor: redondear2(churn), deltaPct: deltaPct(churn, churnAnterior) },
                ltvUSD: { valor: redondear2(ltv), deltaPct: deltaPct(ltv, ltvAnt) },
                renovacionesPct: { valor: redondear2(renovaciones), deltaPct: deltaPct(renovaciones, renovacionesAnterior) },
                // Stock histórico sin equivalente de período: delta null (contrato).
                conversionFreemiumPct: { valor: redondear2(conversionFreemium), deltaPct: null },
                referidosExitososPct: { valor: redondear2(referidosPct), deltaPct: deltaPct(referidosPct, referidosPctAnterior) },
            },
            periodo: {
                desde: formatInTimeZone(rango.desde, ZONA_BOGOTA, "yyyy-MM-dd"),
                // `hasta` es exclusivo: se muestra el último día incluido.
                hasta: formatInTimeZone(new Date(rango.hasta.getTime() - 1), ZONA_BOGOTA, "yyyy-MM-dd"),
                zona: ZONA_BOGOTA,
            },
        };
    }

    // ── Anomalías (US-5, FR-010) ────────────────────────────────────────────

    async anomalias(query: AnomaliasQuery): Promise<ResultadoAnomalias> {
        const severidad = query.severidad === "todas" ? undefined : query.severidad;
        const lista = await this.repo.listarAnomaliasNoResueltas(severidad);
        if (lista === null) {
            // Degradación elegante: modelo de SPEC-225 aún no desplegado.
            return { items: [], pagination: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 1 }, disponible: false };
        }
        const ordenadas = [...lista].sort((a, b) => {
            const peso = (PESO_SEVERIDAD[a.severidad] ?? 3) - (PESO_SEVERIDAD[b.severidad] ?? 3);
            if (peso !== 0) return peso;
            return b.detectadaEn.getTime() - a.detectadaEn.getTime();
        });
        const { items, pagination } = paginar(ordenadas, query.page, query.pageSize);
        return {
            items: items.map((a) => ({
                id: a.id,
                tipo: a.tipo,
                severidad: a.severidad,
                descripcion: a.descripcion,
                sujetoTipo: a.sujetoTipo,
                sujetoId: a.sujetoId,
                detectadaEn: a.detectadaEn.toISOString(),
            })),
            pagination,
            disponible: true,
        };
    }
}

// ── Helpers del servicio ───────────────────────────────────────────────────

function recaudoDe(s: SuscripcionBasePanel): number {
    return s.pagos.reduce((acc, p) => acc + p.montoNetoUSD, 0);
}

function promedio(valores: number[]): number | null {
    if (valores.length === 0) return null;
    return redondear2(valores.reduce((a, b) => a + b, 0) / valores.length);
}

/** Drill del nivel actual al siguiente (null en el nivel hoja, FR-006). */
function drillDeFila(
    grupo: { clave: string; miembros: SuscripcionBasePanel[] },
    granularidad: GranularidadPanel,
    query: DineroVsValorQuery
): FilaGranularidad["drill"] {
    const primero = grupo.miembros[0];
    if (!primero) return null;
    switch (granularidad) {
        case "pais":
            if (!primero.colegio) return null; // bucket de padres por código de país: sin drill relacional
            return { granularidad: "ciudad", params: { paisId: primero.colegio.paisId } };
        case "ciudad":
            if (!primero.colegio) return null; // bucket "Sin ciudad"
            return {
                granularidad: "colegio",
                params: { ...(query.paisId ? { paisId: query.paisId } : { paisId: primero.colegio.paisId }), ciudadId: primero.colegio.ciudadId },
            };
        default:
            return null; // colegio/padre/plan/cohorte/canal: nivel hoja o sin drill
    }
}

/** % de pagos del período que son renovación (no primer pago de la suscripción). */
function porcentajeRenovaciones(
    pagos: { id: string; suscripcionId: string; createdAt: Date }[],
    primerPago: Map<string, Date>
): number {
    if (pagos.length === 0) return 0;
    const renovaciones = pagos.filter((p) => {
        const primero = primerPago.get(p.suscripcionId);
        return primero !== undefined && p.createdAt.getTime() > primero.getTime();
    }).length;
    return (renovaciones / pagos.length) * 100;
}
