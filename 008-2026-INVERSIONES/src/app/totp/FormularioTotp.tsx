"use client";
import { useState } from "react";
import { FormularioCodigo } from "./FormularioCodigo";

interface Entrada {
  readonly ok: true;
  readonly restantes: number | null;
}

/**
 * Segundo paso del ingreso: el código de la app (o uno de recuperación) abre la sesión y lleva al tablero.
 * Si entró con un código de recuperación, antes avisa cuántos quedan y ofrece generar nuevos.
 */
export function FormularioTotp() {
  const [restantes, setRestantes] = useState<number | null>(null);
  if (restantes !== null) {
    return (
      <div className="acceso-listo" role="status">
        <p>
          Entró con un código de recuperación. Le {restantes === 1 ? "queda" : "quedan"} {restantes}.
        </p>
        <p>
          <a href="/totp/codigos">Generar códigos nuevos</a> · <a href="/">Ir al tablero</a>
        </p>
      </div>
    );
  }
  return (
    <FormularioCodigo<Entrada>
      ruta="/api/sesion/totp"
      boton="Verificar"
      permiteRecuperacion
      enfocar
      alEntrar={(d) => {
        if (d.restantes === null) window.location.assign("/");
        else setRestantes(d.restantes);
      }}
    />
  );
}
