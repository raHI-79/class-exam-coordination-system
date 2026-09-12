# SUST CSE Class & Exam Coordination System — Deployment

## Recommended: Render (one public URL)

1. Push this project to a GitHub repository.
2. In Render, create **New + → Web Service** and connect the GitHub repository.
3. Runtime: **Node**.
4. Build Command:
   `npm ci --prefix backend && npm ci --prefix frontend && npm run build --prefix frontend`
5. Start Command:
   `node backend/server.js`
6. Health Check Path:
   `/api/health`
7. Add environment variable:
   `JWT_SECRET` = a long random secret.
   (If you use `render.yaml`, Render can generate it automatically.)
8. Deploy. Render will give a public URL such as:
   `https://sust-cse-system.onrender.com`

The backend now serves the built React frontend, so `/`, `/student`, `/cr`, `/teacher`, `/portal-admin`, etc. work from the same URL.

## Default admin
- Username: `admin`
- Password: `admin123`

**Change the default admin password immediately after first login.**

## Important database note
This project uses SQLite (`backend/db/sust_cse.sqlite`). On a free cloud service with ephemeral storage, database/uploads can be lost after a restart/redeploy. For a real production system, use persistent storage or migrate the database to PostgreSQL and store uploads in object storage.

## Google search
Hosting makes the site live and accessible by URL. It does **not** guarantee immediate Google/Bing indexing. To make it searchable, add the deployed URL to Google Search Console and request indexing.
