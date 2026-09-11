// Base de la API en un solo lugar: el flyer y el dashboard deben apuntar al
// mismo backend, si no las pruebas en local pegan a produccion.
const HOST = window.location.hostname;
const IS_DEV = HOST === 'localhost' || HOST === '127.0.0.1';

export const API_BASE_URL = IS_DEV
  ? (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000')
  : 'https://api-sensory-groove2.fadexlabs.com';
