"use client";
import { useState } from "react";
import { FormularioCodigo } from "../FormularioCodigo";
import { ListaCodigos } from "../ListaCodigos";

interface Regeneracion {
  readonly ok: true;
  readonly codigos: readonly string[];
}

/**
 * Con un código de la app genera 10 códigos de recuperación nuevos (anula los anteriores) y los muestra una
 * vez. La nota y «Volver al tablero» solo están antes de generar: después, la lista trae su propia salida.
 */
export function FormularioCodigos() {
  const [codigos, setCodigos] = useState<readonly string[] | null>(null);
  if (codigos) return <ListaCodigos codigos={codigos} titulo="Sus códigos nuevos" />;
  return (
    <>
      <p className="nota">Generar códigos nuevos anula los anteriores. Para confirmar, escriba el código de su app.</p>
      <FormularioCodigo<Regeneracion> ruta="/api/sesion/totp/codigos" boton="Generar códigos nuevos" permiteRecuperacion={false} alEntrar={(d) => setCodigos(d.codigos)} />
      <p className="nota">
        <a href="/">Volver al tablero</a>
      </p>
    </>
  );
}
