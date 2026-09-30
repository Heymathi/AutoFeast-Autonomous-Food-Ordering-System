import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Language } from '../types';
import { Volume2, VolumeX, Sparkles, Type, Globe, Sun, Moon, Eye, Sliders, X, ChevronDown } from 'lucide-react';

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

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSettingsOpen) {
        setIsSettingsOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen]);

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
      ref={toolbarRef}
      className={`py-2 px-2 sm:px-4 shadow-xs w-full transition-colors duration-200 [container-type:inline-size] @container ${
        currentTheme === 'high-contrast'
          ? 'bg-black text-white border-b-2 border-yellow-400'
          : currentTheme === 'dark'
          ? 'bg-slate-900 text-slate-100 border-b border-slate-800'
          : 'bg-[#DAF0F7] text-[#1A1110] border-b border-[#B2E2F0]'
      }`}
    >
      <div className="max-w-7xl mx-auto flex flex-col justify-center min-w-0">
        
        {/* DESKTOP & TABLET ACCESSIBILITY BAR (WIDE CONTAINER / ≥ 768px) */}
        <div className="hidden md:flex flex-wrap items-center justify-between gap-[clamp(0.35rem,0.8vw,0.75rem)] text-[clamp(0.7rem,1.1vw,0.8rem)] font-bold min-w-0">
          
          {/* Title Label */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Sparkles className="w-4 h-4 text-[#FF5A1F] shrink-0" />
            <span className="font-black tracking-wider uppercase text-[clamp(0.7rem,1.1vw,0.8rem)] leading-tight">
              {t('nav.accessibility')}:
            </span>
          </div>

          {/* 🌐 1. LANGUAGE SELECTION OPTIONS */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-[#B2E2F0] dark:border-slate-700 shadow-sm shrink-0">
            <Globe className="w-4 h-4 text-[#FF5A1F] ml-1 shrink-0" />
            <span className="text-[clamp(0.65rem,1vw,0.75rem)] font-extrabold mr-1 leading-tight">Lang:</span>
            
            <button
              type="button"
              onClick={() => handleLanguageSelect('en')}
              className={`min-h-[44px] px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center ${
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
              className={`min-h-[44px] px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center ${
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
              className={`min-h-[44px] px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center ${
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
              className="min-h-[44px] px-2.5 py-1 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center"
              title="Open Language Selector Dialog"
            >
              Dialog 💬
            </button>
          </div>

          {/* 🎨 2. THEME SELECTION OPTIONS */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-[#B2E2F0] dark:border-slate-700 shadow-sm shrink-0">
            <span className="text-[clamp(0.65rem,1vw,0.75rem)] font-extrabold ml-1 leading-tight">Theme:</span>

            <button
              type="button"
              onClick={() => handleThemeChange('light')}
              className={`min-h-[44px] flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
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
              className={`min-h-[44px] flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
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
              className={`min-h-[44px] flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
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
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-[#B2E2F0] dark:border-slate-700 shadow-sm shrink-0">
            <Type className="w-4 h-4 text-[#FF5A1F] ml-1 shrink-0" />
            <span className="text-[clamp(0.65rem,1vw,0.75rem)] font-extrabold leading-tight">Size:</span>
            {(['sm', 'md', 'lg', 'xl'] as const).map(size => (
              <button
                key={size}
                type="button"
                onClick={() => handleTextSizeChange(size)}
                className={`min-h-[44px] min-w-[36px] px-2 py-1 rounded-lg uppercase font-black transition-all text-xs flex items-center justify-center cursor-pointer ${
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
            className={`min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition-all border cursor-pointer shrink-0 ${
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

        {/* MOBILE COMPACT BAR & COLLAPSED "SETTINGS" DROPDOWN (< 768px) */}
        <div className="flex md:hidden items-center justify-between gap-2 min-w-0">
          
          {/* Quick Language Pills (Always Visible & Accessible on Mobile) */}
          <div className="flex items-center gap-1 overflow-x-auto py-1 no-scrollbar min-w-0">
            <Globe className="w-4 h-4 text-[#FF5A1F] shrink-0" />
            
            <button
              type="button"
              onClick={() => handleLanguageSelect('en')}
              className={`min-h-[44px] px-2.5 py-1 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                language === 'en'
                  ? 'bg-[#FF5A1F] text-white shadow-md'
                  : 'bg-white dark:bg-slate-800 text-[#4A5568] dark:text-slate-200 border border-slate-300 dark:border-slate-700'
              }`}
            >
              🇬🇧 EN
            </button>

            <button
              type="button"
              onClick={() => handleLanguageSelect('ta')}
              className={`min-h-[44px] px-2.5 py-1 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                language === 'ta'
                  ? 'bg-[#FF5A1F] text-white shadow-md'
                  : 'bg-white dark:bg-slate-800 text-[#4A5568] dark:text-slate-200 border border-slate-300 dark:border-slate-700'
              }`}
            >
              🇮🇳 தமிழ்
            </button>

            <button
              type="button"
              onClick={() => handleLanguageSelect('hi')}
              className={`min-h-[44px] px-2.5 py-1 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                language === 'hi'
                  ? 'bg-[#FF5A1F] text-white shadow-md'
                  : 'bg-white dark:bg-slate-800 text-[#4A5568] dark:text-slate-200 border border-slate-300 dark:border-slate-700'
              }`}
            >
              🇮🇳 हिन्दी
            </button>
          </div>

          {/* Unified "Settings" Toggle Button (Min 44px Touch Target) */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="min-h-[44px] px-3 py-2 bg-white dark:bg-slate-800 text-[#1A1110] dark:text-white border border-[#B2E2F0] dark:border-slate-700 rounded-xl shadow-xs flex items-center gap-1.5 font-black text-xs shrink-0 cursor-pointer"
            aria-expanded={isSettingsOpen}
            aria-label={t('nav.settings')}
            title={t('nav.settings')}
          >
            {isSettingsOpen ? (
              <>
                <X className="w-4 h-4 text-[#C2185B] shrink-0" />
                <span className="leading-tight">{t('nav.close')}</span>
              </>
            ) : (
              <>
                <Sliders className="w-4 h-4 text-[#FF5A1F] shrink-0" />
                <span className="leading-tight">{t('nav.settings')}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70 shrink-0" />
              </>
            )}
          </button>

        </div>

        {/* MOBILE SETTINGS DROPDOWN PANEL / BOTTOM SHEET (< 768px) */}
        {isSettingsOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-[#B2E2F0] dark:border-slate-700 space-y-4 bg-white/95 dark:bg-slate-900/95 p-4 rounded-2xl shadow-2xl animate-fadeIn flex flex-col">
            
            {/* Header Title */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-black uppercase tracking-wider text-[#FF5A1F] flex items-center gap-1.5">
                <Sliders className="w-4 h-4" />
                {t('nav.settings')}
              </span>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-300"
                aria-label={t('nav.close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 🌐 1. Full Language Buttons */}
            <div className="space-y-1.5">
              <span className="text-xs font-extrabold text-[#4A5568] dark:text-slate-400 block">Language:</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => { handleLanguageSelect('en'); setIsSettingsOpen(false); }}
                  className={`min-h-[44px] p-2 rounded-xl text-xs font-black transition-all border ${
                    language === 'en' ? 'bg-[#FF5A1F] text-white border-[#FF5A1F]' : 'bg-slate-50 dark:bg-slate-800 text-[#1A1110] dark:text-white border-slate-200 dark:border-slate-700'
                  }`}
                >
                  🇬🇧 English
                </button>
                <button
                  type="button"
                  onClick={() => { handleLanguageSelect('ta'); setIsSettingsOpen(false); }}
                  className={`min-h-[44px] p-2 rounded-xl text-xs font-black transition-all border ${
                    language === 'ta' ? 'bg-[#FF5A1F] text-white border-[#FF5A1F]' : 'bg-slate-50 dark:bg-slate-800 text-[#1A1110] dark:text-white border-slate-200 dark:border-slate-700'
                  }`}
                >
                  🇮🇳 தமிழ்
                </button>
                <button
                  type="button"
                  onClick={() => { handleLanguageSelect('hi'); setIsSettingsOpen(false); }}
                  className={`min-h-[44px] p-2 rounded-xl text-xs font-black transition-all border ${
                    language === 'hi' ? 'bg-[#FF5A1F] text-white border-[#FF5A1F]' : 'bg-slate-50 dark:bg-slate-800 text-[#1A1110] dark:text-white border-slate-200 dark:border-slate-700'
                  }`}
                >
                  🇮🇳 हिन्दी
                </button>
              </div>
            </div>

            {/* 🎨 2. Theme Selection */}
            <div className="space-y-1.5">
              <span className="text-xs font-extrabold text-[#4A5568] dark:text-slate-400 block">Theme Mode:</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`min-h-[44px] p-2 rounded-xl text-xs font-black flex items-center justify-center gap-1 border ${
                    currentTheme === 'light' ? 'bg-[#FF5A1F] text-white border-[#FF5A1F]' : 'bg-slate-50 dark:bg-slate-800 text-[#1A1110] dark:text-white border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Sun className="w-4 h-4" />
                  <span>Light</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`min-h-[44px] p-2 rounded-xl text-xs font-black flex items-center justify-center gap-1 border ${
                    currentTheme === 'dark' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 dark:bg-slate-800 text-[#1A1110] dark:text-white border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Moon className="w-4 h-4" />
                  <span>Dark</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleThemeChange('high-contrast')}
                  className={`min-h-[44px] p-2 rounded-xl text-xs font-black flex items-center justify-center gap-1 border ${
                    currentTheme === 'high-contrast' ? 'bg-yellow-400 text-black border-black' : 'bg-slate-50 dark:bg-slate-800 text-[#1A1110] dark:text-white border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  <span>High Contrast</span>
                </button>
              </div>
            </div>

            {/* 🔤 3. Text Size Scale */}
            <div className="space-y-1.5">
              <span className="text-xs font-extrabold text-[#4A5568] dark:text-slate-400 block">Text Size Scale:</span>
              <div className="grid grid-cols-4 gap-2">
                {(['sm', 'md', 'lg', 'xl'] as const).map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => handleTextSizeChange(size)}
                    className={`min-h-[44px] p-2 rounded-xl text-xs font-black uppercase flex items-center justify-center border ${
                      accessibilitySettings.textSize === size
                        ? 'bg-[#FF5A1F] text-white border-[#FF5A1F]'
                        : 'bg-slate-50 dark:bg-slate-800 text-[#1A1110] dark:text-white border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* 🗣️ 4. Auto Voice Toggle */}
            <div className="space-y-1.5">
              <span className="text-xs font-extrabold text-[#4A5568] dark:text-slate-400 block">Search Auto Voice:</span>
              <button
                type="button"
                onClick={handleAutoVoiceToggle}
                className={`w-full min-h-[44px] p-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 border cursor-pointer ${
                  autoVoicePromptEnabled
                    ? 'bg-[#16A34A] text-white border-[#16A34A]'
                    : 'bg-slate-50 dark:bg-slate-800 text-[#4A5568] dark:text-slate-200 border-slate-200 dark:border-slate-700'
                }`}
              >
                {autoVoicePromptEnabled ? <Volume2 className="w-4 h-4 text-yellow-200 animate-pulse" /> : <VolumeX className="w-4 h-4" />}
                <span>Auto Voice Prompt: {autoVoicePromptEnabled ? 'ENABLED (ON)' : 'DISABLED (OFF)'}</span>
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
