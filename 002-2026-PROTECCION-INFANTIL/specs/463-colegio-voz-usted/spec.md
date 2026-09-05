# SPEC-463 · La voz del colegio a «usted» (D-107 de Jelkin)

**Status**: IMPLEMENTADO (pendiente certificación de Diseño)
**Fecha**: 2026-09-04 · **Dev**: PI-1 (`idc-32`) · **Origen**: decisión de Jelkin (D-107) sobre la voz del rector. Autoridad de forma: **Diseño certifica**. Desbloquea el copy del colegio en pausa (SPEC-462).

## Para qué

El Sistema de Diseño §2 fija la voz por audiencia: el **rector habla de «usted» cálido** (registro profesional), el **padre de «tú»**. El copy del colegio tenía tuteo heredado. Esta spec lo migra a usted. Solo texto — no toca conducta ni color.

## Qué se hizo

- Migrado el copy del territorio colegio de **tú → usted** en ~20 archivos (home del rector, cursos, profesores, alumnos, materias, alertas, comité, auditoría, estadísticas, onboarding, suscripción, wizard de carga). Posesivos (tu→su, tus→sus) y verbos (imperativo y presente) a su forma en usted: «su colegio», «sus estudiantes», «Gestione», «Cree», «Agregue», «Complete», «Revise», «Active su protección», «Su plan vence… Renueve», «Completó la configuración», «Arrastre su Excel o haga clic».
- **El PARENT no se toca**: conserva su «tú» cálido (decisión de Jelkin).
- Tests de componentes del colegio que afirmaban el copy viejo, actualizados a usted (HeroEstado, HomeRectorPage, EmptyStateColegio, FranjaVigilancia, ImportExcel, WizardUnificado, ProfesoresPageClient, SeccionMateriasCurso).

## Candados

- **`src/app/dashboard/colegio/voz-usted.candado.test.ts`** (2 tests):
  - Ninguna pantalla del colegio (app + components) trae tuteo (`tu`/`tus`/`tú`/`tuyo`/`contigo`), comentarios excluidos.
  - **Contraprueba**: el área del padre conserva su «tú» (el candado no la toca; si alguien migra al padre a usted por error, cae).
  - Verificado por mutación: reintroducir «tu colegio» hace caer el primero.

## Impacto en arquitectura:

- Cierra la inconsistencia de voz del colegio (familia de I-250: consistencia dentro de cada audiencia). El registro por audiencia queda: padre = tú, rector = usted, interno = técnico.
- Solo texto: `tokens:check` no se mueve (1038) — no entra en la cadena de serialización del piso de color.

## Certificación

La da **Diseño** (voz coherente en el territorio del colegio). Verde en CI no cierra un rediseño.

## Referencias

- **D-107** (Jelkin, voz del rector a usted) · Sistema de Diseño §2 (voz por audiencia) · **SPEC-462** (copy del colegio que esto desbloquea).
- Patrón del candado de voz: SPEC-434/437.
- Worktree `.worktrees/pi-SPEC-463` desde `origin/main f7c61ec5e`.
