import React from 'react';
import { useApp } from '../context/AppContext';
import { Language } from '../types';
import { Volume2, VolumeX, Sparkles, Layers, Type, Globe, Sun, Moon, Eye } from 'lucide-react';

export const AccessibilityToolbar: React.FC = () => {
  const {
    accessibilitySettings,
    setAccessibilitySettings,
    autoVoicePromptEnabled,
    setAutoVoicePromptEnabled,
    language,
    setLanguage,
    setIsLanguageModalOpen,
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
    <div className="bg-[#DAF0F7] text-[#1A1110] border-b border-[#B2E2F0] py-2 px-3 shadow-xs w-full">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
        
        {/* Title Label */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <Sparkles className="w-4 h-4 text-[#FF5A1F]" />
          <span className="font-black tracking-wider uppercase text-[#1A1110] text-[12px]">
            Display & Accessibility Settings:
          </span>
        </div>

        {/* 🌐 1. LANGUAGE CHANGING OPTIONS (ALWAYS VISIBLE & UNHIDDEN) */}
        <div className="flex items-center space-x-1.5 bg-white p-1 rounded-xl border border-[#B2E2F0] shadow-sm shrink-0">
          <Globe className="w-4 h-4 text-[#FF5A1F] ml-1 shrink-0" />
          <span className="text-[11px] font-extrabold text-[#1A1110] mr-1">Language:</span>
          
          <button
            type="button"
            onClick={() => handleLanguageSelect('en')}
            className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
              language === 'en'
                ? 'bg-[#FF5A1F] text-white shadow-md'
                : 'text-[#4A5568] hover:text-[#1A1110] hover:bg-slate-100'
            }`}
            title="Switch to English"
          >
            🇬🇧 English
          </button>

          <button
            type="button"
            onClick={() => handleLanguageSelect('ta')}
            className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
              language === 'ta'
                ? 'bg-[#FF5A1F] text-white shadow-md'
                : 'text-[#4A5568] hover:text-[#1A1110] hover:bg-slate-100'
            }`}
            title="Switch to Tamil (தமிழ்)"
          >
            🇮🇳 தமிழ்
          </button>

          <button
            type="button"
            onClick={() => handleLanguageSelect('hi')}
            className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
              language === 'hi'
                ? 'bg-[#FF5A1F] text-white shadow-md'
                : 'text-[#4A5568] hover:text-[#1A1110] hover:bg-slate-100'
            }`}
            title="Switch to Hindi (हिन्दी)"
          >
            🇮🇳 हिन्दी
          </button>

          <button
            type="button"
            onClick={() => setIsLanguageModalOpen(true)}
            className="px-2 py-1 bg-amber-100 text-amber-900 hover:bg-amber-200 rounded-lg text-[11px] font-black transition-all cursor-pointer ml-1"
            title="Open Language Selector Dialog"
          >
            Dialog 💬
          </button>
        </div>

        {/* 🎨 2. THEME CHANGING OPTIONS (ALWAYS VISIBLE & UNHIDDEN: LIGHT, DARK, HIGH CONTRAST) */}
        <div className="flex items-center space-x-1.5 bg-white p-1 rounded-xl border border-[#B2E2F0] shadow-sm shrink-0">
          <span className="text-[11px] font-extrabold text-[#1A1110] ml-1">Theme:</span>

          <button
            type="button"
            onClick={() => handleThemeChange('light')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
              currentTheme === 'light'
                ? 'bg-[#FF5A1F] text-white shadow-md'
                : 'text-[#4A5568] hover:text-[#1A1110] hover:bg-slate-100'
            }`}
            title="Light Mode Theme"
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Light</span>
          </button>

          <button
            type="button"
            onClick={() => handleThemeChange('dark')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
              currentTheme === 'dark'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-[#4A5568] hover:text-[#1A1110] hover:bg-slate-100'
            }`}
            title="Dark Mode Theme"
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Dark</span>
          </button>

          <button
            type="button"
            onClick={() => handleThemeChange('high-contrast')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
              currentTheme === 'high-contrast'
                ? 'bg-yellow-400 text-black shadow-md border border-black'
                : 'text-[#4A5568] hover:text-[#1A1110] hover:bg-slate-100'
            }`}
            title="High Contrast Accessibility Theme"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>High Contrast</span>
          </button>
        </div>

        {/* 🔤 3. TEXT SIZE SCALE OPTIONS */}
        <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-[#B2E2F0] shadow-sm shrink-0">
          <Type className="w-4 h-4 text-[#FF5A1F] ml-1 shrink-0" />
          <span className="text-[11px] font-extrabold text-[#1A1110]">Text Size:</span>
          {(['sm', 'md', 'lg', 'xl'] as const).map(size => (
            <button
              key={size}
              type="button"
              onClick={() => handleTextSizeChange(size)}
              className={`px-2 py-1 rounded-lg uppercase font-black transition-all text-xs cursor-pointer ${
                accessibilitySettings.textSize === size
                  ? 'bg-[#FF5A1F] text-white shadow-md'
                  : 'text-[#4A5568] hover:text-[#1A1110] hover:bg-slate-100'
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
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition-all border cursor-pointer shrink-0 ${
            autoVoicePromptEnabled
              ? 'bg-[#16A34A] text-white border-[#16A34A] shadow-md'
              : 'bg-white text-[#4A5568] border-[#B2E2F0] hover:text-[#1A1110]'
          }`}
          title="Toggle Automatic Voice Prompt on Search"
        >
          {autoVoicePromptEnabled ? <Volume2 className="w-4 h-4 text-yellow-200 animate-pulse" /> : <VolumeX className="w-4 h-4" />}
          <span>Auto Voice: {autoVoicePromptEnabled ? 'ON' : 'OFF'}</span>
        </button>

      </div>
    </div>
  );
};
