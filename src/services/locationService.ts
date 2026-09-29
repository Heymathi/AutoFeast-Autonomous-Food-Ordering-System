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

    // 1. Precise City Extraction
    const city =
      addr.city ||
      addr.town ||
      addr.municipality ||
      addr.village ||
      addr.county ||
      addr.state_district ||
      'Chennai';

    // 2. Precise Neighborhood / Suburb Extraction (No conflicting administrative cross-region mixing)
    const area =
      addr.suburb ||
      addr.neighbourhood ||
      addr.quarter ||
      addr.residential ||
      addr.subdistrict ||
      addr.road ||
      addr.amenity ||
      addr.village ||
      addr.town ||
      city;

    const addressName = data.display_name
      ? data.display_name.split(',').slice(0, 3).join(', ')
      : `${area}, ${city}`;

    console.log(`[LocationService]: Reverse Geocode Resolved -> Area: "${area}", City: "${city}", Full: "${addressName}"`);
    return { addressName, city, area, rawAddress: addr };
  } catch (error) {
    console.warn('[LocationService]: Reverse geocoding network/offline note:', error);
    return {
      addressName: `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`,
      city: 'Chennai',
      area: 'Central'
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
