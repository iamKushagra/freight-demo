import { CONTAINERS } from '../../shared/lanes.js';

const SIZES = new Set(CONTAINERS.map((c) => c.id));

// Port-to-port ocean freight in USD per container, the scheduled transit in days,
// and a liner that sails the lane. Figures are rates published in November 2026.
// README → "Quote figures" gives the source for each lane and marks the prices
// derived from the trade's usual 20 ft to 40 ft ratio.
const LANES = {
  'Chennai|Rotterdam': { '20ft': 1580, '40ft': 2400, days: 24, carrier: 'Maersk' },
  'Chennai|Dubai': { '20ft': 6880, '40ft': 8000, days: 20, carrier: 'CMA CGM' },
  'Chennai|Sydney': { '20ft': 2500, '40ft': 5000, days: 34, carrier: 'CMA CGM' },
  'Chennai|Los Angeles': { '20ft': 6480, '40ft': 8100, days: 33, carrier: 'COSCO' },

  'Singapore|Sydney': { '20ft': 2020, '40ft': 3970, days: 13, carrier: 'Maersk' },
  'Singapore|Rotterdam': { '20ft': 2650, '40ft': 4020, days: 34, carrier: 'Maersk' },
  'Singapore|Los Angeles': { '20ft': 6750, '40ft': 8400, days: 23, carrier: 'ONE' },
  'Singapore|Dubai': { '20ft': 6690, '40ft': 8080, days: 30, carrier: 'Hapag-Lloyd' },

  'Shanghai|Rotterdam': { '20ft': 2220, '40ft': 3400, days: 36, carrier: 'Maersk' },
  'Shanghai|Los Angeles': { '20ft': 6050, '40ft': 7510, days: 14, carrier: 'COSCO' },
  'Shanghai|Sydney': { '20ft': 2020, '40ft': 3930, days: 18, carrier: 'Evergreen' },
  'Shanghai|Dubai': { '20ft': 8400, '40ft': 9800, days: 24, carrier: 'MSC' },

  'Ho Chi Minh City|Sydney': { '20ft': 2200, '40ft': 4310, days: 15, carrier: 'Evergreen' },
  'Ho Chi Minh City|Rotterdam': { '20ft': 2460, '40ft': 3730, days: 29, carrier: 'ONE' },
  'Ho Chi Minh City|Los Angeles': { '20ft': 4640, '40ft': 5800, days: 25, carrier: 'Maersk' },
  'Ho Chi Minh City|Dubai': { '20ft': 6900, '40ft': 7900, days: 32, carrier: 'KMTC' },
};

export function priceQuote({ origin, destination, container }) {
  const lane = LANES[`${origin}|${destination}`];
  if (!lane || !SIZES.has(container)) {
    const err = new Error('Pick an origin, destination and container from the lists.');
    err.status = 400;
    throw err;
  }
  return {
    origin,
    destination,
    container,
    price: lane[container],
    currency: 'USD',
    transitDays: lane.days,
    carrier: lane.carrier,
    validForHours: 48,
  };
}
