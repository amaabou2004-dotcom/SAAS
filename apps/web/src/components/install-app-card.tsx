import { Download, Share, Smartphone, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** L'application tourne-t-elle déjà comme une application installée ? */
function isRunningInstalled() {
  if (typeof window === 'undefined') return false;
  const displayMode = window.matchMedia?.('(display-mode: standalone)').matches === true;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return displayMode || iosStandalone;
}

function isIosDevice() {
  return typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Propose d'installer Stokari sur l'écran d'accueil. Le navigateur décide :
 * quand il ne propose rien (ordinateur, navigateur ancien), la carte
 * n'apparaît pas du tout plutôt que d'afficher un bouton inutile.
 */
export function InstallAppCard() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const isIos = isIosDevice();
  const [installed, setInstalled] = useState(isRunningInstalled);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (hidden || installed) return null;
  if (!promptEvent && !isIos) return null;

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setPromptEvent(null);
  };

  return (
    <section className="mt-5 rounded-2xl border border-teal-200 bg-teal-50 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-mint-dark">
            <Smartphone className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold text-ink">Installer Stokari sur votre téléphone</p>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-700">
              L’application s’ouvre d’un seul geste, sans passer par le navigateur, et supporte mieux les coupures
              de réseau.
            </p>
            {isIos && !promptEvent ? (
              <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-mint-dark">
                <Share className="size-4" aria-hidden="true" />
                Touchez « Partager », puis « Sur l’écran d’accueil ».
              </p>
            ) : null}
            {promptEvent ? (
              <Button variant="mint" className="mt-3" onClick={() => { void install(); }}>
                <Download className="size-4" aria-hidden="true" />
                Installer l’application
              </Button>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          aria-label="Masquer la proposition d’installation"
          className="text-slate-400 hover:text-ink"
          onClick={() => setHidden(true)}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
