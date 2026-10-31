import React from 'react';
import { useApp } from '../context/AppContext';
import { User, Mail, Phone, MapPin, Shield, Fingerprint, Calendar, X, Edit3 } from 'lucide-react';

interface UserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserDetailsModal: React.FC<UserDetailsModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, userLocation, setIsLocationModalOpen, t, accessibilitySettings } = useApp();

  if (!isOpen) return null;

  const currentTheme =
    accessibilitySettings.themeMode ||
    (accessibilitySettings.highContrast ? 'high-contrast' : 'light');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-details-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg rounded-2xl p-6 sm:p-8 shadow-2xl border transition-all ${
          currentTheme === 'high-contrast'
            ? 'bg-black text-white border-2 border-yellow-400'
            : currentTheme === 'dark'
            ? 'bg-zinc-900 text-zinc-100 border-zinc-800'
            : 'bg-white text-[#242B27] border-[#E4EBE5]'
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E4EBE5]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#DFF3E8] text-[#087F5B] flex items-center justify-center font-bold text-lg">
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <h2 id="user-details-title" className="text-lg font-bold text-[#064E3B]">
                {t('profile.userDetails')}
              </h2>
              <p className="text-xs text-[#707B73]">AutoFeast AI Verified Account</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg text-[#707B73] hover:text-[#242B27] hover:bg-[#EFF7F1] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Information Grid */}
        <div className="py-5 space-y-4 text-sm">
          {/* Full Name */}
          <div className="flex items-start space-x-3 p-3 rounded-xl bg-[#F7FAF8] border border-[#E4EBE5]">
            <User className="w-5 h-5 text-[#087F5B] mt-0.5 shrink-0" />
            <div className="flex-1">
              <span className="text-xs text-[#707B73] block font-medium">Full Name</span>
              <span className="font-semibold text-[#242B27]">{currentUser?.name || 'Authorized User'}</span>
            </div>
          </div>

          {/* Email Address */}
          <div className="flex items-start space-x-3 p-3 rounded-xl bg-[#F7FAF8] border border-[#E4EBE5]">
            <Mail className="w-5 h-5 text-[#087F5B] mt-0.5 shrink-0" />
            <div className="flex-1">
              <span className="text-xs text-[#707B73] block font-medium">Email Address</span>
              <span className="font-semibold text-[#242B27]">{currentUser?.email || 'user@autofeast.ai'}</span>
            </div>
          </div>

          {/* Phone */}
          <div className="flex items-start space-x-3 p-3 rounded-xl bg-[#F7FAF8] border border-[#E4EBE5]">
            <Phone className="w-5 h-5 text-[#087F5B] mt-0.5 shrink-0" />
            <div className="flex-1">
              <span className="text-xs text-[#707B73] block font-medium">Registered Phone</span>
              <span className="font-semibold text-[#242B27]">{currentUser?.nomineePhone ? `+91 98*** ${currentUser.nomineePhone.slice(-4)}` : '+91 98765 43210'}</span>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="flex items-start justify-between p-3 rounded-xl bg-[#F7FAF8] border border-[#E4EBE5]">
            <div className="flex items-start space-x-3">
              <MapPin className="w-5 h-5 text-[#087F5B] mt-0.5 shrink-0" />
              <div>
                <span className="text-xs text-[#707B73] block font-medium">Delivery Address</span>
                <span className="font-semibold text-[#242B27]">
                  {userLocation.area === 'Location not set'
                    ? 'Location not set'
                    : `${userLocation.area}, ${userLocation.city}`}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                setIsLocationModalOpen(true);
              }}
              className="px-2.5 py-1 text-xs font-semibold text-[#087F5B] hover:bg-[#DFF3E8] rounded-md transition-colors flex items-center gap-1 shrink-0"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Change</span>
            </button>
          </div>

          {/* Security & Authentication Badges */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-[#DFF3E8]/50 border border-[#E4EBE5] flex items-center space-x-2.5">
              <Shield className="w-4 h-4 text-[#087F5B]" />
              <div>
                <span className="text-[11px] text-[#707B73] block">Security PIN</span>
                <span className="text-xs font-bold text-[#064E3B]">4-Digit Protected</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#DFF3E8]/50 border border-[#E4EBE5] flex items-center space-x-2.5">
              <Fingerprint className="w-4 h-4 text-[#087F5B]" />
              <div>
                <span className="text-[11px] text-[#707B73] block">Biometrics / Face ID</span>
                <span className="text-xs font-bold text-[#064E3B]">
                  {currentUser?.isFaceIdEnabled ? 'WebAuthn Enabled' : 'Available'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#E4EBE5] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg bg-[#087F5B] hover:bg-[#064E3B] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
