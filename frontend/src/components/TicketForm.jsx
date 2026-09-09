import { useState } from 'react';

export default function TicketForm() {
  const [formData, setFormData] = useState({ nombre: '', whatsapp: '', accesos: 1, comprobante: null });
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileName, setFileName] = useState("Sin archivo seleccionado");

  const handlePhoneChange = (e) => {
    const numbersOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
    setFormData({ ...formData, whatsapp: numbersOnly });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setFileName("Sin archivo seleccionado");
      setFormData({ ...formData, comprobante: null });
      return;
    }

    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      setStatus('Error: Formato no permitido. Solo PDF, JPG, JPEG o PNG.');
      e.target.value = '';
      setFileName("Sin archivo seleccionado");
      setFormData({ ...formData, comprobante: null });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setStatus('Error: El archivo supera el límite de 2MB.');
      e.target.value = '';
      setFileName("Sin archivo seleccionado");
      setFormData({ ...formData, comprobante: null });
      return;
    }

    setStatus('');
    setFileName(file.name);
    setFormData({ ...formData, comprobante: file });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.whatsapp.length !== 10) {
      setStatus('El número de WhatsApp debe tener exactamente 10 dígitos.');
      return;
    }
    if (!formData.comprobante) {
      setStatus('Por favor, selecciona un archivo válido.');
      return;
    }

    setIsSubmitting(true);
    setStatus('Subiendo comprobante...');
    
    const data = new FormData();
    data.append('nombre', formData.nombre);
    data.append('whatsapp', formData.whatsapp);
    data.append('accesos', formData.accesos);
    data.append('comprobante', formData.comprobante);

    try {
      const res = await fetch(`https://api-sensory-groove2.fadexlabs.com/api/transfer`, {
        method: 'POST',
        body: data
      });
      if(res.ok) {
          setStatus('¡Comprobante enviado exitosamente! Lo validaremos a la brevedad.');
          setFormData({ nombre: '', whatsapp: '', accesos: 1, comprobante: null });
          setFileName("Sin archivo seleccionado");
          e.target.reset();
      } else {
          setStatus('Error al enviar. Intenta de nuevo.');
      }
    } catch (err) {
      setStatus('Error de conexión. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input type="text" placeholder="Nombre de quien compra" required 
        className="bg-black/50 border border-cyber-red p-3 rounded text-white outline-none focus:shadow-[0_0_10px_rgba(255,0,60,0.5)] transition-shadow"
        value={formData.nombre}
        onChange={e => setFormData({...formData, nombre: e.target.value})} />
      
      <input type="tel" placeholder="Número de WhatsApp (10 dígitos)" required 
        pattern="[0-9]{10}"
        minLength="10"
        maxLength="10"
        title="Ingresa exactamente 10 dígitos numéricos"
        className="bg-black/50 border border-cyber-red p-3 rounded text-white outline-none focus:shadow-[0_0_10px_rgba(255,0,60,0.5)] transition-shadow"
        value={formData.whatsapp}
        onChange={handlePhoneChange} />
      
      <input type="number" min="1" placeholder="Cantidad de accesos" required 
        className="bg-black/50 border border-cyber-red p-3 rounded text-white outline-none focus:shadow-[0_0_10px_rgba(255,0,60,0.5)] transition-shadow"
        value={formData.accesos}
        onChange={e => setFormData({...formData, accesos: e.target.value})} />
      
      <div className="text-left mt-2">
          <label className="text-sm text-gray-300 block mb-2 font-orbitron">Sube tu comprobante de pago (Máx 2MB. PDF, JPG, PNG)</label>
          <label className="relative w-full border border-cyber-red bg-black/50 rounded flex items-center overflow-hidden cursor-pointer group hover:border-white transition-colors">
            <input type="file" accept=".pdf, .jpg, .jpeg, .png" required 
              className="hidden"
              onChange={handleFileChange} />
            <div className="bg-cyber-red text-white font-orbitron px-4 py-3 text-sm font-bold whitespace-nowrap group-hover:bg-white group-hover:text-black transition-colors">
              SUBIR ARCHIVO
            </div>
            <div className="px-4 text-sm truncate text-gray-300 w-full group-hover:text-white transition-colors">
              {fileName}
            </div>
          </label>
      </div>

      <button type="submit" disabled={isSubmitting} className="mt-4 font-orbitron bg-black/50 border border-cyber-red text-white py-3 px-4 rounded-full hover:bg-cyber-red hover:text-white transition-all shadow-[0_0_10px_rgba(255,0,60,0.2)] disabled:opacity-50 disabled:cursor-not-allowed">
        {isSubmitting ? 'PROCESANDO...' : 'ENVIAR COMPROBANTE'}
      </button>
      {status && <p className="text-cyber-red mt-2 font-bold">{status}</p>}
    </form>
  );
}
