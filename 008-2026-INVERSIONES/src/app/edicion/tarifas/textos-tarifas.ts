/**
 * Los textos de /edicion/tarifas (O5), en un solo lugar y con su candado de lenguaje (tests/unit/edicion/tarifas/). Dicen
 * qué es cada dato y cómo se calcula; nunca juzgan una tarifa ni una operación. Sin imports en valor: los usa también el
 * formulario de cliente.
 */
export const TEXTOS_TARIFAS = {
  TITULO: "Tarifas de comisión",
  INTRO: "La tarifa real de cada casa de bolsa, por lado. El simulador «¿Y si…?» de Operar la usa; sin tarifa, estima la comisión con su historia.",
  FORMULA: "Comisión = el mayor entre (valor × porcentaje) y el mínimo por orden, más el fijo por orden. El IVA va sobre esa comisión. Los otros cargos van aparte: un porcentaje del valor o un fijo.",
  TOLERANCIA: "El control compara lo que cobraría la tarifa con la comisión real de cada orden aprobada de ese lado; la explica si la diferencia es de 1 peso o menos (la casa de bolsa redondea a pesos).",
  VIGENTES: "Vigentes hoy",
  SIN_TARIFA: "Sin tarifa: la comisión se estima con su historia.",
  NUEVA: "Nueva versión",
  HISTORIA: "Historia",
  SIN_HISTORIA: "Todavía no hay tarifas guardadas.",
  GUARDAR: "Guardar la versión",
  GUARDANDO: "Guardando…",
  GUARDADA: "Versión guardada",
  AGREGAR_CARGO: "Agregar otro cargo",
  QUITAR_CARGO: "Quitar este cargo",
  OTROS_CARGOS: "Otros cargos",
  SIN_CARGOS: "Sin otros cargos.",
  ERRORES: "Revise los datos marcados.",
} as const;

export const ETIQUETAS_TARIFA = {
  comisionista: "Comisionista",
  lado: "Lado",
  porcentaje: "Porcentaje sobre el valor (%)",
  minimoPorOrden: "Mínimo por orden ($)",
  fijoPorOrden: "Fijo por orden ($)",
  ivaPct: "IVA sobre la comisión (%)",
  vigenteDesde: "Vigente desde",
  motivo: "Motivo del cambio",
  nombre: "Nombre del cargo",
  tipo: "Tipo",
  valor: "Valor",
} as const;

export const AYUDAS_TARIFA = {
  numero: "Como en la ficha: 0,25 o 4.613,27. Hasta 4 decimales.",
  vigenteDesde: "Desde ese día rige, hasta que otra versión del mismo comisionista y lado la reemplace.",
  cargo: "Un porcentaje del valor de la orden o un fijo en pesos. Sin IVA.",
} as const;

const MENSAJES: Readonly<Record<string, string>> = {
  FORMATO_INVALIDO: "Ese dato no se puede leer. Vuelva a cargar la página.",
  VACIO: "Falta este dato.",
  DEMASIADO_LARGO: "Es demasiado largo: hasta 2.000 caracteres.",
  PORCENTAJE_INVALIDO: "Escriba un porcentaje de 0 a 100, con hasta 4 decimales.",
  IVA_INVALIDO: "Escriba un porcentaje de 0 a 100, con hasta 2 decimales.",
  MONTO_INVALIDO: "Escriba un monto de 0 o más (menos de cien millones), con hasta 4 decimales.",
  COMISIONISTA_INVALIDO: "Elija un comisionista de la lista.",
  LADO_INVALIDO: "Elija compra o venta.",
  TIPO_CARGO_INVALIDO: "Elija porcentaje o fijo.",
  NOMBRE_INVALIDO: "El nombre va en una línea, con hasta 60 caracteres.",
  CARGOS_DEMASIADOS: "Son demasiados cargos: hasta 3.",
  FECHA_INVALIDA: "No es una fecha válida.",
  VIGENCIA_DEMASIADO_LEJANA: "La fecha está a más de un año: revísela.",
  TARIFA_CAMBIO: "Mientras editaba se guardó otra versión. Vuelva a cargar la página.",
  AUTOR_INEXISTENTE: "Solo el dueño puede guardar cambios.",
};

export const mensajeTarifa = (codigo: string): string => MENSAJES[codigo] ?? "No se pudo guardar. Intente de nuevo.";

/** «Bolsa · Valor: …» para un campo de un cargo (otrosCargos.1.valor), o la etiqueta del campo. */
export function etiquetaDeCampo(campo: string): string {
  const m = /^otrosCargos\.(\d)\.(nombre|tipo|valor)$/.exec(campo);
  if (m) return `Cargo ${Number(m[1]) + 1} · ${ETIQUETAS_TARIFA[m[2] as "nombre" | "tipo" | "valor"]}`;
  return (ETIQUETAS_TARIFA as Readonly<Record<string, string>>)[campo] ?? (campo === "otrosCargos" ? TEXTOS_TARIFAS.OTROS_CARGOS : "Formulario");
}
