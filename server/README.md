# Vibes Server API

The backend for the Vibes private media platform. This Node.js Express API provides endpoints for media upload, metadata management, authentication, and serving video files.

## Tech Stack
- **Node.js** with **Express**
- **TypeScript**
- **better-sqlite3** for fast, reliable local database storage
- **Argon2** for secure password hashing
- **Jose** for JSON Web Tokens (JWT)
- **Zod** for schema validation
- **Multer** for multipart/form-data (video uploads)
- **Vitest** for unit testing

## Prerequisites
- Node.js (v20+ recommended)
- Local `.env` file (copy `.env.example` to `.env`)

## Local Development

```bash
# Install dependencies
npm install

# Start the development server (uses tsx for hot-reloading)
npm run dev
```

The server will be available at `http://localhost:3000` (or whatever `PORT` you configured in your `.env`).

## Scripts

- `npm run dev`: Starts the server in watch mode using `tsx`.
- `npm run build`: Compiles TypeScript source to `dist/`.
- `npm run start`: Runs the compiled JavaScript (`node dist/index.js`).
- `npm run test`: Runs the Vitest test suite.
- `npm run create-admin`: A CLI script to generate the initial admin user.

## Data Storage
By default, SQLite databases and uploaded media are stored in a `data` directory (often mapped to the root `data/` folder via Docker, or defined by `DATA_DIR` in your `.env`).
