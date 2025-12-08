/**
 * VINE Request-for-Diagnosis Admin API Server
 * 
 * This Express server provides admin endpoints for the request-for-diagnosis system.
 * It uses Supabase service_role key to bypass RLS for admin operations and anonymous submissions.
 * 
 * Environment Variables Required:
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key (NEVER expose client-side!)
 * - STORAGE_BUCKET: Storage bucket name (default: 'request-images')
 * - ADMIN_API_KEY: Optional API key for endpoint protection
 * - PORT: Server port (default: 3001)
 * - NOTIFICATIONS_WEBHOOK_URL: Optional webhook for notifications
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

// =========================================================
// CONFIGURATION
// =========================================================

const PORT = process.env.PORT || 3001;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'request-images';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const NOTIFICATIONS_WEBHOOK_URL = process.env.NOTIFICATIONS_WEBHOOK_URL;

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Missing required environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Initialize Supabase client with service_role key
// This client bypasses ALL Row Level Security policies
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Configure multer for memory storage (files stored in RAM temporarily)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 5 // Maximum 5 files per request
  },
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// =========================================================
// EXPRESS APP SETUP
// =========================================================

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// =========================================================
// AUTHENTICATION MIDDLEWARE
// =========================================================

/**
 * Middleware to check ADMIN_API_KEY if configured
 * If ADMIN_API_KEY is not set in env, this middleware allows all requests
 * but logs a warning.
 */
function requireAdminAuth(req, res, next) {
  if (!ADMIN_API_KEY) {
    console.warn('WARNING: ADMIN_API_KEY not configured - endpoints are unprotected!');
    return next();
  }

  const providedKey = req.headers['x-admin-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!providedKey) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Missing API key. Provide X-Admin-API-Key header.' 
    });
  }

  if (providedKey !== ADMIN_API_KEY) {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'Invalid API key' 
    });
  }

  next();
}

// =========================================================
// HELPER FUNCTIONS
// =========================================================

/**
 * Upload images to Supabase Storage
 * @param {Array} files - Array of multer file objects
 * @param {string} requestId - UUID of the request
 * @returns {Promise<Array>} Array of public URLs
 */
async function uploadImagesToStorage(files, requestId) {
  const uploadPromises = files.map(async (file, index) => {
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${requestId}/${Date.now()}-${index}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Storage upload error:', error);
      throw new Error(`Failed to upload ${file.originalname}: ${error.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    return publicUrl;
  });

  return Promise.all(uploadPromises);
}

/**
 * Send notification webhook (if configured)
 * @param {Object} request - The request object
 * 
 * Note: Requires Node.js 18+ for native fetch API
 * For Node.js < 18, install and import 'node-fetch'
 */
async function sendNotification(request) {
  if (!NOTIFICATIONS_WEBHOOK_URL) {
    return; // No webhook configured
  }

  try {
    const response = await fetch(NOTIFICATIONS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'new_request',
        request_id: request.id,
        urgency: request.urgency,
        plant_type: request.plant_type,
        created_at: request.created_at
      })
    });

    if (!response.ok) {
      console.error('Webhook notification failed:', response.statusText);
    }
  } catch (error) {
    console.error('Error sending notification:', error.message);
  }
}

// =========================================================
// API ENDPOINTS
// =========================================================

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'vine-request-api'
  });
});

/**
 * POST /api/admin/requests/anonymous
 * 
 * Submit an anonymous diagnosis request with image uploads
 * This endpoint accepts multipart form data with fields and files
 * 
 * Fields:
 * - reporter_name: string (required)
 * - contact: string (required) - email or phone
 * - plant_type: string (required)
 * - symptoms: string (required)
 * - urgency: string (required) - 'low', 'medium', 'high', or 'critical'
 * 
 * Files:
 * - images: multiple image files (optional, max 5 files, 10MB each)
 */
app.post('/api/admin/requests/anonymous', requireAdminAuth, upload.array('images', 5), async (req, res) => {
  try {
    const { reporter_name, contact, plant_type, symptoms, urgency } = req.body;

    // Validate required fields
    if (!reporter_name || !contact || !plant_type || !symptoms || !urgency) {
      return res.status(400).json({ 
        error: 'Validation error', 
        message: 'Missing required fields: reporter_name, contact, plant_type, symptoms, urgency' 
      });
    }

    // Validate urgency value
    const validUrgencies = ['low', 'medium', 'high', 'critical'];
    if (!validUrgencies.includes(urgency)) {
      return res.status(400).json({ 
        error: 'Validation error', 
        message: `Invalid urgency. Must be one of: ${validUrgencies.join(', ')}` 
      });
    }

    // Insert request row (reporter_id = NULL for anonymous)
    const { data: request, error: insertError } = await supabase
      .from('requests')
      .insert({
        reporter_id: null, // Anonymous request
        reporter_name,
        contact,
        plant_type,
        symptoms,
        urgency,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return res.status(500).json({ 
        error: 'Database error', 
        message: 'Failed to create request' 
      });
    }

    let imageUrls = [];

    // Upload images if provided
    if (req.files && req.files.length > 0) {
      try {
        imageUrls = await uploadImagesToStorage(req.files, request.id);

        // Update request with image URLs
        const { error: updateError } = await supabase
          .from('requests')
          .update({ images: imageUrls })
          .eq('id', request.id);

        if (updateError) {
          console.error('Failed to update request with images:', updateError);
          // Continue anyway - request is created, just missing image links
        }
      } catch (uploadError) {
        console.error('Image upload error:', uploadError);
        // Continue - request exists but images failed
        return res.status(201).json({
          id: request.id,
          message: 'Request created but image upload failed',
          images: [],
          warning: uploadError.message
        });
      }
    }

    // Send notification
    sendNotification(request).catch(err => 
      console.error('Notification failed:', err)
    );

    res.status(201).json({
      id: request.id,
      message: 'Anonymous request created successfully',
      images: imageUrls,
      created_at: request.created_at
    });

  } catch (error) {
    console.error('Unexpected error in POST /api/admin/requests/anonymous:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

/**
 * GET /api/admin/requests
 * 
 * List diagnosis requests with filtering and pagination
 * 
 * Query parameters:
 * - status: Filter by status ('pending', 'in-progress', 'resolved', 'closed')
 * - limit: Number of results (default: 50, max: 100)
 * - offset: Pagination offset (default: 0)
 * - order_by: Order by field (default: 'created_at')
 * - order: 'asc' or 'desc' (default: 'desc')
 */
app.get('/api/admin/requests', requireAdminAuth, async (req, res) => {
  try {
    const { 
      status, 
      limit = 50, 
      offset = 0, 
      order_by = 'created_at',
      order = 'desc'
    } = req.query;

    // Validate limit
    const parsedLimit = Math.min(parseInt(limit) || 50, 100);
    const parsedOffset = parseInt(offset) || 0;

    // Build query
    let query = supabase
      .from('requests')
      .select('*', { count: 'exact' });

    // Apply status filter if provided
    if (status) {
      const validStatuses = ['pending', 'in-progress', 'resolved', 'closed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          error: 'Validation error', 
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
        });
      }
      query = query.eq('status', status);
    }

    // Apply ordering
    const validOrderByFields = ['created_at', 'updated_at', 'urgency', 'status'];
    if (!validOrderByFields.includes(order_by)) {
      return res.status(400).json({ 
        error: 'Validation error', 
        message: `Invalid order_by. Must be one of: ${validOrderByFields.join(', ')}` 
      });
    }
    
    query = query.order(order_by, { ascending: order === 'asc' });

    // Apply pagination
    query = query.range(parsedOffset, parsedOffset + parsedLimit - 1);

    const { data: requests, error, count } = await query;

    if (error) {
      console.error('Database query error:', error);
      return res.status(500).json({ 
        error: 'Database error', 
        message: 'Failed to fetch requests' 
      });
    }

    res.json({
      requests,
      pagination: {
        total: count,
        limit: parsedLimit,
        offset: parsedOffset,
        has_more: count > parsedOffset + parsedLimit
      }
    });

  } catch (error) {
    console.error('Unexpected error in GET /api/admin/requests:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

/**
 * PATCH /api/admin/requests/:id
 * 
 * Update a diagnosis request
 * 
 * Body (all fields optional):
 * - status: 'pending', 'in-progress', 'resolved', or 'closed'
 * - assigned_to: UUID of user to assign (or null to unassign)
 * - comment: Add a comment (creates entry in request_comments)
 */
app.patch('/api/admin/requests/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assigned_to, comment } = req.body;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ 
        error: 'Validation error', 
        message: 'Invalid request ID format' 
      });
    }

    // Check if request exists
    const { data: existingRequest, error: fetchError } = await supabase
      .from('requests')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existingRequest) {
      return res.status(404).json({ 
        error: 'Not found', 
        message: 'Request not found' 
      });
    }

    // Build update object
    const updates = {};

    if (status !== undefined) {
      const validStatuses = ['pending', 'in-progress', 'resolved', 'closed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          error: 'Validation error', 
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
        });
      }
      updates.status = status;
    }

    if (assigned_to !== undefined) {
      if (assigned_to === null || assigned_to === '') {
        updates.assigned_to = null;
      } else if (uuidRegex.test(assigned_to)) {
        updates.assigned_to = assigned_to;
      } else {
        return res.status(400).json({ 
          error: 'Validation error', 
          message: 'Invalid assigned_to UUID format' 
        });
      }
    }

    // Update request if there are changes
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('requests')
        .update(updates)
        .eq('id', id);

      if (updateError) {
        console.error('Database update error:', updateError);
        return res.status(500).json({ 
          error: 'Database error', 
          message: 'Failed to update request' 
        });
      }
    }

    // Add comment if provided
    // Note: Comments via API are disabled in this minimal implementation
    // To enable, implement proper authentication middleware to get actual user_id
    // For now, return comment in response for client to display
    let commentAdded = null;
    if (comment && comment.trim()) {
      commentAdded = {
        text: comment.trim(),
        timestamp: new Date().toISOString(),
        note: 'Comment included but not persisted - implement authentication for comment persistence'
      };
      console.log('Comment received (not persisted):', comment.trim());
    }

    // Fetch updated request
    const { data: updatedRequest, error: refetchError } = await supabase
      .from('requests')
      .select('*')
      .eq('id', id)
      .single();

    if (refetchError) {
      return res.json({ 
        message: 'Request updated successfully',
        id 
      });
    }

    res.json({
      message: 'Request updated successfully',
      request: updatedRequest,
      comment: commentAdded
    });

  } catch (error) {
    console.error('Unexpected error in PATCH /api/admin/requests/:id:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// =========================================================
// TREATMENT LOGS ENDPOINTS
// =========================================================

/**
 * POST /api/admin/treatment-logs
 * 
 * Submit a treatment log with optional photo uploads
 * This endpoint accepts multipart form data with fields and files
 * 
 * Fields:
 * - employee_name: string (required)
 * - date: string (required) - ISO date format (YYYY-MM-DD)
 * - location: string (required) - Location/zone of treatment
 * - crop: string (required) - Crop type
 * - inputs: string (required) - JSON string of inputs array
 * - notes: string (optional) - Additional notes
 * - weather: string (optional) - JSON string of weather data
 * 
 * Files:
 * - photos: multiple image files (optional, max 5 files, 10MB each)
 */
app.post('/api/admin/treatment-logs', requireAdminAuth, upload.array('photos', 5), async (req, res) => {
  try {
    const { employee_name, date, location, crop, inputs, notes, weather } = req.body;

    // Validate required fields
    if (!employee_name || !date || !location || !crop || !inputs) {
      return res.status(400).json({ 
        error: 'Validation error', 
        message: 'Missing required fields: employee_name, date, location, crop, inputs' 
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ 
        error: 'Validation error', 
        message: 'Invalid date format. Use YYYY-MM-DD' 
      });
    }

    // Parse and validate inputs JSON
    let inputsData;
    try {
      inputsData = JSON.parse(inputs);
      if (!Array.isArray(inputsData)) {
        throw new Error('Inputs must be an array');
      }
    } catch (e) {
      return res.status(400).json({ 
        error: 'Validation error', 
        message: 'Invalid inputs format. Must be a JSON array' 
      });
    }

    // Parse weather JSON if provided
    let weatherData = null;
    if (weather) {
      try {
        weatherData = JSON.parse(weather);
      } catch (e) {
        return res.status(400).json({ 
          error: 'Validation error', 
          message: 'Invalid weather format. Must be valid JSON' 
        });
      }
    }

    // For server-side submission, we need employee_id from authentication
    // In this minimal implementation, we'll set it to null and let client-side handle it
    // OR we can extract it from JWT if implementing proper auth middleware
    // For now, using service_role means we bypass RLS, so we set a placeholder
    const employee_id = req.body.employee_id || null;

    // Insert treatment log
    const { data: log, error: insertError } = await supabase
      .from('treatment_logs')
      .insert({
        employee_id,
        employee_name,
        date,
        location,
        crop,
        inputs: inputsData,
        notes: notes || null,
        weather: weatherData
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return res.status(500).json({ 
        error: 'Database error', 
        message: 'Failed to create treatment log' 
      });
    }

    let photoUrls = [];

    // Upload photos if provided
    if (req.files && req.files.length > 0) {
      try {
        photoUrls = await uploadImagesToStorage(req.files, log.id);

        // Update log with photo URLs
        const { error: updateError } = await supabase
          .from('treatment_logs')
          .update({ photos: photoUrls })
          .eq('id', log.id);

        if (updateError) {
          console.error('Failed to update log with photos:', updateError);
          // Continue anyway - log is created, just missing photo links
        }
      } catch (uploadError) {
        console.error('Photo upload error:', uploadError);
        // Continue - log exists but photos failed
        return res.status(201).json({
          id: log.id,
          message: 'Treatment log created but photo upload failed',
          photos: [],
          warning: uploadError.message
        });
      }
    }

    res.status(201).json({
      id: log.id,
      message: 'Treatment log created successfully',
      photos: photoUrls,
      created_at: log.created_at
    });

  } catch (error) {
    console.error('Unexpected error in POST /api/admin/treatment-logs:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

/**
 * GET /api/admin/treatment-logs
 * 
 * List treatment logs with filtering and pagination
 * 
 * Query parameters:
 * - employee_id: Filter by employee UUID
 * - location: Filter by location
 * - crop: Filter by crop type
 * - date_from: Filter logs on or after date (YYYY-MM-DD)
 * - date_to: Filter logs on or before date (YYYY-MM-DD)
 * - limit: Number of results (default: 50, max: 100)
 * - offset: Pagination offset (default: 0)
 * - order_by: Order by field (default: 'date')
 * - order: 'asc' or 'desc' (default: 'desc')
 */
app.get('/api/admin/treatment-logs', requireAdminAuth, async (req, res) => {
  try {
    const { 
      employee_id,
      location,
      crop,
      date_from,
      date_to,
      limit = 50, 
      offset = 0, 
      order_by = 'date',
      order = 'desc'
    } = req.query;

    // Validate limit
    const parsedLimit = Math.min(parseInt(limit) || 50, 100);
    const parsedOffset = parseInt(offset) || 0;

    // Build query
    let query = supabase
      .from('treatment_logs')
      .select('*', { count: 'exact' });

    // Apply filters
    if (employee_id) {
      query = query.eq('employee_id', employee_id);
    }
    if (location) {
      query = query.eq('location', location);
    }
    if (crop) {
      query = query.eq('crop', crop);
    }
    if (date_from) {
      query = query.gte('date', date_from);
    }
    if (date_to) {
      query = query.lte('date', date_to);
    }

    // Apply ordering
    const validOrderByFields = ['date', 'created_at', 'updated_at', 'location', 'crop'];
    if (!validOrderByFields.includes(order_by)) {
      return res.status(400).json({ 
        error: 'Validation error', 
        message: `Invalid order_by. Must be one of: ${validOrderByFields.join(', ')}` 
      });
    }
    
    query = query.order(order_by, { ascending: order === 'asc' });

    // Apply pagination
    query = query.range(parsedOffset, parsedOffset + parsedLimit - 1);

    const { data: logs, error, count } = await query;

    if (error) {
      console.error('Database query error:', error);
      return res.status(500).json({ 
        error: 'Database error', 
        message: 'Failed to fetch treatment logs' 
      });
    }

    res.json({
      logs,
      pagination: {
        total: count,
        limit: parsedLimit,
        offset: parsedOffset,
        has_more: count > parsedOffset + parsedLimit
      }
    });

  } catch (error) {
    console.error('Unexpected error in GET /api/admin/treatment-logs:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// =========================================================
// SCOUTING LOGS ENDPOINTS
// =========================================================

/**
 * POST /api/admin/scouting-logs
 * 
 * Submit a scouting log with optional photo uploads
 * This endpoint accepts multipart form data with fields and files
 * 
 * Fields:
 * - employee_name: string (required)
 * - date: string (required) - ISO date format (YYYY-MM-DD)
 * - location: string (required) - Location/zone of scouting
 * - crop: string (required) - Crop type
 * - pests_observed: string (required) - JSON string of pests array
 * - notes: string (optional) - Additional notes
 * - weather: string (optional) - JSON string of weather data
 * 
 * Files:
 * - photos: multiple image files (optional, max 5 files, 10MB each)
 */
app.post('/api/admin/scouting-logs', requireAdminAuth, upload.array('photos', 5), async (req, res) => {
  try {
    const { employee_name, date, location, crop, pests_observed, notes, weather } = req.body;

    // Validate required fields
    if (!employee_name || !date || !location || !crop || !pests_observed) {
      return res.status(400).json({ 
        error: 'Validation error', 
        message: 'Missing required fields: employee_name, date, location, crop, pests_observed' 
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ 
        error: 'Validation error', 
        message: 'Invalid date format. Use YYYY-MM-DD' 
      });
    }

    // Parse and validate pests_observed JSON
    let pestsData;
    try {
      pestsData = JSON.parse(pests_observed);
      if (!Array.isArray(pestsData)) {
        throw new Error('Pests observed must be an array');
      }
    } catch (e) {
      return res.status(400).json({ 
        error: 'Validation error', 
        message: 'Invalid pests_observed format. Must be a JSON array' 
      });
    }

    // Parse weather JSON if provided
    let weatherData = null;
    if (weather) {
      try {
        weatherData = JSON.parse(weather);
      } catch (e) {
        return res.status(400).json({ 
          error: 'Validation error', 
          message: 'Invalid weather format. Must be valid JSON' 
        });
      }
    }

    // For server-side submission, we need employee_id from authentication
    const employee_id = req.body.employee_id || null;

    // Insert scouting log
    const { data: log, error: insertError } = await supabase
      .from('scouting_logs')
      .insert({
        employee_id,
        employee_name,
        date,
        location,
        crop,
        pests_observed: pestsData,
        notes: notes || null,
        weather: weatherData
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return res.status(500).json({ 
        error: 'Database error', 
        message: 'Failed to create scouting log' 
      });
    }

    let photoUrls = [];

    // Upload photos if provided
    if (req.files && req.files.length > 0) {
      try {
        photoUrls = await uploadImagesToStorage(req.files, log.id);

        // Update log with photo URLs
        const { error: updateError } = await supabase
          .from('scouting_logs')
          .update({ photos: photoUrls })
          .eq('id', log.id);

        if (updateError) {
          console.error('Failed to update log with photos:', updateError);
          // Continue anyway - log is created, just missing photo links
        }
      } catch (uploadError) {
        console.error('Photo upload error:', uploadError);
        // Continue - log exists but photos failed
        return res.status(201).json({
          id: log.id,
          message: 'Scouting log created but photo upload failed',
          photos: [],
          warning: uploadError.message
        });
      }
    }

    res.status(201).json({
      id: log.id,
      message: 'Scouting log created successfully',
      photos: photoUrls,
      created_at: log.created_at
    });

  } catch (error) {
    console.error('Unexpected error in POST /api/admin/scouting-logs:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

/**
 * GET /api/admin/scouting-logs
 * 
 * List scouting logs with filtering and pagination
 * 
 * Query parameters:
 * - employee_id: Filter by employee UUID
 * - location: Filter by location
 * - crop: Filter by crop type
 * - date_from: Filter logs on or after date (YYYY-MM-DD)
 * - date_to: Filter logs on or before date (YYYY-MM-DD)
 * - limit: Number of results (default: 50, max: 100)
 * - offset: Pagination offset (default: 0)
 * - order_by: Order by field (default: 'date')
 * - order: 'asc' or 'desc' (default: 'desc')
 */
app.get('/api/admin/scouting-logs', requireAdminAuth, async (req, res) => {
  try {
    const { 
      employee_id,
      location,
      crop,
      date_from,
      date_to,
      limit = 50, 
      offset = 0, 
      order_by = 'date',
      order = 'desc'
    } = req.query;

    // Validate limit
    const parsedLimit = Math.min(parseInt(limit) || 50, 100);
    const parsedOffset = parseInt(offset) || 0;

    // Build query
    let query = supabase
      .from('scouting_logs')
      .select('*', { count: 'exact' });

    // Apply filters
    if (employee_id) {
      query = query.eq('employee_id', employee_id);
    }
    if (location) {
      query = query.eq('location', location);
    }
    if (crop) {
      query = query.eq('crop', crop);
    }
    if (date_from) {
      query = query.gte('date', date_from);
    }
    if (date_to) {
      query = query.lte('date', date_to);
    }

    // Apply ordering
    const validOrderByFields = ['date', 'created_at', 'updated_at', 'location', 'crop'];
    if (!validOrderByFields.includes(order_by)) {
      return res.status(400).json({ 
        error: 'Validation error', 
        message: `Invalid order_by. Must be one of: ${validOrderByFields.join(', ')}` 
      });
    }
    
    query = query.order(order_by, { ascending: order === 'asc' });

    // Apply pagination
    query = query.range(parsedOffset, parsedOffset + parsedLimit - 1);

    const { data: logs, error, count } = await query;

    if (error) {
      console.error('Database query error:', error);
      return res.status(500).json({ 
        error: 'Database error', 
        message: 'Failed to fetch scouting logs' 
      });
    }

    res.json({
      logs,
      pagination: {
        total: count,
        limit: parsedLimit,
        offset: parsedOffset,
        has_more: count > parsedOffset + parsedLimit
      }
    });

  } catch (error) {
    console.error('Unexpected error in GET /api/admin/scouting-logs:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// =========================================================
// ERROR HANDLING
// =========================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found', 
    message: `Route ${req.method} ${req.path} not found` 
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large', 
        message: 'Maximum file size is 10MB' 
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        error: 'Too many files', 
        message: 'Maximum 5 files allowed' 
      });
    }
  }

  res.status(500).json({ 
    error: 'Internal server error', 
    message: err.message 
  });
});

// =========================================================
// START SERVER
// =========================================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  VINE Request-for-Diagnosis Admin API Server              ║
╠════════════════════════════════════════════════════════════╣
║  Status: Running on port ${PORT}                              ║
║  Storage Bucket: ${STORAGE_BUCKET}                        ║
║  Admin Auth: ${ADMIN_API_KEY ? 'Enabled ✓' : 'Disabled (WARNING!)'}            ║
║  Notifications: ${NOTIFICATIONS_WEBHOOK_URL ? 'Enabled ✓' : 'Disabled'}         ║
╚════════════════════════════════════════════════════════════╝
  `);
  
  if (!ADMIN_API_KEY) {
    console.warn('\n⚠️  WARNING: ADMIN_API_KEY not set - API endpoints are unprotected!');
    console.warn('   Set ADMIN_API_KEY environment variable for production.\n');
  }
});
