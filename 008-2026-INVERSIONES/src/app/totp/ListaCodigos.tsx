"use client";
import { useEffect, useRef } from "react";
import { BotonCopiar } from "./BotonCopiar";

interface PropsListaCodigos {
  readonly codigos: readonly string[];
  /** El título de la lista (en /totp/codigos el h1 ya dice «Códigos de recuperación»). */
  readonly titulo?: string;
}

/**
 * Los 10 códigos de recuperación, que se muestran UNA sola vez (no quedan en la base ni se vuelven a
 * pedir). El foco va al título para que el lector de pantalla los anuncie. «Copiar los códigos» los manda
 * al portapapeles, uno por línea; «Ya los guardé» lleva al tablero.
 */
export function ListaCodigos({ codigos, titulo = "Códigos de recuperación" }: PropsListaCodigos) {
  const encabezado = useRef<HTMLHeadingElement>(null);
  useEffect(() => encabezado.current?.focus(), []);
  return (
    <section aria-labelledby="titulo-codigos">
      <h2 id="titulo-codigos" ref={encabezado} tabIndex={-1}>
        {titulo}
      </h2>
      <p className="nota">
        Guárdelos ahora en su gestor de contraseñas. Cada uno sirve una sola vez, si pierde el teléfono, y no se vuelven a mostrar.
      </p>
      <ol className="acceso-codigos" aria-label="Códigos de recuperación">
        {codigos.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <BotonCopiar texto={codigos.join("\n")} etiqueta="Copiar los códigos" copiado="Códigos copiados." />
      <a className="acceso-boton" href="/">
        Ya los guardé: ir al tablero
      </a>
    </section>
  );
}
