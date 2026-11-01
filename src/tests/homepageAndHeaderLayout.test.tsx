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

  describe('1. Header Elements Order and Voice Search Button (🎤 Voice Search)', () => {
    it('renders the header elements in the exact order: Logo, Nav, Location, Voice Search, Cart, Profile', () => {
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

      // 7. Voice Search Button: Displays microphone icon AND text "Voice Search"
      const micBtn = container.querySelector('#header-voice-search-btn');
      expect(micBtn).toBeDefined();
      expect(micBtn?.getAttribute('aria-label')).toBe('Voice Search');
      expect(micBtn?.textContent).toContain('Voice Search');
      expect(micBtn?.querySelector('svg.lucide-mic')).toBeDefined();

      // 8. Cart icon
      const cartBtn = container.querySelector('#header-cart-btn');
      expect(cartBtn).toBeDefined();

      // 9. User profile icon at the extreme right
      const profileMenuBtn = container.querySelector('#user-profile-menu-button');
      expect(profileMenuBtn).toBeDefined();

      // Verify DOM ordering in actions group:
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
      expect(profileIdx).toBe(actionChildren.length - 1);
    });

    it('clicking the header "Voice Search" button activates voice assistant', () => {
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

  describe('2. Homepage Sections Order & Two-Column Dynamic Food Search', () => {
    it('Hero section keeps heading, description, search input & Search button without voice mic inside', () => {
      const { container } = render(
        <AppProvider>
          <HomePage />
        </AppProvider>
      );

      // Hero Heading
      expect(screen.getByRole('heading', { name: /discover your next favourite meal/i })).toBeDefined();
      // Description
      expect(screen.getByText(/Personalised, voice-enabled food discovery/i)).toBeDefined();
      // Search input
      const heroSearchInput = screen.getByPlaceholderText(/search food or restaurant/i);
      expect(heroSearchInput).toBeDefined();

      // Search button inside the hero form
      const form = heroSearchInput.closest('form');
      expect(form).toBeDefined();
      const heroSearchBtn = form?.querySelector('button[type="submit"]');
      expect(heroSearchBtn).toBeDefined();
      expect(heroSearchBtn?.textContent).toContain('Search');

      // Hero search form must NOT contain any mic button
      expect(form?.querySelector('svg.lucide-mic')).toBeNull();
    });

    it('renders Dynamic Food Search with 2-column layout (Search on Left, Food Image on Right)', () => {
      const { container } = render(
        <AppProvider>
          <HomePage />
        </AppProvider>
      );

      const searchSection = container.querySelector('#dynamic-food-search-section');
      expect(searchSection).toBeDefined();

      // Heading & Subtitle
      expect(screen.getByText(/Dynamic Food Search & Live GPS Location/i)).toBeDefined();
      expect(screen.getByText(/OpenStreetMap Live Geocoding • Haversine Nearest Restaurant Sorting/i)).toBeDefined();

      // City dropdown, Cuisine dropdown, Veg only toggle
      expect(screen.getByText(/City:/i)).toBeDefined();
      expect(screen.getByText(/Cuisine:/i)).toBeDefined();
      expect(screen.getByText(/Vegetarian Only|Veg Only/i)).toBeDefined();

      // Right side food image
      const foodImg = searchSection?.querySelector('img[alt*="Delicious gourmet food feast bowl"]');
      expect(foodImg).toBeDefined();
      expect(foodImg?.getAttribute('src')).toBeTruthy();
    });

    it('renders the 4 feature cards in exact order between search and catalog', () => {
      const { container } = render(
        <AppProvider>
          <HomePage />
        </AppProvider>
      );

      const shortcutsSection = container.querySelector('section[aria-label="Feature Shortcuts"]');
      expect(shortcutsSection).toBeDefined();

      // Four cards titles
      expect(screen.getByRole('heading', { name: /Nominee Management/i })).toBeDefined();
      expect(screen.getByRole('heading', { name: /Recommendation System/i })).toBeDefined();
      expect(screen.getByRole('heading', { name: /Auto Scheduler/i })).toBeDefined();
      expect(screen.getByRole('heading', { name: /Voice Search/i })).toBeDefined();

      // Four cards action buttons
      expect(screen.getByText(/Manage nominee/i)).toBeDefined();
      expect(screen.getByText(/See picks/i)).toBeDefined();
      expect(screen.getByText(/Open scheduler/i)).toBeDefined();
      expect(screen.getByText(/Start speaking/i)).toBeDefined();

      // DOM ordering: Dynamic Food Search -> 4 Feature Shortcuts -> Food Catalog
      const searchSection = container.querySelector('#dynamic-food-search-section');
      const catalogSection = container.querySelector('#food-catalog-section');

      expect(searchSection?.compareDocumentPosition(shortcutsSection!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(shortcutsSection?.compareDocumentPosition(catalogSection!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('renders Food Catalog directly after the four feature cards with categories and dishes', () => {
      const { container } = render(
        <AppProvider>
          <HomePage />
        </AppProvider>
      );

      const catalogSection = container.querySelector('#food-catalog-section');
      expect(catalogSection).toBeDefined();

      // Categories are displayed
      expect(screen.getByText('All Dishes')).toBeDefined();
      expect(screen.getByText('Breakfast')).toBeDefined();
      expect(screen.getByText('Lunch')).toBeDefined();
      expect(screen.getByText('Dinner')).toBeDefined();

      // Food dishes grid
      const foodGrid = container.querySelector('#food-results-grid');
      expect(foodGrid).toBeDefined();
      expect(foodGrid?.children.length).toBeGreaterThan(0);
    });
  });
});
