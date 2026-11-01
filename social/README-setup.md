# Marketing Content Calendar — public version

## Files
- `content-calendar.html`
- `content-calendar.css`
- `content-calendar.js`
- `marketing-content-schema.sql`

## 1. Place the files
Place the three website files in the same folder as your existing Social Media Calendar files. The HTML expects the shared stylesheet and assets at `../styles.css` and `../assets/...`. Adjust only those relative paths if your folder structure differs.

## 2. Configure Supabase
1. Open your existing Supabase project.
2. Run the complete `marketing-content-schema.sql` script in Supabase Dashboard > SQL Editor. This script also migrates the earlier private table by removing its `created_by` requirement and replacing owner-only policies.
3. Copy the Supabase Project URL and anon/publishable key from Project Settings > API.
4. Replace `YOUR_SUPABASE_PROJECT_URL` and `YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY` in `content-calendar.js`.
5. Never use the service-role key in browser JavaScript.

## 3. Public access warning
This page does not require login. Anyone who can access it can read, add, edit, and delete every row in `marketing_content`. Do not store confidential campaign plans, customer data, private notes, or other sensitive information. If you want visitors to view the calendar but only you to edit it, a login-protected editor is necessary.

## 4. Navigation link
Add this link to your website navigation, using the correct relative path:
```html
<a href="YOUR-CALENDAR-FOLDER/content-calendar.html">Content Calendar</a>
```

## Included features
Month, week, and list views; add/edit/delete; content type, status, and channel filters; search; overview statistics; upcoming content. This version stores planning text and URLs, not uploaded media files.
