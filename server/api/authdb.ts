
export type AuthRequest = {
  traceId?: string;
  revoke?: RevokeRequest
  checkRevoke?: CheckRevokeRequest
  quota?: QuotaRequest
}

type RevokeRequest = {
  token: string;
  ttl?: number;
  expiresAt?: number;
}

type CheckRevokeRequest = {
  token: string;
}

type QuotaRequest = {
  token: string;
  ttl?: number;
  expiresAt?: number;
  maxQuota?: number;
  dryRun?: boolean;
  reset?: boolean;
}


type RequestParams = {
  revoke: RevokeRequest
  checkRevoke: CheckRevokeRequest
  use: {
    token: string;
    ttl?: number;
    expiresAt?: number;
    maxQuota: number;
  }
  usage: {
    token: string;
  },
  resetQuota: {
    token: string;
    maxQuota?: number;
  }
}

export function newAuthRequest<K extends keyof RequestParams>(kind: K, params: RequestParams[K], traceId?: string): AuthRequest {
  switch (kind) {
    case 'revoke':
      return {
        traceId,
        revoke: { ...params },
      }
    case 'checkRevoke':
      return {
        traceId,
        checkRevoke: { ...params },
      }
    case 'use':
      return {
        traceId,
        quota: { ...params },

      }
    case 'usage':
      return {
        traceId,
        quota: { ...params, dryRun: true },
      }
    case 'resetQuota':
      return {
        traceId,
        quota: { ...params, reset: true },
      }
    default:
      throw new Error(`Unknown request kind: ${kind}`);
  }
}

if (!globalThis.crypto) {
  import('crypto').then((crypto) => {
    //@ts-ignore
    globalThis.crypto = crypto.webcrypto;
  });
}


export async function encryptRequest(request: AuthRequest, encKey: Uint8Array): Promise<Uint8Array> {
  let requestJSON = JSON.stringify(request);
  if (requestJSON.length % 16 !== 0) {
    requestJSON += ' '.repeat(16 - (requestJSON.length % 16));
  }

  // enc requestJSON with AES-GCM
  const nonce = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const encrypted = await globalThis.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
    },
    key,
    new TextEncoder().encode(requestJSON)
  );
  const encryptedArray = new Uint8Array(encrypted);
  const result = new Uint8Array(nonce.length + encryptedArray.length);
  result.set(nonce);
  result.set(encryptedArray, nonce.length);
  return result;
}

export async function sendAuthRequest(
  request: AuthRequest,
  encKey: Uint8Array,
  url: string,
): Promise<any> {
  const encryptedRequest = await encryptRequest(request, encKey);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: encryptedRequest,
  });
  if (!response.ok) {
    throw new Error(`Failed to send auth request: ${response.statusText}`);
  }
  return response.json();
}

export async function makeKey(key: string): Promise<Uint8Array> {

  // test if key is a valid hex string
  if (key.length == 64 && /^[0-9a-fA-F]+$/.test(key)) {
    const buf = new Uint8Array(key.length / 2);
    for (let i = 0; i < key.length; i += 2) {
      buf[i / 2] = parseInt(key.slice(i, i + 2), 16);
    }
    return buf;
  }
  const keyBuffer = new TextEncoder().encode(key);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', keyBuffer);
  return new Uint8Array(hashBuffer);
}

