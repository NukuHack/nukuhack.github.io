
const city = document.getElementById('city_input')
const errorElement = document.getElementById('error');
const weatherInfo = document.getElementById('weather-info');
const locationElement = document.getElementById('location');
const temperatureElement = document.getElementById('temperature');
const descriptionElement = document.getElementById('description');

async function getWeather() {
    const currentCity = city.value.trim();

    // Basic validation for city input (e.g., non-empty, only letters and spaces)
    const cityRegex = /^[a-zA-Z\s]+$/;
    if (!currentCity || !cityRegex.test(currentCity)) {
        weatherInfo.style.display = "none";
        errorElement.textContent = "Please enter a valid city name.";
        return;
    }

    errorElement.textContent = "";

    try {
        // Fetch weather data in English (lang=en)
        const response = await fetch(`https://wttr.in/${currentCity}?format=%C+%t&lang=en`);

        if (!response.ok) {
            throw new Error("Failed to fetch data");
        }

        // Get the response data (we expect plain text)
        const data = await response.text();

        // Check if the data is the default response: "+14 sunny"
        if (data === "+14 sunny") {
            errorElement.textContent = `City "${currentCity}" is invalid or ambiguous. Please check your input.`;
            weatherInfo.style.display = "none";
            return;
        }

        // Display weather info if valid data is returned
        weatherInfo.style.display = "block";
        locationElement.textContent = `Location: ${currentCity}`;
        temperatureElement.textContent = `Weather: ${data.slice(data.lastIndexOf(" "))}`;
        descriptionElement.textContent = `Current Condition: ${data.slice(0,data.lastIndexOf(" "))}`;
    } catch (error) {
        // Handle any error
        errorElement.textContent = "Could not fetch weather data. Please try again.";
        weatherInfo.style.display = "none";
    }
}
