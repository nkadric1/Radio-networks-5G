const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

const OPENCAGE_API_KEY = 'e0f1785865eb4251b07aaa84d52f33bd';
const OPENWEATHERMAP_API_KEY = '27b72ec98a488f4d73ea9f87e7bc0efd';
const GOOGLE_ELEVATION_API_KEY = 'AIzaSyDIOMUgnDOklu1gKXqhfjvcMO033p52W_E&fbclid=IwY2xjawIXQj1leHRuA2FlbQIxMAABHSaM77t0Rn0d70h10rN9Ioyf11QbgvsirSBOruJR7eFlTI_jUgeTEbZApg_aem_YHU8YkfpahH6Tl_u4ZJABw'; // Replace with your API key

/*https://maps.googleapis.com/maps/api/elevation/json?locations=39.7391536%2C-104.9847034&
key=AIzaSyDIOMUgnDOklu1gKXqhfjvcMO033p52W_E&fbclid=IwY2xjawIXQj1leHRuA2FlbQIxMAABHSaM77t0Rn0d70h10rN9Ioyf11QbgvsirSBOruJR7eFlTI_jUgeTEbZApg_aem_YHU8YkfpahH6Tl_u4ZJABw*/

app.use(cors());

// Getting population density from OpenCage API
async function getPopulationDensity(latitude, longitude) {
    const response = await axios.get(`https://api.opencagedata.com/geocode/v1/json?q=${latitude},${longitude}&key=${OPENCAGE_API_KEY}`);
    const city = response.data.results[0]?.components?.city || "Unknown";
    return city;
}

// Getting road data from Nominatim OSM API
async function getRoadData(latitude, longitude) {
    const response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${latitude},${longitude}`);
    return response.data;
}

// Getting building data from Nominatim OSM API
async function getBuildingsData(latitude, longitude) {
    const response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${latitude},${longitude}`);
    return response.data;
}

// Getting weather data from OpenWeatherMap API
async function getWeatherData(latitude, longitude) {
    const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHERMAP_API_KEY}`);
    return response.data.weather;
}

// Fetching elevation data from Google Elevation API
async function getElevation(latitude, longitude) {
    try {
        const response = await axios.get(`https://maps.googleapis.com/maps/api/elevation/json?locations=${latitude},${longitude}&key=${GOOGLE_ELEVATION_API_KEY}`);
        return response.data.results[0]?.elevation || 0;
    } catch (error) {
        console.error('Error fetching elevation data:', error);
        return 0; // Default elevation if API fails
    }
}

// Calculating 5G settings
function calculate5GSettings(roadData, populationDensity, buildingData, weatherData, elevation) {
    let subCarrierWidth;

    if (elevation > 250) {
        subCarrierWidth = '50 MHz'; // Smaller subcarrier width for high elevation
    } else {
        //subCarrierWidth = roadData.length > 50 ? '100 MHz' : '50 MHz';
        subCarrierWidth = '100 MHz';
    }

    return {
        subCarrierWidth,
        frequencyBand: populationDensity && populationDensity.length > 1000 ? 'n78' : 'n77',
        cyclicPrefix: buildingData.length > 50 ? 'Extended' : 'Normal',
        weather: weatherData ? weatherData[0]?.description : 'Clear',
        elevation: `${elevation} meters`
    };
}
// Calculating 5G settings with elevation
function calculate5GSettings(roadData, populationDensity, buildingData, weatherData, elevation) {
    const populationThreshold = 1000;  
    const buildingThreshold = 50;      
    const trafficSpeedThreshold = 60;  
    const elevationThreshold = 250;

    console.log("elevation")
    console.log(elevation)


    // Adjust subcarrier width based on elevation
    const subCarrierWidth = (elevation > elevationThreshold && roadData.some(road => road.speed < trafficSpeedThreshold) ) ? '100MHz' : '50MHz';
    
    // Choose frequency band based on road speed data
    const frequencyBand = roadData.some(road => road.speed > trafficSpeedThreshold) ? 'n78' : 'n77';

    // Set cyclic prefix based on building density
    const cyclicPrefix = buildingData.length > buildingThreshold ? 'Extended' : 'Normal';

    return {
        subCarrierWidth,
        frequencyBand,
        cyclicPrefix,
        weather: weatherData ? weatherData[0]?.description : 'Clear',
        elevation: `${elevation} meters`
    };
}

  
app.get('/get-network-settings', async (req, res) => {
    const { latitude, longitude } = req.query;

    try {
        const roadData = await getRoadData(latitude, longitude);
        const populationDensity = await getPopulationDensity(latitude, longitude);
        const buildingData = await getBuildingsData(latitude, longitude);
        const weatherData = await getWeatherData(latitude, longitude);
        const elevation = await getElevation(latitude, longitude);

        const settings = calculate5GSettings(roadData, populationDensity, buildingData, weatherData, elevation);
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching data' });
        console.error('Error fetching data:', error);
    }
});

app.listen(8080, () => {
    console.log('Server is running on port 8080');
});
