import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getLudoKingLaunchUrl, LUDO_KING_LINKS } from '../src/services/ludoKingService.js'

describe('Ludo King launch fallbacks', () => {
  it('uses verified platform store links for mobile user agents', () => {
    assert.equal(getLudoKingLaunchUrl('Mozilla/5.0 Android'), LUDO_KING_LINKS.android)
    assert.equal(getLudoKingLaunchUrl('Mozilla/5.0 iPhone'), LUDO_KING_LINKS.ios)
  })

  it('uses the official website for desktop and unknown browsers', () => {
    assert.equal(getLudoKingLaunchUrl('Mozilla/5.0 X11; Linux x86_64'), LUDO_KING_LINKS.website)
    assert.equal(getLudoKingLaunchUrl(''), LUDO_KING_LINKS.website)
  })
})
