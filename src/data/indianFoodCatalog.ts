import { FoodItem } from '../types';

export const INDIAN_FOOD_CATALOG: FoodItem[] = [
  // SOUTH INDIAN - TAMIL CUISINE
  {
    id: 'dosa-masala',
    name: 'Crispy Masala Dosa',
    nativeNames: { en: 'Crispy Masala Dosa', ta: 'மசாலா தோசை', hi: 'मसाला डोसा' },
    cuisine: 'Tamil',
    category: 'South Indian',
    isVeg: true,
    basePrice: 110,
    description: 'Golden crispy rice crepe stuffed with spiced potato masala, served with coconut chutney & sambar.',
    image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&q=80&w=600',
    rating: 4.8,
    tags: ['dosa', 'masala dosa', 'தோசை', 'தோசா', 'மசாலா தோசை', 'மசாலா தோசா', 'डोसा', 'मसाला डोसा', 'crispy', 'spicy', 'breakfast', 'south indian', 'vegetarian', 'potato'],
    locations: ['Chennai', 'Salem', 'Bengaluru', 'Coimbatore', 'All'],
    restaurant: 'Murugan Idli Shop',
    restaurantLat: 13.0850,
    restaurantLng: 80.2600,
    platforms: [
      { platform: 'swiggy', platformName: 'Swiggy', price: 110, originalPrice: 130, rating: 4.8, deliveryTime: 25, deliveryFee: 20, discountBadge: '15% OFF', available: true },
      { platform: 'zomato', platformName: 'Zomato', price: 105, originalPrice: 130, rating: 4.7, deliveryTime: 28, deliveryFee: 25, discountBadge: 'Super Offer', available: true },
      { platform: 'eatsure', platformName: 'EatSure', price: 120, originalPrice: 140, rating: 4.9, deliveryTime: 30, deliveryFee: 0, discountBadge: 'Free Delivery', available: true },
      { platform: 'magicpin', platformName: 'MagicPin', price: 99, originalPrice: 130, rating: 4.5, deliveryTime: 35, deliveryFee: 15, discountBadge: 'BEST PRICE', available: true }
    ]
  },
  {
    id: 'dosa-podi',
    name: 'Ghee Podi Dosa',
    nativeNames: { en: 'Ghee Podi Dosa', ta: 'நெய் பொடி தோசை', hi: 'घी पोडी डोसा' },
    cuisine: 'Tamil',
    category: 'South Indian',
    isVeg: true,
    basePrice: 135,
    description: 'Crispy crepe smeared with aromatic pure desi ghee and fiery gun powder (podi).',
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&q=80&w=600',
    rating: 4.9,
    tags: ['dosa', 'podi dosa', 'ghee dosa', 'தோசை', 'தோசா', 'பொடி தோசை', 'நெய் தோசை', 'डोसा', 'पोडी डोसा', 'घी डोसा', 'ghee', 'spicy', 'crispy', 'south indian'],
    locations: ['Chennai', 'Salem', 'Bengaluru', 'All'],
    restaurant: 'Saravana Bhavan',
    restaurantLat: 13.0400,
    restaurantLng: 80.2500,
    platforms: [
      { platform: 'swiggy', platformName: 'Swiggy', price: 130, originalPrice: 150, rating: 4.9, deliveryTime: 22, deliveryFee: 15, discountBadge: 'Top Rated', available: true },
      { platform: 'zomato', platformName: 'Zomato', price: 135, originalPrice: 150, rating: 4.8, deliveryTime: 25, deliveryFee: 20, available: true },
      { platform: 'eatsure', platformName: 'EatSure', price: 140, originalPrice: 160, rating: 4.7, deliveryTime: 32, deliveryFee: 0, available: true },
      { platform: 'magicpin', platformName: 'MagicPin', price: 120, originalPrice: 150, rating: 4.6, deliveryTime: 30, deliveryFee: 10, available: true }
    ]
  },
  {
    id: 'dosa-plain',
    name: 'Golden Plain Paper Dosa',
    nativeNames: { en: 'Golden Plain Paper Dosa', ta: 'பிளைன் தோசை', hi: 'प्लेन डोसा' },
    cuisine: 'South Indian',
    category: 'South Indian',
    isVeg: true,
    basePrice: 85,
    description: 'Classic thin paper-crispy fermented rice and lentil crepe served with 3 varieties of chutneys.',
    image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&q=80&w=600',
    rating: 4.6,
    tags: ['dosa', 'plain dosa', 'paper dosa', 'தோசை', 'தோசா', 'பிளைன் தோசை', 'डोसा', 'प्लेन डोसा', 'crispy', 'light', 'south indian'],
    locations: ['Chennai', 'Salem', 'Bengaluru', 'Hyderabad', 'All'],
    restaurant: 'A2B Adyar Ananda Bhavan',
    restaurantLat: 13.0010,
    restaurantLng: 80.2560,
    platforms: [
      { platform: 'swiggy', platformName: 'Swiggy', price: 85, originalPrice: 100, rating: 4.6, deliveryTime: 20, deliveryFee: 15, available: true },
      { platform: 'zomato', platformName: 'Zomato', price: 80, originalPrice: 100, rating: 4.5, deliveryTime: 22, deliveryFee: 15, available: true },
      { platform: 'magicpin', platformName: 'MagicPin', price: 75, originalPrice: 100, rating: 4.4, deliveryTime: 28, deliveryFee: 10, available: true },
      { platform: 'eatsure', platformName: 'EatSure', price: 90, originalPrice: 105, rating: 4.7, deliveryTime: 25, deliveryFee: 0, available: true }
    ]
  },
  {
    id: 'dosa-rava',
    name: 'Onion Rava Dosa',
    nativeNames: { en: 'Onion Rava Dosa', ta: 'வெங்காய ரவா தோசை', hi: 'प्याज रवा डोसा' },
    cuisine: 'South Indian',
    category: 'South Indian',
    isVeg: true,
    basePrice: 125,
    description: 'Lacy, crispy semolina crepe studded with finely chopped onions, green chillies, and cumin.',
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&q=80&w=600',
    rating: 4.7,
    tags: ['dosa', 'rava dosa', 'onion dosa', 'தோசை', 'தோசா', 'ரவா தோசை', 'வெங்காய தோசை', 'डोसा', 'रवा डोसा', 'प्याज डोसा', 'crispy', 'south indian'],
    locations: ['Chennai', 'Bengaluru', 'Salem', 'All'],
    restaurant: 'Sangeetha Veg Restaurant',
    restaurantLat: 13.0620,
    restaurantLng: 80.2400,
    platforms: [
      { platform: 'swiggy', platformName: 'Swiggy', price: 125, originalPrice: 140, rating: 4.7, deliveryTime: 26, deliveryFee: 18, available: true },
      { platform: 'zomato', platformName: 'Zomato', price: 120, originalPrice: 140, rating: 4.6, deliveryTime: 25, deliveryFee: 20, available: true },
      { platform: 'magicpin', platformName: 'MagicPin', price: 110, originalPrice: 140, rating: 4.5, deliveryTime: 30, deliveryFee: 10, available: true },
      { platform: 'eatsure', platformName: 'EatSure', price: 130, originalPrice: 150, rating: 4.8, deliveryTime: 28, deliveryFee: 0, available: true }
    ]
  },
  {
    id: 'idli-sambar',
    name: 'Steamed Button Sambar Idli',
    nativeNames: { en: 'Steamed Button Sambar Idli', ta: 'சாம்பார் இட்லி', hi: 'सांबर इडली' },
    cuisine: 'Tamil',
    category: 'South Indian',
    isVeg: true,
    basePrice: 75,
    description: 'Mini fluffy steamed rice cakes submerged in hot aromatic piping sambar with melted ghee.',
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&q=80&w=600',
    rating: 4.8,
    tags: ['idli', 'idly', 'idlys', 'idlis', 'sambar idli', 'button idli', 'இட்லி', 'சாம்பார் இட்லி', 'इडली', 'सांबर इडली', 'healthy', 'steamed', 'south indian', 'breakfast'],
    locations: ['Chennai', 'Salem', 'Bengaluru', 'Coimbatore', 'All'],
    restaurant: 'Murugan Idli Shop',
    restaurantLat: 13.0850,
    restaurantLng: 80.2600,
    platforms: [
      { platform: 'swiggy', platformName: 'Swiggy', price: 75, originalPrice: 90, rating: 4.8, deliveryTime: 18, deliveryFee: 15, available: true },
      { platform: 'zomato', platformName: 'Zomato', price: 70, originalPrice: 90, rating: 4.7, deliveryTime: 20, deliveryFee: 15, available: true },
      { platform: 'magicpin', platformName: 'MagicPin', price: 65, originalPrice: 90, rating: 4.6, deliveryTime: 25, deliveryFee: 10, available: true },
      { platform: 'eatsure', platformName: 'EatSure', price: 80, originalPrice: 95, rating: 4.9, deliveryTime: 22, deliveryFee: 0, available: true }
    ]
  },
  {
    id: 'medu-vada',
    name: 'Crispy Medu Vada (2 pcs)',
    nativeNames: { en: 'Crispy Medu Vada', ta: 'மெது வடை', hi: 'मेदू वड़ा' },
    cuisine: 'Tamil',
    category: 'South Indian',
    isVeg: true,
    basePrice: 60,
    description: 'Golden fried savory urad dal donut fritters with crispy exterior and soft fluffy interior.',
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&q=80&w=600',
    rating: 4.7,
    tags: ['vada', 'medu vada', 'vadai', 'வடை', 'மெது வடை', 'वड़ा', 'मेदू वड़ा', 'snack', 'breakfast', 'south indian'],
    locations: ['Chennai', 'Salem', 'Bengaluru', 'Coimbatore', 'All'],
    restaurant: 'A2B Adyar Ananda Bhavan',
    restaurantLat: 13.0010,
    restaurantLng: 80.2560,
    platforms: [
      { platform: 'swiggy', platformName: 'Swiggy', price: 60, originalPrice: 70, rating: 4.7, deliveryTime: 15, deliveryFee: 15, available: true },
      { platform: 'zomato', platformName: 'Zomato', price: 55, originalPrice: 70, rating: 4.6, deliveryTime: 18, deliveryFee: 15, available: true },
      { platform: 'magicpin', platformName: 'MagicPin', price: 50, originalPrice: 70, rating: 4.5, deliveryTime: 20, deliveryFee: 10, available: true },
      { platform: 'eatsure', platformName: 'EatSure', price: 65, originalPrice: 75, rating: 4.8, deliveryTime: 18, deliveryFee: 0, available: true }
    ]
  },
  {
    id: 'pongal-ghee',
    name: 'Ven Pongal with Vadai',
    nativeNames: { en: 'Ven Pongal with Vadai', ta: 'வெண் பொங்கல் வடை', hi: 'वेन पोंगल' },
    cuisine: 'Tamil',
    category: 'South Indian',
    isVeg: true,
    basePrice: 110,
    description: 'Comforting steamed rice and moong dal porridge tempered with ghee, cashews, cumin & black pepper.',
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&q=80&w=600',
    rating: 4.8,
    tags: ['pongal', 'ven pongal', 'வெண் பொங்கல்', 'பொங்கல்', 'पोंगल', 'वेन पोंगल', 'ghee', 'breakfast', 'south indian'],
    locations: ['Chennai', 'Salem', 'Bengaluru', 'All'],
    restaurant: 'Saravana Bhavan',
    restaurantLat: 13.0400,
    restaurantLng: 80.2500,
    platforms: [
      { platform: 'swiggy', platformName: 'Swiggy', price: 110, originalPrice: 130, rating: 4.8, deliveryTime: 20, deliveryFee: 15, available: true },
      { platform: 'zomato', platformName: 'Zomato', price: 105, originalPrice: 130, rating: 4.7, deliveryTime: 22, deliveryFee: 15, available: true },
      { platform: 'magicpin', platformName: 'MagicPin', price: 95, originalPrice: 130, rating: 4.5, deliveryTime: 25, deliveryFee: 10, available: true },
      { platform: 'eatsure', platformName: 'EatSure', price: 120, originalPrice: 135, rating: 4.9, deliveryTime: 20, deliveryFee: 0, available: true }
    ]
  },

  // PAROTTA & NON-VEG SPECIALS
  {
    id: 'parotta-kothu',
    name: 'Chicken Kothu Parotta',
    nativeNames: { en: 'Chicken Kothu Parotta', ta: 'சிக்கன் கொத்து பரோட்டா', hi: 'चिकन कोथू परोटा' },
    cuisine: 'Tamil',
    category: 'South Indian',
    isVeg: false,
    basePrice: 180,
    description: 'Flaky shredded parotta chopped on a hot griddle with spiced chicken curry, eggs, and onions.',
    image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&q=80&w=600',
    rating: 4.9,
    tags: ['parotta', 'kothu parotta', 'chicken parotta', 'பரோட்டா', 'கொத்து பரோட்டா', 'பரோடா', 'परोटा', 'कोथू परोटा', 'पराठा', 'chicken', 'spicy', 'street food', 'south indian', 'non-veg'],
    locations: ['Chennai', 'Salem', 'Madurai', 'Coimbatore', 'All'],
    restaurant: 'Madurai Mess',
    restaurantLat: 13.0900,
    restaurantLng: 80.2800,
    platforms: [
      { platform: 'swiggy', platformName: 'Swiggy', price: 175, originalPrice: 200, rating: 4.9, deliveryTime: 28, deliveryFee: 20, available: true },
      { platform: 'zomato', platformName: 'Zomato', price: 170, originalPrice: 200, rating: 4.8, deliveryTime: 30, deliveryFee: 20, available: true },
      { platform: 'magicpin', platformName: 'MagicPin', price: 160, originalPrice: 200, rating: 4.6, deliveryTime: 35, deliveryFee: 15, available: true },
      { platform: 'eatsure', platformName: 'EatSure', price: 185, originalPrice: 210, rating: 4.8, deliveryTime: 25, deliveryFee: 0, available: true }
    ]
  },

  // BIRYANI VARIETIES
  {
    id: 'biryani-hyderabadi',
    name: 'Hyderabadi Chicken Dum Biryani',
    nativeNames: { en: 'Hyderabadi Chicken Dum Biryani', ta: 'ஹைதராபாத் சிக்கன் பிரியாணி', hi: 'हैदराबादी चिकन दम बिरयानी' },
    cuisine: 'Telangana',
    category: 'Mughlai',
    isVeg: false,
    basePrice: 280,
    description: 'Authentic long-grain Basmati rice slow-cooked with tender marinated chicken, saffron, and aromatic spices.',
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=600',
    rating: 4.9,
    tags: ['biryani', 'chicken biryani', 'biyani', 'biriyani', 'briyani', 'பிரியாணி', 'பிரியானி', 'பிரீயாணி', 'சிக்கன் பிரியாணி', 'ஹைதராபாத் பிரியாணி', 'बिरयानी', 'चिकन बिरयानी', 'spicy', 'hyderabadi', 'non-veg', 'rice', 'mughlai'],
    locations: ['Hyderabad', 'Chennai', 'Bengaluru', 'Mumbai', 'Delhi', 'All'],
    restaurant: 'Bawarchi Biryani',
    restaurantLat: 13.0700,
    restaurantLng: 80.2300,
    platforms: [
      { platform: 'swiggy', platformName: 'Swiggy', price: 270, originalPrice: 320, rating: 4.9, deliveryTime: 30, deliveryFee: 25, discountBadge: 'BESTSELLER', available: true },
      { platform: 'zomato', platformName: 'Zomato', price: 265, originalPrice: 320, rating: 4.8, deliveryTime: 32, deliveryFee: 20, discountBadge: '20% OFF', available: true },
      { platform: 'eatsure', platformName: 'EatSure', price: 290, originalPrice: 330, rating: 4.9, deliveryTime: 28, deliveryFee: 0, available: true },
      { platform: 'magicpin', platformName: 'MagicPin', price: 250, originalPrice: 320, rating: 4.6, deliveryTime: 38, deliveryFee: 15, available: true }
    ]
  },
  {
    id: 'biryani-ambur',
    name: 'Ambur Mutton Biryani',
    nativeNames: { en: 'Ambur Mutton Biryani', ta: 'ஆம்பூர் ஆட்டுக்கறி பிரியாணி', hi: 'आंबूर मटन बिरयानी' },
    cuisine: 'Tamil',
    category: 'South Indian',
    isVeg: false,
    basePrice: 320,
    description: 'Traditional Tamil Nadu Seeraga Samba rice mutton biryani made with cooked red chilli paste and curd.',
    image: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&q=80&w=600',
    rating: 4.8,
    tags: ['biryani', 'mutton biryani', 'ambur biryani', 'biriyani', 'briyani', 'பிரியாணி', 'பிரியானி', 'பிரீயாணி', 'ஆட்டுக்கறி பிரியாணி', 'மட்டன் பிரியாணி', 'ஆம்பூர் பிரியாணி', 'बिरयानी', 'मटन बिरयानी', 'ambur', 'non-veg'],
    locations: ['Chennai', 'Salem', 'Coimbatore', 'All'],
    restaurant: 'Star Ambur Biryani',
    restaurantLat: 13.0500,
    restaurantLng: 80.2100,
    platforms: [
      { platform: 'swiggy', platformName: 'Swiggy', price: 310, originalPrice: 360, rating: 4.8, deliveryTime: 35, deliveryFee: 20, available: true },
      { platform: 'zomato', platformName: 'Zomato', price: 300, originalPrice: 360, rating: 4.7, deliveryTime: 33, deliveryFee: 25, available: true },
      { platform: 'magicpin', platformName: 'MagicPin', price: 290, originalPrice: 360, rating: 4.5, deliveryTime: 40, deliveryFee: 15, available: true },
      { platform: 'eatsure', platformName: 'EatSure', price: 330, originalPrice: 370, rating: 4.8, deliveryTime: 30, deliveryFee: 0, available: true }
    ]
  },
  {
    id: 'biryani-veg-paneer',
    name: 'Special Paneer Veg Biryani',
    nativeNames: { en: 'Special Paneer Veg Biryani', ta: 'பன்னீர் காய்கறி பிரியாணி', hi: 'पनीर वेज बिरयानी' },
    cuisine: 'North Indian',
    category: 'North Indian',
    isVeg: true,
    basePrice: 220,
    description: 'Fragrant Basmati rice dum-cooked with fresh cottage cheese cubes, vegetables, mint, and saffron.',
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=600',
    rating: 4.6,
    tags: ['biryani', 'veg biryani', 'paneer biryani', 'பிரியாணி', 'பன்னீர் பிரியாணி', 'बिरयानी', 'वेज बिरयानी', 'पनीर बिरयानी', 'vegetarian'],
    locations: ['Chennai', 'Bengaluru', 'Salem', 'Mumbai', 'All'],
    restaurant: 'Bawarchi Biryani',
    restaurantLat: 13.0700,
    restaurantLng: 80.2300,
    platforms: [
      { platform: 'swiggy', platformName: 'Swiggy', price: 210, originalPrice: 250, rating: 4.6, deliveryTime: 25, deliveryFee: 20, available: true },
      { platform: 'zomato', platformName: 'Zomato', price: 200, originalPrice: 250, rating: 4.5, deliveryTime: 28, deliveryFee: 20, available: true },
      { platform: 'magicpin', platformName: 'MagicPin', price: 190, originalPrice: 250, rating: 4.4, deliveryTime: 32, deliveryFee: 15, available: true },
      { platform: 'eatsure', platformName: 'EatSure', price: 220, originalPrice: 260, rating: 4.7, deliveryTime: 25, deliveryFee: 0, available: true }
    ]
  },

  // KERALA CUISINE
  {
    id: 'kerala-appam-stew',
    name: 'Kerala Appam with Veg Stew',
    nativeNames: { en: 'Kerala Appam with Veg Stew', ta: 'கேரளா ஆப்பம் காய்கறி ஸ்டூ', hi: 'केरल आपम वेज स्टू' },
    cuisine: 'Kerala',
    category: 'South Indian',
    isVeg: true,
    basePrice: 160,
    description: 'Lacy rice pan-crepes with soft spongy centers served with mild coconut milk vegetable stew.',
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&q=80&w=600',
    rating: 4.8,
    tags: ['appam', 'stew', 'ஆப்பம்', 'கேரளா', 'आपम', 'स्टू', 'kerala', 'coconut', 'breakfast'],
    locations: ['Chennai', 'Bengaluru', 'Kochi', 'All'],
    restaurant: 'Coconut Lagoon Kerala Restaurant',
    restaurantLat: 13.0600,
    restaurantLng: 80.2450,
    platforms: [
      { platform: 'swiggy', platformName: 'Swiggy', price: 155, originalPrice: 180, rating: 4.8, deliveryTime: 25, deliveryFee: 20, available: true },
      { platform: 'zomato', platformName: 'Zomato', price: 150, originalPrice: 180, rating: 4.7, deliveryTime: 28, deliveryFee: 20, available: true },
      { platform: 'magicpin', platformName: 'MagicPin', price: 140, originalPrice: 180, rating: 4.5, deliveryTime: 32, deliveryFee: 15, available: true },
      { platform: 'eatsure', platformName: 'EatSure', price: 165, originalPrice: 190, rating: 4.8, deliveryTime: 25, deliveryFee: 0, available: true }
    ]
  },

  // NORTH INDIAN & PUNJABI
  {
    id: 'paneer-butter-masala',
    name: 'Paneer Butter Masala & Butter Naan',
    nativeNames: { en: 'Paneer Butter Masala & Naan', ta: 'பன்னீர் பட்டர் மசாலா நாண்', hi: 'पनीर बटर मसाला और बटर नान' },
    cuisine: 'Punjabi',
    category: 'North Indian',
    isVeg: true,
    basePrice: 250,
    description: 'Rich creamy tomato onion gravy with soft cottage cheese cubes served with 2 fluffy butter naans.',
    image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&q=80&w=600',
    rating: 4.8,
    tags: ['paneer', 'paneer butter masala', 'naan', 'butter masala', 'பன்னீர்', 'நாண்', 'பஞ்சாபி', 'पनीर', 'पनीर बटर मसाला', 'नान', 'north indian', 'dinner'],
    locations: ['Chennai', 'Bengaluru', 'Delhi', 'Mumbai', 'All'],
    restaurant: 'Pind Balluchi',
    restaurantLat: 13.0780,
    restaurantLng: 80.2520,
    platforms: [
      { platform: 'swiggy', platformName: 'Swiggy', price: 240, originalPrice: 290, rating: 4.8, deliveryTime: 30, deliveryFee: 20, available: true },
      { platform: 'zomato', platformName: 'Zomato', price: 235, originalPrice: 290, rating: 4.7, deliveryTime: 32, deliveryFee: 20, available: true },
      { platform: 'eatsure', platformName: 'EatSure', price: 260, originalPrice: 300, rating: 4.9, deliveryTime: 28, deliveryFee: 0, available: true },
      { platform: 'magicpin', platformName: 'MagicPin', price: 220, originalPrice: 290, rating: 4.5, deliveryTime: 35, deliveryFee: 15, available: true }
    ]
  },
  {
    id: 'chole-bhature',
    name: 'Punjabi Chole Bhature (2 pcs)',
    nativeNames: { en: 'Punjabi Chole Bhature', ta: 'சோலே பட்டூரே', hi: 'छोले भटूरे' },
    cuisine: 'Punjabi',
    category: 'North Indian',
    isVeg: true,
    basePrice: 150,
    description: 'Fluffy fried bread paired with spicy tangy dark chickpea curry and pickled onions.',
    image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&q=80&w=600',
    rating: 4.9,
    tags: ['chole', 'bhature', 'chole bhature', 'சோலே', 'பட்டூரே', 'छोले', 'भटूरे', 'छोले भटूरे', 'punjabi', 'spicy', 'breakfast', 'lunch'],
    locations: ['Delhi', 'Mumbai', 'Chennai', 'Bengaluru', 'All'],
    restaurant: 'Haldirams',
    restaurantLat: 13.0750,
    restaurantLng: 80.2550,
    platforms: [
      { platform: 'swiggy', platformName: 'Swiggy', price: 145, originalPrice: 170, rating: 4.9, deliveryTime: 22, deliveryFee: 15, available: true },
      { platform: 'zomato', platformName: 'Zomato', price: 140, originalPrice: 170, rating: 4.8, deliveryTime: 24, deliveryFee: 15, available: true },
      { platform: 'magicpin', platformName: 'MagicPin', price: 130, originalPrice: 170, rating: 4.6, deliveryTime: 30, deliveryFee: 10, available: true },
      { platform: 'eatsure', platformName: 'EatSure', price: 155, originalPrice: 180, rating: 4.9, deliveryTime: 20, deliveryFee: 0, available: true }
    ]
  },
  {
    id: 'butter-chicken',
    name: 'Murgh Makhani Butter Chicken & Rice',
    nativeNames: { en: 'Butter Chicken & Rice', ta: 'பட்டர் சிக்கன் சாதம்', hi: 'बटर चिकन राइस' },
    cuisine: 'Punjabi',
    category: 'Mughlai',
    isVeg: false,
    basePrice: 290,
    description: 'Tender tandoori chicken cooked in velvety tomato, butter & cashew cream gravy with Jeera rice.',
    image: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&q=80&w=600',
    rating: 4.9,
    tags: ['chicken', 'butter chicken', 'makhani chicken', 'பட்டர் சிக்கன்', 'சிக்கன்', 'बटर चिकन', 'चिकन', 'punjabi', 'non-veg', 'rich', 'dinner'],
    locations: ['Delhi', 'Mumbai', 'Chennai', 'Bengaluru', 'All'],
    restaurant: 'Kake Da Hotel',
    restaurantLat: 13.0810,
    restaurantLng: 80.2480,
    platforms: [
      { platform: 'swiggy', platformName: 'Swiggy', price: 280, originalPrice: 330, rating: 4.9, deliveryTime: 28, deliveryFee: 25, available: true },
      { platform: 'zomato', platformName: 'Zomato', price: 275, originalPrice: 330, rating: 4.8, deliveryTime: 30, deliveryFee: 20, available: true },
      { platform: 'magicpin', platformName: 'MagicPin', price: 260, originalPrice: 330, rating: 4.6, deliveryTime: 35, deliveryFee: 15, available: true },
      { platform: 'eatsure', platformName: 'EatSure', price: 295, originalPrice: 340, rating: 4.9, deliveryTime: 25, deliveryFee: 0, available: true }
    ]
  },

  // GUJARATI CUISINE
  {
    id: 'gujarati-thali',
    name: 'Royal Gujarati Thali Special',
    nativeNames: { en: 'Royal Gujarati Thali', ta: 'குஜராத்தி தாலி', hi: 'रॉयल गुजराती थाली' },
    cuisine: 'Gujarati',
    category: 'North Indian',
    isVeg: true,
    basePrice: 240,
    description: 'Complete meal with Dhokla, Rotli, Gujarati Sweet Dal, Kadhi, Undhiyu, Shrikhand, and Chaas.',
    image: 'https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&q=80&w=600',
    rating: 4.7,
    tags: ['gujarati', 'thali', 'gujarati thali', 'குஜராத்தி', 'தாலி', 'गुजराती', 'थाली', 'dhokla', 'sweet', 'vegetarian', 'lunch'],
    locations: ['Bengaluru', 'Mumbai', 'Delhi', 'Ahmedabad', 'All'],
    restaurant: 'Rajdhani Thali Restaurant',
    restaurantLat: 13.0650,
    restaurantLng: 80.2450,
    platforms: [
      { platform: 'swiggy', platformName: 'Swiggy', price: 230, originalPrice: 280, rating: 4.7, deliveryTime: 35, deliveryFee: 25, available: true },
      { platform: 'zomato', platformName: 'Zomato', price: 235, originalPrice: 280, rating: 4.7, deliveryTime: 32, deliveryFee: 20, available: true },
      { platform: 'eatsure', platformName: 'EatSure', price: 250, originalPrice: 290, rating: 4.8, deliveryTime: 30, deliveryFee: 0, available: true },
      { platform: 'magicpin', platformName: 'MagicPin', price: 220, originalPrice: 280, rating: 4.5, deliveryTime: 40, deliveryFee: 15, available: true }
    ]
  },

  // STREET FOOD & CHAAT
  {
    id: 'pav-bhaji',
    name: 'Butter Mumbai Pav Bhaji',
    nativeNames: { en: 'Butter Mumbai Pav Bhaji', ta: 'பாவ் பாஜி', hi: 'बटर पाव भाजी' },
    cuisine: 'Maharashtrian',
    category: 'Street Food',
    isVeg: true,
    basePrice: 130,
    description: 'Spiced mashed vegetable curry loaded with Amul butter served with toasted soft bun pavs.',
    image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&q=80&w=600',
    rating: 4.8,
    tags: ['pav bhaji', 'pav', 'bhaji', 'பாவ் பாஜி', 'पाव भाजी', 'पाव', 'भाजी', 'mumbai', 'street food', 'butter', 'snacks'],
    locations: ['Mumbai', 'Delhi', 'Chennai', 'Bengaluru', 'All'],
    restaurant: 'Sardar Pav Bhaji',
    restaurantLat: 13.0720,
    restaurantLng: 80.2500,
    platforms: [
      { platform: 'swiggy', platformName: 'Swiggy', price: 125, originalPrice: 150, rating: 4.8, deliveryTime: 20, deliveryFee: 15, available: true },
      { platform: 'zomato', platformName: 'Zomato', price: 120, originalPrice: 150, rating: 4.7, deliveryTime: 22, deliveryFee: 15, available: true },
      { platform: 'magicpin', platformName: 'MagicPin', price: 110, originalPrice: 150, rating: 4.5, deliveryTime: 25, deliveryFee: 10, available: true },
      { platform: 'eatsure', platformName: 'EatSure', price: 135, originalPrice: 160, rating: 4.8, deliveryTime: 20, deliveryFee: 0, available: true }
    ]
  },
  {
    id: 'chaat-pani-puri',
    name: 'Crispy Pani Puri (Golgappa 8 pcs)',
    nativeNames: { en: 'Crispy Pani Puri', ta: 'பானி பூரி', hi: 'पानी पूरी गोलगप्पा' },
    cuisine: 'Street Food',
    category: 'Street Food',
    isVeg: true,
    basePrice: 60,
    description: 'Hollow crispy puris filled with spiced potato chickpea mash and tangy spicy mint water.',
    image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&q=80&w=600',
    rating: 4.7,
    tags: ['pani puri', 'golgappa', 'panipuri', 'பானி பூரி', 'पानी पूरी', 'गोलगप्पा', 'chaat', 'spicy', 'street food', 'crispy', 'snack'],
    locations: ['Delhi', 'Mumbai', 'Chennai', 'Bengaluru', 'Salem', 'All'],
    restaurant: 'Haldirams',
    restaurantLat: 13.0750,
    restaurantLng: 80.2550,
    platforms: [
      { platform: 'swiggy', platformName: 'Swiggy', price: 60, originalPrice: 75, rating: 4.7, deliveryTime: 15, deliveryFee: 15, available: true },
      { platform: 'zomato', platformName: 'Zomato', price: 55, originalPrice: 75, rating: 4.6, deliveryTime: 18, deliveryFee: 15, available: true },
      { platform: 'magicpin', platformName: 'MagicPin', price: 50, originalPrice: 75, rating: 4.4, deliveryTime: 22, deliveryFee: 10, available: true },
      { platform: 'eatsure', platformName: 'EatSure', price: 65, originalPrice: 80, rating: 4.8, deliveryTime: 20, deliveryFee: 0, available: true }
    ]
  },

  // FAST FOOD & PIZZA
  {
    id: 'pizza-veggie-supreme',
    name: 'Cheesy Veg Supreme Pizza',
    nativeNames: { en: 'Cheesy Veg Supreme Pizza', ta: 'வெஜ் சீஸ் பீட்சா', hi: 'चीज़ी वेज सुप्रीम पिज्जा' },
    cuisine: 'Fast Food',
    category: 'Fast Food',
    isVeg: true,
    basePrice: 299,
    description: 'Freshly baked hand-tossed crust topped with mozzarella, capsicum, sweet corn, mushrooms, & olives.',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=600',
    rating: 4.6,
    tags: ['pizza', 'cheese pizza', 'veg pizza', 'பீட்சா', 'பட்ஸா', 'पिज्जा', 'पिज़ा', 'cheese', 'fast food', 'italian', 'veggie', 'crispy', 'dinner'],
    locations: ['Chennai', 'Bengaluru', 'Salem', 'Hyderabad', 'Mumbai', 'Delhi', 'All'],
    restaurant: 'Dominos Pizza',
    restaurantLat: 13.0800,
    restaurantLng: 80.2150,
    platforms: [
      { platform: 'swiggy', platformName: 'Swiggy', price: 289, originalPrice: 349, rating: 4.6, deliveryTime: 25, deliveryFee: 30, available: true },
      { platform: 'zomato', platformName: 'Zomato', price: 279, originalPrice: 349, rating: 4.5, deliveryTime: 28, deliveryFee: 25, available: true },
      { platform: 'eatsure', platformName: 'EatSure', price: 269, originalPrice: 349, rating: 4.8, deliveryTime: 20, deliveryFee: 0, discountBadge: 'FASTEST', available: true },
      { platform: 'magicpin', platformName: 'MagicPin', price: 250, originalPrice: 349, rating: 4.3, deliveryTime: 35, deliveryFee: 15, available: true }
    ]
  },
  {
    id: 'chinese-fried-rice',
    name: 'Chicken Schezwan Fried Rice',
    nativeNames: { en: 'Chicken Schezwan Fried Rice', ta: 'சிக்கன் ஃப்ரெடு ரைஸ்', hi: 'चिकन शेज़वान फ्राइड राइस' },
    cuisine: 'Indo-Chinese',
    category: 'Indo-Chinese',
    isVeg: false,
    basePrice: 190,
    description: 'Wok-tossed long grain rice with spicy Schezwan sauce, tender chicken, egg, and spring onions.',
    image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&q=80&w=600',
    rating: 4.7,
    tags: ['fried rice', 'schezwan', 'friedrice', 'chicken fried rice', 'சிக்கன் ரைஸ்', 'ஃப்ரெடு ரைஸ்', 'பிரைட் ரைஸ்', 'பிரைட்ரைஸ்', 'பிட்ஸ் ரைஸ்', 'फ्राइड राइस', 'चिकन राइस', 'chinese', 'spicy', 'dinner'],
    locations: ['Chennai', 'Bengaluru', 'Hyderabad', 'Mumbai', 'All'],
    restaurant: 'Mainland China',
    restaurantLat: 13.0760,
    restaurantLng: 80.2420,
    platforms: [
      { platform: 'swiggy', platformName: 'Swiggy', price: 185, originalPrice: 220, rating: 4.7, deliveryTime: 25, deliveryFee: 20, available: true },
      { platform: 'zomato', platformName: 'Zomato', price: 180, originalPrice: 220, rating: 4.6, deliveryTime: 28, deliveryFee: 20, available: true },
      { platform: 'magicpin', platformName: 'MagicPin', price: 170, originalPrice: 220, rating: 4.4, deliveryTime: 32, deliveryFee: 15, available: true },
      { platform: 'eatsure', platformName: 'EatSure', price: 195, originalPrice: 230, rating: 4.8, deliveryTime: 25, deliveryFee: 0, available: true }
    ]
  },

  // BEVERAGES & DESSERTS
  {
    id: 'beverage-filter-coffee',
    name: 'Kumbakonam Degree Filter Coffee',
    nativeNames: { en: 'Degree Filter Coffee', ta: 'கும்பகோணம் டிகிரி காபி', hi: 'साउथ इंडियन फ़िल्टर कॉफ़ी' },
    cuisine: 'Beverages',
    category: 'Beverages',
    isVeg: true,
    basePrice: 45,
    description: 'Frothy hot coffee brewed with chicory-blended decoction and rich boiled cow milk.',
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=600',
    rating: 4.9,
    tags: ['coffee', 'filter coffee', 'degree coffee', 'காபி', 'டிகிரி காபி', 'कॉफ़ी', 'कॉफी', 'फ़िल्टर कॉफ़ी', 'beverage', 'hot', 'tamil', 'south indian', 'snacks'],
    locations: ['Chennai', 'Salem', 'Coimbatore', 'Bengaluru', 'All'],
    restaurant: 'Kumbakonam Degree Coffee',
    restaurantLat: 13.0820,
    restaurantLng: 80.2650,
    platforms: [
      { platform: 'swiggy', platformName: 'Swiggy', price: 45, originalPrice: 55, rating: 4.9, deliveryTime: 15, deliveryFee: 15, available: true },
      { platform: 'zomato', platformName: 'Zomato', price: 40, originalPrice: 55, rating: 4.8, deliveryTime: 16, deliveryFee: 15, available: true },
      { platform: 'magicpin', platformName: 'MagicPin', price: 35, originalPrice: 55, rating: 4.6, deliveryTime: 20, deliveryFee: 10, available: true },
      { platform: 'eatsure', platformName: 'EatSure', price: 50, originalPrice: 60, rating: 4.9, deliveryTime: 15, deliveryFee: 0, available: true }
    ]
  },
  {
    id: 'dessert-gulab-jamun',
    name: 'Hot Shahi Gulab Jamun (2 pcs)',
    nativeNames: { en: 'Hot Shahi Gulab Jamun', ta: 'குலாப் ஜாமூன்', hi: 'गुलाब जामुन' },
    cuisine: 'Desserts',
    category: 'Desserts',
    isVeg: true,
    basePrice: 70,
    description: 'Soft melt-in-mouth milk solids dumplings soaked in cardamom saffron sugar syrup.',
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&q=80&w=600',
    rating: 4.8,
    tags: ['gulab jamun', 'jamun', 'குலாப் ஜாமூன்', 'ஜாமூன்', 'गुलाब जामुन', 'जामुन', 'dessert', 'sweet', 'hot'],
    locations: ['Chennai', 'Bengaluru', 'Delhi', 'Mumbai', 'All'],
    restaurant: 'A2B Adyar Ananda Bhavan',
    restaurantLat: 13.0010,
    restaurantLng: 80.2560,
    platforms: [
      { platform: 'swiggy', platformName: 'Swiggy', price: 70, originalPrice: 85, rating: 4.8, deliveryTime: 15, deliveryFee: 15, available: true },
      { platform: 'zomato', platformName: 'Zomato', price: 65, originalPrice: 85, rating: 4.7, deliveryTime: 18, deliveryFee: 15, available: true },
      { platform: 'magicpin', platformName: 'MagicPin', price: 60, originalPrice: 85, rating: 4.5, deliveryTime: 20, deliveryFee: 10, available: true },
      { platform: 'eatsure', platformName: 'EatSure', price: 75, originalPrice: 90, rating: 4.9, deliveryTime: 15, deliveryFee: 0, available: true }
    ]
  }
];

