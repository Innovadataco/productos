/**
 * Pantalla de los datos oficiales (frente datos-oficiales-pantalla, C6a). Componente del servidor, sin estado: lo único
 * con JavaScript en el navegador es la gráfica de cada serie (GraficaSerie). Una tarjeta por serie del catálogo:
 * - su último valor con la unidad, de cuándo es («Vale hoy» solo si su vigencia cubre hoy) y su frescura en texto;
 * - en el IPC, la variación en 12 meses «calculada por 008» (nunca atribuida al DANE);
 * - la fuente con enlace https a su página oficial (fuentes.ts), cuándo se trajo y cómo entra;
 * - la gráfica de su ventana, con «Ver los datos».
 * Sin datos o con error, ninguna cifra. Sin formularios ni botones: la familia la ve en solo lectura y la pantalla no
 * escribe nada. Después de las series, la sección de los dividendos decretados y su cruce con Trii (Decretos.tsx, C6b).
 */
import { Encabezado } from "../_plan/Encabezado";
import { Decretos } from "./Decretos";
import {
  PIE_DATOS_OFICIALES, TEXTO_ENTRADA, TEXTO_ESTADO, cifra, conSigno, detalleFrescura, estadoDe, lineaVigencia, mes, paraGrafica, sigla, textoVariacionFaltante, traidoEl,
} from "./formato";
import { enlaceDeFuente } from "./fuentes";
import { fecha } from "../tablero/formato";
import { GraficaSerie } from "./GraficaSerie";
import type { SerieConDatos, SerieVista, VariacionVista, VistaDatosOficiales } from "./tipos";
import "./datos-oficiales.css";

const MENSAJE: Readonly<Record<"SIN_DATOS" | "ERROR", string>> = {
  SIN_DATOS: "Todavía no hay ningún valor cargado de esta serie.",
  ERROR: "No se pudo leer esta serie; las demás sí. Quedó registrado para revisarlo.",
};

/** La fuente: el enlace dice al lector adónde lleva (la página oficial de esa serie, sitio externo); lo visible es el origen. */
function Fuente({ origen, fuente, serie }: { readonly origen: string; readonly fuente: string; readonly serie: string }) {
  const href = enlaceDeFuente(fuente);
  const enlace = (h: string) => (
    <a href={h} rel="noopener noreferrer" referrerPolicy="no-referrer">{origen}<span className="sr"> (página oficial de {serie}, sitio externo)</span></a>
  );
  return (
    <>
      {href === null ? origen : enlace(href)}{" "}
      <span className="do-codigo">{fuente}</span>
    </>
  );
}

function Variacion({ v }: { readonly v: VariacionVista }) {
  if (v.estado !== "CALCULADA") return <p className="do-variacion">Variación en 12 meses: {textoVariacionFaltante(v)}</p>;
  return (
    <>
      <p className="do-variacion">
        <span className="do-etiqueta">Variación en 12 meses</span>{" "}
        <span className="do-cifra-chica">{conSigno(v.valor)}</span>{" "}
        <span className="do-unidad">{v.unidad}</span>
      </p>
      <p className="do-variacion-nota">Entre {mes(v.mesBase)} y {mes(v.mesFinal)}, con el índice de cada mes.</p>
    </>
  );
}

function Cifra({ s }: { readonly s: SerieConDatos }) {
  return (
    <>
      <p className="do-valor"><span className="do-cifra">{cifra(s.ultimo.valor, s.escala)}</span> <span className="do-unidad">{s.unidad}</span></p>
      <p className="do-vigencia" data-vale-hoy={s.frescura.valeHoy ? "" : undefined}>{lineaVigencia(s)}</p>
      {s.variacion === null ? null : <Variacion v={s.variacion} />}
    </>
  );
}

function Pares({ s }: { readonly s: SerieVista }) {
  const conDatos = s.estado === "CON_DATOS" ? s : null;
  return (
    <dl className="do-pares">
      <dt>Fuente</dt>
      <dd><Fuente origen={s.origen} fuente={conDatos?.ultimo.fuente ?? s.fuente} serie={s.nombre} /></dd>
      {conDatos ? <><dt>Traído el</dt><dd>{traidoEl(conDatos.ultimo.traidoEn)}</dd></> : null}
      <dt>Cómo entra</dt>
      <dd>{TEXTO_ENTRADA[s.entrada]}</dd>
      {conDatos ? <><dt>Frescura</dt><dd>{detalleFrescura(conDatos.frescura)}</dd></> : null}
    </dl>
  );
}

function Tarjeta({ s }: { readonly s: SerieVista }) {
  const id = `t-${s.codigo.toLowerCase()}`;
  const estado = estadoDe(s);
  return (
    <article className="do-serie" aria-labelledby={id}>
      <div className="do-cabeza">
        <div>
          <div className="eyebrow">{sigla(s.codigo)}</div>
          <h2 id={id}>{s.nombre}</h2>
        </div>
        <span className="do-estado" data-estado={estado}><span className="sr">Estado de la serie: </span><span className="do-estado-texto">{TEXTO_ESTADO[estado]}</span></span>
      </div>
      {s.estado === "CON_DATOS" ? <Cifra s={s} /> : <p className="do-mensaje">{MENSAJE[s.estado]}</p>}
      <Pares s={s} />
      {s.estado === "CON_DATOS" ? <GraficaSerie serie={paraGrafica(s)} /> : null}
    </article>
  );
}

interface PropsDatosOficiales {
  readonly datos: VistaDatosOficiales;
  /** El familiar ve «Solo lectura»; lo decide la página con la sesión revalidada. */
  readonly soloLectura?: boolean;
}

export function DatosOficiales({ datos, soloLectura = false }: PropsDatosOficiales) {
  return (
    <>
      <Encabezado actual="datos-oficiales" soloLectura={soloLectura} />
      <main className="wrap do">
        <section className="hero do-hero">
          <div className="eyebrow">Consultado el {fecha(datos.hoy)} (hora de Colombia)</div>
          <h1>Datos oficiales</h1>
          <p className="do-lead">
            Las cifras públicas que usa Inversiones, tal como las publica cada fuente: cada una dice de cuándo es y de dónde sale.
            Si la última no cubre hoy, se dice.
          </p>
        </section>
        <section className="do-series">
          {datos.series.map((s) => <Tarjeta key={s.codigo} s={s} />)}
        </section>
        <Decretos d={datos.decretos} />
        <footer className="pie">{PIE_DATOS_OFICIALES}</footer>
      </main>
    </>
  );
}
