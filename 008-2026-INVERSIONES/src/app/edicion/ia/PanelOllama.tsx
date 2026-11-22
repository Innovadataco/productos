"use client";
/**
 * «Identificar modelos» y «Probar» (E8), como en PI: usan SOLO la dirección y el puerto GUARDADOS (el pedido no lleva
 * ningún destino). Muestra lo instalado, cada modelo «en la lista de PI» (seleccionable) o «fuera de la lista de PI»,
 * el aviso de los 32B, la latencia de cada prueba, la sonda pendiente en producción y «Ollama inalcanzable» con la
 * posibilidad del firewall. Un pedido a la vez; el servidor pone además un límite de frecuencia.
 */
import { useState } from "react";
import { pedirOllama, type AccionOllama, type RespuestaOllama, type ResultadoIdentificarVista, type ResultadoProbarVista } from "./acciones";
import { AVISOS_IA, TEXTOS_IA, digestCorto, mensajeIa, tamanoTexto } from "./textos-ia";
import type { ModeloIdentificadoVista, PruebaVista } from "./tipos-ia";

interface Props {
  readonly hayDestino: boolean;
  readonly onIdentificados: (modelos: readonly ModeloIdentificadoVista[]) => void;
}

/** El texto de la región de estado para un resultado o un error. */
function estadoTexto(r: RespuestaOllama): string {
  if (r.tipo === "error") return mensajeIa(r.codigo);
  const { estado } = r.resultado;
  if (estado === "PENDIENTE") return AVISOS_IA.SONDA_PENDIENTE;
  if (estado === "SIN_DESTINO") return AVISOS_IA.GUARDE_DESTINO;
  if (estado === "SIN_MODELO") return "Ninguna tarea activa tiene un modelo guardado para probar.";
  if (estado === "INALCANZABLE") return `${AVISOS_IA.INALCANZABLE} (${mensajeIa(r.resultado.detalle)})`;
  if (estado === "ERROR") return mensajeIa(r.resultado.detalle);
  if (r.tipo === "identificar") return "Modelos identificados.";
  return estado === "OK" ? "Todas las pruebas respondieron." : "Alguna prueba falló: revise el detalle.";
}

function marca(m: ModeloIdentificadoVista): string {
  if (!m.enLista) return AVISOS_IA.FUERA_DE_LISTA;
  return m.seleccionable ? TEXTOS_IA.EN_LISTA : AVISOS_IA.DIGEST_DISTINTO;
}

function Instalados({ modelos }: { readonly modelos: readonly ModeloIdentificadoVista[] }) {
  return (
    <section aria-labelledby="t-instalados">
      <h3 id="t-instalados">Modelos instalados en el Ollama guardado</h3>
      {modelos.length === 0 ? <p className="nota">El Ollama no tiene modelos instalados.</p> : (
        <ul className="ia-instalados">
          {modelos.map((m) => (
            <li key={m.nombre} className={m.seleccionable ? "ia-listo" : "ia-falta"}>
              <strong>{m.nombre}</strong>
              {` · ${tamanoTexto(m.tamanoBytes)} · ${digestCorto(m.digest)} · ${marca(m)}`}
              {/:32b$/.test(m.nombre) ? ` · ${AVISOS_IA.RECARGA_32B}` : ""}
              {m.nota === null ? null : <span className="nota">{` · ${m.nota}`}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Pruebas({ pruebas }: { readonly pruebas: readonly PruebaVista[] }) {
  return (
    <section aria-labelledby="t-pruebas">
      <h3 id="t-pruebas">Resultado de la prueba</h3>
      <ul className="ia-instalados">
        {pruebas.map((p) => (
          <li key={p.modelo} className={p.ok ? "ia-listo" : "ia-falta"}>
            <strong>{p.modelo}</strong>
            {` · ${p.latenciaMs.toLocaleString("es-CO")} ms · ${p.ok ? "respondió" : `falló${p.detalle === null ? "" : `: ${mensajeIa(p.detalle)}`}`}`}
            {p.inalcanzable ? ` ${AVISOS_IA.INALCANZABLE}` : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PanelOllama({ hayDestino, onIdentificados }: Props) {
  const [enCurso, setEnCurso] = useState(false);
  const [respuesta, setRespuesta] = useState<RespuestaOllama | null>(null);

  async function pedir(accion: AccionOllama) {
    if (enCurso) return;
    setEnCurso(true);
    const r = await pedirOllama(accion);
    setEnCurso(false);
    setRespuesta(r);
    if (r.tipo === "identificar" && r.resultado.estado === "OK") onIdentificados(r.resultado.modelos);
  }

  const identificado: ResultadoIdentificarVista | null = respuesta?.tipo === "identificar" ? respuesta.resultado : null;
  const probado: ResultadoProbarVista | null = respuesta?.tipo === "probar" ? respuesta.resultado : null;
  return (
    <div className="ia-ollama">
      <p className="nota">{TEXTOS_IA.FLUJO}</p>
      {hayDestino ? null : <p className="nota aviso">{AVISOS_IA.GUARDE_DESTINO}</p>}
      <div className="edicion-enviar">
        <button type="button" className="edicion-agregar" disabled={!hayDestino} aria-busy={enCurso} onClick={() => void pedir("identificar")}>{TEXTOS_IA.IDENTIFICAR}</button>
        <button type="button" className="edicion-agregar" disabled={!hayDestino} aria-busy={enCurso} onClick={() => void pedir("probar")}>{TEXTOS_IA.PROBAR}</button>
      </div>
      <p className="edicion-estado ia-sonda" role="status">{enCurso ? TEXTOS_IA.CONSULTANDO : respuesta === null ? "" : estadoTexto(respuesta)}</p>
      {identificado?.estado === "OK" ? <Instalados modelos={identificado.modelos} /> : null}
      {probado !== null && (probado.estado === "OK" || probado.estado === "FALLO") ? <Pruebas pruebas={probado.pruebas} /> : null}
    </div>
  );
}
