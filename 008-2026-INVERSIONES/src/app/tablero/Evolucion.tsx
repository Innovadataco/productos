"use client";
/**
 * «Cómo ha ido» (frente graficas-tablero): el valor de sus acciones frente al costo de lo que tiene y la TWR acumulada,
 * con un solo selector de rango arriba que gobierna las dos. Todo viene calculado del servidor
 * (src/tablero/evolucion.ts): aquí solo se elige la ventana y se da formato. La TWR que se dibuja es la acumulada
 * desde el inicio; la del rango es la que trae el servidor para ese rango (el cliente no la rebasa).
 */
import { useState } from "react";
import { GraficaTiempo, Selector } from "@/app/_graficas";
import type { ClaveRango } from "@/tablero/evolucion";
import { cop, copCompacto, etiquetaTick, fecha, n, pct, pctEje } from "./formato";
import type { EvolucionVista, PuntoEvolucionVista, RangoEvolucionVista } from "./tipos";

const TEXTO_RANGO: Readonly<Record<ClaveRango, string>> = { "1M": "1M", "3M": "3M", "6M": "6M", "1A": "1A", TODO: "Todo" };
/** Las dos del mismo alto: lado a lado en el escritorio, sus ejes quedan alineados. */
const ALTO = 220;
const tono = (v: number) => (v >= 0 ? "gain" : "loss");
/** La TWR del rango la calcula el servidor; si no pudo (el rango empieza en −100 %), «—». */
const pctRango = (r: RangoEvolucionVista): string => (r.twrPct === null ? "—" : pct(n(r.twrPct)));

function atrasadas(p: PuntoEvolucionVista | undefined): string | null {
  const a = p?.atrasadas ?? 0;
  if (a === 0) return null;
  return a === 1 ? "1 especie con un cierre anterior a ese día" : `${a} especies con un cierre anterior a ese día`;
}

function Notas({ evolucion }: { readonly evolucion: EvolucionVista }) {
  const { omitidos, sinCierre } = evolucion;
  return (
    <>
      <p className="nota">
        TWR de sus acciones (método {evolucion.metodo}): las compras cuentan al inicio del día, con su comisión; las ventas y los dividendos (el día del pago), al cierre.
        No incluye caja ni fondo, así que no es la cifra de Trii: queda por validar contra Trii con la primera carga real.
        Valor = la cantidad de cada día × su último cierre; costo según A&amp;V o Trii, sin comisión (una escisión lo sube según el portal).
      </p>
      {omitidos > 0 ? <p className="nota">{omitidos === 1 ? "1 día no se grafica" : `${omitidos} días no se grafican`}: alguna especie que tenía aún no tenía cierre.</p> : null}
      {sinCierre.length > 0 ? <p className="nota aviso">Sin ningún cierre (no entran): {sinCierre.join(" · ")}.</p> : null}
    </>
  );
}

function SinGraficas({ texto }: { readonly texto: string }) {
  return (
    <section className="bloque entra d2" aria-labelledby="t-evo">
      <div className="cabeza"><div><div className="eyebrow">Evolución</div><h2 id="t-evo">Cómo ha ido</h2></div></div>
      <p className="nota">{texto}</p>
    </section>
  );
}

const VACIA = "Todavía no hay un día con cierre de todas las especies que tiene: la evolución aparece cuando lo haya.";
const FALLIDA = "No se pudo calcular la evolución: el resto del tablero sí está al día. Quedó registrado para revisarlo.";

function PanelEvolucion({ evolucion, rango }: { readonly evolucion: EvolucionVista; readonly rango: RangoEvolucionVista }) {
  const { puntos } = evolucion;
  const ventana = { desde: rango.inicio, hasta: puntos.length - 1 };
  const [ini, fin, primero] = [puntos[ventana.desde]!, puntos[ventana.hasta]!, puntos[0]!];
  const dias = puntos.map((p) => p.fecha);
  const comun = { dias, ventana, formatoDia: fecha, formatoTick: etiquetaTick };
  const periodo = `del ${fecha(ini.fecha)} al ${fecha(fin.fecha)}`;
  return (
    <div className="g-par">
      <GraficaTiempo
        {...comun} titulo="Valor frente al costo de lo que tiene" alto={ALTO} formatoY={(v) => cop(v)} formatoEje={copCompacto}
        series={[
          { id: "valor", nombre: "Valor", tono: "valor", valores: puntos.map((p) => n(p.valor)) },
          { id: "costo", nombre: "Costo de lo que tiene", tono: "costo", valores: puntos.map((p) => n(p.costo)) },
        ]}
        rellenos={[{ serie: "valor", contra: { serie: "costo" }, arriba: "gana", abajo: "pierde" }]}
        extraDetalle={(i) => atrasadas(puntos[i])}
        resumen={`Del ${fecha(ini.fecha)} al ${fecha(fin.fecha)}: el valor de sus acciones pasó de ${cop(n(ini.valor))} a ${cop(n(fin.valor))}; el costo de lo que tiene, de ${cop(n(ini.costo))} a ${cop(n(fin.costo))}.`}
      />
      <GraficaTiempo
        {...comun} titulo="TWR acumulada" alto={ALTO} formatoY={pct} formatoEje={pctEje} incluirCero
        series={[{ id: "twr", nombre: "TWR acumulada", tono: "valor", valores: puntos.map((p) => n(p.twrPct)) }]}
        rellenos={[{ serie: "twr", contra: { constante: 0 }, arriba: "gana", abajo: "pierde" }]}
        encabezado={<><span>En el rango <b className={rango.twrPct === null ? undefined : tono(n(rango.twrPct))}>{pctRango(rango)}</b></span>{" "}<span>Desde el inicio <b className={tono(n(fin.twrPct))}>{pct(n(fin.twrPct))}</b></span></>}
        resumen={`TWR acumulada desde el ${fecha(primero.fecha)}: ${pct(n(fin.twrPct))}. En el rango, ${periodo}: ${pctRango(rango)}.`}
      />
    </div>
  );
}

/** null = el servidor no pudo calcularla (src/app/page.tsx): se dice, y el resto del tablero sigue. */
export function Evolucion({ evolucion }: { readonly evolucion: EvolucionVista | null }) {
  const [clave, setClave] = useState<ClaveRango>("TODO");
  const [anunciar, setAnunciar] = useState(false);
  if (evolucion === null) return <SinGraficas texto={FALLIDA} />;
  const { puntos, rangos } = evolucion;
  const rango = rangos.find((r) => r.clave === clave) ?? rangos.find((r) => r.clave === "TODO");
  if (puntos.length === 0 || !rango) return <SinGraficas texto={VACIA} />;
  const nota = `La historia empieza el ${fecha(puntos[0]!.fecha)}: no alcanza para ese rango.`;
  const opciones = rangos.map((r) => ({ clave: r.clave, texto: TEXTO_RANGO[r.clave], disponible: r.cubre, nota }));
  const [desde, hasta] = [fecha(puntos[rango.inicio]!.fecha), fecha(puntos[puntos.length - 1]!.fecha)];
  const elegir = (k: ClaveRango) => { setClave(k); setAnunciar(true); };
  return (
    <section className="bloque entra d2" aria-labelledby="t-evo">
      <div className="cabeza">
        <div><div className="eyebrow">Del {desde} al {hasta}</div><h2 id="t-evo">Cómo ha ido</h2></div>
        <Selector etiqueta="Rango de fechas" opciones={opciones} valor={rango.clave} alCambiar={elegir} />
      </div>
      {/* El cambio de rango se anuncia; al cargar, calla. */}
      <p className="sr" role="status">{anunciar ? `Mostrando ${TEXTO_RANGO[rango.clave]}: del ${desde} al ${hasta}.` : ""}</p>
      <PanelEvolucion evolucion={evolucion} rango={rango} />
      <Notas evolucion={evolucion} />
    </section>
  );
}
