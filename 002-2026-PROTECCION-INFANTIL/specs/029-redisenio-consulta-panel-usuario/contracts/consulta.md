# Contracts · Consulta pública y enriquecida (Spec 029)

---

## GET /api/consulta?identificador={identificador}

**Auth**: none (rate-limited por IP).

**Response 200 (con reportes)**:
```json
{
  "identificador": "30009000002",
  "tieneReportes": true,
  "visibleEnDashboard": true,
  "nivelRiesgo": "MEDIO",
  "confianzaPromedio": 0.82,
  "totalReportes": 3,
  "reportesAutenticados": 1,
  "reportesAnonimos": 2,
  "primerReporte": "2026-07-10T...",
  "ultimoReporte": "2026-07-18T...",
  "plataformas": [
    { "id": "...", "nombre": "Discord", "clave": "discord", "total": 2, "otraPlataforma": null },
    { "id": "...", "nombre": "WhatsApp", "clave": "whatsapp", "total": 1, "otraPlataforma": null }
  ],
  "ubicaciones": [...],
  "timeline": [...],
  "resumen": "Se han reportado 3 vez(es)...",
  "resumenPlataformas": "3 reportes en Discord y WhatsApp"
}
```

**Response 200 (sin reportes)**:
```json
{
  "identificador": "30009000002",
  "tieneReportes": false,
  "mensaje": "Sin reportes registrados para este identificador."
}
```

**Response 429**: rate limit excedido.

---

## GET /api/consulta/detalle?identificador={identificador}

**Auth**: requiere sesión de usuario con rol `PARENT` (cookie `token`).

**Response 200 (con reportes)**:
```json
{
  "identificador": "30009000002",
  "nivelRiesgo": "MEDIO",
  "confianzaPromedio": 0.82,
  "totalReportes": 3,
  "reportesAutenticados": 1,
  "reportesAnonimos": 2,
  "ultimoReporte": "2026-07-18T...",
  "plataformas": [...],
  "resumenPlataformas": "3 reportes en Discord y WhatsApp",
  "reportes": [
    {
      "id": "...",
      "plataforma": "Discord",
      "esAnonimo": false,
      "fecha": "2026-07-18",
      "categoria": "SOLICITUD_MATERIAL",
      "categoriaLabel": "Solicitud de material",
      "confianza": 0.85,
      "nivelRiesgo": "ALTO"
    }
  ],
  "ubicaciones": [
    { "pais": "Colombia", "ciudad": "Bogotá", "lat": 4.711, "lng": -74.072, "total": 3 }
  ]
}
```

**Response 200 (sin reportes)**:
```json
{
  "identificador": "30009000002",
  "tieneReportes": false,
  "mensaje": "Sin reportes registrados para este identificador."
}
```

**Response 401**: no autenticado.
**Response 403**: rol distinto a PARENT.
**Response 429**: rate limit excedido.

---

## Notas de privacidad

- Ambos endpoints omiten `texto`, `textoOriginal`, `usuarioId`, `fuenteConfianza` y PII.
- `/api/consulta/detalle` solo incluye reportes en estados `CLASIFICADO` o `CORREGIDO`.
- Las coordenadas del mapa son de `Ciudad.lat/lng`, no de un domicilio exacto.
