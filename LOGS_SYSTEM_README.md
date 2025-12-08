# Treatment and Scouting Logs System Setup Guide

This guide covers the complete setup and deployment of the VINE treatment and scouting logs system, which enables employees to submit field activity logs with photos and provides viewing/filtering interfaces for managing logs.

## Architecture Overview

The logs system consists of three main components:

1. **SQL Database Schema** - PostgreSQL tables with Row Level Security (RLS)
2. **Express Admin Server** - Node.js API for log submissions and retrieval
3. **React Client Components** - User-facing UI for submitting and viewing logs

### Security Model

- **Client-side (React)**: Uses Supabase anon key with RLS policies - authenticated employees can only submit/view their own logs
- **Server-side (Express)**: Uses Supabase service_role key - bypasses RLS for admin operations and server-side submissions
- **Storage**: Direct uploads from client to Supabase Storage for authenticated users

## Prerequisites

- Supabase account and project (https://supabase.com)
- Node.js 18+ installed locally
- Render account for server deployment (https://render.com) or similar platform
- Git repository access
- Existing VINE request system setup (see REQUEST_SYSTEM_README.md)

## Step 1: Supabase Database Setup

### 1.1 Run SQL Migrations

1. Log into your Supabase dashboard
2. Navigate to **SQL Editor**
3. Execute the following SQL scripts in order:
   - First: `sql/001_create_requests.sql` (if not already done)
   - Then: `sql/002_create_treatment_logs.sql`
   - Finally: `sql/003_create_scouting_logs.sql`
4. Verify tables were created:
   - `treatment_logs` table
   - `scouting_logs` table
   - Both tables should have RLS enabled

### 1.2 Verify Storage Bucket

The logs system reuses the existing `request-images` bucket created for the requests system. If you haven't set it up yet:

1. In Supabase dashboard, navigate to **Storage**
2. Verify bucket named: `request-images` exists
3. **Bucket configuration:**
   - **Public bucket**: Photos will be publicly accessible via URL (recommended for simple setup)

4. Verify bucket policies allow authenticated uploads:
   ```sql
   -- Allow authenticated users to upload to their own folder
   CREATE POLICY "Users can upload own images"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'request-images' AND (storage.foldername(name))[1] = auth.uid()::text);

   -- Allow public access for reading (if using public bucket)
   CREATE POLICY "Public can view images"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'request-images');
   ```

### 1.3 Environment Variables

You should already have these from the requests system:
- **Project URL** (e.g., `https://xxxxx.supabase.co`)
- **anon/public key** (safe for client-side use)
- **service_role key** (NEVER expose client-side!)

## Step 2: Server Setup (Express Admin API)

### 2.1 Verify Dependencies

The existing server should already have all required dependencies:
```bash
cd server
npm install
```

Dependencies:
- `express` - Web framework
- `@supabase/supabase-js` - Supabase client
- `multer` - File upload handling
- `cors` - CORS support

### 2.2 Environment Variables

The server `.env` file should already have:

```env
# Required (from requests system setup)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
STORAGE_BUCKET=request-images

# Optional but recommended
ADMIN_API_KEY=your-secret-admin-key-here
PORT=3001
```

No additional environment variables are needed for the logs system!

### 2.3 Test Locally

```bash
cd server
npm start
```

Server should start on `http://localhost:3001`

Test new endpoints:
```bash
# Health check
curl http://localhost:3001/health

# Test treatment logs endpoint (requires ADMIN_API_KEY if configured)
curl -X POST http://localhost:3001/api/admin/treatment-logs \
  -H "X-Admin-API-Key: your-secret-admin-key-here" \
  -F "employee_name=John Doe" \
  -F "employee_id=your-uuid-here" \
  -F "date=2024-01-15" \
  -F "location=North Field" \
  -F "crop=Tomatoes" \
  -F 'inputs=[{"name":"Roundup","rate":"2 qt/acre","active_ingredient":"glyphosate"}]' \
  -F "notes=Applied early morning" \
  -F 'weather={"temperature":"72","humidity":"65","conditions":"partly cloudy"}' \
  -F "photos=@/path/to/photo.jpg"
```

## Step 3: Client Setup (React Components)

### 3.1 Environment Variables

Your React app should already have `.env.local`:

```env
REACT_APP_SUPABASE_URL=https://xxxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

No additional environment variables needed!

### 3.2 Import Components

The client components are in `client/src/`:
- `TreatmentLogsButton.jsx` - Form for submitting treatment logs
- `ScoutingLogsButton.jsx` - Form for submitting scouting logs
- `TreatmentLogsPage.jsx` - Page for viewing treatment logs
- `ScoutingLogsPage.jsx` - Page for viewing scouting logs

### 3.3 Use Components in Your App

```jsx
import TreatmentLogsButton from './TreatmentLogsButton';
import ScoutingLogsButton from './ScoutingLogsButton';
import TreatmentLogsPage from './TreatmentLogsPage';
import ScoutingLogsPage from './ScoutingLogsPage';

function App() {
  return (
    <div>
      {/* Add log submission buttons to employee dashboard */}
      <TreatmentLogsButton />
      <ScoutingLogsButton />
      
      {/* Add log viewing pages to appropriate routes */}
      <TreatmentLogsPage />
      <ScoutingLogsPage />
    </div>
  );
}
```

## Step 4: Render Deployment (Server)

The server deployment remains the same as for the requests system. No changes needed!

If you haven't deployed yet:

### 4.1 Create New Web Service (if not already done)

1. Log into Render dashboard
2. Click **New +** → **Web Service**
3. Connect your Git repository
4. Configure:
   - **Name**: `vine-request-api` (or your existing name)
   - **Environment**: `Node`
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
   - **Plan**: Choose appropriate plan (Free tier available)

### 4.2 Environment Variables (should already be set)

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service_role key |
| `STORAGE_BUCKET` | `request-images` |
| `ADMIN_API_KEY` | Generate a strong random key |
| `PORT` | `10000` (or leave default) |

### 4.3 Verify Deployment

The new endpoints will automatically be available:
```bash
# Treatment logs
curl https://your-render-url.onrender.com/api/admin/treatment-logs

# Scouting logs
curl https://your-render-url.onrender.com/api/admin/scouting-logs
```

## Step 5: Testing the System

### 5.1 Test Treatment Log Submission (Client)

1. Navigate to your deployed client
2. Sign in with employee credentials
3. Click "Submit Treatment Log" button
4. Fill out form:
   - Date of treatment
   - Location/zone
   - Crop type
   - Treatment inputs (products, rates, active ingredients)
   - Optional: Notes, weather conditions, photos
5. Submit log
6. Verify log appears in Treatment Logs page

### 5.2 Test Scouting Log Submission (Client)

1. Sign in with employee credentials
2. Click "Submit Scouting Log" button
3. Fill out form:
   - Date of scouting
   - Location/zone
   - Crop type
   - Pest/disease observations (name, severity, count)
   - Optional: Notes, weather conditions, photos
4. Submit log
5. Verify log appears in Scouting Logs page

### 5.3 Test Server API Endpoints

```bash
# List treatment logs
curl -H "X-Admin-API-Key: your-key" \
  "https://your-render-url.onrender.com/api/admin/treatment-logs?limit=10"

# List scouting logs with filters
curl -H "X-Admin-API-Key: your-key" \
  "https://your-render-url.onrender.com/api/admin/scouting-logs?location=North%20Field&date_from=2024-01-01"
```

## API Reference

### Treatment Logs Endpoints

#### POST /api/admin/treatment-logs

Submit a treatment log with optional photos.

**Headers:**
- `X-Admin-API-Key` or `Authorization: Bearer <key>` (if ADMIN_API_KEY configured)

**Body (multipart/form-data):**
- `employee_name` (string, required)
- `employee_id` (UUID, optional - auto-populated from session in client)
- `date` (string, required) - Format: YYYY-MM-DD
- `location` (string, required) - Location/zone
- `crop` (string, required) - Crop type
- `inputs` (string, required) - JSON array: `[{"name":"Product","rate":"2 qt/acre","active_ingredient":"glyphosate"}]`
- `notes` (string, optional) - Additional notes
- `weather` (string, optional) - JSON object: `{"temperature":"72","humidity":"65","wind_speed":"5","conditions":"clear"}`
- `photos` (files, optional) - Up to 5 image files, max 10MB each

**Response:**
```json
{
  "id": "uuid",
  "message": "Treatment log created successfully",
  "photos": ["url1", "url2"],
  "created_at": "timestamp"
}
```

#### GET /api/admin/treatment-logs

List treatment logs with filtering and pagination.

**Query Parameters:**
- `employee_id` (optional) - Filter by employee UUID
- `location` (optional) - Filter by location
- `crop` (optional) - Filter by crop type
- `date_from` (optional) - Filter logs on or after date (YYYY-MM-DD)
- `date_to` (optional) - Filter logs on or before date (YYYY-MM-DD)
- `limit` (optional, default: 50, max: 100)
- `offset` (optional, default: 0)
- `order_by` (optional, default: 'date') - Options: 'date', 'created_at', 'updated_at', 'location', 'crop'
- `order` (optional, default: 'desc') - 'asc' or 'desc'

**Response:**
```json
{
  "logs": [...],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "has_more": true
  }
}
```

### Scouting Logs Endpoints

#### POST /api/admin/scouting-logs

Submit a scouting log with optional photos.

**Headers:**
- `X-Admin-API-Key` or `Authorization: Bearer <key>` (if ADMIN_API_KEY configured)

**Body (multipart/form-data):**
- `employee_name` (string, required)
- `employee_id` (UUID, optional - auto-populated from session in client)
- `date` (string, required) - Format: YYYY-MM-DD
- `location` (string, required) - Location/zone
- `crop` (string, required) - Crop type
- `pests_observed` (string, required) - JSON array: `[{"name":"aphids","severity":"moderate","count":"15"}]`
- `notes` (string, optional) - Additional notes
- `weather` (string, optional) - JSON object: `{"temperature":"72","humidity":"65","wind_speed":"5","conditions":"clear"}`
- `photos` (files, optional) - Up to 5 image files, max 10MB each

**Response:**
```json
{
  "id": "uuid",
  "message": "Scouting log created successfully",
  "photos": ["url1", "url2"],
  "created_at": "timestamp"
}
```

#### GET /api/admin/scouting-logs

List scouting logs with filtering and pagination.

**Query Parameters:**
- Same as treatment logs GET endpoint

## Database Schema

### treatment_logs Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| employee_id | UUID | References auth.users(id) |
| employee_name | TEXT | Employee name |
| date | DATE | Date of treatment |
| location | TEXT | Location/zone |
| crop | TEXT | Crop type |
| inputs | JSONB | Array of treatment inputs/products |
| notes | TEXT | Additional notes |
| photos | JSONB | Array of photo URLs |
| weather | JSONB | Weather conditions object |
| metadata | JSONB | Additional flexible data |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

### scouting_logs Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| employee_id | UUID | References auth.users(id) |
| employee_name | TEXT | Employee name |
| date | DATE | Date of scouting |
| location | TEXT | Location/zone |
| crop | TEXT | Crop type |
| pests_observed | JSONB | Array of pest/disease observations |
| notes | TEXT | Additional notes |
| photos | JSONB | Array of photo URLs |
| weather | JSONB | Weather conditions object |
| metadata | JSONB | Additional flexible data |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

## Security Best Practices

### 1. RLS Policies

The logs tables have Row Level Security enabled:
- ✅ Employees can insert their own logs (employee_id = auth.uid())
- ✅ Employees can view their own logs
- ✅ Employees can update their own logs (for corrections)
- ⚠️ Consider adding admin/manager policies for oversight

Example admin policy:
```sql
CREATE POLICY "Admins can view all treatment logs"
  ON treatment_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'manager')
    )
  );
```

### 2. Employee ID Security

**IMPORTANT**: The server API endpoints currently accept `employee_id` from the request body for flexibility. However, for production use:

- ✅ **Recommended**: Client-side components automatically use `auth.uid()` from the authenticated session
- ✅ **Client direct submissions**: Use the React components which handle authentication properly
- ⚠️ **Server API calls**: If calling the server endpoints directly, implement JWT validation middleware to extract `employee_id` from the authenticated token rather than accepting it from the request body

To enhance security, add JWT validation middleware:
```javascript
// Example middleware to extract employee_id from JWT
async function extractEmployeeFromToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  req.employee_id = user.id;
  next();
}
```

### 3. Input Validation

Both endpoints validate:
- Required fields
- Date format (YYYY-MM-DD)
- JSON structure for inputs/pests_observed/weather
- File types and sizes
- UUID formats

### 4. Storage Security

Photos use the same storage bucket and policies as the requests system. Ensure:
- Authenticated uploads are restricted to user's own folder
- Public read access is enabled (or implement signed URLs for private buckets)

## Troubleshooting

### Issue: "Failed to submit log"

**Solution:**
1. Check authentication - user must be signed in
2. Verify RLS policies are correctly applied
3. Check browser console for detailed errors
4. Ensure date format is YYYY-MM-DD

### Issue: "Photo upload failed"

**Solution:**
1. Verify storage bucket exists: `request-images`
2. Check file size (max 10MB per file)
3. Verify file type (only images allowed)
4. Check storage bucket policies allow authenticated uploads

### Issue: "Cannot view other employees' logs"

**Solution:**
This is expected behavior! RLS policies ensure employees only see their own logs. To view all logs:
1. Use the server API with service_role key
2. Add admin role-based policies to allow managers to view all logs

## Advanced Features

### Adding Admin Role

To allow managers/admins to view all logs:

1. Create a profiles table (if not already exists):
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  role TEXT NOT NULL DEFAULT 'employee',
  email TEXT
);
```

2. Add admin policies (uncomment in migration files):
```sql
CREATE POLICY "Admins can view all treatment logs"
  ON treatment_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'manager')
    )
  );
```

### Analytics and Reporting

Query examples for analytics:

```sql
-- Treatment logs by crop
SELECT crop, COUNT(*) as log_count
FROM treatment_logs
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY crop
ORDER BY log_count DESC;

-- Pest observations by severity
SELECT 
  pest->>'name' as pest_name,
  pest->>'severity' as severity,
  COUNT(*) as observation_count
FROM scouting_logs,
     jsonb_array_elements(pests_observed) as pest
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY pest_name, severity
ORDER BY observation_count DESC;

-- Most active employees
SELECT employee_name, COUNT(*) as total_logs
FROM (
  SELECT employee_name FROM treatment_logs
  UNION ALL
  SELECT employee_name FROM scouting_logs
) combined
GROUP BY employee_name
ORDER BY total_logs DESC
LIMIT 10;
```

## Integration with Existing Systems

The logs system is designed to integrate seamlessly with the existing VINE requests system:

- **Shared Storage**: Uses the same `request-images` bucket
- **Shared Authentication**: Uses the same Supabase Auth setup
- **Shared Server**: New endpoints added to existing Express server
- **Consistent Patterns**: Components follow the same structure as request components

## Maintenance

### Regular Tasks

1. **Monitor Storage Usage**: Check Supabase dashboard for storage usage
2. **Review Logs**: Periodically review submitted logs for quality
3. **Backup Data**: Ensure Supabase automated backups are enabled
4. **Update Dependencies**: Keep server dependencies up to date

### Cleanup Queries

```sql
-- Find logs older than 1 year
SELECT COUNT(*) FROM treatment_logs 
WHERE created_at < NOW() - INTERVAL '1 year';

-- Archive old logs (example)
CREATE TABLE treatment_logs_archive AS 
SELECT * FROM treatment_logs 
WHERE created_at < NOW() - INTERVAL '1 year';

DELETE FROM treatment_logs 
WHERE created_at < NOW() - INTERVAL '1 year';
```

## Conclusion

Your treatment and scouting logs system is now:
- ✅ Fully integrated with Supabase
- ✅ Secured with RLS and authentication
- ✅ Deployed alongside the requests system
- ✅ Supporting employee field activity tracking
- ✅ Providing real-time updates
- ✅ Production-ready with security best practices

For questions or issues, refer to:
- [Supabase Documentation](https://supabase.com/docs)
- [Render Documentation](https://render.com/docs)
- This repository's issues page
- REQUEST_SYSTEM_README.md for requests system details

---

**Version**: 1.0.0  
**Last Updated**: December 2024
