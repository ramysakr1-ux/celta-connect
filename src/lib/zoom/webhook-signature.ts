import { createHmac, timingSafeEqual } from "crypto";

// Zoom's webhook verification: HMAC-SHA256 over "v0:{timestamp}:{rawBody}"
// using the app's Secret Token, hex-encoded and prefixed "v0=". Structurally
// the same shape as the Resend/Svix verifier (src/app/api/webhooks/resend/
// route.ts) -- different message-to-sign and header names, same
// timingSafeEqual comparison so a byte-length/timing side channel can't
// leak whether a partial guess was close.
// https://developers.zoom.us/docs/api/webhooks/#verify-webhook-events
export function verifyZoomSignature(secret: string, timestamp: string, rawBody: string, signatureHeader: string): boolean {
  const message = `v0:${timestamp}:${rawBody}`;
  const expected = "v0=" + createHmac("sha256", secret).update(message).digest("hex");
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  return expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
}

// The very first request Zoom ever sends to a newly-configured webhook URL
// is this handshake, not a real event -- it must be answered with the
// plainToken it sent back, plus that same token HMAC'd with the Secret
// Token, or Zoom refuses to activate the subscription. Every request after
// that is a normal signed event, verified with verifyZoomSignature above.
export function buildUrlValidationResponse(secret: string, plainToken: string): { plainToken: string; encryptedToken: string } {
  return { plainToken, encryptedToken: createHmac("sha256", secret).update(plainToken).digest("hex") };
}
