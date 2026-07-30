"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const axios = require('axios');
const BASE = 'http://localhost:3000';
const RIDE_ID = process.argv[2];
const TOKEN_A = process.argv[3];
const TOKEN_B = process.argv[4];
async function book(token, label) {
    try {
        const res = await axios.post(`${BASE}/bookings`, { rideId: RIDE_ID, seatsBooked: 1 }, { headers: { Authorization: `Bearer ${token}` } });
        console.log(`${label}: SUCCESS`, res.data);
    }
    catch (err) {
        console.log(`${label}: FAILED`, err.response?.status, err.response?.data?.message);
    }
}
Promise.all([book(TOKEN_A, 'Request A'), book(TOKEN_B, 'Request B')]);
//# sourceMappingURL=test-concurrent-booking.js.map