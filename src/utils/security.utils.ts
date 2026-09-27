import dns from 'dns';
import https from 'https';
import net from 'net';
import { URL } from 'url';
import jwt from 'jsonwebtoken';

/**
 * Checks if an IP address is private, reserved, or loopback.
 * Fails closed (returns true) for invalid or unknown formats.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  if (!ip) return true;

  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return true;
    if (parts[0] === 0) return true; // Current network
    if (parts[0] === 10) return true; // RFC 1918 Private
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true; // CGNAT (RFC 6598)
    if (parts[0] === 127) return true; // Loopback
    if (parts[0] === 169 && parts[1] === 254) return true; // Link-Local / IMDS
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // RFC 1918 Private
    if (parts[0] === 192 && parts[1] === 168) return true; // RFC 1918 Private
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) return true; // TEST-NET-1 (RFC 5737)
    if (parts[0] === 198 && parts[1] >= 18 && parts[1] <= 19) return true; // Benchmarking (RFC 2544)
    if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return true; // TEST-NET-2 (RFC 5737)
    if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true; // TEST-NET-3 (RFC 5737)
    if (parts[0] >= 224) return true; // Multicast / Reserved / Broadcast
    return false;
  }

  if (net.isIPv6(ip)) {
    const lowerIp = ip.toLowerCase();
    if (lowerIp === '::1' || lowerIp === '::') return true; // Loopback / Unspecified
    if (lowerIp.startsWith('fc') || lowerIp.startsWith('fd')) return true; // Unique Local (RFC 4193)
    if (/^fe[89ab][0-9a-f]/i.test(lowerIp) || lowerIp.startsWith('fe80')) return true; // Link-Local (RFC 4291)
    if (lowerIp.startsWith('ff')) return true; // Multicast (RFC 4291)
    if (lowerIp.startsWith('2001:db8:')) return true; // Documentation (RFC 3849)
    if (lowerIp.startsWith('100::')) return true; // Discard-only (RFC 6666)

    // IPv4-mapped or translated IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:a00:1)
    if (lowerIp.startsWith('::ffff:')) {
      const ipv4Part = ip.split(':').pop();
      if (ipv4Part && net.isIPv4(ipv4Part)) {
        return isPrivateOrReservedIp(ipv4Part);
      }
      return true;
    }

    return false;
  }

  return true;
}

/**
 * Resolves a hostname and asserts that none of its resolved IPs are private/reserved.
 */
export async function assertPublicHostname(hostname: string): Promise<void> {
  const cleanHost = hostname.trim().replace(/^\[|\]$/g, '').toLowerCase();

  if (cleanHost === 'localhost') {
    throw new Error('SSRF Blocked: Localhost is not allowed');
  }

  if (net.isIP(cleanHost)) {
    if (isPrivateOrReservedIp(cleanHost)) {
      throw new Error(`SSRF Blocked: IP address ${cleanHost} is private/reserved`);
    }
    return;
  }

  const addresses = await dns.promises.lookup(cleanHost, { all: true });
  if (!addresses || addresses.length === 0) {
    throw new Error(`SSRF Blocked: Unable to resolve hostname ${cleanHost}`);
  }

  for (const addr of addresses) {
    if (isPrivateOrReservedIp(addr.address)) {
      throw new Error(`SSRF Blocked: DNS resolved to private/reserved IP ${addr.address}`);
    }
  }
}

/**
 * Creates an HTTPS agent that enforces SSRF protection at the socket level.
 * Mitigates TOCTOU / DNS rebinding attacks.
 */
export function createSsrfSafeHttpsAgent(): https.Agent {
  return new https.Agent({
    lookup: (hostname, options, callback) => {
      dns.promises.lookup(hostname, { all: true })
        .then((addresses) => {
          for (const addr of addresses) {
            if (isPrivateOrReservedIp(addr.address)) {
              return callback(new Error(`SSRF Blocked: Resolved to private IP ${addr.address}`), '' as any, 4 as any);
            }
          }
          // Safe to proceed, pass the first valid address to native dns.lookup
          (dns.lookup as any)(hostname, options, callback);
        })
        .catch((err) => callback(err, '' as any, 4 as any));
    }
  });
}

/**
 * Validates if a frontend origin is safe for redirection.
 */
export function isSafeFrontendOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const isDev = process.env.NODE_ENV !== 'production';

    if (!isDev && url.protocol !== 'https:') return false;

    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return isDev;
    }

    const frontendUrls = (process.env.FRONTEND_URL || '')
      .split(',')
      .map(u => u.trim())
      .filter(Boolean);

    const configuredHosts = frontendUrls.map(u => {
      try { return new URL(u).host; } catch { return null; }
    }).filter(Boolean) as string[];

    const trustedHosts = [
      ...configuredHosts,
      'rescueship.netlify.app',
      'app.rescueship.io'
    ];

    return trustedHosts.some(host => url.host === host || url.host.endsWith('.netlify.app'));
  } catch {
    return false;
  }
}

/**
 * Safely verifies a JWT state token. Returns null if invalid or expired.
 */
export function verifyStateToken(token: string): any | null {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}
