# Spec 089 — Presentación al usuario: estados, categorías y consulta pública

**Status**: `FINALIZADO` (pendiente validación del CEO + ACTA-VALIDACION de ZEUS → `CERRADA`)
**Rama**: `feature/001-scaffolding`
**Creado**: 2026-07-23
**Origen**: validación funcional del CEO

**Principio rector**: el sistema informa con hechos, nunca juzga a la persona. Estos cambios ALINEAN con la constitución (corrigen incumplimientos §1.3/§1.5).

## User Stories

### US1 — Estados visibles: solo 2 (P1)

El usuario ve únicamente "En proceso" / "Procesado". Se renombra el etiquetado engañoso "Verificado" → "Procesado" en consulta y seguimiento. Los 8 estados internos no cambian; solo el mapeo visible. Mensaje neutral.

### US2 — Clasificador: raíz (P1)

- **(a)** Un reporte con categoría `OTRO` SIEMPRE va a `REVISION_MANUAL`, sin importar la confianza (un humano lo reclasifica o descarta). Así "Procesado" siempre implica categoría real.
- **(b)** La conducta líder se elige por **mayor gravedad** (no por votos): 3 votos leves vs 2 graves → gana el grave (que con confianza < umbral irá a revisión humana en vez de auto-publicarse como leve). Severidad desde `scoring.severity.*` (ADR_004).

### US3 — Predicado único "reporte aprobado" (P1)

`esReporteAprobado(reporte)` = estado ∈ {CLASIFICADO, CORREGIDO} ∧ categoría ∉ {SPAM, OTRO} ∧ eliminado = false. Fuente ÚNICA usada por consulta pública + scoring + dashboard (misma cuenta en todos lados). Hoy la consulta no excluye SPAM ni OTRO: un spam infla el conteo público.

### US4 — Categorías de cara al usuario (P1)

- Las conductas de riesgo se muestran con su nombre; SPAM y OTRO nunca se muestran (seguimiento: "No se identifica riesgo").
- Multi-conducta: mostrar TODAS las identificadas, ordenadas por gravedad (más grave primero), usando `categoriasSecundarias` (hoy la pantalla las descarta).

### US5 — Consulta pública (P1)

- Fix bug "(undefined)" en conteo de plataformas (el API devuelve `total`, el frontend lee otro campo).
- Formato compacto "N unidad (nombres)"; `total = autenticados + anónimos` (cuadre verificable).
- Ubicación: anónimo ve PAÍSES (rollup); autenticado ve departamento y ciudad.
- Señal descriptiva "Actividad baja/alta de reportes" por umbral parametrizable (describe datos, no riesgo).
- El detalle se muestra aunque haya pocos reportes (no bloquear con "sin información suficiente"); el umbral aplica al listado del dashboard, no a la consulta directa.
- Divulgación progresiva: anónimo = resumen; autenticado = ciudad, timeline, plataformas completas, informe.

### US6 — Quitar nivelRiesgo de la superficie pública (P1)

`nivelRiesgo` (BAJO/MEDIO/ALTO) + score sobre el identificador = etiqueta de riesgo y score de persona (prohibidos §1.3/§1.5). Se elimina de la respuesta pública y de la UI; se reemplaza por la señal descriptiva de US5. El cálculo interno para priorización operativa puede quedar; lo que se quita es exponerlo como veredicto.

### US7 — Registro por valor, no por miedo (P2)

- Seguimiento del reporte propio: NO ocultar las conductas propias para forzar registro (dark pattern). Mensaje "gracias por reportar". El gancho es valor futuro: alertas, seguimiento, Círculo de Confianza.
- Consulta pública (tercero): ahí SÍ se gatea el detalle tras login (privacidad).

### US8 — Bugs UI menores (P2)

- Comité: estabilizar el layout que salta al cambiar de tab (ComiteSubNav).
- Menú lateral: corregir doble resaltado (lógica `active` de AdminNav con `startsWith` — la raíz `/dashboard/admin` marca todo).

## Requirements

- **FR-001**: Mapeo visible de estados: CLASIFICADO/CORREGIDO → "Procesado"; resto → "En proceso". Sin otros textos visibles.
- **FR-002**: `OTRO` → siempre `REVISION_MANUAL` en el pipeline.
- **FR-003**: Ranking del clasificador ordena por severidad (parámetros) → votos → confianza.
- **FR-004**: `esReporteAprobado` como única fuente de conteo (consulta = scoring = dashboard), con variante Prisma para filtros server-side.
- **FR-005**: La consulta pública excluye SPAM/OTRO del conteo y de las categorías mostradas; multi-conducta ordenada por gravedad.
- **FR-006**: Respuesta de consulta sin `nivelRiesgo` ni score; señal descriptiva por umbral parametrizable (`visibility.actividad_alta_min` o similar, seed).
- **FR-007**: Ubicación anónimo = rollup por país; autenticado = departamento/ciudad.
- **FR-008**: Seguimiento muestra las conductas propias sin ocultamiento; "gracias por reportar".
- **FR-009**: ComiteSubNav estable y AdminNav con un solo ítem activo (match más largo).
- **FR-010**: Migraciones aditivas; severidad/umbrales/modelo desde parámetros; tests de cada regla.

## Success Criteria

- **SC-001**: Un identificador con 2 reportes SPAM + 1 CLASIFICADO con riesgo cuenta 1 en consulta, scoring y dashboard (antes: 3 en consulta).
- **SC-002**: OTRO unánime con confianza 1.0 → REVISION_MANUAL (test).
- **SC-003**: Ranking: SOLICITUD_ENCUENTRO(2 votos) > CONTACTO_INSISTENTE(3 votos) (test).
- **SC-004**: Cero `nivelRiesgo`/score en la respuesta de `/api/consulta` y en la UI pública.
- **SC-005**: Gate completo + app en `:5005` + push con staging explícito del 002.
