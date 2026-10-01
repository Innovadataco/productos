# SPEC-796 · El contrato firmado del colegio: adjuntar · ver · registrar

**Feature Branch**: `work/pi-SPEC-796-contrato-colegio`
**Created**: 2026-09-30
**Status**: DESARROLLO (motor + superficies; sobre el modelo de Datos, PR #786)
**Base**: `main` + modelo `ContratoColegio` de Datos (#786, D-121).

## Contexto

`Suscripcion.contratoPDFUrl` existía con CERO escritores: no había forma de guardar el contrato
firmado de un colegio — lo último entre nosotros y la primera factura a un colegio (único canal de
ingreso; no hay pasarela). La medición (punto 0) está en §medición. Datos firmó el registro durable
`ContratoColegio`; esta spec construye el MOTOR y las dos superficies, y recablea los lectores.

## Medición del punto 0 (lo que exige el radicado)

- **Reusable:** el patrón de autorización/apelación (`autorizacion-storage` / `apelacion-storage`):
  archivo SUBIDO, AES-256-GCM, FUERA de la web, id OPACO (uuid), fail-closed, servido tras auth. Cubre
  **ubicación/guessability** y **audiencia** (sirve a dos audiencias con guardia por dueño).
- **NO reusable:** los PDF de reporte/expediente son EFÍMEROS (se regeneran de la BD); el único que
  persiste (informe de comité) va en claro y sin lector. No sirven para un documento SUBIDO.
- **Dimensión que NO cubría ningún mecanismo — fin de relación/retención:** la referencia colgaría de
  `Suscripcion`, que se HARD-borra en `borrar-colegio.ts`/`borrar-padre.ts`/purga demo → el contrato
  moriría antes de su retención `[ABOGADO]`. Lo resolvió el modelo de Datos: tabla propia
  `ContratoColegio` con FK **SetNull** (sobrevive al borrado operativo) + snapshots durables, y
  cubierta por la purga DEMO (`orden-borrado.ts`). «No se borra con el colegio, SÍ con la siembra.»

## Decisiones

- **Storage** `contrato-colegio-storage.ts`: cifrado, id opaco, PDF-only, fuera de la web; en el
  registro se guarda el `archivoId` opaco + sha256, **nunca la ruta ni el contenido**.
- **Servicio** `contrato-colegio.service.ts`: adjuntar (compone `colegioSnapshot` id·nombre·NIT y
  `adjuntadoPorSnapshot`), ver (DTO que SOLO lleva `adjuntadoEn`), leer (PDF para el endpoint).
  Append-only: reemplazar = hecho nuevo (el vigente es el último).
- **Audiencia (guardia de servidor, no esconder el enlace):**
  - Admin sube/ve desde la ficha cliente (`verifyAuth("ADMIN")` + `assertModulo("pagos_admin")`).
  - El colegio DUEÑO ve el suyo por un endpoint que resuelve por la SESIÓN (`usuario.colegioId`), NO
    por id en la URL → un colegio solo puede pedir el suyo. «Ver contrato» va a ese endpoint, nunca a
    una URL pública/adivinable.
- **No se escribe `contratoPDFUrl`** (deprecado; su DROP lo mide el CEO en PR aparte). Se recablean sus
  lectores vivos (`ContratoCard`, `suscripcion-vista.service`) al registro nuevo.
- **Copy (FORMA-SPEC796):** nunca «firmado digitalmente / válido / verificado / autenticado» (no
  validamos la firma); sí «registrado / en archivo». El estado SIN contrato queda INTACTO.
- **Retención:** el parámetro `contrato.colegio.retencion_dias` está `[ABOGADO]` sin valor. **Esta spec
  NO escribe un consumidor** del plazo (adjuntar/ver/registrar no lo necesitan; el borrado operativo
  preserva siempre, la purga demo borra siempre — ninguno lo lee). Un purgador por retención es SPEC
  futura y DEBE fallar fuerte ante el marcador (no asumir default).

## Candados

- `contrato-colegio-storage.test.ts` (unit): cifrado round-trip, id opaco, PDF-only, eliminar idempotente.
- `contrato-colegio.service.candado.test.ts` (integración): NO-FUGA con dato real plantado (el DTO del
  dueño trae SOLO `adjuntadoEn`, nunca archivoId/ruta/sha256) · aislamiento (otro colegio ve null) ·
  dueño lee el PDF / otro resuelve null · reemplazar = hecho nuevo (append-only). RED-first verificado
  (filtrar archivoId → rojo).
- `contrato-colegio-forma.candado.test.ts`: cero palabras de validez · SIN-contrato intacto byte a byte ·
  «Ver contrato» al endpoint guardado, no href crudo. Control positivo por mutación.

## Impacto en arquitectura:

- **Esquema:** SIN cambios propios — se USA el modelo `ContratoColegio` de Datos (#786). No se regenera
  `01-modelo-datos.md` desde esta rama (lo hace la de Datos).
- **Módulos nuevos:** storage, DAL `contrato-colegio.ts`, servicio, 3 rutas API (subida admin +
  descarga admin + descarga colegio), componente admin `AdjuntarContratoColegio`.
- **Proxy / navegación:** rutas nuevas bajo `api/admin/pagos/**` (módulo `pagos_admin`) y
  `api/colegio/contrato/**` (SCHOOL_ADMIN dueño). No se agrega ítem de menú ni pantalla nueva (se
  insertan en superficies existentes: ficha cliente admin · vista de suscripción del colegio).
- **Acceso a datos:** Q-3 — el servicio no importa el singleton de Prisma; usa el DAL. El registro es
  append-only; no se escribe `contratoPDFUrl`.
