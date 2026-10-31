import React from 'react';
import { useApp } from '../context/AppContext';
import {
  UserCheck,
  Mic,
  ShieldCheck,
  Users,
  Lock,
  Bike,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export const HowItWorksPage: React.FC = () => {
  const { setActiveView } = useApp();

  const steps = [
    {
      number: '1',
      title: 'Set Up Your Profile',
      desc: 'Add your dietary restrictions, linked bank, and optional nominee for complete peace of mind.',
      icon: UserCheck
    },
    {
      number: '2',
      title: 'Browse or Speak Your Order',
      desc: 'Search hundreds of local dishes or speak naturally in Tamil, English, or Hindi hands-free.',
      icon: Mic
    },
    {
      number: '3',
      title: 'Smart Checks & Limits',
      desc: 'AutoFeast AI compares Swiggy and Zomato prices while checking your daily spending limits.',
      icon: ShieldCheck
    },
    {
      number: '4',
      title: 'Nominee Review (If Enabled)',
      desc: 'Orders exceeding limits or flagged for health are instantly sent to your trusted nominee.',
      icon: Users
    },
    {
      number: '5',
      title: 'Confirm with PIN',
      desc: 'Enter your 4-digit security PIN or Face ID to confirm and authorize the transaction.',
      icon: Lock
    },
    {
      number: '6',
      title: 'Track to Your Door',
      desc: 'Watch your delivery rider in real time with OpenStreetMap GPS and spoken delivery alerts.',
      icon: Bike
    }
  ];

  const handleStartSearching = () => {
    setActiveView('home');
    setTimeout(() => {
      const el = document.getElementById('dynamic-food-search-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const input = el.querySelector('input');
        if (input) input.focus();
      }
    }, 100);
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-8 sm:py-12 px-4 sm:px-6 space-y-12 sm:space-y-16 animate-fade-in pb-16">
      {/* Header matching PDF Page 4 */}
      <div className="text-center space-y-3 max-w-3xl mx-auto">
        <h1 className="font-serif-editorial text-3xl sm:text-5xl font-bold text-[#33251F] tracking-tight leading-tight">
          From craving to{' '}
          <span className="text-[#D93636]">doorstep in six steps</span>
        </h1>
        <p className="text-sm sm:text-base text-[#8A817A] leading-relaxed">
          Experience seamless, AI-guided food ordering designed for everyone.
        </p>
      </div>

      {/* 6 Step Cards Grid matching PDF Page 4 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.number}
              className="bg-white rounded-2xl p-6 sm:p-7 border border-[#F0E5DC] shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  {/* Peach Square with Red Icon */}
                  <div className="w-12 h-12 rounded-xl bg-[#FBE9E5] text-[#D93636] flex items-center justify-center">
                    <Icon className="w-6 h-6 text-[#D93636]" />
                  </div>

                  {/* Red Numbered Circular Badge */}
                  <div className="w-8 h-8 rounded-full bg-[#D93636] text-white font-bold text-sm flex items-center justify-center shadow-xs">
                    {step.number}
                  </div>
                </div>

                <h3 className="font-bold text-lg text-[#33251F] group-hover:text-[#D93636] transition-colors">
                  {step.title}
                </h3>

                <p className="text-xs sm:text-sm text-[#8A817A] leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Call to Action Box matching PDF Page 4 */}
      <div className="rounded-3xl border border-[#F0E5DC] bg-white p-8 sm:p-12 text-center shadow-xs space-y-5">
        <h2 className="font-serif-editorial text-2xl sm:text-4xl font-bold text-[#33251F]">
          Ready to find your next meal?
        </h2>
        <p className="text-sm text-[#8A817A] max-w-lg mx-auto">
          Explore local favorites or use voice to order in seconds.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={handleStartSearching}
            className="px-8 py-3.5 rounded-full bg-[#D93636] hover:bg-[#C02B2B] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all hover:scale-105 active:scale-95 inline-flex items-center gap-2 cursor-pointer"
          >
            <span>Start searching</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
