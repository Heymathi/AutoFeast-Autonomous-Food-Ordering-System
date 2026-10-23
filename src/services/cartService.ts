import { CartItem } from '../types';

const API_BASE = '/api/cart';

export class CartService {
  private static getHeaders(): Record<string, string> {
    const token = localStorage.getItem('autofeast_jwt_token') || '';
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  public static async fetchCart(userId: string): Promise<CartItem[]> {
    try {
      const res = await fetch(`${API_BASE}`, {
        headers: this.getHeaders()
      });
      if (!res.ok) throw new Error('Failed to fetch server cart');
      const data = await res.json();
      return data.cart || [];
    } catch (err) {
      console.warn('[CartService] fetchCart error:', err);
      return [];
    }
  }

  public static async addToCart(
    userId: string,
    payload: {
      itemId: string;
      name: string;
      restaurantId: string;
      restaurantName: string;
      price: number;
      qty?: number;
      addedFrom?: 'voice_search' | 'dynamic_search' | 'auto_scheduler' | 'healthy_food' | 'general';
      image?: string;
      category?: string;
      isVegetarian?: boolean;
      needsNomineeApproval?: boolean;
    }
  ): Promise<CartItem[]> {
    try {
      const res = await fetch(`${API_BASE}/add`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ ...payload })
      });
      if (!res.ok) throw new Error('Failed to add item to cart');
      const data = await res.json();
      return data.cart || [];
    } catch (err) {
      console.error('[CartService] addToCart error:', err);
      throw err;
    }
  }

  public static async updateQuantity(
    userId: string,
    itemId: string,
    restaurantName: string,
    qty: number
  ): Promise<CartItem[]> {
    try {
      const res = await fetch(`${API_BASE}/update-qty`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ itemId, restaurantName, qty })
      });
      if (!res.ok) throw new Error('Failed to update cart quantity');
      const data = await res.json();
      return data.cart || [];
    } catch (err) {
      console.error('[CartService] updateQuantity error:', err);
      throw err;
    }
  }

  public static async removeItem(
    userId: string,
    itemId: string,
    restaurantName: string
  ): Promise<CartItem[]> {
    try {
      const res = await fetch(`${API_BASE}/remove`, {
        method: 'DELETE',
        headers: this.getHeaders(),
        body: JSON.stringify({ itemId, restaurantName })
      });
      if (!res.ok) throw new Error('Failed to remove item from cart');
      const data = await res.json();
      return data.cart || [];
    } catch (err) {
      console.error('[CartService] removeItem error:', err);
      throw err;
    }
  }

  public static async clearCart(userId: string): Promise<CartItem[]> {
    try {
      const res = await fetch(`${API_BASE}/clear`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      if (!res.ok) throw new Error('Failed to clear cart');
      const data = await res.json();
      return data.cart || [];
    } catch (err) {
      console.error('[CartService] clearCart error:', err);
      throw err;
    }
  }
}
