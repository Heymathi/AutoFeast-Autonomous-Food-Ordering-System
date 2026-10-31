import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Sparkles,
  Target,
  Shield,
  Heart,
  Globe2,
  Cpu,
  Layers,
  ArrowRight,
  Utensils
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  const { setActiveView, t, accessibilitySettings } = useApp();

  const currentTheme =
    accessibilitySettings.themeMode ||
    (accessibilitySettings.highContrast ? 'high-contrast' : 'light');

  const capabilities = [
    {
      icon: Cpu,
      title: 'Multi-Model Voice Intelligence',
      desc: 'Seamless voice ordering powered by Web Speech API with automatic failover to local offline Whisper AI inference for Tamil, Hindi, and English.'
    },
    {
      icon: Layers,
      title: 'Multi-Platform Price Optimization',
      desc: 'Simultaneous price checking across leading delivery networks (Swiggy, Zomato, EatSure) to ensure users always receive the most economical option.'
    },
    {
      icon: Shield,
      title: 'Nominee Protection & Dietary Safety',
      desc: 'Integrated guardian oversight preventing vulnerable users, seniors, and patients from accidentally ordering non-permitted allergenic dishes.'
    },
    {
      icon: Heart,
      title: 'Accessibility by Design',
      desc: 'High contrast styling, dynamic 4-tier font sizing, auto-voice narration, and full keyboard navigation meeting modern web accessibility standards.'
    }
  ];

  return (
    <div className="w-full max-w-5xl mx-auto py-8 sm:py-12 px-4 sm:px-6 space-y-12 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FBE9E5] text-[#D93636] text-xs font-bold tracking-wide">
          <Sparkles className="w-3.5 h-3.5" />
          <span>About The Platform</span>
        </div>
        <h1 className="font-serif-editorial text-3xl sm:text-5xl font-bold text-[#33251F] tracking-tight">
          {t('about.title') || 'About AutoFeast AI'}
        </h1>
        <p className="text-sm sm:text-base text-[#8A817A] leading-relaxed">
          {t('about.subtitle') || 'Autonomous Food Ordering & Smart Scheduling Platform'}
        </p>
      </div>

      {/* Mission & Purpose Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        <div className={`p-6 sm:p-8 rounded-2xl border shadow-xs space-y-4 ${
          currentTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-[#F0E5DC]'
        }`}>
          <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center font-bold">
            <Target className="w-6 h-6" />
          </div>
          <h2 className="font-serif-editorial text-xl sm:text-2xl font-bold text-[#33251F]">Our Mission</h2>
          <p className="text-xs sm:text-sm text-[#8A817A] leading-relaxed">
            AutoFeast AI was created to make food discovery and ordering radically accessible, autonomous, and transparent. We bridge language barriers through native speech recognition in English, தமிழ் (Tamil), and हिन्दी (Hindi), enabling every individual to order their favorite meals effortlessly.
          </p>
        </div>

        <div className={`p-6 sm:p-8 rounded-2xl border shadow-xs space-y-4 ${
          currentTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-[#F0E5DC]'
        }`}>
          <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center font-bold">
            <Utensils className="w-6 h-6" />
          </div>
          <h2 className="font-serif-editorial text-xl sm:text-2xl font-bold text-[#33251F]">Project Purpose</h2>
          <p className="text-xs sm:text-sm text-[#8A817A] leading-relaxed">
            Many traditional delivery applications are complex, text-heavy, and difficult for elderly family members to navigate independently. AutoFeast AI introduces nominee protection, automated weekly meal scheduling, and natural speech-driven ordering so anyone can arrange meals safely with full guardian visibility.
          </p>
        </div>
      </div>

      {/* AI Food Discovery Concept */}
      <div className={`p-6 sm:p-8 rounded-2xl border ${
        currentTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-[#FBE9E5] border-[#F0E5DC]'
      } space-y-4`}>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#FBE9E5] text-[#D93636] text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Core Concept</span>
        </div>
        <h2 className="font-serif-editorial text-xl sm:text-2xl font-bold text-[#33251F]">
          AI-Powered Food Discovery & Semantics
        </h2>
        <p className="text-xs sm:text-sm text-[#8A817A] leading-relaxed">
          When users search for dishes like &quot;dosa&quot;, &quot;தோசை&quot;, &quot;इडली&quot;, or &quot;biryani&quot;, AutoFeast AI leverages an intelligent tri-layer query pipeline:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-white border border-[#F0E5DC] space-y-2">
            <span className="text-xs font-black text-[#D93636]">Layer 1</span>
            <h4 className="text-sm font-bold text-[#33251F]">Phonetic & Cross-Script Match</h4>
            <p className="text-xs text-[#8A817A]">Matches spoken Tamil and Hindi sounds to catalog dishes accurately.</p>
          </div>
          <div className="p-4 rounded-xl bg-white border border-[#F0E5DC] space-y-2">
            <span className="text-xs font-black text-[#D93636]">Layer 2</span>
            <h4 className="text-sm font-bold text-[#33251F]">Gemini AI Semantic NLU</h4>
            <p className="text-xs text-[#8A817A]">Extracts dietary intent, quantities, and restaurant preferences when online.</p>
          </div>
          <div className="p-4 rounded-xl bg-white border border-[#F0E5DC] space-y-2">
            <span className="text-xs font-black text-[#D93636]">Layer 3</span>
            <h4 className="text-sm font-bold text-[#33251F]">Local Whisper Offline Engine</h4>
            <p className="text-xs text-[#8A817A]">Processes speech locally inside the browser even when internet disconnects.</p>
          </div>
        </div>
      </div>

      {/* Main Capabilities */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-[#33251F] text-center">
          Key Platform Capabilities
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {capabilities.map((cap) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.title}
                className={`p-6 rounded-2xl border shadow-xs flex items-start space-x-4 ${
                  currentTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-[#F0E5DC]'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#33251F] mb-1">{cap.title}</h3>
                  <p className="text-xs sm:text-sm text-[#8A817A] leading-relaxed">{cap.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA Box */}
      <div className="text-center p-8 rounded-2xl bg-gradient-to-r from-[#D93636] to-[#33251F] text-white space-y-4 shadow-xl">
        <h2 className="text-2xl sm:text-3xl font-black">Ready to explore intelligent food ordering?</h2>
        <p className="text-xs sm:text-sm text-rose-100 max-w-xl mx-auto leading-relaxed">
          Experience real-time price comparisons, hands-free voice search, and seamless autonomous scheduling.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setActiveView('home')}
            className="px-6 py-3 rounded-lg bg-white text-[#33251F] font-bold text-xs sm:text-sm shadow-md hover:bg-[#FBE9E5] transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <span>Start Exploring Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

