"use client";
/**
 * La sección «¿Y si…?» de /operar: un formulario (especie, comprar o vender, cantidad, precio límite y comisionista) que
 * manda a POST /api/operar/simular y muestra lo que devuelve, ya formateado por el servidor. No guarda nada: la familia
 * también lo usa. Todo se muestra como texto (React escapa): nada de HTML del servidor. Se envía con `fetch` (un
 * formulario nativo, con `Referrer-Policy: no-referrer`, mandaría `Origin: null` y la ruta lo rechazaría).
 */
import { useRef, useState, type FormEvent } from "react";
import { COMISIONISTAS_SIMULADOR, LADOS_SIMULADOR, ORIGEN_COMISION, TEXTOS_SIMULADOR as T, mensajeDeEstado } from "./textos-simulador";
import type { EspecieSimulable, RespuestaSimulacion, VistaSimulacion } from "./tipos-simulador";

type Estado =
  | { readonly tipo: "listo" }
  | { readonly tipo: "calculando" }
  | { readonly tipo: "resultado"; readonly vista: VistaSimulacion }
  | { readonly tipo: "errores"; readonly errores: readonly string[] };

const esRespuesta = (v: unknown): v is RespuestaSimulacion =>
  typeof v === "object" && v !== null && ((v as { ok?: unknown }).ok === true ? typeof (v as { vista?: unknown }).vista === "object" : Array.isArray((v as { errores?: unknown }).errores));

async function simular(cuerpo: Readonly<Record<string, string>>): Promise<Estado> {
  try {
    const r = await fetch("/api/operar/simular", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo), cache: "no-store" });
    if (!r.ok) return { tipo: "errores", errores: [mensajeDeEstado(r.status)] };
    const datos = (await r.json().catch(() => null)) as unknown;
    if (!esRespuesta(datos)) return { tipo: "errores", errores: [T.FALLO] };
    return datos.ok ? { tipo: "resultado", vista: datos.vista } : { tipo: "errores", errores: datos.errores.filter((e): e is string => typeof e === "string") };
  } catch {
    return { tipo: "errores", errores: [T.FALLO] };
  }
}

function Par({ titulo, antes, despues }: { readonly titulo: string; readonly antes: string; readonly despues: string }) {
  return (
    <div className="op-sim-par">
      <dt>{titulo}</dt>
      <dd>{`${T.ANTES}: ${antes}`}</dd>
      <dd>{`${T.DESPUES}: ${despues}`}</dd>
    </div>
  );
}

function Resultado({ vista }: { readonly vista: VistaSimulacion }) {
  return (
    <div className="op-sim-resultado">
      <h3>{T.RESULTADO}</h3>
      <dl className="op-sim-cifras">
        <div className="op-sim-par"><dt>{T.VALOR_ORDEN}</dt><dd>{vista.valorOrden}</dd></div>
        <div className="op-sim-par">
          <dt>{`${T.COMISION} (${ORIGEN_COMISION[vista.comision.fuente]})`}</dt>
          {vista.comision.valor === null ? null : <dd>{vista.comision.valor}</dd>}
          <dd className="nota">{vista.comision.texto}</dd>
        </div>
        <Par titulo={T.CAJA} antes={vista.cajaAntes} despues={vista.cajaDespues} />
        <Par titulo={T.VALOR_ACCIONES} antes={vista.valorAccionesAntes} despues={vista.valorAccionesDespues} />
      </dl>
      <p className="nota">{vista.cajaFuente}</p>
      <div className="tabla" role="region" aria-label={T.PESOS} tabIndex={0}>
        <table className="angosta">
          <caption>{T.PESOS}</caption>
          <thead><tr><th scope="col">{T.ESPECIE}</th><th scope="col">{`Acciones ${T.ANTES}`}</th><th scope="col">{`Acciones ${T.DESPUES}`}</th><th scope="col">{`Peso ${T.ANTES}`}</th><th scope="col">{`Peso ${T.DESPUES}`}</th></tr></thead>
          <tbody>
            {vista.especies.map((e) => (
              <tr key={e.nemotecnico} className={e.operada ? "op-sim-operada" : undefined}>
                <th scope="row">{e.nemotecnico}</th><td>{e.cantidadAntes}</td><td>{e.cantidadDespues}</td><td>{e.pesoAntes}</td><td>{e.pesoDespues}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4>{T.REGLAS}</h4>
      {vista.reglas.length === 0 ? <p className="nota">{T.SIN_REGLAS}</p> : (
        <ul className="op-sim-reglas">
          {vista.reglas.map((r, i) => (
            <li key={i}><p>{r.texto}</p>{r.afectaciones.map((a, j) => <p key={j} className="nota">{a}</p>)}</li>
          ))}
        </ul>
      )}
      {vista.avisos.length === 0 ? null : (
        <><h4>{T.AVISOS}</h4><ul className="op-sim-avisos">{vista.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul></>
      )}
      {vista.notas.map((n, i) => <p key={i} className="nota">{n}</p>)}
    </div>
  );
}

export function Simulador({ especies }: { readonly especies: readonly EspecieSimulable[] }) {
  const [especie, setEspecie] = useState(especies[0]?.id ?? "");
  const [lado, setLado] = useState<string>(LADOS_SIMULADOR[0].valor);
  const [cantidad, setCantidad] = useState("");
  const [precio, setPrecio] = useState("");
  const [comisionista, setComisionista] = useState<string>(COMISIONISTAS_SIMULADOR[0].valor);
  const [estado, setEstado] = useState<Estado>({ tipo: "listo" });
  const enCurso = useRef(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enCurso.current) return;
    enCurso.current = true;
    setEstado({ tipo: "calculando" });
    setEstado(await simular({ instrumentoId: especie, lado, cantidad, precioLimite: precio, comisionista }));
    enCurso.current = false;
  }

  return (
    <section className="bloque op-simulador" aria-labelledby="t-simulador">
      <div className="cabeza"><div><div className="eyebrow">{T.EYEBROW}</div><h2 id="t-simulador">{T.TITULO}</h2></div></div>
      <p>{T.INTRO}</p>
      {especies.length === 0 ? <p className="nota">{T.SIN_ESPECIES}</p> : (
        <form className="op-sim-form" noValidate onSubmit={enviar}>
          <label htmlFor="sim-especie">{T.ESPECIE}</label>
          <select id="sim-especie" value={especie} onChange={(e) => setEspecie(e.target.value)}>
            {especies.map((e) => <option key={e.id} value={e.id}>{`${e.nemotecnico} (${e.cantidad} acciones)`}</option>)}
          </select>
          <label htmlFor="sim-lado">{T.LADO}</label>
          <select id="sim-lado" value={lado} onChange={(e) => setLado(e.target.value)}>
            {LADOS_SIMULADOR.map((l) => <option key={l.valor} value={l.valor}>{l.texto}</option>)}
          </select>
          <label htmlFor="sim-cantidad">{T.CANTIDAD}</label>
          <input id="sim-cantidad" type="text" inputMode="numeric" autoComplete="off" maxLength={32} value={cantidad} onChange={(e) => setCantidad(e.target.value)} aria-describedby="sim-ayuda" />
          <label htmlFor="sim-precio">{T.PRECIO}</label>
          <input id="sim-precio" type="text" inputMode="decimal" autoComplete="off" maxLength={32} value={precio} onChange={(e) => setPrecio(e.target.value)} aria-describedby="sim-ayuda" />
          <label htmlFor="sim-comisionista">{T.COMISIONISTA}</label>
          <select id="sim-comisionista" value={comisionista} onChange={(e) => setComisionista(e.target.value)}>
            {COMISIONISTAS_SIMULADOR.map((c) => <option key={c.valor} value={c.valor}>{c.texto}</option>)}
          </select>
          <p className="nota op-sim-ayuda" id="sim-ayuda">{T.AYUDA_NUMERO}</p>
          <button type="submit" className="op-sim-boton" aria-busy={estado.tipo === "calculando"}>{T.BOTON}</button>
        </form>
      )}
      <div className="op-sim-salida" aria-live="polite">
        {estado.tipo === "calculando" ? <p>{T.CALCULANDO}</p> : null}
        {estado.tipo === "errores" ? (
          <div className="op-sim-errores" role="alert"><p>{T.ERRORES}</p><ul>{estado.errores.map((e, i) => <li key={i}>{e}</li>)}</ul></div>
        ) : null}
        {estado.tipo === "resultado" ? <Resultado vista={estado.vista} /> : null}
      </div>
      <p className="nota">{T.TARIFAS}</p>
    </section>
  );
}
