# Research: SPEC-128 — Reconciliación de grants del comité

**Date**: 2026-07-29 | **Spec**: [spec.md](spec.md)

## Defecto de coherencia (verificado en fuente por ZEUS, D-43)

- `prisma/seed.ts:1265`: `COMITE_VALIDACION: ["comite", "comite_bandeja", "comite_auditoria"]`.
- `src/lib/nav-items.ts:29-30`: módulo `comite` → tab "Gestión" (`/dashboard/admin/comite/gestion`);
  módulo `comite_auditoria` → tab "Auditoría" (`/dashboard/admin/comite/auditoria`).
- `src/lib/proxy.ts:163`: `ADMIN_ONLY_ROUTES = ["/dashboard/admin/comite/gestion",
  "/dashboard/admin/comite/auditoria"]` — la puerta niega ambas al comité (y el E2E
  `aislamiento.test.ts` lo garantiza: "el comité no se autogestiona").
- Resultado: el seed dice SÍ donde la puerta dice NO. Desde D-41 las tabs ya no se pintan
  (módulo ∧ `esDestinoPermitidoPorRol`), así que el grant es inerte HOY, pero el default
  distribuido sigue contradictorio: cualquier consumidor futuro del eje de módulos que
  olvide el predicado repetiría el fallo de `ComiteSubNav` (I-39).
- Registro honesto (D-43): esto es **limpieza + defensa en profundidad, no un fix de
  seguridad**. No cambia lo que un usuario ve ni alcanza.

## Contexto de decisiones

- **D-41** (vigente en su núcleo): ningún menú decide permisos por su cuenta; módulo ∧
  predicado en TODA navegación; Aserción B como guardián, sin allowlist. Esta spec no toca
  navegación.
- **D-43** (2026-07-29, CEO): reconciliar el eje `PermisoModulo` ↔ rutas para
  COMITE_VALIDACION. **Supersede la cláusula final de D-41** ("no se toca el seed ni se
  reconcilia"). La recomendación de ZEUS era no reconciliar; el CEO decidió reconciliar.

## Decisión

`clavesPorRol.COMITE_VALIDACION = ["comite_bandeja"]` — literal de la D-43.

## Alternativas consideradas

| Alternativa | Veredicto | Motivo |
|---|---|---|
| Retirar los 2 grants del default (D-43) | **Elegida** | Es la decisión vinculante; mínima; no destructiva |
| Borrar los módulos `comite`/`comite_auditoria` del catálogo | Descartada | ADMIN los sigue usando; rompería su navegación |
| Dejarlo como está (postura original de ZEUS) | Descartada | El CEO decidió reconciliar (D-43 supersede D-41 en esa cláusula) |
| Abrir las rutas gestión/auditoría al comité | Descartada | Fuga de privilegio: "el comité no se autogestiona" es invariante de seguridad |
| Que el seed revoque en BD existentes | Descartada | Backfill destructivo: cambia la semántica del seed y excede el candado |

## Riesgos y mitigaciones

- **Deriva silenciosa de BD vivas**: el cambio solo gobierna BD fresca → FR-004: propuesta
  documentada (Opciones A/B/C en plan.md), decisión de ZEUS en compuerta, nada se ejecuta
  sin aprobación.
- **Regeneración obligatoria**: `02-roles-capacidades.md` refleja el seed → se regenera en
  el mismo commit o `arch:check` falla en CI.
- **Recaída de la Aserción B**: no se añade allowlist; los hrefs que el comité ve ya están
  filtrados por D-41 y no cambian.
