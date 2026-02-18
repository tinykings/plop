'use client';

import React, { createContext, useContext, useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { RepoSettings } from '@/services/githubSync';

interface SettingsContextType {
  repoSettings: RepoSettings;
  updateRepoSettings: (settings: Partial<RepoSettings>) => void;
  isRepoConfigured: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const DEFAULT_REPO_SETTINGS: RepoSettings = {
  owner: '',
  repo: '',
  token: '',
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [repoSettings, setRepoSettings] = useLocalStorage<RepoSettings>(
    'plop-repo-settings',
    DEFAULT_REPO_SETTINGS
  );

  const updateRepoSettings = useCallback(
    (updates: Partial<RepoSettings>) => {
      setRepoSettings((prev) => ({ ...prev, ...updates }));
    },
    [setRepoSettings]
  );

  const isRepoConfigured = Boolean(
    repoSettings.owner && repoSettings.repo && repoSettings.token
  );

  return (
    <SettingsContext.Provider
      value={{ repoSettings, updateRepoSettings, isRepoConfigured }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
}
