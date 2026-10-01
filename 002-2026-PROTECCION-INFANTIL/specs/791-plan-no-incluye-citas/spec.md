# SPEC-791 · Ningún plan puede incluir citas

> **Status**: `IMPLEMENTADO` · pieza chica y urgente — protege el argumento de ingreso (suscripción = plataforma; la cita se paga aparte).
> **Rama**: `work/pi-SPEC-791-plan-no-incluye-citas` (base `main`). **Radicado**: `RADICADO-SPEC-791-2026-09-29.md`.

## 1 · Por qué

Estrategia confirmó que se pueden cobrar suscripciones **HOY, sin habilitación sanitaria propia**, porque
la suscripción es **acceso a la PLATAFORMA** y la cita se paga **aparte** (`montoConsulta` en
`SolicitudCita`), no empaquetada. Si un plan **incluyera** citas, estaríamos vendiendo un **servicio de
salud** en el paquete y el argumento del ingreso se cae — eso sí exigiría habilitación (REPS, `[ABOGADO]`).
Esa propiedad **no la vigilaba nada**: un admin podía crear mañana un plan «premium con 2 consultas
incluidas» y romper el fundamento legal **en silencio**.

## 2 · Barrido (medido, no supuesto)

- **El empaquetado FUNCIONAL ya es imposible hoy:** el modelo `Plan`/`Suscripcion` **no tiene** ningún
  campo que otorgue o cuente citas, **ni** JSON `beneficios`/`features`, **ni** relación a `SolicitudCita`.
  **No existe** ningún camino `Plan`/`Suscripcion` → `SolicitudCita`. La cita siempre cobra `montoConsulta`.
- **Falso amigo verificado:** `usosMaximosPorCliente` **no es citas** — es el tope de CANJE del freemium
  (seed: `1` en «Prueba gratis 30 días», `null` en los pagos).
- **Planes sembrados:** descripciones de acceso a plataforma; cero mención de citas.
- **Planes VIVOS en prod: MEDIDO el 29-09-2026 (CEO, vía SSH).** Los **11** planes existentes describen
  cobertura / protección / prueba gratis — todos acceso a plataforma; **ninguno menciona consultas, citas
  ni sesiones.** El vector de texto libre existe pero **nadie lo usó** (cero medido, no supuesto).

## 3 · Qué hace (alcance de ESTA spec: lo estructural)

Convierte «no existe un campo de citas» en «**no puede existir**». Candado
`src/lib/pagos/plan-sin-citas-incluidas.candado.test.ts`: lee el `schema.prisma` REAL y, por
**MORFOLOGÍA** (no lista de nombres), falla si en `Plan`/`Suscripcion` aparece un campo que nombre una
cita, que se relacione con `SolicitudCita`, o que cuente consultas/sesiones **incluidas**. Control
positivo por MUTACIÓN: `citasIncluidas Int` (o `consultasIncluidas`, o una relación a `SolicitudCita`)
lo pone ROJO. El **porqué** vive junto al candado y como comentario en el modelo `Plan` del schema, para
que el próximo no lo levante por una razón comercial sensata sin ver la frontera legal.

## 4 · El LÍMITE — qué NO cubre esta spec (para que nadie crea que cubre todo)

**El empaquetado funcional es imposible por construcción; el TEXTO LIBRE de `nombre`/`descripcion` NO
está cubierto acá.** Un plan que **dice** «2 consultas incluidas» ofrece un servicio de salud en el
paquete aunque el sistema no entregue ninguna — y **la exposición legal está en lo que se OFRECE**, no en
lo que se entrega. Ese vector **no se controla con un candado de código** (una lista de palabras es
frágil y una validación se apaga): se controla con **AUTORÍA** — quién puede escribir el copy comercial,
decisión de negocio de Jelkin — y con un **detector BLANDO de solo lectura** contra la base viva (reporta
planes cuyo texto mencione consultas, **no bloquea**), del tipo del guardián de deriva, que **el CEO**
monta aparte. **No es deuda de esta spec: es riesgo de copy comercial, con control de autoría, no de código.**

## 5 · Candados

| Qué vigila | Control |
|---|---|
| `Plan`/`Suscripcion` no pueden REPRESENTAR citas incluidas (schema real, morfología) | positivo por mutación: `citasIncluidas Int` / `consultasIncluidas` / relación a `SolicitudCita` → ROJO; negativo: `usosMaximosPorCliente`, `descripcion`, `consultaPublicaLimite` NO se marcan |

**NO reconciliar:** si un test existente se pone rojo, es hallazgo.

## 6 · Fuera de alcance

REPS (SPEC-790) · precios y planes comerciales (Jelkin) · el flujo de pago de la cita · el detector
blando de texto (lo monta el CEO) · el cero de prod (lo mide el CEO).

---
> **Impacto en arquitectura:** un candado unit que lee `schema.prisma` (capa de datos, solo lectura) +
> un comentario `//` en el modelo `Plan` (no cambia el datamodel ni exige migración). No toca runtime,
> endpoints ni el stack; no regenera artefactos.
