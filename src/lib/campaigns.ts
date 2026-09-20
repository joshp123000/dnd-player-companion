import type { Character } from '../types'

export const charactersForCampaign = <T extends Pick<Character, 'campaign_id'>>(
  characters: T[],
  campaignId: string,
) => characters.filter((character) => character.campaign_id === campaignId)

export const canDeleteCampaign = (
  characters: Array<Pick<Character, 'campaign_id'>>,
  campaignId: string,
) => !characters.some((character) => character.campaign_id === campaignId)

export const cleanCampaignName = (name: string) => name.trim().replace(/\s+/g, ' ')
