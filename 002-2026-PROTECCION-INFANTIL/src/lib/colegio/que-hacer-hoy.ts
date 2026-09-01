/**
 * SPEC-353 (A-69 · C6) — "Qué hacer hoy": la frase accionable del puesto de
 * mando del rector. Reglas puras sin IA, espejo del `calcularSugerenciaHome`
 * del padre (SPEC-309).
 *
 * Prioridad por gravedad para menores (reordenable en la lista de reglas):
 *   1. Identificador CRUZADO (misma cuenta tocando a varios estudiantes en
 *      7 días — posible depredador; la señal del mockup 2.1).
 *   2. Alertas sin abrir.
 *   3. Caso escalado al comité sin resolver.
 *   4. Calma ("Todo al día").
 *
 * REGLA DE PRIVACIDAD (SC-005): las frases traen SOLO conteos; jamás el
 * valor de un identificador ni nombres. Voz: usted formal Colombia; ámbar
 * único tono de alerta (brief §0).
 */

export type TonoQueHacerHoy = "ambar" | "calma";

export interface QueHacerHoy {
    titulo: string;
    detalle: string;
    accionHref: string;
    accionTexto: string;
    tono: TonoQueHacerHoy;
}

export interface DatosQueHacerHoy {
    alertasSinAbrir: number;
    ultimaAlertaSinAbrirEn: Date | null;
    casosComite: { abiertos: number; masViejoEn: Date | null };
    identificadorCruzado: { identificadores: number; estudiantesMax: number };
    ultimaSenal: Date | null;
    /** "Ahora" inyectable para tests deterministas. */
    ahora?: Date;
}

const DIA_MS = 24 * 60 * 60 * 1000;

function diasDesde(fecha: Date, ahora: Date): number {
    return Math.max(0, Math.floor((ahora.getTime() - fecha.getTime()) / DIA_MS));
}

const NUMEROS = ["cero", "una", "dos", "tres", "cuatro", "cinco"] as const;
function enPalabras(n: number): string {
    return n >= 1 && n < NUMEROS.length ? NUMEROS[n] : String(n);
}

function fechaCortaES(fecha: Date): string {
    return new Intl.DateTimeFormat("es-CO", {
        day: "numeric",
        month: "long",
        timeZone: "America/Bogota",
    }).format(fecha);
}

/** Cuenta cuántos frentes distintos esperan al rector (para el título). */
function contarPendientes(datos: DatosQueHacerHoy): number {
    let pendientes = 0;
    if (datos.identificadorCruzado.identificadores > 0) pendientes++;
    if (datos.alertasSinAbrir > 0) pendientes++;
    if (datos.casosComite.abiertos > 0) pendientes++;
    return pendientes;
}

function tituloPorPendientes(pendientes: number): string {
    if (pendientes <= 1) return "Algo necesita su atención hoy";
    const palabra = enPalabras(pendientes);
    const capitalizada = palabra.charAt(0).toUpperCase() + palabra.slice(1);
    return `${capitalizada} cosas necesitan su atención hoy`;
}

export function calcularQueHacerHoy(datos: DatosQueHacerHoy): QueHacerHoy {
    const ahora = datos.ahora ?? new Date();
    const pendientes = contarPendientes(datos);

    // 1 · Identificador cruzado — la señal más grave del dominio.
    if (datos.identificadorCruzado.identificadores > 0) {
        const n = datos.identificadorCruzado.estudiantesMax;
        return {
            titulo: tituloPorPendientes(pendientes),
            detalle:
                `Una misma cuenta aparece en los casos de ${enPalabras(n)} estudiantes esta semana. ` +
                "Revise las alertas: podría tratarse del mismo contacto.",
            accionHref: "/dashboard/colegio/alertas",
            accionTexto: "Ver ahora",
            tono: "ambar",
        };
    }

    // 2 · Alertas sin abrir.
    if (datos.alertasSinAbrir > 0) {
        const n = datos.alertasSinAbrir;
        const detalle =
            n === 1
                ? "Un aviso espera su atención en la bandeja."
                : `${enPalabras(n).charAt(0).toUpperCase()}${enPalabras(n).slice(1)} avisos esperan su atención en la bandeja.`;
        return {
            titulo: tituloPorPendientes(pendientes),
            detalle,
            accionHref: "/dashboard/colegio/alertas",
            accionTexto: "Ver ahora",
            tono: "ambar",
        };
    }

    // 3 · Caso en el comité.
    if (datos.casosComite.abiertos > 0) {
        const dias = datos.casosComite.masViejoEn ? diasDesde(datos.casosComite.masViejoEn, ahora) : 0;
        const antiguedad = dias >= 1 ? ` desde hace ${dias === 1 ? "un día" : `${dias} días`}` : "";
        const detalle =
            datos.casosComite.abiertos === 1
                ? `El comité tiene un caso${antiguedad}. Puede seguir su avance.`
                : `El comité tiene ${enPalabras(datos.casosComite.abiertos)} casos abiertos${antiguedad ? `, el más antiguo${antiguedad}` : ""}.`;
        return {
            titulo: tituloPorPendientes(pendientes),
            detalle,
            accionHref: "/dashboard/colegio/comite",
            accionTexto: "Seguir",
            tono: "ambar",
        };
    }

    // 4 · Calma.
    const cierre = datos.ultimaSenal
        ? ` La última señal llegó el ${fechaCortaES(datos.ultimaSenal)}.`
        : "";
    return {
        titulo: "Todo al día",
        detalle: `No hay nada que espere por usted en este momento.${cierre}`,
        accionHref: "/dashboard/colegio/estadisticas",
        accionTexto: "Ver el movimiento",
        tono: "calma",
    };
}
