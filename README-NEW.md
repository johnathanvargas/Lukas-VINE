# Lukas-VINE 2.0 - Todoist-like Task Management

Virtual Intelligence for Nursery Excellence - A modern task management system built with Next.js, TypeScript, and Prisma, designed for nursery and greenhouse operations.

## 🏗️ Architecture

This is a monorepo containing:

- **`/apps/web`** - Next.js frontend with TypeScript (includes API routes)
- **`/packages/schema`** - Prisma schema and database utilities
- **`/worker`** - Background worker using BullMQ for reminders and scheduled tasks

## ✨ Features

- **Today Dashboard** - View and manage tasks for today
- **Projects** - Organize tasks into projects and sections
- **Diagnosis Requests** - Submit and track plant diagnosis requests
- **Plant Diagnostics** - Query symptoms and get treatment recommendations
- **Quick Add** - Natural language task input with date parsing (using chrono-node)
- **Background Worker** - Process reminders and scheduled tasks

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL database (local via Docker or Supabase)
- Redis (local via Docker or cloud instance)

### 1. Clone and Install

```bash
git clone https://github.com/johnathanvargas/Lukas-VINE.git
cd Lukas-VINE
npm install
```

This will install dependencies for all workspaces (web app, schema, worker).

### 2. Set Up Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example.new .env
```

Edit `.env` and configure the following required variables:

#### For Local Development (using Docker Compose):

```env
DATABASE_URL=postgresql://lukas:lukas_password@localhost:5432/lukas_vine
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_API_BASE=
```

#### For Supabase:

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
REDIS_URL=redis://your-redis-host:6379
NEXT_PUBLIC_API_BASE=
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Start Local Services (Docker Compose)

If you're developing locally, start PostgreSQL and Redis:

```bash
docker-compose up -d
```

This will start:
- PostgreSQL on port 5432
- Redis on port 6379

To stop services:
```bash
docker-compose down
```

### 4. Run Database Migrations

Generate Prisma client and run migrations:

```bash
npm run db:generate
npm run db:migrate
```

When prompted for a migration name, enter something like `init` or `initial_schema`.

### 5. Seed the Database

Populate the database with demo data:

```bash
npm run db:seed
```

This creates:
- A demo user
- A sample project ("Greenhouse Tasks")
- Several demo tasks
- Sample plant and chemical data
- A diagnostic record
- A sample diagnosis request

### 6. Start the Application

Start the frontend and worker together:

```bash
npm run dev
```

This runs:
- Next.js frontend on http://localhost:3000
- Background worker (connected to Redis)

Or run them separately:

```bash
# Terminal 1: Frontend
npm run dev:web

# Terminal 2: Worker
npm run dev:worker
```

### 7. Open the App

Visit http://localhost:3000 in your browser. You should see:
- The Today dashboard with demo tasks
- Navigation to Projects, Requests, and Diagnostics

## 📁 Project Structure

```
Lukas-VINE/
├── apps/
│   └── web/                    # Next.js frontend
│       ├── pages/              # Pages and API routes
│       │   ├── _app.tsx        # App wrapper
│       │   ├── index.tsx       # Today dashboard
│       │   ├── projects/       # Projects page
│       │   ├── requests/       # Diagnosis requests page
│       │   ├── diagnostics/    # Diagnostics query/import page
│       │   └── api/            # API routes
│       │       ├── tasks/      # Task CRUD endpoints
│       │       ├── projects/   # Project endpoints
│       │       ├── requests/   # Request endpoints
│       │       └── diagnostics/ # Diagnostic query/import
│       ├── components/         # React components
│       │   ├── QuickAdd.tsx
│       │   ├── TaskList.tsx
│       │   └── TaskDetailPanel.tsx
│       ├── services/           # API wrappers
│       │   └── api.ts
│       ├── lib/                # Utilities
│       │   └── prisma.ts       # Prisma client singleton
│       └── styles/
│           └── globals.css
├── packages/
│   └── schema/                 # Prisma schema package
│       ├── prisma/
│       │   ├── schema.prisma   # Database schema
│       │   └── seed.ts         # Seed script
│       └── package.json
├── worker/                     # Background worker
│   └── src/
│       └── index.ts            # BullMQ worker
├── docker-compose.yml          # Local dev services
├── package.json                # Root workspace config
└── README-NEW.md               # This file
```

## 🗄️ Database Schema

The Prisma schema includes the following models:

- **User** - User accounts (auth pending)
- **Project** - Task organization
- **Section** - Optional grouping within projects
- **Task** - Core task model
- **Label** - Task categorization
- **TaskLabel** - Many-to-many task/label junction
- **Reminder** - Task reminders (processed by worker)
- **Request** - Diagnosis requests
- **Plant** - Plant database
- **Chemical** - Treatment chemicals database
- **DiagnosticRecord** - Symptom/diagnosis/treatment records

## 🔧 Development Commands

```bash
# Install all dependencies
npm install

# Start development (web + worker)
npm run dev

# Build all packages
npm run build

# Database commands
npm run db:migrate        # Run migrations
npm run db:generate       # Generate Prisma client
npm run db:seed           # Seed database
npm run db:setup          # All of the above

# Linting
npm run lint

# Testing
npm run test

# Clean build artifacts
npm run clean
```

## 🧪 Testing the Application

### Test Task Management

1. Go to http://localhost:3000
2. Use the Quick Add input to create tasks: "Water plants tomorrow"
3. Click tasks to edit them
4. Check/uncheck to mark complete
5. Click the × to delete tasks

### Test Projects

1. Navigate to /projects
2. View the demo "Greenhouse Tasks" project
3. (Future: Add new projects)

### Test Diagnosis Requests

1. Navigate to /requests
2. View the sample diagnosis request
3. (Future: Submit new requests)

### Test Diagnostics

1. Navigate to /diagnostics
2. Enter symptoms like "yellowing leaves, spots"
3. Click "Search Diagnostics" to query the database
4. (Optional) Upload a JSON file with plant data to import

## 🔐 Authentication

**Note:** Authentication is not implemented in this initial skeleton. All `userId` fields are nullable. Future work will add:

- Google OAuth integration
- Supabase Auth
- User sessions and protected routes

## 🚢 Deployment

### Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Get your connection string from Project Settings > Database
3. Update `DATABASE_URL` in your `.env` file
4. Run migrations: `npm run db:migrate`
5. Run seed: `npm run db:seed`

### Frontend Deployment (Vercel)

1. Connect your GitHub repo to Vercel
2. Set environment variables:
   - `DATABASE_URL`
   - `REDIS_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy from the `apps/web` directory

### Backend Worker (Render)

1. Create a new Background Worker service on Render
2. Set build command: `npm install && npm run build:worker`
3. Set start command: `cd worker && npm start`
4. Add environment variables:
   - `DATABASE_URL`
   - `REDIS_URL`

### Redis (Upstash or Redis Cloud)

For production, use a managed Redis service like:
- Upstash (free tier available)
- Redis Cloud
- Render Redis (if hosting on Render)

## 📋 Next Steps

This skeleton provides the foundation. Future enhancements:

1. **Authentication** - Add Google OAuth and Supabase Auth
2. **Recurring Tasks** - Implement recurring task engine
3. **Offline Sync** - Add offline-first capabilities
4. **Real-time Updates** - Supabase real-time subscriptions
5. **File Uploads** - Add image upload for diagnosis requests
6. **Email Notifications** - Integrate email service for reminders
7. **Mobile App** - React Native or PWA improvements
8. **Advanced Diagnostics** - ML-based plant disease detection
9. **Team Collaboration** - Multi-user projects and assignments
10. **Reporting** - Analytics and productivity reports

## 🐛 Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running: `docker-compose ps`
- Check `DATABASE_URL` format in `.env`
- For Supabase, ensure connection pooling is configured

### Redis Connection Issues

- Verify Redis is running: `docker-compose ps`
- Check `REDIS_URL` format in `.env`
- Test connection: `redis-cli ping` (should return "PONG")

### Build Errors

- Clear all node_modules: `npm run clean && npm install`
- Regenerate Prisma client: `npm run db:generate`
- Check Node.js version: `node --version` (should be 18+)

### Port Already in Use

- Frontend (3000): Change port with `PORT=3001 npm run dev:web`
- PostgreSQL (5432): Update `POSTGRES_PORT` in `.env`
- Redis (6379): Update `REDIS_PORT` in `.env`

## 📝 License

[Add your license information here]

## 🤝 Contributing

[Add contribution guidelines here]

## 📧 Contact

For questions or support, please contact [your contact information].
