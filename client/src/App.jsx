import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Rectangle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw'; 

const App = () => {
    const [areaCoordinates, setAreaCoordinates] = useState([[51.505, -0.09], [51.51, -0.1]]);
    const [networkSettings, setNetworkSettings] = useState(null);
    const [error, setError] = useState(null);
    const mapRef = useRef(null);
    const mapInstance = useRef(null);  

    const fetchNetworkSettings = () => {
        const [lat, lon] = areaCoordinates[0];  

        const xhr = new XMLHttpRequest();
        xhr.open('GET', `http://localhost:8080/get-network-settings?latitude=${lat}&longitude=${lon}`, true);
        
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    setNetworkSettings(response);
                } else {
                    setError('An error occurred while fetching data. Please try again.');
                    console.error('Error fetching network settings:', xhr.statusText);
                }
            }
        };

        xhr.onerror = function () {
            setError('An error occurred while fetching data. Please try again.');
            console.error('Request failed');
        };

        xhr.send();
    };

    const initializeMap = () => {
        if (mapInstance.current) return; 
        const map = L.map(mapRef.current, {
            center: [46.603354, 1.888334],
            zoom: 6,
        });

        mapInstance.current = map;  

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

        const drawnItems = new L.FeatureGroup().addTo(map);
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
            const layer = event.layer;
            drawnItems.addLayer(layer); 

            if (layer instanceof L.Rectangle) {
                const bounds = layer.getBounds();
                setAreaCoordinates([
                    [bounds.getSouth(), bounds.getWest()],
                    [bounds.getNorth(), bounds.getEast()],
                ]);
            }
        });
    };

    useEffect(() => {
        if (mapRef.current) {
            initializeMap();
        }
    }, []);

    return (
        <div>
            <h1>5G Network area configuration</h1>
            <div style={{ display: 'flex' }}>
                <div id="map" ref={mapRef} style={{ width: '100%', height: '500px' }}></div>
                <div style={{ width: '30%', paddingLeft: '20px'}}>
                    <h2>Data of selected srea</h2>
                    <button onClick={fetchNetworkSettings}>Get configuration</button>
                    {networkSettings && (
                        <div>
                            <h3>Recommended 5G:</h3>
                            <p>Sub-carrier width: {networkSettings.subCarrierWidth}</p>
                            <p>Frequency band: {networkSettings.frequencyBand}</p>
                            <p>Cyclic prefix: {networkSettings.cyclicPrefix}</p>
                            <p>Weather: {networkSettings.weather}</p>
                        </div>
                    )}
                    {error && <div style={{ color: 'red' }}><strong>{error}</strong></div>}
                    <h3>Coordinates of selected area:</h3>
                    <pre>{JSON.stringify(areaCoordinates, null, 2)}</pre>
                </div>
            </div>
        </div>
    );
};

export default App;
