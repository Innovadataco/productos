# Cierre · SPEC-339 · El camino guiado del padre (A-67 · Fase 1)

**Fecha**: 31-08-2026 · **Rama**: `work/pi-SPEC-339-camino-guiado-padre` · **Estado**: IMPLEMENTADO — pendiente del recorrido del CEO (candado 25: verde en CI ≠ funciona)

---

## Qué se construyó

| Frente | Resultado |
|---|---|
| La puerta | Registro por **enlace** (24 h, un solo uso, solo el hash persistido). El código de 6 dígitos sigue vivo para el colegio. Anti-enumeración probada **byte a byte**. |
| El guardián | 5º paso de `middleware.ts` sobre `sesion_estado.pasoCamino`, solo rol PARENT. Pantallas → redirección al paso; `/api/**` → 403 JSON con destino. |
| La falla-cerrada | Cookie ilegible + padre + ruta gobernada = rebote único a `/api/sesion/al-dia` (re-sella en Node). Camino infeliz → `/login` con sesión cerrada, jamás un segundo rebote. |
| Invariante cruzada | El destino de cada guardián debe estar exento en los que corren después. Assert al arranque; probada por mutación (dispara con el bucle exacto que encontró Calidad). |
| El paso derivado | Sin columna de progreso: consentimiento → perfil (7 campos con documento) → **un menor activo** → cualquier suscripción (incluida `PENDIENTE_AUTORIZACION`). Inactivar el único menor devuelve al Paso 3. |
| Un menor por padre (D-4) | `Hijo.usuarioId` con cascada; unicidad por padre. Migración con 3 guardas que abortan en voz alta (compartidos > 0 · huérfanos > 0 · verificación de que los DROP hicieron efecto — la unicidad vieja era un índice, no una constraint, y un `DROP CONSTRAINT` solo pasaba en verde sin hacer nada). `HijoPadre` e `IdentificadorHijoDesvinculado` inactivos, no borrados. |
| Corrección del menor | `PATCH /api/padre/hijos/[id]` acepta la ficha completa; choque de documento solo dentro de la lista propia. |
| El tope | `padre.hijos.maximo` (5) + `padre.hijos.maximo_mensaje`, sembrados. Probado que cambiar el parámetro cambia el tope sin desplegar. |
| Sellados | Los pasos 2 y 3 re-sellan la cookie al completarse; el sellado fallido avisa al padre (no silencioso). |
| El cruce (punto 4 Calidad) | `notificarHijosSiCorresponde` en el worker: reporte visible → hijos activos con ese identificador → correo `padre.hijo.reporte`. Interruptor y enfriamiento **propios**; ambas independencias con el círculo probadas. |
| Pantallas | `/camino/{datos,hijos,plan,listo}` + Paso 1 = `/consentimiento` con rótulo. Armazón con progreso y **dos salidas visibles**. 390 px primero. |
| Móvil | `PadreNavMovil`: el padre por fin tiene menú en el teléfono. Destinos de `PADRE_NAV_ITEMS`, Reportar incluido. |
| Reportar sin muro | `/dashboard/padre/reportar` y `/mis-reportes` exentos de vigencia; el ayudante muerto `esRutaExenta` eliminado. |
| Voz | Tuteo neutro en todo lo nuevo; corregidos los 3 mensajes de guardianes y la plantilla de SPEC-338 (migración que respeta ediciones del admin). |

## Evidencia de pruebas

- **1837 unit** en verde (233 archivos), incluidas las 38 del middleware (4 estados, candado A ruta por ruta, 4 roles ajenos, cookie pre-despliegue).
- Integración: puerta 16 · perfil/hijos rutas 17 · menores servicio 13 · derivación 8 · rebote 9 · cruce 11 · consentimiento 5 · colegio 17.
- `npm run build` VERDE · `npm run arch:check` VERDE (línea base regenerada; `TokenRegistro` declarado huérfano con motivo).
- E2E `tests/e2e/camino-padre.spec.ts` escrito (390 px, URL a mano, retomar, no-desborde, colegio) — correr con `npm run test:e2e`.

## Desviaciones y hallazgos (Nota: cambian el veredicto)

1. **`/camino/plan` y `/camino/listo` llevan `force-dynamic`**: dependen de la sesión; el build intentaba pre-renderizarlas.
2. **Voseo pre-existente fuera de alcance**: las guías de acción de SPEC-235 (`prisma/seed.ts`, ~6 plantillas) siguen en voseo. NO se tocaron — frente aparte; reportado al CEO.
3. **Cobertura local de `test:unit` falla umbrales** — pre-existente (falla idéntico sin estos cambios); el CI la evalúa en el job agregador con otros parámetros.
4. **`indices:check` local reporta 4 índices críticos faltantes** — pre-existente en esta máquina (verificado con stash); las migraciones de esta spec no tocan esos índices.

## Deuda técnica declarada

- El interruptor `notificacionesHijos` no tiene aún control en la pantalla de preferencias del padre (el dato y el gate existen; la pantalla de preferencias es de la Fase «avisos» del brief).
- `RegistroForm.tsx` y `VerificacionForm.tsx` quedan sin consumidor en `/registro` (el colegio usa el suyo). No se borraron: fuera de alcance.
- El enfriamiento de hijos reusa el **parámetro** de horas del círculo (el valor por defecto del mecanismo); si el negocio quiere horas distintas por frente, es un parámetro nuevo.

## Pendiente para cerrar el ciclo

1. Recorrido del CEO en el navegador a 390 px (quickstart de 46 pasos, empezando por el 15: la cookie vencida).
2. E2E en el pipeline.
3. Aceptación de Jelkin (la única columna que cierra).
