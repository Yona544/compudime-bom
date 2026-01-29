# BOM - Deployment Guide

## Production Deployment on Fly.io

### Prerequisites

1. Install Fly CLI: https://fly.io/docs/hands-on/install-flyctl/
2. Login: `flyctl auth login`

### API Deployment

The API is configured to deploy to Fly.io with automatic scaling.

```bash
cd C:\scripts\BOM

# First time setup (already done)
flyctl launch --name bom-api --region ewr

# Deploy updates
flyctl deploy --app bom-api

# Check status
flyctl status --app bom-api

# View logs
flyctl logs --app bom-api
```

#### Environment Variables

Set secrets for production:

```bash
flyctl secrets set SECRET_KEY=your-secure-secret-key --app bom-api
flyctl secrets set DATABASE_URL=postgresql://... --app bom-api
```

### Website Deployment

The marketing website is a static site served by nginx.

```bash
cd C:\scripts\BOM\website

# Deploy
flyctl deploy --app bom-website
```

### Database Setup

#### Development (SQLite)
No setup needed - SQLite database created automatically at `bom.db`.

#### Production (PostgreSQL)

1. Create a Fly Postgres cluster:
```bash
flyctl postgres create --name bom-db --region ewr
```

2. Attach to your app:
```bash
flyctl postgres attach bom-db --app bom-api
```

3. Run migrations:
```bash
flyctl ssh console --app bom-api
alembic upgrade head
```

### Health Checks

The API includes a health endpoint:

```bash
curl https://bom-api.fly.dev/health
```

Expected response:
```json
{
  "status": "healthy",
  "environment": "production",
  "database": "connected"
}
```

### Scaling

Auto-scaling is configured in `fly.toml`:
- `min_machines_running = 0` - Scales to zero when idle (saves cost)
- `auto_stop_machines = "stop"` - Stops idle machines
- `auto_start_machines = true` - Starts on incoming requests

For always-on:
```bash
flyctl scale count 1 --app bom-api
```

### Custom Domain

```bash
flyctl certs create your-domain.com --app bom-api
```

Then add DNS records as instructed.

## Live URLs

| Service | URL |
|---------|-----|
| API | https://bom-api.fly.dev |
| Swagger Docs | https://bom-api.fly.dev/docs |
| ReDoc | https://bom-api.fly.dev/redoc |
| Marketing Site | https://bom-website.fly.dev |
