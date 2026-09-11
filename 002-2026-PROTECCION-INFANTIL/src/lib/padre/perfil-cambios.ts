/**
 * SPEC-590 — cambios de perfil del padre: detección y etiquetas legibles.
 *
 * El PATCH /api/padre/perfil audita cada campo modificado (AccionAudit
 * PERFIL_CAMBIO, valorAnterior/valorNuevo JSON `{campo, valor}`) y el endpoint
 * GET /api/padre/perfil/auditoria los sirve con su etiqueta humana. Este helper
 * es la fuente única del mapa campo→etiqueta para ambas capas (si la UI
 * inventara sus propias etiquetas, servidor y pantalla podrían divergir).
 */

import { fraseAviso } from "./avisos-perfil";

/** Campos del perfil del padre que se auditan, con su nombre legible. */
export const ETIQUETAS_CAMPO_PERFIL: Record<string, string> = {
    email: "Correo electrónico",
    nombre: "Nombres",
    apellidos: "Apellidos",
    documentoTipo: "Tipo de documento",
    documentoNumero: "Número de documento",
    fechaNacimiento: "Fecha de nacimiento",
    telefono: "Teléfono",
    paisId: "País",
    ciudadId: "Ciudad",
};

/**
 * Devuelve los campos que realmente cambian comparando el payload del PATCH
 * contra el valor actual. Normaliza fechas a `YYYY-MM-DD` para comparar lo que
 * el formulario envía contra lo que la BD devuelve.
 */
export function detectarCambiosPerfil(
    actual: Record<string, unknown>,
    entrada: Record<string, unknown>
): { campo: string; anterior: string | null; nuevo: string | null }[] {
    const cambios: { campo: string; anterior: string | null; nuevo: string | null }[] = [];
    for (const [campo, nuevoBruto] of Object.entries(entrada)) {
        if (!(campo in ETIQUETAS_CAMPO_PERFIL)) continue;
        if (nuevoBruto === undefined) continue;
        const anteriorBruto = actual[campo];
        const anterior = normalizarValor(campo, anteriorBruto);
        const nuevo = normalizarValor(campo, nuevoBruto);
        if (anterior === nuevo) continue;
        cambios.push({ campo, anterior, nuevo });
    }
    return cambios;
}

function normalizarValor(campo: string, valor: unknown): string | null {
    if (valor === null || valor === undefined || valor === "") return null;
    if (campo === "fechaNacimiento") {
        // BD devuelve Date; el formulario envía "YYYY-MM-DD".
        if (valor instanceof Date) return valor.toISOString().slice(0, 10);
        return String(valor).slice(0, 10);
    }
    return String(valor);
}

/* ────────────────────────────────────────────────────────────────────────────
 * SPEC-628 · «Mi perfil» en español, sin identificadores internos.
 *
 * Dos defectos que Jelkin describió: (1) el historial mostraba códigos crudos
 * («ciudad: vacío → 05001») y (2) los avisos no dejaban rastro. Se arreglan en
 * la LECTURA: los campos con id/clave interna se resuelven a NOMBRE, y el
 * historial incluye los cambios de aviso (ya auditados) resueltos a su frase.
 *
 * Regla dura: NINGUNA salida contiene un identificador interno (id/cuid, código
 * DANE, clave de catálogo, clave de evento ni nombre de columna).
 * ──────────────────────────────────────────────────────────────────────────── */

/** Campos cuyo valor CRUDO es un identificador interno → se resuelven a nombre. */
const RESOLUTORES = {
    ciudadId: "ciudades",
    paisId: "paises",
    documentoTipo: "tiposDoc",
} as const;

export const CAMPOS_CON_CODIGO_INTERNO = new Set(Object.keys(RESOLUTORES));

export type MapasResolucion = {
    ciudades: Map<string, string>;
    paises: Map<string, string>;
    tiposDoc: Map<string, string>;
};

/** Marcador cuando el id apunta a un catálogo ya borrado: NUNCA se muestra el id. */
export const VALOR_NO_DISPONIBLE = "—";
const ETIQUETA_DATO_GENERICO = "un dato";
const AVISO_GENERICO = "un aviso";

/** Resuelve el valor de un campo a algo legible; para campos-código nunca
 *  devuelve el id crudo (nombre resuelto, o el marcador si el id ya no existe). */
export function resolverValorCampo(
    campo: string,
    valor: string | null,
    mapas: MapasResolucion,
): string | null {
    if (valor === null) return null;
    const cual = RESOLUTORES[campo as keyof typeof RESOLUTORES];
    if (!cual) return valor; // correo, nombre, teléfono, documento… ya legibles
    return mapas[cual].get(valor) ?? VALOR_NO_DISPONIBLE;
}

export type ItemHistorial =
    | {
          id: string;
          tipo: "dato";
          // NB: NO se emite `campo` (nombre de columna = identificador interno).
          // La UI usa `etiqueta`; el `campo` crudo se queda del lado del servidor.
          etiqueta: string;
          anterior: string | null;
          nuevo: string | null;
          creadoEn: string | Date;
      }
    | {
          id: string;
          tipo: "aviso";
          etiqueta: string;
          estado: "activado" | "desactivado";
          creadoEn: string | Date;
      };

export type FilaAudit = {
    id: string;
    accion: string;
    valorAnterior: string | null;
    valorNuevo: string | null;
    creadoEn: string | Date;
};

function leerCampoValor(json: string | null): { campo: string | null; valor: string | null } {
    if (!json) return { campo: null, valor: null };
    try {
        const d = JSON.parse(json) as Record<string, unknown>;
        return {
            campo: typeof d.campo === "string" ? d.campo : null,
            valor: d.valor === null || d.valor === undefined ? null : String(d.valor),
        };
    } catch {
        return { campo: null, valor: null };
    }
}

function leerAviso(json: string | null): { eventoRegla: string | null; habilitado: boolean | null } {
    if (!json) return { eventoRegla: null, habilitado: null };
    try {
        const d = JSON.parse(json) as Record<string, unknown>;
        return {
            eventoRegla: typeof d.eventoRegla === "string" ? d.eventoRegla : null,
            habilitado: typeof d.habilitado === "boolean" ? d.habilitado : null,
        };
    } catch {
        return { eventoRegla: null, habilitado: null };
    }
}

/**
 * Builder PURO del historial legible (lo consume el endpoint; lo prueba el
 * candado sin BD). Convierte filas de AuditLog —cambios de perfil y de aviso—
 * en items sin ningún identificador interno.
 */
export function construirItemsHistorial(
    filas: FilaAudit[],
    mapas: MapasResolucion,
): ItemHistorial[] {
    const items: ItemHistorial[] = [];
    for (const f of filas) {
        if (f.accion === "NOTIFICACION_PREFERENCIA_ACTUALIZADA") {
            const { eventoRegla, habilitado } = leerAviso(f.valorNuevo);
            if (habilitado === null) continue;
            // fraseAviso puede ser null (evento no controlado por el padre): se usa
            // un genérico, NUNCA la clave técnica del evento.
            const etiqueta = (eventoRegla && fraseAviso(eventoRegla)) || AVISO_GENERICO;
            items.push({
                id: f.id,
                tipo: "aviso",
                etiqueta,
                estado: habilitado ? "activado" : "desactivado",
                creadoEn: f.creadoEn,
            });
            continue;
        }
        const anterior = leerCampoValor(f.valorAnterior);
        const nuevo = leerCampoValor(f.valorNuevo);
        const campo = nuevo.campo ?? anterior.campo ?? "";
        // La etiqueta jamás cae al nombre de columna crudo: genérico si no se conoce.
        const etiqueta = ETIQUETAS_CAMPO_PERFIL[campo] ?? ETIQUETA_DATO_GENERICO;
        items.push({
            id: f.id,
            tipo: "dato",
            etiqueta,
            anterior: resolverValorCampo(campo, anterior.valor, mapas),
            nuevo: resolverValorCampo(campo, nuevo.valor, mapas),
            creadoEn: f.creadoEn,
        });
    }
    return items;
}
