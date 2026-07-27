/** Device profiles inspired by Google Inspection Tool smartphone / desktop. */

export const DEVICES = {
  mobile: {
    id: 'mobile',
    label: 'Smartphone',
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    viewport: {
      width: 412,
      height: 915,
      deviceScaleFactor: 2.625,
      isMobile: true,
      hasTouch: true,
      isLandscape: false,
    },
  },
  desktop: {
    id: 'desktop',
    label: 'Desktop',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: {
      // Desktop breakpoint: 1025px and above
      width: 1025,
      height: 768,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      isLandscape: true,
    },
  },
};

export function resolveDevice(device = 'mobile') {
  const key = String(device).toLowerCase() === 'desktop' ? 'desktop' : 'mobile';
  return DEVICES[key];
}
