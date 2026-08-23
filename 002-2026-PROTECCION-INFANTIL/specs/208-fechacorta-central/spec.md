# SPEC-208 — fechaCorta helper central + timezone Bogotá (002-PI-141)

> Status: `PLANEADO`
> PI: 002-PI-141
> Responsable: ODIN
> Rama: `work/002-PI-140-142-lote-parches`
> Base: `feature/001-scaffolding`

## Contexto

PR #83 (SPEC-205) replicó `fechaCorta(iso)` copy-paste en 6+ componentes de detalle de usuario, ninguno con `timeZone: "America/Bogota"`. Esto introduce regresión D-72: fechas mostradas en TZ del navegador en lugar de Bogotá.

Esta SPEC centraliza el helper y migra las copias existentes para eliminar la regresión y prevenir futuras divergencias.

## User Stories

| ID | User Story | Priority |
|---|---|---|
| US-001 | Como desarrollador, quiero un único helper de fechas, para no repetir lógica ni timezones. | Must |
| US-002 | Como admin, quiero ver fechas de usuarios en timezone Bogotá, para coherencia con operación local. | Must |
| US-003 | Como desarrollador, quiero que el helper funcione en cliente y servidor, para usarlo en UI y emails. | Must |

## Acceptance Scenarios

### AS-001 · Helper central existe
**Given** un módulo `src/lib/format/fecha.ts`  
**When** se importa `fechaCorta`, `fechaHora` o `fechaISO`  
**Then** devuelven strings formateados con `timeZone: "America/Bogota"`.

### AS-002 · Input nulo o inválido
**Given** input `null`, `undefined` o string no ISO  
**When** se llama a cualquier helper  
**Then** devuelve `"—"`.

### AS-003 · Reemplazo de copias
**Given** los componentes de detalle de usuario y otros sitios con `fechaCorta` local  
**When** se migra al helper central  
**Then** `grep -rn "function fechaCorta" src/app/ src/components/` devuelve cero ocurrencias fuera del helper.

### AS-004 · TZ Bogotá verificada
**Given** una fecha ISO conocida  
**When** se formatea con `fechaCorta`  
**Then** el resultado coincide con `Intl.DateTimeFormat("es-CO", {timeZone:"America/Bogota"}).format(new Date(iso))`.

## Functional Requirements

- **FR-001**: Debe crearse `src/lib/format/fecha.ts` con tres funciones:
  - `fechaCorta(iso: string | null | undefined): string` → "22 ago 2026".
  - `fechaHora(iso: string | null | undefined): string` → "22 ago 2026 · 15:30".
  - `fechaISO(iso: string | null | undefined): string` → "2026-08-22" (para `datetime`).
- **FR-002**: Todas las funciones DEBEN usar `timeZone: "America/Bogota"` y locale `es-CO`.
- **FR-003**: Todas las funciones DEBEN devolver `"—"` para input `null`/`undefined`/inválido.
- **FR-004**: Deben reemplazarse las copias locales de `fechaCorta` en los componentes listados en el brief (y otros detectados por grep).
- **FR-005**: Debe usarse `Intl.DateTimeFormat` para compatibilidad cliente/servidor.
- **FR-006**: No se DEBE modificar el schema Prisma ni crear migraciones.

## Non-Functional Requirements

- **NFR-001**: Gate local completo verde.
- **NFR-002**: Zero regressión visual: fechas mostradas deben ser idénticas o más coherentes que antes.

## Success Criteria

- **SC-001**: `grep -rn "function fechaCorta" src/app/ src/components/` devuelve cero ocurrencias fuera de `src/lib/format/fecha.ts`.
- **SC-002**: `grep -rn "toLocaleDateString.*es-CO" src/` devuelve solo llamados desde `src/lib/format/fecha.ts` o excepciones justificadas.
- **SC-003**: Test unitario cubre null/undefined/inválido/válido + TZ Bogotá.
- **SC-004**: UI de `/dashboard/admin/usuarios/[id]/*` muestra fechas en TZ Bogotá.
- **SC-005**: CI 6/6 verde en el PR del lote.

## Assumptions

- `Intl.DateTimeFormat` está disponible en Node.js 22 y navegadores objetivo.
- Los componentes a migrar son client components o server components que pueden importar utilidades de `src/lib/`.

## Decisiones propuestas para compuerta §4

1. **Módulo `src/lib/format/fecha.ts`**: ubicación central para helpers de formato de fecha/hora.
2. **TZ America/Bogota por defecto**: evita regresión D-72 y mantiene coherencia operativa.
3. **Tres helpers mínimos**: corta, hora, ISO — cubren 100% de usos actuales sin over-engineering.

## Impacto en arquitectura:

- Nuevo archivo `src/lib/format/fecha.ts`.
- Modificación de componentes de detalle de usuario y otros sitios con `fechaCorta` duplicada.
- Nuevo test unitario `src/lib/format/fecha.test.ts`.
- No se toca schema, motor ni lógica de negocio.

## Deuda Técnica

- Ninguna identificada en fase de diseño.
