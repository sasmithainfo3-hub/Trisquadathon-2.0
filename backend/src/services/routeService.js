import { config } from '../config/env.js';

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export async function calculateRoute({ start, destination, travelMode = 'walking' }) {
  // 1. Try OpenRouteService if API key is provided
  if (config.openRouteService.isConfigured) {
    try {
      const profile = travelMode === 'driving' || travelMode === 'rideshare' ? 'driving-car' : travelMode === 'cycling' ? 'cycling-regular' : 'foot-walking';
      const url = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': config.openRouteService.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          coordinates: [
            [start.longitude, start.latitude],
            [destination.longitude, destination.latitude]
          ]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const feature = data.features?.[0];
        if (feature) {
          const coords = feature.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          const summary = feature.properties?.summary || {};
          return {
            coordinates: coords,
            distanceMeters: Math.round(summary.distance || 0),
            durationSeconds: Math.round(summary.duration || 0),
            provider: 'openrouteservice'
          };
        }
      }
    } catch (err) {
      console.warn('[SafePath Route] OpenRouteService call failed, trying OSRM:', err.message);
    }
  }

  // 2. Real road-network routing via OSRM (Open Source Routing Machine)
  try {
    const osrmProfile = travelMode === 'driving' || travelMode === 'rideshare' ? 'driving' : travelMode === 'cycling' ? 'bike' : 'foot';
    const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${start.longitude},${start.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const osrmRes = await fetch(osrmUrl, { signal: controller.signal, headers: { 'User-Agent': 'SafePath/1.0' } });
    clearTimeout(timeoutId);

    if (osrmRes.ok) {
      const osrmData = await osrmRes.json();
      const primaryRoute = osrmData.routes?.[0];
      if (primaryRoute && primaryRoute.geometry?.coordinates?.length > 0) {
        // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
        const coords = primaryRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        return {
          coordinates: coords,
          distanceMeters: Math.round(primaryRoute.distance),
          durationSeconds: Math.round(primaryRoute.duration),
          provider: 'osrm_road_network'
        };
      }
    }
  } catch (err) {
    console.warn('[SafePath Route] OSRM live road calculation failed or timed out:', err.message);
  }

  // 3. Fallback: direct geometry with intermediate waypoints if network is unreachable
  const dist = haversineDistanceMeters(start.latitude, start.longitude, destination.latitude, destination.longitude);
  const speed = travelMode === 'driving' || travelMode === 'rideshare' ? 8.33 : travelMode === 'cycling' ? 4.16 : 1.38;
  const durationSeconds = Math.round(dist / speed);

  const points = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const fraction = i / steps;
    const lat = start.latitude + (destination.latitude - start.latitude) * fraction;
    const lng = start.longitude + (destination.longitude - start.longitude) * fraction;
    points.push([lat, lng]);
  }

  return {
    coordinates: points,
    distanceMeters: Math.round(dist),
    durationSeconds,
    provider: 'direct_interpolation'
  };
}
