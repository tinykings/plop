'use client';

import { useState, useEffect } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { useTheme } from '@/context/ThemeContext';
import { testConnection } from '@/services/githubSync';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { repoSettings, updateRepoSettings, isRepoConfigured } = useSettings();
  const { theme, toggleTheme } = useTheme();

  const [owner, setOwner] = useState(repoSettings.owner);
  const [repo, setRepo] = useState(repoSettings.repo);
  const [token, setToken] = useState(repoSettings.token);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setOwner(repoSettings.owner);
      setRepo(repoSettings.repo);
      setToken(repoSettings.token);
      setMessage(null);
    }
  }, [isOpen, repoSettings]);

  if (!isOpen) return null;

  const handleSave = () => {
    updateRepoSettings({ owner: owner.trim(), repo: repo.trim(), token: token.trim() });
    setMessage({ type: 'success', text: 'Settings saved!' });
    setTimeout(() => setMessage(null), 2000);
  };

  const handleTest = async () => {
    if (!owner || !repo || !token) {
      setMessage({ type: 'error', text: 'Fill in all fields first.' });
      return;
    }
    setIsTesting(true);
    setMessage(null);
    try {
      await testConnection({ owner: owner.trim(), repo: repo.trim(), token: token.trim() });
      setMessage({ type: 'success', text: 'Connection successful!' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Connection failed.' });
    } finally {
      setIsTesting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    fontSize: 16,
    border: '1px solid var(--border)',
    borderRadius: 0,
    background: 'var(--card)',
    color: 'var(--foreground)',
    outline: 'none',
    boxSizing: 'border-box',
    minHeight: 48,
    transition: 'box-shadow 0.2s',
    fontFamily: 'inherit',
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 20,
      }}
    >
      <div style={{
        background: 'var(--background)',
        width: '100%',
        maxWidth: 400,
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '12px 12px 0 rgba(0,0,0,0.2)',
        border: '1px solid var(--border)',
        borderRadius: 0,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, margin: 0, fontFamily: 'var(--font-display)' }}>Settings</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              color: 'var(--muted)',
              padding: 8,
              minWidth: 44,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 0,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--foreground)';
              e.currentTarget.style.color = 'var(--background)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = 'var(--muted)';
            }}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 24 }}>

          {/* Theme */}
          <div style={{ marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 12, color: 'var(--muted)', fontFamily: 'var(--font-display)' }}>
              Theme
            </h3>
            <button
              onClick={toggleTheme}
              style={{
                width: '100%',
                padding: '14px 20px',
                fontSize: 16,
                fontWeight: 500,
                border: '1px solid var(--border)',
                borderRadius: 0,
                background: 'var(--card)',
                color: 'var(--foreground)',
                cursor: 'pointer',
                minHeight: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                transition: 'all 0.2s',
              }}
            >
              {theme === 'dark' ? (
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
                </svg>
              ) : (
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="5"/>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              )}
              {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </button>
          </div>

          {/* GitHub Repo */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, color: 'var(--muted)', fontFamily: 'var(--font-display)' }}>
              GitHub Repo Storage
            </h3>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.5 }}>
              Notes are saved as <code style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '2px 5px', fontSize: 13 }}>.txt</code> files
              in a GitHub repo. You need a token with <code style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '2px 5px', fontSize: 13 }}>repo</code> scope.
            </p>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 15, fontWeight: 500, marginBottom: 8 }}>GitHub Token</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              style={inputStyle}
              onFocus={(e) => (e.target.style.boxShadow = '4px 4px 0 var(--accent)')}
              onBlur={(e) => (e.target.style.boxShadow = 'none')}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Owner (username or org)</label>
            <input
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="your-github-username"
              style={inputStyle}
              onFocus={(e) => (e.target.style.boxShadow = '4px 4px 0 var(--accent)')}
              onBlur={(e) => (e.target.style.boxShadow = 'none')}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Repository Name</label>
            <input
              type="text"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="my-notes"
              style={inputStyle}
              onFocus={(e) => (e.target.style.boxShadow = '4px 4px 0 var(--accent)')}
              onBlur={(e) => (e.target.style.boxShadow = 'none')}
            />
          </div>

          {message && (
            <div style={{
              padding: '12px 16px',
              marginBottom: 16,
              fontSize: 14,
              background: message.type === 'success' ? 'var(--green)' : 'var(--red)',
              color: 'var(--background)',
              fontWeight: 500,
            }}>
              {message.text}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={handleSave}
              style={{
                padding: '14px 20px',
                fontSize: 16,
                fontWeight: 600,
                border: 'none',
                borderRadius: 0,
                background: 'var(--accent)',
                color: 'var(--background)',
                cursor: 'pointer',
                minHeight: 48,
                transition: 'transform 0.1s',
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'translate(2px, 2px)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'none')}
            >
              Save Settings
            </button>

            <button
              onClick={handleTest}
              disabled={isTesting || !owner || !repo || !token}
              style={{
                padding: '14px 20px',
                fontSize: 16,
                fontWeight: 500,
                border: '1px solid var(--border)',
                borderRadius: 0,
                background: 'var(--background)',
                color: 'var(--foreground)',
                cursor: isTesting || !owner || !repo || !token ? 'not-allowed' : 'pointer',
                opacity: isTesting || !owner || !repo || !token ? 0.5 : 1,
                minHeight: 48,
              }}
              onMouseEnter={(e) => {
                if (!isTesting && owner && repo && token)
                  e.currentTarget.style.background = 'var(--card)';
              }}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--background)')}
            >
              {isTesting ? 'Testing…' : 'Test Connection'}
            </button>
          </div>

          {/* Sync status */}
          <div style={{
            marginTop: 24,
            padding: 16,
            background: 'var(--card)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: isRepoConfigured ? 'var(--green)' : 'var(--muted)',
              }} />
              <span style={{ fontSize: 15 }}>
                {isRepoConfigured ? 'Repo configured' : 'Not configured'}
              </span>
            </div>
            {isRepoConfigured && (
              <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: 13 }}>
                {repoSettings.owner}/{repoSettings.repo}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
