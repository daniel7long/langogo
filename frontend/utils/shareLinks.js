// Web share links. These need no API keys: each network opens its own "share" page with the
// text / link filled in. Instagram has no such link (see utils/share.js).
const enc = encodeURIComponent;

export const SHARE_TARGETS = [
  { id: 'facebook', label: 'Facebook', icon: 'logo-facebook', color: '#1877F2' },
  { id: 'instagram', label: 'Instagram', icon: 'logo-instagram', color: '#C13584' },
  { id: 'linkedin', label: 'LinkedIn', icon: 'logo-linkedin', color: '#0A66C2' },
  { id: 'x', label: 'X', icon: 'logo-twitter', color: '#000000' },
];

// payload: { text, url, hashtags } from GET /share/{record}/payload. Returns null for Instagram.
export function intentUrl(target, { text, url, hashtags = [] }) {
  switch (target) {
    case 'x':
      return `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}` +
        (hashtags.length ? `&hashtags=${enc(hashtags.join(','))}` : '');
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`;
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`;
    default:
      return null;
  }
}
