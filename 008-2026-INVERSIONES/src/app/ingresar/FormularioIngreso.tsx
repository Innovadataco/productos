"use client";
import { useRef, useState, type FormEvent } from "react";
import { useHidratado } from "./useHidratado";

type Estado = { readonly tipo: "listo" } | { readonly tipo: "enviando" } | { readonly tipo: "error"; readonly mensaje: string };

const POR_ESTADO: Readonly<Record<number, string>> = {
  401: "Usuario o contraseña incorrectos",
  429: "Demasiadas solicitudes. Espere un momento e intente de nuevo.",
};
const OTRO_ERROR = "No se pudo iniciar sesión. Intente de nuevo.";
/** El segundo paso (TOTP): solo estas dos rutas, nunca una que mande el servidor. */
const SEGUNDO_PASO: Readonly<Record<string, string>> = { totp: "/totp", enrolar: "/totp/enrolar" };

async function rutaDelSegundoPaso(r: Response): Promise<string | null> {
  const cuerpo = (await r.json().catch(() => null)) as { paso?: unknown } | null;
  const paso = typeof cuerpo?.paso === "string" ? cuerpo.paso : "";
  return Object.hasOwn(SEGUNDO_PASO, paso) ? (SEGUNDO_PASO[paso] ?? null) : null;
}

/**
 * Formulario de ingreso, primer paso (D-014 y TOTP). Con la clave correcta lleva al segundo paso: /totp
 * o /totp/enrolar, según diga el servidor (de una lista fija). Envía por `fetch` (el POST lleva el Origin real; un formulario nativo,
 * con `Referrer-Policy: no-referrer`, mandaría `Origin: null`). `method="post"` impide que, sin JS, la
 * clave termine en la URL. Mientras envía, el botón queda `aria-disabled` (no `disabled`: así no pierde
 * el foco) y un segundo envío se ignora; si salió bien, se sigue ignorando mientras la página navega.
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
        const ruta = await rutaDelSegundoPaso(r);
        if (ruta) {
          // `enCurso` queda en true: la página navega y un doble Enter no debe reenviar la clave.
          window.location.assign(ruta);
          return;
        }
        enCurso.current = false;
        setEstado({ tipo: "error", mensaje: OTRO_ERROR });
        return;
      }
      enCurso.current = false;
      (formulario.elements.namedItem("clave") as HTMLInputElement | null)?.select();
      setEstado({ tipo: "error", mensaje: POR_ESTADO[r.status] ?? OTRO_ERROR });
    } catch {
      enCurso.current = false;
      setEstado({ tipo: "error", mensaje: OTRO_ERROR });
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
