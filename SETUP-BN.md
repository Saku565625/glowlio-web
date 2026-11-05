# Glowlio Supabase connection

These files connect the plain HTML storefront and admin panel to the Supabase project.
The browser code contains only the project URL and publishable key. Do not add a secret
or service-role key to these files.

## Before publishing these files

1. In Supabase SQL Editor, run supabase/migrations/202611050001_storefront_checkout.sql once.
   It adds the image path column used by admin uploads and the checkout function that
   recalculates prices from the database.
2. Replace the existing index.html, login.html, and admin.html in the GitHub
   repository with the files in this package.
3. Add supabase-client.js, storefront.js, login.js, admin.js, and the
   supabase/migrations SQL file to the repository.
4. After the Cloudflare deployment finishes, open /login.html, sign in with the
   confirmed admin email and password, then open /admin.html.
5. Add products through the admin panel. The earlier reset removed the old product rows.

The Connect dialog's Next.js instructions do not apply to this plain HTML project.

## Before accepting public orders

The checkout function verifies product availability and calculates the prices and
delivery charge in Postgres. Add Cloudflare Turnstile or request rate limiting before
relying on the public order form in production.
