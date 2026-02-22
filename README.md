# Chirpy

A simple Twitter-like microblogging API built with TypeScript and Express. Users can create accounts, post short messages (chirps), and manage their own content with optional Chirpy Red membership for premium features.

## Why Chirpy?

- **Authentication done right** — JWT access tokens, refresh tokens, and secure password hashing with Argon2
- **RESTful API** — Clean endpoints for users, chirps, auth, and webhooks
- **Production-ready patterns** — PostgreSQL with Drizzle ORM, migrations, and error handling

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL

### Install

```bash
npm install
```

### Configure

Create a `.env` file in the project root:

```
DB_URL=postgresql://user:password@localhost:5432/chirpy
JWT_SECRET=your-secret-key
POLKA_KEY=your-polka-api-key
```

Generate a JWT secret with:

```bash
openssl rand -base64 64
```

### Run

```bash
# Build and start
npm run dev

# Or build then start
npm run build
npm start
```

The server runs at `http://localhost:8080`.

### Run Tests

```bash
npm test
```

## API Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/healthz` | GET | Health check |
| `/api/users` | POST | Register a user |
| `/api/users` | PUT | Update user (authenticated) |
| `/api/login` | POST | Login, returns access + refresh tokens |
| `/api/refresh` | POST | Refresh access token |
| `/api/revoke` | POST | Revoke refresh token |
| `/api/chirps` | GET | List chirps (optional `authorId`, `sort`) |
| `/api/chirps` | POST | Create chirp (authenticated) |
| `/api/chirps/:id` | GET | Get chirp by ID |
| `/api/chirps/:id` | DELETE | Delete chirp (author only) |
