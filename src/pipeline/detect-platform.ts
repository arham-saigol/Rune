export interface PlatformResult {
  platform: 'youtube' | 'x' | 'instagram' | 'reddit' | 'producthunt' | 'web';
  contentType: 'video' | 'article' | 'tweet' | 'thread' | 'post' | 'audio';
  videoId?: string;
}

const PLATFORM_PATTERNS: [RegExp, PlatformResult['platform'], PlatformResult['contentType']][] = [
  [/(?:youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts)/, 'youtube', 'video'],
  [/(?:x\.com|twitter\.com)\/\w+\/status/, 'x', 'tweet'],
  [/instagram\.com\/(?:p|reel)\//, 'instagram', 'post'],
  [/reddit\.com\/r\/\w+\/comments/, 'reddit', 'thread'],
  [/producthunt\.com\/posts\//, 'producthunt', 'post'],
];

export function detectPlatform(url: string): PlatformResult {
  for (const [regex, platform, contentType] of PLATFORM_PATTERNS) {
    if (regex.test(url)) {
      const result: PlatformResult = { platform, contentType };
      if (platform === 'youtube') {
        const match = url.match(/(?:v=|\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
        if (match) result.videoId = match[1];
      }
      return result;
    }
  }
  return { platform: 'web', contentType: 'article' };
}
