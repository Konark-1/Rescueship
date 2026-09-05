# Google OAuth 2.0 Production & Custom Domain Setup Guide

This guide details how to configure Google OAuth 2.0 when deploying **RescueShip** with a custom domain (e.g. `https://yourdomain.com`).

---

## 1. Google Cloud Console / Google Auth Platform Configuration

### Step A: Update Authorized Domains in Branding / OAuth Consent Screen
1. Go to the [Google Cloud Console](https://console.cloud.google.com/) > **APIs & Services** > **OAuth consent screen** (or **Google Auth Platform** > **Branding**).
2. Under **Authorized domains**, click **+ Add Domain**.
3. Enter your top-level domain without protocols or trailing slashes:
   - Example: `yourdomain.com`
4. Update the **App home page**, **Privacy Policy link**, and **Terms of Service link** with your live domain URLs:
   - Home page: `https://yourdomain.com`
   - Privacy policy: `https://yourdomain.com/privacy`
   - Terms of service: `https://yourdomain.com/terms`
5. Click **Save and Continue**.

---

### Step B: Configure OAuth Client ID (Authorized Origins & Redirect URIs)
1. Go to **Google Auth Platform** > **Clients** (or **APIs & Services** > **Credentials**).
2. Click your Web Application OAuth Client ID to edit it.
3. Under **Authorized JavaScript origins**, add:
   - `https://yourdomain.com`
   - `https://api.yourdomain.com` *(if backend is hosted on a separate subdomain)*
   - `http://localhost:5173` *(keep this if you want local development to still work)*
4. Under **Authorized redirect URIs**, add:
   - `https://yourdomain.com`
   - `https://yourdomain.com/login`
   - `https://yourdomain.com/register`
   - `https://api.yourdomain.com/api/auth/google` *(if using redirect-based OAuth)*
   - `http://localhost:5173`
   - `http://localhost:5173/login`
5. Click **Save**.

---

### Step C: Publishing Status (Switching from Testing to Production)
While in **Testing** mode, only designated test users can log in.

1. Go to **OAuth consent screen** (or **Audience** in Google Auth Platform).
2. Under **Publishing status**, click **PUBLISH APP**.
3. Confirm the prompt to push the app to **Production**.
4. *(Note: Because RescueShip only requests basic profile/email scopes `openid`, `.../userinfo.email`, and `.../userinfo.profile`, Google verification is usually instant and does not require complex app reviews).*

---

## 2. Environment Variables Configuration

When deploying RescueShip, update the environment variables on your hosting servers:

### Backend `.env` (Production)
```env
NODE_ENV=production
PORT=3000
API_BASE_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Google OAuth Credentials
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
```

### Frontend `.env.production` or Hosting Environment Variables (Vercel / Netlify / VPS)
```env
VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
```

---

## 3. Checklist Before Going Live

- [ ] Domain has an active SSL certificate (`https://`). Google OAuth rejects plain `http://` for production domains.
- [ ] Both Backend and Frontend environment variables have the exact same `GOOGLE_CLIENT_ID`.
- [ ] OAuth Consent Screen is published to **In production**.
- [ ] Production frontend domain is listed under **Authorized JavaScript origins**.
- [ ] Privacy Policy and Terms of Service pages are live at the URLs specified in Google Cloud Console.
