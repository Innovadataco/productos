/**
 * Los textos de /edicion/alertas, en un solo lugar y con su candado de lenguaje (tests/unit/edicion/alertas/). Dicen qué
 * avisa cada alerta y con qué umbral; nunca juzgan un precio ni una operación. Sin imports en valor: los usa también el
 * formulario de cliente.
 */
export const TEXTOS_ALERTAS = {
  TITULO: "Alertas",
  INTRO: "Cuándo avisa el sistema. Las alertas informan lo que pasó con un precio o con un dato y de dónde sale; no recomiendan comprar ni vender. Un cambio es una versión nueva: la anterior queda en la historia.",
  POR_OMISION: "Todavía no hay versiones guardadas: rigen los valores de fábrica.",
  VIGENTES: "Umbrales",
  NUEVA: "Nueva versión",
  HISTORIA: "Historia",
  SIN_HISTORIA: "Todavía no hay versiones guardadas.",
  GUARDAR: "Guardar la versión",
  GUARDANDO: "Guardando…",
  GUARDADA: "Versión guardada",
  ERRORES: "Revise los datos marcados.",
  VER_ALERTAS: "Ver las alertas",
} as const;

export const ETIQUETAS_ALERTAS = {
  alertaNivelCruzadoActiva: "Avisar cuando el precio cruza el nivel de una regla del plan",
  alertaCercaActiva: "Avisar cuando el precio se acerca al nivel de una regla",
  alertaCercaPct: "Distancia al nivel (%)",
  alertaMovimientoActiva: "Avisar cuando una especie se mueve en el día",
  alertaMovimientoPct: "Movimiento del día (%)",
  alertaCaidaActiva: "Avisar cuando el valor del portafolio baja en el día",
  alertaCaidaPct: "Caída del portafolio (%)",
  alertaDatoViejoActiva: "Avisar cuando un dato lleva tiempo sin renovarse",
  alertaDatoViejoMin: "Minutos sin renovarse",
  alertaExActiva: "Avisar de la fecha ex de un dividendo",
  alertaExDiasHabiles: "Días hábiles de anticipación",
  motivo: "Motivo del cambio",
  versionBase: "Versión de partida",
  cuerpo: "Formulario",
} as const;

/** El nombre de cada alerta, en el orden del formulario: la leyenda de su grupo. */
export const LEYENDAS_ALERTAS = {
  alertaNivelCruzadoActiva: "Nivel cruzado",
  alertaCercaActiva: "Cerca del nivel",
  alertaMovimientoActiva: "Movimiento del día",
  alertaCaidaActiva: "Caída del portafolio",
  alertaDatoViejoActiva: "Dato viejo",
  alertaExActiva: "Fecha ex",
} as const;

export const AYUDAS_ALERTAS = {
  alertaCercaPct: "De 0,5 a 10. Como en la ficha: 3 o 3,5. Hasta 2 decimales.",
  alertaMovimientoPct: "De 0,5 a 20, frente al cierre anterior. Hasta 2 decimales.",
  alertaCaidaPct: "De 0,5 a 20, frente al cierre anterior. Hasta 2 decimales.",
  alertaDatoViejoMin: "De 10 a 240 minutos, sin contar el retraso de unos 20 minutos de Yahoo. Entero.",
  alertaExDiasHabiles: "De 1 a 10 días hábiles antes de la fecha ex. Entero.",
} as const;

const MENSAJES: Readonly<Record<string, string>> = {
  FORMATO_INVALIDO: "Ese dato no se puede leer. Vuelva a cargar la página.",
  VACIO: "Falta este dato.",
  DEMASIADO_LARGO: "Es demasiado largo: hasta 2.000 caracteres.",
  FUERA_DE_RANGO: "Está fuera del rango permitido (mire la ayuda del campo).",
  DEBE_SER_ENTERO: "Escriba un número entero, sin decimales.",
  DECIMALES_DE_MAS: "Escriba hasta 2 decimales.",
  UMBRAL_CAMBIO: "Mientras editaba se guardó otra versión. Vuelva a cargar la página.",
  AUTOR_INEXISTENTE: "Solo el dueño puede guardar cambios.",
};

export const mensajeAlertas = (codigo: string): string => MENSAJES[codigo] ?? "No se pudo guardar. Intente de nuevo.";

export const etiquetaDeCampo = (campo: string): string => (ETIQUETAS_ALERTAS as Readonly<Record<string, string>>)[campo] ?? ETIQUETAS_ALERTAS.cuerpo;
