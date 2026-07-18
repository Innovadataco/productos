# Quickstart: Rediseño del Home

**Prerequisites**: Servidor de desarrollo en `http://localhost:5005` o build de producción corriendo.

---

## 1. Iniciar el servidor

```bash
npm run dev
# o, para validar producción:
npm run build && npm start
```

Servidor en `http://localhost:5005`.

---

## 2. Validar escenarios de la landing

### Escenario A: Home muestra acciones principales

```bash
curl -s http://localhost:5005/ | grep -E "Protege a quienes más importan|Crear un reporte|Consultar|Crear una cuenta|Ver estadísticas"
```

**Esperado**: Todos los textos aprobados están presentes en el HTML renderizado.

### Escenario B: Navegación a reportar

```bash
curl -s http://localhost:5005/ | grep -o 'href="/reportar"'
```

**Esperado**: Al menos un enlace a `/reportar`.

### Escenario C: Navegación a consulta y registro

```bash
curl -s http://localhost:5005/ | grep -oE 'href="#consultar"|href="/registro"|href="/dashboard/publico"'
```

**Esperado**:Enlaces a `#consultar`, `/registro` y `/dashboard/publico`.

---

## 3. Validar consulta desde el home

### Escenario D: Consulta con reportes

```bash
curl -X GET "http://localhost:5005/api/consulta?identificador=30009000002" -H "Accept: application/json"
```

**Esperado**: Respuesta JSON con datos del identificador (si existe y tiene visibilidad).

### Escenario E: Consulta sin reportes o inexistente

```bash
curl -X GET "http://localhost:5005/api/consulta?identificador=NOEXISTE123" -H "Accept: application/json"
```

**Esperado**: Respuesta controlada sin crash (mensaje de "no encontrado" o similar).

---

## 4. Ejecutar tests

```bash
npm run test
```

**Meta**: Todos los tests de UI pasan, especialmente los de landing/consulta.

---

## 5. Verificar build

```bash
npm run build
```

**Esperado**: Compila sin errores de TypeScript.

---

## 6. Responsive (manual)

1. Abrir `http://localhost:5005/` en modo móvil (ancho < 640 px).
2. Confirmar que las dos acciones principales se apilan verticalmente.
3. Confirmar que los textos son legibles y los botones tocables.
