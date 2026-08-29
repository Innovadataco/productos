# SPEC-005 · research.md

## D4 · Verificación estructural PI vs BI

Ejecutado: `find .specify -type f | sort` en ambos repos. Diff completo:

```diff
diff /tmp/pi-specify.txt /tmp/bi-specify.txt
1,18c1,29
< ../002-2026-PROTECCION-INFANTIL/.specify/feature.json
< ../002-2026-PROTECCION-INFANTIL/.specify/init-options.json
< ../002-2026-PROTECCION-INFANTIL/.specify/integration.json
< ../002-2026-PROTECCION-INFANTIL/.specify/integrations/cline.manifest.json
< ../002-2026-PROTECCION-INFANTIL/.specify/integrations/speckit.manifest.json
< ../002-2026-PROTECCION-INFANTIL/.specify/memory/constitution.md
< ../002-2026-PROTECCION-INFANTIL/.specify/scripts/bash/check-prerequisites.sh
< ../002-2026-PROTECCION-INFANTIL/.specify/scripts/bash/common.sh
< ../002-2026-PROTECCION-INFANTIL/.specify/scripts/bash/create-new-feature.sh
< ../002-2026-PROTECCION-INFANTIL/.specify/scripts/bash/setup-plan.sh
< ../002-2026-PROTECCION-INFANTIL/.specify/scripts/bash/setup-tasks.sh
< ../002-2026-PROTECCION-INFANTIL/.specify/templates/checklist-template.md
< ../002-2026-PROTECCION-INFANTIL/.specify/templates/constitution-template.md
< ../002-2026-PROTECCION-INFANTIL/.specify/templates/plan-template.md
< ../002-2026-PROTECCION-INFANTIL/.specify/templates/spec-template.md
< ../002-2026-PROTECCION-INFANTIL/.specify/templates/tasks-template.md
< ../002-2026-PROTECCION-INFANTIL/.specify/workflows/speckit/workflow.yml
< ../002-2026-PROTECCION-INFANTIL/.specify/workflows/workflow-registry.json
---
> .specify/feature.json
> .specify/init-options.json
> .specify/integration.json
> .specify/integrations/cline.manifest.json
> .specify/integrations/speckit.manifest.json
> .specify/memory/constitution.md
> .specify/scripts/bash/check-prerequisites.sh
> .specify/scripts/bash/common.sh
> .specify/scripts/bash/create-new-feature.sh
> .specify/scripts/bash/setup-plan.sh
> .specify/scripts/bash/setup-tasks.sh
> .specify/specs/001-scaffolding-nextjs-auth/plan.md
> .specify/specs/001-scaffolding-nextjs-auth/research.md
> .specify/specs/001-scaffolding-nextjs-auth/spec.md
> .specify/specs/001-scaffolding-nextjs-auth/tasks.md
> .specify/specs/002-docker-compose-replica-pg-logical/plan.md
> .specify/specs/002-docker-compose-replica-pg-logical/research.md
> .specify/specs/002-docker-compose-replica-pg-logical/spec.md
> .specify/specs/002-docker-compose-replica-pg-logical/tasks.md
> .specify/specs/005-regularizacion-spec-kit/plan.md
> .specify/specs/005-regularizacion-spec-kit/spec.md
> .specify/specs/005-regularizacion-spec-kit/tasks.md
> .specify/templates/checklist-template.md
> .specify/templates/constitution-template.md
> .specify/templates/plan-template.md
> .specify/templates/spec-template.md
> .specify/templates/tasks-template.md
> .specify/workflows/speckit/workflow.yml
> .specify/workflows/workflow-registry.json
```

### Análisis del diff

| Concepto | PI | BI |
|---|---|---|
| Infraestructura Spec Kit (17 archivos) | ✅ | ✅ (copiada en D1) |
| `specs/` folder con specs | No comparado (PI tiene 086+) | 3 specs · 11 archivos |
| `feature.json` adaptado | `086-navegacion-gobernada-permisos` | `005-regularizacion-spec-kit` ✅ |

**Conclusión:** La infraestructura de BI es paridad exacta con PI. Las diferencias son solo los archivos de specs propios de BI (SPEC-001, SPEC-002, SPEC-005), que es lo esperado. SPEC-005 research.md aparecerá en el find final una vez commiteado.

---

## Lección · I-02 · Por qué el Spec Kit no estaba inicializado

SPEC-001 fue implementado correctamente en código. El Spec Kit oficial (infraestructura `.specify/`) nunca fue copiado de PI. La sesión anterior (BI-DEV-1) asumió que el Spec Kit se inicializaba solo o que el formato monolítico era equivalente. No lo era.

**Corrección en SPEC-005:** copiar los 17 archivos de infraestructura de PI, adaptar `feature.json`, reescribir SPEC-001 y SPEC-002 al formato oficial (4 archivos por carpeta), eliminar monolíticos.

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 madrugada COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
