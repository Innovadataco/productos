/**
 * Pantalla /alertas: las alertas de los últimos 30 días agrupadas por día, con el texto que escribe el código (textoDeAlerta) y de
 * dónde y cuándo es cada dato (FechaDato). El dueño marca cada una como vista o todas; la familia la ve en solo lectura (sin botones).
 * Componente del servidor: los botones son la única parte de cliente.
 */
import { Encabezado } from "../_plan/Encabezado";
import { FechaDato } from "../_comun/fecha-dato/FechaDato";
import { BotonMarcar } from "./BotonesVista";
import { TEXTOS_ALERTAS_PANTALLA, etiquetaMarcar, textoPendientes } from "./textos";
import type { VistaAlertas } from "./vista";
import "../_plan/plan.css";
import "./alertas.css";

interface Props {
  readonly vista: VistaAlertas;
  readonly soloLectura: boolean;
}

export function Alertas({ vista, soloLectura }: Props) {
  return (
    <>
      <Encabezado actual="alertas" soloLectura={soloLectura} />
      <main className="wrap plan alertas">
        <section className="hero plan-hero" aria-labelledby="t-hero">
          <h1 id="t-hero" tabIndex={-1}>{TEXTOS_ALERTAS_PANTALLA.TITULO}</h1>
          <p>{TEXTOS_ALERTAS_PANTALLA.INTRO}</p>
          {vista.total > 0 ? <p className="nota" role="status">{textoPendientes(vista.sinVer, vista.total)}</p> : null}
          {soloLectura ? null : (
            <p className="alertas-acciones">
              {vista.sinVer > 0 ? <BotonMarcar pedido={{ todas: true }} texto={TEXTOS_ALERTAS_PANTALLA.MARCAR_TODAS} /> : null}
              <a href="/edicion/alertas">{TEXTOS_ALERTAS_PANTALLA.CONFIGURAR}</a>
            </p>
          )}
        </section>
        {vista.dias.length === 0 ? <p className="nota">{TEXTOS_ALERTAS_PANTALLA.SIN_ALERTAS}</p> : null}
        {vista.dias.map((d) => (
          <section className="bloque" key={d.dia} aria-labelledby={`dia-${d.dia}`}>
            <h2 id={`dia-${d.dia}`}>{d.titulo}</h2>
            <ul className="alertas-lista">
              {d.alertas.map((a) => {
                return (
                  <li className={a.vista === null ? "alerta alerta-nueva" : "alerta"} key={a.id} data-tipo={a.tipo}>
                    <p className="alerta-texto">{a.texto}</p>
                    {a.procedencia === null ? null : <FechaDato procedencia={a.procedencia} etiqueta={a.procedencia.tipo === "RUEDA" ? "Precio" : "Cierre"} />}
                    {a.vista !== null ? (
                      <p className="nota alerta-vista">{`${TEXTOS_ALERTAS_PANTALLA.VISTA} ${a.vista}`}</p>
                    ) : soloLectura ? (
                      <p className="nota alerta-estado">{TEXTOS_ALERTAS_PANTALLA.SIN_MARCAR}</p>
                    ) : (
                      <BotonMarcar pedido={{ alertaId: a.id }} texto={TEXTOS_ALERTAS_PANTALLA.MARCAR} etiqueta={etiquetaMarcar(a.tipo, d.titulo)} />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>
    </>
  );
}
