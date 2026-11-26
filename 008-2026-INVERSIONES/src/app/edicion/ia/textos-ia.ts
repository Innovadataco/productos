/**
 * Los textos de /edicion/ia (E8) en un solo lugar, con pruebas (tests/unit/edicion/ia/pagina-ia.test.ts): los avisos
 * fijos, lo que no se configura con su razón, las etiquetas y el mensaje de cada código que puede mandar el servidor.
 * Para el dueño, de usted y sin comandos. Puro y sin imports: lo usan el servidor y los componentes de cliente. Sin
 * direcciones escritas (una IPv4 en un texto la marca el cruce de literales de la Fábrica).
 */
export const TEXTOS_IA = {
  TITULO: "Configuración de la IA",
  INTRO: "Cada cambio es una versión nueva, con su motivo; la anterior queda en la historia. Sin ninguna versión, la IA está apagada.",
  FLUJO: "Cómo se configura la local: 1) guarde la dirección y el puerto del Ollama; 2) identifique los modelos y pruébelos; 3) elija el modelo de cada tarea y guarde.",
  BOTON: "Guardar la versión nueva",
  ENVIANDO: "Guardando la versión…",
  IDENTIFICAR: "Identificar modelos",
  PROBAR: "Probar",
  CONSULTANDO: "Consultando al Ollama…",
  RESUMEN: "Revise estos datos",
  OBLIGATORIOS: "El motivo es obligatorio; los demás campos traen la versión vigente.",
  SIN_MODELO: "Sin modelo",
  RECOMENDADO: "recomendado para Inversiones",
  EN_LISTA: "En la lista de PI",
  LLAVE_SI: "Llave de la nube en el entorno de la app: sí",
  LLAVE_NO: "Llave de la nube en el entorno de la app: no",
  LLAVE_NUNCA: "La llave nunca se guarda en la base ni se muestra.",
  AYUDA_ANALISIS: "Enciende el botón «Analizar con IA» en el tablero, el plan y las proyecciones (solo para el dueño). Apagado por omisión: sin esta casilla, el botón no aparece. Un análisis a la vez, uno en espera y 2 minutos entre análisis.",
  PRECIOS: "Precios de la documentación de Anthropic (skill claude-api), por verificar antes de encender la nube.",
} as const;

export const AVISOS_IA = {
  NUBE_COSTO: "Encender la nube tiene costo y envía a Anthropic los hechos ciegos (sin cifras, especies ni cuentas).",
  FIREWALL: "En producción, el servidor solo puede llegar a la dirección y al puerto del Mac que autorizó PI. Cualquier otra dirección queda bloqueada por el firewall y la prueba falla.",
  TEMPERATURA: "Aviso: con más de 0, el mismo dato puede dar textos distintos; el validador sigue revisando todo.",
  RECARGA_32B: "recarga unos 20 GB en frío en cada corrida",
  SONDA_PENDIENTE: "Desde el servidor, la conexión la hace el servicio de IA (pendiente).",
  INALCANZABLE: "Ollama inalcanzable. Puede ser el bloqueo del firewall: en producción el servidor solo llega a la dirección y al puerto del Mac que autorizó PI.",
  FUERA_DE_LISTA: "Fuera de la lista de PI: para usarlo, se le propone a PI.",
  DIGEST_DISTINTO: "Instalado con otro digest que el de la lista de PI: no se puede elegir.",
  GUARDE_DESTINO: "Guarde primero la dirección y el puerto: identificar y probar usan solo lo guardado.",
  SIN_LISTA: "Sin la lista de modelos de PI no se puede elegir un modelo local.",
  SIN_TOPE: "Sin tope mensual, la nube no corre.",
  YA_NO_EN_LISTA: "ya no está en la lista de PI",
  SIN_IDENTIFICAR: "sin identificar como instalado",
  NO_SELECCIONABLE: "no instalado o con otro digest",
  AYUDA_MODELO: "Solo se elige un modelo de la lista de PI que «Identificar modelos» encontró instalado con su digest; el guardado se conserva.",
} as const;

/** Lo que NO se configura, y por qué (como en PI, más lo propio de 008). */
export const FIJOS_IA: readonly { readonly que: string; readonly porque: string }[] = [
  { que: "Los esquemas de salida (JSON Schema)", porque: "son el contrato con el validador: cambiarlos es otra versión del contrato." },
  { que: "El validador, sus límites y su vocabulario", porque: "cambiarlos es otra versión del validador, con sus pruebas." },
  { que: "La vista ciega", porque: "el modelo nunca recibe cifras, especies ni cuentas: eso no se apaga." },
  { que: "Cómo se resuelve la dirección del Ollama", porque: "es una sola, la guardada aquí; las pruebas nunca usan otra." },
  { que: "La semilla fija de la local", porque: "con temperatura 0, el mismo dato da el mismo texto (reproducibilidad, como en PI)." },
  { que: "Un pedido a la vez, el modelo descargado al terminar y el contexto por omisión del modelo", porque: "Inversiones no deja un modelo cargado en el Mac de PI ni lo hace recargar: PI tiene la prioridad." },
];

const MENSAJES: Readonly<Record<string, string>> = {
  // Del borde
  FORMATO_INVALIDO: "El formulario llegó incompleto o con un dato que no se puede leer. Vuelva a cargar la página.",
  DATOS_INVALIDOS: "Revise los datos marcados.",
  VACIO: "Falta este dato.",
  DEMASIADO_LARGO: "Es demasiado largo: hasta 2.000 caracteres.",
  // De cada campo
  MODO_INVALIDO: "Elija un modo de la lista.",
  MODELO_NUBE_INVALIDO: "Elija un modelo de la nube de la lista.",
  ESFUERZO_INVALIDO: "Elija un esfuerzo de la lista.",
  HORA_INVALIDA: "Elija una hora de la lista.",
  LIMITE_INVALIDO: "El límite es un número entero de segundos, de 10 a 60.",
  TEMPERATURA_INVALIDA: "La temperatura va de 0 a 1, con hasta dos decimales: 0, 0,2 o 0,37.",
  TOPE_INVALIDO: "Escriba el tope en dólares, con hasta dos decimales: 5 o 4,61.",
  TOPE_FUERA_DE_RANGO: "El tope va de USD 1 a USD 50.",
  TOPE_FALTA: "Con la nube, el tope mensual es obligatorio: sin tope, la nube no corre.",
  DESTINO_INVALIDO: "Escriba la dirección como cuatro números separados por puntos y el puerto como un número de 1 a 65535.",
  DESTINO_FUERA_DE_FORMATO: "La dirección debe ser de la red privada (tailnet): el primer número 100 y el segundo entre 64 y 127.",
  DESTINO_INCOMPLETO: "La dirección y el puerto van juntos: escriba los dos o ninguno.",
  DESTINO_FALTA: "Con la local, la dirección y el puerto del Ollama son obligatorios.",
  MODELO_LOCAL_FALTA: "Esta tarea está activa y la local la usa: elija su modelo.",
  MODELO_FUERA_DE_LISTA: "Ese modelo no está en la lista de PI.",
  SIN_LISTA_DE_PI: "Sin la lista de modelos de PI no se puede elegir un modelo local.",
  // De la base y de la conexión
  CONFIG_CAMBIO: "Mientras editaba se guardó otra versión de la configuración. Vuelva a cargar la página para partir de ella.",
  AUTOR_INEXISTENTE: "Solo el dueño puede guardar cambios.",
  SESION_VENCIDA: "La sesión venció. Ingrese de nuevo.",
  DEMASIADAS: "Demasiadas solicitudes: espere unos segundos e intente de nuevo.",
  // Del estado de las puertas
  LISTA_PUBLICADA: "La lista de modelos de PI está cargada.",
  LISTA_VACIA: "La lista de modelos de PI está vacía.",
  SIN_VARIABLE: "Falta la lista de modelos de PI: la app no tiene configurada su carpeta compartida.",
  RUTA_INVALIDA: "Falta la lista de modelos de PI: la carpeta compartida no es válida.",
  ARCHIVO_AUSENTE: "Falta la lista de modelos de PI: el archivo no está en la carpeta compartida.",
  ARCHIVO_ILEGIBLE: "La lista de modelos de PI no se pudo leer.",
  ARCHIVO_DEMASIADO_GRANDE: "La lista de modelos de PI es demasiado grande.",
  JSON_INVALIDO: "La lista de modelos de PI no es un JSON válido.",
  ESQUEMA_INVALIDO: "La lista de modelos de PI no tiene la forma acordada.",
  VERSION_DESCONOCIDA: "La lista de modelos de PI es de una versión que esta app no conoce.",
  DESTINO_GUARDADO: "La dirección y el puerto están guardados.",
  SIN_DESTINO: "Falta la dirección y el puerto del Ollama.",
  SIN_CONFIGURACION: "Todavía no hay una configuración guardada.",
  SIN_TAREAS_ACTIVAS: "Ninguna tarea está activa.",
  MODELO_FALTA: "Una tarea activa no tiene modelo.",
  MODELOS_DE_LA_LISTA: "Cada tarea activa tiene un modelo de la lista de PI.",
  DIGEST_DE_PI: "El digest de cada modelo viene de la lista de PI.",
  SIN_DIGEST_DE_PI: "No se conoce el digest de algún modelo (no está en la lista de PI).",
  SERVICIO_IA_PENDIENTE: "La conexión la hace el servicio de IA, que todavía no está.",
  CANDADOS_DE_RED_DE_PI: "Los candados de red de PI (proxy del Mac, ACL de Tailscale y regla del host) no se pueden ver desde la app.",
  LLAVE_CARGADA: "La llave está en el entorno de la app.",
  SIN_LLAVE: "La llave no está en el entorno de la app.",
  TOPE_GUARDADO: "El tope mensual está guardado.",
  SIN_TOPE: "Falta el tope mensual: sin tope, la nube no corre.",
  PROXY_DE_SALIDA: "El proxy de salida a Anthropic (con lista de dominios) no se puede ver desde la app.",
  PRECIOS_DE_LA_SKILL: "Los precios son los de la documentación: por verificar antes de encender.",
  // De la sonda
  CONEXION_RECHAZADA: "El Ollama rechazó la conexión.",
  FALLO_DE_RED: "No hubo conexión con el Ollama.",
  CONEXION_CORTADA: "La conexión se cortó a mitad de la respuesta.",
  LIMITE_DEL_CLIENTE: "El Ollama no contestó a tiempo.",
  MODELO_NO_ENCONTRADO: "El modelo no está instalado en el Ollama.",
  DIGEST_NO_COINCIDE: "El modelo instalado tiene otro digest que el de la lista de PI.",
  MODELO_NO_APROBADO: "Ese modelo ya no está en la lista de PI.",
  CUERPO_INVALIDO: "El Ollama devolvió una respuesta que no se puede leer.",
  EXCEPCION_INTERNA: "No se pudo completar la consulta.",
  DESCONOCIDO: "No se pudo completar. Intente de nuevo.",
};

/** Los códigos con mensaje propio (los prueba la prueba de textos). */
export const CODIGOS_CON_MENSAJE: readonly string[] = Object.keys(MENSAJES).filter((c) => c !== "DESCONOCIDO");

export const mensajeIa = (codigo: string): string => MENSAJES[codigo] ?? MENSAJES["DESCONOCIDO"]!;

export const ETIQUETAS_IA: Readonly<Record<string, string>> = {
  versionBase: "Versión de partida",
  modo: "Modo",
  ollamaHost: "Dirección del Ollama",
  ollamaPuerto: "Puerto",
  temperatura: "Temperatura de la local",
  tareas: "Tareas",
  modeloNube: "Modelo de la nube",
  esfuerzoNube: "Esfuerzo de la nube",
  topeMensualUsd: "Tope mensual de la nube (USD)",
  horaResumen: "Hora del resumen",
  limiteSegundos: "Límite por pedido (segundos)",
  analisisDemanda: "Permitir el análisis a demanda (botón «Analizar con IA»)",
  motivo: "Motivo del cambio",
  cuerpo: "Formulario",
};

const CAMPO_DE_TAREA = /^tareas\.([A-Z]+)\.modeloLocal$/;

/** «Tope mensual de la nube (USD): …», o con la tarea: «Tarea DIARIO · Modelo local: …». */
export function mensajeDeCampoIa(campo: string, codigo: string, nombreTarea: (clave: string) => string): string {
  const m = CAMPO_DE_TAREA.exec(campo);
  if (m) return `${nombreTarea(m[1]!)} · Modelo local: ${mensajeIa(codigo)}`;
  const etiqueta = ETIQUETAS_IA[campo];
  return etiqueta ? `${etiqueta}: ${mensajeIa(codigo)}` : mensajeIa(codigo);
}

/** El texto de un estado de requisito o de puerta. */
export const ESTADOS_IA: Readonly<Record<string, string>> = { LISTO: "Listo", FALTA: "Falta", POR_VERIFICAR: "Por verificar" };
export const PUERTAS_IA: Readonly<Record<string, string>> = { local: "Puerta local (Ollama del Mac)", nube: "Puerta nube (API de Claude)" };
export const REQUISITOS_IA: Readonly<Record<string, string>> = {
  LISTA_PI: "Lista de modelos de PI",
  DESTINO: "Dirección y puerto",
  MODELOS: "Modelos de las tareas",
  DIGEST: "Digest de los modelos",
  SONDA: "Sonda (ping y prueba)",
  RED_PI: "Candados de red de PI",
  LLAVE: "Llave",
  TOPE: "Tope mensual",
  PROXY_SALIDA: "Proxy de salida",
  PRECIOS: "Precios",
  SERVICIO_IA: "Servicio de IA",
};

/** Un tamaño en bytes como «9,0 GB» (es-CO). */
export function tamanoTexto(bytes: number | null): string {
  if (bytes === null) return "tamaño desconocido";
  return `${(bytes / 1e9).toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB`;
}

/** Los primeros caracteres de un digest, para reconocerlo. */
export const digestCorto = (digest: string | null): string => (digest === null ? "sin digest" : `${digest.slice(0, 12)}…`);
