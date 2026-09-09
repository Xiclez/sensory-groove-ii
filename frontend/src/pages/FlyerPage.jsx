import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import TicketForm from '../components/TicketForm';

gsap.registerPlugin(ScrollTrigger);

const CERO = { days: '00', hours: '00', mins: '00', secs: '00' };
const EVENT_DATE = "2026-10-03T21:00:00";

const DJS = [
  {
    name: "DE LA REIVER",
    desc: "Talento del estado de chihuahua que ha logrado posicionarse rapidamente en la escena local, con un estilo que se enfoca en mantener el danceflor en constante movimiento con bajos profundos y grooves minimalistas.",
    video: "https://res.cloudinary.com/dn4m0kr7j/video/upload/v1788921243/dlr_video_wrh5br.mp4",
    ig: "https://instagram.com/de_la_reiver/"
  },
  {
    name: "GUILLERMO NEVAREZ",
    desc: "DJ y productor de Chihuahua. Explora el Afro House, House, Tech House y Melodic House, su música ha llegado a todo el país con apoyo de artistas nacionales.",
    video: "https://res.cloudinary.com/dn4m0kr7j/video/upload/v1788921697/nevarez_video_scnpe2.mp4",
    ig: "https://instagram.com/nevarezguillermo/"
  },
  {
    name: "ZAMORANO",
    desc: "Dj Emergente de Chihuahua que se caracteriza por su energía y conexión total con el público y la pista. Con un estilo versátil que combina distintos géneros de la música electrónica, construye un ambiente progresivo y melódico para entregar una experiencia única.",
    video: "https://res.cloudinary.com/dn4m0kr7j/video/upload/v1788921926/zamorano_video_ipemvy.mp4",
    ig: "https://instagram.com/kevin_zamoranodj/"
  },
  {
    name: "VPM",
    desc: "Ha desarrollado un estilo propio inspirado en la vibra urbana de su entorno y una identidad visual marcada por el fuego, lo infernal y la irreverencia. A través de Ignix, su personaje diabólico, lleva esta esencia a cada presentación bajo un mismo concepto: Follow the Flame.",
    video: "https://res.cloudinary.com/dn4m0kr7j/video/upload/v1788921972/vpm_video_d9tvfn.mp4",
    ig: "https://instagram.com/vpm_holyjunkie/"
  }
];

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

// Icono de Sonido
const SpeakerIcon = ({ isMuted }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
    {!isMuted && <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>}
    {isMuted && <line x1="23" y1="1" x2="1" y2="23"></line>}
  </svg>
);

// Efecto Terminal / Máquina de Escribir (Semáforo Integrado)
const Typewriter = ({ text, speed = 25, containerRef, shouldType }) => {
  const [charCount, setCharCount] = useState(0);
  const bottomRef = useRef(null);
  
  useEffect(() => {
    setCharCount(0);
  }, [text]);

  useEffect(() => {
    if (!shouldType) return; 

    const timer = setInterval(() => {
      setCharCount((prev) => {
        if (prev < text.length) {
          return prev + 1;
        }
        clearInterval(timer);
        return prev;
      });
    }, speed);
    
    return () => clearInterval(timer);
  }, [text, speed, shouldType]);

  useEffect(() => {
    if (containerRef && containerRef.current && shouldType) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [charCount, containerRef, shouldType]);
  
  return (
    <>
      <span>{text.slice(0, charCount)}</span>
      <span ref={bottomRef} />
    </>
  );
};

export default function FlyerPage() {
  const rootRef = useRef(null);
  const heroVideoRef = useRef(null);
  const splashVideoRef = useRef(null);
  const djVideoRef = useRef(null);
  
  const [restante, setRestante] = useState(CERO);
  
  // Splash Screen State
  const [showSplash, setShowSplash] = useState(true);
  const [fadeSplash, setFadeSplash] = useState(false);

  // Hero Video State
  const [isHeroMuted, setIsHeroMuted] = useState(true);

  // Lineup Sticky State
  const lineupRef = useRef(null);
  const lineupScrollRef = useRef(null);
  const hasLineupTriggered = useRef(false);
  const [lineupStarted, setLineupStarted] = useState(false);
  const [lineupFinished, setLineupFinished] = useState(false);
  const [djIndex, setDjIndex] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);
  const [fadeVideo, setFadeVideo] = useState(false); // <--- NUEVO ESTADO PARA EL FADE DEL VIDEO

  // Fadex Sticky State
  const fadexRef = useRef(null);
  const fadexScrollRef = useRef(null);
  const hasFadexTriggered = useRef(false);
  const [fadexStarted, setFadexStarted] = useState(false);
  const [fadexFinished, setFadexFinished] = useState(false);
  const [showFadexPrompt, setShowFadexPrompt] = useState(false);

  // Lock and Unlock helpers
  const lockScroll = (ref) => {
    if (ref.current) {
      window.scrollTo(0, ref.current.offsetTop);
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    }
  };
  
  const unlockScroll = () => {
    document.body.style.overflow = 'auto';
    document.body.style.touchAction = 'auto';
  };

  // --- Splash Screen Logic ---
  const handleSplashMetadata = () => {
    if (splashVideoRef.current) {
      const halfDuration = (splashVideoRef.current.duration / 2) * 1000;
      setTimeout(() => {
        setFadeSplash(true);
        setTimeout(() => setShowSplash(false), 800); 
      }, halfDuration);
    }
  };

  // --- Hero Mute on Scroll ---
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50 && !isHeroMuted) {
        setIsHeroMuted(true);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHeroMuted]);

  // --- Cuenta regresiva ---
  useEffect(() => {
    const objetivo = new Date(EVENT_DATE).getTime();
    setRestante(calcularRestante(objetivo));
    const id = setInterval(() => setRestante(calcularRestante(objetivo)), 1000);
    return () => clearInterval(id);
  }, []);

  // --- GSAP Reveals ---
  useEffect(() => {
    if (showSplash) return; 
    const ctx = gsap.context(() => {
      gsap.utils.toArray('[data-reveal]').forEach((panel) => {
        gsap.fromTo(panel, { y: 50, opacity: 0 }, {
          y: 0, opacity: 1, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: panel, start: 'top 85%', toggleActions: 'play none none reverse' }
        });
      });
    }, rootRef);
    return () => ctx.revert();
  }, [showSplash]);

  // --- Lineup Observer ---
  useEffect(() => {
    if (showSplash) return;
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && entries[0].intersectionRatio >= 0.95 && !hasLineupTriggered.current && !lineupFinished) {
        hasLineupTriggered.current = true;
        lockScroll(lineupRef);
        setLineupStarted(true);
      }
    }, { threshold: 0.95 });
    
    if (lineupRef.current) observer.observe(lineupRef.current);
    return () => observer.disconnect();
  }, [lineupFinished, showSplash]);

  // --- Fadex Observer ---
  useEffect(() => {
    if (showSplash) return;
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && entries[0].intersectionRatio >= 0.95 && !hasFadexTriggered.current && !fadexFinished) {
        hasFadexTriggered.current = true;
        lockScroll(fadexRef);
        setFadexStarted(true);
      }
    }, { threshold: 0.95 });
    
    if (fadexRef.current) observer.observe(fadexRef.current);
    return () => observer.disconnect();
  }, [fadexFinished, showSplash]);

  // --- Lineup Prompt Timers ---
  useEffect(() => {
    if (lineupStarted && !lineupFinished) {
      setShowPrompt(false);
      const timer = setTimeout(() => setShowPrompt(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [djIndex, lineupStarted, lineupFinished]);

  // --- Fadex Prompt Timers ---
  useEffect(() => {
    if (fadexStarted && !fadexFinished) {
      const timer = setTimeout(() => setShowFadexPrompt(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [fadexStarted, fadexFinished]);

  // --- Video Player Handler ---
  useEffect(() => {
      if (djVideoRef.current && DJS[djIndex]) {
          djVideoRef.current.src = DJS[djIndex].video;
          djVideoRef.current.load();
          const playPromise = djVideoRef.current.play();
          if (playPromise !== undefined) {
              playPromise.catch(error => console.log("Autoplay prevent", error));
          }
      }
  }, [djIndex]);

  // --- Handlers con Fade Cinematográfico ---
  const handleNextDj = () => {
    setShowPrompt(false); // 1. Ocultamos la terminal primero
    setFadeVideo(true);   // 2. Iniciamos el fundido a negro del video
    
    setTimeout(() => {
      if (djIndex < DJS.length - 1) {
        setDjIndex(prev => prev + 1); // 3. Cambiamos de DJ
        
        // 4. Esperamos un instante a que el nuevo video cargue antes de hacer el fade-in
        setTimeout(() => setFadeVideo(false), 300);
      } else {
        setLineupFinished(true);
        unlockScroll();
      }
    }, 500); // 500ms es exactamente lo que dura la transición CSS de opacity
  };

  const handleFadexFinish = () => {
    setShowFadexPrompt(false);
    setTimeout(() => {
      setFadexFinished(true);
      unlockScroll();
    }, 400);
  };

  // Clases Globales
  const panelClass = "bg-black/30 border border-cyber-red rounded-xl p-8 backdrop-blur-sm shadow-[0_0_20px_rgba(255,0,60,0.15)] text-center relative overflow-hidden";
  const neonTextClass = "font-orbitron uppercase tracking-[2px] [text-shadow:0_0_10px_#ff003c]";

  return (
    <div ref={rootRef} className="relative w-full z-10">
      
      {/* --- SPLASH SCREEN --- */}
      {showSplash && (
        <div className={`fixed inset-0 z-[100] bg-black flex justify-center items-center transition-opacity duration-800 ${fadeSplash ? 'opacity-0' : 'opacity-100'}`}>
          <video 
            ref={splashVideoRef}
            src="https://res.cloudinary.com/dn4m0kr7j/video/upload/v1788922926/sensory_loader_snkr4x.mp4" 
            autoPlay muted playsInline 
            onLoadedMetadata={handleSplashMetadata}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* --- HERO SECTION --- */}
      <header className="relative h-[100dvh] w-full flex flex-col">
        <video 
          ref={heroVideoRef}
          src="https://res.cloudinary.com/dn4m0kr7j/video/upload/v1788920814/SaveFast.app_AQPFF03rZZZt4HB7aHqde7fBWq545VKjo9V-98KPwY5i6eOoZidQ4y3cysbiCiLl_s_mus2WbfdM5CLmhb4dw743jZMFHXDb74L0EFQ_suedmc.mp4" 
          autoPlay loop muted={isHeroMuted} playsInline 
          className="absolute inset-0 w-full h-full object-cover z-0"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent z-0"></div>
        
        <button 
          onClick={() => setIsHeroMuted(!isHeroMuted)} 
          className="absolute top-6 right-6 z-50 bg-black/50 p-3 rounded-full border border-cyber-red text-cyber-red hover:bg-cyber-red hover:text-white transition-colors"
        >
          <SpeakerIcon isMuted={isHeroMuted} />
        </button>
        
        <div className="relative z-10 flex-1 flex flex-col pb-10">
          <div className="flex-[3]"></div>
          <div className="flex-1 flex flex-col items-center justify-end gap-5 px-4 text-center">
            <div>
              <h1 className={`${neonTextClass} text-4xl font-black mb-2`}>DE LA REIVER</h1>
              <h2 className={`${neonTextClass} text-lg font-bold`}>VPM B2B ZAMORANO</h2>
              <h2 className={`${neonTextClass} text-lg font-bold`}>GUILLERMO NEVAREZ</h2>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <a href="#payment" className="font-orbitron bg-black/50 border border-cyber-red text-white py-2 px-6 rounded-full text-xs hover:bg-cyber-red hover:text-white transition-all backdrop-blur-md shadow-[0_0_10px_rgba(255,0,60,0.2)]">ADQUIRIR ACCESO</a>
              <a href="#lineup" className="font-orbitron bg-black/50 border border-cyber-red text-white py-2 px-6 rounded-full text-xs hover:bg-cyber-red hover:text-white transition-all backdrop-blur-md shadow-[0_0_10px_rgba(255,0,60,0.2)]">VER LINEUP</a>
            </div>
          </div>
        </div>
      </header>

      {/* --- CONTENEDOR DE CONTENIDO --- */}
      <div className="max-w-[800px] mx-auto py-10 px-5 flex flex-col gap-6">

        {/* --- LA EVOLUCION --- */}
        <section className={panelClass} data-reveal>
          <h2 className={`${neonTextClass} text-3xl mb-4`}>La Evolución</h2>
          <h3 className="text-lg text-cyber-red mb-4 font-orbitron tracking-wide">DE LA REIVER PRESENTA: SEGUNDA EDICIÓN</h3>
          <p className="mb-3 text-gray-200">Los que estuvieron ahí, lo entienden. La primera edición marcó un antes y un después en la pista, pero eso fue solo el calentamiento. Sensory Groove regresa con un viaje sonoro más oscuro, inmersivo y llevado al límite absoluto.</p>
          <p className="text-gray-200">La fusión perfecta entre el tech house y la atmósfera underground eleva su nivel. Si el primer evento te voló la mente, prepárate para perder por completo la noción del tiempo. La palmera raver te reclama de nuevo.</p>
        </section>

        {/* --- REVIVE EL MAGICO SET --- */}
        <section className={panelClass} data-reveal>
          <h3 className="text-lg text-cyber-red mb-4 font-orbitron tracking-wide">Revive el magico set de DLR en Sensory Groove I</h3>
          <div className="relative w-full aspect-video border border-cyber-red rounded-lg overflow-hidden shadow-[0_0_15px_rgba(255,0,60,0.2)]">
            <iframe 
              className="absolute top-0 left-0 w-full h-full"
              src="https://www.youtube.com/embed/LPzvDEtAkIM?si=z_l9DZCEeVd0Dv3E" 
              title="YouTube video player" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
              referrerPolicy="strict-origin-when-cross-origin" 
              allowFullScreen>
            </iframe>
          </div>
        </section>

        {/* --- ADQUIRIR ACCESO --- */}
        <section id="payment" className={panelClass} data-reveal>
          <h2 className={`${neonTextClass} text-3xl mb-6`}>Adquirir Acceso</h2>
          <div className="mb-5 text-[1.1rem]">
            <span className="text-cyber-red font-bold font-orbitron">Preventa:</span> $100 MXN <br/>
            <span className="text-cyber-red font-bold font-orbitron">Taquilla (después de 10:30pm):</span> $150 MXN
          </div>
          <div className="text-left bg-black/40 p-5 rounded-lg border-l-4 border-cyber-red mb-5 text-[1.1rem]">
            <p className="mb-2">💳 Transferencia y/o depósito a la cuenta:</p>
            <strong>BENEFICIARIO:</strong> Emiliano Vargas<br/>
            <strong>CUENTA:</strong> 5579 0780 0462 8976<br/>
            <strong>BANCO:</strong> Santander<br/>
            <strong>CONCEPTO:</strong> NOMBRE DE QUIEN COMPRA
          </div>
          <div className="bg-[#ffcc00]/10 border border-[#ffcc00] text-[#ffcc00] p-4 rounded-lg mb-6 text-left">
            <strong>⚠️ IMPORTANTE ⚠️</strong><br/>
            En concepto deberá ir el nombre de la persona que está adquiriendo los boletos.
          </div>
          <p className="mb-6">🎟️ Sube tu comprobante junto con tus datos. Te haremos llegar los accesos vía WhatsApp.</p>
          <div className="text-left">
            <TicketForm />
          </div>
        </section>

        {/* --- LOGÍSTICA --- */}
        <section className={panelClass} data-reveal>
          <h2 className={`${neonTextClass} text-3xl mb-5`}>Logística</h2>
          <div className="flex justify-center flex-wrap gap-4 mb-6">
            {[
              { label: 'Días', value: restante.days },
              { label: 'Hrs', value: restante.hours },
              { label: 'Min', value: restante.mins },
              { label: 'Seg', value: restante.secs }
            ].map((item, idx) => (
              <div key={idx} className="bg-cyber-red/10 border border-cyber-red rounded-lg p-4 min-w-[80px]">
                <span className="block font-orbitron text-3xl font-bold text-cyber-red">{item.value}</span>
                <p className="text-sm uppercase text-gray-300">{item.label}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-cyber-red font-bold text-lg mb-2">¡Nos vemos en la palmera raver!</p>
            <p><strong>Fecha:</strong> 03 Octubre 2026 | 21:00 hrs</p>
            <p className="mb-4"><strong>Locación:</strong> Zulu Cocktail & Lounge</p>
            <div className="overflow-hidden rounded-lg border border-cyber-red shadow-[0_0_15px_rgba(255,0,60,0.2)] relative h-0 pb-[56.25%]">
              <iframe 
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3501.8681946791935!2d-106.07659762449919!3d28.633712175664144!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x86ea4352dabd3c4f%3A0x90db45533ca8c0f6!2sZulu!5e0!3m2!1sen!2smx!4v1783381634564!5m2!1sen!2smx" 
                className="absolute top-0 left-0 w-full h-full"
                style={{ filter: "grayscale(1) sepia(1) hue-rotate(315deg) saturate(5) brightness(0.6) contrast(1.2)" }}
                allowFullScreen="" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </section>

      </div>

      {/* --- LINEUP INTERACTIVO STICKY --- */}
      <section id="lineup" ref={lineupRef} className="relative h-[100dvh] w-full bg-black flex flex-col justify-center items-center overflow-hidden">
        
        {!lineupFinished && (
          <>
            {/* Se aplicó el fadeVideo aquí */}
            <video 
              ref={djVideoRef}
              loop muted playsInline 
              className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-500 ${fadeVideo ? 'opacity-0' : 'opacity-100'}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-0"></div>
            
            <div className={`absolute bottom-4 left-4 right-4 h-[28vh] z-20 transition-all duration-500 transform ${showPrompt ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              <div className="bg-black/80 backdrop-blur-md border border-cyber-red p-4 rounded-lg w-full h-full flex flex-col shadow-[0_0_15px_rgba(255,0,60,0.5)]">
                <div className="flex justify-between items-center border-b border-cyber-red/50 pb-2 mb-2 flex-shrink-0">
                  <span className="text-xs text-cyber-red font-mono">cmd.exe - {DJS[djIndex].name}</span>
                  <span className="text-cyber-red cursor-pointer font-mono">_ ☐ X</span>
                </div>
                <h3 className={`${neonTextClass} text-xl font-bold mb-2 flex-shrink-0`}>{DJS[djIndex].name}</h3>
                
                <div ref={lineupScrollRef} className="flex-1 overflow-y-auto font-mono text-sm text-gray-300 pr-2 custom-scrollbar">
                  <Typewriter 
                    text={DJS[djIndex].desc} 
                    containerRef={lineupScrollRef} 
                    shouldType={showPrompt}
                  />
                </div>
                
                <div className="flex justify-between gap-3 mt-3 flex-shrink-0">
                  <a href={DJS[djIndex].ig} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 border border-cyber-red py-2 text-white hover:bg-cyber-red hover:text-white transition-colors font-orbitron text-xs rounded">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                    </svg>
                    IG
                  </a>
                  <button onClick={handleNextDj} className="flex-1 border border-cyber-red bg-cyber-red text-white py-2 hover:bg-red-600 hover:text-white font-bold transition-colors font-orbitron text-xs rounded">
                    SIGUIENTE
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {lineupFinished && (
          <div className="absolute inset-0 w-full h-full flex flex-col z-10 bg-black animate-fade-in duration-1000">
            <img src="https://res.cloudinary.com/dn4m0kr7j/image/upload/v1788918460/TXT_02_SENSORY_GROOVE_2_ZULU_copia.jpg_zuptmv.jpg" alt="Sensory Groove Flyer" className="w-full h-full object-cover" />
            <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center animate-bounce text-cyber-red font-orbitron font-bold drop-shadow-md">
              <span className="text-xs bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm mb-1 text-white border border-cyber-red/50">Continuar Scroll</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
            </div>
          </div>
        )}
      </section>

      {/* --- FADEX LABS --- */}
      <section id="fadex" ref={fadexRef} className="relative h-[100dvh] w-full bg-black flex flex-col justify-center items-center overflow-hidden">
        
        <video 
          src="https://res.cloudinary.com/dn4m0kr7j/video/upload/v1788922736/fadex_video_ia89zi.mp4" 
          autoPlay loop muted playsInline 
          className="absolute inset-0 w-full h-full object-cover z-0"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-0"></div>

        {!fadexFinished && (
          <div className={`absolute bottom-4 left-4 right-4 h-[28vh] z-20 transition-all duration-500 transform ${showFadexPrompt ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <div className="bg-black/80 backdrop-blur-md border border-cyber-red p-4 rounded-lg w-full h-full flex flex-col shadow-[0_0_15px_rgba(255,0,60,0.5)]">
              <div className="flex justify-between items-center border-b border-cyber-red/50 pb-2 mb-2 flex-shrink-0">
                <span className="text-xs text-cyber-red font-mono">cmd.exe - FADEX LABS</span>
                <span className="text-cyber-red cursor-pointer font-mono">_ ☐ X</span>
              </div>
              <h3 className={`${neonTextClass} text-xl font-bold mb-2 flex-shrink-0`}>FADEX LABS</h3>
              
              <div ref={fadexScrollRef} className="flex-1 overflow-y-auto font-mono text-sm text-gray-300 pr-2 custom-scrollbar">
                <Typewriter 
                  text="Proyecto fundado por el DJ/VJ DaXikleZ (DXZ) y el Artista Visual Fabian Carrillo. Buscan combinar la complejidad técnica de la tecnología de vanguardia con una creatividad cruda y sin temor a innovar. Mentes maestras a cargo de la ambientación visual de Sensory Groove." 
                  containerRef={fadexScrollRef} 
                  shouldType={showFadexPrompt}
                />
              </div>
              
              <div className="flex justify-between gap-3 mt-3 flex-shrink-0">
                <a href="https://instagram.com/fadexlabs" target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 border border-cyber-red py-2 text-white hover:bg-cyber-red hover:text-white transition-colors font-orbitron text-xs rounded">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                  IG
                </a>
                <button onClick={handleFadexFinish} className="flex-1 border border-cyber-red bg-cyber-red text-white py-2 hover:bg-red-600 hover:text-white font-bold transition-colors font-orbitron text-xs rounded">
                  FINALIZAR
                </button>
              </div>
            </div>
          </div>
        )}

        {fadexFinished && (
          <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center z-10 animate-fade-in duration-1000">
            <p className="font-orbitron text-[0.9rem] tracking-[1px] text-white bg-black/60 px-6 py-3 border border-cyber-red/50 rounded-full backdrop-blur-md shadow-[0_0_15px_rgba(255,0,60,0.3)]">
              MADE BY <strong className="text-cyber-red">FADEX LABS</strong>
            </p>
          </div>
        )}
      </section>

    </div>
  );
}