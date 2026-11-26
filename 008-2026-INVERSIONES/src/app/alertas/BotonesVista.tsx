"use client";
/**
 * «Marcar como vista» (una alerta) y «Marcar todas como vistas», solo del dueño (la familia no recibe los botones y, si llamara a la
 * ruta, recibiría 403). Manda a POST /api/alertas/vistas solo el id de la alerta o «todas»; con 200 pide a Next que refresque la
 * pantalla (sin recargar) y devuelve el foco al encabezado, porque el botón puede desaparecer; «Marcando…» se anuncia en una región de
 * estado y un error, en role="alert". Las marcas son idempotentes: repetir un clic no hace daño.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EVENTO_ALERTAS_CAMBIARON } from "@/app/_comun/alertas/evento";
import { TEXTOS_ALERTAS_PANTALLA } from "./textos";

type Pedido = { readonly alertaId: string } | { readonly todas: true };

async function marcar(cuerpo: Pedido): Promise<"ok" | "sesion" | "error"> {
  try {
    const r = await fetch("/api/alertas/vistas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo), cache: "no-store" });
    if (r.ok) return "ok";
    return r.status === 401 ? "sesion" : "error";
  } catch {
    return "error";
  }
}

interface Props {
  readonly pedido: Pedido;
  readonly texto: string;
  /** El nombre accesible cuando hay varios botones iguales (cada alerta); empieza por `texto`. */
  readonly etiqueta?: string;
}

export function BotonMarcar({ pedido, texto, etiqueta }: Props) {
  const router = useRouter();
  const [estado, setEstado] = useState<"listo" | "enviando" | "sesion" | "error">("listo");

  async function alClic() {
    if (estado === "enviando") return;
    setEstado("enviando");
    const r = await marcar(pedido);
    if (r !== "ok") {
      setEstado(r);
      return;
    }
    setEstado("listo");
    router.refresh();
    // El contador del menú es una isla de cliente: no se entera del refresco, se le avisa.
    window.dispatchEvent(new Event(EVENTO_ALERTAS_CAMBIARON));
    document.getElementById("t-hero")?.focus();
  }

  return (
    <span className="alerta-marca">
      <button type="button" className="alerta-boton" onClick={alClic} aria-disabled={estado === "enviando"} aria-label={etiqueta}>{texto}</button>
      <span className="sr" role="status">{estado === "enviando" ? TEXTOS_ALERTAS_PANTALLA.MARCANDO : ""}</span>
      {estado === "error" || estado === "sesion" ? (
        <span className="alerta-error" role="alert">{estado === "sesion" ? TEXTOS_ALERTAS_PANTALLA.SESION_VENCIDA : TEXTOS_ALERTAS_PANTALLA.ERROR_MARCAR}</span>
      ) : null}
    </span>
  );
}
