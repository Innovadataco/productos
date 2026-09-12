# SPEC-656 · Plan

## Enfoque

El directorio del padre tiene **un solo vacío** y culpa la búsqueda. Lo partimos en dos
según una señal **detectable** (un conteo), no interpretable:

1. **Dato** — el predicado «verificado» (estado ACTIVO ∧ vigencia APROBADO no-vencida)
   ya vive factorizado en `vigenciaVigente`. Un `count` que lo reusa da
   `hayVerificados` sin que conteo y lista puedan discrepar. El API lo devuelve, y
   solo recuenta cuando la lista filtrada sale vacía.
2. **Detección** — una función pura `clasificarVacioDirectorio(cantidad, hayVerificados)`
   decide `con-resultados | estructural | por-filtro`. Es el corazón del radicado
   («detectable, no interpretable») y se cierra con candado de unidad por mutación —
   independiente del copy.
3. **Forma** — el render pinta el vacío que la función indica. El **copy lo fija
   Diseño**; Dev construye la estructura. El puente de urgencia del caso estructural
   **reusa `<CanalesOficiales/>`** (la única ruta de emergencia del producto), más un
   puente de vuelta al expediente.

## Orden de trabajo

1. ✅ `clasificarVacioDirectorio` + candado de unidad (mutación verificada).
2. ✅ `PerfilProfesionalRepository.contarActivos` (reusa el predicado).
3. ✅ API `hayVerificados` (recuento solo si la lista vacía).
4. ⏳ **Bloqueado en Diseño:** el copy del vacío estructural (1ª persona, sin culpar) y
   confirmación del vacío por-filtro. Con el copy: cablear el cliente
   (`DirectorioProfesionales`) para leer `hayVerificados`, ramificar con la función, y
   montar el caso estructural (copy + `<CanalesOficiales/>` + volver al expediente).
5. ⏳ Candado de render (FR-005): el caso estructural no culpa la búsqueda ni muestra
   filtros, y sí muestra los canales. Verificado por mutación.
6. ⏳ Preflight (tsc · lint · arch · tokens · unidad) + specs-discipline. PR.

## Decisión abierta

**«Avísame cuando haya»** (propuesta de Estrategia para la salida estructural) **no es
render**: necesita persistir la solicitud del padre y un disparo cuando aparezca un
verificado (Datos). Queda **fuera de esta ola** salvo que el CEO lo incluya; los otros
dos puentes sí son render y se cablean ahora.

## Fuera de este plan

- El backend de «avísame cuando haya» (si entra, es otra SPEC / carril de Datos).
- El predicado de verificación (`vigenciaVigente`) — correcto, no se toca.
