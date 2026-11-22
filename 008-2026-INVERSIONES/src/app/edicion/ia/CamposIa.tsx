"use client";
/**
 * Piezas del formulario de /edicion/ia (E8): un selector y un texto con su etiqueta, su ayuda y su error (el error, con
 * el mensaje de su código), y el resumen de errores, que toma el foco al fallar (lo enfoca `useEnvio`) y enlaza cada
 * error con su control. Los mensajes salen de textos-ia.ts: nunca un texto del servidor.
 */
import type { MouseEvent, ReactNode, RefObject } from "react";
import { describir } from "../campos";
import { TEXTOS_IA, mensajeDeCampoIa } from "./textos-ia";
import type { CampoConErrorIa, Opcion } from "./tipos-ia";

interface PropsControl {
  readonly id: string;
  readonly etiqueta: string;
  readonly valor: string;
  readonly onCambio: (valor: string) => void;
  readonly ayuda?: string;
  readonly error?: string;
}

function Envoltura({ id, etiqueta, ayuda, error, children }: Omit<PropsControl, "valor" | "onCambio"> & { readonly children: ReactNode }) {
  return (
    <div className="edicion-campo">
      <label htmlFor={id}>{etiqueta}</label>
      {children}
      {ayuda ? <p className="edicion-ayuda" id={`${id}-ayuda`}>{ayuda}</p> : null}
      {error ? <p className="edicion-error" id={`${id}-error`}>{error}</p> : null}
    </div>
  );
}

export function Seleccion({ opciones, deshabilitada, ...p }: PropsControl & { readonly opciones: readonly (Opcion & { readonly deshabilitada?: boolean })[]; readonly deshabilitada?: boolean }) {
  return (
    <Envoltura {...p}>
      <select id={p.id} value={p.valor} disabled={deshabilitada} onChange={(e) => p.onCambio(e.target.value)} {...describir(p.id, p.ayuda !== undefined, p.error)}>
        {opciones.map((o) => <option key={o.valor} value={o.valor} disabled={o.deshabilitada}>{o.texto}</option>)}
      </select>
    </Envoltura>
  );
}

export function Texto({ modo, ...p }: PropsControl & { readonly modo?: "numeric" | "decimal" | "text" }) {
  return (
    <Envoltura {...p}>
      <input id={p.id} type="text" inputMode={modo ?? "text"} autoComplete="off" value={p.valor} onChange={(e) => p.onCambio(e.target.value)} {...describir(p.id, p.ayuda !== undefined, p.error)} />
    </Envoltura>
  );
}

function irAlCampo(evento: MouseEvent<HTMLAnchorElement>, id: string): void {
  const control = document.getElementById(id);
  if (!control) return;
  evento.preventDefault();
  control.focus();
}

interface PropsResumen {
  readonly referencia: RefObject<HTMLDivElement | null>;
  readonly mensaje: string | null;
  readonly campos: readonly CampoConErrorIa[];
  readonly idDe: (campo: string) => string | undefined;
  readonly nombreTarea: (clave: string) => string;
}

/** El resumen de errores: una región con nombre que toma el foco al fallar (sin role="alert", que lo leería dos veces). */
export function ResumenIa({ referencia, mensaje, campos, idDe, nombreTarea }: PropsResumen) {
  const hay = mensaje !== null;
  return (
    <div className="edicion-resumen" tabIndex={-1} ref={referencia} aria-labelledby="ia-resumen-titulo">
      {hay ? (
        <>
          <p className="edicion-resumen-titulo" id="ia-resumen-titulo">{campos.length > 0 ? TEXTOS_IA.RESUMEN : mensaje}</p>
          {campos.length > 0 ? (
            <ul>
              {campos.map((c, i) => {
                const id = idDe(c.campo);
                const texto = mensajeDeCampoIa(c.campo, c.codigo, nombreTarea);
                return <li key={`${c.campo}-${c.codigo}-${i}`}>{id ? <a href={`#${id}`} onClick={(ev) => irAlCampo(ev, id)}>{texto}</a> : texto}</li>;
              })}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
