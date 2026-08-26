import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

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

type GoogleConfig = {
  enabled: boolean;
  clientId: string | null;
};

export function GoogleLoginButton({ onSuccess, onError }: {
  onSuccess: (credential: string) => void;
  onError?: (msg: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const res = await api.get<GoogleConfig>('/auth/google/config');
      if (cancelled) return;

      if (res.success && res.data?.enabled && res.data.clientId) {
        setClientId(res.data.clientId);
      } else {
        setConfigError(
          'Google login is not configured. Set GOOGLE_CLIENT_ID in Vercel or Admin → Settings → API & Integrations.',
        );
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!clientId || !containerRef.current || initializedRef.current) return;

    const initButton = () => {
      if (!window.google?.accounts?.id || !containerRef.current || initializedRef.current) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) onSuccessRef.current(response.credential);
          else onErrorRef.current?.('Google sign-in failed');
        },
      });

      containerRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
      });
      initializedRef.current = true;
    };

    if (window.google?.accounts?.id) {
      initButton();
      return;
    }

    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(timer);
        initButton();
      }
    }, 200);

    const timeout = setTimeout(() => clearInterval(timer), 15000);

    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, [clientId]);

  if (loading) {
    return (
      <div className="w-full py-3 text-center text-sm text-gray-400 border rounded-lg bg-gray-50">
        Loading Google sign-in…
      </div>
    );
  }

  if (configError || !clientId) {
    return (
      <button type="button" disabled className="w-full py-3 border rounded-lg text-sm text-gray-400 bg-gray-50">
        {configError || 'Google login unavailable'}
      </button>
    );
  }

  return <div ref={containerRef} className="flex justify-center w-full" />;
}
