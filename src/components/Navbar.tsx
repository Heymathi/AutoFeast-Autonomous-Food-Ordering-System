import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  forwardGeocode,
  fetchLiveGPSLocation,
  GeocodedPlace,
  lastForwardGeocodeError
} from '../services/locationService';
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

  const closeLocationPopover = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setIsLocationPopoverOpen(false);
    setIsSearchingLocation(false);
    setLocationError(null);
    setIsDetectingGps(false);
  };

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
      ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
      : 'bg-[#FFFFFF] text-[#111827] border border-[#D1D5DB] shadow-sm';

  const unselectedBtnClass =
    currentTheme === 'high-contrast'
      ? 'bg-black hover:bg-neutral-900 text-white border border-yellow-400'
      : currentTheme === 'dark'
      ? 'bg-slate-800 hover:bg-slate-700 text-white'
      : 'bg-[#FFFFFF] hover:bg-slate-100 text-[#111827]';

  return (
    <header
      className={`app-header sticky top-0 z-40 shadow-md transition-colors duration-200 w-full ${
        currentTheme === 'high-contrast'
          ? 'bg-black text-white border-b-4 border-yellow-400'
          : currentTheme === 'dark'
          ? 'bg-slate-900 text-slate-100 border-b border-slate-700'
          : 'bg-[#DAF0F7] text-[#111827] border-b border-[#B2E2F0]'
      }`}
    >
      <div className="header-container w-full max-w-full mx-auto px-2 sm:px-4 lg:px-6 py-2 sm:py-2.5">
        {/* MAIN TOP BAR */}
        <div className="flex flex-wrap items-stretch justify-between gap-2 sm:gap-2.5 w-full min-w-0">
          
          {/* LOGO, TITLE & GPS LOCATION BADGE (BRAND GROUP) */}
          <div className={`header-brand-group flex flex-wrap items-center justify-between gap-2.5 px-3 py-1.5 rounded-2xl min-w-0 ${pillGroupSurface}`}>
            <div className="flex items-center gap-2.5 shrink-0">
              <div
                className="bg-[#FF5A1F] min-h-[48px] min-w-[48px] p-2.5 rounded-xl shadow-md flex items-center justify-center cursor-pointer hover:bg-[#E04812] transition-colors shrink-0"
                onClick={() => setActiveView('search')}
                title="Go to AutoFeast Home"
                tabIndex={0}
                role="button"
                aria-label="AutoFeast Home"
              >
                <Sparkles className="w-6 h-6 text-white animate-pulse" />
              </div>

              <h1
                className={`font-black tracking-tight leading-tight cursor-pointer flex items-center gap-1 shrink-0 ${
                  currentTheme === 'dark' || currentTheme === 'high-contrast' ? 'text-white' : 'text-[#111827]'
                }`}
                onClick={() => setActiveView('search')}
              >
                AutoFeast AI
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
                className={`header-location-chip min-h-[48px] w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl font-bold leading-snug transition-all border shadow-xs cursor-pointer min-w-0 flex-1 ${
                  userLocation.area === 'Location not set' || userLocation.city === 'Not set'
                    ? 'bg-amber-100 text-[#111827] border-amber-500 hover:bg-amber-200'
                    : currentTheme === 'high-contrast'
                    ? 'bg-black text-white border-2 border-yellow-400'
                    : currentTheme === 'dark'
                    ? 'bg-slate-900 text-white border-slate-600 hover:bg-slate-700'
                    : 'bg-[#FFFFFF] text-[#111827] border-[#D1D5DB] hover:bg-slate-100'
                }`}
                title={t('location.changeAddress')}
                aria-label={t('location.changeAddress')}
              >
                {userLocation.area === 'Location not set' || userLocation.city === 'Not set' ? (
                  <AlertTriangle className="w-6 h-6 text-amber-700 shrink-0" />
                ) : userLocation.isManualOverride ? (
                  <Edit3 className="w-6 h-6 text-blue-700 shrink-0" />
                ) : userLocation.isApproximate ? (
                  <AlertTriangle className="w-6 h-6 text-[#C2185B] shrink-0" />
                ) : (
                  <Navigation className="w-6 h-6 text-[#FF5A1F] animate-spin shrink-0" style={{ animationDuration: '6s' }} />
                )}

                <span className="truncate leading-tight font-bold">
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
                        <MapPin className="w-5 h-5 text-[#FF5A1F] shrink-0" />
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

                    {/* 1. Text Input (pre-filled & auto-focused) */}
                    <div>
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
                        className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl text-[18px] font-bold leading-snug focus:outline-none focus:ring-2 focus:ring-[#FF5A1F] transition-colors ${
                          currentTheme === 'high-contrast'
                            ? 'bg-black text-white placeholder-neutral-400 border-2 border-yellow-400'
                            : currentTheme === 'dark'
                            ? 'bg-slate-800 text-white placeholder-slate-400 border border-slate-600'
                            : 'bg-[#FFFFFF] text-[#111827] placeholder-slate-500 border-2 border-[#9CA3AF]'
                        }`}
                      />
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
                        <Loader2 className="w-5 h-5 animate-spin text-[#FF5A1F] shrink-0" />
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
                                  ? 'bg-[#FF5A1F] text-white border-[#FF5A1F]'
                                  : currentTheme === 'high-contrast'
                                  ? 'bg-black hover:bg-neutral-900 text-white border-yellow-400'
                                  : currentTheme === 'dark'
                                  ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-600'
                                  : 'bg-[#FFFFFF] hover:bg-slate-100 text-[#111827] border-[#D1D5DB]'
                              }`}
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <MapPin className={`w-5 h-5 shrink-0 ${isSelected ? 'text-white' : 'text-[#FF5A1F]'}`} />
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
                        <Loader2 className="w-5 h-5 animate-spin text-[#FF5A1F] shrink-0" />
                      ) : (
                        <Navigation className="w-5 h-5 text-[#FF5A1F] shrink-0" />
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
            className={`header-nav-group flex flex-wrap items-center justify-evenly gap-2 p-1.5 rounded-2xl min-w-0 ${pillGroupSurface}`}
          >
            {/* Search */}
            <button
              type="button"
              onClick={() => setActiveView('search')}
              className={`header-btn flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold leading-tight transition-all cursor-pointer ${
                activeView === 'search'
                  ? 'bg-[#FF5A1F] text-white shadow-sm'
                  : unselectedBtnClass
              }`}
              title={t('nav.search')}
              aria-label={t('nav.search')}
            >
              <Search className="w-6 h-6 shrink-0" />
              <span className="header-label-responsive">{t('nav.search')}</span>
            </button>

            {/* Track Live Order */}
            {activeLiveOrder && (
              <button
                type="button"
                onClick={() => setActiveView('tracking')}
                className={`header-btn flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold leading-tight transition-all cursor-pointer ${
                  activeView === 'tracking'
                    ? 'bg-[#16A34A] text-white shadow-md'
                    : 'bg-[#16A34A] hover:bg-[#15803D] text-white'
                }`}
                title="Track Order"
                aria-label="Track Order"
              >
                <Bike className="w-6 h-6 text-yellow-300 shrink-0" />
                <span className="header-label-responsive">Track Order</span>
              </button>
            )}

            {/* Auto Scheduler */}
            <button
              type="button"
              onClick={() => setActiveView('scheduler')}
              className={`header-btn flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold leading-tight transition-all cursor-pointer ${
                activeView === 'scheduler'
                  ? 'bg-[#FF5A1F] text-white shadow-sm'
                  : unselectedBtnClass
              }`}
              title={t('nav.schedule')}
              aria-label={t('nav.schedule')}
            >
              <Calendar className="w-6 h-6 shrink-0" />
              <span className="header-label-responsive">{t('nav.schedule')}</span>
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
              className={`header-btn flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold leading-tight transition-all cursor-pointer ${
                activeView === 'wallet'
                  ? 'bg-[#FF5A1F] text-white shadow-sm'
                  : unselectedBtnClass
              }`}
              title={isWalletRevealed ? `Wallet Balance: ₹${walletBalance.toFixed(0)}` : t('wallet.maskedLabel')}
              aria-label={isWalletRevealed ? `Wallet Balance: ₹${walletBalance.toFixed(0)}` : t('wallet.maskedLabel')}
            >
              {isWalletRevealed ? (
                <>
                  <Eye className="w-6 h-6 text-[#16A34A] shrink-0" />
                  <span className="font-bold">₹{walletBalance.toFixed(0)}</span>
                </>
              ) : (
                <>
                  <Lock className="w-6 h-6 text-amber-600 shrink-0" />
                  <span className="font-bold">{t('wallet.maskedLabel')}</span>
                </>
              )}
            </button>

            {/* Limit */}
            <button
              type="button"
              onClick={() => setIsLimitRenewalModalOpen(true)}
              className={`header-btn flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold leading-tight transition-all border cursor-pointer ${
                dailyOrderCount >= 6
                  ? 'bg-[#C2185B] text-white border-[#C2185B]'
                  : currentTheme === 'high-contrast'
                  ? 'bg-black hover:bg-neutral-900 text-white border-yellow-400'
                  : currentTheme === 'dark'
                  ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-600'
                  : 'bg-[#FFFFFF] hover:bg-slate-100 text-[#111827] border-[#D1D5DB]'
              }`}
              title={`Daily Limit: ${dailyOrderCount}/6`}
              aria-label={`Daily Limit: ${dailyOrderCount}/6`}
            >
              <PackageCheck className={`w-6 h-6 shrink-0 ${dailyOrderCount >= 6 ? 'text-white' : 'text-[#FF5A1F]'}`} />
              <span className="font-bold"><span className="header-label-responsive">Limit: </span>{dailyOrderCount}/6</span>
            </button>

            {/* Nominee Control Portal */}
            <a
              href="/nominee"
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState(null, '', '/nominee');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className={`header-btn flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold leading-tight transition-all border cursor-pointer relative ${
                currentTheme === 'high-contrast'
                  ? 'bg-black hover:bg-neutral-900 text-white border-yellow-400'
                  : currentTheme === 'dark'
                  ? 'bg-slate-800 hover:bg-slate-700 text-white border-amber-400'
                  : 'bg-[#FFFFFF] hover:bg-amber-50 text-[#111827] border-amber-500'
              }`}
              title="Nominee Control Portal"
              aria-label="Nominee Control Portal"
            >
              <ShieldCheck className="w-6 h-6 shrink-0 text-amber-600" />
              <span className="header-label-responsive">Nominee</span>
              {pendingNomineeApprovals.filter(r => r.status === 'pending').length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {pendingNomineeApprovals.filter(r => r.status === 'pending').length}
                </span>
              )}
            </a>

            {/* Order History */}
            <button
              type="button"
              onClick={() => setActiveView('orders')}
              className={`header-btn flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold leading-tight transition-all cursor-pointer ${
                activeView === 'orders'
                  ? 'bg-[#FF5A1F] text-white shadow-sm'
                  : unselectedBtnClass
              }`}
              title={t('nav.orders')}
              aria-label={t('nav.orders')}
            >
              <History className="w-6 h-6 shrink-0" />
              <span className="header-label-responsive">{t('nav.orders')}</span>
            </button>

            {/* Shared Cart */}
            {(() => {
              const totalCartCount = cart.reduce((sum, i) => sum + (i.qty || (i as any).quantity || 1), 0);
              return (
                <button
                  type="button"
                  onClick={() => setIsScheduleCartModalOpen(true)}
                  className={`header-btn flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold leading-tight transition-all cursor-pointer border relative ${
                    currentTheme === 'high-contrast'
                      ? 'bg-black hover:bg-neutral-900 text-white border-yellow-400'
                      : currentTheme === 'dark'
                      ? 'bg-slate-800 hover:bg-slate-700 text-white border-amber-400'
                      : 'bg-[#FFFFFF] hover:bg-amber-50 text-[#111827] border-amber-500'
                  }`}
                  title={t('cartTitle')}
                  aria-label={t('cartTitle')}
                >
                  <ShoppingBag className="w-6 h-6 shrink-0 text-[#FF5A1F]" />
                  <span className="header-label-responsive">{t('cartTitle')}</span>
                  {totalCartCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-[#FF5A1F] text-white text-xs font-bold flex items-center justify-center shrink-0 min-w-[1.5rem] min-h-[1.5rem]">
                      {totalCartCount}
                    </span>
                  )}
                </button>
              );
            })()}
          </nav>

          {/* ACTION BUTTONS (USER PROFILE, VOICE SEARCH, HEALTHY FOOD, THEME, LOGOUT) */}
          <div className={`header-actions-group flex flex-wrap items-center justify-evenly gap-2 p-1.5 rounded-2xl min-w-0 ${pillGroupSurface}`}>
            
            {/* User Profile / Sign In */}
            {currentUser ? (
              <div
                className={`header-chip flex-1 flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border min-w-0 ${
                  currentTheme === 'high-contrast'
                    ? 'bg-black text-white border-yellow-400'
                    : currentTheme === 'dark'
                    ? 'bg-slate-900 text-white border-slate-600'
                    : 'bg-[#FFFFFF] text-[#111827] border-[#D1D5DB]'
                }`}
                title={`Signed in as ${currentUser.name}`}
              >
                <div className="p-1.5 bg-[#FF5A1F] rounded-lg text-white shrink-0">
                  <ShieldCheck className="w-5 h-5 text-white" />
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
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-[#FF5A1F] transition-colors cursor-pointer shrink-0"
                  title="Link Face ID (WebAuthn)"
                  aria-label="Link Face ID"
                >
                  <Scan className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthGateOpen(true)}
                className="header-btn flex-1 flex items-center justify-center gap-2 bg-[#FF5A1F] text-white font-bold px-3.5 py-2.5 rounded-xl shadow-sm hover:bg-[#E04812] cursor-pointer"
                title="Sign In"
                aria-label="Sign In"
              >
                <LogIn className="w-6 h-6 shrink-0" />
                <span className="header-label-responsive">Sign In</span>
              </button>
            )}

            {/* Voice Assistant Mic Button */}
            <button
              type="button"
              onClick={() => setIsVoiceModalOpen(true)}
              className="header-btn flex-1 flex items-center justify-center gap-2 bg-[#FF5A1F] hover:bg-[#E04812] text-white font-bold px-3.5 py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer"
              title={t('search.voice')}
              aria-label={t('search.voice')}
            >
              <Mic className="w-6 h-6 text-white shrink-0" />
              <span className="header-label-responsive leading-tight">{t('search.voice')}</span>
            </button>

            {/* Healthy Food Guide */}
            <button
              type="button"
              onClick={() => setIsHealthModalOpen(true)}
              className="header-btn flex-1 flex items-center justify-center gap-2 bg-[#C2185B] hover:bg-[#A3134C] text-white font-bold px-3.5 py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer border border-[#C2185B]"
              title={t('nav.healthyFood')}
              aria-label={t('nav.healthyFood')}
            >
              <HeartPulse className="w-6 h-6 text-yellow-300 shrink-0" />
              <span className="header-label-responsive leading-tight">{t('nav.healthyFood')}</span>
            </button>

            {/* Theme Selector */}
            <div
              className={`flex items-center gap-1.5 p-1 rounded-xl border shrink-0 ${
                currentTheme === 'high-contrast'
                  ? 'bg-black border-yellow-400'
                  : currentTheme === 'dark'
                  ? 'bg-slate-900 border-slate-600'
                  : 'bg-[#FFFFFF] border-[#D1D5DB]'
              }`}
            >
              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`header-btn px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                  currentTheme === 'light'
                    ? 'bg-[#FF5A1F] text-white shadow-xs'
                    : currentTheme === 'dark'
                    ? 'text-slate-200 hover:bg-slate-800'
                    : 'text-white hover:bg-neutral-900'
                }`}
                title="Light Theme"
                aria-label="Light Theme"
              >
                <Sun className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`header-btn px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                  currentTheme === 'dark'
                    ? 'bg-[#FF5A1F] text-white shadow-xs'
                    : currentTheme === 'light'
                    ? 'text-[#111827] hover:bg-slate-100'
                    : 'text-white hover:bg-neutral-900'
                }`}
                title="Dark Theme"
                aria-label="Dark Theme"
              >
                <Moon className="w-6 h-6" />
              </button>
            </div>

            {/* Logout */}
            <button
              type="button"
              onClick={logout}
              className="header-btn px-3.5 py-2.5 bg-[#C2185B] hover:bg-[#A3134C] text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="w-6 h-6 text-white shrink-0" />
              <span className="header-label-responsive">Logout</span>
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
