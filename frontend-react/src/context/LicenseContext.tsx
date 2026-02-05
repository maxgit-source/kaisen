import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Api } from '../lib/api';
import { useAuth } from './AuthContext';

export type LicenseStatus = {
  licensed: boolean;
  features: string[];
  max_users: number | null;
  expires_at: string | null;
  install_id: string | null;
  reason: string | null;
  license_type?: 'full' | 'demo';
  demo_active?: boolean;
  demo_started_at?: string | null;
  demo_expires_at?: string | null;
  demo_days_left?: number | null;
  demo_days_total?: number | null;
};

type LicenseContextType = {
  status: LicenseStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setStatus(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await Api.licenseStatus();
      setStatus(data as LicenseStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la licencia');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ status, loading, error, refresh }),
    [status, loading, error, refresh],
  );

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export function useLicense() {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicense must be used within LicenseProvider');
  return ctx;
}
