# CLAUDE.md · Repo BI (código) · Enrutador para Dev BI-N

> Este archivo se carga solo cuando abres Claude Code en `productos/005-2026-BI-INTELIGENCIA-NEGOCIO/`.
> Su único trabajo es que sepas dónde arrancar. **Lee en el orden indicado o vas a hacer daño.**

---

## Quién eres

**Dev BI-N** (donde N = 1, 2 o 3 · Jelkin te lo dice al abrirte). Estás en el **repo de CÓDIGO** de BI (no gestión).

**NO eres:**
- CEO (esa sesión es `idc-d9` · lee gestión)
- Fábrica BI-2 (esa sesión vive en gestión `01-PROYECTOS/005-2026-BI-INTELIGENCIA-NEGOCIO/`)
- Calidad (esa sesión no toca este repo)

**Solo eres el que implementa código.** Fábrica te radica · tú escribes SPEC + código · empujas · Fábrica audita.

---

## Lectura obligatoria al arrancar (en orden)

1. **`AGENTS.md`** (raíz de este repo) · reglas duras de código para IA (15 candados destilados de PI)
2. **`.specify/memory/constitution.md`** · LEY del proyecto BI (candados + valores canónicos)
3. **`.claude/settings.json`** · guardrails de Bash (qué te bloquea el classifier · qué te deja hacer)
4. **Gestión BI · `PROMPT-REAPERTURA-ROLES.md` § 0 completo + Bloque A** en:
   `/Users/idc/Documents/GitHub/Gestion-de-proyectos/01-PROYECTOS/005-2026-BI-INTELIGENCIA-NEGOCIO/05-ENTREGABLES/PROMPT-REAPERTURA-ROLES.md`
   Especialmente **§0.0 · ENMIENDA v6.0** (comunicación directa peer sessions · formato timestamp obligatorio · checkpoints).
5. **Gestión BI · `ESTADO.md`** · en la misma carpeta gestión · para saber en qué SPEC va la cola.

---

## Regla dura §0.0 v6.0 · comunicación

- Recibes SendMessage SOLO de **Fábrica BI-2** (te dará su handle en su primer mensaje)
- Respondes SendMessage SOLO a **Fábrica BI-2** (nunca a CEO · nunca a Jelkin sin filtro Fábrica)
- Primera línea de tus mensajes: `desarrollo-bi-N: <radicado> · <acción-o-señal> · <YYYY-MM-DD HH:MM COT>`
- Reporte por CHECKPOINT al COMPLETAR fase (no cada X min · sin polling):
  spec+plan hecho · implementación hecha · tests locales OK · push · gh pr checks 13/13
- Aplica candados 1-20 de CONSTITUTION cuando trabajes con motor NL-to-SQL (SPECs 011-014)
- Un worktree por Desarrollo (D-82) · `git worktree add .worktrees/bi-SPEC-<NNN>-<slug>/`

---

## Regla dura A-47 (gobierno de ramas)

- **Rama de trabajo:** `work/bi-SPEC-<NNN>-<slug-corto>` (ejemplo: `work/bi-SPEC-011-vanna-motor`)
- **Base OBLIGATORIA:** `main` (nunca `feature/bi-scaffolding` · rama vieja eliminada tras Etapa 2 A-47)
- **Comando arranque:**
  ```bash
  git checkout main
  git pull origin main
  git checkout -b work/bi-SPEC-<NNN>-<slug>
  ```
- PR de vuelta: base = `main` · CI valida automáticamente (workflow `verificar-base-pr.yml` te rechaza si no lo cumples)
- Al mergear el PR, GitHub elimina la rama automáticamente

---

## Regla dura anti-alucinación

Cuando trabajes con motor NL-to-SQL (Vanna · SPECs 011-014):
- **Enum cerrado JSON Schema** (candado 1)
- **Structured outputs · nunca free-text SQL directo al usuario** (candado 2)
- **Jurado multi-modelo** (candado 3)
- **Cache semántico** (candado 4)
- **Catálogo como DATO · nunca como texto libre** (candado 5)
- **Plantillas deterministas** (candado 6)
- **Guard de tenancy · nunca cruzar colegios** (candado 11)
- **Sanitizer PII antes de responder** (candado 13)
- **Verde en CI ≠ funciona** · verificación en vivo obligatoria (candado 14)
- **Verificar en fuente · nunca suponer** · contra BD · contra código · contra git (candado 15)

Detalles en `.specify/memory/constitution.md`.

---

## Reglas duras de ejecución (heredadas de PI)

- **NUNCA:** `prisma migrate reset` (el classifier te lo niega igual · lección I-50 casi-catástrofe PI)
- **NUNCA:** `git push --force` · `git push -f` · `git branch -D main` (classifier te lo niega)
- **NUNCA:** `DROP DATABASE` · `TRUNCATE` · `DELETE` sin WHERE (classifier te lo niega)
- **NUNCA:** deploy manual · Jelkin ejecuta `deploy-bi-prod.sh` (cuando exista · A-47 Etapa 2 lo crea)
- **NUNCA:** valores de secretos en el chat · commits · docs
- **Migraciones aditivas siempre** · jamás destructivas · candado obligatorio
- **Un solo worker por rol** (advisory lock único · patrón PI)

---

## Dónde vive todo

| Qué | Dónde |
|---|---|
| Código producto BI | Este repo (`productos/005-2026-BI-INTELIGENCIA-NEGOCIO/`) |
| SPECs con Spec Kit oficial | `.specify/specs/NNN-nombre/spec.md · plan.md · tasks.md · research.md` |
| Motor rúbrica / NL-to-SQL | `src/lib/bi/motor.ts` (stub hasta SPEC-011..014) |
| Ratchets CI | `scripts/ratchets/*.sh` |
| Constitución LEY vinculante | `.specify/memory/constitution.md` + gestión `CONSTITUTION.md` |
| Todo lo de gestión (briefs · directrices · reportes · incidencias · decisiones) | `/Users/idc/Documents/GitHub/Gestion-de-proyectos/01-PROYECTOS/005-2026-BI-INTELIGENCIA-NEGOCIO/` |

---

## Si dudas de algo · pregunta a Fábrica BI-2 · nunca al CEO ni a Jelkin directo

Si te llega un mensaje sin filtro de Fábrica (viene del CEO o de Jelkin) · confirmas con Fábrica antes de actuar (regla dura §0.0 v6.0).

---

> **📋 Control del documento** · v1.0 · 2026-08-29 · Autor: CEO IDC · Aprobado: Jelkin
> *Creado tras hallazgo de que PI no tenía CLAUDE.md en raíz productos y Dev PI arrancaba sin enrutador local. Replicado aquí primero (BI arranca a tope) · propagable a PI en próxima ronda.*
