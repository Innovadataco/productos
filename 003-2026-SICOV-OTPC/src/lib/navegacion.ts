/// Navegación de retorno del dashboard (fix I-14): migas de pan derivadas de la ruta.
/// Vive en lib como función PURA (testeable); la consume el breadcrumb compartido del
/// LAYOUT del dashboard — una sola vez, nunca página por página.

export interface Miga {
  href: string;
  etiqueta: string;
}

/// Etiquetas conocidas por segmento; cualquier segmento nuevo (specs 005-008) cae al
/// fallback capitalizado sin escribir nada aquí.
const ETIQUETAS: Record<string, string> = {
  dashboard: "Inicio",
  salidas: "Salidas",
  nueva: "Nueva",
  integradora: "Consulta integradora",
  llegadas: "Llegadas",
  mantenimientos: "Mantenimientos",
  alistamientos: "Alistamientos",
  autorizaciones: "Autorizaciones",
  novedades: "Novedades",
  usuarios: "Usuarios",
  configuracion: "Configuración",
  empresas: "Empresas",
  apis: "APIs",
};

function etiquetaDe(segmento: string): string {
  const conocida = ETIQUETAS[segmento.toLowerCase()];
  if (conocida) return conocida;
  const limpio = segmento.replace(/-/g, " ");
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

/// Deriva las migas de una ruta bajo /dashboard. Fuera del dashboard devuelve [].
/// "/dashboard/salidas/nueva" → Inicio (/dashboard) / Salidas (/dashboard/salidas) / Nueva.
export function derivarMigas(pathname: string): Miga[] {
  const segmentos = pathname.split("/").filter(Boolean);
  if (segmentos[0] !== "dashboard") return [];
  const migas: Miga[] = [];
  let href = "";
  for (const segmento of segmentos) {
    href += `/${segmento}`;
    migas.push({ href, etiqueta: etiquetaDe(segmento) });
  }
  return migas;
}

/// Ruta del módulo padre (retorno). En la raíz del dashboard no hay retorno → null.
export function rutaPadre(pathname: string): string | null {
  const migas = derivarMigas(pathname);
  if (migas.length < 2) return null;
  return migas[migas.length - 2].href;
}
