"use client";
/**
 * Una regla del formulario del plan: un fieldset con su número, cada control con su etiqueta, su ayuda y su error.
 * El nivel solo se escribe en las condiciones que lo llevan (la regla del dominio); en las demás queda vacío.
 */
import type { AccionPlan, CondicionRegla } from "@prisma/client";
import type { Ref } from "react";
import { Campo, describir } from "../campos";
import { ACCIONES, CONDICIONES, ETIQUETAS_CAMPO, SIN_NIVEL, TEXTOS_PLAN, textoAccionRegla, textoCondicion } from "../textos";
import type { EspecieOpcion, ReglaEditable } from "../tipos";

type Props = {
  readonly regla: ReglaEditable;
  readonly clave: number;
  readonly numero: number;
  readonly especies: readonly EspecieOpcion[];
  readonly errorDe: (campo: keyof ReglaEditable) => string | undefined;
  readonly onCambio: (cambio: Partial<ReglaEditable>) => void;
  readonly onQuitar: () => void;
  readonly refEspecie?: Ref<HTMLSelectElement>;
  /** La fecha desde la que rige la versión: un plazo anterior se avisa (el dominio lo rechaza). */
  readonly vigenteDesde: string;
};

export function FilaRegla({ regla, clave, numero, especies, errorDe, onCambio, onQuitar, refEspecie, vigenteDesde }: Props) {
  const id = (campo: string) => `regla-${clave}-${campo}`;
  const sinNivel = SIN_NIVEL.has(regla.condicion);
  const vencida = regla.plazoHasta !== "" && vigenteDesde !== "" && regla.plazoHasta < vigenteDesde;
  const cambiarCondicion = (condicion: CondicionRegla) => onCambio(SIN_NIVEL.has(condicion) ? { condicion, nivel: "" } : { condicion });
  return (
    <fieldset className="edicion-regla">
      <legend>{`Regla ${numero}`}</legend>
      {vencida ? <p className="nota aviso">{TEXTOS_PLAN.PLAZO_VENCIDO}</p> : null}
      <div className="edicion-rejilla">
        <Campo id={id("especie")} etiqueta={ETIQUETAS_CAMPO.instrumentoId!} error={errorDe("instrumentoId")}>
          <select id={id("especie")} ref={refEspecie} value={regla.instrumentoId ?? ""} onChange={(e) => onCambio({ instrumentoId: e.target.value === "" ? null : e.target.value })} {...describir(id("especie"), false, errorDe("instrumentoId"))}>
            <option value="">{TEXTOS_PLAN.PORTAFOLIO}</option>
            {especies.map((s) => <option key={s.id} value={s.id}>{s.nemotecnico}</option>)}
          </select>
        </Campo>
        <Campo id={id("condicion")} etiqueta={ETIQUETAS_CAMPO.condicion!} error={errorDe("condicion")}>
          <select id={id("condicion")} value={regla.condicion} onChange={(e) => cambiarCondicion(e.target.value as CondicionRegla)} {...describir(id("condicion"), false, errorDe("condicion"))}>
            {CONDICIONES.map((c) => <option key={c} value={c}>{textoCondicion(c)}</option>)}
          </select>
        </Campo>
        <Campo id={id("nivel")} etiqueta={ETIQUETAS_CAMPO.nivel!} ayuda={TEXTOS_PLAN.AYUDA_NIVEL} error={errorDe("nivel")}>
          <input id={id("nivel")} type="text" inputMode="decimal" autoComplete="off" maxLength={64} disabled={sinNivel} value={sinNivel ? "" : regla.nivel} onChange={(e) => onCambio({ nivel: e.target.value })} {...describir(id("nivel"), true, errorDe("nivel"))} />
        </Campo>
        <Campo id={id("accion")} etiqueta="Acción de la regla" error={errorDe("accion")}>
          <select id={id("accion")} value={regla.accion} onChange={(e) => onCambio({ accion: e.target.value as AccionPlan })} {...describir(id("accion"), false, errorDe("accion"))}>
            {ACCIONES.map((a) => <option key={a} value={a}>{textoAccionRegla(a)}</option>)}
          </select>
        </Campo>
        <Campo id={id("cantidad")} etiqueta={ETIQUETAS_CAMPO.cantidad!} ayuda={TEXTOS_PLAN.AYUDA_CANTIDAD} error={errorDe("cantidad")}>
          <input id={id("cantidad")} type="text" inputMode="numeric" autoComplete="off" maxLength={32} value={regla.cantidad} onChange={(e) => onCambio({ cantidad: e.target.value })} {...describir(id("cantidad"), true, errorDe("cantidad"))} />
        </Campo>
        <Campo id={id("plazo")} etiqueta={ETIQUETAS_CAMPO.plazoHasta!} error={errorDe("plazoHasta")}>
          <input id={id("plazo")} type="date" value={regla.plazoHasta} onChange={(e) => onCambio({ plazoHasta: e.target.value })} {...describir(id("plazo"), false, errorDe("plazoHasta"))} />
        </Campo>
      </div>
      <Campo id={id("detalle")} etiqueta={ETIQUETAS_CAMPO.detalle!} error={errorDe("detalle")}>
        <textarea id={id("detalle")} rows={2} maxLength={2000} required value={regla.detalle} onChange={(e) => onCambio({ detalle: e.target.value })} {...describir(id("detalle"), false, errorDe("detalle"))} />
      </Campo>
      <button type="button" className="edicion-quitar" onClick={onQuitar}>{`Quitar la regla ${numero}`}</button>
    </fieldset>
  );
}
