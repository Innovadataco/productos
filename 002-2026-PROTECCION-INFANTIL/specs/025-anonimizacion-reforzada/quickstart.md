> # Quickstart — Anonimización reforzada + encriptación del original

## Escenario A: Crear reporte guarda textoOriginal cifrado

**Prerrequisitos**: Endpoint de creación de reportes funcionando.

1. Crear reporte con texto que contenga PII:
```json
{
  "identificador": "3001234567",
  "plataforma": "whatsapp",
  "texto": "Mi hija María estudia en el colegio San José y recibió mensajes de este número."
}
```

2. Verificar en BD:
```sql
SELECT "texto", "textoOriginal" FROM "Reporte" ORDER BY "creadoEn" DESC LIMIT 1;
```

**Validación**:
- `texto` no contiene "María" ni "San José".
- `textoOriginal` comienza con `enc:`.

**Esperado**: `textoOriginal` cifrado; `texto` anonimizado.

---

## Escenario B: Operador no ve quién reportó

**Prerrequisitos**: Reporte autenticado creado por `parent@ejemplo.com`; operador logueado.

1. Operador llama `GET /api/admin/reportes-revision/[id]`.

**Validación**:
- La respuesta NO incluye `usuario.email`, `usuario.nombre`, `usuarioId` ni `textoOriginal`.
- Incluye solo `texto` (anonimizado), `identificador`, `estado`, `clasificacion`.

**Esperado**: `200`; sin datos del denunciante.

---

## Escenario C: Revelar original requiere autorización y deja audit log

**Prerrequisitos**: Reporte con `textoOriginal` cifrado; admin logueado.

1. Admin llama `POST /api/admin/reportes/[id]/revelar-original`.

**Validación**:
- Respuesta incluye `textoOriginal` descifrado.
- Se crea registro en `AuditLog` con `accion = TEXTO_ORIGINAL_REVELADO`, `recursoId = reporteId`, `usuarioId = adminId`.

**Esperado**: `200`; auditoría presente.

---

## Escenario D: Operador valida anonimización

**Prerrequisitos**: Reporte en estado `REQUIERE_ANONIMIZACION`; operador logueado.

1. Operador revisa `texto` anonimizado.
2. Llamar `POST /api/admin/reportes/[id]/validar-anonimizacion` con `{ "valida": true }`.

**Validación**:
- `Reporte.estado` pasa a `CLASIFICADO`.
- `Reporte.anonimizacionValidadaPorId` = id del operador.
- `Reporte.anonimizacionValidadaEn` no es null.
- Se registra transición en `TransicionReporte` con `responsableTipo: OPERADOR`.

**Esperado**: `200`.

---

## Escenario E: Operador rechaza anonimización y pide ajuste

**Prerrequisitos**: Reporte en `REQUIERE_ANONIMIZACION`; operador detecta que aún queda PII.

1. Llamar `POST /api/admin/reportes/[id]/validar-anonimizacion` con:
```json
{
  "valida": false,
  "observaciones": "Aún aparece el nombre del colegio"
}
```

**Validación**:
- Reporte permanece en `REQUIERE_ANONIMIZACION`.
- Se registra `AuditLog` `ANONIMIZACION_RECHAZADA`.

**Esperado**: `200`; el reporte vuelve a la cola de ajuste.

---

## Escenario F: Dataset de entrenamiento solo ve texto anonimizado

**Prerrequisitos**: Corrección admin creada a partir de un reporte anonimizado.

1. Verificar en BD:
```sql
SELECT "texto", "textoAnonimizado" FROM "DatasetEntrenamiento" WHERE "correccionId" = '...';
```

**Validación**:
- `texto` no contiene PII del denunciante ni de la víctima.
- `textoAnonimizado = true`.

**Esperado**: Dataset seguro.

---

## Escenario G: Comité tampoco ve denunciante

**Prerrequisitos**: Reporte escalado al comité.

1. Miembro del comité llama `GET /api/admin/comite/[id]` (detalle de solicitud).

**Validación**: La respuesta no incluye `usuarioId`, `email`, `nombre` del denunciante ni `textoOriginal`.

**Esperado**: `200`; privacidad respetada igual que para operador.

---

## Escenario H: Intento de revelar original sin permisos

**Prerrequisitos**: Operador logueado; reporte con `textoOriginal` cifrado.

1. Operador intenta `POST /api/admin/reportes/[id]/revelar-original`.

**Validación**: Respuesta `403`.

**Esperado**: Solo ADMIN puede revelar original (bajo política definida).
