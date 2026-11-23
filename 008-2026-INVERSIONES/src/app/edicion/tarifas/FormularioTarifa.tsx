"use client";
/**
 * El formulario de una versión NUEVA de la tarifa (O5): comisionista, lado, porcentaje, mínimo, fijo, IVA, hasta 3 otros
 * cargos, desde cuándo rige y el motivo. Envía a POST /api/operar/tarifas lo escrito con la última versión que vio (el
 * servidor lo lee y lo valida); con 201 recarga la página con la versión guardada; con error, el resumen toma el foco y
 * cada campo queda marcado. Los números se escriben como en la ficha («0,25», «4.613,27»).
 */
import { useState, type FormEvent, type ReactNode } from "react";
import { BotonEnviar, useEnvio } from "../campos";
import { irA } from "../enviar";
import { AYUDAS_TARIFA, ETIQUETAS_TARIFA, TEXTOS_TARIFAS, etiquetaDeCampo, mensajeTarifa } from "./textos-tarifas";
import type { DatosEdicionTarifas, Opcion } from "./tipos-tarifas";

interface CargoEditable {
  readonly clave: number;
  readonly nombre: string;
  readonly tipo: string;
  readonly valor: string;
}

interface Valores {
  readonly comisionista: string;
  readonly lado: string;
  readonly porcentaje: string;
  readonly minimoPorOrden: string;
  readonly fijoPorOrden: string;
  readonly ivaPct: string;
  readonly vigenteDesde: string;
  readonly motivo: string;
}

const idDe = (campo: string): string => `tarifa-${campo.replace(/\./g, "-")}`;

interface PropsCampo {
  readonly campo: string;
  readonly etiqueta: string;
  readonly error: string | undefined;
  readonly ayuda?: string;
  readonly children: (atributos: { readonly id: string; readonly "aria-invalid"?: true; readonly "aria-describedby"?: string }) => ReactNode;
}

/** La etiqueta, el control, su ayuda y su error (en ese orden), con sus atributos de accesibilidad. */
function Campo({ campo, etiqueta, error, ayuda, children }: PropsCampo) {
  const id = idDe(campo);
  const describe = [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null].filter((x): x is string => x !== null);
  return (
    <div className="edicion-campo">
      <label htmlFor={id}>{etiqueta}</label>
      {children({ id, ...(error ? { "aria-invalid": true as const } : {}), ...(describe.length > 0 ? { "aria-describedby": describe.join(" ") } : {}) })}
      {ayuda ? <p className="edicion-ayuda" id={`${id}-ayuda`}>{ayuda}</p> : null}
      {error ? <p className="edicion-error" id={`${id}-error`}>{error}</p> : null}
    </div>
  );
}

function Lista({ opciones, valor, onCambio, ...atributos }: { readonly opciones: readonly Opcion[]; readonly valor: string; readonly onCambio: (v: string) => void; readonly id: string }) {
  return (
    <select {...atributos} value={valor} onChange={(e) => onCambio(e.target.value)}>
      {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
    </select>
  );
}

export function FormularioTarifa({ datos }: { readonly datos: DatosEdicionTarifas }) {
  const [valores, setValores] = useState<Valores>({
    comisionista: datos.comisionistas[0]?.valor ?? "", lado: datos.lados[0]?.valor ?? "", porcentaje: "", minimoPorOrden: "0", fijoPorOrden: "0", ivaPct: "0", vigenteDesde: datos.hoy, motivo: "",
  });
  const [cargos, setCargos] = useState<readonly CargoEditable[]>([]);
  const [siguiente, setSiguiente] = useState(1);
  const envio = useEnvio("/api/operar/tarifas");
  const estado = envio.estado;
  const campos = estado.tipo === "error" ? estado.campos : [];
  const errorDe = (campo: string): string | undefined => {
    const e = campos.find((c) => c.campo === campo);
    return e ? mensajeTarifa(e.codigo) : undefined;
  };
  const cambiar = (campo: keyof Valores, v: string) => setValores((x) => ({ ...x, [campo]: v }));
  const cambiarCargo = (clave: number, cambio: Partial<CargoEditable>) => setCargos((cs) => cs.map((c) => (c.clave === clave ? { ...c, ...cambio } : c)));
  // Los errores de los cargos van por posición: al agregar o quitar uno ya no apuntan al mismo cargo, se limpian.
  const agregar = () => {
    envio.limpiar();
    setCargos((cs) => [...cs, { clave: siguiente, nombre: "", tipo: datos.tiposCargo[0]?.valor ?? "", valor: "" }]);
    setSiguiente((n) => n + 1);
  };
  const quitar = (clave: number) => {
    envio.limpiar();
    setCargos((cs) => cs.filter((x) => x.clave !== clave));
  };

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const cuerpo = { versionBase: datos.ultimaVersion, ...valores, otrosCargos: cargos.map(({ nombre, tipo, valor }) => ({ nombre, tipo, valor })) };
    await envio.enviar<{ version?: unknown }>(cuerpo, (r) => {
      if (typeof r.version !== "number" || !Number.isInteger(r.version)) return false;
      irA(`/edicion/tarifas?guardada=${r.version}`);
      return true;
    });
  }

  const texto = (campo: keyof Valores, modo: "decimal" | "text" = "decimal", ayuda?: string) => (
    <Campo campo={campo} etiqueta={ETIQUETAS_TARIFA[campo]} error={errorDe(campo)} ayuda={ayuda}>
      {(a) => <input {...a} type="text" inputMode={modo} autoComplete="off" value={valores[campo]} onChange={(e) => cambiar(campo, e.target.value)} />}
    </Campo>
  );

  return (
    <form className="edicion-form" noValidate onSubmit={guardar} aria-labelledby="t-tarifa-nueva">
      <h2 id="t-tarifa-nueva">{TEXTOS_TARIFAS.NUEVA}</h2>
      <div className="edicion-resumen" tabIndex={-1} ref={envio.resumen}>
        {estado.tipo === "error" ? (
          <>
            <p className="edicion-resumen-titulo">{campos.length > 0 ? TEXTOS_TARIFAS.ERRORES : estado.mensaje}</p>
            {campos.length > 0 ? (
              <ul>{campos.map((c, i) => <li key={`${c.campo}-${i}`}><a href={`#${idDe(c.campo)}`}>{`${etiquetaDeCampo(c.campo)}: ${mensajeTarifa(c.codigo)}`}</a></li>)}</ul>
            ) : null}
          </>
        ) : null}
      </div>
      <div className="edicion-rejilla">
        <Campo campo="comisionista" etiqueta={ETIQUETAS_TARIFA.comisionista} error={errorDe("comisionista")}>
          {(a) => <Lista {...a} opciones={datos.comisionistas} valor={valores.comisionista} onCambio={(v) => cambiar("comisionista", v)} />}
        </Campo>
        <Campo campo="lado" etiqueta={ETIQUETAS_TARIFA.lado} error={errorDe("lado")}>
          {(a) => <Lista {...a} opciones={datos.lados} valor={valores.lado} onCambio={(v) => cambiar("lado", v)} />}
        </Campo>
        <Campo campo="vigenteDesde" etiqueta={ETIQUETAS_TARIFA.vigenteDesde} error={errorDe("vigenteDesde")}>
          {(a) => <input {...a} type="date" value={valores.vigenteDesde} onChange={(e) => cambiar("vigenteDesde", e.target.value)} />}
        </Campo>
      </div>
      <div className="edicion-rejilla">
        {texto("porcentaje", "decimal", AYUDAS_TARIFA.numero)}
        {texto("minimoPorOrden")}
        {texto("fijoPorOrden")}
        {texto("ivaPct")}
      </div>
      <fieldset className="edicion-regla" aria-describedby={errorDe("otrosCargos") ? idDe("otrosCargos") : undefined}>
        <legend>{TEXTOS_TARIFAS.OTROS_CARGOS}</legend>
        <p className="edicion-ayuda">{AYUDAS_TARIFA.cargo}</p>
        {errorDe("otrosCargos") ? <p className="edicion-error" id={idDe("otrosCargos")}>{errorDe("otrosCargos")}</p> : null}
        {cargos.length === 0 ? <p className="nota">{TEXTOS_TARIFAS.SIN_CARGOS}</p> : null}
        {cargos.map((c, i) => (
          <div className="tarifa-cargo" key={c.clave}>
            <div className="edicion-rejilla">
              <Campo campo={`otrosCargos.${i}.nombre`} etiqueta={etiquetaDeCampo(`otrosCargos.${i}.nombre`)} error={errorDe(`otrosCargos.${i}.nombre`)}>
                {(a) => <input {...a} type="text" maxLength={60} autoComplete="off" value={c.nombre} onChange={(e) => cambiarCargo(c.clave, { nombre: e.target.value })} />}
              </Campo>
              <Campo campo={`otrosCargos.${i}.tipo`} etiqueta={etiquetaDeCampo(`otrosCargos.${i}.tipo`)} error={errorDe(`otrosCargos.${i}.tipo`)}>
                {(a) => <Lista {...a} opciones={datos.tiposCargo} valor={c.tipo} onCambio={(v) => cambiarCargo(c.clave, { tipo: v })} />}
              </Campo>
              <Campo campo={`otrosCargos.${i}.valor`} etiqueta={etiquetaDeCampo(`otrosCargos.${i}.valor`)} error={errorDe(`otrosCargos.${i}.valor`)}>
                {(a) => <input {...a} type="text" inputMode="decimal" autoComplete="off" value={c.valor} onChange={(e) => cambiarCargo(c.clave, { valor: e.target.value })} />}
              </Campo>
            </div>
            <button type="button" className="edicion-quitar" onClick={() => quitar(c.clave)}>
              {`${TEXTOS_TARIFAS.QUITAR_CARGO} (${i + 1})`}
            </button>
          </div>
        ))}
        {cargos.length < datos.maxCargos ? (
          <button type="button" className="edicion-agregar tarifa-agregar" onClick={agregar}>{TEXTOS_TARIFAS.AGREGAR_CARGO}</button>
        ) : null}
      </fieldset>
      <Campo campo="motivo" etiqueta={ETIQUETAS_TARIFA.motivo} error={errorDe("motivo")}>
        {(a) => <textarea {...a} rows={3} maxLength={2000} required value={valores.motivo} onChange={(e) => cambiar("motivo", e.target.value)} />}
      </Campo>
      <BotonEnviar texto={TEXTOS_TARIFAS.GUARDAR} enviando={envio.enviando} estado={TEXTOS_TARIFAS.GUARDANDO} />
    </form>
  );
}
