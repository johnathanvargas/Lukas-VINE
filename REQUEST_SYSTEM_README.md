# Request-for-Diagnosis System Setup Guide

This guide covers the complete setup and deployment of the VINE request-for-diagnosis system, which enables users to submit plant diagnosis requests with images and provides a triage workflow for managing requests.

## Architecture Overview

The system consists of three main components:

1. **SQL Database Schema** - PostgreSQL tables with Row Level Security (RLS)
2. **Express Admin Server** - Node.js API for admin operations and anonymous submissions
3. **React Client Components** - User-facing UI for submitting and managing requests

### Security Model

- **Client-side (React)**: Uses Supabase anon key with RLS policies - authenticated users can only submit/view their own requests
- **Server-side (Express)**: Uses Supabase service_role key - bypasses RLS for admin operations and anonymous submissions
- **Storage**: Direct uploads from client to Supabase Storage for authenticated users

## Prerequisites

- Supabase account and project (https://supabase.com)
- Node.js 18+ installed locally
- Render account for server deployment (https://render.com) or similar platform
- Git repository access

## Step 1: Supabase Database Setup

### 1.1 Run SQL Migration

1. Log into your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `sql/001_create_requests.sql`
4. Paste and execute the SQL script
5. Verify tables were created:
   - `requests` table
   - `request_comments` table
   - Both tables should have RLS enabled

### 1.2 Create Storage Bucket

1. In Supabase dashboard, navigate to **Storage**
2. Click **New Bucket**
3. Create a bucket named: `request-images`
4. **Important bucket configuration:**
   - **Public bucket**: Images will be publicly accessible via URL (recommended for simple setup)
   - **Private bucket**: Images require signed URLs (more secure, requires additional code)
   
   For this implementation, we recommend starting with a **public bucket** for simplicity.

5. Configure bucket policies:
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

### 1.3 Get Supabase Credentials

Navigate to **Settings > API** in your Supabase dashboard and note:

- **Project URL** (e.g., `https://xxxxx.supabase.co`)
- **anon/public key** (safe for client-side use)
- **service_role key** (NEVER expose client-side!)

## Step 2: Server Setup (Express Admin API)

### 2.1 Install Dependencies

```bash
cd server
npm install
```

This installs:
- `express` - Web framework
- `@supabase/supabase-js` - Supabase client
- `multer` - File upload handling
- `cors` - CORS support

### 2.2 Configure Environment Variables

Create a `.env` file in the `server/` directory:

```env
# Required
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
STORAGE_BUCKET=request-images

# Optional but recommended
ADMIN_API_KEY=your-secret-admin-key-here
PORT=3001

# Optional
NOTIFICATIONS_WEBHOOK_URL=https://your-webhook-url.com/notify
```

**Important**: Add `.env` to `.gitignore` to prevent committing secrets!

### 2.3 Test Locally

```bash
cd server
npm start
```

Server should start on `http://localhost:3001`

Test endpoints:
```bash
# Health check
curl http://localhost:3001/health

# List requests (requires ADMIN_API_KEY if configured)
curl -H "X-Admin-API-Key: your-secret-admin-key-here" \
  http://localhost:3001/api/admin/requests
```

## Step 3: Client Setup (React Components)

### 3.1 Install Supabase Client

In your React project:

```bash
npm install @supabase/supabase-js
```

### 3.2 Configure Environment Variables

Create `.env.local` in your React app root:

```env
REACT_APP_SUPABASE_URL=https://xxxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3.3 Import Components

Copy the client components to your React app:

```
client/src/supabaseClient.js  → your-app/src/supabaseClient.js
client/src/RequestButton.jsx  → your-app/src/components/RequestButton.jsx
client/src/RequestsPage.jsx   → your-app/src/components/RequestsPage.jsx
```

### 3.4 Use Components in Your App

```jsx
import RequestButton from './components/RequestButton';
import RequestsPage from './components/RequestsPage';

function App() {
  return (
    <div>
      {/* Add request button to your main page */}
      <RequestButton />
      
      {/* Add triage page to admin/staff route */}
      <RequestsPage />
    </div>
  );
}
```

## Step 4: Render Deployment (Server)

### 4.1 Create New Web Service

1. Log into Render dashboard
2. Click **New +** → **Web Service**
3. Connect your Git repository
4. Configure:
   - **Name**: `vine-request-api` (or your choice)
   - **Environment**: `Node`
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
   - **Plan**: Choose appropriate plan (Free tier available)

### 4.2 Configure Environment Variables

In Render, add these environment variables:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service_role key |
| `STORAGE_BUCKET` | `request-images` |
| `ADMIN_API_KEY` | Generate a strong random key |
| `PORT` | `10000` (or leave default) |
| `NOTIFICATIONS_WEBHOOK_URL` | (Optional) Your webhook URL |

### 4.3 Deploy

1. Click **Create Web Service**
2. Render will automatically deploy from your Git repository
3. Note the deployment URL (e.g., `https://vine-request-api.onrender.com`)

### 4.4 Verify Deployment

```bash
curl https://your-render-url.onrender.com/health
```

Should return: `{"status":"healthy","timestamp":"...","service":"vine-request-api"}`

## Step 5: Client Deployment (Static Site)

### 5.1 Build React App

```bash
npm run build
```

### 5.2 Deploy to Render (Static Site)

1. In Render dashboard: **New +** → **Static Site**
2. Connect repository
3. Configure:
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `build` (or `dist` depending on your setup)
4. Add environment variables:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`

### 5.3 Alternative: Deploy to Vercel, Netlify, etc.

All major static site hosts support environment variables. Configure the same React env vars as above.

## Step 6: Testing the System

### 6.1 Test Authenticated Flow (Client)

1. Navigate to your deployed client
2. Click "Request Diagnosis" button
3. Sign in when prompted (via magic link email)
4. Fill out form and upload images
5. Submit request
6. Note the tracking ID returned

### 6.2 Test Triage Page

1. Sign in as a staff user
2. Navigate to the Requests/Triage page
3. View pending requests
4. Claim a request (sets assigned_to and status = in-progress)
5. Verify real-time updates work (open in two tabs)

### 6.3 Test Admin API (Anonymous Submission)

```bash
curl -X POST https://your-render-url.onrender.com/api/admin/requests/anonymous \
  -H "X-Admin-API-Key: your-secret-key" \
  -F "reporter_name=Anonymous User" \
  -F "contact=test@example.com" \
  -F "plant_type=Tomato" \
  -F "symptoms=Yellow leaves with brown spots" \
  -F "urgency=medium" \
  -F "images=@/path/to/image.jpg"
```

## API Reference

### Server Endpoints

#### POST /api/admin/requests/anonymous

Submit an anonymous request with optional images.

**Headers:**
- `X-Admin-API-Key` or `Authorization: Bearer <key>` (if ADMIN_API_KEY configured)

**Body (multipart/form-data):**
- `reporter_name` (string, required)
- `contact` (string, required)
- `plant_type` (string, required)
- `symptoms` (string, required)
- `urgency` (string, required): 'low', 'medium', 'high', or 'critical'
- `images` (files, optional): Up to 5 image files, max 10MB each

**Response:**
```json
{
  "id": "uuid",
  "message": "Anonymous request created successfully",
  "images": ["url1", "url2"],
  "created_at": "timestamp"
}
```

#### GET /api/admin/requests

List requests with filtering and pagination.

**Query Parameters:**
- `status` (optional): 'pending', 'in-progress', 'resolved', 'closed'
- `limit` (optional, default: 50, max: 100)
- `offset` (optional, default: 0)
- `order_by` (optional, default: 'created_at'): 'created_at', 'updated_at', 'urgency', 'status'
- `order` (optional, default: 'desc'): 'asc' or 'desc'

**Response:**
```json
{
  "requests": [...],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "has_more": true
  }
}
```

#### PATCH /api/admin/requests/:id

Update a request.

**Body (JSON):**
- `status` (optional): 'pending', 'in-progress', 'resolved', 'closed'
- `assigned_to` (optional): UUID or null
- `comment` (optional): Add a comment to the request

**Response:**
```json
{
  "message": "Request updated successfully",
  "request": {...}
}
```

## Security Best Practices

### 1. Never Expose service_role Key

- ❌ **NEVER** use service_role key in client-side code
- ✅ **ONLY** use service_role key on the server (Express API)
- ✅ Use anon key for client-side operations

### 2. Enable ADMIN_API_KEY

Always set `ADMIN_API_KEY` in production to protect admin endpoints:

```env
ADMIN_API_KEY=$(openssl rand -hex 32)
```

### 3. Rate Limiting (Recommended)

Add rate limiting to prevent abuse:

```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 4. CAPTCHA for Anonymous Submissions

For production anonymous submissions, consider adding CAPTCHA:
- Google reCAPTCHA
- hCaptcha
- Cloudflare Turnstile

### 5. Storage Bucket Security

**For Public Buckets:**
- Images are publicly accessible (simpler)
- Use clear folder structure (request_id/image.jpg)

**For Private Buckets:**
- Generate signed URLs for viewing
- More secure but requires additional code
- Update client to fetch signed URLs

Example for signed URLs:
```javascript
const { data, error } = await supabase.storage
  .from('request-images')
  .createSignedUrl(fileName, 3600); // 1 hour expiry
```

### 6. RLS Policy Review

The provided RLS policies:
- ✅ Allow users to insert their own requests
- ✅ Allow users to view only their own requests
- ✅ Allow assigned staff to view/update assigned requests
- ⚠️ Consider adding admin role for broader access

For admin users, consider adding a role column and policy:
```sql
CREATE POLICY "Admins can view all requests"
ON requests FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);
```

### 7. Input Validation

All endpoints validate:
- Required fields
- Data types
- Value constraints (urgency, status)
- File types and sizes
- UUID formats

### 8. CORS Configuration

Update CORS settings for production:

```javascript
app.use(cors({
  origin: ['https://your-client-domain.com'],
  methods: ['GET', 'POST', 'PATCH'],
  credentials: true
}));
```

## Notifications Setup (Optional)

To enable notifications for new requests:

1. Set up a webhook endpoint (e.g., Zapier, Make.com, custom endpoint)
2. Configure `NOTIFICATIONS_WEBHOOK_URL` in server environment
3. The server will POST to this URL when new requests are created

Webhook payload:
```json
{
  "event": "new_request",
  "request_id": "uuid",
  "urgency": "high",
  "plant_type": "Rose",
  "created_at": "timestamp"
}
```

## Troubleshooting

### Issue: "Missing Supabase environment variables"

**Solution**: Verify `.env` (server) or `.env.local` (client) files exist and contain correct values.

### Issue: "Failed to upload images"

**Solution**: 
1. Check storage bucket exists and is named correctly
2. Verify bucket is public OR policies allow authenticated uploads
3. Check file size limits (10MB default)

### Issue: "ADMIN_API_KEY not configured" warning

**Solution**: This is expected in development. Set `ADMIN_API_KEY` for production.

### Issue: RLS preventing operations

**Solution**: 
1. Verify user is authenticated (client)
2. Verify using service_role key (server)
3. Check RLS policies match your use case
4. Remember: service_role ALWAYS bypasses RLS

### Issue: Real-time updates not working

**Solution**:
1. Verify Supabase Realtime is enabled for the `requests` table
2. Check browser console for subscription errors
3. Ensure anon key has proper permissions

## Maintenance and Monitoring

### Database Maintenance

```sql
-- View request statistics
SELECT status, COUNT(*) FROM requests GROUP BY status;

-- Find old pending requests
SELECT * FROM requests 
WHERE status = 'pending' 
AND created_at < NOW() - INTERVAL '7 days';

-- Clean up old closed requests (optional)
DELETE FROM requests 
WHERE status = 'closed' 
AND updated_at < NOW() - INTERVAL '90 days';
```

### Server Logs

Monitor Render logs for:
- API errors
- Upload failures
- Authentication issues
- Database connection problems

### Storage Monitoring

Regularly check storage usage in Supabase dashboard:
- Storage > request-images bucket
- Monitor total size and file count
- Consider cleanup policy for old files

## Customization

### Styling

The React components use inline styles for simplicity. To customize:

1. Extract styles to CSS modules or styled-components
2. Update colors to match your brand
3. Adjust responsive breakpoints

### Adding Fields

To add fields to requests:

1. **Database**: Add column to requests table
2. **Server**: Update validation in POST/PATCH endpoints
3. **Client**: Add form field to RequestButton component

Example:
```sql
ALTER TABLE requests ADD COLUMN location TEXT;
```

### Custom Status Workflow

Modify status options in:
- SQL CHECK constraint
- Server validation arrays
- Client select options

### Email Notifications

Integrate with email service:

```javascript
// In server/index.js after request creation
const nodemailer = require('nodemailer');

async function sendEmailNotification(request) {
  // Configure your email transport
  // Send notification email
}
```

## Conclusion

Your request-for-diagnosis system is now:
- ✅ Fully integrated with Supabase
- ✅ Secured with RLS and authentication
- ✅ Deployed to Render (server) and static hosting (client)
- ✅ Supporting authenticated and anonymous submissions
- ✅ Providing real-time updates
- ✅ Production-ready with security best practices

For questions or issues, refer to:
- [Supabase Documentation](https://supabase.com/docs)
- [Render Documentation](https://render.com/docs)
- This repository's issues page

---

**Note**: This is a minimal, production-ready implementation. For high-traffic production use, consider:
- Database connection pooling
- Redis caching
- CDN for images
- Enhanced monitoring (Sentry, DataDog)
- Automated backups
- Load balancing
