"use client";
/**
 * El simulador de proyecciones (frente proyecciones-pantalla; hito 3 del PRD de visualización y proyecciones): el aviso
 * fijo, los controles, los indicadores, el abanico y los supuestos. El cálculo va al servidor (POST /api/proyecciones)
 * por la cola (src/app/proyecciones/cola.ts): espera 350 ms sin cambios y hay un solo pedido en vuelo. Mientras
 * calcula, lo último que se mostró se queda (aria-busy y un «Calculando…» discreto, sin parpadeo); al llegar el
 * resultado, el abanico se interpola y las cifras cuentan, y se anuncia un resumen (solo el último, tras 800 ms sin
 * otro: moviendo un deslizador no se encolan anuncios); un cálculo de más de 1,5 s se anuncia («Calculando…»). El aviso
 * de un fallo va fuera de la región ocupada (aria-busy), para que el lector no lo calle. Nada se guarda.
 * Nada aquí recomienda comprar, vender ni mantener (candado: tests/unit/pantalla-proyecciones/textos.test.ts).
 */
import { useEffect, useRef, useState } from "react";
import { useHidratado } from "@/app/_graficas";
import { AVISO } from "@/proyecciones/tipos";
import { cop, numero } from "@/app/tablero/formato";
import { Abanico } from "./GraficaAbanico";
import { ESPERA_MS, crearCola, type Cola, type Fallo } from "./cola";
import { Controles } from "./PanelControles";
import type { DatosProyecciones } from "./datos";
import { notaDeSalto } from "./historia";
import { Indicadores } from "./Indicadores";
import { CONTROLES_INICIALES, textoHorizonte, type Controles as ValoresControles } from "./opciones";
import { enviarPedido } from "./pedido";
import { Supuestos } from "./Supuestos";
import type { VistaProyeccion } from "./vista";
import "./proyecciones.css";

const TEXTO_FALLO: Readonly<Record<Fallo, string>> = {
  ERROR: "No se pudo calcular la proyección. Intente de nuevo moviendo un control.",
  OCUPADO: "El servidor está ocupado con otros cálculos. Intente de nuevo en unos segundos.",
  FRECUENCIA: "Hizo muchos cálculos seguidos. Espere un minuto y mueva un control para calcular de nuevo.",
  PARAMETROS: "Esos valores no se pueden calcular. Pruebe con un horizonte o un aporte menor.",
};
const PCT = 100;
/** El anuncio espera esto sin otro resultado: el lector oye solo el último. */
const ANUNCIO_MS = 800;
/** Un cálculo que tarda más que esto (después de la espera de la cola) se anuncia. */
const CALCULO_LARGO_MS = 1500;
const CALCULANDO = "Calculando…";

function anunciar(v: VistaProyeccion): string {
  const f = v.final;
  return (
    `Proyección a ${textoHorizonte(v.controles.horizonteMeses)}: valor mediano al final ${cop(f.p50)}; el 90 % de las trayectorias termina entre ${cop(f.p5)} y ${cop(f.p95)}. ` +
    `Probabilidad de terminar por debajo de lo aportado: ${numero(v.probabilidadBajoAportado * PCT, 1)} %.`
  );
}

/** El texto de la región role=status: «Calculando…» si tarda, y el resumen del último resultado tras ANUNCIO_MS. */
function useAnuncio(calculando: boolean, vista: VistaProyeccion | null, anunciarla: boolean): string {
  const [texto, setTexto] = useState("");
  useEffect(() => {
    if (!calculando) {
      setTexto((previo) => (previo === CALCULANDO ? "" : previo));
      return undefined;
    }
    const t = setTimeout(() => setTexto(CALCULANDO), ESPERA_MS + CALCULO_LARGO_MS);
    return () => clearTimeout(t);
  }, [calculando]);
  useEffect(() => {
    if (!anunciarla || vista === null) return undefined;
    setTexto((previo) => (previo === CALCULANDO ? "" : previo));
    const t = setTimeout(() => setTexto(anunciar(vista)), ANUNCIO_MS);
    return () => clearTimeout(t);
  }, [vista, anunciarla]);
  return texto;
}

function Aviso() {
  return (
    <p className="proy-aviso">
      <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4l9 16H3z" /><path d="M12 10v4" /><path d="M12 17.5v.5" />
      </svg>
      <span><b>{AVISO}</b> Muestra un rango posible con los supuestos que están más abajo; no dice qué va a pasar.</span>
    </p>
  );
}

export function Simulador({ datos }: { readonly datos: DatosProyecciones }) {
  const [controles, setControles] = useState<ValoresControles>(datos.inicial?.controles ?? CONTROLES_INICIALES);
  const [vista, setVista] = useState<VistaProyeccion | null>(datos.inicial);
  const [calculando, setCalculando] = useState(datos.estado === "OCUPADO");
  const [fallo, setFallo] = useState<Fallo | null>(datos.estado === "FALLO" ? "ERROR" : null);
  /** Solo se anuncian los resultados que llegan por un cambio (al cargar, calla). */
  const [recalculado, setRecalculado] = useState(false);
  const anuncio = useAnuncio(calculando, vista, recalculado);
  const hidratado = useHidratado();
  const cola = useRef<Cola | null>(null);
  /** Lo último que se movió (dos cambios en el mismo cuadro no se pisan). */
  const ultimos = useRef(controles);
  const estadoInicial = datos.estado;

  useEffect(() => {
    const c = crearCola({
      enviar: enviarPedido,
      al: {
        calculando: setCalculando,
        resultado: (v) => {
          setVista(v);
          setFallo(null);
          setRecalculado(true);
        },
        fallo: setFallo,
      },
    });
    cola.current = c;
    if (estadoInicial === "OCUPADO") c.pedir(ultimos.current);
    return () => c.cancelar();
  }, [estadoInicial]);

  const cambiar = (cambio: Partial<ValoresControles>) => {
    const nuevos = { ...ultimos.current, ...cambio };
    ultimos.current = nuevos;
    setControles(nuevos);
    setFallo(null);
    cola.current?.pedir(nuevos);
  };

  return (
    <>
      <section className="hero proy-hero" aria-labelledby="t-proy">
        <div className="eyebrow">Escenarios · {textoHorizonte(controles.horizonteMeses)}</div>
        <h1 id="t-proy">Proyecciones</h1>
        <p className="proy-lead">
          Un rango posible del valor de sus acciones y del fondo, armado con la historia de sus precios y dividendos. Lo que mueva aquí no se guarda.
        </p>
        <Aviso />
      </section>
      <div className="proy-cuerpo">
        <Controles controles={controles} alCambiar={cambiar} alReiniciar={() => cambiar(CONTROLES_INICIALES)} />
        <div className="proy-columna">
          {fallo ? <p className="nota aviso proy-fallo" role="alert">{TEXTO_FALLO[fallo]}</p> : null}
          <section className="proy-resultado" aria-labelledby="t-resultado" aria-busy={calculando} data-hidratado={hidratado ? "" : undefined}>
            <div className="proy-resultado-cabeza">
              <div><div className="eyebrow">A {textoHorizonte(controles.horizonteMeses)}</div><h2 id="t-resultado">El escenario</h2></div>
              <p className="proy-calculando" data-activo={calculando ? "" : undefined} aria-hidden="true">{CALCULANDO}</p>
            </div>
            <Indicadores vista={vista} calculando={calculando} />
            {vista ? <Abanico historia={datos.historia} vista={vista} /> : <p className="nota proy-vacio">El abanico aparece con el primer cálculo.</p>}
            <p className="nota">{AVISO} Lo aportado es el valor de hoy más los aportes del escenario, no el costo histórico.</p>
          </section>
        </div>
      </div>
      <Supuestos vista={vista} nota={vista ? notaDeSalto(datos.historia, vista) : null} />
      <p className="sr proy-anuncio" role="status">{anuncio}</p>
    </>
  );
}
