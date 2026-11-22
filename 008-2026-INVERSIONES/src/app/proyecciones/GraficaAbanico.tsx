"use client";
/**
 * La gráfica de abanico (frente proyecciones-pantalla): la historia real del valor antes de «Hoy» y, desde hoy, la
 * mediana con las bandas P25–P75 y P5–P95 (con degradado) y lo aportado. Usa la gráfica de tiempo del módulo
 * reutilizable (src/app/_graficas).
 * - Al llegar otro resultado, el abanico va del anterior al nuevo por cuadros: se interpola el «plano» de tamaño fijo
 *   (src/app/proyecciones/abanico.ts) con la transición del módulo, y lo del cuadro va en `dibujo`; la leyenda, el
 *   detalle, el deslizador y la tabla dicen ya el resultado nuevo. Con «reducir movimiento», salta.
 * - Mira y detalle por mes: la historia es mensual y la proyección, un día por mes («Mes m · fecha»).
 */
import { useMemo } from "react";
import { GraficaTiempo, useTransicion, type Banda, type SerieTiempo } from "@/app/_graficas";
import { cop, copCompacto, etiquetaTick, fecha } from "@/app/tablero/formato";
import { aPlano, armarAbanico, dePlano, type Abanico as DatosAbanico } from "./abanico";
import type { PuntoHistoria } from "./historia";
import { textoHorizonte } from "./opciones";
import type { VistaProyeccion } from "./vista";

export const TITULO_ABANICO = "Valor real y proyección";
const ALTO = 300;

function series(a: DatosAbanico): SerieTiempo[] {
  return [
    { id: "real", nombre: "Valor real", tono: "valor", valores: a.real },
    { id: "p50", nombre: "Mediana", tono: "c1", valores: a.p50 },
    { id: "aportado", nombre: "Lo aportado", tono: "costo", valores: a.aportado, trazo: "punteado" },
  ];
}

function bandas(a: DatosAbanico): Banda[] {
  return [
    { id: "p5-p95", nombre: "P5–P95", tono: "c1", intensidad: "suave", bajo: a.p5, alto: a.p95, degradado: true },
    { id: "p25-p75", nombre: "P25–P75", tono: "c1", intensidad: "media", bajo: a.p25, alto: a.p75, degradado: true },
  ];
}

function resumen(historia: readonly PuntoHistoria[], v: VistaProyeccion): string {
  const [primero, ultimo] = [historia[0], historia.at(-1)];
  const antes = primero && ultimo ? `Historia real del ${fecha(primero.dia)} al ${fecha(ultimo.dia)}: de ${cop(primero.valor)} a ${cop(ultimo.valor)}. ` : "Sin historia del valor. ";
  const inicio = v.puntos[0]?.p50 ?? 0;
  return (
    `${antes}Desde hoy, ${fecha(v.hoy)}, a ${textoHorizonte(v.controles.horizonteMeses)}: la mediana va de ${cop(inicio)} a ${cop(v.final.p50)}; ` +
    `el 90 % de las trayectorias termina entre ${cop(v.final.p5)} y ${cop(v.final.p95)} (P5–P95). Lo aportado al final: ${cop(v.final.aportado)}.`
  );
}

export function Abanico({ historia, vista }: { readonly historia: readonly PuntoHistoria[]; readonly vista: VistaProyeccion }) {
  const final = useMemo(() => armarAbanico(historia, vista), [historia, vista]);
  const finales = useMemo(() => ({ series: series(final), bandas: bandas(final) }), [final]);
  const plano = useMemo(() => aPlano(vista.puntos), [vista.puntos]);
  const formatoDia = useMemo(() => {
    const mesDe = new Map(final.dias.map((d, i) => [d, final.mes[i] ?? null]));
    return (d: string) => {
      const m = mesDe.get(d) ?? null;
      if (m === null) return fecha(d);
      return m === 0 ? `Hoy · ${fecha(d)}` : `Mes ${m} · ${fecha(d)}`;
    };
  }, [final]);
  const animado = useTransicion(plano);
  const cuadro = animado === plano ? null : armarAbanico(historia, vista, dePlano(animado, vista.puntos.length - 1));
  return (
    <GraficaTiempo
      titulo={TITULO_ABANICO} resumen={resumen(historia, vista)} alto={ALTO} dias={final.dias} series={finales.series} bandas={finales.bandas}
      corte={{ indice: final.indiceHoy, nombre: "Hoy" }} formatoY={cop} formatoEje={copCompacto} formatoDia={formatoDia} formatoTick={etiquetaTick}
      dibujo={cuadro ? { series: series(cuadro), bandas: bandas(cuadro) } : undefined}
    />
  );
}
