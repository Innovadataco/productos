/**
 * Los textos del área de edición (fase B, PR-B), en un solo lugar y con pruebas (tests/unit/edicion/textos.test.ts):
 * cada código del dominio del plan y del borde con su mensaje (la prueba los lee del código), las etiquetas de los
 * campos, los avisos de cada estado y el pie. Para el dueño, sin comandos. El sistema registra lo que el dueño decide
 * y no recomienda comprar ni vender. Puro: lo importan el servidor y los formularios de cliente.
 */
import type { AccionPlan, CondicionRegla } from "@prisma/client";
import { textoAccionRegla, textoCondicion } from "../_plan/textos";
import type { CampoConError } from "./tipos";

export { fecha } from "../tablero/formato";

/** /edicion · el índice de la configuración (frente menu-configuracion): cada entrada con su línea de para qué sirve. */
export const TEXTOS_CONFIGURACION = {
  TITULO: "Configuración",
  ENTRADAS: [
    { texto: "Configuración de la IA", href: "/edicion/ia", para: "Qué modelo usa cada tarea de la IA, local o en la nube, y el tope mensual de gasto de la nube." },
    { texto: "Tarifas de comisión", href: "/edicion/tarifas", para: "La tarifa real de cada casa de bolsa, por lado, que usa el simulador «¿Y si…?» de Operar." },
    { texto: "Editar el plan", href: "/edicion/plan", para: "Una versión nueva del plan con sus reglas; la anterior queda en la historia." },
  ],
} as const;

export const PIE_EDICION =
  "El sistema registra lo que usted decide; no recomienda comprar ni vender. Nada se edita ni se borra: un cambio es una versión nueva o una corrección, y lo anterior queda en la historia.";

export const MENSAJES: Readonly<Record<string, string>> = {
  // Del borde (lectura del formulario)
  FORMATO_INVALIDO: "El formulario llegó incompleto o con un dato que no se puede leer. Vuelva a cargar la página.",
  ID_INVALIDO: "Elija una opción de la lista.",
  NIVEL_NO_RECONOCIDO: "Escríbalo como en la ficha: 1.234,5 (millones con M: 7,3 M).",
  CANTIDAD_NO_RECONOCIDA: "Escriba un número entero de acciones, sin decimales: 3.172.",
  REGLAS_DEMASIADAS: "Son demasiadas reglas para una sola versión.",
  ORDEN_CON_CORRECCION: "Una corrección no lleva orden: las órdenes de la decisión anterior pasan solas a la corrección.",
  // De las validaciones del dominio (las mismas del importador)
  DATOS_INVALIDOS: "Revise los datos marcados.",
  VACIO: "Falta este dato.",
  DEMASIADO_LARGO: "Es demasiado largo: hasta 2.000 caracteres.",
  FECHA_INVALIDA: "No es una fecha válida.",
  FECHA_FUTURA: "Una decisión ya ocurrió: su fecha es hoy o antes.",
  VIGENCIA_DEMASIADO_LEJANA: "La fecha está a más de un año: revísela (la vigencia no puede retroceder después).",
  SIN_REGLAS: "La versión necesita al menos una regla.",
  CONDICION_INVALIDA: "Elija una condición de la lista.",
  ACCION_INVALIDA: "Elija una acción de la lista.",
  NIVEL_FALTA: "Esta condición necesita un nivel.",
  NIVEL_SOBRA: "Esta condición no lleva nivel: déjelo vacío.",
  NIVEL_INVALIDO: "El nivel debe ser mayor que cero, con hasta 14 enteros y 6 decimales.",
  CANTIDAD_INVALIDA: "La cantidad debe ser mayor que cero y no tan grande.",
  CANTIDAD_FALTA: "«No actuar» se mide sobre una cantidad: escríbala.",
  PLAZO_ANTES_DE_LA_VIGENCIA: "El plazo es anterior a la fecha desde la que rige la versión.",
  EXCEPCION_SIN_REGLA: "Una excepción cita la regla de la que se aparta.",
  // De la base y de la cadena
  AUTOR_NO_AUTORIZADO: "Solo el dueño puede guardar cambios.",
  INSTRUMENTO_INEXISTENTE: "Esa especie no está registrada.",
  SIN_PLAN: "No hay una versión del plan vigente en esa fecha.",
  REGLA_INEXISTENTE: "Esa regla no existe.",
  REGLA_DE_OTRA_VERSION: "Esa regla no es de la versión del plan vigente en la fecha de la decisión.",
  REGLA_DE_OTRA_ESPECIE: "Esa regla es de otra especie.",
  ACCION_DISTINTA_SIN_EXCEPCION: "La decisión se aparta de la acción de la regla: márquela como excepción o cite otra regla.",
  DECISION_INEXISTENTE: "Esa decisión no existe.",
  DECISION_REEMPLAZADA: "Esa decisión ya se corrigió: use la corrección.",
  DECISION_YA_REEMPLAZADA: "Esa decisión ya se corrigió mientras editaba. Vuelva a cargar la página.",
  ORDEN_INEXISTENTE: "Esa orden no existe.",
  ORDEN_NO_APROBADA: "Esa orden no quedó aprobada en Trii.",
  NO_ACTUAR_SIN_ORDEN: "«No actuar» no lleva orden.",
  ESPECIE_DISTINTA: "La orden es de otra especie.",
  LADO_DISTINTO: "La orden no es del lado de la decisión (compra o venta).",
  ORDEN_ANTERIOR_A_LA_DECISION: "La orden es anterior a la decisión.",
  ORDEN_YA_ENLAZADA: "Esa orden ya tiene su decisión registrada.",
  YA_ENLAZADA_A_ESA_DECISION: "Esa orden ya está enlazada a esta decisión.",
  ENLACE_YA_REEMPLAZADO: "Ese enlace cambió mientras editaba. Vuelva a cargar la página.",
  PLAN_CAMBIO: "Mientras editaba se guardó otra versión del plan. Vuelva a cargar la página para partir de ella.",
  VIGENCIA_RETROCEDE: "La fecha es anterior a la de la última versión: la vigencia no retrocede.",
  // De la conexión
  SESION_VENCIDA: "La sesión venció. Ingrese de nuevo.",
  DEMASIADAS: "Demasiadas solicitudes. Espere un momento e intente de nuevo.",
  ORDEN_SIN_ELEGIR: "Elija la orden de Trii que ejecutó esta decisión.",
  SIN_ORDENES_POSIBLES: "No hay órdenes de Trii que quepan en esta decisión: aprobadas, sin decisión, de la misma especie y lado, y no anteriores a ella.",
  DESCONOCIDO: "No se pudo guardar. Intente de nuevo.",
};

export const ETIQUETAS_CAMPO: Readonly<Record<string, string>> = {
  vigenteDesde: "Rige desde",
  motivo: "Motivo",
  versionBase: "Versión de partida",
  reglas: "Reglas",
  instrumentoId: "Especie",
  condicion: "Condición",
  nivel: "Nivel",
  accion: "Acción",
  cantidad: "Cantidad",
  plazoHasta: "Plazo hasta",
  detalle: "Detalle",
  fechaDecision: "Fecha de la decisión",
  reglaId: "Regla que cita",
  excepcion: "Excepción",
  ordenId: "Orden de Trii",
  decisionId: "Decisión",
  corrige: "Decisión que corrige",
};

export const TEXTOS_ESTADO = {
  SIN_PLAN: "Todavía no hay un plan: cree la primera versión antes de registrar decisiones.",
  CORRECCION_INVALIDA: "Esa decisión no existe o ya se corrigió: solo se corrige la vigente.",
  NO_EXISTE: "No hay una decisión con ese identificador.",
  REEMPLAZADA: "Esa decisión ya se corrigió: las órdenes se enlazan a la corrección.",
  NO_ACTUAR: "«No actuar» no tiene órdenes que enlazar.",
} as const;

export const TEXTOS_PLAN = {
  TITULO: "Nueva versión del plan",
  INTRO: "La versión nueva es la foto completa del plan desde su fecha: reemplaza entera a la anterior, que queda en la historia.",
  PRIMERA: "Todavía no hay un plan: esta será la primera versión.",
  BOTON: "Guardar la versión nueva",
  AGREGAR: "Agregar una regla",
  PORTAFOLIO: "Portafolio (todas las especies)",
  AYUDA_NIVEL: "Como en la ficha: 1.234,5 · millones con M: 7,3 M. Solo con las condiciones que lo llevan.",
  AYUDA_CANTIDAD: "Opcional. Entero: 3.172.",
  AYUDA_PLAZO: "Opcional.",
  AYUDA_VIGENCIA: "No puede ser anterior a la última versión.",
  OBLIGATORIOS: "Los campos sin «opcional» son obligatorios.",
  FECHA_PASADA: "Esa fecha ya pasó: la versión regirá también hacia atrás desde ella.",
  PLAZO_VENCIDO: "Su plazo es anterior a la fecha de la versión: quítela o cambie el plazo (la regla vencida queda en la versión anterior).",
  ENVIANDO: "Guardando la versión…",
  RESUMEN: "Revise estos datos",
} as const;

export const TEXTOS_DECISION = {
  TITULO: "Registrar una decisión",
  TITULO_CORRECCION: "Corregir una decisión",
  INTRO: "Qué decidió, por qué y con qué regla. «No actuar» también se registra y se mide.",
  BOTON: "Registrar la decisión",
  BOTON_CORRECCION: "Registrar la corrección",
  SIN_REGLA: "Sin regla citada",
  SIN_ORDEN: "Sin orden (se puede enlazar después)",
  NO_ACTUAR_SIN_ORDEN: "«No actuar» no lleva orden.",
  AYUDA_REGLA: "Opcional. Las de la versión vigente en la fecha de la decisión, de esa especie o del portafolio.",
  AYUDA_EXCEPCION: "Elija primero una regla que citar: la excepción se aparta de ella.",
  AYUDA_ORDEN: "Órdenes aprobadas de Trii sin decisión, de esa especie y lado, desde la fecha de la decisión.",
  AYUDA_CANTIDAD: "Obligatoria en «no actuar». Entero: 3.172.",
  CORRECCION: "La decisión anterior queda en la historia; sus órdenes pasan a esta corrección.",
  ENVIANDO: "Registrando la decisión…",
} as const;

export const TEXTOS_ENLACE = {
  TITULO: "Enlazar una orden de Trii",
  INTRO: "La orden que ejecutó esta decisión. Cambiar un enlace ya hecho no se hace desde aquí.",
  BOTON: "Enlazar la orden",
  ELIJA: "Elija la orden",
  ENVIANDO: "Enlazando la orden…",
} as const;

const ACCIONES_DECISION: Readonly<Record<AccionPlan, string>> = { COMPRAR: "Comprar", VENDER: "Vender", NO_ACTUAR: "No actuar" };
export const textoAccionDecisionCorta = (a: AccionPlan): string => ACCIONES_DECISION[a];

export const CONDICIONES: readonly CondicionRegla[] = ["NINGUNA", "CIERRE_BAJO", "CIERRE_SOBRE", "MONTO_ORDEN_BAJO", "LIBRE"];
export const ACCIONES: readonly AccionPlan[] = ["COMPRAR", "VENDER", "NO_ACTUAR"];
/** Las condiciones que no llevan nivel (la regla del dominio, src/plan/validar.ts). */
export const SIN_NIVEL: ReadonlySet<CondicionRegla> = new Set<CondicionRegla>(["NINGUNA", "LIBRE"]);
export { textoAccionRegla, textoCondicion };

export const mensajeDeError = (codigo: string): string => MENSAJES[codigo] ?? MENSAJES["DESCONOCIDO"]!;

/** «Se quitó la regla 2. Quedan 3 reglas.»: lo que anuncia la región de estado al quitar una regla. */
export function textoReglaQuitada(numero: number, quedan: number): string {
  const resto = quedan === 0 ? "No queda ninguna regla." : quedan === 1 ? "Queda 1 regla." : `Quedan ${quedan} reglas.`;
  return `Se quitó la regla ${numero}. ${resto}`;
}

const CAMPO_DE_REGLA = /^reglas\[(\d+)\](?:\.(\w+))?$/;

/** «Regla 3 · Nivel: …», «Motivo: …» o, para todo el pedido, solo el mensaje. */
export function mensajeDeCampo(e: CampoConError): string {
  const mensaje = mensajeDeError(e.codigo);
  const regla = CAMPO_DE_REGLA.exec(e.campo);
  if (regla) return regla[2] ? `Regla ${Number(regla[1]) + 1} · ${ETIQUETAS_CAMPO[regla[2]] ?? regla[2]}: ${mensaje}` : `Regla ${Number(regla[1]) + 1}: ${mensaje}`;
  const etiqueta = ETIQUETAS_CAMPO[e.campo];
  return etiqueta ? `${etiqueta}: ${mensaje}` : mensaje;
}
