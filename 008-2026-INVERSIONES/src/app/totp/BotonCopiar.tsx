"use client";
import { useState } from "react";

type Estado = "listo" | "copiado" | "fallo";

interface PropsBotonCopiar {
  /** Lo que va al portapapeles, tal cual. */
  readonly texto: string;
  readonly etiqueta: string;
  /** Lo que se anuncia al copiar (role=status). */
  readonly copiado: string;
}

const FALLO = "No se pudo copiar: selecciónelo y cópielo a mano.";

/**
 * Copia al portapapeles con `navigator.clipboard` y lo anuncia en un role=status. Si el navegador no lo
 * permite (sin permiso, sin contexto seguro), lo dice y el texto sigue a la vista para copiarlo a mano.
 */
export function BotonCopiar({ texto, etiqueta, copiado }: PropsBotonCopiar) {
  const [estado, setEstado] = useState<Estado>("listo");

  async function copiar() {
    try {
      if (!navigator.clipboard) throw new Error("sin portapapeles");
      await navigator.clipboard.writeText(texto);
      setEstado("copiado");
    } catch {
      setEstado("fallo");
    }
  }

  return (
    <div className="acceso-copiar">
      <button type="button" className="acceso-enlace" onClick={copiar}>
        {etiqueta}
      </button>
      <p className="nota" role="status">
        {estado === "copiado" ? copiado : estado === "fallo" ? FALLO : ""}
      </p>
    </div>
  );
}
