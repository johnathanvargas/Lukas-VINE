# Starting Over with Render and Supabase (very simple step-by-step)

This guide will walk you through connecting your Lukas-VINE project to Supabase (database and auth) and deploying to Render. It explains every step plainly and gives exact commands and files to use.

1) What we will make
- A place to store data about plants, chemicals, and logs (Supabase Postgres)
- A small file that helps your server talk to Supabase (server/supabaseClient.js)
- A SQL file to create basic tables (sql/supabase_init.sql)
- Example environment variables (.env.example)
- A Render service spec (render.yaml)
- This guide to remind you what to do

2) Before we begin (things you need)
- GitHub account (you have one)
- Supabase account: https://supabase.com/signup
- Render account: https://render.com/signup

3) Create a Supabase project
- Go to https://app.supabase.com and click "New project"
- Name it (e.g., lukas-vine)
- Choose a strong DB password and wait for setup to finish

4) Get your Supabase keys
- In Supabase: Settings → API
- Copy:
  - SUPABASE_URL (the Project URL)
  - SUPABASE_ANON_KEY (anon public key)
  - SUPABASE_SERVICE_ROLE_KEY (service role key — keep secret)
  - DATABASE_URL (Postgres connection string, optional)

5) Initialize the database schema
- In Supabase → SQL Editor → New Query
- Paste sql/supabase_init.sql from this repo and click Run
- This creates tables: users, plants, chemicals, logs

6) Local development setup
- Clone repo: git clone https://github.com/johnathanvargas/Lukas-VINE.git
- cd Lukas-VINE
- Copy example env: cp .env.example .env
- Fill values in .env with keys from step 4
- Install dependencies: npm install
- Start server (example): node server/index.js (adjust if your start file is different)

7) Using the Supabase client in server code
- server/supabaseClient.js uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for server-side operations
- Example usage:
  const supabase = require('./supabaseClient')
  const { data, error } = await supabase.from('plants').select('*')

8) Deploy to Render
- New → Static Site OR Web Service (Web Service for Node backend)
- Connect GitHub → choose johnathanvargas/Lukas-VINE
- Set build/start commands:
  - Static site: set publish directory (e.g., '/')
  - Web service: buildCommand: npm install, startCommand: node server/index.js
- Add Environment Variables in Render Dashboard:
  SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (only on server), DATABASE_URL (optional)
- Deploy and monitor logs

9) Security notes
- Never expose SUPABASE_SERVICE_ROLE_KEY to client/browser
- Use Supabase Row Level Security (RLS) policies to protect data
- Treat service_role as very sensitive; limit where it is used

10) Testing deployment
- Open Render URL after deploy
- Test your API endpoints or pages that read/write from Supabase

11) What I prepared to add to the repo
- RENDER_AND_SUPABASE_SETUP.md
- .env.example
- server/supabaseClient.js
- sql/supabase_init.sql
- render.yaml
