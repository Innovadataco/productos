export function fechaCorta(iso: string | null | undefined): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDuracionHoras(horas: number | null | undefined): string {
    if (horas === null || horas === undefined) return "—";
    if (horas < 1) return `${Math.round(horas * 60)} min`;
    if (horas < 24) return `${Math.round(horas)} h`;
    return `${Math.round(horas / 24)} d`;
}

export function formatDuracionMs(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) return "—";
    const totalMinutos = Math.floor(ms / 60000);
    const dias = Math.floor(totalMinutos / 1440);
    const horas = Math.floor((totalMinutos % 1440) / 60);
    const minutos = totalMinutos % 60;
    if (dias > 0) return `${dias}d ${horas}h`;
    if (horas > 0) return `${horas}h ${minutos}m`;
    return `${minutos}m`;
}
