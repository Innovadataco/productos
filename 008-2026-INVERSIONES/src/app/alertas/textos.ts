/**
 * Los textos de /alertas, en un solo lugar y con su candado de lenguaje (tests/unit/pantalla-alertas/). Las alertas informan lo
 * que pasó con un precio o con un dato y de dónde sale; no recomiendan comprar ni vender. El texto de cada alerta lo escribe
 * el código (src/alertas/texto.ts), no esta pantalla. Sin imports en valor: los usa también el botón de cliente.
 */
export const TEXTOS_ALERTAS_PANTALLA = {
  TITULO: "Alertas",
  INTRO: "Lo que el sistema avisó en los últimos 30 días sobre sus precios y sus datos, con la hora y la fuente de cada dato. Informan lo que pasó; no recomiendan comprar ni vender.",
  SIN_ALERTAS: "No hay alertas en los últimos 30 días.",
  MARCAR: "Marcar como vista",
  SIN_MARCAR: "Sin marcar",
  MARCAR_TODAS: "Marcar todas como vistas",
  MARCANDO: "Marcando…",
  VISTA: "Vista el",
  CONFIGURAR: "Configurar las alertas",
  ERROR_MARCAR: "No se pudo marcar. Intente de nuevo.",
  SESION_VENCIDA: "La sesión venció. Ingrese de nuevo.",
} as const;

/** «2 sin marcar de 5» (los 30 días). */
export const textoPendientes = (sinVer: number, total: number): string => (sinVer === 0 ? `Todas las alertas están marcadas (${total}).` : `${sinVer} sin marcar de ${total}.`);

const NOMBRES_TIPO: Readonly<Record<string, string>> = {
  NIVEL_CRUZADO: "Nivel cruzado", NIVEL_CERCA: "Cerca del nivel", MOVIMIENTO_DIA: "Movimiento del día", CAIDA_PORTAFOLIO: "Caída del portafolio", DATO_VIEJO: "Dato viejo", FECHA_EX: "Fecha ex",
};

/** La etiqueta accesible de «Marcar como vista»: empieza por el texto visible y dice de cuál alerta es (tipo y día). */
export const etiquetaMarcar = (tipo: string, titulo: string): string => `${TEXTOS_ALERTAS_PANTALLA.MARCAR}: ${NOMBRES_TIPO[tipo] ?? "Alerta"} del ${titulo}`;
