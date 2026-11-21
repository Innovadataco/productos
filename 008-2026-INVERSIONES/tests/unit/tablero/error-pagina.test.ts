// Página de error de la app (INV-SPEC-15): page.tsx propaga los errores que no son de la base.
// Debe decir algo genérico y ofrecer reintentar, sin mostrar nada del error (mensaje, digest ni pila).
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PaginaDeError from "@/app/error";

const DETALLE = "detalle-interno-del-calculo";
const DIGEST = "digest-1234567890";

function pintar(error: Error & { digest?: string }): string {
  return renderToStaticMarkup(createElement(PaginaDeError, { error, retry: () => undefined }));
}

describe("src/app/error.tsx", () => {
  it("muestra un mensaje genérico y un botón para reintentar", () => {
    const html = pintar(new Error(DETALLE));
    expect(html).toContain("No se pudo mostrar su portafolio");
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>Reintentar<\/button>/);
  });

  it("no muestra el mensaje, el digest ni la pila del error", () => {
    const error = Object.assign(new Error(DETALLE), { digest: DIGEST });
    const html = pintar(error);
    expect(html).not.toContain(DETALLE);
    expect(html).not.toContain(DIGEST);
    expect(html).not.toContain("error-pagina.test");
  });

  it("aguanta un valor lanzado que no es un Error", () => {
    // Desde un componente de cliente puede llegar cualquier cosa, aunque Next lo tipe como Error.
    const noEsError = { secreto: DETALLE } as unknown as Error;
    expect(pintar(noEsError)).not.toContain(DETALLE);
  });
});
