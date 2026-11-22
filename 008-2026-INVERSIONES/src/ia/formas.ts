/** Esqueleto (rojo). */
export type Registro = Readonly<Record<string, unknown>>;
export function esDecimalCanonico(_texto: string): boolean { throw new Error("SIN_IMPLEMENTAR"); }
export function esDiaIso(_texto: string): boolean { throw new Error("SIN_IMPLEMENTAR"); }
export function esTextoSeguro(_texto: unknown, _max: number): _texto is string { throw new Error("SIN_IMPLEMENTAR"); }
export function esNombreEspecie(_texto: unknown): _texto is string { throw new Error("SIN_IMPLEMENTAR"); }
export function esObjetoPlano(_valor: unknown): _valor is Registro { throw new Error("SIN_IMPLEMENTAR"); }
