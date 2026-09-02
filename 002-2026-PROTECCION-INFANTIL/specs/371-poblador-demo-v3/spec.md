# SPEC-371 · Poblador demo v3 — capa de gestión humana para BI

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1 · **Origen**: radicado 005 del CEO (pide Kimi/BI vía Jelkin)

## Para qué

La v2 (SPEC-369) dejó volumen con variedad, pero el **tablero de gestión** de BI
no se mueve: en prod `AlertaColegio.asignadoAId` está 100 % NULL (846 alertas
sin asignar, 0 operarios) y hay 117 `TransicionReporte` para 4.058 reportes —
un embudo plano, sin tiempo medio de gestión que calcular.

## Matiz que manda

`AlertaColegio.asignadoAId` es la asignación **dentro del colegio** (comité /
equipo del rector). NO es `Reporte.operadorId` (moderación del admin, que ya
quedó con carga tras el cupo 500). La v3 puebla la del **colegio**.

## Qué hace (tres partes, un solo script)

1. **Operarios del colegio con alertas asignadas.** Toma los 5 colegios demo
   con más alertas activas (estado ≠ `cerrada`) y usa **su comité demo**
   (`demo-u-cvi-NN`) como operario. Reparto **desigual a propósito** —
   fracciones `0.95 · 0.9 · 0.8 · 0.65 · 0.2` (promedio 0.70): uno casi al
   tope, uno a la mitad, uno casi libre, para que el semáforo de capacidad de
   BI muestre los tres estados. El ~30 % restante queda sin asignar (la cola
   visible).
   - *Desvío declarado respecto al radicado:* **no se crean usuarios nuevos.**
     `Usuario.comiteColegioId` es `@unique` — un comité por colegio —, así que
     "4-6 operarios" = los comités v1 de 5 colegios demo distintos (el radicado
     permitía "crear o reusar").
2. **Ciclo de vida transitado.** Por cada reporte demo (`demo-r-` y
   `demo2-r-`) la cadena de `TransicionReporte` que lleva de PENDIENTE hasta
   **su estado actual**, con los responsables y motivos del pipeline real
   (WORKER → IA → OPERADOR cuando pasó por revisión humana) y tiempos
   escalonados desde `creadoEn`, nunca en el futuro. El `Reporte` no se toca.
   - *Desvío declarado:* "escalado a comité → gestionado/cerrado" **no son
     estados del reporte**: viven en `AlertaColegio.estado` y en
     `SolicitudComite`, y el flujo real del comité **no escribe**
     `TransicionReporte`. Ese tramo del ciclo se representa con la parte 3, no
     con transiciones inventadas.
3. **Comité.** Cada alerta demo `escalada` sin solicitud recibe su
   `SolicitudComite` (SPEC-168): ~40 % PENDIENTE, ~60 % RESUELTA con
   `resueltoEn` y resolución; al resolver, la alerta pasa a `gestionada`, igual
   que hace el flujo real.

Reparto con la semilla por defecto sobre el sandbox de dev (v1 + v2 sembrados):
5 operarios · **72 % asignadas (130/181)**, 51 en cola · 8.909 transiciones
sobre 4.000 reportes (PROCESANDO 4.000 · CLASIFICADO 3.540 · REVISION_MANUAL
1.163 · POSIBLE_SPAM 206) · 254 solicitudes (96 PENDIENTE · 158 RESUELTA) ·
158 alertas → `gestionada`. Las fracciones son proporcionales: en prod (846
alertas) el porcentaje y el contraste entre operarios salen iguales.

## Cómo se revierte (lo que lo hace seguro)

- Las filas **nuevas** llevan ids `demo3-` (`demo3-tr-<reporte>-<paso>`,
  `demo3-sol-<alerta>`), prefijo disjunto de `demo-` y `demo2-` en las tres
  direcciones (test). El número visible es `SOL-D3-nnnnnn`: un `SOL-` real es
  `SOL-` + 8 hex, no puede chocar.
- Las **asignaciones** solo caen en alertas `demo-al-` de colegios `demo-c-` y
  solo a comités `demo-u-cvi-`; revertir = volver a NULL donde el asignado
  empiece por `demo-u-cvi-`.
- Las alertas que pasaron a `gestionada` se identifican por **sus propias**
  solicitudes `demo3-` RESUELTAS y vuelven a `escalada` antes de borrarlas.
- `borrar-demo-v3` deja la base exactamente como estaba (probado: baseline
  idéntico).

## Candados

- **Solo filas con marca demo.** Cada `UPDATE` lleva en su `where` la marca del
  id **y** la del colegio; una alerta real (Jelkin está probando la suya) no
  puede calzar. Además se fotografía el estado de las alertas **reales** (sin
  marca: total / asignadas / escaladas) antes y después, y el script **aborta**
  si cambió.
- Inserción directa: sin pg-boss, sin Ollama, sin correos (asignar/escalar en
  el flujo real notifica; aquí no).
- **Idempotente**: ids deterministas + `skipDuplicates`; la segunda corrida
  escribe 0.
- **Sin fechas futuras** (cada paso se recorta a "ahora"). Sin PII nueva: no se
  crean personas.
- **No duplica historia.** Un reporte demo que ya tenga `TransicionReporte`
  ajenas (en prod hay 117 y no se sabe de quién) se salta; el dry-run dice
  cuántos. Las `demo3-` propias no cuentan, así la corrida sigue idempotente.
- Dry-run por defecto; `--confirm` para escribir; `--motivo` obligatorio
  (≥ 20 caracteres); auditoría `demo_poblar` / `demo_borrar` con versión `v3`.

## Cómo se ejecuta

```bash
# 1) medir sin escribir (imprime reparto por operario, transiciones y solicitudes)
node --env-file=.env --import tsx scripts/demo/poblar-demo-v3.ts --motivo="poblar demo v3 gestión para BI"
# 2) escribir
node --env-file=.env --import tsx scripts/demo/poblar-demo-v3.ts --motivo="poblar demo v3 gestión para BI" --confirm
# 3) revertir (dry-run por defecto; --confirm para borrar)
node --env-file=.env --import tsx scripts/demo/borrar-demo-v3.ts --motivo="revertir demo v3" --confirm
```

## Impacto en arquitectura: no

Scripts en `scripts/demo/`; ni modelo, ni migraciones, ni código de producto.

## Cómo se probó

- Unit (`scripts/demo/demo-v3.test.ts`, 9 tests): prefijo disjunto, ids
  deterministas, número imposible de chocar, cadena contigua que termina en el
  estado actual, sin historia para estados que el demo no produce, fechas
  crecientes y acotadas, recorte a "ahora", fracciones (máx ≥ 0.9, mín ≤ 0.2,
  promedio en (0.6, 0.8)).
- Sandbox dev con v1 y v2 sembrados: dry-run → `--confirm` (130 / 8.909 / 254 /
  158) → **segundo `--confirm` = todo 0** (idempotente) → transiciones futuras 0
  → `borrar-demo-v3 --confirm` → baseline idéntico (asignadas 0, `demo3-` 0,
  escaladas de vuelta a 254). Alertas reales: 0 asignadas antes, durante y
  después.

## Pendiente

- Ejecutar en prod **solo cuando el CEO lo autorice** (Jelkin está probando su
  colegio real). Primero dry-run, luego `--confirm`, luego la verificación:
  % asignadas, reparto por operario, transiciones por estado, reales intactas.
