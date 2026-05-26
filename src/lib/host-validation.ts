import { isIP } from 'net';
import { lookup } from 'dns/promises';

export async function isPublicHost(host: string): Promise<boolean> {
  if (!host || host === 'localhost' || host.endsWith('.internal')) {
    return false;
  }

  const ipVer = isIP(host);
  if (ipVer === 4) {
    const parts = host.split('.').map(Number);
    if (parts[0] === 127) return false;
    if (parts[0] === 10) return false;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
    if (parts[0] === 192 && parts[1] === 168) return false;
    if (parts[0] === 169 && parts[1] === 254) return false;
    return true;
  }

  if (ipVer === 6) {
    const lower = host.toLowerCase();
    if (lower === '::1') return false;
    if (lower.startsWith('fe80:')) return false;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return false;
    return true;
  }

  // Non-literal hostname: resolve and verify all addresses are public
  try {
    const addresses = await lookup(host, { all: true });
    for (const addr of addresses) {
      if (!(await isPublicHost(addr.address))) {
        return false;
      }
    }
    return addresses.length > 0;
  } catch {
    return false;
  }
}
