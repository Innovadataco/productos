# SPEC-443 · Plan
El arnés siembra el mapa REAL de permisos (fuente única) en vez de encender todo. Rojo = hallazgo; reportar inventario antes de arreglar; cada rojo afirma la verdad; candado que muere con un permiso de más.
1. Rama fresca desde origin/main; leer el arnés, el seed y los guards en fuente.
2. `otorgarTodosLosPermisos` → `sembrarPermisosDeProduccion` = `syncModulosYGrants(prisma)` (módulo importado).
3. Full integration → inventario de rojos agrupado por causa → reportar al CEO.
4. Arreglar cada rojo afirmando la verdad (403 / grant explícito / conteo acotado). Prohibido re-encender todo. Brecha real = ficha nueva al CEO.
5. Candado de conducta (BD ≡ CLAVES_POR_ROL) + contraprueba por mutación. Full re-run verde.
Fuera de alcance: `seed-modulos-grants.ts`; cualquier guard de producto.
