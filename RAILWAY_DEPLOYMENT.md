# Joniah Pharmacy - Railway.app Deployment Guide

## Prerequisites
1. GitHub account (for hosting the repository)
2. Railway.app account
3. Git installed locally

## Step 1: Initialize Git Repository

```bash
cd /path/to/joniah_pharmacy
git init
git config user.name "Your Name"
git config user.email "your.email@example.com"
git add .
git commit -m "Initial commit: Joniah Pharmacy delivery management system"
```

## Step 2: Create GitHub Repository

1. Go to https://github.com/new
2. Create a new repository named `joniah-pharmacy`
3. Do NOT initialize with README (we already have content)
4. Copy the repository URL (e.g., `https://github.com/yourusername/joniah-pharmacy.git`)

## Step 3: Push to GitHub

```bash
cd /path/to/joniah_pharmacy
git remote add origin https://github.com/yourusername/joniah-pharmacy.git
git branch -M main
git push -u origin main
```

## Step 4: Setup Railway.app Project

1. Go to https://railway.app and sign up/login
2. Click "Create New Project"
3. Select "Deploy from GitHub"
4. Authorize Railway with your GitHub account
5. Select the `joniah-pharmacy` repository
6. Click "Deploy"

## Step 5: Configure Database on Railway

Railway will automatically detect the build and start commands from `railway.json`.

1. In Railway dashboard, click "Add Service"
2. Select "MySQL"
3. Railway will create a MySQL service and provide `DATABASE_URL` environment variable

## Step 6: Set Environment Variables in Railway

In the Railway dashboard, go to your project and set these variables:

```
DATABASE_URL=mysql://... (automatically set by Railway MySQL service)
JWT_SECRET=your-strong-secret-key-here
OAUTH_SERVER_URL=https://oauth.manus.im
VITE_APP_ID=your-app-id
OWNER_OPEN_ID=your-owner-id
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
PORT=3000
NODE_ENV=production
COOKIE_SECRET=your-strong-cookie-secret-here
```

## Step 7: Connect Services

1. In Railway, select the main app service
2. Go to "Variables" tab
3. Link the MySQL service database URL to `DATABASE_URL`

## Step 8: Run Database Migrations

Railway will automatically run `pnpm run db:push` during build, which executes:
- `drizzle-kit generate` - generates SQL migrations
- `drizzle-kit migrate` - applies migrations to database

## Step 9: Deploy

1. Railway will automatically deploy when you push changes to GitHub
2. Monitor the deployment in the Railway dashboard
3. Once deployed, Railway will provide a public URL

## Monitoring and Logs

1. Go to Railway dashboard
2. Click your project
3. View logs in real-time
4. Monitor resource usage (CPU, memory, database)

## Common Issues and Solutions

### Build Failures
- Check the "Build Logs" tab in Railway
- Ensure all environment variables are set
- Verify the database connection string is correct

### Database Migration Errors
- SSH into the container via Railway CLI
- Run `pnpm run db:push` manually
- Check Drizzle ORM configuration in `server/_core/db.ts`

### Port Issues
- Railway automatically assigns a port via `PORT` environment variable
- The application listens on this port
- No need to manually configure port binding

## Updating the Application

To deploy updates:
1. Make changes locally
2. Commit and push to GitHub
3. Railway automatically deploys on push

```bash
git add .
git commit -m "Fix: describe your changes"
git push origin main
```

## Rollback

If a deployment fails:
1. Go to Railway dashboard
2. Click "Deployments"
3. Select a previous successful deployment
4. Click "Redeploy"

## Database Backup

To backup the MySQL database on Railway:

```bash
# Using Railway CLI
railway run mysqldump -h $DATABASE_HOST -u $DATABASE_USER -p$DATABASE_PASSWORD $DATABASE_NAME > backup.sql
```

Or use Railway's built-in backup features in the dashboard.

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | MySQL connection string | `mysql://user:pass@host:3306/db` |
| `JWT_SECRET` | Secret for JWT signing | Random 32+ character string |
| `OAUTH_SERVER_URL` | OAuth provider URL | `https://oauth.manus.im` |
| `VITE_APP_ID` | Application ID from OAuth | `app-id-123` |
| `OWNER_OPEN_ID` | Owner's OpenID for super admin | `owner-id-123` |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key | `AIz...` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `production` |
| `COOKIE_SECRET` | Secret for cookies | Random 32+ character string |

## Testing the Deployment

Once deployed:

1. Navigate to the public URL provided by Railway
2. Test login functionality
3. Verify delivery tracking works
4. Check database connectivity
5. Test file uploads (if applicable)
6. Verify email/notifications (if applicable)

## Support

For Railway-specific issues:
- https://docs.railway.app
- https://railway.app/support

For application-specific issues:
- Check the application logs in Railway dashboard
- Review the code in the GitHub repository
