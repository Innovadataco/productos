# 09 — Estrategia de Pruebas

## 9.1 Pirámide de Pruebas

```
         ┌─────────┐
         │   E2E   │  ~5%  (Flujos críticos de usuario)
         ├─────────┤
         │Integration│ ~20% (API endpoints, repos, servicios)
         ├─────────┤
         │  Unit   │ ~75%  (Lógica de dominio, utilidades)
         └─────────┘
```

**Cobertura objetivo:** Mínimo 80% en backend, 70% en frontend.

---

## 9.2 Pruebas Unitarias

### Backend (Vitest)

| Área | Enfoque | Ejemplos |
|------|---------|----------|
| Dominio | Lógica pura, sin dependencias | Validación de contraseñas, resolución de permisos |
| Aplicación | Casos de uso con mocks | Registro de usuario, cambio de configuración |
| Infraestructura | Utilidades | Cifrado, hashing, serialización |

```typescript
// tests/unit/domain/password-validation.spec.ts
import { describe, it, expect } from 'vitest';
import { validatePassword } from '@/core/utils/password';

describe('validatePassword', () => {
  it('should accept a strong password', () => {
    expect(validatePassword('Segura123!ABC')).toBe(true);
  });

  it('should reject short passwords', () => {
    expect(validatePassword('Short1!')).toBe(false);
  });

  it('should reject passwords without numbers', () => {
    expect(validatePassword('SinNumeros!')).toBe(false);
  });

  it('should reject passwords without symbols', () => {
    expect(validatePassword('SinSimbolos123')).toBe(false);
  });

  it('should reject common passwords via HIBP check', async () => {
    const result = await validatePassword('password123!');
    expect(result).toBe(false);
  });
});
```

### Frontend (Vitest + React Testing Library)

| Área | Enfoque | Ejemplos |
|------|---------|----------|
| Componentes | Renderizado, interacciones | Formularios de login, modales |
| Hooks | Lógica reactiva | useAuth, useFormValidation |
| Utilidades | Funciones puras | Formatters, validators |

```typescript
// tests/unit/components/LoginForm.spec.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginForm } from '@/modules/auth/components/LoginForm';

describe('LoginForm', () => {
  it('shows validation errors on empty submit', async () => {
    render(<LoginForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Iniciar sesión'));
    
    expect(await screen.findByText('El correo es requerido')).toBeInTheDocument();
  });

  it('submits with valid data', async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    
    fireEvent.change(screen.getByLabelText('Correo'), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'Segura123!ABC' }
    });
    fireEvent.click(screen.getByText('Iniciar sesión'));
    
    expect(onSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'Segura123!ABC'
    });
  });
});
```

---

## 9.3 Pruebas de Integración

### API (Supertest + Test Database)

```typescript
// tests/integration/auth/login.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp } from '../helpers/test-app';
import { prisma } from '../helpers/test-db';

describe('POST /api/v1/auth/login', () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        email: 'test@example.com',
        passwordHash: await hashPassword('Segura123!ABC'),
        status: 'ACTIVE',
        emailVerifiedAt: new Date()
      }
    });
  });

  it('returns tokens for valid credentials', async () => {
    const app = await createTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'Segura123!ABC'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.user.email).toBe('test@example.com');
  });

  it('returns 401 for invalid password', async () => {
    const app = await createTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'WrongPassword!'
      }
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 423 for locked account', async () => {
    // Simular 5 intentos fallidos
    const app = await createTestApp();
    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'WrongPassword!'
        }
      });
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'Segura123!ABC'
      }
    });

    expect(res.statusCode).toBe(423);
  });
});
```

### Base de Datos (Prisma + Testcontainers)

- Base de datos PostgreSQL efímera por suite de pruebas.
- Migraciones aplicadas automáticamente antes de cada suite.
- Seed data para roles y permisos.
- Rollback/transacciones para aislamiento entre tests.

---

## 9.4 Pruebas End-to-End

### Flujos Críticos a Probar

| ID | Flujo | Herramienta |
|----|-------|-------------|
| E2E-001 | Registro → Verificación email → Login | Playwright |
| E2E-002 | Login → Activar 2FA → Logout → Login con TOTP | Playwright |
| E2E-003 | Login como admin → Modificar parámetro → Verificar en frontend | Playwright |
| E2E-004 | Recuperación de contraseña completa | Playwright |
| E2E-005 | Revocación de sesiones (logout-all) | Playwright |

```typescript
// e2e/auth-flow.spec.ts
import { test, expect } from '@playwright/test';

test('complete registration and login flow', async ({ page }) => {
  // 1. Registro
  await page.goto('/register');
  await page.fill('[name="email"]', 'e2e-test@example.com');
  await page.fill('[name="password"]', 'Segura123!ABC');
  await page.fill('[name="name"]', 'Usuario E2E');
  await page.click('button[type="submit"]');
  
  await expect(page.locator('[data-testid="success-message"]'))
    .toContainText('Verifica tu correo');

  // 2. Simular verificación (en test, usamos API directa)
  const verificationToken = await getVerificationToken('e2e-test@example.com');
  await page.goto(`/verify-email?token=${verificationToken}`);

  // 3. Login
  await page.goto('/login');
  await page.fill('[name="email"]', 'e2e-test@example.com');
  await page.fill('[name="password"]', 'Segura123!ABC');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/dashboard');
});
```

---

## 9.5 Pruebas de Seguridad

| Tipo | Herramienta | Frecuencia |
|------|-------------|------------|
| Escaneo de dependencias | `npm audit`, Snyk | Cada PR |
| Escaneo de vulnerabilidades en contenedores | Trivy | Cada build |
| Análisis estático de código | Semgrep, CodeQL | Cada PR |
| Pruebas de penetración automatizadas | OWASP ZAP | Semanal en staging |
| Revisión de configuración de seguridad | Prowler (AWS) | Mensual |

### Casos de Prueba Específicos de Seguridad

```typescript
// tests/security/rate-limit.spec.ts
describe('Rate limiting', () => {
  it('blocks after 10 login attempts', async () => {
    const app = await createTestApp();
    
    for (let i = 0; i < 10; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'test@example.com', password: 'wrong' }
      });
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'test@example.com', password: 'wrong' }
    });

    expect(res.statusCode).toBe(429);
  });
});

describe('Authorization bypass', () => {
  it('prevents PARENT from accessing admin endpoints', async () => {
    const app = await createTestApp();
    const parentToken = await loginAs('parent@example.com', 'PARENT');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/config',
      headers: { Authorization: `Bearer ${parentToken}` }
    });

    expect(res.statusCode).toBe(403);
  });
});
```

---

## 9.6 Pruebas de Rendimiento

| Escenario | Herramienta | Objetivo |
|-----------|-------------|----------|
| Carga sostenida | k6 | 1000 usuarios concurrentes, p95 < 500ms |
| Pico de autenticación | k6 | 500 logins/minuto sin errores |
| Recuperación ante fallos | Chaos Monkey | Tolerancia a caída de 1 instancia |
| Prueba de estrés | k6 | Identificar punto de ruptura |

```javascript
// tests/performance/login-load.js (k6)
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.post('https://api.proteccion-infantil.org/api/v1/auth/login', {
    email: `user${__VU}@test.com`,
    password: 'Segura123!ABC',
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

---

## 9.7 Entornos de Prueba

| Entorno | Pruebas | Datos | Acceso |
|---------|---------|-------|--------|
| `test` (local) | Unitarias, integración rápida | SQLite/PostgreSQL efímero | Desarrollador |
| `ci` (GitHub Actions) | Unitarias, integración, seguridad | PostgreSQL en container | Automático |
| `staging` | E2E, rendimiento, penetración | Snapshot anonimizado | QA + Automático |
| `production` | Smoke tests, monitoreo | Datos reales | Solo lectura, monitoreo |

---

## 9.8 Reportes y Calidad

### Métricas de Calidad

| Métrica | Objetivo | Herramienta |
|---------|----------|-------------|
| Cobertura de código | ≥ 80% backend, ≥ 70% frontend | Vitest coverage |
| Vulnerabilidades críticas | 0 | Snyk, Trivy |
| Vulnerabilidades altas | 0 | Snyk, Trivy |
| Deuda técnica | < 5% del tiempo de sprint | SonarQube |
| Bugs en producción | < 2 por sprint | Jira/Linear |

### Definición de Listo (Definition of Done)

- [ ] Código revisado por al menos 1 par.
- [ ] Pruebas unitarias escritas y pasando.
- [ ] Pruebas de integración escritas para nuevos endpoints.
- [ ] Documentación de API actualizada (OpenAPI).
- [ ] Sin vulnerabilidades críticas ni altas.
- [ ] Cobertura de código no disminuye.
- [ ] Pruebas E2E pasan en staging.