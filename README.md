# LeadsNeoForge

AI-powered lead generation and marketing automation platform for ForgeCadNeo.

## Features

- **Reddit Monitoring** — Scan subreddits for keywords, auto-generate contextual replies
- **LinkedIn Outreach** — Generate connection requests, InMails, and follow-up sequences
- **Twitter/X** — AI tweet/thread generation, hashtag research
- **Content Hub** — Multi-platform content generation (Product Hunt, HN, Indie Hackers, Email)
- **Products Catalog** — Manage products with AI-powered Reddit post generation
- **Outreach Hub** — Lead tracking, multi-step outreach sequences, templates
- **Growth Channels** — Product Hunt launch checklist, HN optimization, ASO
- **Workflow Builder** — n8n integration for automation workflows
- **Autonomous Agent** — Claude-powered daemon for automated marketing (Python)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local with your credentials

# 3. Generate a password hash (default: admin123)
npm run generate-hash -- your-password

# 4. Run development server
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) and log in.

**Default credentials:** `admin@leadsneoforge.com` / `admin123`

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Required | Description |
|---|---|---|
| `AUTH_SECRET` | Yes | NextAuth JWT secret (generate with `openssl rand -base64 32`) |
| `ADMIN_EMAIL` | Yes | Login email |
| `ADMIN_PASSWORD_HASH` | Yes | Bcrypt hash of password |
| `ANTHROPIC_API_KEY` | For AI | Claude API key for content generation |
| `REDDIT_CLIENT_ID` | For Reddit | Reddit app credentials |
| `N8N_API_KEY` | For Workflows | n8n API key |

## Tech Stack

- **Framework:** Next.js 16 + React 19 + TypeScript
- **Auth:** NextAuth v5 (credentials provider)
- **UI:** Tailwind CSS 4 + shadcn/ui + Radix UI + Framer Motion
- **AI:** Anthropic Claude API (direct fetch, no SDK)
- **State:** TanStack React Query v5
- **Automation:** Python scripts (PRAW, Claude API)

## Deployment

```bash
# Build for production
npm run build

# Start production server
npm start
```

### Vercel

1. Push to GitHub
2. Import to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Docker (optional)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

## Autonomous Agent (Python)

The `automation/` directory contains Python scripts for automated marketing:

```bash
cd automation
pip install -r requirements.txt
cp ../.env.example .env
# Edit .env with your credentials

# Run once
./start-agent.sh --once

# Run as daemon
./start-agent.sh --daemon
```

## License

Private — All rights reserved.
