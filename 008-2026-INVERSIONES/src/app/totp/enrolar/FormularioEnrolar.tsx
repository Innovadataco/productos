"use client";
import { useState, type ReactNode } from "react";
import { FormularioCodigo } from "../FormularioCodigo";
import { ListaCodigos } from "../ListaCodigos";

interface Activacion {
  readonly ok: true;
  readonly codigos: readonly string[];
}

interface PropsFormularioEnrolar {
  /** El QR y la clave en base32 (los dibuja el servidor); se ocultan al activar. */
  readonly children: ReactNode;
}

/** Confirma el secreto con un código de la app; al activarlo muestra los 10 códigos de recuperación UNA vez. */
export function FormularioEnrolar({ children }: PropsFormularioEnrolar) {
  const [codigos, setCodigos] = useState<readonly string[] | null>(null);
  if (codigos) return <ListaCodigos codigos={codigos} />;
  return (
    <>
      {children}
      <FormularioCodigo<Activacion> ruta="/api/sesion/totp/enrolar" boton="Activar" permiteRecuperacion={false} alEntrar={(d) => setCodigos(d.codigos)} />
    </>
  );
}
