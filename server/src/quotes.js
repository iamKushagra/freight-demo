import { CONTAINER_FACTOR } from '../../shared/lanes.js';

const DISTANCE_NM = {
  Singapore: { Sydney: 4300, 'Los Angeles': 7700, Rotterdam: 8300, Dubai: 3600 },
  Chennai: { Sydney: 4700, 'Los Angeles': 9000, Rotterdam: 6900, Dubai: 2100 },
  Shanghai: { Sydney: 4600, 'Los Angeles': 5700, Rotterdam: 10500, Dubai: 5000 },
  'Ho Chi Minh City': { Sydney: 4500, 'Los Angeles': 7300, Rotterdam: 8800, Dubai: 3900 },
};

const CARRIERS = ['Meridian Line', 'Southern Cross Shipping', 'Pacific Arc', 'Bluewater Cargo'];
const NM_PER_DAY = 18 * 24;

export function priceQuote({ origin, destination, container }) {
  const nm = DISTANCE_NM[origin]?.[destination];
  const factor = CONTAINER_FACTOR[container];
  if (!nm || !factor) {
    const err = new Error('Pick an origin, destination and container from the lists.');
    err.status = 400;
    throw err;
  }
  const price = Math.round((600 + nm * 0.32) * factor / 10) * 10;
  const transitDays = Math.ceil(nm / NM_PER_DAY) + 2;
  const carrier = CARRIERS[(origin.length + destination.length) % CARRIERS.length];
  return { origin, destination, container, price, currency: 'USD', transitDays, carrier, validForHours: 48 };
}
