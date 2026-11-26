/**
 * Encabezado de las pantallas del plan y del diario: la marca y la navegación entre secciones, con la actual marcada
 * (`aria-current="page"`), y la marca «Solo lectura» del familiar. «Configuración» sale solo al dueño (el familiar no la
 * ve). Componente del servidor; solo el contador de «Alertas» (ContadorAlertas) corre en el navegador.
 */
import { ContadorAlertas } from "../_comun/alertas/ContadorAlertas";
import { seccionesVisibles, type Seccion } from "../tablero/secciones";
import { MarcaSoloLectura } from "../tablero/SoloLectura";

interface PropsEncabezado {
  readonly actual: Seccion;
  /** El familiar ve «Solo lectura» y no ve «Configuración» (frente familia-lectura); lo decide la página con la sesión revalidada. */
  readonly soloLectura?: boolean;
}

export function Encabezado({ actual, soloLectura = false }: PropsEncabezado) {
  return (
    <header className="top plan-top">
      <div className="wrap fila-top">
        <div className="marca"><span className="sello" aria-hidden="true">Inv</span>Inversiones · Mi portafolio{soloLectura ? <>{" "}<MarcaSoloLectura /></> : null}</div>
        <nav aria-label="Secciones">
          <ul className="secciones">
            {seccionesVisibles(soloLectura).map((s) => (
              <li key={s.clave}><a href={s.href} aria-current={s.clave === actual ? "page" : undefined}>{s.texto}{s.clave === "alertas" ? <ContadorAlertas /> : null}</a></li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
