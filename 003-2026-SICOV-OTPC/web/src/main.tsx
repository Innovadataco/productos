import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import './index.css'
import './app/layout.css'

import { AuthProvider, Protegido } from './auth/auth'
import Layout from './app/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Despachos from './pages/Despachos'
import Llegadas from './pages/Llegadas'
import Integradora from './pages/Integradora'
import Mantenimientos from './pages/Mantenimientos'
import Novedades from './pages/Novedades'
import Soportes from './pages/Soportes'
import Terminales from './pages/Terminales'
import Empresas from './pages/Empresas'
import Usuarios from './pages/Usuarios'

const qc = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/app" element={<Protegido><Layout /></Protegido>}>
              <Route index element={<Dashboard />} />
              <Route path="despachos" element={<Despachos />} />
              <Route path="llegadas" element={<Llegadas />} />
              <Route path="integradora" element={<Integradora />} />
              <Route path="mantenimientos" element={<Mantenimientos />} />
              <Route path="novedades" element={<Novedades />} />
              <Route path="soportes" element={<Soportes />} />
              <Route path="terminales" element={<Terminales />} />
              <Route path="empresas" element={<Empresas />} />
              <Route path="usuarios" element={<Protegido roles={[1]}><Usuarios /></Protegido>} />
            </Route>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
