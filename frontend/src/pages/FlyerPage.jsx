import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import DjModal from '../components/DjModal';
import InstagramIcon from '../components/InstagramIcon';
import TicketForm from '../components/TicketForm';
import { ASSETS, EVENT_DATE, LINEUP } from '../data/lineup';

gsap.registerPlugin(ScrollTrigger);

const CERO = { days: '00', hours: '00', mins: '00', secs: '00' };

function calcularRestante(objetivo) {
  const distancia = objetivo - Date.now();
  if (distancia <= 0) return CERO;
  const pad = (n) => String(n).padStart(2, '0');
  return {
    days: pad(Math.floor(distancia / (1000 * 60 * 60 * 24))),
    hours: pad(Math.floor((distancia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))),
    mins: pad(Math.floor((distancia % (1000 * 60 * 60)) / (1000 * 60))),
    secs: pad(Math.floor((distancia % (1000 * 60)) / 1000)),
  };
}

export default function FlyerPage() {
  const rootRef = useRef(null);
  const [restante, setRestante] = useState(CERO);
  const [djActivo, setDjActivo] = useState(null);

  // --- Cuenta regresiva ---
  useEffect(() => {
    const objetivo = new Date(EVENT_DATE).getTime();
    setRestante(calcularRestante(objetivo));
    const id = setInterval(() => setRestante(calcularRestante(objetivo)), 1000);
    return () => clearInterval(id);
  }, []);

  // --- Animaciones GSAP + ScrollTrigger ---
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      // 1. Entrada de cada panel al aparecer en pantalla.
      gsap.utils.toArray('[data-reveal]').forEach((panel) => {
        gsap.fromTo(
          panel,
          { y: 70, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 1.1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: panel,
              start: 'top 88%',
              toggleActions: 'play none none reverse',
            },
          },
        );
      });

      // 2. Parallax real: los elementos marcados se desplazan a distinta
      //    velocidad que el scroll, dando profundidad sobre el shader.
      gsap.utils.toArray('[data-parallax]').forEach((el) => {
        const fuerza = parseFloat(el.dataset.parallax) || 12;
        gsap.fromTo(
          el,
          { yPercent: fuerza },
          {
            yPercent: -fuerza,
            ease: 'none',
            scrollTrigger: {
              trigger: el,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          },
        );
      });
    }, rootRef);

    // Las imagenes remotas cambian la altura del documento al cargar.
    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener('load', onLoad);

    return () => {
      window.removeEventListener('load', onLoad);
      ctx.revert();
    };
  }, []);

  return (
    <div ref={rootRef} className="relative mx-auto flex max-w-[800px] flex-col gap-6 px-5 py-10">
      {/* --- HERO --- */}
      <header className="sg-panel" data-reveal>
        <img
          src={ASSETS.logo}
          alt="Sensory Groove Logo"
          data-parallax="6"
          className="mx-auto mb-5 h-[280px] w-[280px] max-w-full rounded-full border-2 border-sg-neon object-cover shadow-neon-lg"
        />
        <h1 className="sg-heading mb-3 text-4xl font-black md:text-5xl">DE LA REIVER</h1>
        <h2 className="sg-heading text-2xl font-bold">BETO RAMOS</h2>
        <h2 className="sg-heading text-2xl font-bold">TOTA</h2>

        <div className="mb-5 mt-5 text-lg font-semibold tracking-wide text-sg-glow">
          18 JULIO SÁBADO | 2026
          <br />
          CUU.MX | Zulu Cocktail &amp; Lounge
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-4">
          <a href="#payment" className="sg-btn">
            Adquirir Acceso
          </a>
          <a href="#lineup" className="sg-btn">
            Ver Lineup
          </a>
        </div>
      </header>

      {/* --- EL CONCEPTO --- */}
      <section className="sg-panel" data-reveal>
        <h2 className="sg-heading mb-4 text-3xl">El Concepto</h2>
        <h3 className="mb-4 font-orbitron text-lg tracking-wide text-sg-glow">
          DE LA REIVER PRESENTA
        </h3>
        <p className="text-white/90">
          Sensory Groove no es solo una fiesta, es una experiencia diseñada para activar
          todos los sentidos. Un viaje sonoro donde el tech house y el underground se
          fusionan con luces, energía y atmósferas envolventes.
        </p>
        <p className="mt-3 text-white/90">
          Aquí, cada beat se siente, cada transición conecta y cada momento te sumerge en
          un estado donde la música guía el cuerpo y libera la mente.
        </p>
      </section>

      {/* --- ADQUIRIR ACCESO --- */}
      <section id="payment" className="sg-panel scroll-mt-6" data-reveal>
        <h2 className="sg-heading mb-6 text-3xl">Adquirir Acceso</h2>

        <div className="mb-5 text-[1.2rem]">
          <span className="font-orbitron font-bold text-sg-glow">Preventa:</span> $100{' '}
          <br />
          <span className="font-orbitron font-bold text-sg-glow">
            Taquilla (después de 10:30pm):
          </span>{' '}
          $150
        </div>

        <p>💳 Para adquirir tu preventa mediante transferencia y/o deposito a la cuenta:</p>

        <div className="my-5 rounded-lg border-l-4 border-sg-neon bg-black/45 p-5 text-left text-[1.1rem]">
          <strong>BENEFICIARIO:</strong> Emiliano Vargas
          <br />
          <strong>CUENTA:</strong> 5579 0780 0462 8976
          <br />
          <strong>BANCO:</strong> Santander
          <br />
          <strong>CONCEPTO:</strong> NOMBRE DE QUIEN COMPRA
        </div>

        <div className="my-5 rounded-lg border border-sg-warn bg-sg-warn/10 p-4 text-sg-warn">
          <strong>⚠️ IMPORTANTE ⚠️</strong>
          <br />
          En concepto deberá ir el nombre de la persona que está adquiriendo los boletos.
        </div>

        <p className="mb-6">
          🎟️ Con tu comprobante de depósito y/o transferencia envía el nombre de quienes
          ocuparán los accesos y te los hacemos llegar vía WhatsApp en formato PDF con
          código QR.
        </p>

        {/* Plataforma de ticketing: sustituye los botones de WhatsApp de la V1. */}
        <TicketForm />
      </section>

      {/* --- LOGÍSTICA --- */}
      <section className="sg-panel" data-reveal>
        <h2 className="sg-heading mb-5 text-3xl">Logística</h2>

        <div className="mb-6 flex flex-wrap justify-center gap-4">
          {[
            { label: 'Días', valor: restante.days },
            { label: 'Hrs', valor: restante.hours },
            { label: 'Min', valor: restante.mins },
            { label: 'Seg', valor: restante.secs },
          ].map((bloque) => (
            <div
              key={bloque.label}
              className="min-w-[80px] rounded-lg border border-sg-neon bg-sg-neon/10 p-4"
            >
              <span className="block font-orbitron text-3xl font-bold">
                {bloque.valor}
              </span>
              <p className="text-sm uppercase text-white/75">{bloque.label}</p>
            </div>
          ))}
        </div>

        <p className="mb-2 text-lg font-bold text-sg-glow">
          ¡Nos vemos en la palmera raver!
        </p>
        <p>
          <strong>Fecha:</strong> 18 Julio 2026 | 21:00 hrs
        </p>
        <p className="mb-4">
          <strong>Locación:</strong> Zulu Cocktail &amp; Lounge
        </p>

        {/* Mapa con filtro rojo/oscuro para integrarse a la estética. */}
        <div className="relative h-0 overflow-hidden rounded-lg border border-sg-neon pb-[56.25%] shadow-neon-sm">
          <iframe
            src={ASSETS.mapa}
            title="Ubicación: Zulu Cocktail & Lounge"
            className="sg-map-filter absolute left-0 top-0 h-full w-full"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>

      {/* --- LINEUP & TIMETABLE --- */}
      <section id="lineup" className="sg-panel scroll-mt-6" data-reveal>
        <h2 className="sg-heading mb-6 text-3xl">Lineup &amp; Timetable</h2>

        <div
          data-parallax="8"
          className="mx-auto mb-8 aspect-[9/16] w-full max-w-[400px] overflow-hidden rounded-lg border border-sg-neon shadow-neon"
        >
          <img
            src={ASSETS.flyer}
            alt="Sensory Groove Flyer"
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
          {LINEUP.map((dj) => (
            <div
              key={dj.nombre}
              className="rounded-xl border border-sg-neon/70 bg-black/45 p-5 text-center shadow-neon-sm"
            >
              <img
                src={dj.img}
                alt={dj.nombre}
                loading="lazy"
                className="mx-auto mb-4 h-[100px] w-[100px] rounded-full border-2 border-sg-neon object-cover"
              />
              <h3
                className={`sg-heading mb-1 text-[1.2rem] ${
                  dj.destacado ? 'text-sg-glow' : ''
                }`}
              >
                {dj.nombre}
              </h3>
              <span className="mb-4 block font-orbitron text-[0.9rem] text-white">
                {dj.horario}
              </span>
              <button type="button" className="sg-btn" onClick={() => setDjActivo(dj)}>
                + Info
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* --- VIBE / CONCEPT --- */}
      <section className="sg-panel" data-reveal>
        <h2 className="sg-heading mb-4 text-3xl">Vibe / Concept</h2>
        <p className="text-white/90">
          Una experiencia inmersiva tech-tropical al aire libre. La fusión perfecta entre
          el groove underground, texturas futuristas y la energía colectiva del tech
          house. Prepárate para una progresión sonora de menos a más.
        </p>
      </section>

      {/* --- VISUALS BY --- */}
      <section className="sg-panel" data-reveal>
        <h2 className="sg-heading mb-5 text-3xl">Visuals By</h2>
        <div className="mt-5 flex flex-col items-center">
          <img
            src={ASSETS.vj}
            alt="VJ"
            loading="lazy"
            className="mb-4 h-[100px] w-[100px] rounded-full border-2 border-sg-neon object-cover shadow-neon-sm"
          />
          <h3 className="mb-1 font-orbitron text-[1.2rem] font-bold text-sg-glow">
            FABIAN CARRILLO
          </h3>
          <span className="mb-5 font-orbitron text-[0.9rem] uppercase text-white/75">
            VJ / Artista Visual
          </span>
          <a
            href="https://instagram.com/fabvian_ce/"
            target="_blank"
            rel="noreferrer"
            className="sg-btn px-5 py-2 text-[0.8rem]"
          >
            <InstagramIcon />
            Follow on IG
          </a>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="sg-panel p-6" data-reveal>
        <div className="flex flex-col items-center gap-4">
          <img
            src={ASSETS.fadex}
            alt="Fadex Labs"
            loading="lazy"
            className="h-[80px] w-[80px] object-contain"
          />
          <p className="font-orbitron text-[0.9rem] tracking-[1px]">
            MADE BY <strong className="text-sg-glow">FADEX LABS</strong>
          </p>
          <a
            href="https://instagram.com/fadexlabs"
            target="_blank"
            rel="noreferrer"
            className="sg-btn px-5 py-2 text-[0.8rem]"
          >
            <InstagramIcon />
            Follow on IG
          </a>
        </div>
      </footer>

      {djActivo && <DjModal dj={djActivo} onClose={() => setDjActivo(null)} />}
    </div>
  );
}
