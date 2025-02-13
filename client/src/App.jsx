import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, FeatureGroup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import './App.css'; 

const App = () => {
    const [areaCoordinates, setAreaCoordinates] = useState([]);
    const [networkSettings, setNetworkSettings] = useState(null);
    const [error, setError] = useState(null);
    const mapRef = useRef(null);
    const featureGroupRef = useRef(null);

    // Define France bounding box (to limit selection)
    const franceBounds = [
        [41.0, -5.0],  // Southwest corner (Spain border)
        [51.5, 10.0]   // Northeast corner (Germany border)
    ];

    // Function to fetch network settings from the backend
    const fetchNetworkSettings = async () => {
        if (!areaCoordinates || areaCoordinates.length === 0) {
            setError("Please select an area first!");
            return;
        }

        try {
            const response = await fetch(`http://localhost:8080/get-network-settings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ coordinates: areaCoordinates })
            });

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

    useEffect(() => {
        if (!mapRef.current) return;

        const map = L.map(mapRef.current, {
            center: [46.603354, 1.888334], // France center
            zoom: 6,
            maxBounds: franceBounds, 
            maxBoundsViscosity: 1.0  
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
            drawnItems.clearLayers();
            const layer = event.layer;
            drawnItems.addLayer(layer);

            if (layer instanceof L.Rectangle) {
                const bounds = layer.getBounds();

                // Generate multiple sample points within the rectangle
                const samplePoints = [];
                const numSamples = 5; // Number of points to sample

                for (let i = 0; i < numSamples; i++) {
                    const lat = bounds.getSouth() + (Math.random() * (bounds.getNorth() - bounds.getSouth()));
                    const lon = bounds.getWest() + (Math.random() * (bounds.getEast() - bounds.getWest()));
                    samplePoints.push({ latitude: lat, longitude: lon });
                }

                setAreaCoordinates(samplePoints);
            }
        });

        return () => {
            map.remove();
        };
    }, []);

    return (
        <div className="container">
            <h1>5G Network Area Configuration</h1>

            <div className="content">
                {/* Leaflet Map */}
                <div className="map-container">
                    <div ref={mapRef} className="map"></div>
                </div>

                {/* Information Panel */}
                <div className="info-panel">
                    <h2>Selected Area Data</h2>
                    <button className="btn" onClick={fetchNetworkSettings}>Get Configuration</button>

                    {networkSettings && (
                        <div className="results">
                            <h3>Recommended 5G Settings:</h3>
                            <p><strong>Sub-carrier width:</strong> {networkSettings.subCarrierWidth}</p>
                            <p><strong>Cyclic prefix:</strong> {networkSettings.cyclicPrefix}</p>
                            <p><strong>Average Speed:</strong> {parseFloat(networkSettings.avgSpeed).toFixed(2)}</p>
                            <p><strong>Population Density:</strong> {parseFloat(networkSettings.avgPopulation).toFixed(2)}</p>
                            <p><strong>Weather:</strong> {networkSettings.weather}</p>
                            <p><strong>Elevation:</strong> {parseFloat(networkSettings.elevation).toFixed(2)} meters</p>
                        </div>
                    )}

                    {error && <div className="error">{error}</div>}

                    <h3>Sampled Coordinates:</h3>
                    {areaCoordinates.length > 0 ? (
                        <div className="coordinates">
                            {areaCoordinates.map((point, index) => (
                                <div key={index} className="coordinate-item">
                                    <span className="label">Latitude:</span> {point.latitude.toFixed(6)}
                                    <span className="label">Longitude:</span> {point.longitude.toFixed(6)}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="no-data">No area selected.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default App;
