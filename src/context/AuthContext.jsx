import React, { createContext, useContext, useState, useEffect } from 'react';
// Decodificador JWT ligero (evita dependencia externa en el runtime)
function decodeJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(payload)
        .split("")
        .map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );
    return JSON.parse(json);
  } catch (e) {
    console.warn('decodeJwt failed', e);
    return null;
  }
}
import { supabase } from '../services/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState({});

  useEffect(() => {
    const initializeAuth = async () => {
      // 1. Buscar token en URL
      const params = new URLSearchParams(window.location.search);
      let token = params.get('token');
      
      // Si hay token en URL, lo guardamos y limpiamos la barra de direcciones
      if (token) {
        window.history.replaceState({}, document.title, "/");
        localStorage.setItem('sso_token', token);
      } else {
        // Si no, buscamos si ya estaba guardado de antes
        token = localStorage.getItem('sso_token');
      }

      if (token) {
        try {
          // 2. Decodificar Token para ver datos básicos
          const decoded = decodeJwt(token);
          
          // Verificar si expiró
          const currentTime = Date.now() / 1000;
          if (decoded.exp < currentTime) {
            console.warn("⚠️ Token expirado");
            handleLogout();
            return;
          }

          // 3. INYECTAR EL TOKEN EN SUPABASE (¡Paso Crucial!)
          // Evitamos usar setSession() porque provoca 500 en este entorno.
          // Inyectamos el token en las cabeceras REST para que PostgREST/Supabase lo reciba.
          try {
            if (supabase && supabase.rest) {
              supabase.rest.headers = supabase.rest.headers || {};
              supabase.rest.headers['Authorization'] = `Bearer ${token}`;
            } else if (supabase && supabase.auth && typeof supabase.auth.setAuth === 'function') {
              // Fallback: usar setAuth si está disponible (no setSession)
              supabase.auth.setAuth(token);
            }
          } catch (err) {
            console.warn('No fue posible inyectar token en supabase client:', err);
          }

          // 4. Guardar estado del usuario en la memoria de la App
          setUser({
            id: decoded.sub, // Tu ID real de usuarios_sso
            email: decoded.email,
            full_name: decoded.full_name || decoded.email,
          });

          // Guardamos los roles que vienen del portal
          setRoles(decoded.roles || {});

        } catch (error) {
          console.error("🚨 Error procesando token:", error);
          handleLogout();
        }
      } else {
        // Si no hay token y no estamos en localhost, mandar al login
        if (window.location.hostname !== 'localhost') {
            window.location.href = import.meta.env.VITE_PORTAL_URL;
        }
      }
      
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('sso_token');
    setUser(null);
    window.location.href = import.meta.env.VITE_PORTAL_URL; // Volver al portal
  };

  return (
    <AuthContext.Provider value={{ user, roles, loading, logout: handleLogout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
