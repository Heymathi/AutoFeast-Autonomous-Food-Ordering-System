import { describe, test, expect } from 'vitest';
import { groupCartByRestaurant, validateCartItem, CartGroupItem } from './cartGrouping';

describe('cartGrouping Unit Tests', () => {
  const mockItems: CartGroupItem[] = [
    {
      foodItem: {
        id: 'dosa-masala',
        name: 'Crispy Masala Dosa',
        nativeNames: { en: 'Crispy Masala Dosa', ta: 'மசாலா தோசை', hi: 'मसाला डोसा' },
        restaurant: 'Murugan Idli Shop',
        basePrice: 110,
        cuisine: 'Tamil' as any,
        category: 'South Indian',
        isVeg: true,
        description: '',
        image: '',
        rating: 4.8,
        tags: [],
        locations: [],
        platforms: [],
        restaurantLat: 13.0850,
        restaurantLng: 80.2600
      },
      quantity: 1
    },
    {
      foodItem: {
        id: 'idli-sambar',
        name: 'Steamed Button Sambar Idli',
        nativeNames: { en: 'Steamed Button Sambar Idli', ta: 'சாம்பார் இட்லி', hi: 'सांबर इडली' },
        restaurant: 'Murugan Idli Shop',
        basePrice: 75,
        cuisine: 'Tamil' as any,
        category: 'South Indian',
        isVeg: true,
        description: '',
        image: '',
        rating: 4.8,
        tags: [],
        locations: [],
        platforms: [],
        restaurantLat: 13.0850,
        restaurantLng: 80.2600
      },
      quantity: 2
    },
    {
      foodItem: {
        id: 'dosa-podi',
        name: 'Ghee Podi Dosa',
        nativeNames: { en: 'Ghee Podi Dosa', ta: 'பொடி தோசை', hi: 'पोडी डोसा' },
        restaurant: 'Saravana Bhavan',
        basePrice: 135,
        cuisine: 'Tamil' as any,
        category: 'South Indian',
        isVeg: true,
        description: '',
        image: '',
        rating: 4.9,
        tags: [],
        locations: [],
        platforms: [],
        restaurantLat: 13.0400,
        restaurantLng: 80.2500
      },
      quantity: 1
    },
    {
      foodItem: {
        id: 'medu-vada',
        name: 'Crispy Medu Vada',
        nativeNames: { en: 'Crispy Medu Vada', ta: 'மெது வடை', hi: 'मेदू वड़ा' },
        restaurant: 'A2B Adyar Ananda Bhavan',
        basePrice: 60,
        cuisine: 'Tamil' as any,
        category: 'South Indian',
        isVeg: true,
        description: '',
        image: '',
        rating: 4.7,
        tags: [],
        locations: [],
        platforms: [],
        restaurantLat: 13.0010,
        restaurantLng: 80.2560
      },
      quantity: 1
    }
  ];

  test('Multi-Restaurant Cart Grouping (3 restaurants, 4 items)', () => {
    const summary = groupCartByRestaurant(mockItems);
    expect(summary.restaurantCount).toBe(3);
    expect(summary.totalDeliveryFee).toBe(90); // 3 * 30
    expect(summary.groups.length).toBe(3);
  });

  test('Cart Item Validation', () => {
    const validCheck = validateCartItem(mockItems[0]);
    const invalidCheck = validateCartItem({ foodItem: { id: 'x' } as any, quantity: 0 });
    expect(validCheck.isValid).toBe(true);
    expect(invalidCheck.isValid).toBe(false);
  });

  test('Multi-Restaurant Restricted Item Separation', () => {
    const restrictedFoodIds = ['dosa-podi'];
    const restrictedItems = mockItems.filter(item => restrictedFoodIds.includes(item.foodItem.id));
    const allowedItems = mockItems.filter(item => !restrictedFoodIds.includes(item.foodItem.id));

    expect(restrictedItems.length).toBe(1);
    expect(allowedItems.length).toBe(3);
    expect(restrictedItems[0].foodItem.name).toBe('Ghee Podi Dosa');
  });
});
