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

  const currentTheme = accessibilitySettings.themeMode || (accessibilitySettings.highContrast ? 'high-contrast' : 'light');

  return (
    <div
      className={`py-2 px-2 sm:px-4 shadow-xs w-full transition-colors duration-200 ${
        currentTheme === 'high-contrast'
          ? 'bg-black text-white border-b-2 border-yellow-400'
          : currentTheme === 'dark'
          ? 'bg-slate-900 text-slate-100 border-b border-slate-800'
          : 'bg-[#DAF0F7] text-[#1A1110] border-b border-[#B2E2F0]'
      }`}
    >
      <div className="max-w-7xl mx-auto flex flex-col justify-center min-w-0">
        
        {/* DISPLAY AND ACCESSIBILITY SETTINGS ROW */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold min-w-0 w-full">
          
          {/* Title Label */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Sparkles className="w-4 h-4 text-[#FF5A1F] shrink-0" />
            <span className="font-black tracking-wider uppercase text-xs sm:text-sm leading-tight">
              {t('nav.accessibility')}:
            </span>
          </div>

          {/* 🌐 1. LANGUAGE SELECTION OPTIONS */}
          <div className="flex flex-wrap items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-[#B2E2F0] dark:border-slate-700 shadow-sm">
            <Globe className="w-4 h-4 text-[#FF5A1F] ml-1 shrink-0" />
            <span className="text-xs font-extrabold mr-1 leading-tight">Lang:</span>
            
            <button
              type="button"
              onClick={() => handleLanguageSelect('en')}
              className={`px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center ${
                language === 'en'
                  ? 'bg-[#FF5A1F] text-white shadow-md'
                  : 'text-[#4A5568] dark:text-slate-200 hover:text-[#1A1110] hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title="Switch to English"
            >
              🇬🇧 English
            </button>

            <button
              type="button"
              onClick={() => handleLanguageSelect('ta')}
              className={`px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center ${
                language === 'ta'
                  ? 'bg-[#FF5A1F] text-white shadow-md'
                  : 'text-[#4A5568] dark:text-slate-200 hover:text-[#1A1110] hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title="Switch to Tamil (தமிழ்)"
            >
              🇮🇳 தமிழ்
            </button>

            <button
              type="button"
              onClick={() => handleLanguageSelect('hi')}
              className={`px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center ${
                language === 'hi'
                  ? 'bg-[#FF5A1F] text-white shadow-md'
                  : 'text-[#4A5568] dark:text-slate-200 hover:text-[#1A1110] hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title="Switch to Hindi (हिन्दी)"
            >
              🇮🇳 हिन्दी
            </button>

            <button
              type="button"
              onClick={() => setIsLanguageModalOpen(true)}
              className="px-2.5 py-1.5 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center"
              title="Open Language Selector Dialog"
            >
              Dialog 💬
            </button>
          </div>

          {/* 🎨 2. THEME SELECTION OPTIONS */}
          <div className="flex flex-wrap items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-[#B2E2F0] dark:border-slate-700 shadow-sm">
            <span className="text-xs font-extrabold ml-1 leading-tight">Theme:</span>

            <button
              type="button"
              onClick={() => handleThemeChange('light')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer ${
                currentTheme === 'light'
                  ? 'bg-[#FF5A1F] text-white shadow-md'
                  : 'text-[#4A5568] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title="Light Mode Theme"
            >
              <Sun className="w-3.5 h-3.5 shrink-0" />
              <span>Light</span>
            </button>

            <button
              type="button"
              onClick={() => handleThemeChange('dark')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer ${
                currentTheme === 'dark'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-[#4A5568] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title="Dark Mode Theme"
            >
              <Moon className="w-3.5 h-3.5 shrink-0" />
              <span>Dark</span>
            </button>

            <button
              type="button"
              onClick={() => handleThemeChange('high-contrast')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer ${
                currentTheme === 'high-contrast'
                  ? 'bg-yellow-400 text-black shadow-md border border-black'
                  : 'text-[#4A5568] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title="High Contrast Accessibility Theme"
            >
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span>High Contrast</span>
            </button>
          </div>

          {/* 🔤 3. TEXT SIZE SCALE */}
          <div className="flex flex-wrap items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-[#B2E2F0] dark:border-slate-700 shadow-sm">
            <Type className="w-4 h-4 text-[#FF5A1F] ml-1 shrink-0" />
            <span className="text-xs font-extrabold leading-tight">Size:</span>
            {(['sm', 'md', 'lg', 'xl'] as const).map(size => (
              <button
                key={size}
                type="button"
                onClick={() => handleTextSizeChange(size)}
                className={`min-w-[32px] px-2 py-1.5 rounded-lg uppercase font-black transition-all text-xs sm:text-sm flex items-center justify-center cursor-pointer ${
                  accessibilitySettings.textSize === size
                    ? 'bg-[#FF5A1F] text-white shadow-md'
                    : 'text-[#4A5568] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
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
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-black text-xs sm:text-sm transition-all border cursor-pointer ${
              autoVoicePromptEnabled
                ? 'bg-[#16A34A] text-white border-[#16A34A] shadow-md'
                : 'bg-white dark:bg-slate-800 text-[#4A5568] dark:text-slate-200 border-[#B2E2F0] dark:border-slate-700 hover:bg-slate-100'
            }`}
            title="Toggle Automatic Voice Prompt on Search"
          >
            {autoVoicePromptEnabled ? <Volume2 className="w-4 h-4 text-yellow-200 animate-pulse shrink-0" /> : <VolumeX className="w-4 h-4 shrink-0" />}
            <span className="leading-tight">Auto Voice: {autoVoicePromptEnabled ? 'ON' : 'OFF'}</span>
          </button>

        </div>

      </div>
    </div>
  );
};
