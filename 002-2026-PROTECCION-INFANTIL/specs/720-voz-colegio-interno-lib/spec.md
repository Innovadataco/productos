# SPEC-720 · Barrido de voz colegio/interno: los candados no veían los pretéritos ni `lib/`

**Status**: DESARROLLO

**Origen:** Dev 1, barriendo para SPEC-719; el CEO aceptó radicarlo aparte. **Carril:** Dev 1 · Calidad.

## Lo medido (antes de construir)

- **Colegio y admin (app+components): 0 pretéritos de tú.** Sus candados ya los mantenían en usted.
- Los pretéritos viven en `lib/` SERVICES. Al clasificarlos por AUDIENCIA, la MAYORÍA son del PADRE (tú CORRECTO, §1.9: bitacora-menor, hijos, cita.service, pdf-expediente, pagos…). La violación real de usted estaba en **`lib/colegio`** (seguimiento, notificaciones, onboarding, vigencia).
- **Matiz clave:** `lib/dal/services` es un árbol COMPARTIDO de audiencias mezcladas; incluso dentro de `lib/colegio`, `vigencia.ts` sirve al SCHOOL_ADMIN (usted) **y** al PARENT (`verificarVentanaServicioPadre`, tú). No se puede «escanear lib/ a ciegas».

## El arreglo

1. **Candado de colegio (SPEC-463/523):** los pretéritos se cazan por **MORFOLOGÍA** (`-aste`/`-iste` + ancla), no por lista (reusa la clase de SPEC-719); y su árbol se extiende a **`lib/colegio/**`** (subárbol PROPIO). `vigencia.ts` se **excluye explícito** (mixto padre/colegio, documentado) — no es hueco: sus cadenas de colegio están en usted, las del padre en tú.
2. **Candado de interno (`tuteo-interno`, SPEC-529):** gana la misma clase de pretéritos por morfología (red de seguridad; el árbol interno estaba limpio).
3. **Copia corregida a usted (colegio):** `seguimiento.ts` (Revisó/Marcó/Márquela/Registre/sus preferencias), `notificaciones.ts` (su colegio/Entre/Puede/Revise/su servicio), `onboarding.ts` (Cree/sus estudiantes/Registre/su colegio), `vigencia.ts` (SCHOOL_ADMIN: Su cuenta/Contacte…). Las cadenas del PADRE en `vigencia.ts` se conservan en tú (correctas).
4. **Control positivo** (los dos sentidos): texto viejo → rojo; un pretérito NOVEL (`gestionaste`) → rojo — prueba clase, no lista.

## Impacto

**Impacto en arquitectura:** dos candados de voz pasan de lista a MORFOLOGÍA para el pretérito, y el de colegio extiende su vigilancia a su subárbol de servicios (`lib/colegio`). El cierre de clase se hace por **subárbol PROPIO**, no «lib/ entero»: el árbol compartido `lib/dal/services` queda fuera porque su copy es del padre (tú) — vigilarlo como usted daría falso positivo. Sin conducta ni forma; solo voz.

## Fuera (deuda declarada, decisión del CEO)

- **Cierre de clase del árbol COMPARTIDO** (`lib/dal/services`, `lib/schemas`, `lib/pagos`, `lib/profesional/cita`): requiere etiquetar la copia por AUDIENCIA a nivel de archivo/función (padre vs interno), un esfuerzo aparte. Hoy esa copia es del padre (tú) y es correcta; no hay violación pendiente, solo falta de vigilancia sobre un árbol mixto.
