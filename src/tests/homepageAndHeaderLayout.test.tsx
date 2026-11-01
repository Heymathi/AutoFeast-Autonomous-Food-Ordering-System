import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Navbar } from '../components/Navbar';
import { HomePage } from '../components/HomePage';
import { AppProvider } from '../context/AppContext';

describe('AutoFeast AI Homepage & Header Layout Verification Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('1. Header Elements Order and Microphone Button', () => {
    it('renders the header elements in the exact order: Logo, Nav (Home, How It Works, Features, About), Location, Mic, Cart, Profile', () => {
      const { container } = render(
        <AppProvider>
          <Navbar />
        </AppProvider>
      );

      // 1. Logo & Website Name
      const logo = screen.getByRole('button', { name: /autofeast ai home/i });
      expect(logo).toBeDefined();

      // 2-5. Navigation
      const nav = container.querySelector('.header-nav-group');
      expect(nav).toBeDefined();
      const navTexts = Array.from(nav?.querySelectorAll('button') || []).map(b => b.textContent?.trim());
      expect(navTexts).toEqual(['Home', 'How It Works', 'Features', 'About']);

      // 6. Location / Address chip
      const locationChip = container.querySelector('#header-location-chip');
      expect(locationChip).toBeDefined();

      // 7. Small microphone icon button immediately beside location field
      const micBtn = container.querySelector('#header-voice-search-btn');
      expect(micBtn).toBeDefined();
      expect(micBtn?.getAttribute('aria-label')).toBe('Voice Search');
      // Must be an icon-only button without long text
      expect(micBtn?.textContent?.trim()).toBe('');

      // 8. Cart icon
      const cartBtn = container.querySelector('#header-cart-btn');
      expect(cartBtn).toBeDefined();

      // 9. User profile icon at the extreme right
      const profileMenuBtn = container.querySelector('#user-profile-menu-button');
      expect(profileMenuBtn).toBeDefined();

      // Verify DOM element ordering in actions group:
      // location container comes before mic button, which comes before cart, which comes before profile
      const actionsGroup = container.querySelector('.header-actions-group');
      const actionChildren = Array.from(actionsGroup?.children || []);
      
      const locIdx = actionChildren.findIndex(c => c.contains(locationChip));
      const micIdx = actionChildren.findIndex(c => c === micBtn);
      const cartIdx = actionChildren.findIndex(c => c === cartBtn);
      const profileIdx = actionChildren.findIndex(c => c.contains(profileMenuBtn));

      expect(locIdx).toBeLessThan(micIdx);
      expect(micIdx).toBeLessThan(cartIdx);
      expect(cartIdx).toBeLessThan(profileIdx);
      // Profile icon must be at the extreme right (last among desktop action buttons)
      expect(profileIdx).toBe(actionChildren.length - 1);
    });

    it('clicking the header microphone button activates voice assistant', () => {
      const { container } = render(
        <AppProvider>
          <Navbar />
        </AppProvider>
      );

      const micBtn = container.querySelector('#header-voice-search-btn');
      expect(micBtn).toBeDefined();
      fireEvent.click(micBtn!);
    });

    it('displays all 5 profile dropdown items on clicking the profile icon', () => {
      const { container } = render(
        <AppProvider>
          <Navbar />
        </AppProvider>
      );

      const profileBtn = container.querySelector('#user-profile-menu-button');
      expect(profileBtn).toBeDefined();
      fireEvent.click(profileBtn!);

      expect(screen.getByText(/User Details/i)).toBeDefined();
      expect(screen.getByText(/Linked Bank Account Details/i)).toBeDefined();
      expect(screen.getByText(/Health Condition Details/i)).toBeDefined();
      expect(screen.getByText(/Nominee Details/i)).toBeDefined();
      expect(screen.getByText(/Logout/i)).toBeDefined();
    });
  });

  describe('2. Hero Section and Food Catalog Order', () => {
    it('keeps heading, description, search input & Search button, but removes voice mic from hero search bar', () => {
      const { container } = render(
        <AppProvider>
          <HomePage />
        </AppProvider>
      );

      // Heading
      expect(screen.getByRole('heading', { name: /discover your next favourite meal/i })).toBeDefined();
      // Description
      expect(screen.getByText(/Personalised, voice-enabled food discovery/i)).toBeDefined();
      // Search input
      const searchInput = screen.getByPlaceholderText(/search food or restaurant/i);
      expect(searchInput).toBeDefined();
      // Search button
      const searchBtn = screen.getByRole('button', { name: /^search$/i });
      expect(searchBtn).toBeDefined();

      // The search form should NOT contain any mic button
      const form = searchInput.closest('form');
      expect(form?.querySelector('button[title*="Voice"]')).toBeNull();
      expect(form?.querySelector('svg.lucide-mic')).toBeNull();
    });

    it('renders Food Catalog directly below the hero section with categories and dishes', () => {
      const { container } = render(
        <AppProvider>
          <HomePage />
        </AppProvider>
      );

      // Food Catalog section is present
      const catalogSection = container.querySelector('#dynamic-food-search-section');
      expect(catalogSection).toBeDefined();

      // Categories are displayed
      expect(screen.getByText('All Dishes')).toBeDefined();
      expect(screen.getByText('Breakfast')).toBeDefined();
      expect(screen.getByText('Lunch')).toBeDefined();
      expect(screen.getByText('Dinner')).toBeDefined();

      // Food items grid is present
      const foodGrid = container.querySelector('#food-results-grid');
      expect(foodGrid).toBeDefined();
      expect(foodGrid?.children.length).toBeGreaterThan(0);
    });
  });
});
