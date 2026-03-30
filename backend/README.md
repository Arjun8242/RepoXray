# Backend (Express) Deployment Notes

## Environment Variables

Copy `.env.example` to `.env` and fill values.

Required variables:

- `CORS_ORIGINS` - comma-separated allowed origins
- `CLAUDE_API_KEY`
- `LLM_MODEL`
- `GITHUB_TOKEN`
- `DATABASE_URL`

CORS example:

```bash
CORS_ORIGINS=https://myapp.vercel.app,https://my-custom-domain.com,*.vercel.app
```

## Health Check

Use the endpoint below for monitoring and load balancer checks:

```bash
GET /health
```

## Production Checklist (EC2)

1. Run backend with a process manager (PM2 or systemd).
2. Keep secrets only in `.env` or EC2 environment settings.
3. Restrict CORS to your deployed frontend domains.
4. Put backend behind Nginx with HTTPS (recommended).
5. Open only required ports in the EC2 security group.
6. Confirm `/health` returns `200`.
