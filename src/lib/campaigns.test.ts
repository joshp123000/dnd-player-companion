import { describe, expect, it } from 'vitest'
import { canDeleteCampaign, charactersForCampaign, cleanCampaignName } from './campaigns'

const characters = [
  { id: 'one', campaign_id: 'campaign-a' },
  { id: 'two', campaign_id: 'campaign-b' },
  { id: 'three', campaign_id: 'campaign-a' },
]

describe('campaign helpers', () => {
  it('filters characters into the active campaign', () => {
    expect(charactersForCampaign(characters, 'campaign-a').map((character) => character.id)).toEqual(['one', 'three'])
  })

  it('only allows empty campaigns to be deleted', () => {
    expect(canDeleteCampaign(characters, 'campaign-a')).toBe(false)
    expect(canDeleteCampaign(characters, 'campaign-c')).toBe(true)
  })

  it('normalizes extra spacing in campaign names', () => {
    expect(cleanCampaignName('  Spelljammer   Fridays  ')).toBe('Spelljammer Fridays')
  })
})
