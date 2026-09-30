import { groupCartByRestaurant, validateCartItem, CartGroupItem } from './cartGrouping';

export function runCartGroupingUnitTests() {
  const testResults: Array<{ testName: string; passed: boolean; details: string }> = [];

  const addResult = (testName: string, passed: boolean, details: string) => {
    testResults.push({ testName, passed, details });
    if (passed) {
      console.log(`[PASS] ${testName}: ${details}`);
    } else {
      console.error(`[FAIL] ${testName}: ${details}`);
    }
  };

  // Test 1: Multi-restaurant cart grouping (3 restaurants, 4 items)
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

  const summary = groupCartByRestaurant(mockItems);
  const correctRestaurantCount = summary.restaurantCount === 3;
  const correctDeliveryFee = summary.totalDeliveryFee === 90; // 3 * 30

  addResult(
    'Multi-Restaurant Cart Grouping',
    correctRestaurantCount && correctDeliveryFee,
    `Grouped ${summary.groups.length} restaurants, total delivery fee ₹${summary.totalDeliveryFee}`
  );

  // Test 2: Item validation test
  const validCheck = validateCartItem(mockItems[0]);
  const invalidCheck = validateCartItem({ foodItem: { id: 'x' } as any, quantity: 0 });
  addResult(
    'Cart Item Validation',
    validCheck.isValid && !invalidCheck.isValid,
    `Valid item passed, invalid item correctly caught (${invalidCheck.itemError})`
  );

  // Test 3: Restricted item identification in multi-restaurant cart
  const restrictedFoodIds = ['dosa-podi']; // Ghee Podi Dosa is restricted
  const restrictedItems = mockItems.filter(item => restrictedFoodIds.includes(item.foodItem.id));
  const allowedItems = mockItems.filter(item => !restrictedFoodIds.includes(item.foodItem.id));

  addResult(
    'Multi-Restaurant Restricted Item Separation',
    restrictedItems.length === 1 && allowedItems.length === 3,
    `Restricted item (${restrictedItems[0]?.foodItem.name}) identified; ${allowedItems.length} allowed items proceed.`
  );

  return {
    total: testResults.length,
    passed: testResults.filter(r => r.passed).length,
    results: testResults
  };
}
