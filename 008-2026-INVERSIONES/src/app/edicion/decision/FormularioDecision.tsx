"use client";
/**
 * El formulario de una decisión del diario (fase B, área de edición): qué decidió, por qué y con qué regla, y, si ya
 * se importó, la orden de Trii que la ejecutó. Las listas son de ayuda (el servidor vuelve a validar todo): la regla,
 * entre las de la versión vigente en la fecha de la decisión, de esa especie o del portafolio; la orden, entre las
 * aprobadas sin decisión de esa especie, del lado de la acción y no anteriores a la decisión. En una corrección no hay
 * orden: las de la anterior pasan solas. Con 201 va a la cadena de la decisión nueva.
 */
import type { AccionPlan } from "@prisma/client";
import { useState, type FormEvent } from "react";
import { AvisoObligatorios, BotonEnviar, Campo, ResumenErrores, describir, useEnvio } from "../campos";
import { idValido, irA } from "../enviar";
import { ACCIONES, ETIQUETAS_CAMPO, TEXTOS_DECISION, fecha, textoAccionDecisionCorta } from "../textos";
import type { DatosEdicionDecision, DecisionEditable, ReglaCitable, VersionConReglas } from "../tipos";

type Listo = Extract<DatosEdicionDecision, { estado: "LISTO" }>;
const LADO: Readonly<Record<AccionPlan, "COMPRA" | "VENTA" | null>> = { COMPRAR: "COMPRA", VENDER: "VENTA", NO_ACTUAR: null };

/** La versión vigente en la fecha: la de mayor número con `desde` ≤ fecha (la regla de src/plan/versiones.ts). */
const vigenteEn = (versiones: readonly VersionConReglas[], dia: string): VersionConReglas | undefined =>
  [...versiones].sort((a, b) => b.numero - a.numero).find((v) => v.desde <= dia);

const citables = (versiones: readonly VersionConReglas[], d: DecisionEditable): readonly ReglaCitable[] =>
  (vigenteEn(versiones, d.fechaDecision)?.reglas ?? []).filter((r) => r.instrumentoId === null || r.instrumentoId === d.instrumentoId);

const candidatas = (datos: Listo, d: DecisionEditable): Listo["ordenes"] => {
  const lado = LADO[d.accion];
  return lado === null || datos.corrige !== null ? [] : datos.ordenes.filter((o) => o.instrumentoId === d.instrumentoId && o.lado === lado && o.fecha >= d.fechaDecision);
};

/**
 * Lo elegido que ya no cabe (cambió la fecha, la especie o la acción) se suelta y no vuelve solo: nunca se envía una
 * regla u orden oculta, ni una excepción sin regla.
 */
function coherente(datos: Listo, d: DecisionEditable): DecisionEditable {
  const reglaId = citables(datos.versiones, d).some((r) => r.id === d.reglaId) ? d.reglaId : "";
  const ordenId = candidatas(datos, d).some((o) => o.id === d.ordenId) ? d.ordenId : "";
  return { ...d, reglaId, ordenId, excepcion: reglaId !== "" && d.excepcion };
}

/** Dónde está el control de cada campo del pedido (para los enlaces del resumen de errores). */
const ID_DE_CAMPO: Readonly<Record<string, string>> = {
  fechaDecision: "decision-fecha", instrumentoId: "decision-especie", accion: "decision-accion", cantidad: "decision-cantidad",
  reglaId: "decision-regla", excepcion: "decision-excepcion", motivo: "decision-motivo", ordenId: "decision-orden",
};
const idDe = (campo: string): string | undefined => ID_DE_CAMPO[campo];

function Correccion({ corrige }: { readonly corrige: NonNullable<Listo["corrige"]> }) {
  return <p className="nota aviso">{`Corrige la decisión del ${fecha(corrige.fecha)} de ${corrige.especie}. ${TEXTOS_DECISION.CORRECCION}`}</p>;
}

export function FormularioDecision({ datos }: { readonly datos: Listo }) {
  const [d, setD] = useState<DecisionEditable>(() => coherente(datos, datos.inicial));
  const envio = useEnvio("/api/decisiones");
  const reglas = citables(datos.versiones, d);
  const lado = LADO[d.accion];
  const ordenes = candidatas(datos, d);
  const { reglaId, ordenId } = d;
  const cambiar = (cambio: Partial<DecisionEditable>) => setD((x) => coherente(datos, { ...x, ...cambio }));
  const err = (campo: string) => envio.errorDe(campo);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const cuerpo = {
      fechaDecision: d.fechaDecision, instrumentoId: d.instrumentoId, accion: d.accion, cantidad: d.cantidad, reglaId: reglaId || null,
      excepcion: d.excepcion, motivo: d.motivo, ordenId: ordenId || null, corrige: datos.corrige?.id ?? null,
    };
    await envio.enviar<{ id?: unknown }>(cuerpo, (r) => {
      if (!idValido(r.id)) return false;
      irA(`/decisiones/${encodeURIComponent(r.id)}`);
      return true;
    });
  }

  return (
    <form className="edicion-form" noValidate onSubmit={guardar} aria-describedby="edicion-intro edicion-obligatorios">
      <p id="edicion-intro">{TEXTOS_DECISION.INTRO}</p>
      <AvisoObligatorios />
      {datos.corrige ? <Correccion corrige={datos.corrige} /> : null}
      <ResumenErrores envio={envio} idDe={idDe} />
      <div className="edicion-rejilla">
        <Campo id="decision-fecha" etiqueta={ETIQUETAS_CAMPO.fechaDecision!} error={err("fechaDecision")}>
          <input id="decision-fecha" type="date" required max={datos.hoy} value={d.fechaDecision} onChange={(e) => cambiar({ fechaDecision: e.target.value })} {...describir("decision-fecha", false, err("fechaDecision"))} />
        </Campo>
        <Campo id="decision-especie" etiqueta={ETIQUETAS_CAMPO.instrumentoId!} error={err("instrumentoId")}>
          <select id="decision-especie" required value={d.instrumentoId} onChange={(e) => cambiar({ instrumentoId: e.target.value })} {...describir("decision-especie", false, err("instrumentoId"))}>
            <option value="" disabled>Elija la especie</option>
            {datos.especies.map((s) => <option key={s.id} value={s.id}>{s.nemotecnico}</option>)}
          </select>
        </Campo>
        <Campo id="decision-accion" etiqueta="Qué decidió" error={err("accion")}>
          <select id="decision-accion" value={d.accion} onChange={(e) => cambiar({ accion: e.target.value as AccionPlan })} {...describir("decision-accion", false, err("accion"))}>
            {ACCIONES.map((a) => <option key={a} value={a}>{textoAccionDecisionCorta(a)}</option>)}
          </select>
        </Campo>
        <Campo id="decision-cantidad" etiqueta={ETIQUETAS_CAMPO.cantidad!} ayuda={TEXTOS_DECISION.AYUDA_CANTIDAD} error={err("cantidad")}>
          <input id="decision-cantidad" type="text" inputMode="numeric" autoComplete="off" maxLength={32} value={d.cantidad} onChange={(e) => cambiar({ cantidad: e.target.value })} {...describir("decision-cantidad", true, err("cantidad"))} />
        </Campo>
      </div>
      <Campo id="decision-regla" etiqueta={ETIQUETAS_CAMPO.reglaId!} ayuda={TEXTOS_DECISION.AYUDA_REGLA} error={err("reglaId")}>
        <select id="decision-regla" value={reglaId} onChange={(e) => cambiar({ reglaId: e.target.value })} {...describir("decision-regla", true, err("reglaId"))}>
          <option value="">{TEXTOS_DECISION.SIN_REGLA}</option>
          {reglas.map((r) => <option key={r.id} value={r.id}>{r.texto}</option>)}
        </select>
      </Campo>
      <div className="edicion-campo edicion-casilla">
        <input id="decision-excepcion" type="checkbox" disabled={reglaId === ""} checked={d.excepcion} onChange={(e) => cambiar({ excepcion: e.target.checked })} {...describir("decision-excepcion", reglaId === "", err("excepcion"))} />
        <label htmlFor="decision-excepcion">Se aparta de la acción de la regla (excepción)</label>
        {reglaId === "" ? <p className="edicion-ayuda" id="decision-excepcion-ayuda">{TEXTOS_DECISION.AYUDA_EXCEPCION}</p> : null}
        {err("excepcion") ? <p className="edicion-error" id="decision-excepcion-error">{err("excepcion")}</p> : null}
      </div>
      <Campo id="decision-motivo" etiqueta="Por qué" error={err("motivo")}>
        <textarea id="decision-motivo" rows={3} maxLength={2000} required value={d.motivo} onChange={(e) => cambiar({ motivo: e.target.value })} {...describir("decision-motivo", false, err("motivo"))} />
      </Campo>
      {datos.corrige ? null : lado === null ? (
        <p className="nota">{TEXTOS_DECISION.NO_ACTUAR_SIN_ORDEN}</p>
      ) : (
        <Campo id="decision-orden" etiqueta="Orden de Trii (opcional)" ayuda={TEXTOS_DECISION.AYUDA_ORDEN} error={err("ordenId")}>
          <select id="decision-orden" value={ordenId} onChange={(e) => cambiar({ ordenId: e.target.value })} {...describir("decision-orden", true, err("ordenId"))}>
            <option value="">{TEXTOS_DECISION.SIN_ORDEN}</option>
            {ordenes.map((o) => <option key={o.id} value={o.id}>{o.texto}</option>)}
          </select>
        </Campo>
      )}
      <BotonEnviar texto={datos.corrige ? TEXTOS_DECISION.BOTON_CORRECCION : TEXTOS_DECISION.BOTON} enviando={envio.enviando} estado={TEXTOS_DECISION.ENVIANDO} />
    </form>
  );
}
