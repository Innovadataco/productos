// SPEC-033 · lector + tipos del tablero /operacion.
// Lee el JSON que el CEO escribe por SSH en el VPS (montado read-only en el
// contenedor). Nunca lanza al render: fallback claro si el archivo no existe
// o no parsea (candado 9/25). Shape exacto del CONTRATO-JSON-A55.

import { readFile } from "node:fs/promises";

// ── Tipos del contrato ──────────────────────────────────────────────────────

export type EstadoPersona = "libre" | "en_proceso" | "ocupado" | "sin_sesion";

export interface Persona {
    nombre: string;
    estado: string; // enum EstadoPersona, pero libre: desconocido → neutro
    nota?: string | null;
}

export interface Equipo {
    equipo: string;
    personas: Persona[];
}

export interface FuncionalidadFila {
    id: string;
    nombre: string;
    brief?: string | null;
    instructivo?: string | null;
    spec?: string | null;
    inicio?: string | null;
    estimada?: string | null;
    fin?: string | null;
    desplegado?: boolean | null;
    calidad?: string | null;
    tuOk?: string | null;
}

export interface Funcionalidades {
    resumen?: string | null;
    alerta?: string | null;
    filas: FuncionalidadFila[];
}

export interface Avance {
    hechos: number;
    total: number;
}

export interface TeNecesita {
    necesita: boolean;
    pasos?: string | null;
    critico?: boolean | null;
}

export interface RecorridoFila {
    id: string;
    nombre: string;
    avance?: Avance | null;
    inicio?: string | null;
    estimada?: string | null;
    fin?: string | null;
    resultado?: string | null;
    estado?: string | null;
    teNecesita?: TeNecesita | null;
}

export interface Recorridos {
    resumen?: string | null;
    filas: RecorridoFila[];
}

export interface Operacion {
    titulo?: string | null;
    actualizado?: string | null;
    commitProduccion?: string | null;
    notaPie?: string | null;
    equipos?: Equipo[] | null;
    funcionalidades?: Funcionalidades | null;
    recorridos?: Recorridos | null;
}

export type ResultadoOperacion =
    | { ok: true; data: Operacion }
    | { ok: false; motivo: "ausente" | "invalido" };

// ── Lector ──────────────────────────────────────────────────────────────────

function rutaOperacion(): string {
    return process.env.OPERACION_JSON_PATH ?? "/data/operacion.json";
}

export async function leerOperacion(): Promise<ResultadoOperacion> {
    let contenido: string;
    try {
        contenido = await readFile(rutaOperacion(), "utf8");
    } catch {
        // ENOENT u otro error de acceso · archivo no disponible.
        return { ok: false, motivo: "ausente" };
    }
    try {
        const data = JSON.parse(contenido) as Operacion;
        if (data === null || typeof data !== "object") {
            return { ok: false, motivo: "invalido" };
        }
        return { ok: true, data };
    } catch {
        return { ok: false, motivo: "invalido" };
    }
}

// ── Normalizadores puros (testeable sin FS) ─────────────────────────────────

export type ClaseEstado = "libre" | "proceso" | "ocupado" | "off";

/** Mapea el estado de persona a la clase CSS del artefacto. Desconocido → off. */
export function claseEstadoPersona(estado: string | null | undefined): ClaseEstado {
    switch (estado) {
        case "libre":
            return "libre";
        case "en_proceso":
            return "proceso";
        case "ocupado":
            return "ocupado";
        case "sin_sesion":
            return "off";
        default:
            return "off";
    }
}

export type ClaseTag = "ok" | "mid" | "bad" | "neutro";

/**
 * Mapea una etiqueta humana (calidad / resultado) a la clase de tag.
 * `null`/`""` → null (el render muestra guion). Desconocido → neutro (texto crudo).
 */
export function claseTag(label: string | null | undefined): ClaseTag | null {
    if (label == null || label === "") return null;
    switch (label) {
        case "Cumple":
            return "ok";
        case "Parcial":
            return "mid";
        case "Sin probar":
        case "Bloqueado":
            return "bad";
        default:
            return "neutro";
    }
}

/** Ancho de la barra de avance en %. Sin división por cero. */
export function anchoBarra(avance: Avance | null | undefined): number {
    if (!avance || typeof avance.total !== "number" || avance.total <= 0) return 0;
    const hechos = typeof avance.hechos === "number" ? avance.hechos : 0;
    return Math.round((hechos / avance.total) * 100);
}

/** Texto de display: null/"" → guion largo. Cualquier otro valor → String(v). */
export function mostrar(v: unknown): string {
    if (v == null || v === "") return "—";
    return String(v);
}
