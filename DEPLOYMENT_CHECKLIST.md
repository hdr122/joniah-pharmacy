# Joniah Pharmacy - Deployment Checklist

## ✅ Pre-Deployment Setup

### Code Preparation
- [x] Fixed delivery_locations timestamp column references (db.ts)
- [x] Fixed superadmin JWT branchId override (sdk.ts)
- [x] Fixed superadmin routing for branch context (App.tsx)
- [x] Implemented map bounds auto-fit (AdvancedTracking.tsx)
- [x] Added exitBranch endpoint (routers.ts)
- [x] Created .env.example template
- [x] Created railway.json configuration
- [x] Created Procfile for app startup
- [x] Created comprehensive README.md
- [x] Created deployment guide (RAILWAY_DEPLOYMENT.md)
- [x] Initialized git repository
- [x] Made initial commit

## 🔄 Deployment to Railway.app

### Step 1: GitHub Repository Setup
- [ ] Create GitHub account (if you don't have one)
  - Visit: https://github.com/signup
  - Complete email verification
  
- [ ] Create new GitHub repository
  - Visit: https://github.com/new
  - Repository name: `joniah-pharmacy`
  - Description: "Pharmacy delivery management system with real-time GPS tracking"
  - Choose visibility: Public or Private
  - DO NOT initialize with README (we already have one)
  - Click "Create repository"

- [ ] Push code to GitHub
  ```bash
  cd "E:/مشروع جونيا/joniah_pharmacy"
  git remote add origin https://github.com/YOUR_USERNAME/joniah-pharmacy.git
  git branch -M main
  git push -u origin main
  ```
  Replace `YOUR_USERNAME` with your actual GitHub username

### Step 2: Railway.app Account Setup
- [ ] Create Railway.app account
  - Visit: https://railway.app
  - Click "Login with GitHub" (recommended)
  - Or sign up with email

- [ ] Connect GitHub account to Railway
  - Go to Railway dashboard
  - Settings → Integrations
  - Authorize GitHub if not already done

### Step 3: Create Railway Project
- [ ] Create new project on Railway
  - Click "New Project"
  - Select "Deploy from GitHub"
  - Select `joniah-pharmacy` repository
  - Click "Deploy Now"

- [ ] Railway will automatically detect:
  - Build command: `pnpm install && pnpm run db:push && pnpm run build`
  - Start command: `pnpm start`
  - (From railway.json configuration)

### Step 4: Configure Database Service
- [ ] Add MySQL database to Railway project
  - In Railway dashboard, click "Add Service"
  - Select "MySQL" from the marketplace
  - Railway will automatically provision MySQL instance
  - Note the DATABASE_URL (will be injected as environment variable)

- [ ] Verify database credentials
  - Railway provides DATABASE_URL automatically
  - No manual configuration needed

### Step 5: Set Environment Variables
- [ ] Configure environment variables in Railway
  
  In Railway dashboard → Your Project → Variables, set:
  
  | Variable | Value | Notes |
  |----------|-------|-------|
  | `JWT_SECRET` | Generate random string (32+ chars) | Use: `openssl rand -base64 32` |
  | `OAUTH_SERVER_URL` | `https://oauth.manus.im` | Fixed value |
  | `VITE_APP_ID` | Your app ID from Manus | Contact Manus team |
  | `OWNER_OPEN_ID` | Your OpenID from Manus | Contact Manus team |
  | `VITE_GOOGLE_MAPS_API_KEY` | Your Google Maps API key | Get from Google Cloud Console |
  | `PORT` | `3000` | Fixed value |
  | `NODE_ENV` | `production` | Fixed value |
  | `COOKIE_SECRET` | Generate random string (32+ chars) | Use: `openssl rand -base64 32` |

  **DATABASE_URL** will be automatically set by Railway's MySQL service

- [ ] Verify environment variables are linked
  - Main app service can read DATABASE_URL from MySQL service
  - No additional configuration needed (Railway auto-links)

### Step 6: Trigger Build and Deployment
- [ ] Monitor first deployment
  - Go to Railway dashboard
  - Click your project
  - Watch "Build" logs
  - Watch "Deploy" logs
  - Check for any errors

- [ ] Verify deployment success
  - Status should show "Success"
  - Application should be accessible at: `https://[project-name].up.railway.app`

### Step 7: Test Deployed Application
- [ ] Access the application
  - Open: `https://[project-name].up.railway.app`
  - Should see login page

- [ ] Test login functionality
  - Attempt to login with OAuth credentials
  - Verify session is created

- [ ] Test database operations
  - Create a test order
  - View orders list
  - Verify data is persisted

- [ ] Test delivery tracking
  - Simulate delivery location update
  - Verify GPS coordinates are stored
  - Check that map displays correctly

- [ ] Test branch isolation
  - Login as superadmin
  - Switch to different branch
  - Verify data is branch-specific

- [ ] Test file uploads (if applicable)
  - Upload document/image
  - Verify file is accessible

## 🔧 Configuration Secrets

### Generate JWT Secret
```bash
# On Windows with OpenSSL:
openssl rand -base64 32

# On Mac/Linux:
openssl rand -base64 32

# Or use Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Get Google Maps API Key
1. Go to https://cloud.google.com
2. Create new project
3. Enable Google Maps API
4. Create API key credential
5. Restrict key to your domain
6. Copy key and add to Railway variables

### Get Manus OAuth Credentials
1. Contact Manus team at: support@manus.im
2. Register application
3. Get VITE_APP_ID and OWNER_OPEN_ID
4. Configure OAuth redirect URLs

## 🚨 Common Issues & Solutions

### Build Fails: "DATABASE_URL is required"
- **Issue**: Migration script needs DATABASE_URL at build time
- **Solution**: Ensure DATABASE_URL env var is set in Railway before deployment
- **Workaround**: Disable migrations in build, run manually after deployment

### Deployment Stuck: "Waiting for container..."
- **Issue**: Application might be crashing on startup
- **Solution**: Check logs, look for initialization errors
- **Check**: Verify all required environment variables are set

### Database Connection Refused
- **Issue**: Application can't connect to MySQL
- **Solution**: Verify DATABASE_URL format and credentials
- **Test**: Run `mysql -u root -p -h host` to test connection

### Application Crashes: "Cannot find module"
- **Issue**: Build might have been incomplete
- **Solution**: Clear build cache, rebuild
- **On Railway**: Trigger redeploy from previous successful deployment

### High Memory Usage
- **Issue**: Application using too much RAM
- **Solution**: Check for memory leaks in code
- **Railway**: Upgrade plan to higher tier

## 📊 Monitoring & Maintenance

### View Logs
- Railway Dashboard → Your Project → Logs
- Filter by time or service
- Search for errors/warnings

### Monitor Performance
- Railway Dashboard → Metrics
- Track CPU usage
- Track memory usage
- Track network traffic

### View Database
- Railway Dashboard → MySQL service → Logs
- Check connection count
- Monitor query performance

### Automatic Backups
- Railway MySQL includes automatic daily backups
- Accessible in MySQL service settings
- Can restore from backup if needed

### Manual Backup
```bash
# Using Railway CLI:
railway login
railway link
railway run mysqldump -h $DATABASE_HOST -u $DATABASE_USER -p$DATABASE_PASSWORD $DATABASE_NAME > backup.sql
```

## 🔄 Continuous Deployment

### Automatic Deployments
- Every push to `main` branch triggers automatic deployment
- View deployment history in Railway dashboard
- Automatic rollback available if deployment fails

### Deploy Updates
```bash
# Make code changes
git add .
git commit -m "fix: describe your changes"
git push origin main
# Railway automatically deploys!
```

### Manual Rollback
1. Go to Railway Dashboard
2. Click your project
3. Go to "Deployments" tab
4. Find previous successful deployment
5. Click "Redeploy"

## ✨ Post-Deployment

- [ ] Set up custom domain (optional)
  - Railway → Project → Settings → Custom Domain
  
- [ ] Configure SSL/TLS (automatic with Railway)
  - HTTPS enabled by default
  
- [ ] Set up monitoring & alerts (optional)
  - Railway → Alerts
  
- [ ] Document deployment details
  - Save URL, credentials, API keys securely
  
- [ ] Test mobile app connection (next phase)
  - Update API endpoints to production URL
  
- [ ] Set up CI/CD workflows (optional)
  - GitHub Actions for automated testing
  - Deploy only on green tests

## 📞 Support & Resources

- **Railway Documentation**: https://docs.railway.app
- **Railway Support**: https://railway.app/support
- **GitHub Help**: https://docs.github.com
- **Node.js Best Practices**: https://nodejs.org/en/docs/guides/
- **Drizzle ORM Docs**: https://orm.drizzle.team

---

## Summary

**Current Status**: ✅ Application prepared for deployment
**Git Repository**: ✅ Initialized and committed
**Deployment Files**: ✅ Created (.env.example, railway.json, Procfile, README)
**Next Action**: Push to GitHub and connect to Railway.app

**Estimated Time for Deployment**: 15-30 minutes
