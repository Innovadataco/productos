"use client";
/**
 * El formulario de una versión NUEVA de los umbrales de las alertas: un interruptor por alerta y, donde hay umbral, su valor
 * (porcentaje, minutos o días hábiles), más el motivo. Envía a POST /api/alertas/umbrales lo escrito con la última versión que
 * vio (el servidor lo lee y lo valida contra los rangos del motor); con 201 recarga la página con la versión guardada; con
 * error, el resumen toma el foco y cada campo queda marcado. Los porcentajes se escriben como en la ficha («3,5»).
 */
import { useState, type FormEvent, type ReactNode } from "react";
import { BotonEnviar, ResumenErrores, useEnvio } from "../campos";
import { irA } from "../enviar";
import { AYUDAS_ALERTAS, LEYENDAS_ALERTAS, TEXTOS_ALERTAS, etiquetaDeCampo, mensajeAlertas } from "./textos-alertas";
import type { DatosEdicionAlertas, ValoresAlertas } from "./tipos-alertas";

type CampoActiva = "alertaNivelCruzadoActiva" | "alertaCercaActiva" | "alertaMovimientoActiva" | "alertaCaidaActiva" | "alertaDatoViejoActiva" | "alertaExActiva";
type CampoUmbral = "alertaCercaPct" | "alertaMovimientoPct" | "alertaCaidaPct" | "alertaDatoViejoMin" | "alertaExDiasHabiles";

/** Cada alerta, en el orden en que se explica: su interruptor y, si lo tiene, su umbral. */
const GRUPOS: readonly { readonly activa: CampoActiva; readonly umbral: CampoUmbral | null }[] = [
  { activa: "alertaNivelCruzadoActiva", umbral: null },
  { activa: "alertaCercaActiva", umbral: "alertaCercaPct" },
  { activa: "alertaMovimientoActiva", umbral: "alertaMovimientoPct" },
  { activa: "alertaCaidaActiva", umbral: "alertaCaidaPct" },
  { activa: "alertaDatoViejoActiva", umbral: "alertaDatoViejoMin" },
  { activa: "alertaExActiva", umbral: "alertaExDiasHabiles" },
];

const idDe = (campo: string): string => `alertas-${campo}`;

interface PropsCampo {
  readonly campo: string;
  readonly error: string | undefined;
  readonly ayuda?: string;
  readonly children: (atributos: { readonly id: string; readonly "aria-invalid"?: true; readonly "aria-describedby"?: string }) => ReactNode;
}

/** La etiqueta, el control, su ayuda y su error (en ese orden), con sus atributos de accesibilidad. */
function Campo({ campo, error, ayuda, children }: PropsCampo) {
  const id = idDe(campo);
  const describe = [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null].filter((x): x is string => x !== null);
  return (
    <div className="edicion-campo">
      <label htmlFor={id}>{etiquetaDeCampo(campo)}</label>
      {children({ id, ...(error ? { "aria-invalid": true as const } : {}), ...(describe.length > 0 ? { "aria-describedby": describe.join(" ") } : {}) })}
      {ayuda ? <p className="edicion-ayuda" id={`${id}-ayuda`}>{ayuda}</p> : null}
      {error ? <p className="edicion-error" id={`${id}-error`}>{error}</p> : null}
    </div>
  );
}

export function FormularioAlertas({ datos }: { readonly datos: DatosEdicionAlertas }) {
  const [valores, setValores] = useState<ValoresAlertas>(datos.valores);
  const [motivo, setMotivo] = useState("");
  const envio = useEnvio("/api/alertas/umbrales");
  const campos = envio.estado.tipo === "error" ? envio.estado.campos : [];
  const errorDe = (campo: string): string | undefined => {
    const e = campos.find((c) => c.campo === campo);
    return e ? mensajeAlertas(e.codigo) : undefined;
  };

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    await envio.enviar<{ version?: unknown }>({ versionBase: datos.ultimaVersion, ...valores, motivo }, (r) => {
      if (typeof r.version !== "number" || !Number.isInteger(r.version)) return false;
      irA(`/edicion/alertas?guardada=${r.version}`);
      return true;
    });
  }

  return (
    <form className="edicion-form" noValidate onSubmit={guardar} aria-labelledby="t-alertas-nueva">
      <h2 id="t-alertas-nueva">{TEXTOS_ALERTAS.NUEVA}</h2>
      <ResumenErrores envio={envio} idDe={idDe} />
      {GRUPOS.map((g) => (
        <fieldset className="edicion-regla alertas-grupo" key={g.activa}>
          <legend>{LEYENDAS_ALERTAS[g.activa]}</legend>
          <Campo campo={g.activa} error={errorDe(g.activa)}>
            {(a) => <input {...a} type="checkbox" checked={valores[g.activa]} onChange={(e) => setValores((v) => ({ ...v, [g.activa]: e.target.checked }))} />}
          </Campo>
          {g.umbral === null ? null : (
            <Campo campo={g.umbral} error={errorDe(g.umbral)} ayuda={AYUDAS_ALERTAS[g.umbral]}>
              {(a) => <input {...a} type="text" inputMode="decimal" autoComplete="off" value={valores[g.umbral!]} onChange={(e) => setValores((v) => ({ ...v, [g.umbral!]: e.target.value }))} />}
            </Campo>
          )}
        </fieldset>
      ))}
      <Campo campo="motivo" error={errorDe("motivo")}>
        {(a) => <textarea {...a} rows={3} maxLength={2000} required value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
      </Campo>
      <BotonEnviar texto={TEXTOS_ALERTAS.GUARDAR} enviando={envio.enviando} estado={TEXTOS_ALERTAS.GUARDANDO} />
    </form>
  );
}
