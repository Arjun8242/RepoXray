# Frontend (Next.js) Deployment Notes

This frontend is expected to be deployed on Vercel and call the backend deployed on EC2.

## Required Environment Variable

Set this in Vercel Project Settings -> Environment Variables:

```bash
NEXT_PUBLIC_API_BASE_URL=https://<your-backend-domain>
```

Important: for a Vercel-hosted frontend (HTTPS), this backend URL should also be HTTPS. If you keep the backend as HTTP only, browsers will block requests due to mixed-content rules.

## Local Development

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

## Production Checklist (Vercel + EC2)

1. Backend is reachable publicly from the internet.
2. Backend returns CORS headers for your Vercel domain(s).
3. `NEXT_PUBLIC_API_BASE_URL` points to backend HTTPS URL.
4. EC2 security group allows inbound traffic to the backend port (or to Nginx 80/443 if reverse-proxied).
5. Backend health check is working at `/health`.
