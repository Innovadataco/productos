# SPEC-494 · El mueble Skeleton: matar el spinner de página (§4.8)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: PI-1 (`idc-32`) · **Origen**: auditoría de forma de Diseño. **Cierra I-323.** Forma: `MUEBLE-SKELETON.md` (v1.0, Diseño). Alta palanca: un mueble reemplaza el patrón en 13 pantallas.

## El hueco
§4.8 manda **skeleton que preserva el layout, nunca spinner infinito**; la carga de PÁGINA usaba `animate-spin`. No es deuda de color (el spinner ya usaba tokens) — es el **patrón** (spinner vs skeleton). El spinner-EN-BOTÓN se conserva.

## El arreglo (forma de Diseño)
1. **Token `--skeleton`** en `globals.css` (`tinta/6` claro, `tinta/8` oscuro — el color voltea; `papel/8` habría sido invisible en oscuro). Clase `.skeleton` con **shimmer** izq→der (1.4s, curva del sistema); el bloque global `prefers-reduced-motion` ya apaga el `::after` → fantasma estático visible (§4.5).
2. **Primitivo `<Skeleton>`** + `<SkeletonContainer>` (aria-busy + label; bloques `aria-hidden`) + azúcar `<SkeletonText>`, `<SkeletonCircle>`, `<SkeletonCard>` (`Skeleton.tsx`).
3. **Esqueletos por layout** (`skeletons.tsx`) que calcan la silueta real: `SkeletonColegioInicio`, `SkeletonAdminBandeja`, `SkeletonPadreInicio`, `SkeletonProfesionalAgenda` (§2.1-2.4), más `SkeletonLista` (filas dentro de tarjeta/sección) y `SkeletonDetalle` (detalle/form) para las sub-páginas.
4. **13 spinners de página → SkeletonX**: los 3 admin (colegios, apelaciones, gestion) y 10 de colegio (alertas, alumnos [id], SeccionAcudientes, configuracion, cursos, estadisticas, materias, onboarding, profesores, profesores [id]). Las sub-páginas (listas dentro de card) usan `SkeletonLista`/`SkeletonDetalle` para no doblar el marco; los detalles/forms, `SkeletonDetalle`.

## Candado — `src/app/dashboard/skeleton-carga.candado.test.ts` (3 tests)
- **0 spinner de PÁGINA** (ring manual `animate-spin rounded-full border-2 … border-t-…`) en `src/app/dashboard/**`. Muere por mutación (re-poner un spinner de página → rojo).
- **Contraprueba:** el spinner-EN-BOTÓN (`<Button isLoading>`) se conserva y NO dispara el candado (idioma distinto, sin ring inline). Se verifica que `isLoading` siga presente.
- El mueble está en uso (hay `SkeletonX` en el dashboard).

## Impacto en arquitectura:
- Un mueble (`<Skeleton>` + azúcar + 6 siluetas) reemplaza el patrón spinner-de-página en 13 pantallas → §4.8 cumplido, sin salto de layout. `--skeleton` es el único relleno (nunca `bg-slate-*`). El spinner-en-botón queda intacto.

## Lo que NO cambia
- Spinner-EN-BOTÓN (correcto). Micro-indicadores inline `<Loader2 animate-spin>` (op en curso, no carga de página). `ComiteBandeja:298` (deuda de color aparte). PublicDashboard ya era skeleton por token (SPEC-493).

## Verificación final
- CEO: 0 `animate-spin` de carga de página; mueble en su sitio. **Diseño certifica** contra la pantalla en carga real (throttling) por rol — no cierra sin su firma.

## Referencias
`MUEBLE-SKELETON.md` (Diseño) · §4.8/§4.5. Rama `work/pi-SPEC-494-mueble-skeleton` desde `origin/main fe77f72f1`.
