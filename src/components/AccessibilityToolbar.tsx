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
      ? 'bg-zinc-800 text-white border border-zinc-700 shadow-xs'
      : 'bg-white text-zinc-900 border border-[#DFF3E8]/80 shadow-xs';

  const labelTextClass =
    currentTheme === 'high-contrast' || currentTheme === 'dark'
      ? 'text-white'
      : 'text-zinc-700';

  const unselectedOptionClass =
    currentTheme === 'high-contrast'
      ? 'bg-black text-white hover:bg-neutral-900 border border-yellow-400'
      : currentTheme === 'dark'
      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
      : 'bg-transparent text-zinc-700 hover:bg-[#EFF7F1]/60';

  return (
    <div
      className={`accessibility-bar py-2 px-3 sm:px-6 w-full transition-colors duration-200 border-b ${
        currentTheme === 'high-contrast'
          ? 'bg-black text-white border-yellow-400'
          : currentTheme === 'dark'
          ? 'bg-zinc-900/95 text-zinc-100 border-zinc-800 backdrop-blur-md'
          : 'bg-white/95 text-zinc-900 border-[#DFF3E8]/70 backdrop-blur-md shadow-xs'
      }`}
    >
      <div className="accessibility-container w-full max-w-7xl mx-auto flex flex-col justify-center min-w-0">
        
        {/* DISPLAY AND ACCESSIBILITY SETTINGS ROW */}
        <div className="flex flex-wrap items-center justify-start sm:justify-between gap-2.5 font-bold min-w-0 w-full text-xs sm:text-sm">
          
          {/* Title Label Pill */}
          <div className={`a11y-group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full ${pillGroupSurface}`}>
            <Sparkles className="w-4 h-4 text-[#087F5B] shrink-0" />
            <span className={`a11y-label font-extrabold tracking-wide text-xs uppercase leading-tight ${labelTextClass}`}>
              {t('nav.accessibility')}:
            </span>
          </div>

          {/* 🌐 1. LANGUAGE SELECTION OPTIONS */}
          <div className={`a11y-group flex flex-wrap items-center justify-start gap-1 p-1 rounded-full ${pillGroupSurface}`}>
            <div className="flex items-center gap-1.5 px-2.5 shrink-0">
              <Globe className="w-4 h-4 text-[#087F5B] shrink-0" />
              <span className={`a11y-label font-bold text-xs ${labelTextClass}`}>Lang:</span>
            </div>
            
            <button
              type="button"
              onClick={() => handleLanguageSelect('en')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer flex items-center justify-center text-xs ${
                language === 'en'
                  ? 'bg-[#087F5B] text-white shadow-xs'
                  : unselectedOptionClass
              }`}
              title="Switch to English"
            >
              EN
            </button>

            <button
              type="button"
              onClick={() => handleLanguageSelect('ta')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer flex items-center justify-center text-xs ${
                language === 'ta'
                  ? 'bg-[#087F5B] text-white shadow-xs'
                  : unselectedOptionClass
              }`}
              title="Switch to Tamil (தமிழ்)"
            >
              தமிழ்
            </button>

            <button
              type="button"
              onClick={() => handleLanguageSelect('hi')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer flex items-center justify-center text-xs ${
                language === 'hi'
                  ? 'bg-[#087F5B] text-white shadow-xs'
                  : unselectedOptionClass
              }`}
              title="Switch to Hindi (हिन्दी)"
            >
              हिन्दी
            </button>

            <button
              type="button"
              onClick={() => setIsLanguageModalOpen(true)}
              className={`px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer flex items-center justify-center text-xs border border-[#E4EBE5] hover:bg-[#EFF7F1] ${
                currentTheme === 'high-contrast'
                  ? 'bg-yellow-400 text-black border-white'
                  : currentTheme === 'dark'
                  ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
                  : 'bg-[#EFF7F1] text-[#087F5B]'
              }`}
              title="Open Language Selector Dialog"
            >
              Dialog 💬
            </button>
          </div>

          {/* 🎨 2. THEME SELECTION OPTIONS */}
          <div className={`a11y-group flex flex-wrap items-center justify-start gap-1 p-1 rounded-full ${pillGroupSurface}`}>
            <span className={`a11y-label font-bold px-2.5 text-xs shrink-0 ${labelTextClass}`}>Theme:</span>

            <button
              type="button"
              onClick={() => handleThemeChange('light')}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer text-xs ${
                currentTheme === 'light'
                  ? 'bg-[#087F5B] text-white shadow-xs'
                  : unselectedOptionClass
              }`}
              title="Light Mode Theme"
            >
              <Sun className="w-3.5 h-3.5 shrink-0" />
              <span>Light</span>
            </button>

            <button
              type="button"
              onClick={() => handleThemeChange('dark')}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer text-xs ${
                currentTheme === 'dark'
                  ? 'bg-[#087F5B] text-white shadow-xs'
                  : unselectedOptionClass
              }`}
              title="Dark Mode Theme"
            >
              <Moon className="w-3.5 h-3.5 shrink-0" />
              <span>Dark</span>
            </button>

            <button
              type="button"
              onClick={() => handleThemeChange('high-contrast')}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer text-xs ${
                currentTheme === 'high-contrast'
                  ? 'bg-yellow-400 text-black shadow-xs border border-white'
                  : unselectedOptionClass
              }`}
              title="High Contrast Accessibility Theme"
            >
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span>High Contrast</span>
            </button>
          </div>

          {/* 🔤 3. TEXT SIZE SCALE */}
          <div className={`a11y-group flex flex-wrap items-center justify-start gap-1 p-1 rounded-full ${pillGroupSurface}`}>
            <div className="flex items-center gap-1 px-2 shrink-0">
              <Type className="w-3.5 h-3.5 text-[#087F5B] shrink-0" />
              <span className={`a11y-label font-bold text-xs ${labelTextClass}`}>Size:</span>
            </div>
            {(['sm', 'md', 'lg', 'xl'] as const).map(size => (
              <button
                key={size}
                type="button"
                onClick={() => handleTextSizeChange(size)}
                className={`px-2.5 py-1 rounded-full uppercase font-bold transition-all flex items-center justify-center cursor-pointer text-xs ${
                  accessibilitySettings.textSize === size
                    ? 'bg-[#087F5B] text-white shadow-xs'
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
            className={`a11y-group inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full font-bold transition-all cursor-pointer text-xs ${
              autoVoicePromptEnabled
                ? 'bg-emerald-600 text-white shadow-xs'
                : pillGroupSurface
            }`}
            title="Toggle Automatic Voice Prompt on Search"
          >
            {autoVoicePromptEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-100 shrink-0" />
            ) : (
              <VolumeX className="w-4 h-4 shrink-0 text-zinc-400" />
            )}
            <span className="leading-tight">Voice: {autoVoicePromptEnabled ? 'ON' : 'OFF'}</span>
          </button>

        </div>

      </div>
    </div>
  );
};
