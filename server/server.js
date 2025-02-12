const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const OPENCAGE_API_KEY = 'e0f1785865eb4251b07aaa84d52f33bd';
const OPENWEATHERMAP_API_KEY = '27b72ec98a488f4d73ea9f87e7bc0efd';
const GOOGLE_ELEVATION_API_KEY = 'AIzaSyDIOMUgnDOklu1gKXqhfjvcMO033p52W_E';

const axiosInstance = axios.create({
    timeout: 5000, // set timeout to 5 seconds
});

// mapping OSM road types to speed limits (km/h)
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
    
    return speedMapping[roadType] || 50; // default speed if type is there is no data returned from API
}

async function fetchAveragedData(coordinates) {
    try{
    let totalElevation = 0;
    let totalSpeed = 0;
    let totalPopulation = 0;
    let totalBuildingHeight = 0;
    let buildingCount = 0;
    let roadCount = 0;

    for (let coord of coordinates) {
        const { latitude, longitude } = coord;

        // API for elevation 
        const elevationResponse = await axios.get(
            `https://maps.googleapis.com/maps/api/elevation/json?locations=${latitude},${longitude}&key=${GOOGLE_ELEVATION_API_KEY}`
        );
        totalElevation += elevationResponse.data.results[0]?.elevation || 0;

        // API for road data
        try {
            const roadResponse = await axios.get(
                `https://nominatim.openstreetmap.org/search?format=json&q=${latitude},${longitude}`
            );

            if (roadResponse.data.length > 0) {
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

        // API for population density
        //The Overpass API finds the nearest city, town, village, or suburb within 50 km of the given latitude/longitude.
        //It checks if the location has a population tag in OpenStreetMap.
        //If found, it extracts the population; otherwise, it assigns a default value of 1000.
        try {
            const overpassQuery = `
                [out:json];
                node(around:50000,${latitude},${longitude})["place"~"city|town|village|suburb"];
                out body;
            `;
        
            const populationResponse = await axios.get(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`);
        
            if (populationResponse.data && populationResponse.data.elements.length > 0) {
                const population = populationResponse.data.elements[0].tags.population 
                    ? parseInt(populationResponse.data.elements[0].tags.population, 10) 
                    : 1000; 
                totalPopulation += population;
            } else {
                totalPopulation += 1000; 
            }
        } catch (error) {
            console.error("Error fetching population density:", error);
            totalPopulation += 1000;
        }
        

        // API to get data about building height
        //The Overpass API extracts building height data from OpenStreetMap (OSM) by querying structures tagged as "building" within a 100m radius of the given coordinates. 
        //If the height attribute is missing, it estimates it using the number of floors ("building:levels") by assuming 3 meters per floor.
        try {
            const buildingResponse = await axios.get(
                `https://overpass-api.de/api/interpreter?data=[out:json];way["building"](around:100,${latitude},${longitude});out body;`
            );

            const buildings = buildingResponse.data.elements;
            buildings.forEach(building => {
                if (building.tags) {
                    let height = 0;

                    if (building.tags["height"]) {
                        height = parseFloat(building.tags["height"]);
                    }
                    else if (building.tags["building:levels"]) {
                        height = parseInt(building.tags["building:levels"], 10) * 3; // Assume 3m per floor
                    }

                    if (height > 0) {
                        totalBuildingHeight += height;
                        buildingCount++;
                    }
                }
            });

        } catch (error) {
            console.error("Error fetching building height:", error);
        }
    }

    const numPoints = coordinates.length;
    return {
        avgElevation: totalElevation / numPoints,
        avgSpeed: roadCount > 0 ? totalSpeed / roadCount : 5, // default speed set to 50 km/h if no road data
        avgPopulation: totalPopulation / numPoints,
        avgBuildingHeight: buildingCount > 0 ? totalBuildingHeight / buildingCount : 10 // default 10m if no data (average height of a house)
    };
}
catch(error){
    return;
}
}

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
    if (avgPopulation > 1000) {
        if (avgBuildingHeight < 35) frequencyBand = '5 GHz';  
        else frequencyBand = '2.4 GHz';
    } else {
        frequencyBand = '800 MHz';  
    }

    const cyclicPrefix = avgPopulation <=1000 ? 'Extended' : 'Normal';

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

app.post('/get-network-settings', async (req, res) => {
    try {
        const { coordinates } = req.body;
        if (!coordinates || coordinates.length === 0) {
            return res.status(400).json({ error: 'Invalid coordinates' });
        }

        const avgData = await fetchAveragedData(coordinates);

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
