# Quickstart: SPEC-110 — Apelación del identificador reportado

**Prerequisitos**: app + BD levantados (`./scripts/dev-restart.sh`), migración aplicada
(`npm run db:migrate`), seed ejecutado (`npm run db:seed`), un usuario PARENT y un
usuario COMITE_VALIDACION activos, y el worker corriendo (lo levanta dev-restart).

## 1. Radicar una apelación (apelante)

1. Entra a `http://localhost:5005/login` con la cuenta PARENT.
2. En el panel (`/dashboard`) pulsa **"Apelar un identificador"** → `/dashboard/apelaciones`.
3. Verifica que se muestran los canales oficiales (Línea 141 ICBF, CAI Virtual, Te Protejo)
   y el texto que explica el plazo (15 días hábiles) y que NO verás contenido de reportes.
4. Diligencia: identificador (p. ej. `+573001112233`), plataforma, motivo, y adjunta un
   PDF (≤ 5 MB). Envía.
5. **Esperado**: mensaje de radicado con número `APL-...`, estado RECIBIDA y fecha de
   plazo. En la consulta pública el identificador NO cambia (apelar no oculta nada).
6. Pruebas negativas: adjuntar un `.txt` → error de tipo; un PDF > 5 MB → error de tamaño;
   sin sesión (POST directo) → 401.

## 2. Revisar como comité

1. Entra con la cuenta COMITE_VALIDACION → `/dashboard/admin/comite` → tab **Apelaciones**.
2. **Esperado**: el caso en la bandeja con estado RECIBIDA, días hábiles transcurridos y
   plazo. Abre el detalle: motivo, acreditación (si aplica), metadatos del documento.
3. Pulsa **Tomar caso** → estado EN_REVISION.
4. Pulsa **Descargar evidencia** → se abre el PDF descifrado.
   Verifica auditoría: `SELECT * FROM "AuditLog" WHERE accion='APELACION_DOCUMENTO_ACCESO';`
   y la fila en `"AccesoDocumentoApelacion"`.
5. Con la cuenta ADMIN u OPERADOR, intenta la URL del documento → **403**.

## 3. Resolver

- **Aceptar con quitar visibilidad**: marca la opción, escribe motivación, resuelve.
  **Esperado**: en la consulta pública/dashboard el identificador deja de mostrarse como
  visible (`esVisiblePublicamente=false`). Crea luego un reporte NUEVO sobre el mismo
  identificador: el ocultamiento se levanta (reglas normales).
- **Aceptar con baja de reportes**: selecciona reportes del identificador, motivación,
  resuelve. **Esperado**: esos reportes quedan eliminados con motivo REPORTE_FALSO.
- **Rechazar**: motivación, resuelve. **Esperado**: nada cambia; el apelante ve la
  decisión y la motivación en su área y puede volver a apelar.

## 4. Mantenimiento (job diario)

- Aviso: con una apelación sin resolver creada hace ≥ 10 días hábiles (o baja el
  parámetro `apelacion.aviso_previo_dias`), corre el job (o espera la programación
  06:00): el comité recibe el email digest y hay AuditLog `APELACION_AVISO_PLAZO`.
- Purga: con una apelación resuelta hace ≥ 30 días (o baja
  `apelacion.retencion_documento_dias`), corre el job: el `.enc` desaparece de
  `storage/apelaciones/`, el registro conserva metadatos (`eliminadoEn`) y hay AuditLog
  `APELACION_DOCUMENTO_PURGADO`. La descarga posterior responde 410.
- Ejecución manual del mantenimiento (dev):
  `node --env-file=.env -e "import('./src/lib/apelacion-mantenimiento.ts').then(m => m.ejecutarMantenimientoApelaciones())"`

## 5. Parámetros (efecto observable)

En `/dashboard/admin/configuracion` (o BD): cambia `apelacion.max_tamano_documento_mb`
y repite el upload; cambia `apelacion.aviso_previo_dias` y revisa la marca de próximo a
vencer en la bandeja.
