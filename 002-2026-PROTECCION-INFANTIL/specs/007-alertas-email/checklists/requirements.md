# Checklist: Alertas por Email

**Purpose**: Verificar que las alertas por email funcionan correctamente y no exponen datos sensibles.
**Feature**: [spec.md](../spec.md)

## Funcionalidad

- [x] CHK001 `enviarAlertaRevision()` consulta administradores activos.
- [x] CHK002 `enviarAlertaScoreCritico()` consulta administradores activos.
- [x] CHK003 Ambas funciones respetan parámetros de activación.
- [x] CHK004 Las alertas se integran en `POST /api/reportes/procesar`.
- [x] CHK005 El envío es asíncrono y no bloquea el worker.

## Seguridad y privacidad

- [x] CHK006 Los emails no contienen `textoOriginal` ni PII.
- [x] CHK007 Si no hay admins activos, no se envía email ni se produce error.
- [x] CHK008 Si Resend falla, el procesamiento del reporte continúa.

## Tests y calidad

- [x] CHK009 Tests unitarios en `src/lib/email.test.ts`.
- [x] CHK010 Tests de integración en el route de procesamiento.
- [x] CHK011 Gate completo pasa: lint, test, build, e2e, tsc.
