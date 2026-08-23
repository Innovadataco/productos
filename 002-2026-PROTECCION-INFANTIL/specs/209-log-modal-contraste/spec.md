# SPEC-209 — LogContextoModal contraste (002-PI-142)

> Status: `PLANEADO`
> PI: 002-PI-142
> Responsable: ODIN
> Rama: `work/002-PI-140-142-lote-parches`
> Base: `feature/001-scaffolding`

## Contexto

Tras deploy `5d69eaaf`, en `/dashboard/admin/estadisticas/operacion?tab=logs` → "Ver contexto", el bloque de mensaje humano se ve mal: fondo gris tenue + letra oscura = contraste bajo en modo claro.

Esta SPEC cierra I-103 invirtiendo la paleta del bloque humano a la misma del bloque JSON expandido debajo: fondo tinta oscuro + texto claro.

## User Stories

| ID | User Story | Priority |
|---|---|---|
| US-001 | Como admin, quiero leer el mensaje humano del contexto de logs sin forzar la vista, en modo claro y oscuro. | Must |
| US-002 | Como CEO, quiero coherencia visual entre los dos bloques del modal (humano + JSON). | Should |

## Acceptance Scenarios

### AS-001 · Contraste en modo claro
**Given** el modal "Ver contexto" abierto en modo claro  
**When** se renderiza el bloque humano  
**Then** el fondo es oscuro (`bg-tinta/90`) y el texto claro (`text-fondo`), con contraste WCAG AA ≥4.5:1.

### AS-002 · Coherencia con bloque JSON
**Given** el modal muestra bloque humano y bloque JSON expandido  
**When** se comparan visualmente  
**Then** ambos usan paleta tinta oscura + texto claro.

### AS-003 · Sin cambio de lógica
**Given** el modal con la nueva paleta  
**When** se abre "Ver contexto"  
**Then** la humanización y las reglas del log no cambian.

## Functional Requirements

- **FR-001**: En `src/components/modules/monitoreo/LogContextoModal.tsx` L111-112, el bloque humano DEBE usar:
  - `bg-tinta/90 p-4 dark:bg-tinta/95`
  - `text-sm font-medium text-fondo`
- **FR-002**: No se DEBE modificar el bloque JSON expandido.
- **FR-003**: No se DEBE modificar la lógica de humanización ni las reglas.
- **FR-004**: No se DEBE modificar el schema Prisma ni crear migraciones.

## Non-Functional Requirements

- **NFR-001**: Gate local completo verde.
- **NFR-002**: Mantener sistema visual: vidrio Apple + Instrument + radios 16/12/22.

## Success Criteria

- **SC-001**: Modal muestra mensaje humano legible en modo claro (contraste WCAG AA mínimo 4.5:1).
- **SC-002**: Modal muestra mensaje humano legible en modo oscuro.
- **SC-003**: Screenshot antes/después en `cierre.md`.
- **SC-004**: Test visual mínimo verifica clases CSS aplicadas.
- **SC-005**: CI 6/6 verde en el PR del lote.

## Assumptions

- Las clases `bg-tinta/90`, `dark:bg-tinta/95` y `text-fondo` existen en el sistema de diseño.
- El componente `LogContextoModal.tsx` ya renderiza el mensaje humano en L111-112.

## Decisiones propuestas para compuerta §4

1. **Invertir a paleta tinta oscura**: misma aproximación que el bloque JSON expandido, crea tarjeta oscura de 2 bloques con buena jerarquía.
2. **Cambio mínimo (1 archivo, ~3 líneas)**: sin refactor ni cambio de lógica.

## Impacto en arquitectura:

- Modificación de `src/components/modules/monitoreo/LogContextoModal.tsx`.
- Test visual opcional de clases CSS.
- Screenshot antes/después en `cierre.md`.
- No se toca schema, motor ni lógica de negocio.

## Deuda Técnica

- Ninguna identificada en fase de diseño.
