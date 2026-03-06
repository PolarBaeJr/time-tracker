# WorkTracker

A production-ready, cross-platform time tracking application built with Expo, React Native, and Electron.

![CI](https://github.com/your-org/worktracker/actions/workflows/ci.yml/badge.svg)
![Build](https://github.com/your-org/worktracker/actions/workflows/build.yml/badge.svg)

## Features

- **Real-time timer** — Start/stop a work timer that syncs across devices via Supabase Realtime
- **Categories** — Organize time entries by category (name, color, and type: work/personal/hobby)
- **History** — Browse, filter, and edit past time entries with infinite scroll
- **Analytics** — Visualize time spent per category with Victory Native charts
- **Goals** — Set monthly time targets and track progress
- **Google OAuth** — Sign in with Google via Supabase Auth
- **Offline support** — Queue mutations locally and sync when reconnected
- **Cross-platform** — iOS, Android, web, and macOS (Electron) from a single codebase

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile/Web | Expo 55, React Native 0.83 |
| Desktop | Electron 40 |
| Backend | Supabase (PostgreSQL + Auth + Realtime) |
| State | Zustand (timer), TanStack Query (server data) |
| Validation | Zod |
| Charts | Victory Native |
| Styling | Custom design tokens (dark mode) |
| CI/CD | GitHub Actions |
| Deployment | Docker + Nginx on Raspberry Pi (arm64) |

## Quick Start

### Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Docker (for local Supabase)
- Expo CLI: `npm install -g expo-cli`

### 1. Clone and install

```bash
git clone https://github.com/your-org/worktracker.git
cd worktracker/worktracker
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

For local development with the Supabase CLI:

```bash
supabase start
# Use the printed URL and anon key
```

### 3. Apply database migrations

```bash
supabase db push
# or for local: supabase start (applies migrations automatically)
```

### 4. Seed development data (optional)

```bash
npm run seed:dev
```

### 5. Run the app

```bash
# Mobile / web (Expo)
npm start

# Desktop (Electron + web)
npm run electron:dev
```

## Running Tests

```bash
# Unit tests
npm test

# Unit tests with coverage
npm run test:coverage

# Integration tests (requires `supabase start`)
./scripts/test-integration.sh

# TypeScript integration tests
INTEGRATION_TESTS=true npm test -- --testPathPattern=integration
```

## Building for Production

```bash
# Web
npm run build:web

# Electron macOS
npm run electron:package:mac

# iOS / Android (requires EAS account)
npm run build:ios
npm run build:android

# Docker
docker build -t worktracker .
```

## Deployment

See [docs/DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md) for the full deployment guide.

Quick deploy to Raspberry Pi:

```bash
./scripts/deploy.sh
```

Or trigger the [Deploy workflow](../../actions/workflows/deploy.yml) from GitHub Actions.

## Documentation

| Document | Description |
|----------|-------------|
| [USER_GUIDE.md](docs/USER_GUIDE.md) | How to use the app |
| [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) | Architecture, setup, coding standards |
| [API.md](docs/API.md) | Supabase schema and RPC reference |
| [DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md) | Pre-deployment verification steps |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Seed data and local dev workflow |
| [DOCKER.md](docs/DOCKER.md) | Docker and Docker Compose setup |
| [ELECTRON_BUILD.md](docs/ELECTRON_BUILD.md) | Electron build instructions |
| [MOBILE_BUILD.md](docs/MOBILE_BUILD.md) | EAS mobile build guide |
| [RASPBERRY_PI_DEPLOYMENT.md](docs/RASPBERRY_PI_DEPLOYMENT.md) | Pi-specific deployment |
| [SSL_SETUP.md](docs/SSL_SETUP.md) | SSL certificate configuration |
| [SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) | Supabase project setup |

## Required GitHub Secrets

For CI/CD to work, configure these secrets in your repository settings:

| Secret | Description |
|--------|-------------|
| `SUPABASE_URL` | Production Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `PI_HOST` | Raspberry Pi hostname or IP |
| `PI_USER` | SSH username on the Pi |
| `PI_SSH_KEY` | Private SSH key for Pi access |

## License

MIT
