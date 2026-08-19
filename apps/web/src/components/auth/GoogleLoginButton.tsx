import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (res: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, config: { theme?: string; size?: string; width?: number; text?: string }) => void;
        };
      };
    };
  }
}

export function GoogleLoginButton({ onSuccess, onError }: {
  onSuccess: (credential: string) => void;
  onError?: (msg: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!clientId || !ref.current) return;

    const init = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) onSuccess(response.credential);
          else onError?.('Google sign-in failed');
        },
      });
      if (ref.current) {
        ref.current.innerHTML = '';
        window.google.accounts.id.renderButton(ref.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
        });
      }
    };

    if (window.google?.accounts?.id) init();
    else {
      const timer = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(timer);
          init();
        }
      }, 200);
      return () => clearInterval(timer);
    }
  }, [clientId, onSuccess, onError]);

  if (!clientId) {
    return (
      <button type="button" disabled className="w-full py-3 border rounded-lg text-sm text-gray-400 bg-gray-50">
        Google Login (configure VITE_GOOGLE_CLIENT_ID)
      </button>
    );
  }

  return <div ref={ref} className="flex justify-center w-full" />;
}
