# Luma Salon — Token Queue

React + Vite client (`/client`) and Express + MongoDB (Mongoose) API (`/server`).

## Run locally

1. **Create a free MongoDB Atlas cluster** → Database Access: add a user → Network Access: allow your IP (or `0.0.0.0/0` for a demo) → Connect → *Drivers* → copy the connection string.
2. **Configure the server**
   ```
   cd server
   cp .env.example .env        # Windows: copy .env.example .env
   ```
   Open `server/.env` and set `MONGODB_URI` (put your DB name before the `?`, e.g. `.../luma-salon?retryWrites=...`), `STAFF_PIN` and `JWT_SECRET`.
3. **Install everything** (from the project root)
   ```
   npm run setup
   ```
4. **(Optional) load demo data** — replaces today's queue only
   ```
   npm run seed
   ```
5. **Start both apps**
   ```
   npm run dev
   ```
   - Staff sign-in: http://localhost:5173/login (PIN = `STAFF_PIN`, default `1234`)
   - Public queue board: http://localhost:5173/queue
   - API: http://localhost:5000/api/health

## Tests
```
npm test
```
Uses `mongodb-memory-server` (downloads a MongoDB binary on first run). To use your own MongoDB instead:
`TEST_MONGO_URI=mongodb://127.0.0.1:27017 npm test`

## Deploy (short)
- **API (Render):** root dir `server`, build `npm install`, start `npm start`; env vars `MONGODB_URI`, `STAFF_PIN`, `JWT_SECRET`, `SALON_TIMEZONE`, `CLIENT_ORIGIN=<your Vercel URL>`.
- **Client (Vercel):** root dir `client`; env var `VITE_API_BASE_URL=<your Render URL>` (`vercel.json` already handles `/queue` refresh).

## Queue rules in one minute
- Tokens `L001…` reset daily, are permanent and are issued by an atomic DB counter.
- Call Next: due + present appointment (earliest scheduled time) → otherwise oldest walk-in (FIFO). Future appointments are never called early.
- Absent appointment at its time → flagged **overdue**; staff must cancel it manually. A late customer is registered as a **new walk-in** with a new token. No grace period, no auto-cancel, no reactivation.
- One active service at a time, enforced by a unique DB document (`ActiveService`) — not by the UI.
- Estimated wait is a simulation using 10 min/customer; it is an estimate, not a promise.
