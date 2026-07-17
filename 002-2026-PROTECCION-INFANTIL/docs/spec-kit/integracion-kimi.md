# Integración Spec-Kit para Kimi Code CLI

> Fecha: 2026-07-18.
> Estado: **no existe integración nativa de Kimi en Spec-Kit**. El proyecto usa la integración `cline` de Speckit. Este documento define el procedimiento oficial de workaround para operar con Kimi Code CLI.

## 1. Qué hay en el proyecto hoy

El directorio `.specify/` contiene la configuración de **Speckit** (no el paquete npm `specify` de design tokens):

- `.specify/integration.json` declara la integración activa: `cline`.
- `.specify/integrations/speckit.manifest.json` y `.specify/integrations/cline.manifest.json` registran los archivos instalados.
- `.specify/workflows/workflow-registry.json` expone el workflow `speckit` (ciclo SDD completo).
- `.specify/templates/` contiene las plantillas oficiales (`spec-template.md`, `plan-template.md`, `tasks-template.md`, `checklist-template.md`, `constitution-template.md`).
- `.specify/scripts/bash/` contiene scripts auxiliares para crear features (`create-new-feature.sh`), plan, tareas y prerequisitos.
- `.clinerules/workflows/` contiene los workflows de Cline (`speckit-specify.md`, `speckit-plan.md`, `speckit-implement.md`, etc.).

## 2. Verificación realizada

Se intentó ejecutar el comando conocido para instalar una integración de Kimi:

```bash
npx specify integration install --ai kimi
```

Resultado: el paquete `specify@1.3.0` que descarga npm **no es Speckit**; es una herramienta de design tokens sin subcomando `integration install` ni soporte para Kimi. No se instaló nada en el proyecto.

Tampoco existe un paquete `speckit` publicado ni binario local en `node_modules/.bin/`.

## 3. Procedimiento oficial de workaround para Kimi

Dado que Kimi Code CLI no interpreta los slash commands de Cline (`.clinerules/workflows/speckit-*.md`), el operador debe usar los **archivos de plantilla y los scripts de Speckit** de forma manual.

### 3.1 Crear una nueva spec

Opción A — script de Speckit:

```bash
cd /Users/idc/productos/INNOVADATACO/002-2026-PROTECCION-INFANTIL
bash .specify/scripts/bash/create-new-feature.sh \
  --short-name "nombre-feature" \
  "Descripción corta de la feature"
```

Esto crea `specs/NNN-nombre-feature/spec.md` a partir de `.specify/templates/spec-template.md` y actualiza `.specify/feature.json`.

Opción B — manual:

1. Elegir el siguiente número disponible en `specs/` (o consultar `.specify/init-options.json` para `feature_numbering`).
2. Crear `specs/NNN-nombre-feature/`.
3. Copiar `.specify/templates/spec-template.md` a `specs/NNN-nombre-feature/spec.md`.
4. Escribir el contenido siguiendo las secciones obligatorias: User Scenarios & Testing, Requirements, Success Criteria, Assumptions.
5. Crear `specs/NNN-nombre-feature/checklists/requirements.md` a partir de `.specify/templates/checklist-template.md`.

### 3.2 Pasar a plan / tareas / implementación

Los workflows de Cline (`speckit-plan.md`, `speckit-tasks.md`, `speckit-implement.md`) contienen las instrucciones de calidad. En Kimi se usan como **guías de referencia**: el agente debe leer el workflow correspondiente antes de generar el artefacto siguiente.

| Fase | Workflow de referencia | Artefacto a producir |
|------|------------------------|----------------------|
| Especificar | `.clinerules/workflows/speckit-specify.md` | `specs/NNN-feature/spec.md` + `checklists/requirements.md` |
| Planificar | `.clinerules/workflows/speckit-plan.md` | `specs/NNN-feature/plan.md` |
| Tareas | `.clinerules/workflows/speckit-tasks.md` | `specs/NNN-feature/tasks.md` |
| Implementar | `.clinerules/workflows/speckit-implement.md` | código + tests |
| Convergencia | `.clinerules/workflows/speckit-converge.md` | reporte de cierre |

### 3.3 Actualizar el índice maestro

Después de cerrar una spec:

1. Agregarla a [`specs/README.md`](../../specs/README.md).
2. Actualizar [`docs/spec-kit/cumplimiento.md`](./cumplimiento.md) con artefactos y estado.

## 4. Si en el futuro se desea una integración nativa de Kimi

Se podría agregar sin modificar código fuente de la app:

1. Crear `.specify/integrations/kimi.manifest.json` con la lista de archivos a instalar.
2. Crear workflows equivalentes a los de Cline bajo `.kimi/tasks/` o el directorio que soporte Kimi Code CLI.
3. Actualizar `.specify/integration.json` para incluir `kimi` en `installed_integrations` y como `default_integration` si se desea.
4. Documentar los comandos o prompts que disparen cada workflow.

> Hasta que esto ocurra, el procedimiento oficial es el workaround manual descrito en la sección 3.
