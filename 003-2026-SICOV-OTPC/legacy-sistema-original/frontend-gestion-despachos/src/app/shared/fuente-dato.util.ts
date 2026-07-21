const FUENTE_DATO_ETIQUETAS: Record<string, string> = {
  API_EMPRESAS: 'Empresa de transporte',
  WEB_EMPRESAS: 'Empresa de transporte',
  API_ASCENSODECENSO: 'Infrestructura de ascenso y descenso',
  WEB_ASCENSODECENSO: 'Infrestructura de ascenso y descenso',
  API_TERMINALES: 'Terminal de transporte',
  WEB_TERMINALES: 'Terminal de transporte',
};

export function etiquetaFuenteDato(value?: string | null): string {
  if (value == null || !String(value).trim()) return '-';
  const clave = String(value).trim().toUpperCase();
  return FUENTE_DATO_ETIQUETAS[clave] ?? String(value).trim();
}
