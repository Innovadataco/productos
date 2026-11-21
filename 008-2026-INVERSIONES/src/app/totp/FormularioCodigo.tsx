"use client";
import { useRef, useState, type FormEvent } from "react";
import { useHidratado } from "../ingresar/useHidratado";
import { enviarCodigo } from "./enviar";

type Modo = "app" | "recuperacion";
type Estado =
  | { readonly tipo: "listo"; readonly aviso: string }
  | { readonly tipo: "enviando" }
  | { readonly tipo: "vencida"; readonly mensaje: string };

interface PropsFormularioCodigo<T> {
  /** La API que recibe `{ codigo }`. */
  readonly ruta: string;
  readonly boton: string;
  /** Si además del código de la app acepta uno de recuperación (solo el segundo paso del ingreso). */
  readonly permiteRecuperacion: boolean;
  readonly alEntrar: (datos: T) => void;
  /** Enfocar el campo al abrir la página (solo donde el campo es lo primero que se hace: /totp). */
  readonly enfocar?: boolean;
}

const ID_AVISO = "aviso-codigo";
const ETIQUETA: Readonly<Record<Modo, string>> = { app: "Código de la app", recuperacion: "Código de recuperación" };

/**
 * Formulario de un código del segundo paso (TOTP de 6 dígitos o, si se permite, de recuperación). Envía
 * por `fetch`; `method="post"` impide que, sin JS, el código termine en la URL. Mientras envía, el botón
 * queda `aria-disabled` (conserva el foco) y un segundo envío se ignora; si salió bien, se sigue ignorando
 * (la página navega y un doble Enter no debe reenviar). Un error marca el campo, lo selecciona y lo
 * anuncia; si hay que volver a ingresar, el formulario se cambia por el aviso y el enlace. Cambiar de modo
 * monta un campo nuevo (`key`): vacío y con su propio teclado.
 */
export function FormularioCodigo<T>({ ruta, boton, permiteRecuperacion, alEntrar, enfocar = false }: PropsFormularioCodigo<T>) {
  const hidratado = useHidratado();
  const [modo, setModo] = useState<Modo>("app");
  const [estado, setEstado] = useState<Estado>({ tipo: "listo", aviso: "" });
  const enCurso = useRef(false);
  const campo = useRef<HTMLInputElement>(null);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enCurso.current) return;
    enCurso.current = true;
    const codigo = String(new FormData(evento.currentTarget).get("codigo") ?? "").trim();
    setEstado({ tipo: "enviando" });
    const r = await enviarCodigo<T>(ruta, codigo);
    if (r.tipo === "ok") {
      // `enCurso` queda en true: lo que sigue es navegar o mostrar los códigos, nunca otro envío.
      alEntrar(r.datos);
      return;
    }
    enCurso.current = false;
    if (r.tipo === "vencida") {
      setEstado({ tipo: "vencida", mensaje: r.mensaje });
      return;
    }
    setEstado({ tipo: "listo", aviso: r.mensaje });
    campo.current?.select();
  }

  function cambiarModo() {
    setModo((m) => (m === "app" ? "recuperacion" : "app"));
    setEstado({ tipo: "listo", aviso: "" });
    requestAnimationFrame(() => campo.current?.focus());
  }

  if (estado.tipo === "vencida") {
    return (
      <p className="acceso-aviso" role="alert">
        {estado.mensaje} <a href="/ingresar">Ir a ingresar</a>
      </p>
    );
  }
  const enviando = estado.tipo === "enviando";
  const aviso = estado.tipo === "listo" ? estado.aviso : "";
  const invalido = aviso ? { "aria-invalid": true, "aria-describedby": ID_AVISO } : {};
  return (
    <form className="acceso-form" method="post" action={ruta} onSubmit={enviar}>
      <label htmlFor="codigo">{ETIQUETA[modo]}</label>
      <input
        key={modo}
        ref={campo}
        id="codigo"
        name="codigo"
        type="text"
        inputMode={modo === "app" ? "numeric" : "text"}
        autoComplete="one-time-code"
        autoCapitalize={modo === "app" ? "off" : "characters"}
        spellCheck={false}
        required
        maxLength={modo === "app" ? 8 : 24}
        autoFocus={enfocar}
        {...invalido}
      />
      <p className="acceso-aviso" role="alert" id={ID_AVISO}>
        {aviso}
      </p>
      <button type="submit" disabled={!hidratado} aria-disabled={enviando} aria-busy={enviando}>
        {boton}
      </button>
      {permiteRecuperacion && (
        <button type="button" className="acceso-enlace" onClick={cambiarModo}>
          {modo === "app" ? "Usar un código de recuperación" : "Usar el código de la app"}
        </button>
      )}
    </form>
  );
}
