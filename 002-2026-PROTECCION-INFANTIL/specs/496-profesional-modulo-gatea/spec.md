# SPEC-496 · El interruptor que aparenta revocar y no revoca (`profesional_*` solo-NAV)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: Dev 02 · **Origen**: barrido de brechas de permisos de Dev 02 (05-09, cobertura completa). Radicado del CEO (`RADICADO-SPEC-496`). Va después de SPEC-452/SPEC-443.

## El problema (degradación silenciosa)

Los 6 módulos `profesional_*` se concedían al rol PROFESIONAL en `CLAVES_POR_ROL` pero **ningún endpoint ni página los exigía**: el área del profesional se gateaba SOLO por rol (`verifyAuth("PROFESIONAL")`). El módulo solo pintaba el menú.

**Consecuencia:** un admin que revoca `profesional_casos` en el panel de permisos **cree que cortó el acceso y no lo cortó** — solo escondió el ítem del menú; el endpoint seguía respondiendo a quien conociera la URL. Es [[ceo-degradacion-silenciosa]]: un control de administración que miente. La próxima vez que alguien lo use para cortar de verdad (un profesional suspendido, una investigación), creerá que actuó y no habrá actuado. **Un control que miente es peor que no tener control.**

No había víctima hoy (el barrido dio cero brechas de 403); este es el residuo del tipo contrario.

## Impacto en arquitectura: sí (acotado)

El módulo `profesional_*` pasa de adorno de menú a **segunda puerta** real (el rol sigue siendo la primera). Alinea al profesional con el patrón del resto del producto (rol + módulo), sin cambiar el modelo de permisos ni la fuente única `CLAVES_POR_ROL` (solo se agregan comentarios). Nuevo candado estructural (`permisos-modulo-sin-superficie`) que prohíbe la clase «módulo concedido sin superficie que lo exija».

## Qué se hizo

**Decisión del CEO: que el módulo mande de verdad.** El rol sigue siendo la primera puerta; el módulo pasa a ser la segunda, como en el resto del producto. (Rechazado: quitar `profesional_*` del catálogo — taparía la mentira escondiendo el interruptor y dejaría al profesional sin granularidad.)

1. **Endpoints (12 archivos):** `await assertModulo(user, "profesional_X")` tras el guard de rol, con el módulo que corresponde a cada superficie:
   - `panel` → `profesional_inicio`
   - `solicitudes` (+ `[id]/confirmar`, `[id]/rechazar`) → `profesional_citaciones`
   - `franjas` (GET/POST) + `franjas/[id]` (DELETE) → `profesional_calendario`
   - `documentos` (GET/POST) + `documentos/[clave]` + `perfil` (GET/PUT) + `autorizacion` (POST) → `profesional_ficha`
   - `verificacion` (GET) + `verificacion/reenviar` (POST) → `profesional_verificacion`
   - En `perfil`/`autorizacion` el `assertModulo` va dentro del helper `requireProfesional()` (cubre GET+PUT / POST de una).
2. **Páginas server (5):** patrón del comité — `if (!(await puedeAccederAModulo(rol, "profesional_X"))) return <SinAccesoModulo />;` en inicio, citaciones, casos, calendario y verificación. La client `/perfil-profesional/completar` (ficha) queda cubierta por sus APIs (`perfil`/`documentos`/`autorizacion`), ya gateadas.
3. **Módulo fantasma (`admin_verificacion_incidentes`):** borrada la mención en el comentario del enum `RolUsuario` (`schema.prisma`). No existía en el catálogo ni lo exigía nada; los incidentes cuelgan de `admin_verificacion_profesionales`.
4. **`comite_auditoria` — decisión anexa del CEO:** se queda solo-ADMIN A PROPÓSITO (separación de funciones: quien valida no audita su propia validación). Documentado con comentario junto al tab (`nav-items.ts`) y en `CLAVES_POR_ROL` para que nadie lo «arregle» creyendo que es un hueco.

## Mapeo por módulo (superficie que ahora lo exige)

| Módulo | Endpoints | Página(s) |
|---|---|---|
| profesional_inicio | `/api/profesional/panel` | `/dashboard/profesional` |
| profesional_citaciones | `/api/profesional/solicitudes(+confirmar/rechazar)` | `…/citaciones` |
| profesional_casos | — (datos vía service en la página) | `…/casos` |
| profesional_calendario | `/api/profesional/franjas(+[id])` | `…/calendario` |
| profesional_ficha | `/api/profesional/{perfil,documentos,documentos/[clave],autorizacion}` | `/perfil-profesional/completar` (client, vía API) |
| profesional_verificacion | `/api/profesional/verificacion(+reenviar)` | `/perfil-profesional/verificacion` |

## Candados

- **Conducta (muere con el defecto):** `src/app/api/profesional/verificacion/profesional-modulo-gatea.candado.test.ts`. Profesional con perfil ACTIVO → `GET /api/profesional/verificacion` 200; se revoca `profesional_verificacion` (fila `permisoModulo` activo=false) → 403. Validado por mutación: quitar el `assertModulo` devuelve 200 al revocado y el test se pone rojo.
- **Antirregresión de la CLASE:** `src/lib/permisos-modulo-sin-superficie.candado.test.ts` (unit). Escanea la FUENTE en busca de guards reales y falla si CUALQUIER módulo concedido en `CLAVES_POR_ROL` es exigido por cero endpoints/páginas (contando padres por la jerarquía AND). Caza cualquier futuro solo-NAV, no solo estos 6. Validado por mutación: quitar el guard de `profesional_casos` lo marca huérfano.

## Verificación final (la hace el CEO)

En producción: revocar un módulo `profesional_*` a un profesional real y comprobar que el endpoint **rechaza** (403), no solo que el menú se esconde.

## Sin sobre-alcance

No se toca el gateo por rol ni el borde de I-236 (otro eje). No se cambia ningún grant de `CLAVES_POR_ROL` (solo comentarios). No se toca el simulador ni Diseño.
