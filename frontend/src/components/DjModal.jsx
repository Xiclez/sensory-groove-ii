import { useEffect, useRef } from 'react';
import InstagramIcon from './InstagramIcon';

export default function DjModal({ dj, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    // Bloquea el scroll del fondo mientras el modal esta abierto.
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previo;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={dj.nombre}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-fade-in relative w-full max-w-[350px] rounded-xl border border-sg-neon bg-sg-void p-5 text-center shadow-neon-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          aria-label="Cerrar"
          className="absolute right-4 top-2 cursor-pointer text-[28px] font-bold leading-none text-sg-glow hover:text-white"
          onClick={onClose}
        >
          &times;
        </button>
        <img
          src={dj.img}
          alt={dj.nombre}
          className="mb-4 max-h-[30vh] w-full rounded-lg border border-sg-neon object-cover"
        />
        <h2 className="sg-heading mb-4 text-2xl font-bold">{dj.nombre}</h2>
        <p className="mb-6 text-sm text-white/85">{dj.bio}</p>
        <a
          href={dj.instagram}
          target="_blank"
          rel="noreferrer"
          className="sg-btn mx-auto w-fit"
        >
          <InstagramIcon size={18} />
          Instagram
        </a>
      </div>
    </div>
  );
}
