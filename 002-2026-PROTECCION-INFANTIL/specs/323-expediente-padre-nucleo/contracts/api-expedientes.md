# Contrato API — Endpoints de Expediente (nuevos en SPEC-323)

**Fecha**: 2026-08-30

---

## GET /api/padre/expedientes/[id]

Retorna el detalle del expediente con los eventos propios del padre más el contexto de otros reportes (anonimizado por Ley 1581).

**Auth**: Bearer token, rol PARENT requerido.

**Guard de titularidad**: `Expediente.padreUsuarioId === usuarioId` — si no coincide → 403.

**Respuesta exitosa**:
```json
// HTTP 200
{
  "expediente": {
    "id": "<uuid>",
    "identificadorReportado": "XXX01",
    "fechaApertura": "2026-08-20T...",
    "estado": "ACTIVO",
    "numEventos": 2
  },
  "eventosPropioss": [
    {
      "id": "<uuid>",
      "ordenSecuencial": 1,
      "fechaEvento": "2026-08-01T...",
      "texto": "",
      "ciudad": "Medellín",
      "pais": "Colombia",
      "fechaIncidente": "2026-08-01",
      "clasificacion": "PENDIENTE"
    },
    {
      "id": "<uuid>",
      "ordenSecuencial": 2,
      "fechaEvento": "2026-08-20T...",
      "texto": "En esta ocasión el incidente fue...",
      "ciudad": "Bogotá",
      "pais": "Colombia",
      "fechaIncidente": "2026-08-20",
      "clasificacion": "POSIBLE_SPAM"
    }
  ],
  "contextroOtros": [
    {
      "fechaIncidente": "2026-08-15",
      "ciudad": "Cali",
      "pais": "Colombia",
      "clasificacion": "REVISION_MANUAL"
    }
  ]
}
```

**Ley 1581 — campos excluidos en `contextoOtros`**:
- `texto` — ausente del SELECT de Prisma
- `textoOriginal` — ausente del SELECT de Prisma
- `usuarioId` — ausente del SELECT de Prisma
- Ningún campo que identifique al autor

**Errores**:
- 401: No autenticado
- 403: `padreUsuarioId !== usuarioId`
- 404: Expediente no existe

---

## GET /api/padre/expedientes/[id]/pdf

Genera y retorna el PDF del expediente en memoria.

**Auth**: Bearer token, rol PARENT requerido. Misma verificación de titularidad.

**Respuesta exitosa**:
```
// HTTP 200
Content-Type: application/pdf
Content-Disposition: attachment; filename="expediente-XXX01-2026-08-30.pdf"
<binary buffer>
```

**Contenido del PDF**:
1. Carátula: datos del padre (nombre, email), identificador reportado, fecha de generación (timestamp Colombia)
2. Eventos propios: lista completa en orden cronológico (fecha/hora Colombia, ciudad, país, texto, clasificación)
3. Contexto: lista de reportes de otros (fecha, país, ciudad, clasificación — sin texto ni autor)

**Generación**: En memoria con pdfmake + `renderPdfBuffer`. El PDF no se almacena en disco ni en BD.

**Errores**:
- 401: No autenticado
- 403: `padreUsuarioId !== usuarioId`
- 404: Expediente no existe
- 500: Error de generación de PDF
