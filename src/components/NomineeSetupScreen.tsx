import React, { useState, useEffect } from 'react';
import { Shield, Lock, Key, CheckCircle, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { VoicePinInput } from './VoicePinInput';

interface NomineeSetupScreenProps {
  initialEmail?: string;
  initialToken?: string;
  onSuccess?: () => void;
}

export const NomineeSetupScreen: React.FC<NomineeSetupScreenProps> = ({
  initialEmail = '',
  initialToken = '',
  onSuccess
}) => {
  const { t, language, accessibilitySettings } = useApp();

  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const urlEmail = searchParams.get('email');
      const urlToken = searchParams.get('token');
      if (urlEmail && !email) setEmail(urlEmail);
      if (urlToken && !token) setToken(urlToken);
    }
  }, []);

  const currentTheme =
    accessibilitySettings.themeMode ||
    (accessibilitySettings.highContrast ? 'high-contrast' : 'light');

  const containerBg =
    currentTheme === 'high-contrast'
      ? 'bg-black text-white border-white'
      : currentTheme === 'dark'
      ? 'bg-slate-900 text-white border-emerald-500/30'
      : 'bg-white text-slate-900 border-emerald-500/30';

  const inputBg =
    currentTheme === 'high-contrast'
      ? 'bg-black text-white border-white'
      : currentTheme === 'dark'
      ? 'bg-slate-800 text-white border-slate-700'
      : 'bg-slate-50 text-slate-900 border-slate-300';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t('nominee.passMismatch') || 'Passwords do not match.');
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setError(t('nominee.pinInvalid') || 'PIN must be exactly 4 numeric digits.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/nominee/setup-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomineeEmail: email,
          inviteToken: token,
          nomineePassword: password,
          nomineePin: pin
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Invalid or expired invite token.');
      } else {
        setSuccess(true);
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Network error during nominee setup.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`max-w-md mx-auto p-6 rounded-2xl shadow-xl border ${containerBg}`}>
      <div className="flex items-center space-x-3 mb-4">
        <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-500">
          <Shield className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold">{t('nominee.setupTitle') || 'Set Your Nominee Credentials'}</h2>
          <p className="text-xs opacity-70">
            {t('nominee.setupSubtitle') ||
              'Create your nominee password and 4-digit security PIN to approve restricted food orders.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-[#EFF7F1]0/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success ? (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm flex items-center space-x-3">
          <CheckCircle className="w-6 h-6 flex-shrink-0 text-emerald-500" />
          <span>
            {t('nominee.successMsg') ||
              'Nominee setup completed successfully! You can now log in to review approval requests.'}
          </span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1 opacity-80">
              {t('nominee.emailLabel') || 'Nominee Email'}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={`w-full px-3 py-2 rounded-lg text-sm outline-none focus:border-emerald-500 ${inputBg}`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 opacity-80">
              {t('nominee.tokenLabel') || 'Invite Token (from Email)'}
            </label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              className={`w-full px-3 py-2 rounded-lg text-sm font-mono outline-none focus:border-emerald-500 ${inputBg}`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 opacity-80">
              {t('nominee.passLabel') || 'New Nominee Password'}
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none focus:border-emerald-500 ${inputBg}`}
              />
              <Lock className="w-4 h-4 absolute left-3 top-2.5 opacity-50" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 opacity-80">
              {t('nominee.passConfirmLabel') || 'Confirm Password'}
            </label>
            <div className="relative">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none focus:border-emerald-500 ${inputBg}`}
              />
              <Lock className="w-4 h-4 absolute left-3 top-2.5 opacity-50" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 opacity-80">
              {t('nominee.pinLabel') || '4-Digit Nominee PIN'}
            </label>
            <div className="relative">
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                required
                placeholder="••••"
                className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm font-mono tracking-widest outline-none focus:border-emerald-500 ${inputBg}`}
              />
              <Key className="w-4 h-4 absolute left-3 top-2.5 opacity-50" />
            </div>
            <VoicePinInput
              language={language}
              owner="nominee_setup_pin"
              purpose="nominee"
              autoStart
              disabled={isSubmitting}
              onPinChange={setPin}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-colors shadow-lg shadow-emerald-900/30 cursor-pointer"
          >
            {isSubmitting ? 'Processing...' : t('nominee.submitBtn') || 'Complete Nominee Setup'}
          </button>
        </form>
      )}
    </div>
  );
};
