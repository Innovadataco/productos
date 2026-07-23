# REVISIÓN-ZEUS-003 — Gate de los planes 009 (Configuración/Usuarios) y 013 (Consola APIs)

**Fecha:** 2026-07-23 · **Revisor:** ZEUS · **Radicado:** 003-SICOV-004 · **Veredicto:** ✅ APROBADO CON CORRECCIONES
**Modo:** los planes se entregaron en MODO PLAN (sin tasks.md ni código). Correcto.

---

## Aciertos verificados

- **009 no crea tablas nuevas:** empresa+token = `ProveedorVigilado`⇄`Usuario` rol 2 por join lógico NIT (ya usado por `validarContratoVigente`); permisos sobre `UsuarioModulo`/`Submodulo` existentes con UNA columna aditiva. Verificado contra el esquema real.
- **Granularidad ya modelada:** `Submodulo` existe (hoy sin filas sembradas); el plan la puebla por seed. id 9 libre para `configuracion` (módulos actuales 1-8).
- **013 doble candado:** gate env apagado + `FASE_CONSOLA=1` en código (no en env). El "ejecutar en real" responde 403 fijo y **no hay código de ejecución real detrás**. Fase 2 = quitar el candado, sin reestructura. Es el diseño correcto.
- **Bitácora `tbl_api_llamadas` aditiva**, con redacción de sensibles y sin red. Correo por Resend tras interfaz única (D-048), con caída a stub sin key.

---

## CORRECCIONES (aplicar antes de tasks.md)

### B1 — BLOQUEANTE (plan 009 §2): el índice único con NULL NO garantiza unicidad del "módulo completo"
El plan cambia `@@unique([usuarioId, moduloId])` → `([usuarioId, moduloId, submoduloId])` y lo llama trivial. **No lo es:** en PostgreSQL los `NULL` se consideran **distintos entre sí** en un índice único, así que dos filas `(5, 4, NULL)` (usuario 5, mantenimientos, módulo completo) **serían ambas admitidas** — se pierde la garantía de una sola fila de módulo completo por usuario.
**Corrección:** en la migración SQL (editada a mano, ya que van con `--create-only`), usar **dos índices únicos PARCIALES**:
```sql
CREATE UNIQUE INDEX ux_usmod_completo   ON sicov.tbl_usuarios_modulos (usm_usuario_id, usm_modulo_id)                    WHERE usm_submodulo_id IS NULL;
CREATE UNIQUE INDEX ux_usmod_submodulo  ON sicov.tbl_usuarios_modulos (usm_usuario_id, usm_modulo_id, usm_submodulo_id) WHERE usm_submodulo_id IS NOT NULL;
```
Alternativa solo si se confirma soporte en Prisma 5.22 + PG16: `UNIQUE NULLS NOT DISTINCT`. Los índices parciales son la vía segura e independiente de versión.

### B2 — BLOQUEANTE (plan 009 §2/§5): regla de exclusión completo ↔ submódulo
Con `(usuario, mant, NULL)` = módulo completo y `(usuario, mant, preventivos)` = solo submódulo, hay que definir qué pasa si coexisten. **Regla:** por `(usuario, módulo)` hay **o una fila NULL (completo) o N filas de submódulo, nunca ambas**. Al asignar "módulo completo" se borran las filas de submódulo de ese módulo (y viceversa), en la misma transacción. Validado **server-side**, no solo por índice. Sin esto la semántica del guard es ambigua.

### Menores
- **009:** no hardcodear el **id 9** de `configuracion`; sembrar y resolver por **nombre** (`configuracion`), los ids son serial. El guard y el menú referencian el nombre, no el número.
- **009:** hacer explícito que el **envío de correo va FUERA de la transacción** de alta — un fallo de Resend nunca revierte la creación de empresa/usuario (el plan lo implica en US3-3; declararlo en el §4).
- **013:** `@db.Json` → **`Jsonb`** (indexable, más eficiente para la bitácora). Y la **redacción de sensibles debe ser RECURSIVA** (campos anidados en el payload), no solo de primer nivel.

---

## 013: aprobado en lo demás
Sin bloqueantes. Las tres correcciones menores (jsonb, redacción recursiva) se aplican y sigue.

---

## Riesgo de cronograma
009+013 comparten la tanda de datos y el módulo Configuración: bien secuenciado. La única migración no trivial es el índice de B1 — revisión manual del SQL obligatoria en el gate de implementación.

---
> **📋 Control** · v1.0 · 2026-07-23 · Autor: ZEUS · Radicado 003-SICOV-004 (planes en `7bbf39e3`)
