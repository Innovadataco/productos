"use client";
/**
 * Enlazar después una orden importada de Trii a la decisión vigente que la originó (fase B, área de edición). Las
 * órdenes ya vienen filtradas por el servidor (aprobadas, sin decisión, de la especie y el lado, no anteriores), que
 * lo vuelve a validar al guardar. Envía solo la decisión y la orden; con 201 vuelve a la cadena de la decisión.
 */
import { useState, type FormEvent } from "react";
import { BotonEnviar, Campo, ResumenErrores, describir, useEnvio } from "../campos";
import { irA } from "../enviar";
import { MENSAJES, TEXTOS_ENLACE } from "../textos";
import type { DatosEdicionEnlace } from "../tipos";

type Listo = Extract<DatosEdicionEnlace, { estado: "LISTO" }>;

export function FormularioEnlace({ datos }: { readonly datos: Listo }) {
  // Nada elegido de antemano: un enlace no se cambia después desde la web, así que la orden la elige el dueño.
  const [ordenId, setOrdenId] = useState("");
  const envio = useEnvio("/api/decisiones/enlaces");
  if (datos.ordenes.length === 0) return <p className="nota">{MENSAJES["SIN_ORDENES_POSIBLES"]}</p>;

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ordenId === "") {
      envio.fallar([{ campo: "ordenId", codigo: "ORDEN_SIN_ELEGIR" }]);
      return;
    }
    await envio.enviar(
      { decisionId: datos.decision.id, ordenId },
      () => {
        irA(`/decisiones/${encodeURIComponent(datos.decision.id)}`);
        return true;
      },
    );
  }

  return (
    <form className="edicion-form" noValidate onSubmit={guardar} aria-describedby="edicion-intro">
      <p id="edicion-intro">{TEXTOS_ENLACE.INTRO}</p>
      <ResumenErrores envio={envio} idDe={(campo) => (campo === "ordenId" ? "enlace-orden" : undefined)} />
      <Campo id="enlace-orden" etiqueta="Orden de Trii" error={envio.errorDe("ordenId")}>
        <select id="enlace-orden" required value={ordenId} onChange={(e) => setOrdenId(e.target.value)} {...describir("enlace-orden", false, envio.errorDe("ordenId"))}>
          <option value="" disabled>{TEXTOS_ENLACE.ELIJA}</option>
          {datos.ordenes.map((o) => <option key={o.id} value={o.id}>{o.texto}</option>)}
        </select>
      </Campo>
      <BotonEnviar texto={TEXTOS_ENLACE.BOTON} enviando={envio.enviando} estado={TEXTOS_ENLACE.ENVIANDO} />
    </form>
  );
}
