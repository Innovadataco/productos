"use client";

import { useEffect, useRef } from "react";

/**
 * Pantalla de error de la app: la muestra Next cuando page.tsx falla por algo que no es la base
 * (un error de cálculo, por ejemplo). Es genérica a propósito: no pinta el mensaje, el digest ni
 * la pila. Next ya registra el error completo en el servidor, con su digest.
 * Al montarse se anuncia (role="alert") y lleva el foco al título, para que no quede en el vacío.
 */
type Props = {
  /** Lo lanzado; no se muestra. */
  error: Error & { digest?: string };
  /** Vuelve a pedir y pintar la página (Next 16.3+). */
  retry: () => void;
};

export default function PaginaDeError({ retry }: Props) {
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titulo.current?.focus(); }, []);
  return (
    <main className="wrap" style={{ paddingBlock: "48px" }}>
      <div role="alert">
        <h1 ref={titulo} tabIndex={-1}>No se pudo mostrar su portafolio</h1>
        <p>Ocurrió un error inesperado al preparar la pantalla. Sus datos no cambiaron: la pantalla es de solo lectura.</p>
      </div>
      <p>Intente de nuevo. Si sigue pasando, revise el registro del servidor.</p>
      <button type="button" className="pill" onClick={() => retry()}>Reintentar</button>
    </main>
  );
}
