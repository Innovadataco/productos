"use client";
/**
 * La sección «¿Y si…?» de /operar: un formulario (especie, comprar o vender, cantidad, precio límite, comisionista y, si quiere, su saldo y el precio actual de trii Pro) que
 * manda a POST /api/operar/simular y muestra lo que devuelve, ya formateado por el servidor. No guarda nada: la familia
 * también lo usa. Todo se muestra como texto (React escapa): nada de HTML del servidor. Se envía con `fetch` (un
 * formulario nativo, con `Referrer-Policy: no-referrer`, mandaría `Origin: null` y la ruta lo rechazaría).
 */
import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from "react";
import { COMISIONISTAS_SIMULADOR, LADOS_SIMULADOR, ORIGEN_COMISION, TEXTOS_SIMULADOR as T, mensajeDeEstado } from "./textos-simulador";
import type { EspecieSimulable, RespuestaSimulacion, VistaSimulacion } from "./tipos-simulador";
import type { VistaAnalisisSimulacion } from "@/operar/analisis/vista";

type Estado =
  | { readonly tipo: "listo" }
  | { readonly tipo: "calculando" }
  | { readonly tipo: "resultado"; readonly vista: VistaSimulacion }
  | { readonly tipo: "errores"; readonly errores: readonly string[]; readonly campos: readonly string[] };

/** El id del mensaje de errores: los campos rechazados lo citan en su descripción. */
const ID_ERRORES = "sim-errores";
const CAMPOS_DEL_PEDIDO = ["instrumentoId", "lado", "cantidad", "precioLimite", "comisionista", "saldoComisionista", "precioActual"] as const;
const camposDe = (v: unknown): string[] => {
  const campos = typeof v === "object" && v !== null ? (v as { campos?: unknown }).campos : undefined;
  return Array.isArray(campos) ? CAMPOS_DEL_PEDIDO.filter((c) => campos.includes(c)) : [];
};
const sinCampos = (errores: readonly string[]): Estado => ({ tipo: "errores", errores, campos: [] });

const esRespuesta = (v: unknown): v is RespuestaSimulacion =>
  typeof v === "object" && v !== null && ((v as { ok?: unknown }).ok === true ? typeof (v as { vista?: unknown }).vista === "object" : Array.isArray((v as { errores?: unknown }).errores));

async function simular(cuerpo: Readonly<Record<string, string>>): Promise<Estado> {
  try {
    const r = await fetch("/api/operar/simular", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo), cache: "no-store" });
    const datos = (await r.json().catch(() => null)) as unknown;
    if (!r.ok) return { tipo: "errores", errores: [mensajeDeEstado(r.status)], campos: camposDe(datos) };
    if (!esRespuesta(datos)) return sinCampos([T.FALLO]);
    return datos.ok ? { tipo: "resultado", vista: datos.vista } : { tipo: "errores", errores: datos.errores.filter((e): e is string => typeof e === "string"), campos: camposDe(datos) };
  } catch {
    return sinCampos([T.FALLO]);
  }
}

function Par({ titulo, antes, despues, variacion }: { readonly titulo: string; readonly antes: string; readonly despues: string; readonly variacion?: string | undefined }) {
  return (
    <div className="op-sim-par">
      <dt>{titulo}</dt>
      <dd>{`${T.ANTES}: ${antes}`}</dd>
      <dd>{`${T.DESPUES}: ${despues}`}</dd>
      {variacion === undefined ? null : <dd>{`${T.VARIACION}: ${variacion}`}</dd>}
    </div>
  );
}

/** Los puntos que cambian de rango con la operación: la importancia va en TEXTO (el borde de color solo la apoya) y sin regiones vivas. */
function ParaRevisar({ a }: { readonly a: VistaAnalisisSimulacion | null }) {
  const titulo = useId();
  if (a === null) return null;
  return (
    <>
      <h4 id={titulo}>{T.PARA_REVISAR}</h4>
      {a.paraRevisar.length === 0 ? <p className="nota">{T.SIN_CAMBIOS}</p> : (
        <ol className="op-sim-revisar" aria-labelledby={titulo}>
          {a.paraRevisar.map((x, i) => (
            <li key={`${i}-${x.frase}`} data-importancia={x.nivel.toLowerCase()}>
              <p className="op-sim-importancia">{x.importancia}</p>
              <p>{x.frase}</p>
              <p className="nota">{x.nota}</p>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function Analisis({ a }: { readonly a: VistaAnalisisSimulacion | null }) {
  if (a === null) return <p className="nota">{T.SIN_ANALISIS}</p>;
  return (
    <div className="op-sim-analisis">
      <h4>{T.ANALISIS}</h4>
      <dl className="op-sim-cifras">{a.filas.map((f) => <Par key={f.titulo} titulo={f.titulo} antes={f.antes} despues={f.despues} />)}</dl>
      <h4>{T.ESCENARIOS}</h4>
      {a.escenarios.length === 0 ? <p className="nota">{T.SIN_ESCENARIOS}</p> : (
        <>
          <dl className="op-sim-cifras">{a.escenarios.map((f) => <Par key={f.titulo} titulo={f.titulo} antes={f.antes} despues={f.despues} variacion={f.variacion} />)}</dl>
          <h4>{T.PARTIDA}</h4>
          <dl className="op-sim-cifras">{a.partida.map((f) => <Par key={f.titulo} titulo={f.titulo} antes={f.antes} despues={f.despues} />)}</dl>
          <p className="nota">{a.notaCaja}</p>
        </>
      )}
      {a.aparecen.length === 0 ? null : <><h4>{T.APARECEN}</h4><ul>{a.aparecen.map((x, i) => <li key={`${i}-${x}`}>{x}</li>)}</ul></>}
      {a.desaparecen.length === 0 ? null : <><h4>{T.DESAPARECEN}</h4><ul>{a.desaparecen.map((x, i) => <li key={`${i}-${x}`}>{x}</li>)}</ul></>}
      <div className="op-sim-texto">{a.frases.map((f, i) => <p key={`${i}-${f}`}>{f}</p>)}</div>
      <p className="nota">{a.rotulo}</p>
    </div>
  );
}

function Resultado({ vista, titulo }: { readonly vista: VistaSimulacion; readonly titulo: RefObject<HTMLHeadingElement | null> }) {
  return (
    <div className="op-sim-resultado">
      <h3 tabIndex={-1} ref={titulo}>{T.RESULTADO}</h3>
      <ParaRevisar a={vista.analisis ?? null} />
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
      <div className="tabla" role="region" aria-labelledby="sim-pesos" tabIndex={0}>
        <table className="angosta">
          <caption id="sim-pesos">{T.PESOS}</caption>
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
            <li key={`${i}-${r.texto}`}><p>{r.texto}</p>{r.afectaciones.map((a, j) => <p key={`${j}-${a}`} className="nota">{a}</p>)}</li>
          ))}
        </ul>
      )}
      {vista.avisos.length === 0 ? null : (
        <><h4>{T.AVISOS}</h4><ul className="op-sim-avisos">{vista.avisos.map((a, i) => <li key={`${i}-${a}`}>{a}</li>)}</ul></>
      )}
      {vista.notas.map((n, i) => <p key={`${i}-${n}`} className="nota">{n}</p>)}
      <Analisis a={vista.analisis ?? null} />
    </div>
  );
}

export function Simulador({ especies }: { readonly especies: readonly EspecieSimulable[] }) {
  const [especie, setEspecie] = useState(especies[0]?.id ?? "");
  const [lado, setLado] = useState<string>(LADOS_SIMULADOR[0].valor);
  const [cantidad, setCantidad] = useState("");
  const [precio, setPrecio] = useState("");
  const [comisionista, setComisionista] = useState<string>(COMISIONISTAS_SIMULADOR[0].valor);
  const [saldo, setSaldo] = useState("");
  const [precioActual, setPrecioActual] = useState("");
  const [estado, setEstado] = useState<Estado>({ tipo: "listo" });
  const enCurso = useRef(false);
  const alerta = useRef<HTMLDivElement | null>(null);
  const titulo = useRef<HTMLHeadingElement | null>(null);

  // Sin regiones vivas en <main> (el contrato de /operar): los errores toman el foco (como el resumen del área de
  // edición) y el resultado lo toma en su título, así el lector de pantalla lo anuncia una vez.
  useEffect(() => {
    if (estado.tipo === "errores") alerta.current?.focus();
    if (estado.tipo === "resultado") titulo.current?.focus();
  }, [estado]);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enCurso.current) return;
    enCurso.current = true;
    setEstado({ tipo: "calculando" });
    try {
      setEstado(await simular({ instrumentoId: especie, lado, cantidad, precioLimite: precio, comisionista, saldoComisionista: saldo, precioActual }));
    } finally {
      enCurso.current = false;
    }
  }

  const calculando = estado.tipo === "calculando";
  // Un campo rechazado se marca inválido y su descripción suma el mensaje de errores a su ayuda.
  const marca = (campo: (typeof CAMPOS_DEL_PEDIDO)[number], ayuda?: string) => {
    const malo = estado.tipo === "errores" && estado.campos.includes(campo);
    const descripcion = [ayuda, malo ? ID_ERRORES : undefined].filter((d): d is string => d !== undefined).join(" ");
    return { "aria-invalid": malo ? (true as const) : undefined, "aria-describedby": descripcion === "" ? undefined : descripcion };
  };

  return (
    <section className="bloque op-simulador" aria-labelledby="t-simulador">
      <div className="cabeza"><div><div className="eyebrow">{T.EYEBROW}</div><h2 id="t-simulador">{T.TITULO}</h2></div></div>
      <p>{T.INTRO}</p>
      {especies.length === 0 ? <p className="nota">{T.SIN_ESPECIES}</p> : (
        <form className="op-sim-form" noValidate onSubmit={enviar} aria-labelledby="t-simulador">
          <label htmlFor="sim-especie">{T.ESPECIE}</label>
          <select id="sim-especie" value={especie} onChange={(e) => setEspecie(e.target.value)} {...marca("instrumentoId")}>
            {especies.map((e) => <option key={e.id} value={e.id}>{`${e.nemotecnico} (${e.cantidad} acciones)`}</option>)}
          </select>
          <label htmlFor="sim-lado">{T.LADO}</label>
          <select id="sim-lado" value={lado} onChange={(e) => setLado(e.target.value)} {...marca("lado")}>
            {LADOS_SIMULADOR.map((l) => <option key={l.valor} value={l.valor}>{l.texto}</option>)}
          </select>
          <p className="nota op-sim-ayuda" id="sim-ayuda">{T.AYUDA_NUMERO}</p>
          <label htmlFor="sim-cantidad">{T.CANTIDAD}</label>
          <input id="sim-cantidad" type="text" inputMode="numeric" autoComplete="off" maxLength={32} value={cantidad} onChange={(e) => setCantidad(e.target.value)} {...marca("cantidad", "sim-ayuda")} />
          <label htmlFor="sim-precio">{T.PRECIO}</label>
          <input id="sim-precio" type="text" inputMode="decimal" autoComplete="off" maxLength={32} value={precio} onChange={(e) => setPrecio(e.target.value)} {...marca("precioLimite", "sim-ayuda")} />
          <label htmlFor="sim-comisionista">{T.COMISIONISTA}</label>
          <select id="sim-comisionista" value={comisionista} onChange={(e) => setComisionista(e.target.value)} {...marca("comisionista")}>
            {COMISIONISTAS_SIMULADOR.map((c) => <option key={c.valor} value={c.valor}>{c.texto}</option>)}
          </select>
          <label htmlFor="sim-saldo">{T.SALDO}</label>
          <input id="sim-saldo" type="text" inputMode="decimal" autoComplete="off" maxLength={32} value={saldo} onChange={(e) => setSaldo(e.target.value)} {...marca("saldoComisionista", "sim-ayuda-saldo")} />
          <p className="nota op-sim-ayuda" id="sim-ayuda-saldo">{T.AYUDA_SALDO}</p>
          <label htmlFor="sim-precio-actual">{T.PRECIO_ACTUAL}</label>
          <input id="sim-precio-actual" type="text" inputMode="decimal" autoComplete="off" maxLength={32} value={precioActual} onChange={(e) => setPrecioActual(e.target.value)} {...marca("precioActual", "sim-ayuda-precio-actual")} />
          <p className="nota op-sim-ayuda" id="sim-ayuda-precio-actual">{T.AYUDA_PRECIO_ACTUAL}</p>
          <button type="submit" className="op-sim-boton" aria-busy={calculando} aria-disabled={calculando ? true : undefined}>{T.BOTON}</button>
        </form>
      )}
      <div className="op-sim-salida">
        {calculando ? <p className="nota">{T.CALCULANDO}</p> : null}
        {estado.tipo === "errores" ? (
          <div className="op-sim-errores" id={ID_ERRORES} role="alert" tabIndex={-1} ref={alerta}><p>{T.ERRORES}</p><ul>{estado.errores.map((e, i) => <li key={`${i}-${e}`}>{e}</li>)}</ul></div>
        ) : null}
        {estado.tipo === "resultado" ? <Resultado vista={estado.vista} titulo={titulo} /> : null}
      </div>
      <p className="nota">{T.TARIFAS}</p>
    </section>
  );
}
