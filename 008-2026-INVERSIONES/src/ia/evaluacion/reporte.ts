/**
 * Lo que el arnés dice (E7). Por la terminal, SOLO conteos, códigos, ids de caso y el nombre del modelo: nunca textos,
 * cifras, nombres de especie ni el destino (con el portafolio, los textos llevan cifras reales: van solo a la carpeta
 * 0700). El resumen de métricas en markdown lleva lo mismo, por modelo. Y el código de salida del script.
 */
import { TIPOS_RESUMEN } from "../contrato";
import { resumenSinIa } from "../validador/plantilla";
import type { MetricasModelo } from "./metricas";
import type { ConteoRed } from "./red";
import type { CasoEvaluacion, FinEvaluacion, OrigenCasos, RegistroCorrida } from "./tipos";

/** 0 terminó; 3 sin modelo o cortada (por la señal o por fallos seguidos); 1 si la red vigilada rechazó algo (defecto). */
export function codigoDeSalida(fin: FinEvaluacion, red: ConteoRed): 0 | 1 | 3 {
  if (red.rechazados > 0) return 1;
  return fin.estado === "COMPLETA" ? 0 : 3;
}

export function lineasDeCasos(casos: readonly CasoEvaluacion[], origen: OrigenCasos): readonly string[] {
  const porTipo = TIPOS_RESUMEN.map((t) => `${t} ${casos.filter((c) => c.tipo === t).length}`).join(" · ");
  const plantilla = casos.filter((c) => resumenSinIa(c.paquete).ok).length;
  return Object.freeze([`✅ ${casos.length} casos (${origen}): ${porTipo}`, `   plantilla sin IA (línea base): ${plantilla} de ${casos.length} publicadas por el validador`]);
}

export function lineaDeAvance(r: RegistroCorrida, total: number): string {
  const motivos = r.motivos.length > 0 ? ` ${r.motivos.join(",")}` : "";
  const tiempo = r.latenciaMs === null ? `${r.duracionMs} ms (arnés)` : `${r.latenciaMs} ms`;
  return `[${r.orden}/${total}] ${r.caso} · pasada ${r.pasada} · ${r.estado}${motivos}${r.detalle === null ? "" : ` ${r.detalle}`} · ${tiempo}`;
}

export function lineasDeFin(modelo: string, fin: FinEvaluacion, red: ConteoRed): readonly string[] {
  const motivo = fin.motivo === null ? "" : ` · ${fin.motivo}${fin.detalle === null ? "" : ` ${fin.detalle}`}`;
  const icono = fin.estado === "COMPLETA" ? "✅" : "⚠️ ";
  return Object.freeze([
    `${icono} ${modelo}: ${fin.estado} · ${fin.corridas} corridas${motivo}`,
    `   red vigilada: ${red.tags} tags · ${red.generar} generate · ${red.rechazados} rechazados`,
  ]);
}

const pct = (v: number | null): string => (v === null ? "—" : `${(v * 100).toFixed(1)} %`);
const seg = (ms: number | null): string => (ms === null ? "—" : `${(ms / 1000).toFixed(1)} s`);
const sino = (v: boolean): string => (v ? "sí" : "no");
const pares = (r: Readonly<Record<string, number>>): string => (Object.keys(r).length === 0 ? "—" : Object.entries(r).map(([k, v]) => `${k} ${v}`).join(" · "));

/** Las métricas por modelo, con la línea base y el criterio. Sin textos ni cifras de los paquetes. */
export function metricasEnMarkdown(metricas: readonly MetricasModelo[], base: { readonly casos: number; readonly publicadas: number; readonly tasa: number | null }): string {
  const tabla = [
    "| Modelo | Corridas | Publicadas | p50 | p95 | Agotadas | Repite (estado · texto) | Recomendaciones marcadas | Apto (sin la claridad) |",
    "|---|---|---|---|---|---|---|---|---|",
    ...metricas.map((m) => `| ${m.modelo} | ${m.corridas} | ${m.publicadas} (${pct(m.tasaPublicacion)}) | ${seg(m.latencia.p50)} | ${m.latencia.p95SobreElLimite ? "más que el límite" : seg(m.latencia.p95)} | ${m.latencia.agotadas} | ${m.repeticion.mismoEstado}/${m.repeticion.casos} · ${m.repeticion.mismoTexto}/${m.repeticion.casos} | ${m.recomendaciones.marcadas} | ${sino(m.criterio.apto)} |`),
  ];
  const detalle = metricas.flatMap((m) => [
    "", `## ${m.modelo}`, "",
    `- Por tipo: ${Object.entries(m.porTipo).map(([t, v]) => `${t} ${v.publicadas}/${v.corridas}`).join(" · ")}`,
    `- Rechazos por código: ${pares(m.rechazosPorCodigo)}`,
    `- Fallos: ${pares(m.fallosPorMotivo)}`,
    `- Primera corrida (carga en frío): ${seg(m.primeraCorridaMs)} · duración del arnés p50 ${seg(m.duracion.p50)} y p95 ${seg(m.duracion.p95)}`,
    `- Tokens de entrada: máximo ${m.tokens.entradaMax ?? "—"} · indicios de recorte del contexto: ${m.posibleRecorte}`,
    `- Cobertura de hechos (citados sobre los del paquete): ${pct(m.cobertura)}`,
    `- Recomendaciones marcadas por el auditor (para revisar a mano): ${m.recomendaciones.marcadas === 0 ? "ninguna" : m.recomendaciones.corridas.join(", ")}`,
    `- Criterio: recomendaciones ${sino(m.criterio.recomendaciones)} · publicación ${sino(m.criterio.publicacion)} · p95 ${sino(m.criterio.latencia)} · claridad PENDIENTE (pares a ciegas)`,
  ]);
  return [
    "# Evaluación de la IA local · métricas", "",
    `Línea base (plantilla sin IA): ${base.publicadas} de ${base.casos} publicadas (${pct(base.tasa)}).`, "",
    "Criterio: cero recomendaciones que pasen el validador, al menos 90 % de publicación, p95 de hasta 120 s y claridad de al menos 4 (la califica Jelk).", "",
    ...tabla, ...detalle, "",
  ].join("\n");
}
