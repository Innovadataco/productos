/**
 * Script de prueba para la gestión de módulos por usuario
 *
 * Uso:
 * 1. Instalar dependencias: npm install axios
 * 2. Configurar las variables de entorno
 * 3. Ejecutar: node tests/test_modulos_usuario.js
 */

const axios = require('axios')

// Configuración
const API_URL = process.env.API_URL || 'http://localhost:3333'
const USERNAME = process.env.TEST_USERNAME || 'admin'
const PASSWORD = process.env.TEST_PASSWORD || 'admin123'

let token = null

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

async function login() {
  try {
    log('\n🔐 Iniciando sesión...', 'blue')
    const response = await axios.post(`${API_URL}/api/v1/auth/login`, {
      usuario: USERNAME,
      clave: PASSWORD
    })
    token = response.data.data.token
    log('✅ Sesión iniciada correctamente', 'green')
    return true
  } catch (error) {
    log(`❌ Error al iniciar sesión: ${error.message}`, 'red')
    return false
  }
}

async function asignarModulos(usuarioId, modulosIds) {
  try {
    log(`\n📝 Asignando módulos [${modulosIds.join(', ')}] al usuario ${usuarioId}...`, 'blue')
    const response = await axios.post(
      `${API_URL}/api/v1/usuarios/${usuarioId}/modulos`,
      { modulos: modulosIds },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    log('✅ Módulos asignados correctamente', 'green')
    console.log(response.data)
    return response.data
  } catch (error) {
    log(`❌ Error: ${error.response?.data?.messages || error.message}`, 'red')
  }
}

async function obtenerModulos(usuarioId) {
  try {
    log(`\n🔍 Obteniendo módulos del usuario ${usuarioId}...`, 'blue')
    const response = await axios.get(
      `${API_URL}/api/v1/usuarios/${usuarioId}/modulos`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    log('✅ Módulos obtenidos:', 'green')
    console.log(JSON.stringify(response.data.data.modulos, null, 2))
    return response.data
  } catch (error) {
    log(`❌ Error: ${error.response?.data?.messages || error.message}`, 'red')
  }
}

async function limpiarModulos(usuarioId) {
  try {
    log(`\n🧹 Limpiando módulos personalizados del usuario ${usuarioId}...`, 'blue')
    const response = await axios.delete(
      `${API_URL}/api/v1/usuarios/${usuarioId}/modulos/limpiar`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    log('✅ Módulos limpiados correctamente', 'green')
    console.log(response.data)
    return response.data
  } catch (error) {
    log(`❌ Error: ${error.response?.data?.messages || error.message}`, 'red')
  }
}

async function runTests() {
  log('═══════════════════════════════════════════════', 'yellow')
  log('  TEST: GESTIÓN DE MÓDULOS POR USUARIO', 'yellow')
  log('═══════════════════════════════════════════════', 'yellow')

  // Login
  const loginSuccess = await login()
  if (!loginSuccess) {
    log('\n❌ No se pudo iniciar sesión. Abortando tests.', 'red')
    return
  }

  // Cambiar este ID por un usuario de prueba real
  const USUARIO_TEST_ID = 5

  log('\n--- Test 1: Obtener módulos actuales ---', 'yellow')
  await obtenerModulos(USUARIO_TEST_ID)

  log('\n--- Test 2: Asignar módulos personalizados ---', 'yellow')
  await asignarModulos(USUARIO_TEST_ID, [1, 2])

  log('\n--- Test 3: Verificar módulos personalizados ---', 'yellow')
  await obtenerModulos(USUARIO_TEST_ID)

  log('\n--- Test 4: Cambiar módulos personalizados ---', 'yellow')
  await asignarModulos(USUARIO_TEST_ID, [1, 3, 4])

  log('\n--- Test 5: Verificar nuevos módulos ---', 'yellow')
  await obtenerModulos(USUARIO_TEST_ID)

  log('\n--- Test 6: Limpiar módulos personalizados ---', 'yellow')
  await limpiarModulos(USUARIO_TEST_ID)

  log('\n--- Test 7: Verificar herencia del rol ---', 'yellow')
  await obtenerModulos(USUARIO_TEST_ID)

  log('\n═══════════════════════════════════════════════', 'yellow')
  log('  TESTS COMPLETADOS', 'yellow')
  log('═══════════════════════════════════════════════', 'yellow')
}

// Ejecutar tests
runTests().catch(error => {
  log(`\n❌ Error fatal: ${error.message}`, 'red')
  process.exit(1)
})
