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
    apellidos?: string | undefined;
    documentoTipo: DocumentoTipo;
    documentoNumero: string;
    anioNacimiento?: number | undefined;
    sexo?: Sexo | undefined;
    identificadores?: IdentificadorHijoInput[] | undefined;
}
