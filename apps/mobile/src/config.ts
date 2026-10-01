// Backend base URL. Set EXPO_PUBLIC_API_URL in apps/mobile/.env — on a physical
// device this must be your machine's LAN IP or a tunnel URL, not localhost.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
