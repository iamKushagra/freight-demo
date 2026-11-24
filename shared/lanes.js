export const ORIGINS = ['Singapore', 'Chennai', 'Shanghai', 'Ho Chi Minh City'];
export const DESTINATIONS = ['Sydney', 'Los Angeles', 'Rotterdam', 'Dubai'];
export const CONTAINERS = [
  { id: '20ft', label: '20 ft container', factor: 1 },
  { id: '40ft', label: '40 ft container', factor: 1.6 },
  { id: 'lcl', label: 'Shared container (LCL)', factor: 0.35 },
];

export const CONTAINER_FACTOR = Object.fromEntries(CONTAINERS.map((c) => [c.id, c.factor]));
