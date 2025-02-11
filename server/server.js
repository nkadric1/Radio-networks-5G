const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json()); 

const OPENCAGE_API_KEY = 'e0f1785865eb4251b07aaa84d52f33bd';
const OPENWEATHERMAP_API_KEY = '27b72ec98a488f4d73ea9f87e7bc0efd';
const GOOGLE_ELEVATION_API_KEY = 'AIzaSyDIOMUgnDOklu1gKXqhfjvcMO033p52W_E&fbclid=IwY2xjawIXQj1leHRuA2FlbQIxMAABHSaM77t0Rn0d70h10rN9Ioyf11QbgvsirSBOruJR7eFlTI_jUgeTEbZApg_aem_YHU8YkfpahH6Tl_u4ZJABw';

// Fetch data for multiple points and compute the average
async function fetchAveragedData(coordinates) {
    let totalElevation = 0;
    let totalSpeed = 0;
    let totalPopulation = 0;
    let totalBuildings = 0;

    for (let coord of coordinates) {
        const { latitude, longitude } = coord;

        // Get elevation
        const elevationResponse = await axios.get(
            `https://maps.googleapis.com/maps/api/elevation/json?locations=${latitude},${longitude}&key=${GOOGLE_ELEVATION_API_KEY}`
        );
        totalElevation += elevationResponse.data.results[0]?.elevation || 0;

        // Get road data 
        const roadResponse = await axios.get(
            `https://nominatim.openstreetmap.org/search?format=json&q=${latitude},${longitude}`
        );
        const roadSpeed = roadResponse.data.length > 0 ? Math.random() * 100 : 50; // Simulated speed (replace with actual API)
        totalSpeed += roadSpeed;

        // Get population density
        const populationResponse = await axios.get(
            `https://api.opencagedata.com/geocode/v1/json?q=${latitude},${longitude}&key=${OPENCAGE_API_KEY}`
        );
        totalPopulation += Math.random() * 2000; // Simulated population density (replace with actual API)

        // Get building data
        const buildingResponse = await axios.get(
            `https://nominatim.openstreetmap.org/search?format=json&q=${latitude},${longitude}`
        );
        totalBuildings += buildingResponse.data.length;
    }

    // Compute averages
    const numPoints = coordinates.length;
    return {
        avgElevation: totalElevation / numPoints,
        avgSpeed: totalSpeed / numPoints,
        avgPopulation: totalPopulation / numPoints,
        avgBuildings: totalBuildings / numPoints
    };
}

// Calculate 5G settings based on average data
function calculate5GSettings(avgData, weatherData) {
    const { avgElevation, avgSpeed, avgPopulation, avgBuildings } = avgData;

    let subCarrierWidth;
    if (avgSpeed > 100) {
        subCarrierWidth = '120 kHz'; 
    } else if (avgSpeed > 60) {
        subCarrierWidth = '60 kHz';  
    } else if (avgSpeed > 30) {
        subCarrierWidth = '30 kHz'; 
    } else {
        subCarrierWidth = '15 kHz';  
    }

    const frequencyBand = avgSpeed > 60 ? 'n78' : 'n77';
    const cyclicPrefix = avgBuildings > 50 ? 'Extended' : 'Normal';

    return {
        subCarrierWidth,
        frequencyBand,
        cyclicPrefix,
        weather: weatherData ? weatherData[0]?.description : 'Clear',
        elevation: `${avgElevation.toFixed(2)} meters`,
        avgSpeed,
        avgBuildings,
        avgPopulation
    };
}


// Handle POST request with multiple coordinates
app.post('/get-network-settings', async (req, res) => {
    try {
        const { coordinates } = req.body;
        if (!coordinates || coordinates.length === 0) {
            return res.status(400).json({ error: 'Invalid coordinates' });
        }

        const avgData = await fetchAveragedData(coordinates);

        // get weather data for the first coordinate
        const { latitude, longitude } = coordinates[0];
        const weatherResponse = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHERMAP_API_KEY}`
        );
        const weatherData = weatherResponse.data.weather;

        const settings = calculate5GSettings(avgData, weatherData);
        res.json(settings);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Error fetching data' });
    }
});

app.listen(8080, () => {
    console.log('Server is running on port 8080');
});
