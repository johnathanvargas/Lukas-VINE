# VINE
Virtual Intelligence for Nursery Excellence

## System Components

VINE includes the following integrated systems:

1. **Plant Diagnostics & Knowledge Base** - Core VINE plant identification and diagnostic tools
2. **Request-for-Diagnosis System** - User-submitted diagnosis requests with triage workflow
   - See [REQUEST_SYSTEM_README.md](REQUEST_SYSTEM_README.md) for setup details
3. **Treatment & Scouting Logs System** - Employee field activity tracking
   - See [LOGS_SYSTEM_README.md](LOGS_SYSTEM_README.md) for setup details

## Environment Variables

The following environment variables are required for the integrated systems:

### Server Environment Variables (in `server/.env`):
```env
# Supabase Configuration (Required)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Storage Configuration
STORAGE_BUCKET=request-images

# Optional but Recommended
ADMIN_API_KEY=your-secret-admin-key-here
PORT=3001
NOTIFICATIONS_WEBHOOK_URL=https://your-webhook-url.com/notify
```

### Client Environment Variables (in `.env.local` or Render environment):
```env
# Supabase Client Configuration (Required)
REACT_APP_SUPABASE_URL=https://xxxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

## Quick Start

### 1. Database Setup

Execute the SQL migrations in your Supabase project:
1. `sql/001_create_requests.sql` - Request-for-diagnosis system
2. `sql/002_create_treatment_logs.sql` - Treatment logs system
3. `sql/003_create_scouting_logs.sql` - Scouting logs system

### 2. Create Supabase Storage Bucket

Create a bucket named `request-images` in your Supabase Storage with public read access.

### 3. Install Dependencies

```bash
# Server dependencies
cd server
npm install

# Return to root
cd ..
```

### 4. Configure Environment Variables

Create `server/.env` with your Supabase credentials (see Environment Variables section above).

### 5. Start Development Server

```bash
cd server
npm start
```

Server will start on `http://localhost:3001`

### 6. Deploy to Render

See [REQUEST_SYSTEM_README.md](REQUEST_SYSTEM_README.md) and [LOGS_SYSTEM_README.md](LOGS_SYSTEM_README.md) for detailed deployment instructions.

## API Endpoints

### Requests System
- `POST /api/admin/requests/anonymous` - Submit anonymous diagnosis request
- `GET /api/admin/requests` - List diagnosis requests
- `PATCH /api/admin/requests/:id` - Update diagnosis request

### Treatment Logs System
- `POST /api/admin/treatment-logs` - Submit treatment log
- `GET /api/admin/treatment-logs` - List treatment logs with filtering

### Scouting Logs System
- `POST /api/admin/scouting-logs` - Submit scouting log
- `GET /api/admin/scouting-logs` - List scouting logs with filtering

All endpoints require `X-Admin-API-Key` header if `ADMIN_API_KEY` is configured.

## Documentation

- [REQUEST_SYSTEM_README.md](REQUEST_SYSTEM_README.md) - Complete guide for request-for-diagnosis system
- [LOGS_SYSTEM_README.md](LOGS_SYSTEM_README.md) - Complete guide for treatment and scouting logs system
- [TESTING_SUMMARY.md](TESTING_SUMMARY.md) - Testing documentation

## Security

- **Never expose** `SUPABASE_SERVICE_ROLE_KEY` in client-side code
- Always use `SUPABASE_ANON_KEY` for client-side operations
- Set strong `ADMIN_API_KEY` for production deployments
- All database tables use Row Level Security (RLS) policies
- Storage bucket policies restrict uploads to authenticated users

## License

[Add your license information here]
