// SPEC-325 (002-PI-225) · tipos del módulo "A quién protejo".
//
// SPEC-589 (06-09-2026): la ficha del menor ya NO lleva documento (decisión
// CEO — columnas Hijo.documentoTipo/documentoNumero eliminadas). El tipo del
// documento del PADRE vive aparte (DOCUMENTO_TIPOS_PADRE en validators.ts).

export const SEXOS = ["M", "F", "OTRO"] as const;
export type Sexo = (typeof SEXOS)[number];

export interface IdentificadorHijoInput {
    valor: string;
    tipo?: string | undefined;
    plataformaId?: string | undefined;
}

export interface RegistrarHijoInput {
    nombre: string;
    // SPEC-604: opcionales desde el alta «solo nombre» del wizard de reporte
    // (deroga parcialmente SPEC-339 FR-019). El formulario completo de «A quién
    // protejo» sigue enviándolos; la ficha se completa después.
    apellidos?: string | undefined;
    anioNacimiento?: number | undefined;
    sexo?: Sexo | undefined;
    identificadores?: IdentificadorHijoInput[] | undefined;
}

/**
 * SPEC-339 (FR-022): corrección de los datos de un menor ya registrado.
 * Todos opcionales — el padre corrige lo que se equivocó, no reescribe todo.
 */
export interface ActualizarHijoInput {
    nombre?: string | undefined;
    apellidos?: string | undefined;
    anioNacimiento?: number | undefined;
    sexo?: Sexo | undefined;
    estado?: "activo" | "inactivo" | undefined;
}
