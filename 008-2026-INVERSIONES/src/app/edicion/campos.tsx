"use client";
/**
 * Piezas comunes de los formularios del área de edición (fase B, PR-B): el envío (un solo pedido a la vez, el resumen
 * de errores con el foco y el error de cada campo) y los mensajes accesibles. Los errores llegan como campo y código
 * (nunca valores) y sus textos salen de textos.ts.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { enviarJson } from "./enviar";
import { MENSAJES, TEXTOS_PLAN, mensajeDeCampo, mensajeDeError } from "./textos";
import type { CampoConError } from "./tipos";

type Estado =
  | { readonly tipo: "listo" }
  | { readonly tipo: "enviando" }
  | { readonly tipo: "error"; readonly mensaje: string; readonly campos: readonly CampoConError[] };

const sinSuscripcion = () => () => {};

/** true solo en el navegador ya hidratado: antes, el botón queda deshabilitado (no hay envío sin JS). */
export const useHidratado = (): boolean => useSyncExternalStore(sinSuscripcion, () => true, () => false);

export interface Envio {
  readonly estado: Estado;
  readonly enviando: boolean;
  readonly resumen: RefObject<HTMLDivElement | null>;
  /** Envía `cuerpo`; con 2xx llama `alGuardar` (y sigue ignorando envíos mientras la página navega). */
  enviar<T>(cuerpo: unknown, alGuardar: (datos: T) => boolean): Promise<void>;
  /** El mensaje del error de ese campo, si lo hay. */
  errorDe(campo: string): string | undefined;
  /** Borra los errores (al agregar o quitar reglas, los índices cambian). */
  limpiar(): void;
}

export function useEnvio(ruta: string): Envio {
  const [estado, setEstado] = useState<Estado>({ tipo: "listo" });
  const enCurso = useRef(false);
  const resumen = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (estado.tipo === "error") resumen.current?.focus();
  }, [estado]);

  const enviar = useCallback(
    async <T,>(cuerpo: unknown, alGuardar: (datos: T) => boolean) => {
      if (enCurso.current) return;
      enCurso.current = true;
      setEstado({ tipo: "enviando" });
      const r = await enviarJson<T>(ruta, cuerpo);
      if (r.tipo === "ok" && alGuardar(r.datos)) return; // `enCurso` sigue en true: la página navega.
      enCurso.current = false;
      setEstado(r.tipo === "ok" ? { tipo: "error", mensaje: MENSAJES["DESCONOCIDO"]!, campos: [] } : { tipo: "error", mensaje: r.mensaje, campos: r.campos });
    },
    [ruta],
  );

  const errorDe = (campo: string): string | undefined => {
    if (estado.tipo !== "error") return undefined;
    const e = estado.campos.find((c) => c.campo === campo);
    return e ? mensajeDeError(e.codigo) : undefined;
  };

  return { estado, enviando: estado.tipo === "enviando", resumen, enviar, errorDe, limpiar: () => setEstado({ tipo: "listo" }) };
}

/** El resumen de errores: role="alert", toma el foco al fallar; cada error nombra su campo. */
export function ResumenErrores({ envio }: { readonly envio: Envio }) {
  const e = envio.estado;
  return (
    <div className="edicion-resumen" role="alert" tabIndex={-1} ref={envio.resumen}>
      {e.tipo === "error" ? (
        <>
          <p className="edicion-resumen-titulo">{e.campos.length > 0 ? TEXTOS_PLAN.RESUMEN : e.mensaje}</p>
          {e.campos.length > 0 ? (
            <ul>
              {e.campos.map((c, i) => (
                <li key={`${c.campo}-${c.codigo}-${i}`}>{mensajeDeCampo(c)}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** Los atributos de accesibilidad de un control: su ayuda y su error (el error, al final). */
export function describir(id: string, ayuda: boolean, error: string | undefined): { "aria-describedby"?: string; "aria-invalid"?: true } {
  const ids = [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null].filter((x): x is string => x !== null);
  return { ...(ids.length > 0 ? { "aria-describedby": ids.join(" ") } : {}), ...(error ? { "aria-invalid": true as const } : {}) };
}

/** La etiqueta, el control, su ayuda y su error, en ese orden. */
export function Campo({ id, etiqueta, ayuda, error, children }: { readonly id: string; readonly etiqueta: string; readonly ayuda?: string; readonly error?: string; readonly children: ReactNode }) {
  return (
    <div className="edicion-campo">
      <label htmlFor={id}>{etiqueta}</label>
      {children}
      {ayuda ? <p className="edicion-ayuda" id={`${id}-ayuda`}>{ayuda}</p> : null}
      {error ? <p className="edicion-error" id={`${id}-error`}>{error}</p> : null}
    </div>
  );
}

/** El botón de envío: deshabilitado hasta hidratar; mientras envía, `aria-disabled` y `aria-busy` (no pierde el foco). */
export function BotonEnviar({ texto, enviando, estado }: { readonly texto: string; readonly enviando: boolean; readonly estado: string }) {
  const hidratado = useHidratado();
  return (
    <div className="edicion-enviar">
      <button type="submit" className="edicion-boton" disabled={!hidratado} aria-disabled={enviando} aria-busy={enviando}>
        {texto}
      </button>
      <p className="edicion-estado" role="status">{enviando ? estado : ""}</p>
    </div>
  );
}
