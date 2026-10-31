import { UserProfileDropdown } from './UserProfileDropdown';
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
  Loader2,
  Menu
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
    scheduleCart,
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
      : 'bg-[#FBE9E5] text-zinc-900 border border-[#F0E5DC] shadow-xs';

  const unselectedBtnClass =
    currentTheme === 'high-contrast'
      ? 'bg-black hover:bg-neutral-900 text-white border border-yellow-400'
      : currentTheme === 'dark'
      ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
      : 'bg-transparent hover:bg-[#FBE9E5]/60 text-zinc-700';

  return (
    <header
      className={`app-header sticky top-0 z-40 transition-colors duration-200 w-full ${
        currentTheme === 'high-contrast'
          ? 'bg-black text-white border-b-2 border-yellow-400'
          : currentTheme === 'dark'
          ? 'bg-zinc-900/95 text-zinc-100 border-b border-zinc-800 backdrop-blur-md shadow-xs'
          : 'bg-white/95 text-[#33251F] border-b border-[#F0E5DC] backdrop-blur-md shadow-xs'
      }`}
    >
      <div className="header-container w-full max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3">
        {/* MAIN TOP BAR */}
        <div className="flex items-center justify-between gap-4 w-full min-w-0">
          
          {/* LEFT SECTION – BRANDING */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              className="bg-[#D93636] min-h-[38px] min-w-[38px] p-2 rounded-xl shadow-xs flex items-center justify-center cursor-pointer hover:bg-[#33251F] transition-all hover:scale-105 shrink-0"
              onClick={() => setActiveView('home')}
              title="AutoFeast AI Home"
              tabIndex={0}
              role="button"
              aria-label="AutoFeast AI Home"
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>

            <div
              onClick={() => setActiveView('home')}
              className="cursor-pointer select-none"
            >
              <h1 className="font-serif-editorial font-bold tracking-tight text-xl sm:text-2xl flex items-center gap-1.5 leading-none text-[#33251F]">
                <span>AutoFeast</span>
                <span className="font-sans text-[#D93636] font-black text-sm tracking-wider uppercase px-1.5 py-0.5 rounded-sm bg-[#FBE9E5] border border-[#F0E5DC]">AI</span>
              </h1>
              <p className="text-[10px] text-[#8A817A] font-medium hidden sm:block leading-tight mt-0.5">
                AI Autonomous Food Platform
              </p>
            </div>
          </div>

          {/* CENTER SECTION – MAIN NAVIGATION (Exact order: Home, How It Works, Features, About) */}
          <nav
            aria-label="Main Navigation"
            className="header-nav-group hidden md:flex flex-wrap items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FBE9E5] border border-[#F0E5DC]"
          >
            {/* 1. Home */}
            <button
              type="button"
              onClick={() => setActiveView('home')}
              className={`px-4 py-1.5 rounded-full text-xs lg:text-sm font-semibold transition-all cursor-pointer ${
                activeView === 'home' || activeView === 'search'
                  ? 'bg-[#D93636] text-white shadow-xs'
                  : 'text-[#8A817A] hover:text-[#33251F] hover:bg-white'
              }`}
            >
              {t('nav.home') || 'Home'}
            </button>

            {/* 2. How It Works */}
            <button
              type="button"
              onClick={() => setActiveView('how-it-works')}
              className={`px-4 py-1.5 rounded-full text-xs lg:text-sm font-semibold transition-all cursor-pointer ${
                activeView === 'how-it-works'
                  ? 'bg-[#D93636] text-white shadow-xs'
                  : 'text-[#8A817A] hover:text-[#33251F] hover:bg-white'
              }`}
            >
              {t('nav.howItWorks') || 'How It Works'}
            </button>

            {/* 3. Features */}
            <button
              type="button"
              onClick={() => setActiveView('features')}
              className={`px-4 py-1.5 rounded-full text-xs lg:text-sm font-semibold transition-all cursor-pointer ${
                activeView === 'features'
                  ? 'bg-[#D93636] text-white shadow-xs'
                  : 'text-[#8A817A] hover:text-[#33251F] hover:bg-white'
              }`}
            >
              {t('nav.features') || 'Features'}
            </button>

            {/* 4. About */}
            <button
              type="button"
              onClick={() => setActiveView('about')}
              className={`px-4 py-1.5 rounded-full text-xs lg:text-sm font-semibold transition-all cursor-pointer ${
                activeView === 'about'
                  ? 'bg-[#D93636] text-white shadow-xs'
                  : 'text-[#8A817A] hover:text-[#33251F] hover:bg-white'
              }`}
            >
              {t('nav.about') || 'About'}
            </button>
          </nav>

          {/* RIGHT SECTION – USER PROFILE, LOCATION, CART & MOBILE TOGGLE */}
          <div className="header-actions-group flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
            {/* Delivery Location Chip with Inline Popover */}
            <div ref={locationContainerRef} className="relative hidden lg:block">
              <button
                ref={locationChipRef}
                type="button"
                id="header-location-chip"
                aria-haspopup="dialog"
                aria-expanded={isLocationPopoverOpen}
                aria-controls="header-location-popover"
                aria-label={t('location.changeAddress') || 'Change delivery address'}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isLocationPopoverOpen) {
                    closeLocationPopover();
                  } else {
                    openLocationPopover();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#F0E5DC] bg-[#FBE9E5] hover:bg-[#FBE9E5] text-xs font-semibold text-[#33251F] transition-colors cursor-pointer max-w-[180px]"
                title={t('location.changeAddress')}
              >
                <MapPin className="w-3.5 h-3.5 text-[#D93636] shrink-0" />
                <span className="truncate">
                  {userLocation.area === 'Location not set' ? 'Set Address' : `${userLocation.area}, ${userLocation.city}`}
                </span>
              </button>

              {/* Location Popover Dialog */}
              {isLocationPopoverOpen && (
                <div
                  id="header-location-popover"
                  role="dialog"
                  aria-modal="false"
                  aria-label={t('location.popoverTitle')}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-[calc(100%+8px)] w-[360px] max-w-[calc(100vw-24px)] max-h-[calc(100vh-92px)] overflow-y-auto z-50 rounded-2xl p-4 shadow-2xl transition-all border border-[#F0E5DC] bg-white text-[#33251F]"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[#F0E5DC]">
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4 text-[#D93636]" />
                      <h3 className="font-bold text-sm text-[#33251F]">{t('location.popoverTitle')}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={closeLocationPopover}
                      className="p-1 rounded-md text-[#8A817A] hover:text-[#33251F]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveLocation} className="mt-3 space-y-3">
                    <div className="relative flex items-center gap-2">
                      <input
                        ref={locationInputRef}
                        type="text"
                        value={locationInput}
                        onChange={(e) => {
                          setLocationInput(e.target.value);
                          triggerDebouncedGeocode(e.target.value);
                        }}
                        placeholder={t('location.popoverPlaceholder')}
                        aria-label={t('location.popoverInputLabel') || 'Enter delivery address or landmark'}
                        className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#F0E5DC] focus:outline-none focus:ring-2 focus:ring-[#D93636]"
                      />
                      <button
                        type="button"
                        id="popover-voice-location-btn"
                        onClick={handleToggleVoice}
                        aria-label={t('location.voiceMicAria') || 'Voice input for delivery address'}
                        title={t('location.voiceMicAria') || 'Voice input for delivery address'}
                        className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                          isVoiceListening
                            ? 'bg-red-500 text-white animate-pulse border-red-600'
                            : isVoiceSpeaking
                            ? 'bg-amber-500 text-white animate-bounce border-amber-600'
                            : 'bg-[#FBE9E5] text-[#D93636] hover:bg-[#FBE9E5] border-[#F0E5DC]'
                        }`}
                      >
                        <Mic className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleUseCurrentGPS}
                      disabled={isDetectingGps}
                      className="w-full py-2 px-3 rounded-lg border border-[#F0E5DC] bg-[#FBE9E5] hover:bg-[#FBE9E5] text-[#D93636] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {isDetectingGps ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Navigation className="w-3.5 h-3.5" />
                      )}
                      <span>{t('location.useCurrentGPS')}</span>
                    </button>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F0E5DC]">
                      <button
                        type="button"
                        id="popover-cancel-location-btn"
                        onClick={closeLocationPopover}
                        className="px-3 py-1.5 rounded-lg border border-[#F0E5DC] text-xs font-semibold text-[#8A817A] hover:bg-[#FBE9E5]"
                      >
                        {t('location.cancelBtn')}
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-[#D93636] hover:bg-[#33251F] text-white text-xs font-semibold shadow-xs"
                      >
                        {t('location.saveBtn')}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Cart Icon with Live Badge */}
            <button
              type="button"
              onClick={() => setIsScheduleCartModalOpen(true)}
              className="p-2 rounded-lg text-[#8A817A] hover:text-[#D93636] hover:bg-[#FBE9E5] relative border border-[#F0E5DC] transition-colors cursor-pointer"
              title="View Schedule Cart"
              aria-label="View Schedule Cart"
            >
              <ShoppingBag className="w-4 h-4" />
              {scheduleCart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#D93636] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {scheduleCart.length}
                </span>
              )}
            </button>

            {/* User Profile Dropdown (Top-Right) */}
            <UserProfileDropdown onNavigateFeatures={() => setActiveView('features')} />

            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-[#33251F] hover:bg-[#FBE9E5] border border-[#F0E5DC] transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden pt-3 pb-2 border-t border-[#F0E5DC] mt-2 space-y-1.5 animate-fade-in">
            <button
              type="button"
              onClick={() => {
                setActiveView('home');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3.5 py-2 rounded-lg text-xs font-semibold ${
                activeView === 'home' || activeView === 'search'
                  ? 'bg-[#D93636] text-white'
                  : 'text-[#33251F] hover:bg-[#FBE9E5]'
              }`}
            >
              {t('nav.home') || 'Home'}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveView('how-it-works');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3.5 py-2 rounded-lg text-xs font-semibold ${
                activeView === 'how-it-works'
                  ? 'bg-[#D93636] text-white'
                  : 'text-[#33251F] hover:bg-[#FBE9E5]'
              }`}
            >
              {t('nav.howItWorks') || 'How It Works'}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveView('features');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3.5 py-2 rounded-lg text-xs font-semibold ${
                activeView === 'features'
                  ? 'bg-[#D93636] text-white'
                  : 'text-[#33251F] hover:bg-[#FBE9E5]'
              }`}
            >
              {t('nav.features') || 'Features'}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveView('about');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3.5 py-2 rounded-lg text-xs font-semibold ${
                activeView === 'about'
                  ? 'bg-[#D93636] text-white'
                  : 'text-[#33251F] hover:bg-[#FBE9E5]'
              }`}
            >
              {t('nav.about') || 'About'}
            </button>

            {/* Mobile Location Action */}
            <div className="pt-1.5 border-t border-[#F0E5DC]">
              <button
                type="button"
                onClick={() => {
                  openLocationPopover();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold bg-[#FBE9E5] border border-[#F0E5DC] text-[#33251F] flex items-center justify-between"
              >
                <span className="truncate">📍 {userLocation.area === 'Location not set' ? 'Set Delivery Address' : `${userLocation.area}, ${userLocation.city}`}</span>
                <Edit3 className="w-3.5 h-3.5 text-[#D93636] shrink-0" />
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
