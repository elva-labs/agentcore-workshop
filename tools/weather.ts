import { randomInt } from 'node:crypto';

export async function handler(input: unknown) {
  if (typeof input !== 'object' || input === null
    || !('location' in input) || typeof input.location !== 'string'
    || !('time' in input) || typeof input.time !== 'string') {
    throw new Error('location and time must be strings.');
  }

  const location = input.location.trim();
  const time = input.time.trim();
  if (!location || !time || location.length > 200 || time.length > 200) {
    throw new Error('location and time must each contain 1–200 characters.');
  }

  const conditions = ['sunny', 'partly cloudy', 'cloudy', 'rainy', 'snowy'];
  return {
    location,
    time,
    mock: true,
    notice: 'Randomly generated mock weather. Not a real forecast.',
    conditions: conditions[randomInt(conditions.length)],
    temperatureCelsius: randomInt(-15, 36),
    windSpeedKmh: randomInt(0, 51),
    humidityPercent: randomInt(20, 101),
  };
}
