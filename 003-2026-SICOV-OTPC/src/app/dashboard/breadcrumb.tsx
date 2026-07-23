"use client";

import { usePathname } from "next/navigation";
import { derivarMigas, rutaPadre } from "@/lib/navegacion";

/// Breadcrumb + retorno al módulo padre, compartido por TODO el dashboard vía layout.tsx
/// (fix I-14). Las specs 005-008 lo heredan sin escribir nada: se deriva de la ruta.
export function Breadcrumb() {
  const pathname = usePathname() ?? "";
  const migas = derivarMigas(pathname);
  const padre = rutaPadre(pathname);
  if (migas.length === 0) return null;

  return (
    <div className="flex items-center gap-3 px-8 py-3 bg-white border-b text-sm">
      {padre && (
        <a
          href={padre}
          aria-label="Volver"
          className="text-sicov-700 hover:underline font-medium"
        >
          ← Volver
        </a>
      )}
      <nav aria-label="Ruta de navegación" className="flex items-center gap-1 text-gray-600">
        {migas.map((miga, i) => {
          const esUltima = i === migas.length - 1;
          return (
            <span key={miga.href} className="flex items-center gap-1">
              {i > 0 && <span className="text-gray-400">/</span>}
              {esUltima ? (
                <span aria-current="page" className="text-gray-900 font-medium">
                  {miga.etiqueta}
                </span>
              ) : (
                <a href={miga.href} className="hover:underline text-sicov-700">
                  {miga.etiqueta}
                </a>
              )}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
