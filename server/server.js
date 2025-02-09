const express = require('express');
const axios = require('axios');
const cors = require('cors'); 
const app = express();

const OPENCAGE_API_KEY = 'e0f1785865eb4251b07aaa84d52f33bd'; 
const OPENWEATHERMAP_API_KEY = '27b72ec98a488f4d73ea9f87e7bc0efd'; 

app.use(cors());

//getting population density from OpenCageAPI
async function getPopulationDensity(latitude, longitude) {
    const response = await axios.get(`https://api.opencagedata.com/geocode/v1/json?q=${latitude},${longitude}&key=${OPENCAGE_API_KEY}`);
    const city = response.data.results[0]?.components?.city || "Unknown";
    return city;
}

//getting road data from Nominatim OSM API
async function getRoadData(latitude, longitude) {
    const response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${latitude},${longitude}`);
    return response.data;  
}

//getting building data from Nominatim OSM API
async function getBuildingsData(latitude, longitude) {
    const response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${latitude},${longitude}`);
    return response.data; 
}

//getting weather data from OpenWeatherMap
async function getWeatherData(latitude, longitude) {
    const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHERMAP_API_KEY}`);
    return response.data.weather;
}

//calculating 5G settings
function calculate5GSettings(roadData, populationDensity, buildingData, weatherData) {
    return {
        subCarrierWidth: roadData.length > 50 ? '100 MHz' : '50 MHz',
        frequencyBand: populationDensity && populationDensity.length > 1000 ? 'n78' : 'n77',
        cyclicPrefix: buildingData.length > 50 ? 'Extended' : 'Normal',
        weather: weatherData ? weatherData[0]?.description : 'Clear'
    };
}

app.get('/get-network-settings', async (req, res) => {
    const { latitude, longitude } = req.query;

    try {
        const roadData = await getRoadData(latitude, longitude);
        const populationDensity = await getPopulationDensity(latitude, longitude);
        const buildingData = await getBuildingsData(latitude, longitude);
        const weatherData = await getWeatherData(latitude, longitude);

        const settings = calculate5GSettings(roadData, populationDensity, buildingData, weatherData);

        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching data' });
        console.error('Error fetching data:', error);
    }
});

app.listen(8080, () => {
    console.log('Server is running on port 8080');
});