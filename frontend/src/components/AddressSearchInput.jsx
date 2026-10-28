import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Locate, Loader2, X } from 'lucide-react';

export default function AddressSearchInput({
  label,
  placeholder = 'Search place, building, or address...',
  value = '',
  onChange,
  onSelectLocation,
  showCurrentLocationButton = false,
  proximityCoords = null,
  className = ''
}) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [locatingCurrent, setLocatingCurrent] = useState(false);

  const containerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Click outside to dismiss dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchAddress = async (text) => {
    if (!text || text.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        text
      )}&limit=6&addressdetails=1`;

      if (proximityCoords?.latitude && proximityCoords?.longitude) {
        const { latitude: lat, longitude: lon } = proximityCoords;
        url += `&viewbox=${lon - 2.0},${lat + 2.0},${lon + 2.0},${lat - 2.0}&bounded=0`;
      }

      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en' }
      });

      if (res.ok) {
        const data = await res.json();
        setSuggestions(data || []);
        setIsOpen(true);
      }
    } catch (err) {
      console.warn('Address search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (onChange) onChange(val);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      searchAddress(val);
    }, 300);
  };

  const handleSelect = (item) => {
    const address = item.display_name;
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);

    setQuery(address);
    setIsOpen(false);
    setSuggestions([]);

    if (onChange) onChange(address);
    if (onSelectLocation) {
      onSelectLocation({
        address,
        latitude: lat,
        longitude: lon
      });
    }
  };

  const handleUseCurrentGPS = async () => {
    setLocatingCurrent(true);

    // Try HTML5 high-accuracy GPS
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          let resolvedAddress = `Live GPS Position (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;

          try {
            const revRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
              { headers: { 'Accept-Language': 'en' } }
            );
            if (revRes.ok) {
              const revData = await revRes.json();
              if (revData.display_name) {
                resolvedAddress = revData.display_name;
              }
            }
          } catch (e) {
            // fallback
          }

          setQuery(resolvedAddress);
          setLocatingCurrent(false);
          setIsOpen(false);

          if (onChange) onChange(resolvedAddress);
          if (onSelectLocation) {
            onSelectLocation({
              address: resolvedAddress,
              latitude,
              longitude,
              accuracy: accuracy || 10
            });
          }
        },
        async (err) => {
          console.warn('GPS permission denied or timeout, trying IP fallback:', err.message);
          await fallbackToIP();
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      await fallbackToIP();
    }
  };

  const fallbackToIP = async () => {
    try {
      const ipRes = await fetch('https://freeipapi.com/api/json');
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        if (ipData.latitude && ipData.longitude) {
          const address = `${ipData.cityName || 'City'}, ${ipData.regionName || ''}, ${ipData.countryName || 'Location'}`;
          setQuery(address);
          setLocatingCurrent(false);
          setIsOpen(false);

          if (onChange) onChange(address);
          if (onSelectLocation) {
            onSelectLocation({
              address,
              latitude: ipData.latitude,
              longitude: ipData.longitude,
              accuracy: 500
            });
          }
          return;
        }
      }
    } catch (e) {
      console.warn('IP fallback failed:', e);
    }
    setLocatingCurrent(false);
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    if (onChange) onChange('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && <label className="block text-xs font-semibold text-slate-300 mb-1.5">{label}</label>}

      <div className="relative flex items-center">
        <MapPin className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />

        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full pl-9 pr-20 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {loading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin mr-1" />}

          {query && !loading && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-500 hover:text-slate-300 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {showCurrentLocationButton && (
            <button
              type="button"
              onClick={handleUseCurrentGPS}
              disabled={locatingCurrent}
              title="Use current device GPS location"
              className="p-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-400 border border-indigo-700/50 flex items-center gap-1 text-[11px] font-semibold transition-all active:scale-95 disabled:opacity-50"
            >
              {locatingCurrent ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Locate className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">GPS</span>
            </button>
          )}
        </div>
      </div>

      {/* Floating Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden z-[1050] max-h-60 overflow-y-auto divide-y divide-slate-800 animate-in fade-in slide-in-from-top-1">
          {suggestions.map((item) => {
            const parts = (item.display_name || '').split(',');
            const primary = parts[0];
            const secondary = parts.slice(1).join(',').trim();

            return (
              <button
                key={item.place_id || item.lat + item.lon}
                type="button"
                onClick={() => handleSelect(item)}
                className="w-full text-left px-3.5 py-2.5 hover:bg-slate-800/90 transition-colors flex items-start gap-2.5 group"
              >
                <MapPin className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{primary}</p>
                  {secondary && <p className="text-[11px] text-slate-400 truncate mt-0.5">{secondary}</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
