import { useState } from 'react';
import '../styles/weather.css';

export default function Weather() {
  const [city, setCity] = useState('');
  const [error, setError] = useState('');
  const [weatherVisible, setWeatherVisible] = useState(true); // matches original: no inline display style until first toggle
  const [location, setLocation] = useState('');
  const [temperature, setTemperature] = useState('');
  const [description, setDescription] = useState('');

  async function getWeather() {
    const currentCity = city.trim();

    // Basic validation for city input (e.g., non-empty, only letters and spaces)
    const cityRegex = /^[a-zA-Z\s]+$/;
    if (!currentCity || !cityRegex.test(currentCity)) {
      setWeatherVisible(false);
      setError('Please enter a valid city name.');
      return;
    }

    setError('');

    try {
      // Fetch weather data in English (lang=en)
      const response = await fetch(`https://wttr.in/${currentCity}?format=%C+%t&lang=en`);

      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      // Get the response data (we expect plain text)
      const data = await response.text();

      // Check if the data is the default response: "+14 sunny"
      if (data === '+14 sunny') {
        setError(`City "${currentCity}" is invalid or ambiguous. Please check your input.`);
        setWeatherVisible(false);
        return;
      }

      // Display weather info if valid data is returned
      setWeatherVisible(true);
      setLocation(`Location: ${currentCity}`);
      setTemperature(`Weather: ${data.slice(data.lastIndexOf(' '))}`);
      setDescription(`Current Condition: ${data.slice(0, data.lastIndexOf(' '))}`);
    } catch {
      // Handle any error
      setError('Could not fetch weather data. Please try again.');
      setWeatherVisible(false);
    }
  }

  return (
    <div className="weather-container">
      <h1>Weather App</h1>
      <input
        id="city_input"
        type="text"
        placeholder="Enter City"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && getWeather()}
      />
      <button id="weather_get" onClick={getWeather}>
        Get Weather
      </button>
      <p id="error">{error}</p>
      <div id="weather-info" style={{ display: weatherVisible ? 'block' : 'none' }}>
        <p id="location">{location}</p>
        <p id="temperature">{temperature}</p>
        <p id="description">{description}</p>
      </div>
    </div>
  );
}
