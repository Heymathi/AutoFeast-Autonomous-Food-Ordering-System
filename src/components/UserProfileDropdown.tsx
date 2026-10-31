import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  User,
  Sliders,
  Building2,
  HeartPulse,
  ShieldAlert,
  LogOut,
  ChevronDown,
  CheckCircle2,
  Wallet
} from 'lucide-react';
import { UserDetailsModal } from './UserDetailsModal';

interface UserProfileDropdownProps {
  onNavigateFeatures?: () => void;
}

export const UserProfileDropdown: React.FC<UserProfileDropdownProps> = ({ onNavigateFeatures }) => {
  const {
    currentUser,
    logout,
    linkedBank,
    walletBalance,
    setIsHealthModalOpen,
    setIsNomineeModalOpen,
    setActiveView,
    accessibilitySettings,
    t
  } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const [isUserDetailsOpen, setIsUserDetailsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const currentTheme =
    accessibilitySettings.themeMode ||
    (accessibilitySettings.highContrast ? 'high-contrast' : 'light');

  const displayName = currentUser?.name || 'My Account';
  const displayInitial = currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U';

  const handleOpenUserDetails = () => {
    setIsOpen(false);
    setIsUserDetailsOpen(true);
  };

  const handleOpenPreferences = () => {
    setIsOpen(false);
    if (onNavigateFeatures) {
      onNavigateFeatures();
    } else {
      setActiveView('features');
    }
  };

  const handleOpenBankDetails = () => {
    setIsOpen(false);
    setActiveView('wallet');
  };

  const handleOpenHealthConditions = () => {
    setIsOpen(false);
    setIsHealthModalOpen(true);
  };

  const handleOpenNominee = () => {
    setIsOpen(false);
    setIsNomineeModalOpen(true);
  };

  const handleLogout = () => {
    setIsOpen(false);
    if (window.confirm(t('profile.logoutConfirm') || 'Are you sure you want to log out?')) {
      logout();
    }
  };

  return (
    <div ref={dropdownRef} className="relative inline-block text-left">
      {/* Profile Toggle Button (Navbar Right Side) */}
      <button
        type="button"
        id="user-profile-menu-button"
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
          currentTheme === 'high-contrast'
            ? 'bg-black text-white border-2 border-yellow-400'
            : currentTheme === 'dark'
            ? 'bg-zinc-800 text-zinc-100 border-zinc-700 hover:bg-zinc-700'
            : 'bg-[#FAF7F2] hover:bg-[#F3EDE4]/60 text-[#302720] border-[#E5DDD2]'
        }`}
      >
        {/* User Initials Avatar with Emerald Accent */}
        <div className="w-7 h-7 rounded-full bg-[#B85C38] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
          {displayInitial}
        </div>

        <span className="max-w-[110px] sm:max-w-[140px] truncate leading-tight font-medium">
          {displayName}
        </span>

        <ChevronDown
          className={`w-4 h-4 text-[#786E64] transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu Panel */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="user-profile-menu-button"
          className={`absolute right-0 mt-2 w-72 sm:w-80 rounded-xl shadow-xl border z-50 overflow-hidden transition-all animate-fade-in ${
            currentTheme === 'high-contrast'
              ? 'bg-black text-white border-2 border-yellow-400'
              : currentTheme === 'dark'
              ? 'bg-zinc-900 text-zinc-100 border-zinc-800'
              : 'bg-white text-[#302720] border-[#E5DDD2]'
          }`}
        >
          {/* Dropdown Header: User info summary */}
          <div className="p-4 bg-[#FAF7F2] border-b border-[#E5DDD2]">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-[#B85C38] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                {displayInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#302720] truncate">{displayName}</p>
                <p className="text-xs text-[#786E64] truncate">{currentUser?.email || 'user@autofeast.ai'}</p>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4F8964] mt-0.5">
                  <CheckCircle2 className="w-3 h-3" /> Verified Member
                </span>
              </div>
            </div>
          </div>

          {/* Menu Items List */}
          <div className="py-1 text-xs sm:text-sm divide-y divide-[#E5DDD2]/60">
            {/* 1. User Details */}
            <button
              type="button"
              role="menuitem"
              onClick={handleOpenUserDetails}
              className="w-full flex items-center px-4 py-3 text-left hover:bg-[#FAF7F2] transition-colors group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-[#FAF7F2] group-hover:bg-[#F3EDE4] text-[#B85C38] flex items-center justify-center mr-3 shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#302720] group-hover:text-[#B85C38]">
                  {t('profile.userDetails')}
                </p>
                <p className="text-[11px] text-[#786E64] truncate">Personal information, address & phone</p>
              </div>
            </button>

            {/* 2. Features / Preferences */}
            <button
              type="button"
              role="menuitem"
              onClick={handleOpenPreferences}
              className="w-full flex items-center px-4 py-3 text-left hover:bg-[#FAF7F2] transition-colors group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-[#FAF7F2] group-hover:bg-[#F3EDE4] text-[#B85C38] flex items-center justify-center mr-3 shrink-0">
                <Sliders className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#302720] group-hover:text-[#B85C38]">
                  {t('profile.preferences')}
                </p>
                <p className="text-[11px] text-[#786E64] truncate">Language, Theme, Font size & Controls</p>
              </div>
            </button>

            {/* 3. Linked Bank Account Details */}
            <button
              type="button"
              role="menuitem"
              onClick={handleOpenBankDetails}
              className="w-full flex items-center px-4 py-3 text-left hover:bg-[#FAF7F2] transition-colors group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-[#FAF7F2] group-hover:bg-[#F3EDE4] text-[#B85C38] flex items-center justify-center mr-3 shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[#302720] group-hover:text-[#B85C38]">
                    {t('profile.bankAccount')}
                  </p>
                  <span className="text-[11px] font-bold text-[#B85C38] bg-[#F3EDE4] px-1.5 py-0.5 rounded-sm">
                    ₹{walletBalance.toFixed(0)}
                  </span>
                </div>
                <p className="text-[11px] text-[#786E64] truncate">
                  {linkedBank?.bankName || 'HDFC Bank'} • {linkedBank?.accountNumber ? `•••• ${linkedBank.accountNumber.slice(-4)}` : '•••• 4821'}
                </p>
              </div>
            </button>

            {/* 4. Health Condition Details */}
            <button
              type="button"
              role="menuitem"
              onClick={handleOpenHealthConditions}
              className="w-full flex items-center px-4 py-3 text-left hover:bg-[#FAF7F2] transition-colors group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-[#FAF7F2] group-hover:bg-[#F3EDE4] text-[#B85C38] flex items-center justify-center mr-3 shrink-0">
                <HeartPulse className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#302720] group-hover:text-[#B85C38]">
                  {t('profile.healthConditions')}
                </p>
                <p className="text-[11px] text-[#786E64] truncate">Dietary restrictions, allergies & wellness guide</p>
              </div>
            </button>

            {/* 5. Nominee Details */}
            <button
              type="button"
              role="menuitem"
              onClick={handleOpenNominee}
              className="w-full flex items-center px-4 py-3 text-left hover:bg-[#FAF7F2] transition-colors group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-[#FAF7F2] group-hover:bg-[#F3EDE4] text-[#B85C38] flex items-center justify-center mr-3 shrink-0">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#302720] group-hover:text-[#B85C38]">
                  {t('profile.nomineeDetails')}
                </p>
                <p className="text-[11px] text-[#786E64] truncate">
                  {currentUser?.nomineeName ? `Guardian: ${currentUser.nomineeName}` : 'Approval & food safety restrictions'}
                </p>
              </div>
            </button>

            {/* 6. Logout */}
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-3 text-left hover:bg-[#FAF7F2] text-[#302720] transition-colors group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-[#F3EDE4] group-hover:bg-[#F3EDE4] text-[#302720] flex items-center justify-center mr-3 shrink-0">
                <LogOut className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{t('profile.logout')}</p>
                <p className="text-[11px] text-rose-500 truncate">Sign out of your session</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      <UserDetailsModal
        isOpen={isUserDetailsOpen}
        onClose={() => setIsUserDetailsOpen(false)}
      />
    </div>
  );
};

