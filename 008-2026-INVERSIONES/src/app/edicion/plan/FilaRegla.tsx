"use client";
/**
 * Una regla del formulario del plan: un fieldset con su número, cada control con su etiqueta, su ayuda y su error.
 * El nivel solo se escribe en las condiciones que lo llevan (la regla del dominio); en las demás queda vacío. Está
 * memorizada: con planes de muchas reglas, escribir en una no vuelve a pintar las demás (las funciones y los errores
 * que recibe son estables).
 */
import type { AccionPlan, CondicionRegla } from "@prisma/client";
import { memo } from "react";
import { Campo, describir } from "../campos";
import { ACCIONES, CONDICIONES, ETIQUETAS_CAMPO, SIN_NIVEL, TEXTOS_PLAN, textoAccionRegla, textoCondicion } from "../textos";
import type { EspecieOpcion, ReglaEditable } from "../tipos";

/** Los mensajes de error de una regla, por campo (vacío si no tiene). */
export type ErroresRegla = Readonly<Partial<Record<keyof ReglaEditable, string>>>;

/** El id de cada control de una regla (lo usa también el resumen de errores para enlazar al campo). */
const SUFIJO: Readonly<Record<keyof ReglaEditable, string>> = {
  instrumentoId: "especie", condicion: "condicion", nivel: "nivel", accion: "accion", cantidad: "cantidad", plazoHasta: "plazo", detalle: "detalle",
};
export const idDeControl = (clave: number, campo: keyof ReglaEditable): string => `regla-${clave}-${SUFIJO[campo]}`;

type Props = {
  readonly regla: ReglaEditable;
  readonly clave: number;
  readonly numero: number;
  readonly especies: readonly EspecieOpcion[];
  readonly errores: ErroresRegla;
  readonly onCambio: (clave: number, cambio: Partial<ReglaEditable>) => void;
  readonly onQuitar: (clave: number) => void;
  /** La fecha desde la que rige la versión: un plazo anterior se avisa (el dominio lo rechaza). */
  readonly vigenteDesde: string;
};

function Fila({ regla, clave, numero, especies, errores, onCambio, onQuitar, vigenteDesde }: Props) {
  const id = (campo: keyof ReglaEditable) => idDeControl(clave, campo);
  const sinNivel = SIN_NIVEL.has(regla.condicion);
  const vencida = regla.plazoHasta !== "" && vigenteDesde !== "" && regla.plazoHasta < vigenteDesde;
  const cambiar = (cambio: Partial<ReglaEditable>) => onCambio(clave, cambio);
  const cambiarCondicion = (condicion: CondicionRegla) => cambiar(SIN_NIVEL.has(condicion) ? { condicion, nivel: "" } : { condicion });
  return (
    <fieldset className="edicion-regla">
      <legend>{`Regla ${numero}`}</legend>
      {vencida ? <p className="nota aviso">{TEXTOS_PLAN.PLAZO_VENCIDO}</p> : null}
      <div className="edicion-rejilla">
        <Campo id={id("instrumentoId")} etiqueta={ETIQUETAS_CAMPO.instrumentoId!} error={errores.instrumentoId}>
          <select id={id("instrumentoId")} value={regla.instrumentoId ?? ""} onChange={(e) => cambiar({ instrumentoId: e.target.value === "" ? null : e.target.value })} {...describir(id("instrumentoId"), false, errores.instrumentoId)}>
            <option value="">{TEXTOS_PLAN.PORTAFOLIO}</option>
            {especies.map((s) => <option key={s.id} value={s.id}>{s.nemotecnico}</option>)}
          </select>
        </Campo>
        <Campo id={id("condicion")} etiqueta={ETIQUETAS_CAMPO.condicion!} error={errores.condicion}>
          <select id={id("condicion")} value={regla.condicion} onChange={(e) => cambiarCondicion(e.target.value as CondicionRegla)} {...describir(id("condicion"), false, errores.condicion)}>
            {CONDICIONES.map((c) => <option key={c} value={c}>{textoCondicion(c)}</option>)}
          </select>
        </Campo>
        <Campo id={id("nivel")} etiqueta={ETIQUETAS_CAMPO.nivel!} ayuda={TEXTOS_PLAN.AYUDA_NIVEL} error={errores.nivel}>
          <input id={id("nivel")} type="text" inputMode="decimal" autoComplete="off" maxLength={64} disabled={sinNivel} value={sinNivel ? "" : regla.nivel} onChange={(e) => cambiar({ nivel: e.target.value })} {...describir(id("nivel"), true, errores.nivel)} />
        </Campo>
        <Campo id={id("accion")} etiqueta="Acción de la regla" error={errores.accion}>
          <select id={id("accion")} value={regla.accion} onChange={(e) => cambiar({ accion: e.target.value as AccionPlan })} {...describir(id("accion"), false, errores.accion)}>
            {ACCIONES.map((a) => <option key={a} value={a}>{textoAccionRegla(a)}</option>)}
          </select>
        </Campo>
        <Campo id={id("cantidad")} etiqueta={ETIQUETAS_CAMPO.cantidad!} ayuda={TEXTOS_PLAN.AYUDA_CANTIDAD} error={errores.cantidad}>
          <input id={id("cantidad")} type="text" inputMode="numeric" autoComplete="off" maxLength={32} value={regla.cantidad} onChange={(e) => cambiar({ cantidad: e.target.value })} {...describir(id("cantidad"), true, errores.cantidad)} />
        </Campo>
        <Campo id={id("plazoHasta")} etiqueta={ETIQUETAS_CAMPO.plazoHasta!} ayuda={TEXTOS_PLAN.AYUDA_PLAZO} error={errores.plazoHasta}>
          <input id={id("plazoHasta")} type="date" value={regla.plazoHasta} onChange={(e) => cambiar({ plazoHasta: e.target.value })} {...describir(id("plazoHasta"), true, errores.plazoHasta)} />
        </Campo>
      </div>
      <Campo id={id("detalle")} etiqueta={ETIQUETAS_CAMPO.detalle!} error={errores.detalle}>
        <textarea id={id("detalle")} rows={2} maxLength={2000} required value={regla.detalle} onChange={(e) => cambiar({ detalle: e.target.value })} {...describir(id("detalle"), false, errores.detalle)} />
      </Campo>
      <button type="button" className="edicion-quitar" onClick={() => onQuitar(clave)}>{`Quitar la regla ${numero}`}</button>
    </fieldset>
  );
}

export const FilaRegla = memo(Fila);
