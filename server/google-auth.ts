import { OAuth2Client } from 'google-auth-library';

export type GoogleIdentity = {
  sub: string;
  email: string;
  email_verified: boolean;
  nonce?: string;
  name?: string;
  hd?: string;
};

export type GoogleCredentialVerifier = (credential: string, audience: string) => Promise<GoogleIdentity>;

// Google's maintained verifier checks the signature, issuer, audience, and expiry.
// Only the resulting identity claims are retained; ID tokens are never persisted.
export function createGoogleCredentialVerifier(): GoogleCredentialVerifier {
  const client = new OAuth2Client();
  return async (credential, audience) => {
    const ticket = await client.verifyIdToken({ idToken: credential, audience });
    const payload = ticket.getPayload();
    if (!payload) throw new Error('Missing Google identity');
    const claims = payload as typeof payload & { nonce?: string };
    return {
      sub: claims.sub,
      email: claims.email || '',
      email_verified: claims.email_verified === true,
      nonce: claims.nonce,
      name: claims.name,
      hd: claims.hd,
    };
  };
}
