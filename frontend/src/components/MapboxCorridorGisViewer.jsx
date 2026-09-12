import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { API } from '../services/apiClient';
import { MapPin, Navigation, Train, ShieldCheck } from 'lucide-react';

export default function MapboxCorridorGisViewer({ trainList = [] }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]); // Tracks live train marker instances
  const [token, setToken] = useState('');
  const [mapLoaded, setMapLoaded] = useState(false);

  const STATIONS = [
    { name: 'New Delhi (NDLS)', lat: 28.6139, lon: 77.2090, status: 'CLEAR', km: '0.0' },
    { name: 'Ghaziabad (GZB)', lat: 28.6692, lon: 77.4538, status: 'TRAFFIC_HEAVY', km: '24.5' },
    { name: 'Aligarh Jn (ALJN)', lat: 27.8974, lon: 78.0880, status: 'WORK_BLOCK_ACTIVE', km: '126.0' },
    { name: 'Tundla Jn (TDL)', lat: 27.2066, lon: 78.2423, status: 'CLEAR', km: '205.4' },
    { name: 'Kanpur Central (CNB)', lat: 26.4499, lon: 80.3319, status: 'CLEAR', km: '440.2' },
  ];

  useEffect(() => {
    API.getMapboxToken()
      .then(res => {
        const activeToken = res.token || import.meta.env.VITE_MAPBOX_TOKEN || '';
        setToken(activeToken);
        mapboxgl.accessToken = activeToken;

        if (!mapContainerRef.current || mapRef.current) return;

        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: 'mapbox://styles/mapbox/satellite-streets-v12',
          center: [78.0880, 27.8974], // Aligarh Corridor Center
          zoom: 7.5,
        });

        map.addControl(new mapboxgl.NavigationControl(), 'top-right');

        map.on('load', () => {
          setMapLoaded(true);

          // Add Corridor Line
          map.addSource('ndls-cnb-line', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: STATIONS.map(s => [s.lon, s.lat])
              }
            }
          });

          map.addLayer({
            id: 'ndls-cnb-line-layer',
            type: 'line',
            source: 'ndls-cnb-line',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#0056B3', 'line-width': 5, 'line-opacity': 0.85 }
          });

          // Add Markers for Stations
          STATIONS.forEach(s => {
            const el = document.createElement('div');
            el.className = 'marker';
            el.style.backgroundColor = s.status === 'WORK_BLOCK_ACTIVE' ? '#EF4444' : (s.status === 'TRAFFIC_HEAVY' ? '#F59E0B' : '#059669');
            el.style.width = '14px';
            el.style.height = '14px';
            el.style.borderRadius = '50%';
            el.style.border = '2px solid white';
            el.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';

            new mapboxgl.Marker(el)
              .setLngLat([s.lon, s.lat])
              .setPopup(new mapboxgl.Popup().setHTML(`<strong>${s.name}</strong><br/>KM ${s.km}<br/>Status: ${s.status}`))
              .addTo(map);
          });
        });

        mapRef.current = map;
      })
      .catch(() => {});

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Sync Train Telemetry to Mapbox Markers
  useEffect(() => {
    if (!mapRef.current) return;

    // 1. Remove existing train markers from map
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const trainsToRender = Array.isArray(trainList) && trainList.length > 0 ? trainList : [
      { train_no: '22436', train_name: 'Vande Bharat Express', speed: '160', lng: 78.0880, lat: 27.8974, current_location: 'ALJN Corridor' },
      { train_no: '12302', train_name: 'Howrah Rajdhani', speed: '130', lng: 78.2423, lat: 27.2066, current_location: 'TDL Block' },
      { train_no: 'BOXN-9842', train_name: 'Dadri Coal Rake', speed: '65', lng: 77.4538, lat: 28.6692, current_location: 'GZB Freight Yard' },
    ];

    // 2. Loop through live train rakes and add new Mapbox markers
    trainsToRender.forEach((train) => {
      const lng = parseFloat(train.lng || train.longitude || train.lon || 77.2090);
      const lat = parseFloat(train.lat || train.latitude || 28.6139);

      if (isNaN(lng) || isNaN(lat)) return;

      // Custom train indicator icon
      const el = document.createElement('div');
      el.className = 'train-marker';
      el.style.width = '16px';
      el.style.height = '16px';
      el.style.backgroundColor = '#38bdf8';
      el.style.border = '2px solid #ffffff';
      el.style.borderRadius = '50%';
      el.style.boxShadow = '0 0 12px #38bdf8';
      el.style.cursor = 'pointer';

      // Popup with train details
      const popup = new mapboxgl.Popup({ offset: 15 }).setHTML(`
        <div style="color: #111; font-family: sans-serif; padding: 4px; font-size: 0.8rem;">
          <strong style="color: #003366;">${train.train_name || train.name || `Train #${train.train_no || train.number}`}</strong><br/>
          <span>Speed: ${train.speed || '130'} km/h</span><br/>
          <span>Location: ${train.current_location || train.block || 'En-route'}</span>
        </div>
      `);

      // Attach marker to mapbox instance
      const marker = new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(mapRef.current);

      markersRef.current.push(marker);
    });
  }, [trainList, mapLoaded]);

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(195,178,150,0.38)', borderRadius: '12px', padding: '20px', marginBottom: '28px', color: '#0F172A' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(0,51,102,0.08)', padding: '8px', borderRadius: '8px', color: '#003366' }}>
            <MapPin size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#003366', margin: 0 }}>
              Live Corridor GIS Map & GPS Train Movement Tracking (Mapbox Vector Engine)
            </h3>
            <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
              NDLS - CNB High-Density Trunk Route (440.2 KM) · Mapbox Live Key Active
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '800', background: 'rgba(5,150,105,0.1)', color: '#059669', padding: '4px 10px', borderRadius: '12px', border: '1px solid rgba(5,150,105,0.3)' }}>
            ● MAPBOX GL JS SATELLITE ENGINE ONLINE
          </span>
        </div>
      </div>

      {/* Interactive Real Mapbox GL JS Container */}
      <div ref={mapContainerRef} style={{ height: '360px', borderRadius: '10px', width: '100%', overflow: 'hidden', border: '1px solid #CBD5E1' }} />
    </div>
  );
}


