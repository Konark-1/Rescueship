/**
 * scripts/get-gmail-token.js
 * Run locally with: node scripts/get-gmail-token.js
 * 
 * Generates an OAuth2 consent URL for konarkofficial@gmail.com with gmail.send scope.
 * Accepts the authorization code and exchanges it for a permanent GMAIL_REFRESH_TOKEN.
 */

const { OAuth2Client } = require('google-auth-library');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Read credentials from wa/CREDENTIALS.md or local .env
let clientId = process.env.GOOGLE_CLIENT_ID;
let clientSecret = process.env.GOOGLE_CLIENT_SECRET;

const credsPath = path.resolve(__dirname, '../../CREDENTIALS.md');
if (fs.existsSync(credsPath)) {
  const content = fs.readFileSync(credsPath, 'utf8');
  const idMatch = content.match(/Client ID:\s*`([^`]+)`/);
  const secretMatch = content.match(/Client Secret:\s*`([^`]+)`/);
  if (idMatch) clientId = idMatch[1].trim();
  if (secretMatch) clientSecret = secretMatch[1].trim();
}

if (!clientId || !clientSecret) {
  console.error('❌ Could not find GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.');
  process.exit(1);
}

// Use standard loopback redirect URI for modern Google OAuth desktop apps
const REDIRECT_URI = 'http://localhost:5173';
const oauth2Client = new OAuth2Client(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
});

console.log('\n================================================================');
console.log('🚀  RescueShip Gmail API Token Generator');
console.log('================================================================\n');
console.log('1. Open this URL in your web browser:');
console.log('\n' + authUrl + '\n');
console.log('2. Sign in with: konarkofficial@gmail.com');
console.log('3. Click "Continue" / "Allow" to grant Gmail send permission');
console.log('4. You will be redirected to http://localhost:5173/?code=... (or similar)');
console.log('   Copy the "code=" parameter value from your browser address bar');
console.log('----------------------------------------------------------------\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Paste the code here: ', async (code) => {
  rl.close();
  const trimmed = code.trim();
  if (!trimmed) {
    console.error('❌ No code entered.');
    process.exit(1);
  }

  try {
    const { tokens } = await oauth2Client.getToken(trimmed);
    console.log('\n================================================================');
    console.log('🎉  SUCCESS! Your Gmail API Tokens:');
    console.log('================================================================\n');
    console.log('GMAIL_REFRESH_TOKEN=' + tokens.refresh_token);
    console.log('\n----------------------------------------------------------------\n');
  } catch (err) {
    console.error('\n❌ Failed to exchange code for token:', err.message);
  }
});
