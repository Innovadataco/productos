// Los datos de /edicion/ia (E8) que las pruebas de la página y del formulario le pasan a los componentes. Inventados.
import type { DatosEdicionIa } from "@/app/edicion/ia/tipos-ia";

const tarea = (activo: boolean, modeloLocal: string) => ({ activo, modeloLocal });

export const DATOS_IA_FICTICIOS: DatosEdicionIa = {
  versionBase: 7,
  vigente: { version: 7, desde: "17-mar-2027 18:41" },
  inicial: {
    modo: "local-luego-nube", ollamaHost: "", ollamaPuerto: "", temperatura: "0",
    tareas: { DIARIO: tarea(true, "qwen2.5:14b"), REGLAS: tarea(true, "aya-expanse:32b"), ESCENARIOS: tarea(false, "") },
    modeloNube: "claude-opus-5-5", esfuerzoNube: "low", topeMensualUsd: "4,61", horaResumen: "19:00", limiteSegundos: "60", analisisDemanda: false,
  },
  guardado: { hayDestino: true, modelos: { DIARIO: "qwen2.5:14b", REGLAS: "aya-expanse:32b", ESCENARIOS: "" } },
  opciones: {
    modos: [{ valor: "apagado", texto: "Apagada" }, { valor: "local", texto: "Solo la local" }, { valor: "nube", texto: "Solo la nube" }, { valor: "local-luego-nube", texto: "La local y, si falla, la nube" }],
    modelosNube: [
      { valor: "claude-opus-5-5", texto: "Opus 5.5", precio: "USD 4 y USD 20 por millón de tokens" },
      { valor: "claude-haiku-5-5", texto: "Haiku 5.5", precio: "USD 0,10 y USD 0,50 por millón de tokens" },
    ],
    esfuerzos: [{ valor: "low", texto: "Bajo" }, { valor: "medium", texto: "Medio" }],
    horas: ["18:00", "19:00", "20:00", "21:00"],
    tareas: [{ valor: "DIARIO", texto: "Resumen diario" }, { valor: "REGLAS", texto: "Reglas del plan" }, { valor: "ESCENARIOS", texto: "Escenarios" }],
    modelosLocales: [
      { nombre: "qwen2.5:14b", nota: "Recomendado para 008 (nota ficticia)", recomendado: true, aviso32b: false },
      { nombre: "gemma2:27b", nota: null, recomendado: false, aviso32b: false },
      { nombre: "aya-expanse:32b", nota: null, recomendado: false, aviso32b: true },
    ],
    limites: { limiteMin: 10, limiteMax: 60, topeMin: "1", topeMax: "50" },
  },
  listaPi: { estado: "LISTA", detalle: "LISTA_PUBLICADA", publicadoPor: "PI (ficticio)", fecha: "14-ene-2027" },
  puertas: [
    { puerta: "local", enUso: true, estado: "FALTA", requisitos: [{ clave: "DESTINO", estado: "FALTA", detalle: "SIN_DESTINO" }, { clave: "SONDA", estado: "POR_VERIFICAR", detalle: "SERVICIO_IA_PENDIENTE" }] },
    { puerta: "nube", enUso: true, estado: "FALTA", requisitos: [{ clave: "LLAVE", estado: "FALTA", detalle: "SIN_LLAVE" }, { clave: "TOPE", estado: "LISTO", detalle: "TOPE_GUARDADO" }] },
  ],
  gasto: { estado: "LEIDO", mes: "mar-2027", usado: "0,13", tope: "4,61", corridas: 3 },
  llaveCargada: false,
  sonda: "PENDIENTE",
  historia: [{ version: 7, modo: "La local y, si falla, la nube", motivo: "Cambio ficticio", autor: "dueno@ejemplo.invalid", fecha: "17-mar-2027 18:41" }],
  guardada: null,
};
