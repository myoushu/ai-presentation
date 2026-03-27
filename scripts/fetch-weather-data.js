#!/usr/bin/env node

// Fetches historical weather data from Open-Meteo Archive API for Missoula, MT
// Outputs js/weather-data.js with pre-computed data for the presentation
// Usage: node scripts/fetch-weather-data.js

const https = require('https');
const fs = require('fs');
const path = require('path');

const LAT = 46.87;
const LON = -114.00;
const START_YEAR = 1940;
const END_YEAR = new Date().getFullYear();
const OUTPUT_FILE = path.join(__dirname, '..', 'js', 'weather-data.js');

function fetchYear(year) {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LON}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=America/Denver`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            console.warn(`  Warning: ${year} - ${json.reason || json.error}`);
            resolve(null);
            return;
          }
          const daily = json.daily;
          const days = daily.time.map(dateStr => {
            const d = new Date(dateStr + 'T00:00:00');
            const jan1 = new Date(d.getFullYear(), 0, 0);
            return Math.floor((d - jan1) / 86400000);
          });
          resolve({
            year,
            days,
            highs: daily.temperature_2m_max,
            lows: daily.temperature_2m_min,
            dates: daily.time
          });
        } catch (e) {
          console.warn(`  Warning: ${year} parse error - ${e.message}`);
          resolve(null);
        }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function fetchAll() {
  const data = {};
  const years = [];
  for (let y = START_YEAR; y <= END_YEAR; y++) years.push(y);

  console.log(`Fetching weather data for Missoula, MT (${START_YEAR}-${END_YEAR})...`);

  // Fetch in batches of 5 to be respectful to the API
  const batchSize = 5;
  for (let i = 0; i < years.length; i += batchSize) {
    const batch = years.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(fetchYear));
    for (const r of results) {
      if (r) data[r.year] = r;
    }
    const done = Math.min(i + batchSize, years.length);
    console.log(`  ${done}/${years.length} years fetched`);

    // Small delay between batches
    if (i + batchSize < years.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return data;
}

async function main() {
  const data = await fetchAll();
  const yearCount = Object.keys(data).length;

  const output = `// Auto-generated weather data for Missoula, MT
// Source: Open-Meteo Archive API
// Generated: ${new Date().toISOString()}
// Years: ${START_YEAR}-${END_YEAR} (${yearCount} years)
// Usage: include this file before chart-animation.js

const WEATHER_DATA = ${JSON.stringify(data)};
`;

  fs.writeFileSync(OUTPUT_FILE, output, 'utf8');
  console.log(`\nDone! ${yearCount} years written to ${OUTPUT_FILE}`);
  const sizeKB = (fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1);
  console.log(`File size: ${sizeKB} KB`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
