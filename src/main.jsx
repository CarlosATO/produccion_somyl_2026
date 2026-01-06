import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' // Asegúrate de que este archivo exista (Vite lo crea por defecto)
// Bootstrap styles
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import { AuthProvider } from './context/AuthContext'
import { Toaster } from 'sonner'; // Notificaciones bonitas

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
      <Toaster position="top-right" richColors />
    </AuthProvider>
  </React.StrictMode>,
)