/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta "Red Underground", derivada del flyer de referencia:
        // tubos de neón rojo sobre humo rojo oscuro y negro absoluto.
        sg: {
          neon: '#ff0a2e', // rojo neón principal (bordes, acentos)
          glow: '#ff3355', // halo del neón
          blood: '#a30018', // rojo profundo (degradados)
          ember: '#3d0009', // humo rojo oscuro
          void: '#080003', // fondo casi negro
          panel: 'rgba(9, 0, 3, 0.74)', // cristal translucido de los paneles
          warn: '#ffcc00', // se conserva el amarillo del aviso de la V1
        },
      },
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        rajdhani: ['Rajdhani', 'sans-serif'],
      },
      boxShadow: {
        neon: '0 0 20px rgba(255, 10, 46, 0.18), inset 0 0 12px rgba(255, 10, 46, 0.06)',
        'neon-sm': '0 0 12px rgba(255, 10, 46, 0.2)',
        'neon-lg': '0 0 32px rgba(255, 10, 46, 0.45)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '48%': { opacity: '1' },
          '50%': { opacity: '0.72' },
          '52%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out both',
        flicker: 'flicker 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
