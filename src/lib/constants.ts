export const FEED_WEIGHTS = {
  recencySimilarity: 0.35,
  tagAffinity: 0.20,
  pinnedSimilarity: 0.25,
  recencyBoost: 0.10,
  stalenessPenalty: 0.10,
};

export const SUMMARY_MODES = [
  { slug: 'short', label: 'Short Summary' },
  { slug: 'five_points', label: 'Five Points' },
  { slug: 'eli5', label: "Explain Like I'm 5" },
  { slug: 'devils_advocate', label: "Devil's Advocate" },
] as const;

export const DEFAULT_SUMMARY_MODE = 'short';

export const PLATFORMS = ['youtube', 'x', 'instagram', 'reddit', 'producthunt', 'web'] as const;

export const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  x: 'X',
  instagram: 'Instagram',
  reddit: 'Reddit',
  producthunt: 'Product Hunt',
  web: 'Web',
};
