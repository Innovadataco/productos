/**
 * SPEC-053 (FR-005, US2): ConsultaPublicaService.
 * Agrega los datos públicos de un identificador (plataformas, ubicaciones,
 * timeline, categorías) y aplica las reglas de visibilidad leyendo parámetros
 * vía `src/lib/parametros.ts` / `ParametroRepository`. El cálculo de riesgo
 * descriptivo delega en `src/lib/riesgo-consulta.ts` (RiesgoConsultaService
 * existente). Sin score ni juicio sobre la persona (spec 089-US6).
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import type { CategoriaConducta } from "@prisma/client";
import { formatPlataforma, formatPlataformasResumen } from "@/lib/plataforma";
import { whereReporteAprobado, CATEGORIAS_NO_APROBADAS } from "@/lib/reporte-aprobado";
import { whereReporteEnEstados } from "@/lib/reportes-acceso";
import { obtenerSeveridades } from "@/lib/scoring";
import { getParametroSistema } from "@/lib/parametros";
import { getRiesgoConsultaParams, calcularRiesgoConsulta } from "@/lib/riesgo-consulta";
import { obtenerGruposCategoria, nombreGrupoParaCategoria } from "@/lib/categoria-grupos";
import type { EstadoReporte } from "@prisma/client";
import { ReporteRepository } from "../repositories/reporte";
import { ParametroRepository } from "../repositories/parametro";
import type {
    ConsultaDetalleDto,
    ConsultaPlataformaDto,
    ConsultaResumenDto,
    ConsultaUbicacionDetalleDto,
} from "../types/consulta";

const ESTADOS_VISIBLES = ["CLASIFICADO", "CORREGIDO"] as EstadoReporte[];

const CATEGORIA_LABELS: Record<string, string> = {
    CONTACTO_INSISTENTE: "Contacto insistente",
    SOLICITUD_MATERIAL: "Solicitud de material",
    OFRECIMIENTO_REGALOS: "Ofrecimiento de regalos",
    SUPLANTACION_IDENTIDAD: "Suplantación de identidad",
    SOLICITUD_ENCUENTRO: "Solicitud de encuentro",
    COMPARTIMIENTO_SEXUAL: "Compartimiento sexual",
    OTRO: "Otro",
    EXTORSION: "Extorsión",
    CONTENIDO_GENERADO_IA: "Contenido generado por IA",
    DIFUSION_NO_CONSENTIDA: "Difusión no consentida",
    DOXING: "Doxing",
    SPAM: "Spam",
};

function formatFecha(date: Date | string) {
    return new Date(date).toISOString().slice(0, 10);
}

function agregarPlataformas(reportes: Array<{ plataforma: { id: string; nombre: string; clave: string }; otraPlataforma: string | null }>): ConsultaPlataformaDto[] {
    const porPlataforma = new Map<string, ConsultaPlataformaDto>();
    for (const r of reportes) {
        const p = r.plataforma;
        const key = p.clave === "otro" && r.otraPlataforma ? `otro:${r.otraPlataforma}` : p.id;
        const actual = porPlataforma.get(key) || {
            id: p.id,
            nombre: formatPlataforma(p.nombre, r.otraPlataforma, p.clave),
            clave: p.clave,
            total: 0,
            otraPlataforma: p.clave === "otro" ? r.otraPlataforma : null,
        };
        actual.total += 1;
        porPlataforma.set(key, actual);
    }
    return Array.from(porPlataforma.values()).sort((a, b) => b.total - a.total);
}

export class ConsultaPublicaService {
    private readonly reportes: ReporteRepository;
    private readonly parametros: ParametroRepository;

    constructor(tx?: Prisma.TransactionClient) {
        this.reportes = new ReporteRepository(tx);
        this.parametros = new ParametroRepository(tx);
    }

    /**
     * GET/POST /api/consulta — resumen público con divulgación progresiva:
     * anónimo = resumen; autenticado = ciudad, timeline, plataformas completas.
     */
    async resumen(identificador: string, autenticado: boolean): Promise<ConsultaResumenDto> {
        // Parámetros de visibilidad (listado del dashboard; la consulta directa
        // siempre muestra detalle — spec 089-US5).
        const paramUmbral = await this.parametros.findByClave("visibility.report_threshold");
        const paramRatio = await this.parametros.findByClave("visibility.min_authenticated_ratio");
        const paramActividad = await getParametroSistema("visibility.actividad_alta_min");
        const umbral = parseInt(paramUmbral?.valor || "3", 10);
        const minRatio = parseFloat(paramRatio?.valor || "0.5");
        const actividadAltaMin = parseInt(paramActividad?.valor || "5", 10);

        const reportes = await this.reportes.findAprobadosPorIdentificador(
            whereReporteAprobado({ identificador })
        );

        if (reportes.length === 0) {
            return {
                identificador,
                tieneReportes: false,
                mensaje: "Sin reportes registrados para este identificador.",
            };
        }

        const totalReportes = reportes.length;
        const reportesAutenticados = reportes.filter((r) => !r.esAnonimo).length;
        const reportesAnonimos = totalReportes - reportesAutenticados;
        const ratioAutenticados = totalReportes > 0 ? reportesAutenticados / totalReportes : 0;
        const visibleEnDashboard = totalReportes >= umbral && ratioAutenticados >= minRatio;
        const ultimoReporte = reportes[0]?.creadoEn ?? null;
        const primerReporte = reportes[reportes.length - 1]?.creadoEn ?? null;

        // Señal descriptiva (US5/US6): describe los DATOS, no el riesgo del identificador.
        const actividad = totalReportes >= actividadAltaMin ? ("alta" as const) : ("baja" as const);

        const plataformas = agregarPlataformas(reportes);

        // Categorías (US4): principal + secundarias, sin SPAM/OTRO, ordenadas por gravedad.
        const severidades = await obtenerSeveridades();
        const conteoCategorias = new Map<string, number>();
        for (const r of reportes) {
            const principal = r.clasificacion?.categoria;
            if (principal && !(CATEGORIAS_NO_APROBADAS as readonly string[]).includes(principal)) {
                conteoCategorias.set(principal, (conteoCategorias.get(principal) ?? 0) + 1);
            }
            const secundarias = (r.clasificacion?.categoriasSecundarias ?? []) as Array<{ categoria?: string }>;
            for (const s of secundarias) {
                const cat = s.categoria;
                if (cat && !(CATEGORIAS_NO_APROBADAS as readonly string[]).includes(cat)) {
                    conteoCategorias.set(cat, (conteoCategorias.get(cat) ?? 0) + 1);
                }
            }
        }
        const categorias = Array.from(conteoCategorias.entries())
            .map(([categoria, total]) => ({ categoria, total, severidad: severidades[categoria as CategoriaConducta] ?? 0 }))
            .sort((a, b) => b.severidad - a.severidad || b.total - a.total)
            .map(({ categoria, total }) => ({ categoria, total }));

        // Ubicación: anónimo = rollup por PAÍS; autenticado = departamento/ciudad.
        let ubicaciones: ConsultaResumenDto["ubicaciones"];
        if (!autenticado) {
            const porPais = new Map<string, number>();
            for (const r of reportes) {
                porPais.set(r.pais, (porPais.get(r.pais) ?? 0) + 1);
            }
            ubicaciones = Array.from(porPais.entries())
                .map(([pais, total]) => ({ pais, total }))
                .sort((a, b) => b.total - a.total);
        } else {
            const porUbicacion = new Map<string, ConsultaUbicacionDetalleDto>();
            for (const r of reportes) {
                const departamento = r.ciudadRel?.departamento?.nombre ?? null;
                const ciudad = r.ciudadRel?.nombre ?? r.ciudad;
                const key = `${r.pais}|${departamento ?? ""}|${ciudad}`;
                const actual = porUbicacion.get(key) || {
                    pais: r.pais,
                    departamento,
                    ciudad,
                    total: 0,
                    lat: r.ciudadRel?.lat ?? null,
                    lng: r.ciudadRel?.lng ?? null,
                };
                actual.total += 1;
                porUbicacion.set(key, actual);
            }
            ubicaciones = Array.from(porUbicacion.values()).sort((a, b) => b.total - a.total);
        }

        const ciudadesUnicas = new Set(reportes.map((r) => r.ciudad)).size;
        const paisesUnicos = new Set(reportes.map((r) => r.pais)).size;

        const respuesta: ConsultaResumenDto = {
            identificador,
            tieneReportes: true,
            visibleEnDashboard,
            actividad,
            totalReportes,
            reportesAutenticados,
            reportesAnonimos,
            plataformas,
            resumenPlataformas: formatPlataformasResumen(plataformas, totalReportes),
            categorias,
            ubicaciones,
            autenticado,
        };

        // Divulgación progresiva (US5/US7): detalle solo autenticado.
        if (autenticado) {
            const porMes = new Map<string, number>();
            for (const r of reportes) {
                const mes = formatFecha(r.creadoEn).slice(0, 7);
                porMes.set(mes, (porMes.get(mes) || 0) + 1);
            }
            const timeline = Array.from(porMes.entries())
                .map(([mes, total]) => ({ mes, total }))
                .sort((a, b) => a.mes.localeCompare(b.mes));

            respuesta.primerReporte = primerReporte?.toISOString() ?? null;
            respuesta.ultimoReporte = ultimoReporte?.toISOString() ?? null;
            respuesta.timeline = timeline;
            respuesta.resumen = `Se han reportado ${totalReportes} vez(es) entre ${formatFecha(primerReporte || new Date())} y ${formatFecha(ultimoReporte || new Date())} en ${ciudadesUnicas} ciudad(es) de ${paisesUnicos} país(es) y ${plataformas.length} plataforma(s).`;
        }

        return respuesta;
    }

    /**
     * GET/POST /api/consulta/detalle — detalle autenticado con riesgo descriptivo
     * (módulo `src/lib/riesgo-consulta.ts`) y mapeo a DTOs de dominio.
     */
    async detalle(identificador: string): Promise<ConsultaDetalleDto> {
        const reportes = await this.reportes.findVisiblesPorIdentificador(
            whereReporteEnEstados(ESTADOS_VISIBLES, { identificador })
        );

        if (reportes.length === 0) {
            return {
                identificador,
                tieneReportes: false,
                mensaje: "Sin reportes registrados para este identificador.",
            };
        }

        const riesgoParams = await getRiesgoConsultaParams();
        const riesgoGlobal = calcularRiesgoConsulta(reportes, riesgoParams);
        const gruposCategoria = await obtenerGruposCategoria();

        const totalReportes = reportes.length;
        const reportesAutenticados = reportes.filter((r) => !r.esAnonimo).length;
        const reportesAnonimos = totalReportes - reportesAutenticados;
        const ultimoReporte = reportes[0]?.creadoEn ?? null;

        const plataformas = agregarPlataformas(reportes);

        const porUbicacion = new Map<string, ConsultaUbicacionDetalleDto>();
        for (const r of reportes) {
            const key = `${r.pais}|${r.ciudad}`;
            const actual = porUbicacion.get(key) || {
                pais: r.pais,
                ciudad: r.ciudad,
                total: 0,
                lat: r.ciudadRel?.lat ?? null,
                lng: r.ciudadRel?.lng ?? null,
            };
            actual.total += 1;
            porUbicacion.set(key, actual);
        }
        const ubicaciones = Array.from(porUbicacion.values()).sort((a, b) => b.total - a.total);

        const itemsReportes = reportes.map((r) => {
            const riesgoIndividual = calcularRiesgoConsulta([r], riesgoParams);
            const categoria = r.clasificacion?.categoria ?? "OTRO";
            return {
                id: r.id,
                plataforma: formatPlataforma(r.plataforma.nombre, r.otraPlataforma, r.plataforma.clave),
                esAnonimo: r.esAnonimo,
                fecha: formatFecha(r.creadoEn),
                categoria,
                categoriaLabel: CATEGORIA_LABELS[categoria] || "Otro",
                categoriaGrupo: nombreGrupoParaCategoria(gruposCategoria, categoria),
                nivelRiesgo: riesgoIndividual.nivelRiesgo as string,
            };
        });

        return {
            identificador,
            tieneReportes: true,
            nivelRiesgo: riesgoGlobal.nivelRiesgo as string,
            totalReportes,
            reportesAutenticados,
            reportesAnonimos,
            ultimoReporte: ultimoReporte?.toISOString() ?? null,
            plataformas,
            resumenPlataformas: formatPlataformasResumen(plataformas, totalReportes),
            reportes: itemsReportes,
            ubicaciones,
        };
    }
}
