# Joniah Pharmacy - Delivery Management System

A comprehensive, multi-tenant pharmacy delivery management system with real-time GPS tracking, advanced analytics, and native mobile applications.

## 🎯 Features

### Core Functionality
- **Multi-Branch Management**: Support for multiple pharmacy branches with separate data isolation
- **Real-Time GPS Tracking**: Live location tracking of delivery personnel using Google Maps integration
- **Order Management**: Complete order lifecycle from creation to delivery completion
- **Role-Based Access Control**: Support for SuperAdmin, Admin, Branch Manager, and Delivery Personnel roles
- **Analytics Dashboard**: Advanced tracking, delivery statistics, and performance metrics
- **PWA Support**: Progressive Web App for web and mobile browsers

### Technical Highlights
- **Full-Stack Type Safety**: TypeScript across frontend and backend with tRPC
- **Real-Time Updates**: WebSocket support for live order and location updates
- **Database Optimization**: Drizzle ORM with MySQL for efficient data operations
- **Authentication**: JWT-based session management with OAuth integration
- **Mobile Native**: Capacitor integration for native Android/iOS apps

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and pnpm
- MySQL 8.0+ database
- Google Maps API key
- OAuth provider setup (Manus)

### Local Development

```bash
# Install dependencies
pnpm install

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
pnpm run db:push

# Start development server
pnpm run dev
```

The application will be available at `http://localhost:3000`

### Project Structure

```
joniah_pharmacy/
├── client/                    # React frontend (Vite)
│   ├── src/
│   │   ├── pages/            # Page components
│   │   ├── components/       # Reusable components
│   │   ├── App.tsx          # Main app router
│   │   └── main.tsx         # Entry point
│   └── public/              # Static assets
├── server/                   # Express backend
│   ├── _core/               # Core server logic
│   │   ├── index.ts        # Server entry point
│   │   ├── sdk.ts          # Authentication SDK
│   │   └── env.ts          # Environment config
│   ├── routers.ts           # tRPC routes
│   ├── db.ts                # Database operations
│   └── db/                  # Database initialization
├── drizzle/                 # Database schema
│   ├── schema.ts            # Table definitions
│   └── migrations/          # Migration files
├── shared/                  # Shared types and utilities
│   ├── types/               # TypeScript interfaces
│   └── const.ts             # Constants
└── package.json            # Dependencies and scripts
```

## 🛠️ Build & Deploy

### Build for Production

```bash
pnpm run build
```

This command:
1. Builds React frontend with Vite
2. Bundles backend with esbuild
3. Output in `dist/` directory

### Start Production Server

```bash
pnpm start
```

## 🌐 Railway.app Deployment

For complete deployment instructions, see [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)

### Quick Deploy

1. Push code to GitHub:
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. Connect to Railway:
   - Go to https://railway.app
   - Create new project from GitHub repository
   - Set environment variables
   - Deploy

## 📱 Mobile App Development

The project includes Capacitor integration for native Android/iOS apps.

```bash
# Build web assets for mobile
pnpm run build

# Open in Capacitor
npx cap open android
```

## 🗄️ Database

### Schema Overview

**Users**: Admin, branch managers, delivery personnel
**Orders**: Delivery orders with status tracking
**Deliveries**: Delivery assignments and details
**Delivery Locations**: GPS coordinates and timestamps
**Branches**: Multi-branch organization
**Activity Logs**: Audit trail for all operations

### Migrations

Migrations are automatically run during `pnpm run db:push`:

```bash
pnpm run db:push    # Generate and apply migrations
```

## 🔐 Authentication

### JWT Session Management
- Sessions stored in secure cookies
- JWT tokens signed with `JWT_SECRET`
- Automatic session verification on requests
- Support for multi-branch superadmin access

### OAuth Integration
- Integration with Manus OAuth provider
- Automatic user synchronization
- Multiple login platform support

## 📊 Role-Based Features

### SuperAdmin
- View all branches
- Switch between branches
- Manage administrators across system
- Access to advanced analytics

### Branch Admin
- Manage branch employees
- View branch-specific data
- Process orders
- Track delivery personnel

### Delivery Personnel
- View assigned orders
- Update delivery status
- Share real-time location
- Receive notifications

## 📡 API Endpoints

The application uses tRPC for type-safe API calls. All endpoints are defined in `server/routers.ts`

### Key Routes
- `auth.*` - Authentication and sessions
- `orders.*` - Order management
- `deliveries.*` - Delivery tracking
- `branches.*` - Multi-branch management
- `analytics.*` - Dashboard and metrics

## 🧪 Testing

```bash
# Run tests
pnpm test

# Type checking
pnpm check
```

## 📝 Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MySQL connection string |
| `JWT_SECRET` | Secret for JWT signing |
| `OAUTH_SERVER_URL` | OAuth provider URL |
| `VITE_APP_ID` | Application ID |
| `OWNER_OPEN_ID` | Owner's OpenID |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key |
| `PORT` | Server port (default: 3000) |
| `NODE_ENV` | Environment (development/production) |

See `.env.example` for complete configuration template.

## 🐛 Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` environment variable
- Ensure MySQL service is running
- Check network connectivity to database host

### Build Failures
- Clear `node_modules` and reinstall: `pnpm install`
- Clear build cache: `rm -rf dist`
- Check TypeScript compilation: `pnpm check`

### Authentication Errors
- Verify OAuth credentials in `.env`
- Check JWT_SECRET is set
- Clear browser cookies and retry

### GPS Tracking Not Working
- Verify Google Maps API key is valid
- Check browser geolocation permissions
- Ensure HTTPS connection (required for geolocation)

## 📚 Documentation

- [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md) - Deployment guide
- [REVIEW_REPORT.md](./REVIEW_REPORT.md) - Code review findings
- [TESTING_NOTES.md](./TESTING_NOTES.md) - Testing documentation

## 🤝 Contributing

1. Create a feature branch
2. Make changes and test locally
3. Commit with descriptive messages
4. Push and create pull request

## 📄 License

MIT License - See LICENSE file for details

## 📧 Support

For issues and questions:
- Check existing issues in GitHub
- Review documentation
- Contact development team

---

**Last Updated**: April 2026
**Version**: 1.0.0
