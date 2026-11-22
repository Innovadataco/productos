"use client";
/**
 * Los cuatro indicadores del escenario (frente proyecciones-pantalla), con su cifra que cuenta hacia arriba: el valor
 * mediano al final con su rango P5–P95, lo aportado, la probabilidad de terminar por debajo de lo aportado y la peor
 * caída mediana. El lector de pantalla oye siempre la cifra final con su nombre; la cuenta es solo visual.
 */
import { cop, numero } from "@/app/tablero/formato";
import { useCifra } from "./cifra";
import type { VistaProyeccion } from "./vista";

const SIN_DATO = "—";
const PCT = 100;
const porcentaje = (v: number): string => `${numero(v, 1)} %`;
/** La caída va con su signo: «−9,2 %»; sin caída, «0,0 %». */
const caida = (v: number): string => (Number(v.toFixed(1)) === 0 ? "0,0 %" : `−${numero(Math.abs(v), 1)} %`);

interface PropsCifra { readonly etiqueta: string; readonly valor: number | null; readonly formato: (v: number) => string }

function Cifra({ etiqueta, valor, formato }: PropsCifra) {
  const { valor: v, fase } = useCifra(valor);
  return (
    <span className="num proy-cifra">
      <span className="sr">{`${etiqueta}: ${valor === null ? SIN_DATO : formato(valor)}`}</span>
      <span className="cifra" data-fase={valor === null ? "fin" : fase} aria-hidden="true">{v === null ? SIN_DATO : formato(v)}</span>
    </span>
  );
}

interface PropsIndicador { readonly etiqueta: string; readonly valor: number | null; readonly formato: (v: number) => string; readonly detalle: string; readonly destacado?: boolean }

function Indicador({ etiqueta, valor, formato, detalle, destacado = false }: PropsIndicador) {
  return (
    <li className={`proy-indicador${destacado ? " proy-destacado" : ""}`}>
      <span className="eyebrow" aria-hidden="true">{etiqueta}</span>
      <Cifra etiqueta={etiqueta} valor={valor} formato={formato} />
      <span className="proy-detalle">{detalle}</span>
    </li>
  );
}

export function Indicadores({ vista, calculando }: { readonly vista: VistaProyeccion | null; readonly calculando: boolean }) {
  const f = vista?.final ?? null;
  return (
    <ul className="proy-indicadores" aria-label="Indicadores del escenario" data-calculando={calculando ? "" : undefined}>
      <Indicador
        etiqueta="Valor mediano al final" valor={f?.p50 ?? null} formato={cop} destacado
        detalle={f ? `P5–P95: de ${cop(f.p5)} a ${cop(f.p95)}` : `P5–P95: ${SIN_DATO}`}
      />
      <Indicador etiqueta="Lo aportado" valor={f?.aportado ?? null} formato={cop} detalle="El valor de hoy más los aportes del escenario" />
      <Indicador
        etiqueta="Probabilidad de terminar por debajo de lo aportado" valor={vista ? vista.probabilidadBajoAportado * PCT : null} formato={porcentaje}
        detalle="Trayectorias que terminan bajo lo aportado (con los dividendos cobrados)"
      />
      <Indicador etiqueta="Peor caída mediana" valor={vista ? vista.caidaMaximaMediana * PCT : null} formato={caida} detalle="La mediana de la mayor caída desde un máximo, sin los aportes" />
    </ul>
  );
}
