#!/bin/bash
set -e

echo "=== LeadsNeoForge Production Deployment ==="
echo ""

# Check that .env.production exists
if [ ! -f ".env.production" ]; then
    echo "ERROR: .env.production not found!"
    echo "Copy .env.production.example to .env.production and fill in values:"
    echo "  cp .env.production.example .env.production"
    echo "  nano .env.production"
    exit 1
fi

# Validate required env vars
source .env.production
if [ "$AUTH_SECRET" = "CHANGE_ME_GENERATE_A_REAL_SECRET" ] || [ -z "$AUTH_SECRET" ]; then
    echo "ERROR: AUTH_SECRET is not set in .env.production"
    echo "Generate one with: openssl rand -base64 32"
    exit 1
fi

if [ "$ADMIN_PASSWORD_HASH" = "CHANGE_ME_USE_GENERATE_HASH_SCRIPT" ] || [ -z "$ADMIN_PASSWORD_HASH" ]; then
    echo "ERROR: ADMIN_PASSWORD_HASH is not set in .env.production"
    echo "Generate one with: node scripts/generate-password-hash.js your-password"
    exit 1
fi

echo "Building image..."
docker compose -f docker-compose.prod.yml build

echo ""
echo "Starting container..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "Container status:"
docker compose -f docker-compose.prod.yml ps

echo ""
echo "Deployed! The app should be accessible at https://leadsneoforge.neocodehub.com"
echo ""
echo "Useful commands:"
echo "  Logs:    docker compose -f docker-compose.prod.yml logs -f"
echo "  Stop:    docker compose -f docker-compose.prod.yml down"
echo "  Rebuild: docker compose -f docker-compose.prod.yml up -d --build"
echo "  Shell:   docker exec -it leadsneoforge-app sh"
echo ""
echo "Nginx setup (first time only):"
echo "  sudo cp deploy/nginx-site.conf /etc/nginx/sites-available/leadsneoforge"
echo "  sudo ln -s /etc/nginx/sites-available/leadsneoforge /etc/nginx/sites-enabled/"
echo "  sudo certbot --nginx -d leadsneoforge.neocodehub.com"
echo "  sudo nginx -t && sudo systemctl reload nginx"
