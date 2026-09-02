/**
 * A-73 (SPEC-367) · Tipos del círculo de confianza, alineados con lo que la API
 * YA devuelve (verificado en fuente, candado 15v5):
 * `listarContactos` usa `include` (no `select`), así que cada contacto trae
 * `nombre`, `parentesco`, `nota`, `activo` y `creadoEn` además del estado
 * derivado. La pantalla anterior declaraba solo `etiqueta` (deprecada) y por eso
 * no mostraba el nombre real.
 */

export type Plataforma = { id: string; nombre: string; clave: string };

/** Estado derivado del cruce contra reportes (spam y duplicados no cuentan). */
export type EstadoContacto = "sinReportes" | "enRevision" | "clasificado";

export type Identificador = {
    id: string;
    valor: string;
    tipo: string | null;
    plataforma: Plataforma | null;
    activo: boolean;
};

export type Contacto = {
    id: string;
    nombre: string | null;
    parentesco: string | null;
    /** SPEC-325: deprecada en favor de `nombre`; se lee como respaldo histórico. */
    etiqueta: string | null;
    nota: string | null;
    activo: boolean;
    creadoEn: string;
    estado: EstadoContacto;
    totalReportes: number;
    identificadores: Identificador[];
};

export type IdentificadorDetalle = Identificador & {
    estado: EstadoContacto;
    totalReportes: number;
};

export type Agregado = {
    totalReportes: number;
    reportesAutenticados: number;
    reportesAnonimos: number;
    primerReporte: string | null;
    ultimoReporte: string | null;
    plataformas: { id: string; nombre: string; clave: string; total: number }[];
    categorias: { categoria: string; total: number }[];
    porGrupoCategoria: { clave: string; nombre: string; orden: number; total: number }[];
    ubicaciones: { pais: string; ciudad: string; lat: number | null; lng: number | null; total: number }[];
    timeline: { mes: string; total: number }[];
};

export type DetalleContacto = Omit<Contacto, "identificadores"> & {
    identificadores: IdentificadorDetalle[];
    agregado: Agregado | null;
    mensaje?: string;
};

/**
 * El PATCH de identificadores es de LISTA COMPLETA: el backend desactiva los
 * activos que no vengan en el arreglo (SPEC-325). Toda acción se arma sobre la
 * lista entera, con el `activo` de cada uno.
 */
export type IdentificadorPayload = {
    id?: string;
    valor: string;
    tipo?: string;
    plataformaId?: string;
    activo: boolean;
};

/** Tono visual del padre. NUNCA rojo: verde tranquila · ámbar atención · gris en pausa. */
export type Tono = "verde" | "ambar" | "gris";

export function tonoDeContacto(contacto: Pick<Contacto, "activo" | "estado">): Tono {
    if (!contacto.activo) return "gris";
    return contacto.estado === "sinReportes" ? "verde" : "ambar";
}

/** El nombre que ve el padre. `etiqueta` es el respaldo de contactos viejos. */
export function nombreVisible(contacto: Pick<Contacto, "nombre" | "etiqueta">): string {
    return contacto.nombre?.trim() || contacto.etiqueta?.trim() || "Sin nombre";
}

/** Iniciales para el avatar (máximo dos letras). */
export function iniciales(nombre: string): string {
    const partes = nombre.trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return "?";
    const letras = partes.slice(0, 2).map((p) => p[0] ?? "");
    return letras.join("").toUpperCase();
}

/**
 * Cómo se le nombra el estado al padre, sin jerga. El plural del reporte se
 * ajusta y la revisión se dice "en revisión" (decisión 2: se muestra desde la
 * revisión, no se espera a que esté procesado).
 */
export function textoEstado(contacto: Pick<Contacto, "activo" | "estado" | "totalReportes">): string {
    if (!contacto.activo) return "En pausa";
    if (contacto.estado === "sinReportes") return "Sin reportes";
    const n = contacto.totalReportes;
    const plural = n === 1 ? "reporte" : "reportes";
    return contacto.estado === "enRevision" ? `${n} ${plural} en revisión` : `${n} ${plural}`;
}

/** "desde el 12 de agosto" — fecha larga en español, sin año cuando es este año. */
export function desdeCuando(creadoEn: string): string {
    const fecha = new Date(creadoEn);
    if (Number.isNaN(fecha.getTime())) return "";
    const esteAno = fecha.getFullYear() === new Date().getFullYear();
    return fecha.toLocaleDateString("es-CO", {
        day: "numeric",
        month: "long",
        ...(esteAno ? {} : { year: "numeric" }),
    });
}
