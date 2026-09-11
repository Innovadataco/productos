/**
 * SPEC-605 · Piezas puras del DTO del expediente (sin Prisma): urgencia,
 * dominante, familias, línea de tiempo, tendencia, semáforo y estado de
 * reportes. Las consultas viven en `index.ts`.
 */
import { formatCategoria } from "../../../labels";
import { formatPlataforma } from "../../../plataforma";
import { fechaISO } from "../../../format/fecha";
import { SEVERIDAD_CATEGORIA } from "../../../riesgo-consulta";
import { ENUM_A_FRANJA } from "../../../reportes/franja-enum";
import type { CategoriaConducta, EstadoExpediente, FranjaHoraria } from "@prisma/client";
import type { FranjaAproximada } from "../../../reportes/franja-aproximada";
import {
    ESTADOS_EN_PROCESO,
    ESTADOS_FINALES,
    type ClasificacionContable,
    type EstadoReportesExpediente,
    type HijoResumenDto,
    type ReporteAjenoRow,
    type ReportePropioRow,
    type SemaforoExpedienteDto,
    type TendenciaExpedienteDto,
    type TimelineItemDto,
    type UrgenciaExpediente,
} from "./types";

/** Código corto y estable del expediente: «EXP-» + los 6 últimos del cuid. */
export function codigoExpediente(id: string): string {
    return `EXP-${id.slice(-6).toUpperCase()}`;
}

/** Urgencia desde la categoría dominante, con la escala de la consulta pública. */
export function urgenciaDeCategoria(categoria: CategoriaConducta | null): UrgenciaExpediente {
    if (!categoria) return "sin_clasificar";
    const severidad = SEVERIDAD_CATEGORIA[categoria] ?? 50;
    if (severidad >= 75) return "alta";
    if (severidad >= 50) return "media";
    return "baja";
}

/** Nivel de severidad de UNA categoría (punto de la línea de tiempo); a
 * diferencia de `urgenciaDeCategoria`, aquí siempre hay categoría. */
export function nivelDeCategoria(categoria: CategoriaConducta): "alta" | "media" | "baja" {
    const urgencia = urgenciaDeCategoria(categoria);
    return urgencia === "sin_clasificar" ? "baja" : urgencia;
}

/**
 * Clasificación dominante del identificador (la más repetida entre las que
 * cuentan; empate = la más reciente — misma regla que cadenas-padre). Devuelve
 * además la huella del reporte más reciente con esa categoría (confianza,
 * manual/IA, secundarias) para el bloque «El análisis».
 */
export function clasificacionDominante(clasifs: ClasificacionContable[]): {
    categoria: CategoriaConducta;
    confianza: number | null;
    categoriasSecundarias: unknown;
    modeloUsado: string | null;
} | null {
    const conteo = new Map<CategoriaConducta, { n: number; ultima: Date }>();
    for (const c of clasifs) {
        const prev = conteo.get(c.categoria);
        conteo.set(c.categoria, {
            n: (prev?.n ?? 0) + 1,
            ultima: prev && prev.ultima > c.fecha ? prev.ultima : c.fecha,
        });
    }
    let mejor: { cat: CategoriaConducta; n: number; ultima: Date } | null = null;
    for (const [cat, v] of conteo) {
        if (!mejor || v.n > mejor.n || (v.n === mejor.n && v.ultima > mejor.ultima)) {
            mejor = { cat, n: v.n, ultima: v.ultima };
        }
    }
    if (!mejor) return null;
    // La huella del bloque «El análisis» (confianza, manual/IA, secundarias)
    // solo existe en los reportes PROPIOS: el más reciente CON datos; si la
    // dominante viene solo de la comunidad, confianza queda null y la UI lo
    // dice en vez de pintar un 0 % falso.
    const deLaDominante = clasifs
        .filter((c) => c.categoria === mejor.cat)
        .sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
    const conHuella = deLaDominante.find((c) => c.confianza !== null) ?? null;
    return {
        categoria: mejor.cat,
        confianza: conHuella?.confianza ?? null,
        categoriasSecundarias: conHuella?.categoriasSecundarias ?? null,
        modeloUsado: conHuella?.modeloUsado ?? null,
    };
}

/** Familias distintas detrás de los reportes ajenos: un usuario = una familia;
 * cada anónimo cuenta como una más (no hay usuario que deduplicar). */
export function familiasAjenas(ajenos: ReporteAjenoRow[]): number {
    const usuarios = new Set<string>();
    let anonimos = 0;
    for (const r of ajenos) {
        if (r.usuarioId) usuarios.add(r.usuarioId);
        else anonimos += 1;
    }
    return usuarios.size + anonimos;
}

export function resumenHijo(hijo: { nombre: string; apellidos: string; anioNacimiento: number | null }): HijoResumenDto {
    return {
        nombre: `${hijo.nombre} ${hijo.apellidos}`.trim(),
        edad: hijo.anioNacimiento ? new Date().getFullYear() - hijo.anioNacimiento : null,
    };
}

/** Línea de tiempo unificada: cada evento propio es un ítem («tú»); los ajenos
 * se agrupan por (día Bogotá, categoría) como «N familias más» — nunca texto,
 * nunca autor. Orden cronológico descendente (lo último arriba, como el mockup). */
/** SPEC-644: el enum persistido → franja de dominio para el DTO. La lectura muestra la
 *  franja GUARDADA; la derivación del centro vive solo como respaldo en `fechaHechoLegible`. */
export function franjaDom(fh: FranjaHoraria | null): FranjaAproximada | null {
    return fh ? ENUM_A_FRANJA[fh] : null;
}

export function armarTimeline(propios: ReportePropioRow[], ajenos: ReporteAjenoRow[]): TimelineItemDto[] {
    const primerPropioId = propios[0]?.id ?? null; // propios vienen creadoEn asc
    const items: TimelineItemDto[] = propios.map((r) => {
        const categoria =
            r.clasificacion && ESTADOS_FINALES.includes(r.estado) ? r.clasificacion.categoria : null;
        return {
            fecha: r.fechaIncidente,
            horaAproximada: r.horaAproximada,
            franja: franjaDom(r.franjaHoraria),
            esPropio: true,
            categoriaLabel: categoria ? formatCategoria(categoria) : null,
            nivel: categoria ? nivelDeCategoria(categoria) : null,
            esPrimero: r.id === primerPropioId,
            reporteId: r.id,
            estadoReporte: r.estado,
            familias: 1,
            ciudades: [],
        };
    });

    const grupos = new Map<string, { fecha: Date; horaAproximada: boolean; franja: FranjaAproximada | null; categoria: CategoriaConducta | null; usuarios: Set<string>; anonimos: number; ciudades: Set<string> }>();
    for (const r of ajenos) {
        const dia = fechaISO(r.fechaIncidente.toISOString());
        const categoria = r.clasificacion?.categoria ?? null;
        const clave = `${dia}|${categoria ?? "sin"}`;
        const grupo = grupos.get(clave) ?? {
            fecha: r.fechaIncidente,
            horaAproximada: r.horaAproximada,
            franja: franjaDom(r.franjaHoraria),
            categoria,
            usuarios: new Set<string>(),
            anonimos: 0,
            ciudades: new Set<string>(),
        };
        // La fecha del grupo es la MÁS reciente; la bandera viaja con ella, así la
        // franja mostrada corresponde al hecho cuya hora se está enseñando.
        if (r.fechaIncidente > grupo.fecha) {
            grupo.fecha = r.fechaIncidente;
            grupo.horaAproximada = r.horaAproximada;
            grupo.franja = franjaDom(r.franjaHoraria);
        }
        if (r.usuarioId) grupo.usuarios.add(r.usuarioId);
        else grupo.anonimos += 1;
        const ciudad = r.ciudadRel?.nombre ?? r.ciudad;
        if (ciudad) grupo.ciudades.add(ciudad);
        grupos.set(clave, grupo);
    }
    for (const g of grupos.values()) {
        items.push({
            fecha: g.fecha,
            horaAproximada: g.horaAproximada,
            franja: g.franja,
            esPropio: false,
            categoriaLabel: g.categoria ? formatCategoria(g.categoria) : null,
            nivel: g.categoria ? nivelDeCategoria(g.categoria) : null,
            esPrimero: false,
            reporteId: null,
            estadoReporte: null,
            familias: g.usuarios.size + g.anonimos,
            ciudades: [...g.ciudades].sort(),
        });
    }

    items.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
    return items;
}

/** Tendencia simple (la gráfica es siguiente ola): reportes que LLEGARON en
 * los últimos 7 días contra los 7 anteriores, propios + ajenos. */
export function armarTendencia(fechasLlegada: Date[], ahora = new Date()): TendenciaExpedienteDto {
    const diaMs = 24 * 60 * 60 * 1000;
    const desde7 = ahora.getTime() - 7 * diaMs;
    const desde14 = ahora.getTime() - 14 * diaMs;
    let nuevosUltimos7 = 0;
    let previos7 = 0;
    for (const f of fechasLlegada) {
        const t = f.getTime();
        if (t >= desde7) nuevosUltimos7 += 1;
        else if (t >= desde14) previos7 += 1;
    }
    const direccion: TendenciaExpedienteDto["direccion"] =
        nuevosUltimos7 > previos7 ? "subiendo" : nuevosUltimos7 < previos7 ? "bajando" : "estable";
    const texto =
        direccion === "subiendo"
            ? `${nuevosUltimos7} ${nuevosUltimos7 === 1 ? "reporte nuevo" : "reportes nuevos"} en los últimos 7 días (antes: ${previos7}).`
            : direccion === "bajando"
                ? `${nuevosUltimos7} ${nuevosUltimos7 === 1 ? "reporte nuevo" : "reportes nuevos"} en los últimos 7 días; llegaban más la semana anterior (${previos7}).`
                : nuevosUltimos7 === 0
                    ? "Sin reportes nuevos en los últimos 7 días."
                    : `${nuevosUltimos7} ${nuevosUltimos7 === 1 ? "reporte nuevo" : "reportes nuevos"} en los últimos 7 días, el mismo ritmo de la semana anterior.`;
    return { direccion, nuevosUltimos7, previos7, texto };
}

export function semaforoDelExpediente(
    urgencia: UrgenciaExpediente,
    estado: EstadoExpediente,
    totalReportes: number,
    familias: number,
    dominanteLabel: string | null
): SemaforoExpedienteDto {
    const base =
        totalReportes === 1
            ? `Esta cuenta tiene 1 reporte registrado por ${familias === 1 ? "1 familia" : `${familias} familias`}.`
            : `Esta cuenta tiene ${totalReportes} reportes registrados por ${familias === 1 ? "1 familia" : `${familias} familias`}.`;
    const conDominante = dominanteLabel ? `${base} La conducta más reportada: ${dominanteLabel.toLowerCase()}.` : base;
    const notaComite =
        estado === "ESCALADO" || estado === "PENDIENTE_COMITE" || estado === "EN_ACLARACION"
            ? " El comité de revisión ya la está evaluando; si se confirma, la cuenta pasa a la consulta pública con lenguaje estadístico."
            : "";

    switch (urgencia) {
        case "alta":
            return { nivel: urgencia, titulo: "Nivel alto", explicacion: `${conDominante}${notaComite}` };
        case "media":
            return { nivel: urgencia, titulo: "Nivel medio", explicacion: `${conDominante}${notaComite}` };
        case "baja":
            return { nivel: urgencia, titulo: "Nivel bajo", explicacion: `${conDominante}${notaComite}` };
        case "sin_clasificar":
            return {
                nivel: urgencia,
                titulo: "Sin clasificar todavía",
                explicacion: `${base} Cuando la revisión termine verás acá la clasificación y su explicación.${notaComite}`,
            };
    }
}

export function estadoDeReportes(propios: ReportePropioRow[]): { estado: EstadoReportesExpediente; procesando: number } {
    const procesando = propios.filter((r) => ESTADOS_EN_PROCESO.includes(r.estado)).length;
    return { estado: procesando > 0 ? "EN_PROCESO" : "PROCESADO", procesando };
}

export function clasificacionesQueCuentan(propios: ReportePropioRow[], ajenos: ReporteAjenoRow[]): ClasificacionContable[] {
    const dePropios: ClasificacionContable[] = propios.flatMap((r) =>
        r.clasificacion && ESTADOS_FINALES.includes(r.estado)
            ? [{
                categoria: r.clasificacion.categoria,
                confianza: r.clasificacion.confianza,
                categoriasSecundarias: r.clasificacion.categoriasSecundarias,
                modeloUsado: r.clasificacion.modeloUsado,
                fecha: r.creadoEn,
            }]
            : []
    );
    const deAjenos: ClasificacionContable[] = ajenos.flatMap((r) =>
        r.clasificacion
            ? [{
                categoria: r.clasificacion.categoria,
                confianza: null,
                categoriasSecundarias: null,
                modeloUsado: null,
                fecha: r.creadoEn,
            }]
            : []
    );
    return [...dePropios, ...deAjenos];
}

/**
 * Plataforma a mostrar: la del reporte propio que abrió la cadena (misma
 * fuente que cadenas-padre; `Expediente.plataformaId` no tiene relación en el
 * schema — convive como clave o como id según el origen, ver resolverPlataformaId).
 */
export function plataformaDeCadena(propios: ReportePropioRow[]): string {
    const cabeza = propios[0];
    if (!cabeza) return "Plataforma no especificada";
    return formatPlataforma(cabeza.plataforma.nombre, cabeza.otraPlataforma, cabeza.plataforma.clave);
}

/** Misma tolerancia que cadenas-padre (A-70 · F11): `categoriasSecundarias` es
 * Json libre; lo que no encaje se descarta en silencio. */
export function leerSecundariasLabels(valor: unknown): string[] {
    if (!Array.isArray(valor)) return [];
    const salida: string[] = [];
    for (const item of valor) {
        if (!item || typeof item !== "object") continue;
        const cat = (item as { categoria?: unknown }).categoria;
        if (typeof cat !== "string") continue;
        salida.push(formatCategoria(cat));
    }
    return salida;
}
