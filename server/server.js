const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json()); 

const OPENCAGE_API_KEY = 'e0f1785865eb4251b07aaa84d52f33bd';
const OPENWEATHERMAP_API_KEY = '27b72ec98a488f4d73ea9f87e7bc0efd';
const GOOGLE_ELEVATION_API_KEY = 'AIzaSyDIOMUgnDOklu1gKXqhfjvcMO033p52W_E&fbclid=IwY2xjawIXQj1leHRuA2FlbQIxMAABHSaM77t0Rn0d70h10rN9Ioyf11QbgvsirSBOruJR7eFlTI_jUgeTEbZApg_aem_YHU8YkfpahH6Tl_u4ZJABw';

// Function to map OSM road types to speed limits (km/h)
function getSpeedLimit(roadType) {
    const speedMapping = {
        motorway: 120,
        trunk: 100,
        primary: 80,
        secondary: 60,
        tertiary: 50,
        unclassified: 30,
        residential: 30,
        living_street: 30,
        service: 10,
        pedestrian: 10,
        footway: 10
    };
    
    return speedMapping[roadType] || 50; // Default speed if type is unknown
}

// Fetch data for multiple points and compute the average
async function fetchAveragedData(coordinates) {
    let totalElevation = 0;
    let totalSpeed = 0;
    let totalPopulation = 0;
    let totalBuildingHeight = 0;
    let buildingCount = 0;
    let roadCount = 0;

    for (let coord of coordinates) {
        const { latitude, longitude } = coord;

        // Get elevation
        const elevationResponse = await axios.get(
            `https://maps.googleapis.com/maps/api/elevation/json?locations=${latitude},${longitude}&key=${GOOGLE_ELEVATION_API_KEY}`
        );
        totalElevation += elevationResponse.data.results[0]?.elevation || 0;

        // Get road data
        try {
            const roadResponse = await axios.get(
                `https://nominatim.openstreetmap.org/search?format=json&q=${latitude},${longitude}`
            );

            if (roadResponse.data.length > 0) {
                //console.log(roadResponse.data)
                roadResponse.data.forEach(road => {
                    if (road.class === 'highway' && road.type) {
                        totalSpeed += getSpeedLimit(road.type);
                        roadCount++;
                    }
                });
            }
        } catch (error) {
            console.error("Error fetching road data:", error);
        }

        // Get population density
        const populationResponse = await axios.get(
            `https://api.opencagedata.com/geocode/v1/json?q=${latitude},${longitude}&key=${OPENCAGE_API_KEY}`
        );

        console.log(populationResponse.data)
        totalPopulation += Math.random() * 2000;

        // Get building height using Overpass API
        try {
            const buildingResponse = await axios.get(
                `https://overpass-api.de/api/interpreter?data=[out:json];way["building"](around:100,${latitude},${longitude});out body;`
            );

            const buildings = buildingResponse.data.elements;
            buildings.forEach(building => {
                if (building.tags && building.tags["height"]) {
                    totalBuildingHeight += parseFloat(building.tags["height"]);
                    buildingCount++;
                }
            });
        } catch (error) {
            console.error("Error fetching building height:", error);
        }
    }

    // Compute averages
    const numPoints = coordinates.length;
    return {
        avgElevation: totalElevation / numPoints,
        avgSpeed: roadCount > 0 ? totalSpeed / roadCount : 50, // Default 50 km/h if no road data
        avgPopulation: totalPopulation / numPoints,
        avgBuildingHeight: buildingCount > 0 ? totalBuildingHeight / buildingCount : 10 // Default 10m if no data
    };
}


// Calculate 5G settings based on average data
function calculate5GSettings(avgData, weatherData) {
    const { avgElevation, avgSpeed, avgPopulation, avgBuildingHeight } = avgData;

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

    let frequencyBand;
    if (avgPopulation>1000) {
        if(avgBuildingHeight < 35) frequencyBand = '5 GHz';  
        else frequencyBand = '2.4GHz';
    }  
    else {
        frequencyBand = '800 MHz';  
    }

    const cyclicPrefix = avgPopulation < 1000 ? 'Extended' : 'Normal';

    return {
        subCarrierWidth,
        frequencyBand,
        cyclicPrefix,
        weather: weatherData ? weatherData[0]?.description : 'Clear',
        elevation: `${avgElevation.toFixed(2)} meters`,
        avgSpeed,
        avgPopulation,
        avgBuildingHeight
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
