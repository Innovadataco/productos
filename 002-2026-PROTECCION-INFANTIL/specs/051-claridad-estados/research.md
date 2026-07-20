# Research: Claridad y estados

**Date**: 2026-07-20
**Feature**: specs/051-claridad-estados/spec.md

---

## Decisions

### D1: Componentes estándar en `src/components/ui/`

**Decision**: Crear `EmptyState.tsx` y `ErrorState.tsx` en `src/components/ui/` para que sean reutilizables por todos los módulos.

**Rationale**: La convención del proyecto (constitución §7.1, plan.md de specs anteriores) ubica componentes genéricos en `src/components/ui/` y módulos de dominio en `src/components/modules/`. Centralizar los estados evita duplicar estilos y mensajes inconsistentes.

**Components**:
- `ErrorState`: título, descripción, botón de acción (por defecto "Reintentar"), callback `onRetry` y prop opcional `action`.
- `EmptyState`: título, descripción e ícono/acción opcional.

### D2: Sin dependencias nuevas

**Decision**: No instalar librerías de UI ni iconos adicionales; usar SVG inline y Tailwind CSS.

**Rationale**: El stack ya usa Tailwind y componentes propios. Agregar una librería de iconos aumenta la superficie de mantenimiento sin valor agregado para un componente de estados. Los iconos son simples ilustraciones inline.

### D3: Sin cambios de API ni base de datos

**Decision**: El spec es puramente de presentación; no se crean endpoints ni migraciones.

**Rationale**: Los requisitos hablan de copy, componentes de estado y jerarquía visual. No hay entidades nuevas ni cambios de permisos. Esto minimiza el riesgo y respeta la regla de migraciones aditivas/no destructivas.

### D4: Jerarquía visual sin rediseño

**Decision**: Aplicar mejoras de espaciado, encabezados y separación de secciones sin cambiar la estructura de datos ni las acciones disponibles.

**Rationale**: El objetivo es claridad, no un rediseño. Se respetan los flujos existentes, los permisos y la ubicación de los controles. Se prioriza el impacto en pantallas densas: dashboard admin, operadores y comité.

### D5: Microcopy empático sin violar principios del producto

**Decision**: Revisar textos para que sean descriptivos, no culpantes y orientados a la acción, manteniendo los requisitos legales de canales oficiales y la distinción "reporte informativo vs denuncia formal".

**Rationale**: La constitución §1.3 exige presunción de inocencia y §1.2/§7.3 requieren visibilidad de canales oficiales. El nuevo copy debe reforzar estos principios, no debilitarlos.

---

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Crear un solo componente `StateCard` con modo `error`/`empty` | Menos explícito para los desarrolladores; preferimos dos componentes con nombres claros |
| Usar `lucide-react` para iconos | Agrega dependencia; iconos inline son suficientes |
| Cambiar la estructura de carpetas de `src/components/modules` | Fuera de alcance; no se rediseñan flujos |
| Internacionalizar el copy ahora | No hay requisito de multi-idioma en este spec; se mantiene es-CO |

---

## Open Questions (0 remaining)

All resolved. El alcance queda restringido a componentes de estado, copy y espaciado visual.

