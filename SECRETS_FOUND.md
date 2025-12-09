# Supabase secrets found in repo — Immediate actions required

During an automated scan we found Supabase credentials were committed in .env.example. Publicly exposed service_role keys or anon keys can allow data access or full project control. Follow these steps immediately:

1. Rotate and revoke leaked keys
   - In your Supabase project dashboard -> Settings -> API:
     - Revoke or rotate the SUPABASE_SERVICE_ROLE_KEY immediately (this key bypasses RLS and is high risk).
     - Rotate the SUPABASE_ANON_KEY as well to be safe.
2. Replace keys in deployments
   - Update all deployment environment variables (Render, Vercel, Netlify, GitHub Actions secrets, etc.) with the new keys.
3. Remove secrets from the repo history (optional but recommended if secrets were committed in any commit)
   - Use BFG Repo Cleaner (recommended) or git filter-repo to purge sensitive files from history. Example using BFG:
     - Install BFG: https://rtyley.github.io/bfg-repo-cleaner/
     - Create a file `sensitive-files.txt` with the path `.env.example`
     - Run:
       git clone --mirror git@github.com:johnathanvargas/Lukas-VINE.git
       bfg --delete-files sensitive-files.txt Lukas-VINE.git
       cd Lukas-VINE.git
       git reflog expire --expire=now --all && git gc --prune=now --aggressive
       git push --force
   - Using git filter-repo (official and faster):
       pip install git-filter-repo
       git clone --mirror git@github.com:johnathanvargas/Lukas-VINE.git
       cd Lukas-VINE.git
       git filter-repo --invert-paths --paths .env.example
       git push --force
   - WARNING: Rewriting history requires force pushing and will disrupt forks and collaborators. Coordinate with your team.
4. Audit other locations
   - Check GitHub Actions logs, other repos, past commits, or attached services for leaked keys.
5. Add protective measures
   - Add `.env` and other env paths to .gitignore (this PR does that).
   - Do not store secrets in repo files. Use deployment secret managers.
6. Verify RLS and Database credentials
   - Confirm Row Level Security (RLS) is enabled on tables and policies are correctly set.

If you would like, I can help rotate keys, craft exact commands for your environment, or assist with the history purge and PRs. Note: I cannot rotate keys for you — you must do that via the Supabase dashboard or API.
