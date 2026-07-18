# Quickstart: Rediseño completo del Home

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

### Escenario A: Barra superior simplificada

```bash
curl -s http://localhost:5005/ | grep -oE 'Dashboard|Iniciar sesión|Consultar|Reportar' | sort | uniq -c
```

**Esperado**: `Dashboard` e `Iniciar sesión` presentes; `Consultar` y `Reportar` ausentes del HTML renderizado.

### Escenario B: Hero muestra tarjetas, botones de reporte y buscador integrado

```bash
curl -s http://localhost:5005/ | grep -E "Protege a quienes más importan|Crear un reporte|Elige cómo deseas reportar|Reportar anónimo|Reportar con mi cuenta|Consultar|Busca un número, nick o usuario|Buscar|Canales oficiales de denuncia"
```

**Esperado**: Todos los textos aprobados están presentes.

### Escenario C: Botones de reporte navegan correctamente

```bash
curl -s http://localhost:5005/ | grep -oE 'href="/reportar"|href="/login\?redirect=/reportar"'
```

**Esperado**: Ambos enlaces presentes.

### Escenario D: Sin secciones eliminadas

```bash
curl -s http://localhost:5005/ | grep -oE '¿Cómo funciona\?|Crear una cuenta|Ver estadísticas|Reportar</a>'
```

**Esperado**: Ninguna de estas cadenas aparece en el HTML.

### Escenario E: Footer con copyright correcto

```bash
curl -s http://localhost:5005/ | grep -o '© 2026 Innovadataco'
```

**Esperado**: El copyright aparece exactamente.

---

## 3. Validar acceso anónimo a `/reportar`

### Escenario F: Usuario anónimo llega al wizard

```bash
curl -I http://localhost:5005/reportar
```

**Esperado**: HTTP 200, sin `location: /login`.

```bash
curl -s http://localhost:5005/reportar | grep -oE 'Nuevo reporte|Completa los siguientes pasos|Verificando sesión'
```

**Esperado**: Al menos una de las cadenas del wizard aparece.

### Escenario G: Usuario interno logueado en `/reportar` ve bloqueo (bug 021)

Iniciar sesión como ADMIN/OPERADOR y navegar a `/reportar`.

**Esperado**: El wizard muestra el mensaje de bloqueo de cuentas internas con opción de cerrar sesión.

---

## 4. Validar consulta desde el buscador integrado

### Escenario H: Consulta sin reportes

Ingresar un identificador inexistente en el buscador de la tarjeta "Consultar" y presionar "Buscar".

**Esperado**: Mensaje de "Sin reportes registrados" dentro de la tarjeta.

### Escenario I: Consulta con pocos reportes (1-2)

Ingresar un identificador con 1 o 2 reportes visibles.

**Esperado**: Resumen compacto inline dentro de la tarjeta.

### Escenario J: Consulta con muchos reportes (>2)

Ingresar un identificador con más de 2 reportes visibles.

**Esperado**: Resumen agregado con enlace a la vista completa `/consulta`.

### Escenario K: Campo vacío

Presionar "Buscar" con el input vacío.

**Esperado**: El formulario muestra "Ingresa un número, nick o usuario." dentro de la tarjeta y no ejecuta la consulta.

---

## 5. Ejecutar tests

```bash
npm run test
```

**Meta**: Todos los tests de UI pasan.

---

## 6. Verificar build

```bash
npm run build
```

**Esperado**: Compila sin errores de TypeScript.

---

## 7. Responsive (manual)

1. Abrir `http://localhost:5005/` en modo móvil (ancho < 640 px).
2. Confirmar que las dos tarjetas se apilan verticalmente.
3. Confirmar que los botones de reporte y el buscador se ven bien.
4. Confirmar que los textos son legibles y los botones tocables.

---

## 8. Smoke E2E

```bash
npx tsx scripts/smoke-e2e.ts
```

**Esperado**: Smoke test pasa (8/8 pasos).

---

## 9. Prueba en incógnito (manual)

1. Abrir navegador en incógnito en `http://localhost:5005/`.
2. Hacer clic en "Reportar anónimo".
3. **Esperado**: se llega al wizard de reporte (`/reportar`) sin redirigir a `/login`.
4. Hacer clic en "Reportar con mi cuenta".
5. **Esperado**: se llega a `/login?redirect=/reportar`; tras iniciar sesión como PARENT, se redirige a `/reportar`.
