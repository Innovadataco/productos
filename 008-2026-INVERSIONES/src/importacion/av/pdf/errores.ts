/**
 * Errores del lector de PDF de la certificación de A&V. El mensaje es fijo por código: nunca lleva
 * bytes, texto de una celda ni la causa de Node (el PDF trae datos reales del dueño).
 */
export type CodigoPdf =
  | "PDF_DEMASIADO_GRANDE"
  | "PDF_INVALIDO"
  | "PDF_FORMATO_NO_SOPORTADO"
  | "PDF_CIFRADO"
  | "PDF_XREF_INVALIDA"
  | "PDF_DEMASIADOS_OBJETOS"
  | "PDF_OBJETO_INVALIDO"
  | "PDF_ESTRUCTURA_INVALIDA"
  | "PDF_DEMASIADAS_PAGINAS"
  | "PDF_PROFUNDIDAD_EXCESIVA"
  | "PDF_CADENA_ABIERTA"
  | "PDF_CADENA_LARGA"
  | "PDF_STREAM_INVALIDO"
  | "PDF_FILTRO_NO_SOPORTADO"
  | "PDF_INFLADO_EXCESIVO"
  | "PDF_FUENTE_NO_SOPORTADA"
  | "PDF_RECURSO_NO_SOPORTADO"
  | "PDF_OPERADOR_NO_SOPORTADO"
  | "PDF_CONTENIDO_INVALIDO"
  | "PDF_TEXTO_NO_SOPORTADO"
  | "PDF_DEMASIADO_TEXTO"
  | "PDF_SIN_TEXTO"
  | "PDF_ERROR_INTERNO";

const MENSAJES: Readonly<Record<CodigoPdf, string>> = {
  PDF_DEMASIADO_GRANDE: "El PDF pasa del tamaño máximo permitido.",
  PDF_INVALIDO: "El archivo no es un PDF.",
  PDF_FORMATO_NO_SOPORTADO: "El PDF usa una estructura que el lector no soporta (xref en stream, actualizaciones incrementales u objetos comprimidos).",
  PDF_CIFRADO: "El PDF está cifrado: no se lee.",
  PDF_XREF_INVALIDA: "La tabla de referencias del PDF no corresponde a sus objetos.",
  PDF_DEMASIADOS_OBJETOS: "El PDF tiene más objetos de los permitidos.",
  PDF_OBJETO_INVALIDO: "El PDF tiene un objeto mal formado.",
  PDF_ESTRUCTURA_INVALIDA: "El PDF no tiene la estructura de páginas esperada.",
  PDF_DEMASIADAS_PAGINAS: "El PDF tiene más páginas de las permitidas.",
  PDF_PROFUNDIDAD_EXCESIVA: "El PDF anida objetos más hondo de lo permitido.",
  PDF_CADENA_ABIERTA: "El PDF tiene una cadena de texto sin cerrar.",
  PDF_CADENA_LARGA: "El PDF tiene una cadena de texto más larga de lo permitido.",
  PDF_STREAM_INVALIDO: "El PDF tiene un contenido (stream) mal formado.",
  PDF_FILTRO_NO_SOPORTADO: "El PDF usa una compresión que el lector no soporta.",
  PDF_INFLADO_EXCESIVO: "El contenido comprimido del PDF crece más de lo permitido.",
  PDF_FUENTE_NO_SOPORTADA: "El PDF usa una fuente que no es estándar o una codificación que no es WinAnsi.",
  PDF_RECURSO_NO_SOPORTADO: "El PDF usa un recurso que el lector no soporta (formulario u otro XObject que no es imagen).",
  PDF_OPERADOR_NO_SOPORTADO: "El contenido del PDF usa un operador que el lector no soporta.",
  PDF_CONTENIDO_INVALIDO: "El contenido del PDF tiene un operador con operandos inválidos.",
  PDF_TEXTO_NO_SOPORTADO: "El PDF tiene texto que no se vería como se lee: invisible, claro, tapado, rotado, desplazado, fuera de la página o con caracteres de control.",
  PDF_DEMASIADO_TEXTO: "El PDF tiene más texto del permitido.",
  PDF_SIN_TEXTO: "El PDF no tiene texto que leer.",
  PDF_ERROR_INTERNO: "El lector de PDF falló de una forma no prevista: el archivo no se leyó.",
};

export class ErrorPdf extends Error {
  constructor(readonly codigo: CodigoPdf) {
    super(MENSAJES[codigo]);
    this.name = "ErrorPdf";
  }
}
