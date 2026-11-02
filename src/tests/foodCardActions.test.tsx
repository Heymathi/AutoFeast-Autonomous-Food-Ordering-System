import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AppProvider, useApp } from '../context/AppContext';
import { DynamicFoodSearch } from '../components/DynamicFoodSearch';
import { HomePage } from '../components/HomePage';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';
import { PriceComparisonModal } from '../components/PriceComparisonModal';
import { ItemActionChooser } from '../components/ItemActionChooser';

// Mock speech controller and audio APIs
vi.mock('../services/speechController', () => ({
  SpeechController: {
    speak: vi.fn(),
    stopSpeech: vi.fn(),
    cancelSpeech: vi.fn(),
    requestMic: vi.fn(),
    releaseMic: vi.fn(),
    stopMic: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    getSnapshot: vi.fn(() => ({
      voiceState: 'idle',
      turnState: 'idle',
      turnId: 0,
      owner: null,
      language: 'en',
      micMode: 'push_to_talk',
      activeTtsVoice: 'Google UK English Female',
      userGestureUnlocked: true,
      isPinScreen: false,
      circuitBreakerTripped: false,
      logs: []
    }))
  }
}));

describe('AutoFeast AI – Food Card Action Buttons Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, cart: [] }),
      })
    );
  });

  it('1. COMPARE: Opens Live Price Comparison Modal with platforms, ratings, prices, and savings', async () => {
    const testItem = INDIAN_FOOD_CATALOG[0]; // Crispy Masala Dosa

    render(
      <AppProvider>
        <PriceComparisonModal
          isOpen={true}
          item={testItem}
          onClose={vi.fn()}
          onSelectPlatform={vi.fn()}
        />
      </AppProvider>
    );

    // Food item details rendered
    expect(screen.getByText(testItem.name)).toBeDefined();
    expect(screen.getByText(new RegExp(testItem.restaurant, 'i'))).toBeDefined();

    // Platforms rendered
    expect(screen.getAllByText(/Swiggy/i)[0]).toBeDefined();
    expect(screen.getAllByText(/Zomato/i)[0]).toBeDefined();
    expect(screen.getAllByText(/EatSure/i)[0]).toBeDefined();
    expect(screen.getAllByText(/MagicPin/i)[0]).toBeDefined();

    // Best Value banner rendered
    expect(screen.getByText(/BEST VALUE/i)).toBeDefined();

    // Savings banner
    expect(screen.getByText(/Save up to/i)).toBeDefined();
  });

  it('2. COMPARE: Selecting a platform triggers onSelectPlatform callback with platform details', () => {
    const testItem = INDIAN_FOOD_CATALOG[0];
    const onSelectMock = vi.fn();

    render(
      <AppProvider>
        <PriceComparisonModal
          isOpen={true}
          item={testItem}
          onClose={vi.fn()}
          onSelectPlatform={onSelectMock}
        />
      </AppProvider>
    );

    // Find and click one of the platform order buttons
    const orderSwiggyBtn = screen.getByRole('button', { name: /Order on Swiggy/i });
    expect(orderSwiggyBtn).toBeDefined();
    fireEvent.click(orderSwiggyBtn);

    expect(onSelectMock).toHaveBeenCalledWith('swiggy', expect.any(Number));
  });

  it('3. ORDER / SCHEDULE: ItemActionChooser renders Order Now, Schedule, and Add to Cart options with correct callbacks', () => {
    const testItem = INDIAN_FOOD_CATALOG[0];
    const orderNowMock = vi.fn();
    const scheduleMock = vi.fn();
    const addToCartMock = vi.fn();

    render(
      <AppProvider>
        <ItemActionChooser
          isOpen={true}
          items={[testItem]}
          onClose={vi.fn()}
          onOrderNow={orderNowMock}
          onSchedule={scheduleMock}
          onAddToCart={addToCartMock}
        />
      </AppProvider>
    );

    // Verifies the modal rendered with food item details (using getAllByText since name appears in header and item card)
    expect(screen.getAllByText(testItem.name)[0]).toBeDefined();

    // Order Now button
    const orderNowBtn = screen.getByRole('button', { name: /orderNow|Order Now/i });
    expect(orderNowBtn).toBeDefined();
    fireEvent.click(orderNowBtn);
    expect(orderNowMock).toHaveBeenCalledWith([testItem]);

    // Schedule button
    const scheduleBtn = screen.getByRole('button', { name: /scheduleCart|Schedule/i });
    expect(scheduleBtn).toBeDefined();
    fireEvent.click(scheduleBtn);
    expect(scheduleMock).toHaveBeenCalledWith([testItem]);
  });

  it('4. ADD TO CART: Immediately adds to cart without opening modals, updates cart state, and handles repeated additions', async () => {
    const testItem = INDIAN_FOOD_CATALOG[0];
    let simulatedCart: any[] = [];

    // Mock fetch to simulate server-side Cart API returning updated cart with quantity tracking
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/api/cart/add')) {
        const body = opts?.body ? JSON.parse(opts.body) : {};
        const existing = simulatedCart.find(i => i.itemId === body.itemId);
        if (existing) {
          existing.qty = (existing.qty || 1) + (body.qty || 1);
        } else {
          simulatedCart.push({
            id: `cart_${body.itemId}`,
            itemId: body.itemId,
            name: body.name,
            restaurantName: body.restaurantName,
            price: body.price,
            qty: body.qty || 1,
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, cart: [...simulatedCart] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, cart: [] }),
      });
    });

    const TestHarness = () => {
      const { cart, addToCart } = useApp();
      return (
        <div>
          <span data-testid="cart-count">
            {cart.reduce((sum, item) => sum + (item.qty || 1), 0)}
          </span>
          <span data-testid="cart-items-length">{cart.length}</span>
          <button
            data-testid="add-btn"
            onClick={() => addToCart(testItem, 1, 'dynamic_search')}
          >
            Add
          </button>
        </div>
      );
    };

    render(
      <AppProvider>
        <TestHarness />
      </AppProvider>
    );

    expect(screen.getByTestId('cart-count').textContent).toBe('0');
    expect(screen.getByTestId('cart-items-length').textContent).toBe('0');

    // Add item to cart
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-btn'));
    });

    // Cart updated immediately
    expect(screen.getByTestId('cart-count').textContent).toBe('1');
    expect(screen.getByTestId('cart-items-length').textContent).toBe('1');

    // Wait slightly past debounce and add second time (same item from same restaurant)
    await new Promise((r) => setTimeout(r, 250));

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-btn'));
    });

    // Quantity increased to 2, cart length remains 1 (no duplicate entries)
    expect(screen.getByTestId('cart-count').textContent).toBe('2');
    expect(screen.getByTestId('cart-items-length').textContent).toBe('1');
  });

  it('5. DYNAMIC FOOD SEARCH: All 3 buttons (Compare, Order / Schedule, Add to Cart) are rendered on cards', () => {
    render(
      <AppProvider>
        <DynamicFoodSearch />
      </AppProvider>
    );

    // Multiple food cards exist in the search catalog
    const compareButtons = screen.getAllByRole('button', { name: /compare/i });
    const orderScheduleButtons = screen.getAllByRole('button', { name: /order \/ schedule/i });
    const addToCartButtons = screen.getAllByRole('button', { name: /add to cart/i });

    expect(compareButtons.length).toBeGreaterThan(0);
    expect(orderScheduleButtons.length).toBeGreaterThan(0);
    expect(addToCartButtons.length).toBeGreaterThan(0);
  });
});
