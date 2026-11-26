/**
 * Los textos de la sección «¿Y si…?» de /operar (O2 con la tarifa de O5), en un solo lugar y bajo el candado de lenguaje
 * de /operar. Dicen qué se calcula y con qué datos; nunca juzgan la operación. Sin imports en valor: los usa el
 * componente de cliente.
 */
export const TEXTOS_SIMULADOR = {
  EYEBROW: "Simulador",
  TITULO: "¿Y si…?",
  INTRO: "Escriba la operación que piensa e Inversiones calcula sus efectos con sus datos: los pesos antes y después, la caja, el valor, la comisión, las reglas de su plan que toca y el análisis del antes y el después. No se guarda nada ni se envía ninguna orden.",
  SIN_ESPECIES: "No hay especies en el portafolio para simular.",
  ESPECIE: "Especie",
  LADO: "Operación",
  CANTIDAD: "Cantidad de acciones",
  PRECIO: "Precio límite ($)",
  COMISIONISTA: "Comisionista",
  SALDO: "Su saldo disponible en el comisionista ($, opcional)",
  AYUDA_SALDO:
    "Escriba el saldo que ve en Trii, como en la ficha (37.911,47), sin signo $: esa es la caja de la simulación y no se guarda. " +
    "Si lo deja vacío, la caja es la certificada por Acciones & Valores, que puede no ser su saldo en Trii.",
  ANALISIS: "Análisis del antes y el después",
  PARTIDA: "Valor de partida de los escenarios (pesos)",
  ESCENARIOS: "Escenarios a 12 meses (pesos; acciones, fondo y caja; sin aportes, con los parámetros por omisión de Proyecciones)",
  VARIACION: "variación",
  SIN_ESCENARIOS: "Los escenarios no se calcularon en esta simulación (el cálculo está ocupado, no hay historia o el valor de partida no es positivo).",
  APARECEN: "Puntos para revisar que aparecen",
  DESAPARECEN: "Puntos para revisar que desaparecen",
  SIN_ANALISIS: "El análisis del antes y el después no se pudo calcular en esta simulación.",
  AYUDA_NUMERO: "Como en la ficha: 3.172 o 4.613,27.",
  BOTON: "Simular",
  CALCULANDO: "Calculando…",
  RESULTADO: "Resultado de la simulación",
  ERRORES: "No se pudo simular con lo escrito:",
  VALOR_ORDEN: "Valor de la orden",
  COMISION: "Comisión",
  CAJA: "Caja",
  VALOR_ACCIONES: "Valor de las acciones",
  ANTES: "antes",
  DESPUES: "después",
  PESOS: "Pesos en el portafolio",
  REGLAS: "Reglas de su plan que la orden toca",
  SIN_REGLAS: "La orden no toca ninguna regla de su plan que rija hoy.",
  AVISOS: "Avisos",
  TARIFAS: "Las tarifas de comisión se cargan en Edición › Tarifas de comisión.",
  FALLO: "No se pudo simular la operación. Intente de nuevo.",
  SESION: "La sesión venció. Ingrese de nuevo.",
  DEMASIADAS: "Demasiadas simulaciones seguidas. Intente de nuevo en un momento.",
  INVALIDO: "Revise lo escrito: la especie, la operación, una cantidad entera y un precio.",
} as const;

export const LADOS_SIMULADOR = [
  { valor: "COMPRAR", texto: "Comprar" },
  { valor: "VENDER", texto: "Vender" },
] as const;

export const COMISIONISTAS_SIMULADOR = [
  { valor: "TRII", texto: "Trii" },
  { valor: "AV", texto: "Acciones & Valores" },
] as const;

export const ORIGEN_COMISION = {
  TARIFA: "de su tarifa",
  HISTORIA: "estimada con su historia",
  SIN_HISTORIA: "no se estima",
} as const;

/** El mensaje por estado HTTP de la ruta (los textos del servidor no se muestran tal cual salvo los de la simulación). */
export function mensajeDeEstado(estado: number): string {
  if (estado === 401) return TEXTOS_SIMULADOR.SESION;
  if (estado === 429) return TEXTOS_SIMULADOR.DEMASIADAS;
  if (estado === 400) return TEXTOS_SIMULADOR.INVALIDO;
  return TEXTOS_SIMULADOR.FALLO;
}
