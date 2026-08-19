import { OAuth2Client } from 'google-auth-library';

const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;

export type GoogleUserInfo = {
  googleId: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
  profilePhoto?: string;
};

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleUserInfo> {
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID not configured');
  }

  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({ idToken, audience: clientId });
  const payload = ticket.getPayload();

  if (!payload?.email || !payload.sub) {
    throw new Error('Invalid Google token payload');
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: Boolean(payload.email_verified),
    fullName: payload.name || payload.email.split('@')[0],
    profilePhoto: payload.picture,
  };
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(clientId);
}
