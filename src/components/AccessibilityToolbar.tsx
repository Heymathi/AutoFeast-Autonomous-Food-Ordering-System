import React from 'react';
import { useApp } from '../context/AppContext';
import { Language } from '../types';
import { Volume2, VolumeX, Sparkles, Type, Globe, Sun, Moon, Eye } from 'lucide-react';

export const AccessibilityToolbar: React.FC = () => {
  const {
    accessibilitySettings,
    setAccessibilitySettings,
    autoVoicePromptEnabled,
    setAutoVoicePromptEnabled,
    language,
    setLanguage,
    setIsLanguageModalOpen,
    t,
    speakText
  } = useApp();

  const handleTextSizeChange = (size: 'sm' | 'md' | 'lg' | 'xl') => {
    setAccessibilitySettings(prev => ({ ...prev, textSize: size }));
    const sizeMsg =
      size === 'sm'
        ? 'Text size small'
        : size === 'md'
        ? 'Text size medium'
        : size === 'lg'
        ? 'Text size large'
        : 'Text size extra large';
    speakText(sizeMsg);
  };

  const handleThemeChange = (mode: 'light' | 'dark' | 'high-contrast') => {
    const isHC = mode === 'high-contrast';
    setAccessibilitySettings(prev => ({
      ...prev,
      themeMode: mode,
      highContrast: isHC
    }));
    const msg =
      mode === 'light'
        ? 'Light theme activated'
        : mode === 'dark'
        ? 'Dark theme activated'
        : 'High contrast theme activated';
    speakText(msg);
  };

  const handleLanguageSelect = (newLang: Language) => {
    setLanguage(newLang);
    const langMsg =
      newLang === 'ta'
        ? 'தமிழ் மொழி தேர்ந்தெடுக்கப்பட்டது'
        : newLang === 'hi'
        ? 'हिंदी भाषा चुनी गई'
        : 'English Language Selected';
    speakText(langMsg);
  };

  const handleAutoVoiceToggle = () => {
    const nextVal = !autoVoicePromptEnabled;
    setAutoVoicePromptEnabled(nextVal);
    speakText(nextVal ? 'Auto Voice Prompt Enabled' : 'Auto Voice Prompt Disabled');
  };

  const currentTheme =
    accessibilitySettings.themeMode ||
    (accessibilitySettings.highContrast ? 'high-contrast' : 'light');

  const pillGroupSurface =
    currentTheme === 'high-contrast'
      ? 'bg-black text-white border-2 border-yellow-400'
      : currentTheme === 'dark'
      ? 'bg-slate-800 text-white border border-slate-600 shadow-sm'
      : 'bg-[#FFFFFF] text-[#111827] border border-[#D1D5DB] shadow-sm';

  const labelTextClass =
    currentTheme === 'high-contrast' || currentTheme === 'dark'
      ? 'text-white'
      : 'text-[#111827]';

  const unselectedOptionClass =
    currentTheme === 'high-contrast'
      ? 'bg-black text-white hover:bg-neutral-900 border border-yellow-400'
      : currentTheme === 'dark'
      ? 'bg-slate-800 text-white hover:bg-slate-700'
      : 'bg-[#FFFFFF] text-[#111827] hover:bg-slate-100';

  return (
    <div
      className={`accessibility-bar py-2.5 px-2 sm:px-4 lg:px-6 shadow-xs w-full transition-colors duration-200 ${
        currentTheme === 'high-contrast'
          ? 'bg-black text-white border-b-2 border-yellow-400'
          : currentTheme === 'dark'
          ? 'bg-slate-900 text-slate-100 border-b border-slate-800'
          : 'bg-[#DAF0F7] text-[#111827] border-b border-[#B2E2F0]'
      }`}
    >
      <div className="accessibility-container w-full max-w-full mx-auto flex flex-col justify-center min-w-0">
        
        {/* DISPLAY AND ACCESSIBILITY SETTINGS ROW */}
        <div className="flex flex-wrap items-stretch justify-start gap-2.5 sm:gap-3 font-bold min-w-0 w-full">
          
          {/* Title Label Pill */}
          <div className={`a11y-group flex items-center justify-center gap-2 px-3.5 py-2 rounded-2xl min-h-[48px] ${pillGroupSurface}`}>
            <Sparkles className="w-6 h-6 text-[#FF5A1F] shrink-0" />
            <span className={`a11y-label font-bold tracking-wide uppercase leading-tight ${labelTextClass}`}>
              {t('nav.accessibility')}:
            </span>
          </div>

          {/* 🌐 1. LANGUAGE SELECTION OPTIONS */}
          <div className={`a11y-group flex flex-wrap items-center justify-start gap-2 p-1.5 rounded-2xl ${pillGroupSurface}`}>
            <div className="flex items-center gap-1.5 px-2 shrink-0">
              <Globe className="w-6 h-6 text-[#FF5A1F] shrink-0" />
              <span className={`a11y-label font-bold leading-tight ${labelTextClass}`}>Lang:</span>
            </div>
            
            <button
              type="button"
              onClick={() => handleLanguageSelect('en')}
              className={`flex-1 px-3.5 py-2.5 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center ${
                language === 'en'
                  ? 'bg-[#FF5A1F] text-white shadow-sm'
                  : unselectedOptionClass
              }`}
              title="Switch to English"
            >
              🇬🇧 English
            </button>

            <button
              type="button"
              onClick={() => handleLanguageSelect('ta')}
              className={`flex-1 px-3.5 py-2.5 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center ${
                language === 'ta'
                  ? 'bg-[#FF5A1F] text-white shadow-sm'
                  : unselectedOptionClass
              }`}
              title="Switch to Tamil (தமிழ்)"
            >
              🇮🇳 தமிழ்
            </button>

            <button
              type="button"
              onClick={() => handleLanguageSelect('hi')}
              className={`flex-1 px-3.5 py-2.5 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center ${
                language === 'hi'
                  ? 'bg-[#FF5A1F] text-white shadow-sm'
                  : unselectedOptionClass
              }`}
              title="Switch to Hindi (हिन्दी)"
            >
              🇮🇳 हिन्दी
            </button>

            <button
              type="button"
              onClick={() => setIsLanguageModalOpen(true)}
              className={`flex-1 px-3.5 py-2.5 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center border ${
                currentTheme === 'high-contrast'
                  ? 'bg-yellow-400 text-black border-white'
                  : currentTheme === 'dark'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 hover:bg-amber-400'
                  : 'bg-amber-100 text-[#111827] border-amber-400 hover:bg-amber-200'
              }`}
              title="Open Language Selector Dialog"
            >
              Dialog 💬
            </button>
          </div>

          {/* 🎨 2. THEME SELECTION OPTIONS */}
          <div className={`a11y-group flex flex-wrap items-center justify-start gap-2 p-1.5 rounded-2xl ${pillGroupSurface}`}>
            <span className={`a11y-label font-bold px-2 leading-tight shrink-0 ${labelTextClass}`}>Theme:</span>

            <button
              type="button"
              onClick={() => handleThemeChange('light')}
              className={`flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${
                currentTheme === 'light'
                  ? 'bg-[#FF5A1F] text-white shadow-sm'
                  : unselectedOptionClass
              }`}
              title="Light Mode Theme"
            >
              <Sun className="w-6 h-6 shrink-0" />
              <span>Light</span>
            </button>

            <button
              type="button"
              onClick={() => handleThemeChange('dark')}
              className={`flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${
                currentTheme === 'dark'
                  ? 'bg-[#FF5A1F] text-white shadow-sm'
                  : unselectedOptionClass
              }`}
              title="Dark Mode Theme"
            >
              <Moon className="w-6 h-6 shrink-0" />
              <span>Dark</span>
            </button>

            <button
              type="button"
              onClick={() => handleThemeChange('high-contrast')}
              className={`flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${
                currentTheme === 'high-contrast'
                  ? 'bg-yellow-400 text-black shadow-sm border-2 border-white'
                  : unselectedOptionClass
              }`}
              title="High Contrast Accessibility Theme"
            >
              <Eye className="w-6 h-6 shrink-0" />
              <span>High Contrast</span>
            </button>
          </div>

          {/* 🔤 3. TEXT SIZE SCALE */}
          <div className={`a11y-group flex flex-wrap items-center justify-start gap-2 p-1.5 rounded-2xl ${pillGroupSurface}`}>
            <div className="flex items-center gap-1.5 px-2 shrink-0">
              <Type className="w-6 h-6 text-[#FF5A1F] shrink-0" />
              <span className={`a11y-label font-bold leading-tight ${labelTextClass}`}>Size:</span>
            </div>
            {(['sm', 'md', 'lg', 'xl'] as const).map(size => (
              <button
                key={size}
                type="button"
                onClick={() => handleTextSizeChange(size)}
                className={`flex-1 min-w-[48px] px-3.5 py-2.5 rounded-xl uppercase font-bold transition-all flex items-center justify-center cursor-pointer ${
                  accessibilitySettings.textSize === size
                    ? 'bg-[#FF5A1F] text-white shadow-sm'
                    : unselectedOptionClass
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          {/* 🗣️ 4. AUTO VOICE PROMPT TOGGLE */}
          <button
            type="button"
            onClick={handleAutoVoiceToggle}
            className={`a11y-group flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl font-bold transition-all cursor-pointer ${
              autoVoicePromptEnabled
                ? 'bg-[#16A34A] text-white border border-[#15803D] shadow-sm'
                : pillGroupSurface
            }`}
            title="Toggle Automatic Voice Prompt on Search"
          >
            {autoVoicePromptEnabled ? (
              <Volume2 className="w-6 h-6 text-yellow-200 shrink-0" />
            ) : (
              <VolumeX className="w-6 h-6 shrink-0" />
            )}
            <span className="leading-tight">Auto Voice: {autoVoicePromptEnabled ? 'ON' : 'OFF'}</span>
          </button>

        </div>

      </div>
    </div>
  );
};
