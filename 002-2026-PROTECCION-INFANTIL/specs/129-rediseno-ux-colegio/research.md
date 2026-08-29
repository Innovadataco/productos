# Research: SPEC-129 — Rediseño de UX del panel del colegio

**Date**: 2026-08-01 | **Spec**: [spec.md](spec.md)

## Estado actual (verificado en fuente)

| Punto | Hoy | Problema |
|---|---|---|
| Aterrizaje post-login | `login/page.tsx:35` ya envía SCHOOL_ADMIN → `/dashboard/colegio` | Correcto; falta test que lo guarde |
| Logo en zona autenticada | `NavHeader.tsx` → `/dashboard/colegio` | Correcto |
| Logo en zona PÚBLICA | `NavHeader.tsx` → `/` para todos (SPEC-106, I-38: el logo no secuestra) | El colegio "cae" al home público de reportar (queja del CEO) |
| Home `/dashboard/colegio` | Ficha del colegio + tarjetas de acceso | No tiene la consulta ni estadísticas (viven en `/dashboard-publico`) |
| Navegación | `ColegioNav` tabs horizontales + acciones sueltas | Inconsistente con AdminNav; duplicaba "Cambiar contraseña" (C7, ya corregido en PARTE A) |
| Cursos/Alumnos | Pantallas separadas por acción | Demasiados clicks para gestiones frecuentes |
| Alertas | Lógica SPEC-077 correcta | Estado vacío sin explicación; sin estados visibles |
| Auditoría | Filas con metadatos técnicos/JSON | Ilegible para un rector |

## Decisiones y alternativas

- **Logo del colegio en zona pública → su panel.** Alternativa evaluada: dejar `/` (SPEC-106).
  Descartada: SPEC-106 protegía a los roles INTERNOS (que sí usan la app pública para
  reportar/probar); el colegio NO reporta con su cuenta institucional (la puerta se lo
  niega), así que el home público no es su destino útil. El cambio es acotado a
  SCHOOL_ADMIN; los demás roles conservan el comportamiento SPEC-106.
- **`/dashboard/colegio/estadisticas`: subsección o absorción.** El menú lateral la
  conserva como entrada (el contenido de `/dashboard-publico` se integra en la home y la
  subpágina puede quedar como vista ampliada). Decisión final en implementación con el
  mockup; en ambos casos se comparte el componente, no se duplica.
- **Acciones en línea con modales de SPEC-124** (`Modal`, `Tabla`, `Button`) en vez de
  pantallas nuevas: menor superficie visual nueva y cumple "menos clicks".
- **Mapa acción→frase declarativo para auditoría** (sin infraestructura de i18n): una
  tabla en el client component; los eventos no mapeados caen en "Detalle técnico"
  colapsado, nunca JSON inline.

## Riesgos y mitigaciones

- **Tocar `NavHeader.tsx`** (componente compartido por todos los roles): cambio acotado
  a la rama SCHOOL_ADMIN del logo + tests por rol para los demás destinos.
- **Duplicar lógica de `/dashboard-publico`**: se reusan componentes/exports, no se copia.
- **Romper guards de módulo**: las páginas conservan `verificarAccesoPagina`; el menú
  usa el mismo filtro D-41 que hoy (módulo ∧ predicado).
