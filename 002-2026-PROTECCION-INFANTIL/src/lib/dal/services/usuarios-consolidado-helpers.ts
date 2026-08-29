export const ESTADOS_COMITE_ABIERTOS: Array<"PENDIENTE" | "ASIGNADA"> = ["PENDIENTE", "ASIGNADA"];

export const ACCIONES_CIERRE_OPERADOR: Array<"CASO_CONFIRMADO" | "CASO_CORREGIDO" | "CASO_DADO_DE_BAJA"> = [
    "CASO_CONFIRMADO",
    "CASO_CORREGIDO",
    "CASO_DADO_DE_BAJA",
];

export function inicioVentana(dias: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function fechaIso(d: Date | null | undefined): string | null {
    return d?.toISOString() ?? null;
}
