import { FoodItem } from '../types';

export interface CartGroupItem {
  foodItem: FoodItem;
  quantity: number;
}

export interface GroupedRestaurantCart {
  restaurantName: string;
  restaurantId?: string;
  items: CartGroupItem[];
  subtotal: number;
  deliveryFee: number;
}

export interface MultiRestaurantCartSummary {
  groups: GroupedRestaurantCart[];
  subtotal: number;
  totalDeliveryFee: number;
  platformFee: number;
  gstTax: number;
  perOrderTotal: number;
  restaurantCount: number;
  totalItemCount: number;
}

export function validateCartItem(item: CartGroupItem): { isValid: boolean; itemError?: string } {
  if (!item || !item.foodItem) {
    return { isValid: false, itemError: 'Invalid cart item' };
  }
  const name = item.foodItem.name;
  const price = item.foodItem.basePrice;
  const qty = item.quantity;
  const rest = item.foodItem.restaurant;

  if (!name || price === undefined || price < 0 || !qty || qty < 1 || !rest) {
    return { isValid: false, itemError: name || 'Cart Item' };
  }
  return { isValid: true };
}

export function groupCartByRestaurant(items: CartGroupItem[]): MultiRestaurantCartSummary {
  const groupsMap = new Map<string, GroupedRestaurantCart>();
  let overallSubtotal = 0;
  let totalItems = 0;

  items.forEach(item => {
    if (!item || !item.foodItem) return;
    const restName = item.foodItem.restaurant || 'Saravana Bhavan';
    const price = item.foodItem.basePrice || 100;
    const qty = item.quantity || 1;
    const itemSubtotal = price * qty;

    if (!groupsMap.has(restName)) {
      groupsMap.set(restName, {
        restaurantName: restName,
        restaurantId: item.foodItem.id ? `rest_${restName.toLowerCase().replace(/[^a-z0-9]/g, '_')}` : undefined,
        items: [],
        subtotal: 0,
        deliveryFee: 30 // ₹30 per restaurant
      });
    }

    const group = groupsMap.get(restName)!;
    group.items.push(item);
    group.subtotal += itemSubtotal;

    overallSubtotal += itemSubtotal;
    totalItems += qty;
  });

  const groups = Array.from(groupsMap.values());
  const restaurantCount = groups.length;
  const totalDeliveryFee = restaurantCount * 30;
  const platformFee = 5.00;
  const gstTax = (overallSubtotal + totalDeliveryFee) * 0.05;
  const perOrderTotal = overallSubtotal + totalDeliveryFee + platformFee + gstTax;

  return {
    groups,
    subtotal: overallSubtotal,
    totalDeliveryFee,
    platformFee,
    gstTax,
    perOrderTotal,
    restaurantCount,
    totalItemCount: totalItems
  };
}
