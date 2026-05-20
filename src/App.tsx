/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { 
  Upload, 
  Image as ImageIcon, 
  MapPin, 
  Download, 
  RefreshCw, 
  Loader2, 
  Plane, 
  Camera, 
  Plus, 
  Trash2, 
  Settings,
  Info,
  ChevronDown,
  AlertCircle,
  X,
  Smartphone,
  Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

type Subject = {
  id: string;
  name: string;
  type: 'character' | 'object';
  data: string;
  mimeType: string;
  url: string;
};

type Adventure = {
  id: string;
  prompt: string;
  description: string;
  imageUrl?: string;
  loading: boolean;
  error?: string;
  aspectRatio: string;
};

type Toast = {
  id: string;
  message: string;
  type: 'error' | 'success';
};

const ASPECT_RATIOS = [
  "1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "5:4", "4:5", "21:9", "4:1", "1:4", "8:1", "1:8"
];

const RESOLUTIONS = ["512px", "1K", "2K", "4K"];

const SUGGESTIONS = [
  "Můj mazlíček sedí na loďce v krasovém zálivu Ha Long.",
  "Můj mazlíček objevuje červené brány torii svatyně Fušimi Inari.",
  "Můj mazlíček před „nakloněnými“ domy v Amsterdamu."
];

const staticFilesUrl = 'https://www.gstatic.com/aistudio/starter-apps/pet_passport/';

interface TemplateImage {
  id: string;
  imageUrl: string;
  location: string;
  template_description: string;
  aspect_ratio: string;
}

const TEMPLATE_IMAGES: TemplateImage[] = [
  {
    id: '1',
    imageUrl: staticFilesUrl + 'example_snoo.png',
    location: "Durdle Door, Dorset",
    template_description: "Snoo se slunečními brýlemi",
    aspect_ratio: "3:4"
  },
  {
    id: '2',
    imageUrl: staticFilesUrl + 'example_nigel.png',
    location: "Laponsko, Finsko",
    template_description: "Nigel s vánoční čepicí a šálou",
    aspect_ratio: "3:4"
  },
  {
    id: '3',
    imageUrl: staticFilesUrl + 'example_multi.png',
    location: "Richmond Park, Londýn",
    template_description: "Nigel a Dougie si užívají piknik",
    aspect_ratio: "3:4"
  },
];

export default function App() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [destinations, setDestinations] = useState<Adventure[]>([]);
  const [currentDestination, setCurrentDestination] = useState('');
  const [currentDescription, setCurrentDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [customApiKey, setCustomApiKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('borisuv_pas_api_key') || '';
    }
    return '';
  });
  
  // Config state
  const [selectedAspectRatio, setSelectedAspectRatio] = useState("9:16");
  const [selectedResolution, setSelectedResolution] = useState("1K");

  // PWA installer states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      // If the native prompt is not available, show the step-by-step instructions dialog
      setShowInstallGuide(true);
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the PWA install prompt');
    }
    setDeferredPrompt(null);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<'character' | 'object'>('character');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      addToast("Nahrajte prosím platný obrázek (.png, .jpg, .jpeg nebo .webp)", 'error');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      
      const newSubject: Subject = {
        id: Date.now().toString(),
        name: uploadType === 'character' ? `Mazlíček ${subjects.filter(s => s.type === 'character').length + 1}` : `Předmět ${subjects.filter(s => s.type === 'object').length + 1}`,
        type: uploadType,
        data: base64Data,
        mimeType: file.type,
        url: base64String
      };

      setSubjects(prev => [...prev, newSubject]);
      setHasStarted(true);
    };
    reader.readAsDataURL(file);
    // Reset input
    e.target.value = '';
  };

  const removeSubject = (id: string) => {
    setSubjects(prev => prev.filter(s => s.id !== id));
  };

  const updateSubjectName = (id: string, name: string) => {
    setSubjects(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  };

  const addToast = (message: string, type: 'error' | 'success' = 'error') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const generateAdventure = async (destination: string, description: string) => {
    if (subjects.length === 0) return;

    const newAdventure: Adventure = {
      id: Date.now().toString(),
      prompt: destination,
      description,
      loading: true,
      aspectRatio: selectedAspectRatio,
    };

    setDestinations(prev => [newAdventure, ...prev]);
    setIsGenerating(true);

    try {
      // Final key check before spending tokens
      const isAIStudio = typeof window !== 'undefined' && !!(window as any).aistudio;
      let hasValidKey = false;
      
      if (isAIStudio) {
        hasValidKey = await (window as any).aistudio.hasSelectedApiKey();
      } else {
        const activeKey = customApiKey || process.env.GEMINI_API_KEY;
        hasValidKey = !!activeKey;
      }

      if (!hasValidKey) {
        setShowKeyDialog(true);
        setDestinations(prev => prev.map(adv => 
          adv.id === newAdventure.id ? { ...adv, loading: false, error: "Chybí API klíč" } : adv
        ));
        setIsGenerating(false);
        return;
      }

      const activeKey = isAIStudio 
        ? process.env.GEMINI_API_KEY 
        : (customApiKey || process.env.GEMINI_API_KEY);

      const apiInstance = new GoogleGenAI({
        apiKey: activeKey,
      });

      const config = {
        imageConfig: {
          aspectRatio: selectedAspectRatio,
          imageSize: selectedResolution,
        },
        responseModalities: ['IMAGE', 'TEXT'],
      };

      // Construct subject mapping for the prompt
      const subjectPrompt = subjects.map((s, idx) => {
        const typeLabel = s.type === 'character' ? 'Pet' : 'Object';
        const typeIdx = subjects.filter((sub, i) => sub.type === s.type && i < idx).length + 1;
        return `${s.name} (${typeLabel} ${typeIdx}) = Image ${idx}`;
      }).join(', ');

      const contents = [
        {
          role: 'user',
          parts: [
            ...subjects.map(s => ({
              inlineData: {
                data: s.data,
                mimeType: s.mimeType,
              }
            })),
            {
              text: `Place these subjects in a famous global location: ${destination}. 
              Subjects: ${subjectPrompt}. 
              Additional Details: ${description}. 
              Maintain strict subject consistency for characters and objects.
              Adjust the subject composition/pose as appropriate for the scene.
              Use Image Search for an accurate depiction of the landmark.`,
            },
          ],
        },
      ];

      // @ts-ignore - Using internal model name
      const response = await apiInstance.models.generateContentStream({
        model: "gemini-3.1-flash-image-preview",
        config,
        contents,
      });

      let finalImageUrl = '';

      for await (const chunk of response) {
        if (chunk.candidates?.[0]?.content?.parts) {
          for (const part of chunk.candidates[0].content.parts) {
            if (part.inlineData) {
              finalImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
          }
        }
      }

      if (finalImageUrl) {
        setDestinations(prev => prev.map(adv => 
          adv.id === newAdventure.id ? { ...adv, imageUrl: finalImageUrl, loading: false } : adv
        ));
      } else {
        throw new Error("Obrázek se nepodařilo vygenerovat");
      }

    } catch (error: any) {
      console.error("Generation error:", error);
      const errorMessage = error.message || "Nepodařilo se vygenerovat obrázek";
      
      if (errorMessage.includes("Requested entity was not found") || errorMessage.includes("404")) {
        setShowKeyDialog(true);
      } else {
        addToast(errorMessage, 'error');
      }

      setDestinations(prev => prev.map(adv => 
        adv.id === newAdventure.id ? { ...adv, loading: false, error: errorMessage } : adv
      ));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentDestination.trim() && !isGenerating) {
      generateAdventure(currentDestination.trim(), currentDescription.trim());
      setCurrentDestination('');
      setCurrentDescription('');
    }
  };

  const handleDownloadAlbum = () => {
    destinations.forEach((dest, index) => {
      if (dest.imageUrl) {
        const link = document.createElement('a');
        link.href = dest.imageUrl;
        link.download = `boriskuv-pas-${index + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  };

  const handleRestart = () => {
    setSubjects([]);
    setDestinations([]);
    setCurrentDestination('');
    setCurrentDescription('');
    setHasStarted(false);
  };

  const handleOpenSelectKey = async () => {
    await (window as any).aistudio?.openSelectKey();
    setShowKeyDialog(false);
  };

  const characterCount = subjects.filter(s => s.type === 'character').length;
  const objectCount = subjects.filter(s => s.type === 'object').length;

  if (!hasStarted) {
    return (
      <div className="max-w-6xl mx-auto pl-4 pr-6 sm:px-8 py-12">
        <header className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-2 border-black mb-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <Plane className="w-10 h-10" />
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-4 tracking-tight leading-none">
            Borískův Pas
          </h1>
          <p className="text-xl md:text-2xl font-serif italic opacity-90">
            Pošli své mazlíčky na dobrodružství do celého světa s Gemini 3.1 Flash Image
          </p>
          <button 
            onClick={() => setShowInstallGuide(true)}
            className="mt-6 inline-flex items-center gap-2 py-2 px-6 rounded-full border-2 border-black bg-white font-mono text-xs font-bold uppercase tracking-wider hover:bg-black hover:text-white transition-all transform hover:scale-105 active:scale-95 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
          >
            <Smartphone className="w-4 h-4 text-brand-orange" />
            Nainstalovat jako aplikaci do mobilu 📱
          </button>
        </header>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {TEMPLATE_IMAGES.map((img, idx) => (
            <div 
              key={img.id} 
              className={`bg-white p-4 rounded-2xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-transform hover:scale-105 cursor-pointer ${
                idx === 0 ? '-rotate-2' : idx === 1 ? 'rotate-1' : '-rotate-1'
              }`}
              onClick={() => {
                setUploadType('character');
                fileInputRef.current?.click();
              }}
            >
              <div 
                className="bg-black/5 rounded-xl border border-black/10 overflow-hidden mb-4"
                style={{ aspectRatio: img.aspect_ratio.replace(':', '/') }}
              >
                <img 
                  src={img.imageUrl} 
                  alt={img.location} 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-lg uppercase tracking-tight">{img.location}</h3>
                <div className="font-serif italic text-sm opacity-70 line-clamp-2 mt-1">
                  "{img.template_description}"
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="max-w-md mx-auto">
          <div className="bg-white p-8 rounded-3xl border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] sm:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] text-center">
            <h2 className="text-2xl font-bold mb-6">Začni své dobrodružství</h2>
            <p className="font-serif italic opacity-70 mb-8">
              Nahraj ostrou fotku svého mazlíčka a vydej se s ním na cestu kolem světa.
            </p>
            
            <button 
              onClick={() => {
                setUploadType('character');
                fileInputRef.current?.click();
              }}
              className="w-full flex items-center justify-center gap-3 py-6 px-8 rounded-2xl border-2 border-black bg-black text-white font-bold text-lg uppercase tracking-wider hover:bg-black/80 transition-all transform hover:scale-105 active:scale-95 focus:ring-4 focus:ring-white/20 focus:outline-none cursor-pointer"
            >
              <Upload className="w-6 h-6" />
              Nahrát fotku mazlíčka
            </button>

            <div className="mt-6 text-[10px] leading-relaxed text-left opacity-50 space-y-2">
              <p>
                Použitím této funkce potvrzujete, že máte potřebná práva k nahranému obsahu.
                Negenerujte prosím obsah, který porušuje duševní vlastnictví nebo soukromí ostatních.
                Používání této generativní AI služby podléhá našim Zásadám zakázaného užití.
              </p>
              <p>
                Upozorňujeme, že nahrané soubory z Google Workspace mohou být použity k vývoji a vylepšování služeb Google v souladu s našimi podmínkami.
              </p>
            </div>

            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept=".png,.jpg,.jpeg,.webp"
              className="hidden"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pl-4 pr-6 sm:px-8 py-12">
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white min-w-[280px] sm:min-w-[300px] max-w-[calc(100vw-2rem)]`}
            >
              <div className={`p-2 rounded-full ${toast.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
              </div>
              <div className="flex-1 text-sm font-bold leading-tight">
                {toast.message}
              </div>
              <button 
                onClick={() => removeToast(toast.id)}
                className="p-1 hover:bg-black/5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <header className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-2 border-black mb-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <Plane className="w-10 h-10" />
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-4 tracking-tight leading-none">
          Borískův Pas
        </h1>
        <p className="text-xl md:text-2xl font-serif italic opacity-90">
          Pošli své mazlíčky na dobrodružství do celého světa s Gemini 3.1 Flash Image
        </p>
        <button 
          onClick={() => setShowInstallGuide(true)}
          className="mt-6 inline-flex items-center gap-2 py-2 px-6 rounded-full border-2 border-black bg-white font-mono text-xs font-bold uppercase tracking-wider hover:bg-black hover:text-white transition-all transform hover:scale-105 active:scale-95 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
        >
          <Smartphone className="w-4 h-4 text-brand-orange" />
          Nainstalovat jako aplikaci do mobilu 📱
        </button>
      </header>

      <AnimatePresence>
        {showKeyDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] sm:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-w-md w-full p-6 sm:p-8 relative"
            >
              <button 
                onClick={() => setShowKeyDialog(false)}
                className="absolute top-4 right-4 p-2 hover:bg-black/5 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-orange/10 text-brand-orange mb-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <Settings className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold mb-4">Je vyžadován API klíč</h2>
                <p className="font-serif italic opacity-70 mb-6">
                  Pro generování obrázků pomocí Gemini 3.1 Flash Image je potřeba vybrat placený klíč Gemini API.
                  To zajistí nejlepší výkon pro dobrodružství vašeho mazlíčka.
                </p>
                
                <div className="bg-black/5 rounded-2xl p-4 mb-8 text-left border border-black/10">
                  <p className="text-xs font-bold uppercase tracking-widest opacity-50 mb-2 flex items-center gap-2">
                    <Info className="w-3 h-3" /> Důležité
                  </p>
                  <p className="text-sm leading-relaxed">
                    K běhu aplikace a generování obrázků je nezbytný API klíč pro Gemini API.
                    {typeof window !== 'undefined' && !(window as any).aistudio ? (
                      <span> Nastavit jej můžete buď zadáním klíče níže, nebo jeho konfigurací jako proměnné prostředí <code>GEMINI_API_KEY</code> v nastavení vašeho Netlify projektu.</span>
                    ) : (
                      <span> Prosím, vyberte API klíč z placeného projektu Google Cloud. Správu svých klíčů a fakturace můžete provádět v <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-brand-orange transition-colors">dokumentaci k fakturaci Gemini API</a>.</span>
                    )}
                  </p>
                </div>

                {typeof window !== 'undefined' && !(window as any).aistudio ? (
                  <div className="text-left">
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2">Váš Gemini API klíč:</label>
                    <input 
                      type="password"
                      placeholder="AIzaSy..."
                      value={customApiKey}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomApiKey(val);
                        localStorage.setItem('borisuv_pas_api_key', val);
                      }}
                      className="w-full p-4 rounded-xl border-2 border-black bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange mb-4 text-sm font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    />
                    <p className="text-[11px] opacity-60 leading-relaxed mb-6">
                      Klíč je bezpečně uložen pouze ve vašem vlastním prohlížeči (v paměti localStorage) a odesílá se napřímo přímo společnosti Google. Získat ho můžete zdarma na <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-brand-orange">Google AI Studio</a>.
                    </p>
                    <button 
                      onClick={() => setShowKeyDialog(false)}
                      className="w-full py-4 px-6 rounded-2xl border-2 border-black bg-brand-orange text-white font-bold uppercase tracking-widest hover:bg-brand-orange/80 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                    >
                      Uložit a pokračovat 🚀
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={handleOpenSelectKey}
                    className="w-full py-4 px-8 rounded-2xl border-2 border-black bg-black text-white font-bold uppercase tracking-widest hover:bg-black/80 transition-all transform hover:scale-[1.02] active:scale-[0.98] focus:ring-4 focus:ring-black/20 focus:outline-none cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  >
                    Vybrat API klíč
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {showInstallGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] sm:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-w-lg w-full p-6 sm:p-8 relative overflow-hidden"
            >
              <button 
                onClick={() => setShowInstallGuide(false)}
                className="absolute top-4 right-4 p-2 hover:bg-black/5 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="max-h-[80vh] overflow-y-auto pr-1">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-orange/10 text-brand-orange mb-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <Smartphone className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Instalace do mobilu</h2>
                  <p className="font-serif italic opacity-70 mb-6 text-sm">
                    Stáhni si aplikaci Borískův Pas přímo na plochu svého telefonu pro rychlý přístup a plnohodnotné zobrazení!
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 text-left mb-6">
                  <div className="border-2 border-black/10 rounded-2xl p-4 bg-black/5">
                    <h3 className="font-bold flex items-center gap-2 mb-3 text-brand-orange">
                      <span className="text-lg">🤖</span> Android & Chrome
                    </h3>
                    <ol className="text-xs space-y-2 list-decimal list-inside pl-1 leading-relaxed opacity-90">
                      <li>Otevři odkaz v prohlížeči <strong>Chrome</strong>.</li>
                      <li>Klepni na ikonu <strong>tří teček</strong> v pravém horním rohu.</li>
                      <li>Vyber možnost <strong>Přidat na plochu</strong> (nebo <strong>Instalovat aplikaci</strong>).</li>
                      <li>Potvrď stažení. Aplikace se ukáže na tvé hlavní obrazovce!</li>
                    </ol>
                  </div>

                  <div className="border-2 border-black/10 rounded-2xl p-4 bg-black/5">
                    <h3 className="font-bold flex items-center gap-2 mb-3 text-brand-orange">
                      <span className="text-lg">🍏</span> iPhone & Safari
                    </h3>
                    <ol className="text-xs space-y-2 list-decimal list-inside pl-1 leading-relaxed opacity-90">
                      <li>Spusť odkaz v nativním prohlížeči <strong>Safari</strong>.</li>
                      <li>Klepni dolů na tlačítko <strong>Sdílet</strong> (čtvereček se šipkou nahoru).</li>
                      <li>Sjeď níže a klikni na <strong>Přidat na plochu</strong>.</li>
                      <li>Vpravo nahoře klikni na <strong>Přidat</strong>. Ikonka se okamžitě zobrazí na ploše!</li>
                    </ol>
                  </div>
                </div>

                {deferredPrompt && (
                  <button 
                    onClick={() => {
                      handleInstallApp();
                      setShowInstallGuide(false);
                    }}
                    className="w-full py-4 px-6 mb-3 rounded-2xl border-2 border-black bg-brand-orange text-white font-bold uppercase tracking-widest hover:bg-brand-orange/80 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                  >
                    Nainstalovat hned jedním kliknutím 🚀
                  </button>
                )}

                <button 
                  onClick={() => setShowInstallGuide(false)}
                  className="w-full py-3 px-6 rounded-2xl border-2 border-black bg-white hover:bg-black/5 font-bold uppercase tracking-wider transition-colors cursor-pointer text-xs"
                >
                  Rozumím, zavřít
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left Column: Subjects & Config */}
        <div className="lg:col-span-4 space-y-8">
          {/* Subject Manager */}
          <div className="bg-white p-6 rounded-3xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
              <span>1. Nahraj subjekty</span>
            </h2>
            <h3 className="mb-4">
              <span className="text-xs font-mono opacity-50">{characterCount}/5 Mazlíčků • {objectCount}/14 Předmětů</span>
            </h3>
            
            <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {subjects.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-black/10 rounded-2xl">
                  <Camera className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-serif italic opacity-50">Zatím nebyly přidány žádné subjekty</p>
                </div>
              )}
              {subjects.map((s, idx) => (
                <div key={s.id} className="flex items-center gap-3 p-2 bg-black/5 rounded-xl border border-black/10 group">
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <img src={s.url} alt={s.name} className="w-full h-full object-cover rounded-lg border border-black/20" />
                    <div className="absolute -top-2 -left-2 bg-black text-white text-[10px] font-mono px-1 rounded">
                      img_{idx}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <input 
                      type="text" 
                      value={s.name}
                      onChange={(e) => updateSubjectName(s.id, e.target.value)}
                      className="w-full bg-transparent text-sm font-bold focus:outline-none border-b border-transparent focus:border-black focus:ring-2 focus:ring-black/5 rounded px-1"
                    />
                    <div className="text-[10px] uppercase tracking-widest opacity-50">{s.type === 'character' ? 'Mazlíček' : 'Předmět'}</div>
                  </div>
                  <button 
                    onClick={() => removeSubject(s.id)}
                    className="p-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 rounded-lg focus:opacity-100 focus:ring-2 focus:ring-red-500 focus:outline-none cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button 
                disabled={characterCount >= 5}
                onClick={() => {
                  setUploadType('character');
                  fileInputRef.current?.click();
                }}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-black font-bold text-xs uppercase tracking-wider hover:bg-black hover:text-white transition-colors disabled:opacity-30 focus:ring-2 focus:ring-black focus:outline-none cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Mazlíček
              </button>
              <button 
                disabled={objectCount >= 14}
                onClick={() => {
                  setUploadType('object');
                  fileInputRef.current?.click();
                }}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-black font-bold text-xs uppercase tracking-wider hover:bg-black hover:text-white transition-colors disabled:opacity-30 focus:ring-2 focus:ring-black focus:outline-none cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Předmět
              </button>
            </div>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept=".png,.jpg,.jpeg,.webp"
              className="hidden"
            />
          </div>

          {/* Configuration */}
          {showAdvanced && (
            <div className="bg-white p-6 rounded-3xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Upravit nastavení
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest opacity-50 mb-2">Poměr stran</label>
                  <div className="relative">
                    <select 
                      value={selectedAspectRatio}
                      onChange={(e) => setSelectedAspectRatio(e.target.value)}
                      className="w-full appearance-none bg-black/5 border-2 border-black rounded-xl py-3 px-4 font-bold focus:outline-none cursor-pointer focus:ring-2 focus:ring-black"
                    >
                      {ASPECT_RATIOS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest opacity-50 mb-2">Rozlišení</label>
                  <div className="relative">
                    <select 
                      value={selectedResolution}
                      onChange={(e) => setSelectedResolution(e.target.value)}
                      className="w-full appearance-none bg-black/5 border-2 border-black rounded-xl py-3 px-4 font-bold focus:outline-none cursor-pointer focus:ring-2 focus:ring-black"
                    >
                      {RESOLUTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          )}

          <button 
            onClick={handleRestart}
            className="w-full py-4 px-6 rounded-full border-2 border-black font-bold uppercase tracking-wider hover:bg-black hover:text-white transition-colors flex items-center justify-center gap-2 bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-black focus:outline-none cursor-pointer"
          >
            <RefreshCw className="w-5 h-5" />
            Restartovat dobrodružství
          </button>
        </div>

        {/* Right Column: Prompt & Results */}
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <MapPin className="w-6 h-6" />
                2. Naplánuj dobrodružství
              </h2>
              <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider hover:opacity-70 transition-opacity border-b border-black focus:ring-2 focus:ring-black focus:outline-none focus:border-transparent rounded px-1 cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                {showAdvanced ? 'Skrýt' : 'Zobrazit'} pokročilá nastavení
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest opacity-50 mb-2">Destinace</label>
                <input
                  type="text"
                  value={currentDestination}
                  onChange={(e) => setCurrentDestination(e.target.value)}
                  placeholder="např. Velká čínská zeď"
                  className="w-full bg-transparent border-b-2 border-black py-3 px-2 text-xl focus:outline-none focus:border-black/50 font-serif italic focus:ring-2 focus:ring-black/5 rounded"
                  disabled={isGenerating}
                />
              </div>

              {showAdvanced && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest opacity-50 mb-2">Popis scény</label>
                  <textarea
                    value={currentDescription}
                    onChange={(e) => setCurrentDescription(e.target.value)}
                    placeholder="Popište scénu, osvětlení a co přesně subjekty dělají..."
                    className="w-full bg-black/5 border-2 border-black rounded-2xl p-4 min-h-[120px] focus:outline-none focus:border-black focus:ring-2 focus:ring-black font-serif italic resize-none"
                    disabled={isGenerating}
                  />
                </div>
              )}

              <div className="flex justify-end items-center">
                <button 
                  type="submit"
                  disabled={!currentDestination.trim() || subjects.length === 0 || isGenerating}
                  className="w-full sm:w-auto bg-black text-white px-6 sm:px-12 py-4 rounded-full font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-black/80 transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 focus:ring-4 focus:ring-black/20 focus:outline-none cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generuji...
                    </>
                  ) : (
                    <>
                      <Plane className="w-5 h-5" />
                      3. Vygenerovat fotku z dovolené!
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-8 pt-8 border-t border-black/10">
              <p className="text-sm font-bold uppercase tracking-wider opacity-60 mb-4">Inspirace:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion, idx) => {
                  const petName = subjects.find(s => s.type === 'character')?.name || "Můj mazlíček";
                  const displaySuggestion = suggestion.replace("My pet", petName).replace("Můj mazlíček", petName);
                  return (
                    <button
                      key={idx}
                      onClick={() => setCurrentDestination(displaySuggestion)}
                      className="text-left text-xs py-2 px-4 rounded-full border border-black/20 hover:border-black hover:bg-black/5 transition-colors font-serif italic focus:ring-2 focus:ring-black focus:outline-none cursor-pointer"
                    >
                      "{displaySuggestion}"
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {destinations.length > 0 && (
            <div className="pt-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
                <h2 className="text-3xl sm:text-4xl font-bold">Cestovní album</h2>
                {destinations.some(d => d.imageUrl) && (
                  <button 
                    onClick={handleDownloadAlbum}
                    className="flex items-center gap-2 font-bold uppercase tracking-wider border-b-2 border-black pb-1 hover:opacity-70 transition-opacity cursor-pointer"
                  >
                    <Download className="w-5 h-5" />
                    Stáhnout vše
                  </button>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {destinations.map((dest) => (
                  <div key={dest.id} className="bg-white p-4 rounded-2xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] min-w-0 overflow-hidden">
                    <div 
                      className="bg-black/5 rounded-xl border border-black/10 overflow-hidden relative flex items-center justify-center mb-4 max-h-[600px] min-h-[120px] w-full max-w-full"
                      style={{ aspectRatio: dest.aspectRatio.replace(':', '/') }}
                    >
                      {dest.loading ? (
                        <div className="text-center p-4 sm:p-8 flex flex-col items-center justify-center w-full h-full">
                          <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin mb-4 opacity-50 flex-shrink-0" />
                          <p className="font-serif italic text-sm sm:text-base opacity-70 break-words w-full line-clamp-3">
                            Generuji fotku z místa: {dest.prompt}
                          </p>
                        </div>
                      ) : dest.error ? (
                        <div className="text-center text-red-600 px-6 py-8">
                          <p className="font-bold mb-2">Dobrodružství selhalo</p>
                          <p className="text-sm opacity-80">{dest.error}</p>
                        </div>
                      ) : dest.imageUrl ? (
                        <img 
                          src={dest.imageUrl} 
                          alt={dest.prompt}
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="px-2 min-w-0">
                      <h3 className="font-bold text-lg uppercase tracking-tight break-words">{dest.prompt}</h3>
                      {dest.description && (
                        <p className="font-serif italic text-sm opacity-70 line-clamp-2 mt-1 break-words">
                          "{dest.description}"
                        </p>
                      )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-black/10 flex justify-between items-center px-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Gemini 3.1 Flash Image</span>
                      <span className="text-[10px] font-mono opacity-50">{new Date(parseInt(dest.id)).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
