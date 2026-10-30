import React, { useState, useEffect } from 'react';
import { SpeechController, SpeechState, MicLanguageMode } from '../services/speechController';
import { Volume2, Mic, Activity, ChevronUp, ChevronDown, Radio, ShieldCheck } from 'lucide-react';

export const SpeechDebugPanel: React.FC<{ activeLanguage: string }> = ({ activeLanguage }) => {
  const isDev = (import.meta as any).env?.DEV ?? process.env.NODE_ENV !== 'production';
  if (!isDev) return null;

  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<SpeechState>(SpeechController.getState());
  const [owner, setOwner] = useState<string | null>(SpeechController.getOwner());
  const [micMode, setMicMode] = useState<MicLanguageMode>(SpeechController.getMicMode());
  const [logs, setLogs] = useState(SpeechController.getDebugLogs());
  const [voices, setVoices] = useState(SpeechController.getSystemVoicesInfo());

  useEffect(() => {
    const unsubscribe = SpeechController.subscribe(() => {
      setState(SpeechController.getState());
      setOwner(SpeechController.getOwner());
      setMicMode(SpeechController.getMicMode());
      setLogs([...SpeechController.getDebugLogs()]);
      setVoices([...SpeechController.getSystemVoicesInfo()]);
    });
    return () => unsubscribe();
  }, []);

  const getStateColor = (s: SpeechState) => {
    switch (s) {
      case 'listening': return 'bg-emerald-500 text-white';
      case 'speaking': return 'bg-amber-500 text-white';
      case 'processing': return 'bg-blue-500 text-white';
      case 'error': return 'bg-rose-600 text-white';
      default: return 'bg-slate-700 text-slate-200';
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 font-mono text-xs">
      {/* Small Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1A1110] text-yellow-300 border border-yellow-500/40 shadow-xl hover:bg-slate-900 transition-all cursor-pointer"
      >
        <Activity className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
        <span className="font-bold uppercase tracking-wider text-[10px]">Speech Engine</span>
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${getStateColor(state)}`}>
          {state}
        </span>
        {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>

      {/* Expanded Debug Dashboard Panel */}
      {isOpen && (
        <div className="mt-2 w-80 sm:w-96 p-4 rounded-2xl bg-[#1A1110] text-slate-100 border-2 border-yellow-500/50 shadow-2xl space-y-3 animate-fade-in max-h-[80vh] overflow-y-auto">
          
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-black text-yellow-400 text-xs flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-emerald-400" />
              SpeechController Singleton
            </span>
            <span className="text-[10px] text-slate-400 font-bold">
              Owner: <span className="text-white">{owner || 'none'}</span>
            </span>
          </div>

          {/* Mic Language Selector Chip */}
          <div className="space-y-1">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
              <span>Mic Mode Selector</span>
              <span className="text-yellow-300">App Lang: {activeLanguage}</span>
            </div>
            <div className="grid grid-cols-4 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              {(['auto', 'en', 'ta', 'hi'] as MicLanguageMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => SpeechController.setMicMode(mode)}
                  className={`py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                    micMode === mode
                      ? 'bg-yellow-400 text-black shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* System Voices Inventory List */}
          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 space-y-1 text-[10px]">
            <div className="text-slate-400 font-bold flex items-center justify-between border-b border-slate-800 pb-1">
              <span>System Synthesis Voices (REAL):</span>
              <span className="text-emerald-400 font-black">{voices.length} Found</span>
            </div>
            <div className="max-h-28 overflow-y-auto space-y-1 pt-1 text-[9px]">
              {voices.length === 0 ? (
                <div className="text-slate-500 italic">Waiting for voiceschanged event...</div>
              ) : (
                voices.map((v, i) => (
                  <div key={i} className="flex justify-between items-center text-slate-300 border-b border-slate-800/40 pb-0.5">
                    <span className="font-bold text-yellow-200 truncate max-w-[170px]">{v.name}</span>
                    <span className="text-slate-400">{v.lang}</span>
                    <span className={`text-[8px] px-1 rounded ${v.localService ? 'bg-blue-900/60 text-blue-300' : 'bg-purple-900/60 text-purple-300'}`}>
                      {v.localService ? 'Local' : 'Cloud'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Event Stream Log Ring Buffer */}
          <div className="space-y-1">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              Event Stream (PIN Data Redacted)
            </div>
            <div className="bg-black/80 p-2 rounded-xl border border-slate-800 space-y-1 max-h-40 overflow-y-auto text-[9px] font-mono">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic text-center py-2">No events logged yet.</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="flex gap-2 text-slate-300 hover:bg-slate-900/50 p-0.5 rounded">
                    <span className="text-slate-500">{log.timestamp}</span>
                    <span className="font-bold text-yellow-400">{log.type}:</span>
                    <span className="truncate text-slate-200">{log.detail}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
