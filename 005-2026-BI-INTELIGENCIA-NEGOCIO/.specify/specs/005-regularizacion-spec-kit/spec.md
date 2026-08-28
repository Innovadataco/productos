# SPEC-005 · Regularización Spec Kit oficial + reconstrucción SPEC-002

## Metadatos

| Campo | Valor |
|---|---|
| **SPEC** | 005 |
| **Nombre** | regularizacion-spec-kit |
| **Origen** | BI · INSTRUCTIVO-005 · F3C 2026-08-28 madrugada COT |
| **Brief** | BI · A-03 |
| **Cierra** | I-02 · I-04 · I-05 · I-07 |
| **Deja abierta** | I-01 (Fase 2) · I-06 (SPEC-003) |
| **Prioridad** | 🔴 Alta · desbloquea cola BI |
| **Estado** | ⏳ spec+plan listo · esperando REVISO |
| **Autor** | bi-dev-2 (Desarrollo BI) |

---

## Objetivo

Regularizar la estructura Spec Kit oficial en el repo BI **sin tocar código de producto**. El código en `src/`, `scripts/`, `tests/` y configs ya está correcto en `23c5100e`. Solo se trabaja en `.specify/`.

Resultado esperado: repo BI con Spec Kit oficial inicializado, SPEC-001 reescrita en formato oficial (post-mortem), SPEC-002 reescrita desde cero con Spec Kit, y esta SPEC-005 en formato auto-referencial como primera SPEC en el nuevo formato.

---

## Contexto

**Problema (I-02):** El Spec Kit oficial no fue inicializado en el repo BI. Faltan:
- `.specify/scripts/bash/` (5 scripts)
- `.specify/templates/` (5 templates)
- `.specify/workflows/` (1 yml + 1 json)
- `.specify/integrations/` (2 manifests)
- `.specify/integration.json`, `.specify/feature.json`, `.specify/init-options.json`

Las SPECs existentes están en formato monolítico (`SPEC-001-name.md`) en lugar de la estructura oficial (`NNN-name/spec.md + plan.md + tasks.md + research.md`).

**Problema (I-04):** SPEC-002 spec+plan fue escrito por BI-DEV-1, revisado por Fábrica (R-008), pero nunca commiteado. Se perdió en la desalineación operativa.

**Problema (I-05):** Compuerta §4 de SPEC-001 sin rastro documental completo.

**Problema (I-07):** `tasks.md` de SPEC-001 tiene el Paso 15 marcado `[ ]` pero el código SÍ está commiteado.

**Decisión Jelkin (Opción A en R-009):** Alineación total con Spec Kit oficial. No se busca workaround.

---

## Alcance

### D1 · Inicializar Spec Kit oficial

Copiar 17 elementos de PI (`.specify/` de `002-2026-PROTECCION-INFANTIL`) al repo BI:

| Componente | Fuente PI | Destino BI |
|---|---|---|
| `scripts/bash/*.sh` (5 archivos) | `.specify/scripts/bash/` | `.specify/scripts/bash/` |
| `templates/*.md` (5 archivos) | `.specify/templates/` | `.specify/templates/` |
| `workflows/speckit/workflow.yml` | idem | idem |
| `workflows/workflow-registry.json` | idem | idem |
| `integrations/cline.manifest.json` | idem | idem |
| `integrations/speckit.manifest.json` | idem | idem |
| `integration.json` | `.specify/` raíz | `.specify/` raíz |
| `feature.json` | `.specify/` raíz | `.specify/` raíz (adaptado a BI) |
| `init-options.json` | `.specify/` raíz | `.specify/` raíz |

**NO copiar:**
- `.specify/specs/*` de PI (son SPECs de PI · no aplican a BI)
- `.specify/memory/constitution.md` de PI (BI ya tiene la propia sincronizada)
- `.specify/.DS_Store`

Adaptar referencias específicas a PI en los archivos copiados. Documentar cambios en `research.md`.

### D2 · Reescribir SPEC-001 en formato oficial (post-mortem · código intacto)

Crear `.specify/specs/001-scaffolding-nextjs-auth/` con 4 archivos:
- `spec.md` · `plan.md` · `tasks.md` · `research.md`

Fuente: los 3 monolíticos actuales (`SPEC-001-scaffolding-nextjs-auth.md` + `SPEC-001-tasks.md` + `SPEC-001-cierre.md`). El código de producto (`src/`, `scripts/`, `tests/`) NO se toca.

Después de reorganizar: eliminar los 3 monolíticos viejos.

**tasks.md de SPEC-001:** Paso 15 marcado ✅ (el código está en `23c5100e`). Cierra I-07.

**research.md de SPEC-001:** documenta I-02 · I-03 (corrección honesta CEO) · I-05 (compuerta §4 retro). Cierra I-05.

### D3 · Reescribir SPEC-002 desde cero con Spec Kit oficial

Crear `.specify/specs/002-docker-compose-replica-pg-logical/` con 4 archivos.

Fuente técnica: INSTRUCTIVO-002 + enmienda `1eaa214`. Los 2 tests obligatorios de la enmienda van en `tasks.md` como tareas sin marcar (implementación aún pendiente).

**Fuera de alcance de SPEC-005:** implementar SPEC-002 real (eso es INSTRUCTIVO-002 después).

### D4 · Verificación estructural PI vs BI

```bash
find .specify -type f | sort > /tmp/bi-specify.txt
find ../002-2026-PROTECCION-INFANTIL/.specify -type f | sort > /tmp/pi-specify.txt
diff /tmp/pi-specify.txt /tmp/bi-specify.txt
```

Diferencias esperadas: BI no tiene specs de PI · BI tiene 001/002/005 · posible `feature.json` adaptado.

---

## Fuera de alcance

- Código de producto (`src/` · `scripts/` · `tests/` · configs) → NO tocar
- Implementar SPEC-002 real (Docker Compose · réplica pg_logical) → INSTRUCTIVO-002 después
- Cambiar `CONSTITUTION.md` con candados 16/17/18 → CEO post-CUMPLE
- SPEC-003 (Superset+Vanna+Ollama) · SPEC-004 (Bot Telegram) → cola normal
- BRIEF-A-02 (dashboards Superset MVP) → congelado

---

## Candados aplicables

| Candado | Aplicación |
|---|---|
| 14 · verificación en vivo | Verificación estructural `find .specify -type f` antes de REALIZADO |
| 15 · verificar en fuente | Leer `feature.json` y `init-options.json` de PI antes de copiar |
| 17 (nuevo informal) | spec+plan commiteado ANTES de implementar (este archivo ya es prueba) |
| 18 (nuevo informal) | Sesión documenta estado limpio al cerrar |

---

## Criterios de aceptación (Fábrica BI-2 verifica en CUMPLE)

Ver BRIEF-A-03 §5 y INSTRUCTIVO-005 §6 para lista completa de 17 criterios.

Resumen:
- `find .specify/scripts/bash -type f` devuelve 5 archivos
- `find .specify/templates -type f` devuelve 5 archivos
- `.specify/feature.json`, `.specify/init-options.json`, `.specify/integration.json` existen y son JSON válido
- `.specify/specs/001-scaffolding-nextjs-auth/` con 4 archivos
- `.specify/specs/002-docker-compose-replica-pg-logical/` con 4 archivos
- `.specify/specs/005-regularizacion-spec-kit/` con 4 archivos (esta SPEC · auto-referencial)
- `.specify/specs/SPEC-001-*.md` (3 monolíticos) eliminados
- `git diff HEAD -- src/` muestra CERO cambios
- `bash scripts/ratchets/run-all.sh` → 4/4 verdes

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 madrugada COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
| **Estado** | ⏳ spec+plan listo · esperando REVISO Fábrica BI-2 |
