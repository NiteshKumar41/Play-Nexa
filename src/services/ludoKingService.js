export const LUDO_KING_LINKS = Object.freeze({
  website: 'https://ludoking.com/',
  android: 'https://play.google.com/store/apps/details?id=com.ludo.king',
  ios: 'https://apps.apple.com/in/app/ludo-king/id993090598',
})

export function getLudoKingLaunchUrl(userAgent = '') {
  const agent = userAgent || (typeof navigator === 'undefined' ? '' : navigator.userAgent)

  if (/android/i.test(agent)) return LUDO_KING_LINKS.android
  if (/iphone|ipad|ipod/i.test(agent)) return LUDO_KING_LINKS.ios
  return LUDO_KING_LINKS.website
}
