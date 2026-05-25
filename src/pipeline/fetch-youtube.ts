export async function fetchYouTube(url: string, videoId?: string): Promise<string | null> {
  try {
    const apiKey = process.env.SUPADATA_API_KEY;
    if (!apiKey) throw new Error('Missing SUPADATA_API_KEY');
    const res = await fetch(`https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(url)}`, {
      headers: { 'x-api-key': apiKey },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.segments && Array.isArray(data.segments)) {
      return data.segments.map((s: any) => s.text).join(' ');
    }
    if (data.transcript) return data.transcript;
    return null;
  } catch {
    return null;
  }
}
