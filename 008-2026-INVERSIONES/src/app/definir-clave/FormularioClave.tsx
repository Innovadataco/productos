"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";

type Campo = "clave" | "confirmacion";

type Estado =
  | { readonly tipo: "leyendo" }
  | { readonly tipo: "sin-token" }
  | { readonly tipo: "listo"; readonly token: string; readonly email: string; readonly aviso: string; readonly campo: Campo | null }
  | { readonly tipo: "enviando"; readonly token: string; readonly email: string }
  | { readonly tipo: "vencido" }
  | { readonly tipo: "hecho" };

const MIN_BYTES = 12;
const MAX_BYTES = 72;
const ENLACE_INVALIDO = "El enlace no es válido o ya venció. Pida uno nuevo.";
const DEMASIADAS = "Demasiadas solicitudes. Espere un momento e intente de nuevo.";
const OTRO_ERROR = "No se pudo definir la contraseña. Intente de nuevo.";
const ID_AVISO = "aviso-clave";

const bytes = (texto: string): number => new TextEncoder().encode(texto).length;

/** El problema de la clave (la regla es en bytes, no en caracteres) y el campo que hay que corregir. */
function problemaDeClave(clave: string, confirmacion: string): { readonly aviso: string; readonly campo: Campo } | null {
  if (bytes(clave) < MIN_BYTES || bytes(clave) > MAX_BYTES) {
    return { aviso: `La contraseña debe tener entre ${MIN_BYTES} y ${MAX_BYTES} bytes.`, campo: "clave" };
  }
  return clave === confirmacion ? null : { aviso: "Las contraseñas no coinciden.", campo: "confirmacion" };
}

/** El token (`#t=…`) y el correo (`&u=…`) del fragmento. Se quitan de la barra en cuanto se leen. */
function leerFragmento(): { readonly token: string | null; readonly email: string } {
  const datos = new URLSearchParams(window.location.hash.slice(1));
  if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
  return { token: datos.get("t"), email: datos.get("u") ?? "" };
}

async function avisoDelServidor(r: Response): Promise<string> {
  if (r.status === 429) return DEMASIADAS;
  const cuerpo = (await r.json().catch(() => null)) as { error?: unknown } | null;
  return r.status === 400 && typeof cuerpo?.error === "string" ? cuerpo.error : OTRO_ERROR;
}

/**
 * Definir la contraseña con un enlace de un solo uso (D-014). El token viaja en el fragmento, que el
 * navegador nunca manda al servidor; aquí se lee y se envía en el cuerpo de un POST por `fetch`.
 * Un 401 (enlace inválido, vencido o usado) deja la página en «vencido», sin formulario.
 */
export function FormularioClave() {
  const [estado, setEstado] = useState<Estado>({ tipo: "leyendo" });
  const refs = { clave: useRef<HTMLInputElement>(null), confirmacion: useRef<HTMLInputElement>(null) };
  const campoConError = estado.tipo === "listo" ? estado.campo : null;

  useEffect(() => {
    // En desarrollo (StrictMode) el efecto corre dos veces: la segunda ya no ve el fragmento.
    const { token, email } = leerFragmento();
    setEstado((previo) => {
      if (previo.tipo !== "leyendo") return previo;
      return token ? { tipo: "listo", token, email, aviso: "", campo: null } : { tipo: "sin-token" };
    });
  }, []);

  useEffect(() => {
    // `refs` contiene useRef (estables): el foco depende solo del campo con error.
    if (campoConError) refs[campoConError].current?.focus();
  }, [campoConError]); // eslint-disable-line react-hooks/exhaustive-deps

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (estado.tipo !== "listo") return;
    const datos = new FormData(evento.currentTarget);
    const clave = String(datos.get("clave") ?? "");
    const problema = problemaDeClave(clave, String(datos.get("confirmacion") ?? ""));
    const { token, email } = estado;
    if (problema) {
      setEstado({ tipo: "listo", token, email, ...problema });
      return;
    }
    setEstado({ tipo: "enviando", token, email });
    try {
      const r = await fetch("/api/sesion/definir-clave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, clave }),
        cache: "no-store",
      });
      if (r.ok) setEstado({ tipo: "hecho" });
      else if (r.status === 401) setEstado({ tipo: "vencido" });
      else setEstado({ tipo: "listo", token, email, aviso: await avisoDelServidor(r), campo: r.status === 400 ? "clave" : null });
    } catch {
      setEstado({ tipo: "listo", token, email, aviso: OTRO_ERROR, campo: null });
    }
  }

  if (estado.tipo === "leyendo") return <p className="nota">Leyendo el enlace…</p>;
  if (estado.tipo === "sin-token") {
    return <p className="acceso-aviso" role="alert">Este enlace no trae su código. Pida uno nuevo con el comando de acceso.</p>;
  }
  if (estado.tipo === "vencido") return <p className="acceso-aviso" role="alert">{ENLACE_INVALIDO}</p>;
  if (estado.tipo === "hecho") {
    return (
      <p className="acceso-listo" role="status">
        Contraseña definida. Ya puede <a href="/ingresar">ingresar</a>.
      </p>
    );
  }
  const enviando = estado.tipo === "enviando";
  const aviso = estado.tipo === "listo" ? estado.aviso : "";
  const invalido = (campo: Campo) => (campoConError === campo ? { "aria-invalid": true, "aria-describedby": ID_AVISO } : {});
  return (
    <form className="acceso-form" method="post" action="/api/sesion/definir-clave" onSubmit={enviar}>
      {/* Para el gestor de contraseñas: a qué cuenta pertenece la clave nueva. */}
      <input type="text" name="username" autoComplete="username" value={estado.email} readOnly hidden />
      <label htmlFor="clave">Contraseña nueva</label>
      <input ref={refs.clave} id="clave" name="clave" type="password" autoComplete="new-password" required maxLength={256} {...invalido("clave")} />
      <label htmlFor="confirmacion">Repita la contraseña</label>
      <input
        ref={refs.confirmacion}
        id="confirmacion"
        name="confirmacion"
        type="password"
        autoComplete="new-password"
        required
        maxLength={256}
        {...invalido("confirmacion")}
      />
      <p className="acceso-aviso" role="alert" id={ID_AVISO}>{aviso}</p>
      <button type="submit" aria-disabled={enviando} aria-busy={enviando}>
        Definir contraseña
      </button>
    </form>
  );
}
