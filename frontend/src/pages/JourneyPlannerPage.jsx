import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation, Clock, Shield, Sparkles, AlertCircle, ArrowRight, Route, Compass, Info, MapPin, CheckCircle2, Locate } from 'lucide-react';
import { api } from '../utils/api';
import LocationMap from '../components/LocationMap';
import AddressSearchInput from '../components/AddressSearchInput';

export default function JourneyPlannerPage() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('Commute Journey');
  const [startAddress, setStartAddress] = useState('');
  const [startCoords, setStartCoords] = useState(null);

  const [destinationAddress, setDestinationAddress] = useState('');
  const [destinationCoords, setDestinationCoords] = useState(null);

  const [travelMode, setTravelMode] = useState('walking');
  const [checkInInterval, setCheckInInterval] = useState(15);
  const [expectedDurationMinutes, setExpectedDurationMinutes] = useState(30);
  const [routeInfo, setRouteInfo] = useState({ coordinates: [], distanceKm: null, durationMins: null });
  const [notes, setNotes] = useState('');
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [clickMode, setClickMode] = useState('destination'); // 'destination' or 'departure'
  const [pinNotice, setPinNotice] = useState(null);

  // Fast auto-detection of user's real location (IP geolocation + GPS refinement)
  useEffect(() => {
    let isCancelled = false;

    async function detectInitialLocation() {
      // 1. Instant IP geolocation (zero permission required, sets real city/country immediately)
      try {
        const ipRes = await fetch('https://freeipapi.com/api/json');
        if (ipRes.ok && !isCancelled) {
          const ipData = await ipRes.json();
          if (ipData.latitude && ipData.longitude) {
            const locName = `${ipData.cityName || 'City'}, ${ipData.regionName || ''}, ${ipData.countryName || 'Location'}`;
            setStartCoords((prev) => prev || { latitude: ipData.latitude, longitude: ipData.longitude, accuracy: 500 });
            setStartAddress((prev) => prev || locName);
          }
        }
      } catch (e) {
        console.warn('IP geolocation check skipped:', e);
      }

      // 2. High-accuracy GPS refinement if browser permits
      if (navigator.geolocation && !isCancelled) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            if (isCancelled) return;
            const { latitude, longitude, accuracy } = pos.coords;
            setStartCoords({ latitude, longitude, accuracy });

            let address = `Live GPS Position (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
            try {
              const rev = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                { headers: { 'Accept-Language': 'en' } }
              );
              if (rev.ok) {
                const data = await rev.json();
                if (data.display_name) address = data.display_name;
              }
            } catch (e) {
              // fallback to coords
            }

            if (!isCancelled) {
              setStartAddress(address);
            }
          },
          (err) => {
            console.warn('GPS refinement skipped or denied:', err.message);
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      }
    }

    detectInitialLocation();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Fetch real street road route whenever Start or Destination changes
  const updateRoute = useCallback(async (start, dest, mode) => {
    if (!start?.latitude || !dest?.latitude) return;

    setCalculatingRoute(true);
    try {
      const osrmProfile = mode === 'driving' || mode === 'rideshare' ? 'driving' : mode === 'cycling' ? 'bike' : 'foot';
      const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${start.longitude},${start.latitude};${dest.longitude},${dest.latitude}?overview=full&geometries=geojson`;

      const res = await fetch(osrmUrl);
      if (res.ok) {
        const data = await res.json();
        const primaryRoute = data.routes?.[0];
        if (primaryRoute) {
          const coords = primaryRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          const distKm = (primaryRoute.distance / 1000).toFixed(1);
          const durationMins = Math.ceil(primaryRoute.duration / 60);

          setRouteInfo({
            coordinates: coords,
            distanceKm: distKm,
            durationMins
          });

          // Suggest duration with buffer
          setExpectedDurationMinutes(Math.max(10, Math.round(durationMins * 1.25)));
        }
      }
    } catch (err) {
      console.warn('Failed to calculate road route:', err);
    } finally {
      setCalculatingRoute(false);
    }
  }, []);

  useEffect(() => {
    if (startCoords && destinationCoords) {
      updateRoute(startCoords, destinationCoords, travelMode);
    }
  }, [startCoords, destinationCoords, travelMode, updateRoute]);

  // Handle map click to place either Destination or Departure
  const handleMapClick = async ({ latitude, longitude }) => {
    let address = `Map Pin (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;

    try {
      const rev = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
        { headers: { 'Accept-Language': 'en' } }
      );
      if (rev.ok) {
        const data = await rev.json();
        if (data.display_name) address = data.display_name;
      }
    } catch (e) {
      // fallback
    }

    if (clickMode === 'destination') {
      setDestinationCoords({ latitude, longitude });
      setDestinationAddress(address);
      setPinNotice(`Destination Pin (B) placed at: ${address.slice(0, 45)}...`);
    } else {
      setStartCoords({ latitude, longitude, accuracy: 20 });
      setStartAddress(address);
      setPinNotice(`Departure Pin (A) placed at: ${address.slice(0, 45)}...`);
    }

    setTimeout(() => setPinNotice(null), 4000);
  };

  const handleStartDrag = async (coords) => {
    setStartCoords((prev) => ({ ...(prev || {}), ...coords }));
    try {
      const rev = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}`
      );
      if (rev.ok) {
        const data = await rev.json();
        if (data.display_name) setStartAddress(data.display_name);
      }
    } catch (e) {}
  };

  const handleDestinationDrag = async (coords) => {
    setDestinationCoords(coords);
    try {
      const rev = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}`
      );
      if (rev.ok) {
        const data = await rev.json();
        if (data.display_name) setDestinationAddress(data.display_name);
      }
    } catch (e) {}
  };

  const handleStartNow = async (e) => {
    e.preventDefault();
    if (!startCoords || !destinationCoords) {
      setError('Please specify both departure and destination locations.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const expectedArrivalAt = new Date(Date.now() + expectedDurationMinutes * 60000).toISOString();

    try {
      // 1. Create Trip with real coordinates and geometry
      const createRes = await api.post('/trips', {
        title,
        startLocation: {
          address: startAddress || 'Departure Location',
          latitude: startCoords.latitude,
          longitude: startCoords.longitude
        },
        destination: {
          address: destinationAddress || 'Destination Location',
          latitude: destinationCoords.latitude,
          longitude: destinationCoords.longitude
        },
        travelMode,
        checkInIntervalMinutes: Number(checkInInterval),
        expectedArrivalAt,
        notes
      });

      if (!createRes.success) throw new Error(createRes.message || 'Failed to plan trip');

      // 2. Start Trip immediately
      const startRes = await api.post(`/trips/${createRes.trip._id}/start`);
      if (startRes.success) {
        navigate('/active');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Failed to initialize journey.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
          <Navigation className="w-7 h-7 text-indigo-400" />
          <span>Real-Time Journey Planner</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Search real places, tap the map to fix your destination, and preview turn-by-turn road routes with active check-ins.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/60 border border-rose-500/50 rounded-2xl text-xs text-rose-300 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {pinNotice && (
        <div className="p-3 bg-emerald-950/70 border border-emerald-500/50 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{pinNotice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form Column */}
        <form onSubmit={handleStartNow} className="lg:col-span-5 space-y-5">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5 shadow-xl">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Journey Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Walk to Transit Hub"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Departure */}
            <AddressSearchInput
              label="Departure Location (A)"
              placeholder="Search departure address or click GPS..."
              value={startAddress}
              onChange={setStartAddress}
              showCurrentLocationButton={true}
              proximityCoords={startCoords}
              onSelectLocation={(loc) => {
                setStartAddress(loc.address);
                setStartCoords({ latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy });
              }}
            />

            {/* Destination */}
            <AddressSearchInput
              label="Destination (B)"
              placeholder="Search destination, building, station or tap map..."
              value={destinationAddress}
              onChange={setDestinationAddress}
              proximityCoords={startCoords}
              onSelectLocation={(loc) => {
                setDestinationAddress(loc.address);
                setDestinationCoords({ latitude: loc.latitude, longitude: loc.longitude });
              }}
            />

            {/* Map Click Mode Selector */}
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                Tap Map Sets:
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setClickMode('destination')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    clickMode === 'destination'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Pin B (Destination)
                </button>
                <button
                  type="button"
                  onClick={() => setClickMode('departure')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    clickMode === 'departure'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Pin A (Start)
                </button>
              </div>
            </div>

            {/* Travel Mode & Check-in cadence */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Travel Mode</label>
                <select
                  value={travelMode}
                  onChange={(e) => setTravelMode(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="walking">🚶 Walking</option>
                  <option value="transit">🚇 Transit</option>
                  <option value="driving">🚗 Driving</option>
                  <option value="rideshare">🚕 Rideshare</option>
                  <option value="cycling">🚲 Cycling</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Check-in Cadence</label>
                <select
                  value={checkInInterval}
                  onChange={(e) => setCheckInInterval(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="5">Every 5 minutes</option>
                  <option value="10">Every 10 minutes</option>
                  <option value="15">Every 15 minutes</option>
                  <option value="20">Every 20 minutes</option>
                  <option value="30">Every 30 minutes</option>
                </select>
              </div>
            </div>

            {/* Expected Duration */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">Expected Arrival Target</label>
                <span className="text-xs text-indigo-400 font-bold">~{expectedDurationMinutes} min</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setExpectedDurationMinutes(mins)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      expectedDurationMinutes === mins
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    +{mins}m
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Optional Safety Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Taking main road, walking with friend..."
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-black text-sm rounded-2xl shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
          >
            <span>{submitting ? 'Initializing Safety Relay...' : 'Start Monitored Journey Now'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Right Map Column */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Route className="w-5 h-5 text-indigo-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Live Route Map</h2>
              </div>
              {calculatingRoute ? (
                <span className="text-xs text-indigo-400 animate-pulse font-medium">Computing real streets...</span>
              ) : routeInfo.distanceKm ? (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/30 text-emerald-300">
                  {routeInfo.distanceKm} km (~{routeInfo.durationMins} min)
                </span>
              ) : (
                <span className="text-xs text-slate-500">Google Maps Roads</span>
              )}
            </div>

            <LocationMap
              height="450px"
              currentLocation={startCoords}
              startLocation={startCoords ? { ...startCoords, address: startAddress } : null}
              destination={destinationCoords ? { ...destinationCoords, address: destinationAddress } : null}
              routeCoordinates={routeInfo.coordinates}
              onMapClick={handleMapClick}
              onStartDrag={handleStartDrag}
              onDestinationDrag={handleDestinationDrag}
            />

            {/* Waypoint Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Start (A)
                </span>
                <p className="text-slate-300 truncate font-medium">{startAddress || 'Detecting live location...'}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                <span className="font-bold text-rose-400 flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  Destination (B)
                </span>
                <p className="text-slate-300 truncate font-medium">
                  {destinationAddress || 'Search or tap directly on the map to place Pin B'}
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              SafePath prompts you every {checkInInterval} minutes. If unacknowledged within grace period, the Safety Relay escalates to your verified circle.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
