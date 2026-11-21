"use client";
import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";

type Estado = { readonly tipo: "listo" } | { readonly tipo: "enviando" } | { readonly tipo: "error"; readonly mensaje: string };

const POR_ESTADO: Readonly<Record<number, string>> = {
  401: "Usuario o contraseña incorrectos",
  429: "Demasiadas solicitudes. Espere un momento e intente de nuevo.",
};
const OTRO_ERROR = "No se pudo iniciar sesión. Intente de nuevo.";

const sinSuscripcion = () => () => {};
/** true solo en el navegador ya hidratado: antes, el botón queda deshabilitado (no hay envío sin JS). */
const useHidratado = (): boolean => useSyncExternalStore(sinSuscripcion, () => true, () => false);

/**
 * Formulario de ingreso (D-014). Envía por `fetch` (el POST lleva el Origin real; un formulario nativo,
 * con `Referrer-Policy: no-referrer`, mandaría `Origin: null`). `method="post"` impide que, sin JS, la
 * clave termine en la URL. Mientras envía, el botón queda `aria-disabled` (no `disabled`: así no pierde
 * el foco) y un segundo envío se ignora.
 */
export function FormularioIngreso() {
  const hidratado = useHidratado();
  const [estado, setEstado] = useState<Estado>({ tipo: "listo" });
  const enCurso = useRef(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enCurso.current) return;
    enCurso.current = true;
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    setEstado({ tipo: "enviando" });
    try {
      const r = await fetch("/api/sesion/ingresar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(datos.get("email") ?? ""), clave: String(datos.get("clave") ?? "") }),
        cache: "no-store",
      });
      if (r.ok) {
        window.location.assign("/");
        return;
      }
      (formulario.elements.namedItem("clave") as HTMLInputElement | null)?.select();
      setEstado({ tipo: "error", mensaje: POR_ESTADO[r.status] ?? OTRO_ERROR });
    } catch {
      setEstado({ tipo: "error", mensaje: OTRO_ERROR });
    } finally {
      enCurso.current = false;
    }
  }

  const enviando = estado.tipo === "enviando";
  return (
    <form className="acceso-form" method="post" action="/api/sesion/ingresar" onSubmit={enviar}>
      <label htmlFor="email">Correo</label>
      <input id="email" name="email" type="email" autoComplete="username" required maxLength={254} />
      <label htmlFor="clave">Contraseña</label>
      <input id="clave" name="clave" type="password" autoComplete="current-password" required maxLength={256} />
      <p className="acceso-aviso" role="alert">{estado.tipo === "error" ? estado.mensaje : ""}</p>
      {/* El nombre no cambia al enviar: el estado lo dicen aria-disabled y aria-busy. */}
      <button type="submit" disabled={!hidratado} aria-disabled={enviando} aria-busy={enviando}>
        Ingresar
      </button>
    </form>
  );
}
