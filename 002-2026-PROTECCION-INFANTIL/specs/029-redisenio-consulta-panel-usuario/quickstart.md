# Quickstart 029 · Rediseño de consulta pública + panel usuario

**Prerequisites**: App y worker corriendo en `http://localhost:5005`, base de datos poblada con al menos un reporte `CLASIFICADO`.

---

## 1. Consulta pública (anónimo)

```bash
curl "http://localhost:5005/api/consulta?identificador=30009000002"
```

**Esperado** (si hay reportes clasificados):
```json
{
  "identificador": "30009000002",
  "tieneReportes": true,
  "nivelRiesgo": "MEDIO",
  "confianzaPromedio": 0.82,
  "totalReportes": 3,
  "reportesAutenticados": 1,
  "reportesAnonimos": 2,
  "ultimoReporte": "2026-07-18T...",
  "plataformas": [...],
  "resumenPlataformas": "3 reportes en Discord y WhatsApp"
}
```

**Esperado** (sin reportes):
```json
{
  "identificador": "30009000002",
  "tieneReportes": false,
  "mensaje": "Sin reportes registrados para este identificador."
}
```

---

## 2. Panel de usuario autenticado

### 2.1 Login como PARENT

```bash
curl -X POST http://localhost:5005/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"parent@proteccion.local","password":"Parent123Test"}'
```

### 2.2 Abrir `/dashboard`

En navegador: `http://localhost:5005/dashboard`

**Esperado**: ver sección "Mis reportes" con los reportes del usuario y sección "Consulta enriquecida" con un buscador.

### 2.3 Consulta enriquecida autenticada

```bash
curl "http://localhost:5005/api/consulta/detalle?identificador=30009000002" \
  -b cookies.txt
```

**Esperado**:
```json
{
  "identificador": "30009000002",
  "nivelRiesgo": "MEDIO",
  "confianzaPromedio": 0.82,
  "totalReportes": 3,
  "plataformas": [...],
  "reportes": [
    {
      "id": "...",
      "plataforma": "Discord",
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

**No debe incluir**: `texto`, `textoOriginal`, `usuarioId`, `email` del denunciante, coordenadas exactas.

---

## 3. Verificar ausencia de "undefined" en plataforma

```bash
curl "http://localhost:5005/api/consulta?identificador=30009000002" | grep -i undefined
```

**Esperado**: sin coincidencias.

---

## 4. Ejecutar tests

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
npx tsx scripts/smoke-e2e.ts
```

**Meta**: todos verdes.

---

## 5. Escenarios de validación manuales

### Escenario A: Identificador con un solo reporte

**Dado**: 1 reporte clasificado con confianza 0.9.
**Cuando**: se consulta públicamente.
**Entonces**: el nivel de riesgo es MEDIO como máximo (nunca ALTO).

### Escenario B: Identificador con múltiples reportes graves

**Dado**: 3 reportes clasificados en `SOLICITUD_ENCUENTRO` o `COMPARTIMIENTO_SEXUAL` con confianza promedio > 0.8.
**Cuando**: se consulta públicamente.
**Entonces**: el nivel de riesgo es ALTO.

### Escenario C: Identificador con reportes en revisión

**Dado**: 1 reporte en `REVISION_MANUAL` y 0 clasificados.
**Cuando**: se consulta públicamente.
**Entonces**: se muestra "Sin reportes registrados" (no se exponen reportes en revisión).

### Escenario D: Usuario autenticado consulta identificador que él reportó y aún está en proceso

**Dado**: un usuario PARENT reportó `+57300111111` que está en `REVISION_MANUAL`.
**Cuando**: va a `/dashboard` y busca `+57300111111` en la consulta enriquecida.
**Entonces**: no aparece en la consulta enriquecida (solo clasificados), pero sí aparece en "Mis reportes" con estado "En proceso".

### Escenario E: Mapa con ubicaciones aproximadas

**Dado**: reportes de `Bogotá` y `Medellín`.
**Cuando**: usuario autenticado busca el identificador.
**Entonces**: el mapa muestra 2 puntos (coordenadas de cada ciudad), no coordenadas exactas de un domicilio.

---

## 6. Rollback rápido

```bash
git revert <commit-spec-029>
```

Restaurar los archivos anteriores y reiniciar app + worker.
