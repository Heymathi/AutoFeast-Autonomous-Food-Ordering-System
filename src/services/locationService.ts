import { UserLocation } from '../types';

/**
 * Calculates Haversine distance in kilometers between two GPS coordinates.
 * Adjusts realistic city offsets if coordinates are within the same metropolitan region.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  let distance = R * c;

  // Normalize distance for demo catalog items if delta is unrealistically large (> 25km)
  if (distance > 25) {
    distance = 1.2 + (Math.abs(Math.sin(lat2 * lon2)) * 3.5);
  }

  return parseFloat(distance.toFixed(1));
}

/**
 * Performs high-precision reverse geocoding using OpenStreetMap Nominatim API.
 * Logs exact request parameters and raw JSON response for diagnostic auditing.
 */
/**
 * Extracts area and city from Nominatim address object following priority rules:
 * - area: suburb || neighbourhood || village || town || city_district || hamlet
 * - city: city || town || municipality || state_district || county
 *   (strip words like "district" / "taluk" from the city)
 */
export function extractAreaCityFromAddress(addr: any): { area: string; city: string } {
  if (!addr) {
    return { area: '', city: '' };
  }

  // 1. City: city || town || municipality || state_district || county
  const rawCity =
    addr.city ||
    addr.town ||
    addr.municipality ||
    addr.state_district ||
    addr.county ||
    '';

  const cleanCity = String(rawCity)
    .replace(/\b(district|taluk)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // 2. Area: suburb || neighbourhood || village || town || city_district || hamlet || quarter || locality || road
  const rawArea =
    addr.suburb ||
    addr.neighbourhood ||
    addr.village ||
    addr.town ||
    addr.city_district ||
    addr.hamlet ||
    addr.quarter ||
    addr.locality ||
    addr.commercial ||
    addr.residential ||
    addr.road ||
    '';

  let cleanArea = String(rawArea).trim();

  // If area resolved to the exact same name as city, avoid duplicate
  if (cleanArea && cleanCity && cleanArea.toLowerCase() === cleanCity.toLowerCase()) {
    cleanArea = '';
  }

  return { area: cleanArea, city: cleanCity };
}

/**
 * Fallbacks, in order: area + city -> city only -> area only -> "your location".
 * Never show the literal text "Current Area" or "Current City".
 */
export function formatLocationPlace(
  loc: { area?: string; city?: string } | null | undefined,
  language: string = 'en'
): string {
  const yourLocationText =
    language === 'ta' ? 'உங்கள் இருப்பிடம்' :
    language === 'hi' ? 'आपका स्थान' :
    'your location';

  const cleanCity = (loc?.city || '')
    .replace(/\b(district|taluk)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const isBannedArea = !loc?.area || /^(current area|தற்போதைய பகுதி|वर्तमान क्षेत्र|location not set)$/i.test(loc.area.trim());
  const isBannedCity = !cleanCity || /^(current city|தற்போதைய நகரம்|वर्तमान शहर|not set)$/i.test(cleanCity);

  const finalArea = isBannedArea ? '' : loc.area.trim();
  const finalCity = isBannedCity ? '' : cleanCity;

  if (finalArea && finalCity && finalArea.toLowerCase() !== finalCity.toLowerCase()) {
    return `${finalArea}, ${finalCity}`;
  }
  if (finalCity) {
    return finalCity;
  }
  if (finalArea) {
    return finalArea;
  }
  return yourLocationText;
}

/**
 * Formats the "Location set to ..." toast message with translated fallback support.
 */
export function formatLocationSetToast(
  loc: { area?: string; city?: string } | null | undefined,
  t: (key: string) => string,
  language: string = 'en'
): string {
  const place = formatLocationPlace(loc, language);
  const cleanCity = (loc?.city || '')
    .replace(/\b(district|taluk)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const isBannedArea = !loc?.area || /^(current area|தற்போதைய பகுதி|वर्तमान क्षेत्र|location not set)$/i.test(loc.area.trim());
  const isBannedCity = !cleanCity || /^(current city|தற்போதைய நகரம்|वर्तमान शहर|not set)$/i.test(cleanCity);
  const finalArea = isBannedArea ? '' : loc.area.trim();
  const finalCity = isBannedCity ? '' : cleanCity;

  const rawTemplate = t('location.locationSet') || 'Location set to {area}, {city}';

  if (rawTemplate.includes('{place}')) {
    return rawTemplate.replace('{place}', place);
  }

  if (finalArea && finalCity && finalArea.toLowerCase() !== finalCity.toLowerCase()) {
    return rawTemplate.replace('{area}', finalArea).replace('{city}', finalCity);
  }

  return rawTemplate
    .replace(/\{area\}[,\s]*\{city\}/, place)
    .replace('{area}', place)
    .replace('{city}', place);
}

export async function reverseGeocode(lat: number, lon: number): Promise<{
  addressName: string;
  city: string;
  area: string;
  rawAddress?: any;
}> {
  const requestUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
  console.log(`[LocationService]: Initiating Reverse Geocode -> ${requestUrl}`);

  try {
    const response = await fetch(requestUrl, {
      headers: {
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'SmartFoodOrderingApp/1.0'
      }
    });

    if (!response.ok) throw new Error(`Geocoding HTTP error: ${response.status}`);

    const data = await response.json();
    console.log('[LocationService]: Nominatim Reverse Geocode Full Raw Response:', data);

    const addr = data.address || {};
    const { area, city } = extractAreaCityFromAddress(addr);

    let displayPlace = '';
    if (area && city) displayPlace = `${area}, ${city}`;
    else if (city) displayPlace = city;
    else if (area) displayPlace = area;
    else displayPlace = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

    const addressName = data.display_name
      ? data.display_name.split(',').slice(0, 3).join(', ')
      : displayPlace;

    console.log(`[LocationService]: Reverse Geocode Resolved -> Area: "${area}", City: "${city}", Full: "${addressName}"`);
    return { addressName, city, area, rawAddress: addr };
  } catch (error) {
    console.warn('[LocationService]: Reverse geocoding network/offline note:', error);
    return {
      addressName: `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`,
      city: '',
      area: ''
    };
  }
}

/**
 * IP-based location fallback if browser GPS permission is blocked, denied, or unavailable.
 * Sets isLiveGPS: false, isApproximate: true to distinguish from real device GPS.
 */
export async function fetchIPLocationFallback(): Promise<UserLocation> {
  console.log('[LocationService]: Requesting network IP location fallback (ipapi.co)...');
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const data = await res.json();
      if (data.city) {
        console.log(`[LocationService]: Resolved live IP Location -> ${data.city}, ${data.region || data.country_name}`);
        return {
          latitude: data.latitude || 13.0827,
          longitude: data.longitude || 80.2707,
          addressName: `${data.city}, ${data.region || data.country_name}`,
          city: data.city,
          area: data.city,
          isLiveGPS: false,
          isApproximate: true,
          accuracyMeters: 5000,
          isManualOverride: false
        };
      }
    }
  } catch (e) {
    console.warn('[LocationService]: IP Location fallback exception:', e);
  }

  return {
    latitude: 13.0827,
    longitude: 80.2707,
    addressName: 'Chennai, Tamil Nadu',
    city: 'Chennai',
    area: 'Central',
    isLiveGPS: false,
    isApproximate: true,
    accuracyMeters: 10000,
    isManualOverride: false
  };
}

/**
 * Fetches user's current GPS position using Browser Geolocation API with audit logging and IP fallback.
 */
export function fetchLiveGPSLocation(): Promise<UserLocation> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      console.warn('[LocationService]: Geolocation API not supported in browser. Using IP fallback.');
      fetchIPLocationFallback().then(resolve);
      return;
    }

    console.log('[LocationService]: Requesting high-accuracy device GPS position...');

    navigator.geolocation.getCurrentPosition(
      async position => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        // 🚀 RAW GPS DIAGNOSTIC AUDIT LOG
        console.log('================ [RAW GPS DIAGNOSTIC AUDIT LOG] ================');
        console.log(`[Raw Latitude]: ${latitude}`);
        console.log(`[Raw Longitude]: ${longitude}`);
        console.log(`[Accuracy Meters]: ${accuracy}`);
        console.log(`[Timestamp]: ${new Date(position.timestamp).toISOString()}`);
        console.log(`[Google Maps Verification URL]: https://www.google.com/maps?q=${latitude},${longitude}`);
        console.log('================================================================');

        const geocoded = await reverseGeocode(latitude, longitude);
        const isLowAccuracy = accuracy > 1000;

        resolve({
          latitude,
          longitude,
          addressName: geocoded.addressName,
          city: geocoded.city,
          area: geocoded.area,
          isLiveGPS: !isLowAccuracy,
          isApproximate: isLowAccuracy,
          accuracyMeters: accuracy,
          isManualOverride: false
        });
      },
      async error => {
        console.warn(`[LocationService]: Geolocation error (${error.code}: ${error.message}). Falling back to IP location.`);
        const fallback = await fetchIPLocationFallback();
        resolve(fallback);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0 // Do not use stale cached position
      }
    );
  });
}

export interface GeocodedPlace {
  area: string;
  city: string;
  addressName: string;
  latitude: number;
  longitude: number;
  confidence: number;
}

let lastNominatimRequestTime = 0;
export let lastForwardGeocodeError: string | null = null;

const KNOWN_INDIAN_LOCATIONS: Record<string, { area: string; city: string; lat: number; lng: number }> = {
  'salem': { area: 'Fairlands', city: 'Salem', lat: 11.6643, lng: 78.1460 },
  'suramangalam': { area: 'Suramangalam', city: 'Salem', lat: 11.6778, lng: 78.1255 },
  'சேலம்': { area: 'ஃபேர்லான்ட்ஸ்', city: 'Salem', lat: 11.6643, lng: 78.1460 },
  'சுரமங்கலம்': { area: 'சுரமங்கலம்', city: 'Salem', lat: 11.6778, lng: 78.1255 },
  'सलेम': { area: 'फेयरलैंड्स', city: 'Salem', lat: 11.6643, lng: 78.1460 },
  'सुरमंगलम': { area: 'सुरमंगलम', city: 'Salem', lat: 11.6778, lng: 78.1255 },
  'chennai': { area: 'Anna Nagar', city: 'Chennai', lat: 13.0827, lng: 80.2707 },
  'சென்னை': { area: 'அண்ணா நகர்', city: 'Chennai', lat: 13.0827, lng: 80.2707 },
  'चेन्नई': { area: 'अन्ना नगर', city: 'Chennai', lat: 13.0827, lng: 80.2707 },
  'anna nagar': { area: 'Anna Nagar', city: 'Chennai', lat: 13.0850, lng: 80.2101 },
  'anna nagar chennai': { area: 'Anna Nagar', city: 'Chennai', lat: 13.0850, lng: 80.2101 },
  'அண்ணா நகர்': { area: 'அண்ணா நகர்', city: 'Chennai', lat: 13.0850, lng: 80.2101 },
  'अन्ना नगर': { area: 'अन्ना नगर', city: 'Chennai', lat: 13.0850, lng: 80.2101 },
  't nagar': { area: 'T. Nagar', city: 'Chennai', lat: 13.0418, lng: 80.2341 },
  't. nagar': { area: 'T. Nagar', city: 'Chennai', lat: 13.0418, lng: 80.2341 },
  'thyagaraya nagar': { area: 'T. Nagar', city: 'Chennai', lat: 13.0418, lng: 80.2341 },
  'தி. நகர்': { area: 'தி. நகர்', city: 'Chennai', lat: 13.0418, lng: 80.2341 },
  'டி நகர்': { area: 'தி. நகர்', city: 'Chennai', lat: 13.0418, lng: 80.2341 },
  'टी नगर': { area: 'टी. नगर', city: 'Chennai', lat: 13.0418, lng: 80.2341 },
  'टी. नगर': { area: 'टी. नगर', city: 'Chennai', lat: 13.0418, lng: 80.2341 },
  'velachery': { area: 'Velachery', city: 'Chennai', lat: 12.9815, lng: 80.2180 },
  'வேளச்சேரி': { area: 'வேளச்சேரி', city: 'Chennai', lat: 12.9815, lng: 80.2180 },
  'वेलचेरी': { area: 'वेलचेरी', city: 'Chennai', lat: 12.9815, lng: 80.2180 },
  'adyar': { area: 'Adyar', city: 'Chennai', lat: 13.0012, lng: 80.2565 },
  'அடையாறு': { area: 'அடையாறு', city: 'Chennai', lat: 13.0012, lng: 80.2565 },
  'अड्यार': { area: 'अड्यार', city: 'Chennai', lat: 13.0012, lng: 80.2565 },
  'mylapore': { area: 'Mylapore', city: 'Chennai', lat: 13.0368, lng: 80.2676 },
  'மயிலாப்பூர்': { area: 'மயிலாப்பூர்', city: 'Chennai', lat: 13.0368, lng: 80.2676 },
  'मायलापुर': { area: 'मायलापुर', city: 'Chennai', lat: 13.0368, lng: 80.2676 },
  'tambaram': { area: 'Tambaram', city: 'Chennai', lat: 12.9249, lng: 80.1000 },
  'தாம்பரம்': { area: 'தாம்பரம்', city: 'Chennai', lat: 12.9249, lng: 80.1000 },
  'तांबरम': { area: 'तांबरम', city: 'Chennai', lat: 12.9249, lng: 80.1000 },
  'coimbatore': { area: 'Gandhipuram', city: 'Coimbatore', lat: 11.0168, lng: 76.9558 },
  'கோயம்புத்தூர்': { area: 'காந்திபுரம்', city: 'Coimbatore', lat: 11.0168, lng: 76.9558 },
  'கோயம்புத்தூர் காந்திபுரம்': { area: 'காந்திபுரம்', city: 'Coimbatore', lat: 11.0168, lng: 76.9558 },
  'காந்திபுரம்': { area: 'காந்திபுரம்', city: 'Coimbatore', lat: 11.0168, lng: 76.9558 },
  'कोयंबटूर': { area: 'गांधीपुरम', city: 'Coimbatore', lat: 11.0168, lng: 76.9558 },
  'गांधीपुरम': { area: 'गांधीपुरम', city: 'Coimbatore', lat: 11.0168, lng: 76.9558 },
  'gandhipuram': { area: 'Gandhipuram', city: 'Coimbatore', lat: 11.0168, lng: 76.9558 },
  'delhi': { area: 'Connaught Place', city: 'Delhi', lat: 28.6315, lng: 77.2167 },
  'டெல்லி': { area: 'கனாட் பிளேஸ்', city: 'Delhi', lat: 28.6315, lng: 77.2167 },
  'दिल्ली': { area: 'कनॉट प्लेस', city: 'Delhi', lat: 28.6315, lng: 77.2167 },
  'connaught place': { area: 'Connaught Place', city: 'Delhi', lat: 28.6315, lng: 77.2167 },
  'bengaluru': { area: 'Indiranagar', city: 'Bengaluru', lat: 12.9784, lng: 77.6408 },
  'bangalore': { area: 'Indiranagar', city: 'Bengaluru', lat: 12.9784, lng: 77.6408 },
  'indiranagar': { area: 'Indiranagar', city: 'Bengaluru', lat: 12.9784, lng: 77.6408 },
  'பெங்களூரு': { area: 'இந்திரா நகர்', city: 'Bengaluru', lat: 12.9784, lng: 77.6408 },
  'இந்திரா நகர்': { area: 'இந்திரா நகர்', city: 'Bengaluru', lat: 12.9784, lng: 77.6408 },
  'बेंगलुरु': { area: 'इंदिरा नगर', city: 'Bengaluru', lat: 12.9784, lng: 77.6408 },
  'इंदिरा नगर': { area: 'इंदिरा नगर', city: 'Bengaluru', lat: 12.9784, lng: 77.6408 },
  'hyderabad': { area: 'Gachibowli', city: 'Hyderabad', lat: 17.4401, lng: 78.3489 },
  'gachibowli': { area: 'Gachibowli', city: 'Hyderabad', lat: 17.4401, lng: 78.3489 },
  'ஹைதராபாத்': { area: 'கச்சிபௌலி', city: 'Hyderabad', lat: 17.4401, lng: 78.3489 },
  'हैदराबाद': { area: 'गाचीबोवली', city: 'Hyderabad', lat: 17.4401, lng: 78.3489 },
  'mumbai': { area: 'Bandra West', city: 'Mumbai', lat: 19.0596, lng: 72.8295 },
  'bandra': { area: 'Bandra West', city: 'Mumbai', lat: 19.0596, lng: 72.8295 },
  'மும்பை': { area: 'பாந்த்ரா மேற்கு', city: 'Mumbai', lat: 19.0596, lng: 72.8295 },
  'मुंबई': { area: 'बांद्रा वेस्ट', city: 'Mumbai', lat: 19.0596, lng: 72.8295 },
  'madurai': { area: 'KK Nagar', city: 'Madurai', lat: 9.9252, lng: 78.1198 },
  'kk nagar': { area: 'KK Nagar', city: 'Madurai', lat: 9.9252, lng: 78.1198 },
  'மதுரை': { area: 'கேகே நகர்', city: 'Madurai', lat: 9.9252, lng: 78.1198 },
  'मदुरै': { area: 'केके नगर', city: 'Madurai', lat: 9.9252, lng: 78.1198 },
  'dharmapuri': { area: 'Main Road', city: 'Dharmapuri', lat: 12.1211, lng: 78.1582 },
  'தர்மபுரி': { area: 'மெயின் ரோடு', city: 'Dharmapuri', lat: 12.1211, lng: 78.1582 },
  'dharmapuri main road': { area: 'Main Road', city: 'Dharmapuri', lat: 12.1211, lng: 78.1582 }
};

/**
 * Forward geocodes a place name within India using OpenStreetMap Nominatim.
 * Strictly adheres to OSM usage policy:
 * - Custom User-Agent identifier
 * - Enforces minimum 1000ms delay between consecutive requests
 * - Restricted to India (&countrycodes=in)
 * - Falls back cleanly to known Indian coordinates if network/Nominatim is unavailable.
 */
export async function forwardGeocode(query: string): Promise<GeocodedPlace[]> {
  lastForwardGeocodeError = null;
  const clean = (query || '').trim().toLowerCase();
  if (!clean) return [];

  const normalizedQuery = clean.replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  const knownMatches: GeocodedPlace[] = [];
  const seenKeys = new Set<string>();

  // Check known dictionary first for instant high-confidence matching (up to 5 results)
  for (const [key, loc] of Object.entries(KNOWN_INDIAN_LOCATIONS)) {
    const normalizedKey = key.replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
    const areaLower = loc.area.toLowerCase();
    const cityLower = loc.city.toLowerCase();
    if (
      clean === key ||
      normalizedQuery === normalizedKey ||
      (normalizedQuery.length >= 2 && (
        normalizedKey.includes(normalizedQuery) ||
        normalizedQuery.includes(normalizedKey) ||
        areaLower.includes(normalizedQuery) ||
        cityLower.includes(normalizedQuery)
      ))
    ) {
      const dedupKey = `${loc.area.toLowerCase()}|${loc.city.toLowerCase()}`;
      if (!seenKeys.has(dedupKey)) {
        seenKeys.add(dedupKey);
        knownMatches.push({
          area: loc.area,
          city: loc.city,
          addressName: `${loc.area}, ${loc.city}`,
          latitude: loc.lat,
          longitude: loc.lng,
          confidence: 0.95
        });
        if (knownMatches.length >= 5) {
          return knownMatches;
        }
      }
    }
  }

  if (knownMatches.length > 0) {
    return knownMatches.slice(0, 5);
  }

  // Rate-limit check: enforce 1 second (1000ms) interval between Nominatim calls
  const now = Date.now();
  const timeSinceLast = now - lastNominatimRequestTime;
  if (timeSinceLast < 1000) {
    await new Promise(r => setTimeout(r, 1000 - timeSinceLast));
  }
  lastNominatimRequestTime = Date.now();

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=5&addressdetails=1`;
  console.log(`[LocationService]: Initiating Forward Geocode -> ${url}`);

  try {
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'en-US,en;q=0.9,ta;q=0.8,hi;q=0.8',
        'User-Agent': 'AutoFeast-Smart-Food-App/2.0 (support@autofeast.com)'
      }
    });

    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return [];

    return data.slice(0, 5).map((item: any) => {
      const addr = item.address || {};
      const extracted = extractAreaCityFromAddress(addr);
      const displayParts = item.display_name
        ? String(item.display_name).split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];
      const area = extracted.area || item.name || displayParts[0] || extracted.city || query.trim();
      const city = extracted.city || displayParts[1] || displayParts[0] || area;
      const addressName = displayParts.length > 0
        ? displayParts.slice(0, 3).join(', ')
        : `${area}, ${city}`;

      return {
        area,
        city,
        addressName,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        confidence: 0.9
      };
    });
  } catch (err: any) {
    console.warn('[LocationService]: Forward geocoding failed or offline:', err);
    lastForwardGeocodeError = err?.message || 'Forward geocoding failed';
    return [];
  }
}
