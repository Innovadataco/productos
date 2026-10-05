# AGENTS.md — productos

## Proposito

Reglas especificas para operar el repo `Innovadataco/productos`.

## Estructura del repo

- `fabrica-de-software/`: codigo fuente de productos.
- `documentacion-tecnica/`: arquitectura, ADRs, guias.

## Reglas

1. Cada producto tiene su propia carpeta.
2. Todo PR requiere revision de codigo.
3. Los secrets se manejan via variables de entorno, nunca en el codigo.
4. Preferir modelos locales para revision de codigo sensible.

## Responsable

- **CEO** — sesión de IA que radica, revisa, mergea y despliega, bajo decisión de negocio de **Jelkin** (dueño). «ZEUS» era el nombre viejo del CEO.

## Flujo de trabajo

- Cada frente trabaja su SPEC en una rama `work/<producto>-SPEC-<N>-<slug>` y abre PR; **el merge y el deploy los hace el CEO** tras CI verde + revisión adversarial.
- «ODIN» era el nombre viejo de Desarrollo; «ACTA-VALIDACION» era ceremonia de la metodología anterior, hoy retirada.

## Ramas (INQUEBRANTABLE)

- **`main` — rama canónica y de producción.** Recibe merges vía PR con CI verde. **Prohibido commitear directo a `main`.**
- **Ramas de trabajo — dependen del producto.** PI y BI usan `work/<producto>-SPEC-<NNN>-<slug>` (A-47, una rama por spec). Otros productos pueden tener su propia convención; consultá el `AGENTS.md` de cada carpeta.

Ante la duda sobre qué rama usar: **consultá el `AGENTS.md` del producto y detente si hay ambigüedad**.

## Staging (INQUEBRANTABLE, todos los frentes)

Prohibido `git add -A` y `git add .`. Cada frente stagea SOLO rutas de su producto:
`git add 002-2026-PROTECCION-INFANTIL/...`. Varios frentes trabajan en la misma rama: un staging
global se lleva el trabajo de otro y arruina la trazabilidad del commit.

## Metodología y estándares (fábrica IDC)

- **Flujo vigente:** **radicado del CEO** (con el número de SPEC que él asigna) → **rama `work/<producto>-SPEC-<N>-<slug>`** desde `main` fresco → **PR con CI verde + revisión adversarial**; el CEO mergea y despliega. La metodología ceremonial (Spec Kit / Spec-Driven con set obligatorio de artefactos, `constitution.md`, `.specify/`) **quedó atrás**; `specs/NNN/` es home OPCIONAL de notas. La gestión (PM2) vive en el repo `Gestion-de-proyectos`.
- **Roles (sesiones de IA, bajo Jelkin):** CEO (radica/revisa/mergea/despliega) · Dev (implementa) · Datos (modelo de datos) · Calidad (recorre) · Diseño (la forma) · Estrategia (lo comercial). «ZEUS/ODIN» eran los nombres viejos de CEO/Dev.
- **5 reglas de oro:** SPEC numerada por el CEO + candado que muere con el defecto · subir a GitHub · pruebas · validar despliegue · documentar.
- **Índice de specs (opcional):** si usás `002-2026-PROTECCION-INFANTIL/specs/`, mantené su `README.md` al día.

## Reporte al CEO (handoff post-commit)

Al terminar, Desarrollo NO pega reportes largos. Reporta compacto (el CEO lee el diff del repo):

```
commit <hash> — <qué hizo, 1 línea>
hallazgos/pendientes: <lista corta, o "ninguno">
push: sí/no
```

Solo se cuenta lo que NO se ve en el código: hallazgos, decisiones, deuda técnica.
