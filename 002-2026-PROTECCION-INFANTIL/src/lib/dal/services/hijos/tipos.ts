// SPEC-325 (002-PI-225) · tipos del módulo "A quién protejo".

export const DOCUMENTO_TIPOS = ["RC", "TI", "CC", "CE", "PASAPORTE", "OTRO"] as const;
export type DocumentoTipo = (typeof DOCUMENTO_TIPOS)[number];

export const SEXOS = ["M", "F", "OTRO"] as const;
export type Sexo = (typeof SEXOS)[number];

export interface IdentificadorHijoInput {
    valor: string;
    tipo?: string | undefined;
    plataformaId?: string | undefined;
}

export interface RegistrarHijoInput {
    nombre: string;
    // SPEC-339 (FR-019): obligatorios. Antes eran opcionales y el requisito del
    // brief los exige; una ficha de menor sin apellidos no sirve como expediente.
    apellidos: string;
    documentoTipo: DocumentoTipo;
    documentoNumero: string;
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
    documentoTipo?: DocumentoTipo | undefined;
    documentoNumero?: string | undefined;
    anioNacimiento?: number | undefined;
    sexo?: Sexo | undefined;
    estado?: "activo" | "inactivo" | undefined;
}
