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
- **Autonomous Agent** — AI-powered daemon for automated marketing (Python)

## Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local — add your GROQ_API_KEY from https://console.groq.com/keys

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
| `AUTH_SECRET` | Yes | NextAuth JWT secret (`openssl rand -base64 32`) |
| `ADMIN_EMAIL` | Yes | Login email |
| `ADMIN_PASSWORD_HASH` | Yes | Bcrypt hash of password |
| `GROQ_API_KEY` | For AI | Free at [console.groq.com](https://console.groq.com/keys) |
| `REDDIT_CLIENT_ID` | For Reddit | Reddit app credentials |
| `N8N_API_KEY` | For Workflows | n8n API key |

## Tech Stack

- **Framework:** Next.js 16 + React 19 + TypeScript
- **Auth:** NextAuth v5 (credentials provider, env-based)
- **UI:** Tailwind CSS 4 + shadcn/ui + Radix UI + Framer Motion
- **AI:** Groq Cloud API (Llama 3.3 70B, free tier, OpenAI-compatible)
- **State:** TanStack React Query v5
- **Automation:** Python scripts (PRAW, Groq API)

## Production Deployment

Deployed via Docker + Nginx reverse proxy (same pattern as forgecadneo.neocodehub.com).

### Prerequisites

- Docker & Docker Compose on the server
- Nginx with Certbot for SSL
- DNS A record pointing `leadsneoforge.neocodehub.com` to your server IP

### Step-by-Step

```bash
# 1. Clone on server
git clone https://github.com/Abhisheksharma99/Leadsneoforge.git
cd Leadsneoforge

# 2. Create production env
cp .env.production.example .env.production
nano .env.production
# Fill in: AUTH_SECRET, ADMIN_PASSWORD_HASH, GROQ_API_KEY, etc.

# 3. Deploy
chmod +x deploy.sh
./deploy.sh

# 4. Set up Nginx + SSL (first time only)
sudo cp deploy/nginx-site.conf /etc/nginx/sites-available/leadsneoforge
sudo ln -s /etc/nginx/sites-available/leadsneoforge /etc/nginx/sites-enabled/
sudo certbot --nginx -d leadsneoforge.neocodehub.com
sudo nginx -t && sudo systemctl reload nginx
```

### Architecture

```
Internet
  └── Nginx (port 443, SSL via Let's Encrypt)
        └── leadsneoforge.neocodehub.com
              └── proxy_pass http://127.0.0.1:3001
                    └── Docker: leadsneoforge-app (Next.js standalone)
                          └── /app/data (persistent volume)
```

### Useful Commands

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f

# Restart
docker compose -f docker-compose.prod.yml restart

# Rebuild & redeploy
docker compose -f docker-compose.prod.yml up -d --build

# Stop
docker compose -f docker-compose.prod.yml down

# Shell into container
docker exec -it leadsneoforge-app sh
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
