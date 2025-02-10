import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, FeatureGroup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';

const App = () => {
    const [areaCoordinates, setAreaCoordinates] = useState(null);
    const [networkSettings, setNetworkSettings] = useState(null);
    const [error, setError] = useState(null);
    const mapRef = useRef(null);
    const featureGroupRef = useRef(null);
    const franceBounds = [
        [41.0, -5.0],  // Southwest corner (near Spain)
        [51.5, 10.0]   // Northeast corner (near Germany)
    ];

    // Function to fetch network settings including elevation
    const fetchNetworkSettings = async () => {
        if (!areaCoordinates) {
            setError("Please select an area first!");
            return;
        }
    
        const { latitude, longitude } = areaCoordinates;
    
        try {
            const response = await fetch(`http://localhost:8080/get-network-settings?latitude=${latitude}&longitude=${longitude}`);
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }
    
            const data = await response.json();
            setNetworkSettings(data);
            setError(null);
        } catch (err) {
            setError("Error fetching network settings. Ensure the backend is running.");
            console.error("Fetch error:", err);
        }
    };
    

    // Function to initialize map and drawing controls
    useEffect(() => {
        if (!mapRef.current) return;

        const map = L.map(mapRef.current, {
            center: [46.603354, 1.888334], // France center
            zoom: 6,
            maxBounds: franceBounds, // Restrict movement
            maxBoundsViscosity: 1.0  // Prevent panning outside bounds
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

        const drawnItems = new L.FeatureGroup();
        featureGroupRef.current = drawnItems;
        map.addLayer(drawnItems);

        const drawControl = new L.Control.Draw({
            edit: { featureGroup: drawnItems },
            draw: {
                rectangle: true,
                polygon: false,
                circle: false,
                marker: false,
                polyline: false,
            },
        });

        map.addControl(drawControl);

        map.on('draw:created', (event) => {
            drawnItems.clearLayers(); // Clear previous rectangles
            const layer = event.layer;
            drawnItems.addLayer(layer);

            if (layer instanceof L.Rectangle) {
                const bounds = layer.getBounds();
                const center = bounds.getCenter(); // Get center of selected area
                setAreaCoordinates({ 
                    latitude: center.lat, 
                    longitude: center.lng 
                });
            }
        });

        return () => {
            map.remove();
        };
    }, []);

    return (
        <div>
            <h1>5G Network Area Configuration</h1>
            <div style={{ display: 'flex' }}>
                {/* Leaflet Map */}
                <div ref={mapRef} style={{ width: '70%', height: '500px' }}></div>

                {/* Information Panel */}
                <div style={{ width: '30%', paddingLeft: '20px' }}>
                    <h2>Selected Area Data</h2>
                    <button onClick={fetchNetworkSettings}>Get Configuration</button>

                    {networkSettings && (
                        <div>
                            <h3>Recommended 5G Settings:</h3>
                            <p><strong>Sub-carrier width:</strong> {networkSettings.subCarrierWidth}</p>
                            <p><strong>Frequency band:</strong> {networkSettings.frequencyBand}</p>
                            <p><strong>Cyclic prefix:</strong> {networkSettings.cyclicPrefix}</p>
                            <p><strong>Weather:</strong> {networkSettings.weather}</p>
                            <p><strong>Elevation:</strong> {networkSettings.elevation}</p>
                        </div>
                    )}

                    {error && <div style={{ color: 'red' }}><strong>{error}</strong></div>}

                    <h3>Coordinates of Selected Area:</h3>
                    {areaCoordinates ? (
                        <pre>{JSON.stringify(areaCoordinates, null, 2)}</pre>
                    ) : (
                        <p>No area selected.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default App;
