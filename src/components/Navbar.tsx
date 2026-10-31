import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  forwardGeocode,
  fetchLiveGPSLocation,
  GeocodedPlace,
  lastForwardGeocodeError
} from '../services/locationService';
import { SpeechController } from '../services/speechController';
import { CrossScriptPhoneticMatcher } from '../services/crossScriptPhoneticMatcher';
import { checkOrdinalMatch } from '../services/guidedMatchingService';
import { SttMatcherService } from '../services/sttMatcherService';
import { UserLocation } from '../types';
import {
  Search,
  Calendar,
  History,
  Eye,
  LogOut,
  Sparkles,
  ShieldCheck,
  PackageCheck,
  Bike,
  Scan,
  Navigation,
  Edit3,
  AlertTriangle,
  Mic,
  LogIn,
  Sun,
  Moon,
  HeartPulse,
  Lock,
  ShoppingBag,
  MapPin,
  Check,
  X,
  Loader2
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    walletBalance,
    isWalletRevealed,
    requestWalletBalanceReveal,
    accessibilitySettings,
    setAccessibilitySettings,
    language,
    autoVoicePromptEnabled,
    t,
    speakText,
    logout,
    currentUser,
    userLocation,
    setUserLocation,
    setManualUserLocation,
    dailyOrderCount,
    registerFaceIDOnDevice,
    activeLiveOrder,
    setIsVoiceModalOpen,
    setIsHealthModalOpen,
    setIsLimitRenewalModalOpen,
    setIsAuthGateOpen,
    setIsNomineeModalOpen,
    pendingNomineeApprovals,
    showToast,
    cart,
    setIsScheduleCartModalOpen
  } = useApp();

  // Inline Delivery Location Popover State
  const [isLocationPopoverOpen, setIsLocationPopoverOpen] = useState(false);
  const [locationInput, setLocationInput] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodedPlace[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<GeocodedPlace | null>(null);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [hasSearchedLocation, setHasSearchedLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isDetectingGps, setIsDetectingGps] = useState(false);

  const locationContainerRef = useRef<HTMLDivElement>(null);
  const locationChipRef = useRef<HTMLButtonElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getInitialAreaInput = () => {
    if (userLocation.area && userLocation.area !== 'Location not set' && userLocation.area !== 'Not set') {
      return userLocation.area;
    }
    if (userLocation.city && userLocation.city !== 'Not set' && userLocation.city !== 'Location not set') {
      return userLocation.city;
    }
    return '';
  };

  const openLocationPopover = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setLocationInput(getInitialAreaInput());
    setSuggestions([]);
    setSelectedSuggestion(null);
    setIsSearchingLocation(false);
    setHasSearchedLocation(false);
    setLocationError(null);
    setIsDetectingGps(false);
    setIsLocationPopoverOpen(true);
  };

  // Inline Delivery Location Popover Voice Assistant State
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [isVoiceSpeaking, setIsVoiceSpeaking] = useState(false);
  const [voiceStatusText, setVoiceStatusText] = useState<string | null>(null);

  const voiceTurnRef = useRef<'idle' | 'input_address' | 'pick_suggestion' | 'confirm_candidate'>('idle');
  const pendingPlacesRef = useRef<GeocodedPlace[]>([]);
  const candidateToConfirmRef = useRef<GeocodedPlace | null>(null);
  const voiceRetryCountRef = useRef(0);
  const isLocationPopoverOpenRef = useRef(isLocationPopoverOpen);
  isLocationPopoverOpenRef.current = isLocationPopoverOpen;

  const stopVoiceFlow = useCallback(() => {
    SpeechController.cancelSpeech();
    SpeechController.releaseMic('header_location_voice');
    setIsVoiceListening(false);
    setIsVoiceSpeaking(false);
    setVoiceStatusText(null);
    voiceTurnRef.current = 'idle';
  }, []);

  const closeLocationPopover = () => {
    stopVoiceFlow();
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setIsLocationPopoverOpen(false);
    setIsSearchingLocation(false);
    setLocationError(null);
    setIsDetectingGps(false);
  };

  const handleUseCurrentGPS = async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setIsDetectingGps(true);
    setLocationError(null);

    try {
      const gpsLoc = await fetchLiveGPSLocation();
      const resolvedArea =
        gpsLoc.area && gpsLoc.area !== 'Location not set' && gpsLoc.area !== 'Not set'
          ? gpsLoc.area
          : gpsLoc.city && gpsLoc.city !== 'Not set'
          ? gpsLoc.city
          : '';

      if (!resolvedArea) {
        setLocationError(t('location.gpsError'));
        setIsDetectingGps(false);
        return;
      }

      const finalLoc: UserLocation = {
        ...gpsLoc,
        area: resolvedArea,
        city: gpsLoc.city && gpsLoc.city !== 'Not set' ? gpsLoc.city : resolvedArea
      };

      setUserLocation(finalLoc);
      const confirmMsg = t('location.deliveryLocationSet').replace('{area}', resolvedArea);
      speakText(confirmMsg);
      closeLocationPopover();
    } catch (err) {
      setLocationError(t('location.gpsError'));
      setIsDetectingGps(false);
    }
  };

  const saveChosenLocation = useCallback((place: GeocodedPlace) => {
    const fallbackCity =
      userLocation.city && userLocation.city !== 'Not set' && userLocation.city !== 'Location not set'
        ? userLocation.city
        : 'Chennai';

    const area = place.area || place.city || place.addressName;
    const city = place.city || fallbackCity;
    const lat = place.latitude || userLocation.latitude || 13.0827;
    const lng = place.longitude || userLocation.longitude || 80.2707;

    const finalLoc: UserLocation = {
      latitude: lat,
      longitude: lng,
      addressName: city && area.toLowerCase() !== city.toLowerCase() ? `${area}, ${city}` : area,
      city,
      area,
      isLiveGPS: false,
      isApproximate: false,
      isManualOverride: true
    };

    setManualUserLocation(finalLoc);
    const updatedMsg = t('location.voiceUpdated').replace('{place}', area);
    speakText(updatedMsg);
    showToast(t('location.deliveryLocationSet').replace('{area}', area));
    closeLocationPopover();
  }, [userLocation, setManualUserLocation, speakText, showToast, t]);

  const listenForTurn = useCallback((turn: 'input_address' | 'pick_suggestion' | 'confirm_candidate') => {
    if (!SpeechController.isSupported()) return;
    SpeechController.cancelSpeech();
    setIsVoiceSpeaking(false);
    setIsVoiceListening(true);
    voiceTurnRef.current = turn;
    setVoiceStatusText(t('location.voiceStatusListening'));

    const isGpsCommand = (text: string) => {
      const lower = text.toLowerCase();
      const gpsWords = [
        'current location', 'use current location', 'use my current location', 'live location',
        'use live location', 'gps', 'my location',
        'ippo irukkura idam', 'en location', 'இப்போதைய இடம்', 'லைவ் இருப்பிடம்', 'லைவ் இடம்',
        'meri current location', 'abhi ki location', 'वर्तमान स्थान'
      ];
      return gpsWords.some(w => lower.includes(w));
    };

    const isCancelCommand = (text: string) => {
      const lower = text.toLowerCase();
      const cancelWords = [
        'cancel', 'close', 'stop', 'back',
        'venam', 'vendaam', 'வேண்டாம்', 'வேணாம்', 'ரத்து',
        'mat karo', 'raddh', 'रद्द', 'बंद करो'
      ];
      return cancelWords.some(w => lower.includes(w));
    };

    SpeechController.requestMic({
      owner: 'header_location_voice',
      language,
      continuous: false,
      interimResults: true,
      maxAlternatives: 5,
      silenceTimeoutMs: 7000,
      onStart: () => {
        setIsVoiceListening(true);
      },
      onResult: async (transcript, isFinal) => {
        if (!transcript || !isLocationPopoverOpenRef.current) return;
        if (!isFinal) {
          if (turn === 'input_address') {
            setLocationInput(transcript);
          }
          return;
        }

        setIsVoiceListening(false);
        SpeechController.releaseMic('header_location_voice');

        const clean = transcript.trim();
        if (isGpsCommand(clean)) {
          stopVoiceFlow();
          handleUseCurrentGPS();
          return;
        }

        if (isCancelCommand(clean)) {
          closeLocationPopover();
          return;
        }

        if (turn === 'input_address') {
          setLocationInput(clean);
          setIsSearchingLocation(true);
          setVoiceStatusText(t('location.voiceStatusSearching'));

          let results = await forwardGeocode(clean).catch(() => []);
          if (!results || results.length === 0) {
            // Retry with phonetic Latin transliteration
            const latin = CrossScriptPhoneticMatcher.toPhoneticLatin(clean);
            if (latin && latin !== clean.toLowerCase()) {
              results = await forwardGeocode(latin).catch(() => []);
            }
          }

          setIsSearchingLocation(false);

          if (!results || results.length === 0) {
            if (voiceRetryCountRef.current < 2) {
              voiceRetryCountRef.current += 1;
              const retryPrompt = t('location.voiceRepeatSlowly');
              setIsVoiceSpeaking(true);
              setVoiceStatusText(retryPrompt);
              SpeechController.speak(retryPrompt, language, () => {
                if (!isLocationPopoverOpenRef.current) return;
                setIsVoiceSpeaking(false);
                listenForTurn('input_address');
              });
            } else {
              setVoiceStatusText(t('location.noMatchFound'));
              voiceTurnRef.current = 'idle';
            }
            return;
          }

          // Results found!
          voiceRetryCountRef.current = 0;
          setSuggestions(results.slice(0, 5));
          setHasSearchedLocation(true);

          if (results.length === 1) {
            const single = results[0];
            candidateToConfirmRef.current = single;
            setSelectedSuggestion(single);
            const placeName = single.area && single.city && single.area.toLowerCase() !== single.city.toLowerCase()
              ? `${single.area}, ${single.city}`
              : single.area || single.city || single.addressName;
            setLocationInput(placeName);
            const prompt = t('location.voiceSingleResult').replace('{place}', placeName);
            setIsVoiceSpeaking(true);
            setVoiceStatusText(prompt);
            SpeechController.speak(prompt, language, () => {
              if (!isLocationPopoverOpenRef.current) return;
              setIsVoiceSpeaking(false);
              listenForTurn('confirm_candidate');
            });
          } else {
            const top3 = results.slice(0, 3);
            pendingPlacesRef.current = top3;
            const placesFormatted = top3.map((p, idx) => {
              const name = p.area && p.city && p.area.toLowerCase() !== p.city.toLowerCase()
                ? `${p.area}, ${p.city}`
                : p.area || p.city || p.addressName;
              return `${idx + 1}: ${name}`;
            }).join(', ');

            const prompt = t('location.voiceTopResults').replace('{results}', placesFormatted);
            setIsVoiceSpeaking(true);
            setVoiceStatusText(prompt);
            SpeechController.speak(prompt, language, () => {
              if (!isLocationPopoverOpenRef.current) return;
              setIsVoiceSpeaking(false);
              listenForTurn('pick_suggestion');
            });
          }
        } else if (turn === 'pick_suggestion') {
          const ordMatch = checkOrdinalMatch(clean, pendingPlacesRef.current);
          const nameMatch = pendingPlacesRef.current.find(p => {
            const lower = clean.toLowerCase();
            return (
              (p.area && lower.includes(p.area.toLowerCase())) ||
              (p.city && lower.includes(p.city.toLowerCase())) ||
              (p.addressName && lower.includes(p.addressName.toLowerCase()))
            );
          });

          const chosen = ordMatch ? ordMatch.matchedItem : nameMatch;
          if (chosen) {
            candidateToConfirmRef.current = chosen;
            setSelectedSuggestion(chosen);
            const placeName = chosen.area && chosen.city && chosen.area.toLowerCase() !== chosen.city.toLowerCase()
              ? `${chosen.area}, ${chosen.city}`
              : chosen.area || chosen.city || chosen.addressName;
            setLocationInput(placeName);
            const prompt = t('location.voiceConfirm').replace('{place}', placeName);
            setIsVoiceSpeaking(true);
            setVoiceStatusText(prompt);
            SpeechController.speak(prompt, language, () => {
              if (!isLocationPopoverOpenRef.current) return;
              setIsVoiceSpeaking(false);
              listenForTurn('confirm_candidate');
            });
          } else {
            const conf = SttMatcherService.matchConfirmation(clean);
            if (conf.matchedValue === 'YES' && pendingPlacesRef.current[0]) {
              saveChosenLocation(pendingPlacesRef.current[0]);
            } else {
              if (voiceRetryCountRef.current < 2) {
                voiceRetryCountRef.current += 1;
                const prompt = t('location.whichLocationQuestion');
                setIsVoiceSpeaking(true);
                setVoiceStatusText(prompt);
                SpeechController.speak(prompt, language, () => {
                  if (!isLocationPopoverOpenRef.current) return;
                  setIsVoiceSpeaking(false);
                  listenForTurn('pick_suggestion');
                });
              } else {
                voiceTurnRef.current = 'idle';
              }
            }
          }
        } else if (turn === 'confirm_candidate') {
          const conf = SttMatcherService.matchConfirmation(clean);
          const lower = clean.toLowerCase();
          const isYes = conf.matchedValue === 'YES' || ['yes', 'yeah', 'yep', 'ok', 'okay', 'sure', 'சரி', 'ஆமா', 'ஆமாம்', 'हाँ', 'हां', 'theek'].some(w => lower.includes(w));
          const isNo = conf.matchedValue === 'NO' || ['no', 'change', 'different', 'இல்லை', 'இல்ல', 'வேண்டாம்', 'மாத்து', 'नहीं', 'बदलो', 'दूसरा'].some(w => lower.includes(w));

          if (isYes && candidateToConfirmRef.current) {
            saveChosenLocation(candidateToConfirmRef.current);
          } else if (isNo) {
            startVoiceAddressFlow(false);
          } else {
            if (voiceRetryCountRef.current < 2) {
              voiceRetryCountRef.current += 1;
              const placeName = candidateToConfirmRef.current?.area || candidateToConfirmRef.current?.city || '';
              const prompt = t('location.voiceConfirm').replace('{place}', placeName);
              setIsVoiceSpeaking(true);
              setVoiceStatusText(prompt);
              SpeechController.speak(prompt, language, () => {
                if (!isLocationPopoverOpenRef.current) return;
                setIsVoiceSpeaking(false);
                listenForTurn('confirm_candidate');
              });
            } else {
              voiceTurnRef.current = 'idle';
            }
          }
        }
      },
      onSilence: () => {
        setIsVoiceListening(false);
        SpeechController.releaseMic('header_location_voice');
        if (voiceRetryCountRef.current < 2) {
          voiceRetryCountRef.current += 1;
          const retryHint = t('location.voiceNoSpeech');
          setVoiceStatusText(retryHint);
        } else {
          voiceTurnRef.current = 'idle';
        }
      },
      onError: (errCode) => {
        setIsVoiceListening(false);
        SpeechController.releaseMic('header_location_voice');
        if (errCode === 'not-allowed' || errCode === 'permission-denied') {
          setVoiceStatusText(t('location.voiceMicDenied'));
        }
        voiceTurnRef.current = 'idle';
      },
      onEnd: () => {
        setIsVoiceListening(false);
      }
    });
  }, [language, t, handleUseCurrentGPS, saveChosenLocation, stopVoiceFlow]);

  const startVoiceAddressFlow = useCallback((isRetry = false) => {
    if (!SpeechController.isSupported()) return;
    if (!isRetry) {
      voiceRetryCountRef.current = 0;
      pendingPlacesRef.current = [];
      candidateToConfirmRef.current = null;
    }

    voiceTurnRef.current = 'input_address';
    const prompt = t('location.voicePrompt');
    setIsVoiceSpeaking(true);
    setVoiceStatusText(prompt);

    SpeechController.speak(prompt, language, () => {
      if (!isLocationPopoverOpenRef.current) return;
      setIsVoiceSpeaking(false);
      listenForTurn('input_address');
    });
  }, [language, t, listenForTurn]);

  const handleToggleVoice = () => {
    if (isVoiceListening || isVoiceSpeaking) {
      stopVoiceFlow();
    } else {
      startVoiceAddressFlow(false);
    }
  };

  useEffect(() => {
    if (isLocationPopoverOpen) {
      if (autoVoicePromptEnabled) {
        const timer = setTimeout(() => {
          startVoiceAddressFlow(false);
        }, 150);
        return () => clearTimeout(timer);
      }
    } else {
      stopVoiceFlow();
    }
  }, [isLocationPopoverOpen, autoVoicePromptEnabled, startVoiceAddressFlow, stopVoiceFlow]);

  useEffect(() => {
    return () => {
      stopVoiceFlow();
    };
  }, [stopVoiceFlow]);

  // Auto-focus input when popover opens
  useEffect(() => {
    if (isLocationPopoverOpen) {
      const timer = setTimeout(() => {
        locationInputRef.current?.focus();
        locationInputRef.current?.select();
      }, 20);
      return () => clearTimeout(timer);
    }
  }, [isLocationPopoverOpen]);

  // Close on Escape key or clicking outside
  useEffect(() => {
    if (!isLocationPopoverOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeLocationPopover();
        locationChipRef.current?.focus();
      }
    };

    const handlePointerDownOutside = (e: MouseEvent | TouchEvent) => {
      if (
        locationContainerRef.current &&
        !locationContainerRef.current.contains(e.target as Node)
      ) {
        closeLocationPopover();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('touchstart', handlePointerDownOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
    };
  }, [isLocationPopoverOpen]);

  const handleLocationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocationInput(val);
    setSelectedSuggestion(null);
    setLocationError(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = val.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsSearchingLocation(false);
      setHasSearchedLocation(false);
      return;
    }

    setIsSearchingLocation(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await forwardGeocode(trimmed);
        if (lastForwardGeocodeError) {
          setLocationError(t('location.searchError'));
          setSuggestions([]);
        } else {
          setSuggestions(results.slice(0, 5));
        }
        setHasSearchedLocation(true);
      } catch (err) {
        setLocationError(t('location.searchError'));
        setSuggestions([]);
        setHasSearchedLocation(true);
      } finally {
        setIsSearchingLocation(false);
      }
    }, 400);
  };

  const handleSelectSuggestion = (place: GeocodedPlace) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSelectedSuggestion(place);
    const displayVal =
      place.area && place.city && place.area.toLowerCase() !== place.city.toLowerCase()
        ? `${place.area}, ${place.city}`
        : place.area || place.city || place.addressName;
    setLocationInput(displayVal);
    setLocationError(null);
    setIsSearchingLocation(false);
    locationInputRef.current?.focus();
  };



  const handleSaveLocation = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const raw = locationInput.trim();
    if (!raw) {
      setLocationError(t('location.emptyError'));
      return;
    }

    const fallbackCity =
      userLocation.city && userLocation.city !== 'Not set' && userLocation.city !== 'Location not set'
        ? userLocation.city
        : 'Chennai';

    let area = raw;
    let city = fallbackCity;
    let lat = userLocation.latitude || 13.0827;
    let lng = userLocation.longitude || 80.2707;

    if (selectedSuggestion) {
      area = selectedSuggestion.area || selectedSuggestion.city || raw;
      city = selectedSuggestion.city || fallbackCity;
      lat = selectedSuggestion.latitude || lat;
      lng = selectedSuggestion.longitude || lng;
    } else {
      if (raw.includes(',')) {
        const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
        area = parts[0] || raw;
        city = parts[1] || fallbackCity;
      }

      // Check existing suggestions or fast forwardGeocode match for accurate coordinates
      const matchedInSuggestions = suggestions.find(
        s =>
          s.area.toLowerCase() === area.toLowerCase() ||
          s.addressName.toLowerCase() === raw.toLowerCase() ||
          `${s.area}, ${s.city}`.toLowerCase() === raw.toLowerCase()
      );

      if (matchedInSuggestions) {
        if (matchedInSuggestions.city) city = matchedInSuggestions.city;
        lat = matchedInSuggestions.latitude;
        lng = matchedInSuggestions.longitude;
      } else {
        // Compute a deterministic local coordinate offset when user types a custom area name
        // so Haversine distances and nearest-restaurant sorting update immediately
        let hash = 0;
        for (let i = 0; i < area.length; i++) {
          hash = (hash * 31 + area.charCodeAt(i)) % 1000;
        }
        const latOffset = ((hash % 20) - 10) * 0.0045;
        const lngOffset = (((Math.floor(hash / 20)) % 20) - 10) * 0.0045;
        lat = parseFloat((13.0600 + latOffset).toFixed(4));
        lng = parseFloat((80.2400 + lngOffset).toFixed(4));
      }
    }

    const newLoc: UserLocation = {
      latitude: lat,
      longitude: lng,
      addressName: city && area.toLowerCase() !== city.toLowerCase() ? `${area}, ${city}` : area,
      city,
      area,
      isLiveGPS: false,
      isApproximate: false,
      isManualOverride: true
    };

    setManualUserLocation(newLoc);
    const confirmMsg = t('location.deliveryLocationSet').replace('{area}', area);
    speakText(confirmMsg);
    closeLocationPopover();
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

  const currentTheme =
    accessibilitySettings.themeMode ||
    (accessibilitySettings.highContrast ? 'high-contrast' : 'light');

  const pillGroupSurface =
    currentTheme === 'high-contrast'
      ? 'bg-black text-white border-2 border-yellow-400'
      : currentTheme === 'dark'
      ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-xs'
      : 'bg-rose-50/40 text-zinc-900 border border-rose-100/70 shadow-xs';

  const unselectedBtnClass =
    currentTheme === 'high-contrast'
      ? 'bg-black hover:bg-neutral-900 text-white border border-yellow-400'
      : currentTheme === 'dark'
      ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
      : 'bg-transparent hover:bg-rose-100/60 text-zinc-700';

  return (
    <header
      className={`app-header sticky top-0 z-40 transition-colors duration-200 w-full ${
        currentTheme === 'high-contrast'
          ? 'bg-black text-white border-b-2 border-yellow-400'
          : currentTheme === 'dark'
          ? 'bg-zinc-900/95 text-zinc-100 border-b border-zinc-800 backdrop-blur-md shadow-xs'
          : 'bg-white/95 text-zinc-900 border-b border-rose-100/80 backdrop-blur-md shadow-[0_2px_15px_rgba(200,35,70,0.03)]'
      }`}
    >
      <div className="header-container w-full max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5">
        {/* MAIN TOP BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 w-full min-w-0">
          
          {/* LOGO, TITLE & GPS LOCATION BADGE (BRAND GROUP) */}
          <div className="header-brand-group flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2.5 shrink-0">
              <div
                className="bg-[#C82346] min-h-[42px] min-w-[42px] p-2 rounded-2xl shadow-sm flex items-center justify-center cursor-pointer hover:bg-[#B31D3D] transition-all hover:scale-105 shrink-0"
                onClick={() => setActiveView('search')}
                title="Go to AutoFeast Home"
                tabIndex={0}
                role="button"
                aria-label="AutoFeast Home"
              >
                <Sparkles className="w-5 h-5 text-white" />
              </div>

              <h1
                className={`font-black tracking-tight text-lg sm:text-xl cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  currentTheme === 'dark' || currentTheme === 'high-contrast' ? 'text-white' : 'text-[#1E1A1C]'
                }`}
                onClick={() => setActiveView('search')}
              >
                <span>AutoFeast</span>
                <span className="text-[#C82346] font-serif italic text-base">AI</span>
              </h1>
            </div>

            {/* GPS Live Location Button + Inline Popover */}
            <div ref={locationContainerRef} className="relative flex items-center flex-1 min-w-0">
              <button
                ref={locationChipRef}
                type="button"
                id="header-location-chip"
                aria-haspopup="dialog"
                aria-expanded={isLocationPopoverOpen}
                aria-controls="header-location-popover"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isLocationPopoverOpen) {
                    closeLocationPopover();
                  } else {
                    openLocationPopover();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isLocationPopoverOpen) {
                      closeLocationPopover();
                    } else {
                      openLocationPopover();
                    }
                  } else if (e.key === 'Escape' && isLocationPopoverOpen) {
                    e.preventDefault();
                    e.stopPropagation();
                    closeLocationPopover();
                  }
                }}
                className={`header-location-chip min-h-[40px] flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full font-bold text-xs sm:text-sm leading-snug transition-all border shadow-2xs cursor-pointer min-w-0 ${
                  userLocation.area === 'Location not set' || userLocation.city === 'Not set'
                    ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                    : currentTheme === 'high-contrast'
                    ? 'bg-black text-white border-2 border-yellow-400'
                    : currentTheme === 'dark'
                    ? 'bg-zinc-800 text-zinc-100 border-zinc-700 hover:bg-zinc-700'
                    : 'bg-white text-zinc-800 border-rose-200/70 hover:bg-rose-50/50'
                }`}
                title={t('location.changeAddress')}
                aria-label={t('location.changeAddress')}
              >
                {userLocation.area === 'Location not set' || userLocation.city === 'Not set' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                ) : userLocation.isManualOverride ? (
                  <Edit3 className="w-4 h-4 text-blue-600 shrink-0" />
                ) : userLocation.isApproximate ? (
                  <AlertTriangle className="w-4 h-4 text-[#C82346] shrink-0" />
                ) : (
                  <MapPin className="w-4 h-4 text-[#C82346] shrink-0" />
                )}

                <span className="truncate leading-tight font-bold text-xs sm:text-sm">
                  {userLocation.area === 'Location not set' || userLocation.city === 'Not set'
                    ? `📍 ${t('location.notSet')}`
                    : userLocation.isManualOverride
                    ? `✏️ ${userLocation.area}`
                    : userLocation.isApproximate
                    ? `⚠️ ${userLocation.area && userLocation.area !== userLocation.city ? `${userLocation.area}, ${userLocation.city}` : (userLocation.area || userLocation.city)}`
                    : `📍 ${userLocation.area}, ${userLocation.city}`}
                </span>
              </button>
              {isLocationPopoverOpen && (
                <div
                  id="header-location-popover"
                  role="dialog"
                  aria-modal="false"
                  aria-label={t('location.popoverTitle')}
                  onClick={(e) => e.stopPropagation()}
                  className={`fixed left-2 right-2 top-[76px] sm:absolute sm:left-0 sm:right-auto sm:top-[calc(100%+8px)] sm:w-[400px] sm:max-w-[calc(100vw-24px)] max-h-[calc(100vh-92px)] overflow-y-auto z-50 rounded-2xl p-4 shadow-2xl transition-all ${
                    currentTheme === 'high-contrast'
                      ? 'bg-black text-white border-2 border-yellow-400'
                      : currentTheme === 'dark'
                      ? 'bg-slate-900 text-white border-2 border-slate-600'
                      : 'bg-[#FFFFFF] text-[#111827] border-2 border-[#D1D5DB]'
                  }`}
                >
                  <form onSubmit={handleSaveLocation} className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="header-location-input"
                        className="text-[18px] font-extrabold flex items-center gap-2 leading-snug"
                      >
                        <MapPin className="w-5 h-5 text-[#C82346] shrink-0" />
                        <span>{t('location.popoverTitle')}</span>
                      </label>
                      <button
                        type="button"
                        onClick={closeLocationPopover}
                        aria-label={t('location.cancelBtn')}
                        className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
                          currentTheme === 'high-contrast'
                            ? 'text-white border border-yellow-400 hover:bg-neutral-900'
                            : currentTheme === 'dark'
                            ? 'text-slate-300 hover:bg-slate-800'
                            : 'text-[#111827] hover:bg-slate-100'
                        }`}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Voice feedback / status strip */}
                    {voiceStatusText && (
                      <div
                        role="status"
                        aria-live="polite"
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[16px] font-bold border ${
                          isVoiceListening
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500 animate-pulse'
                            : isVoiceSpeaking
                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        <Mic className={`w-4 h-4 shrink-0 ${isVoiceListening ? 'text-[#C82346] animate-pulse' : 'text-blue-600'}`} />
                        <span className="truncate">{voiceStatusText}</span>
                      </div>
                    )}

                    {/* 1. Text Input (pre-filled & auto-focused) + Mic Button */}
                    <div className="flex items-center gap-2">
                      <input
                        ref={locationInputRef}
                        id="header-location-input"
                        type="text"
                        value={locationInput}
                        onChange={handleLocationInputChange}
                        placeholder={t('location.popoverPlaceholder')}
                        aria-label={t('location.popoverInputLabel')}
                        autoComplete="off"
                        autoFocus
                        className={`flex-1 min-h-[48px] px-3.5 py-2.5 rounded-xl text-[18px] font-bold leading-snug focus:outline-none focus:ring-2 focus:ring-[#C82346] transition-colors ${
                          currentTheme === 'high-contrast'
                            ? 'bg-black text-white placeholder-neutral-400 border-2 border-yellow-400'
                            : currentTheme === 'dark'
                            ? 'bg-slate-800 text-white placeholder-slate-400 border border-slate-600'
                            : 'bg-[#FFFFFF] text-[#111827] placeholder-slate-500 border-2 border-[#9CA3AF]'
                        }`}
                      />
                      <button
                        type="button"
                        id="popover-voice-location-btn"
                        onClick={handleToggleVoice}
                        aria-label={t('location.voiceMicAria')}
                        title={t('location.voiceMicAria')}
                        className={`min-h-[48px] px-3 py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border shrink-0 ${
                          isVoiceListening
                            ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse border-red-700 shadow-sm'
                            : isVoiceSpeaking
                            ? 'bg-amber-500 text-white animate-bounce border-amber-600'
                            : currentTheme === 'high-contrast'
                            ? 'bg-black hover:bg-neutral-900 text-yellow-300 border-2 border-yellow-400'
                            : currentTheme === 'dark'
                            ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-600'
                            : 'bg-[#C82346] hover:bg-[#B31D3D] text-white border-[#C82346]'
                        }`}
                      >
                        <Mic className="w-5 h-5 shrink-0" />
                        <span className="text-[16px]">{isVoiceListening ? t('location.listening') : t('search.voice')}</span>
                      </button>
                    </div>

                    {/* 5. Loading, Error & "No results" states */}
                    {isSearchingLocation && (
                      <div
                        role="status"
                        aria-live="polite"
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-[18px] font-bold ${
                          currentTheme === 'high-contrast'
                            ? 'bg-neutral-900 text-yellow-300 border border-yellow-400'
                            : currentTheme === 'dark'
                            ? 'bg-slate-800 text-slate-200'
                            : 'bg-slate-100 text-[#111827]'
                        }`}
                      >
                        <Loader2 className="w-5 h-5 animate-spin text-[#C82346] shrink-0" />
                        <span>{t('location.searching')}</span>
                      </div>
                    )}

                    {locationError && (
                      <div
                        role="alert"
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-[18px] font-bold border ${
                          currentTheme === 'high-contrast'
                            ? 'bg-black text-yellow-300 border-2 border-yellow-400'
                            : currentTheme === 'dark'
                            ? 'bg-red-950/80 text-red-200 border-red-600'
                            : 'bg-red-50 text-[#991B1B] border-red-400'
                        }`}
                      >
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <span>{locationError}</span>
                      </div>
                    )}

                    {!isSearchingLocation &&
                      hasSearchedLocation &&
                      !locationError &&
                      suggestions.length === 0 &&
                      locationInput.trim().length >= 2 && (
                        <div
                          role="status"
                          aria-live="polite"
                          className={`px-3 py-2.5 rounded-xl text-[18px] font-bold border ${
                            currentTheme === 'high-contrast'
                              ? 'bg-black text-white border border-yellow-400'
                              : currentTheme === 'dark'
                              ? 'bg-slate-800 text-slate-200 border-slate-700'
                              : 'bg-slate-50 text-[#111827] border-[#D1D5DB]'
                          }`}
                        >
                          {t('location.noResults')}
                        </div>
                      )}

                    {/* 2. Up to 5 Suggestions */}
                    {!isSearchingLocation && suggestions.length > 0 && (
                      <div
                        role="listbox"
                        aria-label={t('location.suggestionsAria')}
                        className="space-y-1.5 max-h-56 overflow-y-auto"
                      >
                        {suggestions.slice(0, 5).map((place, idx) => {
                          const isSelected =
                            selectedSuggestion?.area === place.area &&
                            selectedSuggestion?.city === place.city &&
                            selectedSuggestion?.addressName === place.addressName;
                          const label =
                            place.area && place.city && place.area.toLowerCase() !== place.city.toLowerCase()
                              ? `${place.area}, ${place.city}`
                              : place.addressName || place.area || place.city;

                          return (
                            <button
                              key={`${place.area}-${place.city}-${idx}`}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => handleSelectSuggestion(place)}
                              className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl text-left text-[18px] font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer border ${
                                isSelected
                                  ? 'bg-[#C82346] text-white border-[#C82346]'
                                  : currentTheme === 'high-contrast'
                                  ? 'bg-black hover:bg-neutral-900 text-white border-yellow-400'
                                  : currentTheme === 'dark'
                                  ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-600'
                                  : 'bg-[#FFFFFF] hover:bg-slate-100 text-[#111827] border-[#D1D5DB]'
                              }`}
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <MapPin className={`w-5 h-5 shrink-0 ${isSelected ? 'text-white' : 'text-[#C82346]'}`} />
                                <span className="truncate">{label}</span>
                              </span>
                              {isSelected && <Check className="w-5 h-5 text-white shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* 3. Use my current location (GPS) button */}
                    <button
                      type="button"
                      id="popover-use-gps-btn"
                      disabled={isDetectingGps}
                      onClick={handleUseCurrentGPS}
                      className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl text-[18px] font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer border ${
                        currentTheme === 'high-contrast'
                          ? 'bg-black hover:bg-neutral-900 text-yellow-300 border-2 border-yellow-400'
                          : currentTheme === 'dark'
                          ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-500'
                          : 'bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] border-[#9CA3AF]'
                      }`}
                    >
                      {isDetectingGps ? (
                        <Loader2 className="w-5 h-5 animate-spin text-[#C82346] shrink-0" />
                      ) : (
                        <Navigation className="w-5 h-5 text-[#C82346] shrink-0" />
                      )}
                      <span>{t('location.useCurrentGPS')}</span>
                    </button>

                    {/* 4. Save and Cancel buttons */}
                    <div className="flex items-center gap-2.5 pt-1">
                      <button
                        type="submit"
                        id="popover-save-location-btn"
                        className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-[18px] font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                      >
                        <Check className="w-5 h-5 text-white shrink-0" />
                        <span>{t('location.saveBtn')}</span>
                      </button>

                      <button
                        type="button"
                        id="popover-cancel-location-btn"
                        onClick={closeLocationPopover}
                        className={`flex-1 min-h-[48px] px-4 py-2.5 rounded-xl text-[18px] font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer border ${
                          currentTheme === 'high-contrast'
                            ? 'bg-black hover:bg-neutral-900 text-white border-2 border-yellow-400'
                            : currentTheme === 'dark'
                            ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-600'
                            : 'bg-[#FFFFFF] hover:bg-slate-100 text-[#111827] border-2 border-[#9CA3AF]'
                        }`}
                      >
                        <X className="w-5 h-5 shrink-0" />
                        <span>{t('location.cancelBtn')}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>

          {/* NAVIGATION PILLS GROUP */}
          <nav
            className={`header-nav-group flex flex-wrap items-center justify-start sm:justify-between gap-1.5 p-1 rounded-full min-w-0 ${pillGroupSurface}`}
          >
            {/* Search */}
            <button
              type="button"
              onClick={() => setActiveView('search')}
              className={`header-btn flex items-center justify-center gap-2 px-4 py-2 rounded-full font-bold leading-tight transition-all cursor-pointer ${
                activeView === 'search'
                  ? 'bg-[#C82346] text-white shadow-xs'
                  : unselectedBtnClass
              }`}
              title={t('nav.search')}
              aria-label={t('nav.search')}
            >
              <Search className="w-4 h-4 shrink-0" />
              <span className="header-label-responsive text-xs sm:text-sm">{t('nav.search')}</span>
            </button>

            {/* Track Live Order */}
            {activeLiveOrder && (
              <button
                type="button"
                onClick={() => setActiveView('tracking')}
                className={`header-btn flex items-center justify-center gap-2 px-4 py-2 rounded-full font-bold leading-tight transition-all cursor-pointer ${
                  activeView === 'tracking'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
                title="Track Order"
                aria-label="Track Order"
              >
                <Bike className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="header-label-responsive text-xs sm:text-sm">Track Order</span>
              </button>
            )}

            {/* Auto Scheduler */}
            <button
              type="button"
              onClick={() => setActiveView('scheduler')}
              className={`header-btn flex items-center justify-center gap-2 px-4 py-2 rounded-full font-bold leading-tight transition-all cursor-pointer ${
                activeView === 'scheduler'
                  ? 'bg-[#C82346] text-white shadow-xs'
                  : unselectedBtnClass
              }`}
              title={t('nav.schedule')}
              aria-label={t('nav.schedule')}
            >
              <Calendar className="w-4 h-4 shrink-0" />
              <span className="header-label-responsive text-xs sm:text-sm">{t('nav.schedule')}</span>
            </button>

            {/* Wallet Balance */}
            <button
              type="button"
              onClick={() => {
                if (isWalletRevealed) {
                  setActiveView('wallet');
                } else {
                  requestWalletBalanceReveal();
                }
              }}
              className={`header-btn flex items-center justify-center gap-2 px-4 py-2 rounded-full font-bold leading-tight transition-all cursor-pointer ${
                activeView === 'wallet'
                  ? 'bg-[#C82346] text-white shadow-xs'
                  : unselectedBtnClass
              }`}
              title={isWalletRevealed ? `Wallet Balance: ₹${walletBalance.toFixed(0)}` : t('wallet.maskedLabel')}
              aria-label={isWalletRevealed ? `Wallet Balance: ₹${walletBalance.toFixed(0)}` : t('wallet.maskedLabel')}
            >
              {isWalletRevealed ? (
                <>
                  <Eye className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold text-xs sm:text-sm">₹{walletBalance.toFixed(0)}</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-bold text-xs sm:text-sm">{t('wallet.maskedLabel')}</span>
                </>
              )}
            </button>

            {/* Limit */}
            <button
              type="button"
              onClick={() => setIsLimitRenewalModalOpen(true)}
              className={`header-btn flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full font-bold leading-tight transition-all border cursor-pointer text-xs ${
                dailyOrderCount >= 6
                  ? 'bg-rose-600 text-white border-rose-600'
                  : currentTheme === 'high-contrast'
                  ? 'bg-black hover:bg-neutral-900 text-white border-yellow-400'
                  : currentTheme === 'dark'
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700'
                  : 'bg-white hover:bg-rose-50 text-zinc-700 border-rose-200/70'
              }`}
              title={`Daily Limit: ${dailyOrderCount}/6`}
              aria-label={`Daily Limit: ${dailyOrderCount}/6`}
            >
              <PackageCheck className={`w-3.5 h-3.5 shrink-0 ${dailyOrderCount >= 6 ? 'text-white' : 'text-[#C82346]'}`} />
              <span className="font-bold"><span className="header-label-responsive">Limit: </span>{dailyOrderCount}/6</span>
            </button>

            {/* Nominee Control Portal */}
            <button
              type="button"
              onClick={() => {
                try {
                  sessionStorage.setItem('nominee_return_to', window.location.pathname);
                } catch {}
                setIsNomineeModalOpen(true);
              }}
              className={`header-btn flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full font-bold leading-tight transition-all border cursor-pointer text-xs relative ${
                currentTheme === 'high-contrast'
                  ? 'bg-black hover:bg-neutral-900 text-white border-yellow-400'
                  : currentTheme === 'dark'
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700'
                  : 'bg-white hover:bg-rose-50 text-zinc-800 border-rose-200/70'
              }`}
              title="Nominee Control Portal"
              aria-label="Nominee Control Portal"
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-amber-600" />
              <span className="header-label-responsive">Nominee</span>
              {pendingNomineeApprovals.filter(r => r.status === 'pending').length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {pendingNomineeApprovals.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>

            {/* Order History */}
            <button
              type="button"
              onClick={() => setActiveView('orders')}
              className={`header-btn flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full font-bold leading-tight transition-all cursor-pointer ${
                activeView === 'orders'
                  ? 'bg-[#C82346] text-white shadow-xs'
                  : unselectedBtnClass
              }`}
              title={t('nav.orders')}
              aria-label={t('nav.orders')}
            >
              <History className="w-4 h-4 shrink-0" />
              <span className="header-label-responsive text-xs sm:text-sm">{t('nav.orders')}</span>
            </button>

            {/* Shared Cart */}
            {(() => {
              const totalCartCount = cart.reduce((sum, i) => sum + (i.qty || (i as any).quantity || 1), 0);
              return (
                <button
                  type="button"
                  onClick={() => setIsScheduleCartModalOpen(true)}
                  className={`header-btn flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full font-bold leading-tight transition-all cursor-pointer border relative ${
                    currentTheme === 'high-contrast'
                      ? 'bg-black hover:bg-neutral-900 text-white border-yellow-400'
                      : currentTheme === 'dark'
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700'
                      : 'bg-white hover:bg-rose-50 text-zinc-800 border-rose-200/70'
                  }`}
                  title={t('cartTitle')}
                  aria-label={t('cartTitle')}
                >
                  <ShoppingBag className="w-4 h-4 shrink-0 text-[#C82346]" />
                  <span className="header-label-responsive text-xs sm:text-sm">{t('cartTitle')}</span>
                  {totalCartCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#C82346] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {totalCartCount}
                    </span>
                  )}
                </button>
              );
            })()}
          </nav>

          {/* ACTION BUTTONS (USER PROFILE, VOICE SEARCH, HEALTHY FOOD, THEME, LOGOUT) */}
          <div className="header-actions-group flex items-center gap-2 min-w-0">
            
            {/* User Profile / Sign In */}
            {currentUser ? (
              <div
                className={`header-chip flex items-center justify-center gap-2 px-3 py-1.5 rounded-full border min-w-0 text-xs sm:text-sm ${
                  currentTheme === 'high-contrast'
                    ? 'bg-black text-white border-yellow-400'
                    : currentTheme === 'dark'
                    ? 'bg-zinc-800 text-white border-zinc-700'
                    : 'bg-white text-zinc-800 border-rose-200/70 shadow-2xs'
                }`}
                title={`Signed in as ${currentUser.name}`}
              >
                <div className="p-1 bg-[#C82346] rounded-full text-white shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="header-label-responsive font-bold leading-tight">
                  {currentUser.name}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await registerFaceIDOnDevice();
                    if (res.success) {
                      showToast('Face ID registered!');
                      speakText('Face ID registered!');
                    }
                  }}
                  className="p-1 hover:bg-rose-50 rounded-full text-[#C82346] transition-colors cursor-pointer shrink-0"
                  title="Link Face ID (WebAuthn)"
                  aria-label="Link Face ID"
                >
                  <Scan className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthGateOpen(true)}
                className="header-btn flex items-center justify-center gap-2 bg-[#C82346] hover:bg-[#B31D3D] text-white font-bold px-5 py-2 rounded-full shadow-xs cursor-pointer text-xs sm:text-sm"
                title="Sign In"
                aria-label="Sign In"
              >
                <LogIn className="w-4 h-4 shrink-0" />
                <span className="header-label-responsive">Sign In</span>
              </button>
            )}

            {/* Voice Assistant Mic Button */}
            <button
              type="button"
              onClick={() => setIsVoiceModalOpen(true)}
              className="header-btn flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100/80 text-[#C82346] font-bold px-3.5 py-2 rounded-full border border-rose-200/80 shadow-2xs transition-all cursor-pointer text-xs sm:text-sm"
              title={t('search.voice')}
              aria-label={t('search.voice')}
            >
              <Mic className="w-4 h-4 text-[#C82346] shrink-0" />
              <span className="header-label-responsive leading-tight">{t('search.voice')}</span>
            </button>

            {/* Healthy Food Guide */}
            <button
              type="button"
              onClick={() => setIsHealthModalOpen(true)}
              className="header-btn flex items-center justify-center gap-1.5 bg-white hover:bg-rose-50 text-zinc-700 font-bold px-3.5 py-2 rounded-full border border-rose-200/70 shadow-2xs transition-all cursor-pointer text-xs sm:text-sm"
              title={t('nav.healthyFood')}
              aria-label={t('nav.healthyFood')}
            >
              <HeartPulse className="w-4 h-4 text-[#C82346] shrink-0" />
              <span className="header-label-responsive leading-tight">{t('nav.healthyFood')}</span>
            </button>

            {/* Logout */}
            {currentUser && (
              <button
                type="button"
                onClick={logout}
                className="header-btn p-2 rounded-full text-zinc-500 hover:text-[#C82346] hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4 shrink-0" />
              </button>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
