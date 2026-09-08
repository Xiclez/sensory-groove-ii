import { useRef, useState } from 'react';
import { createTransfer } from '../lib/api';

const PRECIO_PREVENTA = 100;
const MAX_ACCESOS = 20;
const MAX_MB = 8;
const TIPOS_ACEPTADOS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
];

const ESTADO_INICIAL = {
  nombre: '',
  whatsapp: '',
  accesos: 1,
  comprobante: null,
};

export default function TicketForm() {
  const [form, setForm] = useState(ESTADO_INICIAL);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null); // { ok, mensaje }
  const fileInputRef = useRef(null);

  const actualizar = (campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    setErrores((prev) => ({ ...prev, [campo]: undefined }));
  };

  const validar = () => {
    const nuevos = {};
    const digitos = form.whatsapp.replace(/\D/g, '');

    if (form.nombre.trim().length < 2) {
      nuevos.nombre = 'Escribe el nombre completo de quien compra.';
    }
    if (digitos.length < 10 || digitos.length > 13) {
      nuevos.whatsapp = 'Debe tener 10 dígitos (sin espacios ni guiones).';
    }
    const accesos = Number(form.accesos);
    if (!Number.isInteger(accesos) || accesos < 1 || accesos > MAX_ACCESOS) {
      nuevos.accesos = `Elige entre 1 y ${MAX_ACCESOS} accesos.`;
    }
    if (!form.comprobante) {
      nuevos.comprobante = 'Adjunta la foto o PDF de tu comprobante.';
    } else if (!TIPOS_ACEPTADOS.includes(form.comprobante.type)) {
      nuevos.comprobante = 'Formato no válido. Usa JPG, PNG, WEBP o PDF.';
    } else if (form.comprobante.size > MAX_MB * 1024 * 1024) {
      nuevos.comprobante = `El archivo pesa más de ${MAX_MB} MB.`;
    }

    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setResultado(null);
    if (!validar()) return;

    setEnviando(true);
    try {
      await createTransfer({
        nombre: form.nombre.trim(),
        whatsapp: form.whatsapp.replace(/\D/g, ''),
        accesos: Number(form.accesos),
        comprobante: form.comprobante,
      });
      setResultado({
        ok: true,
        mensaje:
          '¡Comprobante recibido! Estamos validando tu pago y te enviamos tus accesos por WhatsApp.',
      });
      setForm(ESTADO_INICIAL);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      setResultado({
        ok: false,
        mensaje:
          error?.message ||
          'No pudimos enviar tu comprobante. Revisa tu conexión e intenta de nuevo.',
      });
    } finally {
      setEnviando(false);
    }
  };

  const total = Number(form.accesos) > 0 ? Number(form.accesos) * PRECIO_PREVENTA : 0;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-xl border border-sg-neon/70 bg-black/45 p-6 text-left shadow-neon-sm"
    >
      <h3 className="sg-heading mb-5 text-xl text-sg-glow">Registro de Acceso</h3>

      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="tf-nombre" className="sg-label">
            Nombre de quien compra
          </label>
          <input
            id="tf-nombre"
            name="nombre"
            type="text"
            autoComplete="name"
            className="sg-input"
            placeholder="Nombre y apellido"
            value={form.nombre}
            onChange={(e) => actualizar('nombre', e.target.value)}
            aria-invalid={Boolean(errores.nombre)}
          />
          <FieldError mensaje={errores.nombre} />
        </div>

        <div>
          <label htmlFor="tf-whatsapp" className="sg-label">
            WhatsApp
          </label>
          <input
            id="tf-whatsapp"
            name="whatsapp"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            className="sg-input"
            placeholder="6141234567"
            value={form.whatsapp}
            onChange={(e) => actualizar('whatsapp', e.target.value)}
            aria-invalid={Boolean(errores.whatsapp)}
          />
          <FieldError mensaje={errores.whatsapp} />
        </div>

        <div>
          <label htmlFor="tf-accesos" className="sg-label">
            Cantidad de accesos
          </label>
          <input
            id="tf-accesos"
            name="accesos"
            type="number"
            min="1"
            max={MAX_ACCESOS}
            step="1"
            className="sg-input"
            value={form.accesos}
            onChange={(e) => actualizar('accesos', e.target.value)}
            aria-invalid={Boolean(errores.accesos)}
          />
          <FieldError mensaje={errores.accesos} />
          {total > 0 && !errores.accesos && (
            <p className="mt-1.5 font-orbitron text-xs text-white/60">
              Total en preventa: ${total}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="tf-comprobante" className="sg-label">
            Comprobante de depósito y/o transferencia
          </label>
          <input
            id="tf-comprobante"
            name="comprobante"
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="w-full cursor-pointer rounded-lg border border-sg-neon/60 bg-black/55
              text-sm text-white/80 file:mr-3 file:cursor-pointer file:border-0
              file:bg-sg-neon/15 file:px-4 file:py-2.5 file:font-orbitron
              file:text-xs file:uppercase file:text-sg-glow
              hover:file:bg-sg-neon/25"
            onChange={(e) => actualizar('comprobante', e.target.files?.[0] ?? null)}
            aria-invalid={Boolean(errores.comprobante)}
          />
          <FieldError mensaje={errores.comprobante} />
          {form.comprobante && !errores.comprobante && (
            <p className="mt-1.5 truncate text-xs text-white/50">
              {form.comprobante.name}
            </p>
          )}
        </div>

        <button type="submit" className="sg-btn mt-2 w-full" disabled={enviando}>
          {enviando ? 'Enviando...' : 'Enviar para validación'}
        </button>

        {resultado && (
          <p
            role="status"
            aria-live="polite"
            className={`rounded-lg border p-3 text-sm ${
              resultado.ok
                ? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-300'
                : 'border-sg-neon bg-sg-neon/10 text-sg-glow'
            }`}
          >
            {resultado.mensaje}
          </p>
        )}
      </div>
    </form>
  );
}

function FieldError({ mensaje }) {
  if (!mensaje) return null;
  return <p className="mt-1.5 text-xs text-sg-glow">{mensaje}</p>;
}
