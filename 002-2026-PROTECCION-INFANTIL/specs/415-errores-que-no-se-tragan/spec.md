# SPEC-415 · Los errores que se tragaban a alguien — 5 avisos de seguridad + 3 pantallas que mentían

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Dev 02 (`idc-80`) · **Origen**: barrido pedido por el CEO tras cerrar **I-294** en SPEC-414 · alcance fijado por él a las 17:0x.

**Impacto en arquitectura:** ninguno. No hay migración, ni endpoint nuevo, ni cambio de contrato de API. Ocho archivos ganan una línea de registro o un estado de error; `NotificacionesInbox` cambia el tipo interno de su contador (`number` → `number | null`) sin tocar sus props.

---

## Para qué

SPEC-414 cerró I-294: una consulta reventaba en cada lectura y nadie se enteraba porque el rechazo se descartaba en silencio. El CEO pidió el barrido sistemático: **si el patrón está en un lado, está en tres.**

El barrido dio **140 coincidencias** en `src/`. De esas, **34 valían mirar** — el resto es parseo de body y de respuesta (`request.json().catch(() => undefined)` + Zod → 400) y es correcto.

El CEO fijó el criterio y el alcance: **se arregla lo que hace que una persona tome una decisión equivocada. Lo que solo se ve feo, espera.** De ahí salen ocho:

| Grupo | Sitios | Por qué duele |
|---|---|---|
| **B** · avisos de cambio de clave | 5 | Si el proveedor de correo está caído (I-283, y **hoy lo está por cuota**), a nadie le avisaron que le cambiaron la contraseña — y sin una línea de log, tampoco quedaba forma de saberlo. |
| **A** · «no hay nada» vs «no pude mirar» | 3 | La pantalla afirma un hecho falso y alguien actúa sobre él. |

---

## Qué trae

### Grupo B · el aviso de seguridad deja rastro (5 archivos)

`enviarEmailCambioPassword` estaba envuelto en `catch {}` con el comentario *"fallo silencioso — el aviso no es bloqueante"*. **No bloquear estaba bien; ser mudo no.** El cambio de clave ya ocurrió y no se revierte, pero el fallo del aviso ahora va a `logger.error` con el contexto de qué camino lo disparó:

- `api/admin/colegios/[id]/regenerar-password` — un ADMIN regenera la clave del rector.
- `api/admin/operadores/[id]/regenerar-password` — ídem con un operador.
- `api/auth/activar` — activación de cuenta.
- `api/auth/cambiar-password` — el usuario cambia su propia clave.
- `api/auth/recuperar/restablecer` — restablecimiento por recuperación.

### Grupo A · las tres pantallas que afirmaban un hecho falso

**1. Integrantes del comité** (`dashboard/colegio/comite/integrantes/page.tsx`) — **el peor de los 34.**
Tenía `.catch(() => [])`: un fallo de lectura se renderizaba como *«este comité no tiene integrantes»*. El rector no puede distinguir las dos cosas, y la decisión que toma es cara — **volver a documentar personas que ya están registradas**. Ahora el fallo se distingue (`null` ≠ `[]`), se registra, y la pantalla dice qué NO hacer: *«Recarga la página antes de volver a registrarlos, para no duplicar personas que ya están documentadas.»*

**2. Historial de informes del caso** (`colegio/casos/InformesCasoPanel.tsx`)
El `catch {}` llevaba el comentario *«silencioso: el historial vacío ya comunica»*. Comunicaba **lo contrario**: un 500 o una red caída se veían igual que «aún no se han generado informes». El historial de informes **tiene valor legal**; decir que está vacío cuando no se pudo leer es la peor de las dos mentiras posibles. Ahora hay un estado de error propio, y el `if (!res.ok) return` mudo también quedó cubierto.

**3. Badge de notificaciones** (`NotificacionesInbox.tsx`)
Un fallo del resumen dejaba el contador en `0` y el badge escondido: idéntico a «no tengo nada nuevo». El contador pasa a `number | null`, donde **`null` = no se pudo preguntar**: el badge muestra una marca ámbar con `?` y el `aria-label` lo dice. Marcar una notificación como leída ya no inventa un número desde «no sé».

---

## Candados

- **`src/lib/errores-no-mudos.test.ts`** (13 tests estáticos) fija los ocho: los 5 de B deben importar `logger` y conservar el `logger.error` con su prefijo `[Seguridad]`, y no puede volver el `catch {}` alrededor del aviso; los 3 de A deben conservar su estado de error y su texto.
- **El candado ignora los comentarios.** Estos archivos ahora *citan* el defecto que arreglaron (`el .catch(() => []) que había acá`, `el historial vacío ya comunica`); explicarlo no puede poner el gate en rojo. Es la misma trampa que ya se cazó en SPEC-414.
- **Contraprueba ejecutada**: se reintrodujo el `catch {}` mudo en `auth/cambiar-password` y los dos tests de ese archivo se pusieron rojos; restaurado, los 13 vuelven a verde. Un candado que no se prueba mordiendo no es un candado.
- **`NotificacionesInbox.test.tsx`** (4 tests) prueba el comportamiento, no solo el texto: fallo → aviso accesible + marca visible; `0` → sin marca; `3` → el número de siempre; y el fallo queda en consola.

---

## Alcance · lo que NO entra, por decisión del CEO

Este PR es **B completo + los 3 peores de A. Nada más.** Un barrido de este tipo se desborda solo: arreglar mientras se barre termina en un PR de 40 archivos que nadie puede auditar y que choca con todo lo que hay en vuelo.

| Grupo | Sitios | Destino |
|---|---|---|
| **A restante** (13) | listas de simulaciones IA/anti-abuso, apelaciones, KPI de usuarios, documentos de confianza, catálogos de país/plataforma/profesores | Priorizado, sin ficha propia todavía. |
| **C** · cookie de estado muda (5) | `auth/login:96` · `auth/activar:76` · `auth/cambiar-password:83` · `consentimiento/aceptar:92` · `session/ping:49` | **Se junta con I-236** (guardianes degradados en silencio). |
| **D** · parámetro malformado cae al default sin decirlo (8) | `permisos-modulos` · `crear-alerta` · `categoria-grupos` · `padre/semaforo` · `ollama-config` ×2 · `admin/ia/page` · `ConfigPanel` | Después. Molesta, no engaña a nadie. |
| **E** · benignos (7) | `apelacion-storage` (unlink idempotente) · `queue` ×2 · `reportar-handoff` ×2 y `ThemeProvider` (storage del navegador) · `AuthContext` (la salida no depende de la API) · `ConfirmacionReporte` (portapapeles) | **No se tocan.** |

**Dos cosas que el barrido declaró sanas, y conviene que quede escrito:**
- `ConfigPanel.tsx:158` es el único otro `Promise.allSettled` del repo y **está bien**: inspecciona `r.status === "rejected"` y le informa al usuario qué parámetros fallaron.
- Los cuatro `sellarCookieSesionEstado(...).catch(() => false)` de padre/rector **también**: manejan el `false` y le muestran un aviso al usuario. Un barrido que no separa lo sano de lo enfermo no sirve.

**Precedente**: `ComiteBandeja.tsx:141` ya se arregló en SPEC-381 (I-270). El comentario que quedó ahí cuenta que Jelkin vio el error en la ventana de un deploy y **no había rastro en logs**. Mismo patrón; ya nos costó una vez.

---

## Verificación

- `npm run test:unit` → 17 tests nuevos verdes (13 del candado + 4 del badge) y la suite completa sin regresiones.
- **Contraprueba del candado** (arriba): reintroducir el defecto lo pone en rojo.
- `npx tsc --noEmit`, `npm run lint` (0 errores) y `npm run tokens:check` (piso 1079, sin subir) limpios.

> **Verde en CI ≠ funciona.** Lo que esta spec cambia se ve cuando algo falla, y eso no se puede provocar desde el CI. La verificación en producción es mirar el log del contenedor la próxima vez que el correo se caiga: **tiene que aparecer `[Seguridad] No se pudo avisar el cambio de clave`.** Hoy, con el proveedor caído por cuota, esa línea debería salir sola.
