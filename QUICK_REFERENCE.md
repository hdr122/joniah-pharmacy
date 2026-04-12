# Joniah Pharmacy - Quick Reference Guide

## 📖 Start Here

**New to this project?** Start with these files in order:
1. `README.md` - Project overview (5 min)
2. `COMPLETE_DEPLOYMENT_GUIDE.md` - Full deployment plan (10 min)
3. `DEPLOYMENT_CHECKLIST.md` - Step-by-step checklist (follow along)

## 🚀 Quick Deploy to Railway (10 minutes)

### Step 1: Push to GitHub
```bash
cd "E:/مشروع جونيا/joniah_pharmacy"
git remote add origin https://github.com/YOUR_USERNAME/joniah-pharmacy.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy on Railway
1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub"
4. Select `joniah-pharmacy` repository
5. Click "Deploy"

### Step 3: Configure
1. Wait for build to complete
2. Click "Add Service" → "MySQL"
3. Go to Variables tab
4. Add environment variables:
   - `JWT_SECRET` = random 32 chars
   - `OAUTH_SERVER_URL` = https://oauth.manus.im
   - `VITE_APP_ID` = your-app-id
   - `OWNER_OPEN_ID` = your-owner-id
   - `VITE_GOOGLE_MAPS_API_KEY` = your-key
   - `NODE_ENV` = production

### Step 4: Test
- Open the Railway URL
- Login with credentials
- Create test order
- Verify tracking works

## 📱 Quick Build Android App (30 minutes)

### Prerequisites
- Android Studio installed
- Java Development Kit (JDK) 11+

### Build Steps
```bash
cd "E:/مشروع جونيا/joniah_pharmacy"

# 1. Build web
pnpm run build

# 2. Add Android
npx cap add android

# 3. Sync code
npx cap sync android

# 4. Open in Android Studio
npx cap open android

# 5. In Android Studio:
#    - Wait for Gradle sync
#    - Build → Build Bundles/APK → Build APK
#    - Run → Run 'app'

# 6. Test on emulator or device
```

## 🔐 Generate Random Secrets

```bash
# Windows:
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# Mac/Linux:
openssl rand -base64 32
```

## 🧭 Project Structure

```
joniah_pharmacy/
├── client/              React frontend
│   └── src/
│       ├── pages/      Admin dashboard, delivery tracking, etc.
│       └── components/ Reusable UI components
├── server/             Express backend
│   ├── _core/         Core business logic
│   ├── db.ts          Database queries
│   └── routers.ts     API endpoints
├── drizzle/           Database schema
└── package.json       Dependencies
```

## 🔧 Key Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install dependencies |
| `pnpm run dev` | Start development server |
| `pnpm run build` | Build for production |
| `pnpm start` | Run production server |
| `pnpm run db:push` | Run database migrations |
| `pnpm check` | Type check TypeScript |
| `pnpm test` | Run tests |
| `git add .` | Stage all changes |
| `git commit -m "msg"` | Create commit |
| `git push` | Push to GitHub |
| `npx cap sync android` | Sync web code to Android |
| `npx cap open android` | Open in Android Studio |

## 🔗 Important URLs

| Service | URL |
|---------|-----|
| GitHub | https://github.com |
| GitHub Create Repo | https://github.com/new |
| Railway.app | https://railway.app |
| Google Cloud Console | https://console.cloud.google.com |
| Google Play Console | https://play.google.com/console |
| Manus OAuth | https://oauth.manus.im |

## 📧 Environment Variables

**For Local Development** (`.env`):
```
DATABASE_URL=mysql://user:password@localhost:3306/joniah_pharmacy
JWT_SECRET=your-secret-key-here
OAUTH_SERVER_URL=https://oauth.manus.im
VITE_APP_ID=your-app-id
OWNER_OPEN_ID=your-owner-id
VITE_GOOGLE_MAPS_API_KEY=your-google-key
PORT=3000
NODE_ENV=development
```

**For Railway** (Dashboard Variables):
```
JWT_SECRET=random-32-chars
OAUTH_SERVER_URL=https://oauth.manus.im
VITE_APP_ID=your-app-id
OWNER_OPEN_ID=your-owner-id
VITE_GOOGLE_MAPS_API_KEY=your-google-key
PORT=3000
NODE_ENV=production
COOKIE_SECRET=random-32-chars
DATABASE_URL=(auto-set by MySQL service)
```

## 🐛 Common Issues

### "DATABASE_URL is required" Error
- **Fix**: Ensure MySQL service is added in Railway
- **Check**: Railway Variables should have DATABASE_URL

### App Won't Start
- **Fix**: Check Railway logs for errors
- **Check**: Verify all environment variables are set

### GPS Not Working
- **Fix**: Grant location permission on device
- **Fix**: For emulator, use Extended Controls → Location

### Can't Connect to API
- **Fix**: Update capacitor.config.ts with correct server URL
- **Fix**: Ensure HTTPS certificate is valid

## ✨ What Was Fixed

✅ GPS tracking queries (timestamp → createdAt)
✅ Superadmin branch switching (JWT branchId override)
✅ Superadmin routing (no infinite redirects)
✅ Map viewport (auto-fit bounds)
✅ Branch exit button (added UI control)

## 🎯 Checklist: Deploy to Railway

- [ ] Git repository initialized ✅ (already done)
- [ ] Code committed ✅ (already done)
- [ ] Create GitHub account
- [ ] Create joniah-pharmacy repository
- [ ] Push code to GitHub
- [ ] Create Railway account
- [ ] Deploy from GitHub on Railway
- [ ] Add MySQL service
- [ ] Set environment variables
- [ ] Wait for build (3-5 minutes)
- [ ] Test application
- [ ] Verify GPS tracking works
- [ ] Confirm branch switching works

## 🎯 Checklist: Build Android App

- [ ] Install Android Studio
- [ ] Install JDK 11+
- [ ] Run `pnpm run build`
- [ ] Run `npx cap add android`
- [ ] Update capacitor.config.ts
- [ ] Run `npx cap sync android`
- [ ] Open in Android Studio
- [ ] Wait for Gradle sync
- [ ] Build APK
- [ ] Test on emulator
- [ ] Test on physical device

## 🎯 Checklist: Publish to Play Store

- [ ] Create Google Play Developer account ($25)
- [ ] Generate signing key
- [ ] Build release APK
- [ ] Create app listing
- [ ] Add screenshots and description
- [ ] Upload APK
- [ ] Submit for review
- [ ] Wait for approval (2-48 hours)

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Project overview & features |
| `COMPLETE_DEPLOYMENT_GUIDE.md` | Master deployment guide |
| `RAILWAY_DEPLOYMENT.md` | Detailed Railway setup |
| `DEPLOYMENT_CHECKLIST.md` | Step-by-step checklist |
| `ANDROID_APP_GUIDE.md` | Android development |
| `GOOGLE_PLAY_PUBLISHING_GUIDE.md` | Play Store submission |
| `WORK_SUMMARY.md` | Summary of all work done |
| `QUICK_REFERENCE.md` | This file |

## ⏱️ Time Estimates

| Task | Time |
|------|------|
| Setup Railway account | 5 min |
| Push to GitHub | 5 min |
| Deploy to Railway | 5-10 min |
| Configure environment | 5 min |
| Test web app | 10 min |
| Build Android app | 20-40 min |
| Test Android app | 30 min |
| Publish to Play Store | 15 min |
| **Total** | **~2-3 hours** |

## 🆘 Getting Help

1. **Check logs**: Railway Dashboard → Logs tab
2. **Read documentation**: See COMPLETE_DEPLOYMENT_GUIDE.md
3. **Check troubleshooting**: See DEPLOYMENT_CHECKLIST.md

## 🔑 Key Login Credentials

To test the app, you'll need:
- OAuth credentials from Manus (ask provider)
- Google Maps API key (from Google Cloud)
- GitHub account (for repository)
- Railway account (free tier available)

## 📞 Support Contacts

- **Railway Support**: https://railway.app/support
- **Android Developer**: https://developer.android.com/docs
- **GitHub Support**: https://github.com/support

---

**Version**: 1.0.0
**Last Updated**: April 13, 2026
**Project Status**: ✅ Ready for Deployment

**Next Action**: Go to DEPLOYMENT_CHECKLIST.md and follow the steps!
