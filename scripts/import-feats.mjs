import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const OUTPUT_URL = new URL('../src/data/feats.json', import.meta.url)
const MIGRATION_URL = new URL('../supabase/migrations/202609200005_phb_feats.sql', import.meta.url)

const CATEGORY = {
  origin: { label: 'Origin Feat', level: null, prerequisite: 'None' },
  general: { label: 'General Feat', level: 4, prerequisite: 'Level 4+' },
  fighting: { label: 'Fighting Style Feat', level: null, prerequisite: 'Fighting Style feature' },
  epic: { label: 'Epic Boon Feat', level: 19, prerequisite: 'Level 19+' },
}

const slugify = (value) => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[’']/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')

const feat = ({
  name,
  type,
  summary,
  description,
  prerequisite,
  repeatable = false,
  actionType = null,
  uses = null,
  recharge = null,
}) => ({
  name,
  type,
  summary,
  description,
  prerequisite,
  repeatable,
  actionType,
  uses,
  recharge,
})

const FEATS = [
  feat({
    name: 'Alert',
    type: 'origin',
    summary: 'Add your Proficiency Bonus to Initiative and trade Initiative results with an ally.',
    description: `- **Initiative Proficiency.** Add your Proficiency Bonus whenever you roll Initiative.\n- **Initiative Swap.** Immediately after rolling Initiative, you may exchange your result with a willing ally in the same combat. Neither participant can be Incapacitated.`,
  }),
  feat({
    name: 'Crafter',
    type: 'origin',
    summary: 'Gain three artisan-tool proficiencies, shop at a discount, and quickly craft temporary gear.',
    description: `- **Tool Training.** Gain proficiency with three different kinds of Artisan’s Tools.\n- **Discount.** Pay 20 percent less when buying nonmagical items.\n- **Fast Crafting.** After a Long Rest, use a proficient tool to make one eligible piece of adventuring gear. It lasts until your next Long Rest. Eligible examples include rope, nets, torches, caltrops, cases, pouches, tents, basic clubs, and similar tool-made gear.`,
    recharge: 'Long Rest',
  }),
  feat({
    name: 'Healer',
    type: 'origin',
    summary: 'Use a Healer’s Kit to restore Hit Points and reroll 1s on your healing dice.',
    description: `- **Battle Medic.** As a Utilize action, expend one use of a Healer’s Kit on a creature within 5 feet. The creature spends a Hit Die; you roll it, and the creature regains that result plus your Proficiency Bonus in Hit Points.\n- **Healing Rerolls.** When a die you roll for a spell or Battle Medic restores Hit Points and shows a 1, reroll it and use the new result.`,
    actionType: 'Utilize Action',
  }),
  feat({
    name: 'Lucky',
    type: 'origin',
    summary: 'Spend Luck Points to gain Advantage on your D20 Tests or hinder attacks against you.',
    description: `You have Luck Points equal to your Proficiency Bonus and regain all of them after a Long Rest. Spend one point to give yourself Advantage on a D20 Test, or to impose Disadvantage on an attack roll made against you. You can spend only one point on a roll.`,
    uses: 'Proficiency Bonus Luck Points',
    recharge: 'Long Rest',
  }),
  feat({
    name: 'Magic Initiate',
    type: 'origin',
    summary: 'Learn two cantrips and one level 1 spell from the Cleric, Druid, or Wizard list.',
    description: `Choose the Cleric, Druid, or Wizard spell list. Learn two cantrips and prepare one level 1 spell from it. Choose Intelligence, Wisdom, or Charisma as the spellcasting ability. You may cast the level 1 spell once without a slot per Long Rest and may also use your spell slots. When you gain a level, you may replace one chosen spell with another eligible spell from the same list.`,
    repeatable: true,
    uses: '1 free level 1 casting',
    recharge: 'Long Rest',
  }),
  feat({
    name: 'Musician',
    type: 'origin',
    summary: 'Learn three instruments and grant Heroic Inspiration after rests.',
    description: `- **Instrument Training.** Gain proficiency with three Musical Instruments.\n- **Encouraging Song.** At the end of a Short or Long Rest, give Heroic Inspiration to a number of allies equal to your Proficiency Bonus.`,
    uses: 'Proficiency Bonus allies',
    recharge: 'Short or Long Rest',
  }),
  feat({
    name: 'Savage Attacker',
    type: 'origin',
    summary: 'Once per turn, roll a weapon’s damage dice twice and use either result.',
    description: `Once on each of your turns when you hit with a weapon, roll the weapon’s damage dice twice and use either roll against the target.`,
    uses: 'Once per turn',
  }),
  feat({
    name: 'Skilled',
    type: 'origin',
    summary: 'Gain proficiency in any combination of three skills or tools.',
    description: `Choose three skills, tools, or any combination of the two. You gain proficiency with those choices.`,
    repeatable: true,
  }),
  feat({
    name: 'Tavern Brawler',
    type: 'origin',
    summary: 'Improve Unarmed Strikes, master improvised weapons, and push foes you punch.',
    description: `- **Enhanced Unarmed Strike.** Your Unarmed Strike can deal 1d4 plus your Strength modifier in Bludgeoning damage, and you may reroll a damage die result of 1.\n- **Improvised Weaponry.** You are proficient with improvised weapons.\n- **Push.** Once per turn when your Unarmed Strike hits and deals damage, push the target 5 feet away if it is no more than one size larger than you.`,
    uses: 'Push once per turn',
  }),
  feat({
    name: 'Tough',
    type: 'origin',
    summary: 'Increase your Hit Point maximum by twice your character level.',
    description: `Your Hit Point maximum increases by twice your character level when you gain this feat. Each time you gain another level, your maximum increases by 2 more Hit Points.`,
  }),

  feat({
    name: 'Ability Score Improvement',
    type: 'general',
    summary: 'Raise one ability by 2 or two abilities by 1, to a maximum of 20.',
    description: `Increase one ability score by 2, or increase two ability scores by 1 each. This feat cannot raise an ability score above 20.`,
    repeatable: true,
  }),
  feat({
    name: 'Actor',
    type: 'general',
    prerequisite: 'Level 4+; Charisma 13+',
    summary: 'Increase Charisma and excel at disguises, impersonation, and mimicry.',
    description: `Increase Charisma by 1, to a maximum of 20. While disguised as a real or fictional person, you have Advantage on Deception or Performance checks made to pass as that person. You can mimic speech and other creature sounds; a listener detects the imitation with a successful Wisdom (Insight) check against DC 8 + your Charisma modifier + your Proficiency Bonus.`,
  }),
  feat({
    name: 'Athlete',
    type: 'general',
    prerequisite: 'Level 4+; Strength or Dexterity 13+',
    summary: 'Increase Strength or Dexterity and improve climbing, standing, and running jumps.',
    description: `Increase Strength or Dexterity by 1, to a maximum of 20. You gain a Climb Speed equal to your Speed, can stand from Prone by spending only 5 feet of movement, and need only a 5-foot run-up for running jumps.`,
  }),
  feat({
    name: 'Charger',
    type: 'general',
    prerequisite: 'Level 4+; Strength or Dexterity 13+',
    summary: 'Increase Strength or Dexterity, Dash faster, and empower an attack after a straight-line charge.',
    description: `Increase Strength or Dexterity by 1, to a maximum of 20. Your Speed increases by 10 feet while taking the Dash action. Once per turn, after moving at least 10 feet in a straight line toward a target immediately before hitting it with a melee attack, either add 1d8 to the attack’s damage or push the target up to 10 feet if it is no more than one size larger than you.`,
    uses: 'Once per turn',
  }),
  feat({
    name: 'Chef',
    type: 'general',
    summary: 'Increase Constitution or Wisdom and prepare restorative meals and bolstering treats.',
    description: `Increase Constitution or Wisdom by 1, to a maximum of 20, and gain Cook’s Utensils proficiency. During a Short Rest, feed up to 4 + your Proficiency Bonus creatures; anyone who spends a Hit Die regains an extra 1d8 Hit Points. With 1 hour of work or after a Long Rest, make treats equal to your Proficiency Bonus. For 8 hours, a creature may eat one as a Bonus Action to gain Temporary Hit Points equal to your Proficiency Bonus.`,
    recharge: 'Long Rest or 1 hour',
  }),
  feat({
    name: 'Crossbow Expert',
    type: 'general',
    prerequisite: 'Level 4+; Dexterity 13+',
    summary: 'Increase Dexterity and use crossbows quickly and effectively at close range.',
    description: `Increase Dexterity by 1, to a maximum of 20. Ignore the Loading property of crossbows, and attacks with crossbows do not have Disadvantage merely because an enemy is within 5 feet. When the Light property gives you an extra attack with a Light crossbow, add your ability modifier to that attack’s damage if it is not already added.`,
  }),
  feat({
    name: 'Crusher',
    type: 'general',
    summary: 'Increase Strength or Constitution and control creatures with Bludgeoning damage.',
    description: `Increase Strength or Constitution by 1, to a maximum of 20. Once per turn after dealing Bludgeoning damage, move the target 5 feet to an unoccupied space if it is no more than one size larger than you. After you score a Critical Hit that deals Bludgeoning damage, attack rolls against that target have Advantage until the start of your next turn.`,
    uses: 'Move once per turn',
  }),
  feat({
    name: 'Defensive Duelist',
    type: 'general',
    prerequisite: 'Level 4+; Dexterity 13+',
    summary: 'Increase Dexterity and parry melee attacks with a Finesse weapon.',
    description: `Increase Dexterity by 1, to a maximum of 20. While holding a Finesse weapon, use your Reaction when a melee attack hits you to add your Proficiency Bonus to AC, potentially turning it into a miss. The AC bonus applies against melee attacks until the start of your next turn.`,
    actionType: 'Reaction',
  }),
  feat({
    name: 'Dual Wielder',
    type: 'general',
    prerequisite: 'Level 4+; Strength or Dexterity 13+',
    summary: 'Increase Strength or Dexterity and fight with a broader pair of one-handed weapons.',
    description: `Increase Strength or Dexterity by 1, to a maximum of 20. After attacking with a Light weapon during your Attack action, you may make one Bonus Action attack with a different melee weapon that lacks the Two-Handed property; do not add your ability modifier to its damage unless it is negative. You may also draw or stow two non-Two-Handed weapons whenever you could normally draw or stow one.`,
    actionType: 'Bonus Action',
  }),
  feat({
    name: 'Durable',
    type: 'general',
    summary: 'Increase Constitution, gain Advantage on Death Saves, and spend a Hit Die in combat.',
    description: `Increase Constitution by 1, to a maximum of 20. You have Advantage on Death Saving Throws. As a Bonus Action, spend and roll one Hit Die to regain Hit Points equal to the roll.`,
    actionType: 'Bonus Action',
  }),
  feat({
    name: 'Elemental Adept',
    type: 'general',
    prerequisite: 'Level 4+; Spellcasting or Pact Magic feature',
    summary: 'Increase a spellcasting ability and specialize in one elemental damage type.',
    description: `Increase Intelligence, Wisdom, or Charisma by 1, to a maximum of 20. Choose Acid, Cold, Fire, Lightning, or Thunder. Your spells ignore Resistance to the chosen damage type, and when you roll that type of spell damage, treat each damage-die result of 1 as a 2.`,
    repeatable: true,
  }),
  feat({
    name: 'Fey-Touched',
    type: 'general',
    summary: 'Increase a mental ability and learn Misty Step plus a level 1 Divination or Enchantment spell.',
    description: `Increase Intelligence, Wisdom, or Charisma by 1, to a maximum of 20. You always have Misty Step and one chosen level 1 Divination or Enchantment spell prepared. Cast each once without a spell slot per Long Rest, or cast them with available spell slots. The increased ability is their spellcasting ability.`,
    uses: '1 free casting of each spell',
    recharge: 'Long Rest',
  }),
  feat({
    name: 'Grappler',
    type: 'general',
    prerequisite: 'Level 4+; Strength or Dexterity 13+',
    summary: 'Increase Strength or Dexterity and become more dangerous while grappling.',
    description: `Increase Strength or Dexterity by 1, to a maximum of 20. Once per turn when an Unarmed Strike made as part of the Attack action hits, you may both deal damage and attempt to grapple. You have Advantage on attacks against creatures you are grappling, and moving a grappled creature your size or smaller does not cost extra movement.`,
    uses: 'Punch and grab once per turn',
  }),
  feat({
    name: 'Great Weapon Master',
    type: 'general',
    prerequisite: 'Level 4+; Strength 13+',
    summary: 'Increase Strength and deal extra damage or follow decisive melee blows with another attack.',
    description: `Increase Strength by 1, to a maximum of 20. When an Attack-action hit uses a Heavy weapon, add your Proficiency Bonus to its damage. Immediately after a melee weapon scores a Critical Hit or reduces a creature to 0 Hit Points, you may make one attack with that weapon as a Bonus Action.`,
    actionType: 'Bonus Action',
  }),
  feat({
    name: 'Heavily Armored',
    type: 'general',
    prerequisite: 'Level 4+; Medium armor training',
    summary: 'Increase Strength or Constitution and gain Heavy armor training.',
    description: `Increase Strength or Constitution by 1, to a maximum of 20. You gain training with Heavy armor.`,
  }),
  feat({
    name: 'Heavy Armor Master',
    type: 'general',
    prerequisite: 'Level 4+; Heavy armor training',
    summary: 'Increase Strength or Constitution and reduce physical damage while wearing Heavy armor.',
    description: `Increase Strength or Constitution by 1, to a maximum of 20. While wearing Heavy armor, reduce incoming Bludgeoning, Piercing, and Slashing damage by your Proficiency Bonus.`,
  }),
  feat({
    name: 'Inspiring Leader',
    type: 'general',
    prerequisite: 'Level 4+; Wisdom or Charisma 13+',
    summary: 'Increase Wisdom or Charisma and grant allies Temporary Hit Points after rests.',
    description: `Increase Wisdom or Charisma by 1, to a maximum of 20. At the end of a Short or Long Rest, inspire up to six creatures within 30 feet that can see or hear you. Each gains Temporary Hit Points equal to your character level plus the modifier of the ability increased by this feat.`,
    recharge: 'Short or Long Rest',
  }),
  feat({
    name: 'Keen Mind',
    type: 'general',
    prerequisite: 'Level 4+; Intelligence 13+',
    summary: 'Increase Intelligence, improve a knowledge skill, and Study as a Bonus Action.',
    description: `Increase Intelligence by 1, to a maximum of 20. Choose Arcana, History, Investigation, Nature, or Religion: gain proficiency, or Expertise if already proficient. You may take the Study action as a Bonus Action.`,
    actionType: 'Bonus Action',
  }),
  feat({
    name: 'Lightly Armored',
    type: 'general',
    summary: 'Increase Strength or Dexterity and gain Light armor and Shield training.',
    description: `Increase Strength or Dexterity by 1, to a maximum of 20. You gain training with Light armor and Shields.`,
  }),
  feat({
    name: 'Mage Slayer',
    type: 'general',
    summary: 'Increase Strength or Dexterity, disrupt Concentration, and resist mental magic.',
    description: `Increase Strength or Dexterity by 1, to a maximum of 20. A creature you damage has Disadvantage on its saving throw to maintain Concentration. When you fail an Intelligence, Wisdom, or Charisma saving throw, you may turn it into a success once per Short or Long Rest.`,
    uses: 'Guarded Mind once per rest',
    recharge: 'Short or Long Rest',
  }),
  feat({
    name: 'Martial Weapon Training',
    type: 'general',
    summary: 'Increase Strength or Dexterity and gain proficiency with Martial weapons.',
    description: `Increase Strength or Dexterity by 1, to a maximum of 20. You gain proficiency with Martial weapons.`,
  }),
  feat({
    name: 'Medium Armor Master',
    type: 'general',
    prerequisite: 'Level 4+; Medium armor training',
    summary: 'Increase Strength or Dexterity and use more Dexterity while wearing Medium armor.',
    description: `Increase Strength or Dexterity by 1, to a maximum of 20. While wearing Medium armor, you may add up to +3 from Dexterity to AC instead of the normal +2 maximum.`,
  }),
  feat({
    name: 'Moderately Armored',
    type: 'general',
    prerequisite: 'Level 4+; Light armor training',
    summary: 'Increase Strength or Dexterity and gain Medium armor training.',
    description: `Increase Strength or Dexterity by 1, to a maximum of 20. You gain training with Medium armor.`,
  }),
  feat({
    name: 'Mounted Combatant',
    type: 'general',
    summary: 'Increase a physical or perceptive ability and protect and exploit your mount.',
    description: `Increase Strength, Dexterity, or Wisdom by 1, to a maximum of 20. While mounted, you have Advantage on attacks against unmounted creatures within 5 feet of your mount that are at least one size smaller. Your ridden mount takes no damage on a successful Dexterity save for half damage and half on a failure. You may redirect an attack that hits your mount to yourself while neither of you is Incapacitated.`,
  }),
  feat({
    name: 'Observant',
    type: 'general',
    prerequisite: 'Level 4+; Intelligence or Wisdom 13+',
    summary: 'Increase Intelligence or Wisdom, improve an awareness skill, and Search as a Bonus Action.',
    description: `Increase Intelligence or Wisdom by 1, to a maximum of 20. Choose Insight, Investigation, or Perception: gain proficiency, or Expertise if already proficient. You may take the Search action as a Bonus Action.`,
    actionType: 'Bonus Action',
  }),
  feat({
    name: 'Piercer',
    type: 'general',
    summary: 'Increase Strength or Dexterity and improve Piercing damage rolls and Critical Hits.',
    description: `Increase Strength or Dexterity by 1, to a maximum of 20. Once per turn after rolling Piercing damage, reroll one damage die and use the new result. A Critical Hit that deals Piercing damage rolls one additional weapon damage die.`,
    uses: 'Reroll once per turn',
  }),
  feat({
    name: 'Poisoner',
    type: 'general',
    summary: 'Increase Dexterity or Intelligence, bypass Poison Resistance, and brew combat poisons.',
    description: `Increase Dexterity or Intelligence by 1, to a maximum of 20. Your Poison damage ignores Resistance, and you gain Poisoner’s Kit proficiency. With 1 hour, the kit, and 50 GP of materials, brew doses equal to your Proficiency Bonus. Apply a dose to a weapon or ammunition as a Bonus Action; it lasts 1 minute or until it deals damage. The target makes a Constitution save against DC 8 + your Proficiency Bonus + the increased ability’s modifier, taking 2d8 Poison damage and becoming Poisoned until the end of your next turn on a failure.`,
    actionType: 'Bonus Action',
  }),
  feat({
    name: 'Polearm Master',
    type: 'general',
    prerequisite: 'Level 4+; Strength or Dexterity 13+',
    summary: 'Increase Strength or Dexterity and gain extra and reactive attacks with polearms.',
    description: `Increase Strength or Dexterity by 1, to a maximum of 20. After attacking with an eligible polearm during the Attack action, make a Bonus Action attack with its opposite end for 1d4 Bludgeoning damage. You may also use your Reaction to make a melee attack with the polearm when a creature enters its reach.`,
    actionType: 'Bonus Action or Reaction',
  }),
  feat({
    name: 'Resilient',
    type: 'general',
    summary: 'Increase one ability and gain proficiency in its saving throws.',
    description: `Choose an ability for which you lack saving throw proficiency. Increase it by 1, to a maximum of 20, and gain proficiency in saving throws using it.`,
  }),
  feat({
    name: 'Ritual Caster',
    type: 'general',
    prerequisite: 'Level 4+; Intelligence, Wisdom, or Charisma 13+',
    summary: 'Increase a mental ability, prepare level 1 Ritual spells, and cast one ritual quickly each day.',
    description: `Increase Intelligence, Wisdom, or Charisma by 1, to a maximum of 20. Choose level 1 Ritual spells equal to your Proficiency Bonus; they are always prepared and use the increased ability. Add another whenever your Proficiency Bonus rises. Once per Long Rest, cast one prepared Ritual without a slot using its normal casting time instead of the extended Ritual time.`,
    uses: '1 Quick Ritual',
    recharge: 'Long Rest',
  }),
  feat({
    name: 'Sentinel',
    type: 'general',
    prerequisite: 'Level 4+; Strength or Dexterity 13+',
    summary: 'Increase Strength or Dexterity and punish enemies who disengage or attack your allies.',
    description: `Increase Strength or Dexterity by 1, to a maximum of 20. Use your Reaction for a melee attack immediately after a creature within 5 feet takes the Disengage action or hits a target other than you. When your Opportunity Attack hits, the target’s Speed becomes 0 for the rest of the turn.`,
    actionType: 'Reaction',
  }),
  feat({
    name: 'Shadow-Touched',
    type: 'general',
    summary: 'Increase a mental ability and learn Invisibility plus a level 1 Illusion or Necromancy spell.',
    description: `Increase Intelligence, Wisdom, or Charisma by 1, to a maximum of 20. You always have Invisibility and one chosen level 1 Illusion or Necromancy spell prepared. Cast each once without a spell slot per Long Rest, or cast them with available spell slots. The increased ability is their spellcasting ability.`,
    uses: '1 free casting of each spell',
    recharge: 'Long Rest',
  }),
  feat({
    name: 'Sharpshooter',
    type: 'general',
    prerequisite: 'Level 4+; Dexterity 13+',
    summary: 'Increase Dexterity and negate common penalties on ranged weapon attacks.',
    description: `Increase Dexterity by 1, to a maximum of 20. Your ranged weapon attacks ignore Half and Three-Quarters Cover, do not have Disadvantage merely because an enemy is within 5 feet, and do not have Disadvantage at long range.`,
  }),
  feat({
    name: 'Shield Master',
    type: 'general',
    prerequisite: 'Level 4+; Shield training',
    summary: 'Increase Strength and use your Shield to shove foes or avoid area damage.',
    description: `Increase Strength by 1, to a maximum of 20. Once per turn after an Attack-action melee hit against a creature within 5 feet, bash it with your equipped Shield. It makes a Strength save against DC 8 + your Strength modifier + Proficiency Bonus; on a failure, push it 5 feet or knock it Prone. When an effect permits a Dexterity save for half damage, use your Reaction while holding a Shield to take no damage on a success.`,
    actionType: 'Reaction',
  }),
  feat({
    name: 'Skill Expert',
    type: 'general',
    summary: 'Increase any ability, learn one skill, and gain Expertise in another.',
    description: `Increase one ability by 1, to a maximum of 20. Gain proficiency in one skill, then choose one skill in which you are proficient and gain Expertise with it.`,
  }),
  feat({
    name: 'Skulker',
    type: 'general',
    prerequisite: 'Level 4+; Dexterity 13+',
    summary: 'Increase Dexterity and become harder to detect while fighting from concealment.',
    description: `Increase Dexterity by 1, to a maximum of 20. Gain Blindsight with a 10-foot range, have Advantage on Dexterity (Stealth) checks made as part of the Hide action during combat, and remain hidden when an attack roll misses.`,
  }),
  feat({
    name: 'Slasher',
    type: 'general',
    summary: 'Increase Strength or Dexterity and hinder creatures with Slashing damage.',
    description: `Increase Strength or Dexterity by 1, to a maximum of 20. Once per turn after dealing Slashing damage, reduce the target’s Speed by 10 feet until the start of your next turn. A Critical Hit that deals Slashing damage gives the target Disadvantage on attack rolls until the start of your next turn.`,
    uses: 'Speed reduction once per turn',
  }),
  feat({
    name: 'Speedy',
    type: 'general',
    prerequisite: 'Level 4+; Dexterity or Constitution 13+',
    summary: 'Increase Dexterity or Constitution, move faster, and evade difficult terrain and Opportunity Attacks.',
    description: `Increase Dexterity or Constitution by 1, to a maximum of 20. Your Speed increases by 10 feet. Difficult Terrain does not cost extra movement while you Dash, and Opportunity Attacks against you have Disadvantage.`,
  }),
  feat({
    name: 'Spell Sniper',
    type: 'general',
    prerequisite: 'Level 4+; Spellcasting or Pact Magic feature',
    summary: 'Increase a spellcasting ability and improve the reach and reliability of spell attacks.',
    description: `Increase Intelligence, Wisdom, or Charisma by 1, to a maximum of 20. Spell attack rolls ignore Half and Three-Quarters Cover, do not have Disadvantage merely because an enemy is within 5 feet, and gain 60 feet of range when the spell normally has a range of at least 10 feet.`,
  }),
  feat({
    name: 'Telekinetic',
    type: 'general',
    summary: 'Increase a mental ability, improve Mage Hand, and push or pull creatures at range.',
    description: `Increase Intelligence, Wisdom, or Charisma by 1, to a maximum of 20. You always have Mage Hand prepared; its hand is invisible, needs no Verbal or Somatic components, and its range increases by 30 feet if you already knew it. As a Bonus Action, force a creature within 30 feet to make a Strength save or move it 5 feet toward or away from you; a willing creature may fail automatically.`,
    actionType: 'Bonus Action',
  }),
  feat({
    name: 'Telepathic',
    type: 'general',
    summary: 'Increase a mental ability, communicate telepathically, and gain Detect Thoughts.',
    description: `Increase Intelligence, Wisdom, or Charisma by 1, to a maximum of 20. Speak telepathically to a creature you can see within 60 feet if it knows at least one language; this communication is one-way. You always have Detect Thoughts prepared and may cast it once without a spell slot per Long Rest or with your spell slots.`,
    uses: '1 free Detect Thoughts',
    recharge: 'Long Rest',
  }),
  feat({
    name: 'War Caster',
    type: 'general',
    prerequisite: 'Level 4+; Spellcasting or Pact Magic feature',
    summary: 'Increase a spellcasting ability and cast reliably while armed or under pressure.',
    description: `Increase Intelligence, Wisdom, or Charisma by 1, to a maximum of 20. You have Advantage on Constitution saves to maintain Concentration. When a creature provokes an Opportunity Attack by leaving your reach, use your Reaction to cast a one-action spell that targets only that creature. You may perform Somatic components while weapons or a Shield occupy either hand.`,
    actionType: 'Reaction',
  }),
  feat({
    name: 'Weapon Master',
    type: 'general',
    summary: 'Increase Strength or Dexterity and learn one weapon’s mastery property.',
    description: `Increase Strength or Dexterity by 1, to a maximum of 20. Choose one Simple or Martial weapon with which you are proficient; you may use its mastery property. You may change the chosen weapon after a Long Rest.`,
    recharge: 'Long Rest to change',
  }),

  feat({ name: 'Archery', type: 'fighting', summary: 'Gain a +2 bonus to attack rolls made with Ranged weapons.', description: `You gain a +2 bonus to attack rolls you make with Ranged weapons.` }),
  feat({ name: 'Blind Fighting', type: 'fighting', summary: 'Gain Blindsight within 10 feet.', description: `You have Blindsight with a range of 10 feet.` }),
  feat({ name: 'Defense', type: 'fighting', summary: 'Gain +1 AC while wearing armor.', description: `While wearing Light, Medium, or Heavy armor, you gain a +1 bonus to Armor Class.` }),
  feat({ name: 'Dueling', type: 'fighting', summary: 'Deal +2 damage while wielding one melee weapon in one hand.', description: `While holding a melee weapon in one hand and no other weapons, gain +2 to damage rolls with that weapon. A Shield does not prevent this benefit.` }),
  feat({ name: 'Great Weapon Fighting', type: 'fighting', summary: 'Treat 1s and 2s on two-handed weapon damage dice as 3s.', description: `When you roll damage for a melee weapon held in two hands, treat any 1 or 2 on the weapon’s damage dice as a 3. The weapon must have the Two-Handed or Versatile property to qualify.` }),
  feat({ name: 'Interception', type: 'fighting', summary: 'Use your Reaction to reduce damage dealt to a nearby ally.', description: `When a creature you can see hits another creature within 5 feet of you with an attack, use your Reaction to reduce the target’s damage by 1d10 + your Proficiency Bonus. You must hold a Shield or a Simple or Martial weapon.`, actionType: 'Reaction' }),
  feat({ name: 'Protection', type: 'fighting', summary: 'Use a Shield to hinder attacks against a nearby ally.', description: `While holding a Shield, use your Reaction when a creature you can see attacks someone other than you within 5 feet. The triggering attack and later attacks against that ally have Disadvantage until the start of your next turn, provided you stay within 5 feet of the ally.`, actionType: 'Reaction' }),
  feat({ name: 'Thrown Weapon Fighting', type: 'fighting', summary: 'Deal +2 damage with ranged attacks using Thrown weapons.', description: `When you hit with a ranged attack using a weapon that has the Thrown property, gain +2 to the damage roll.` }),
  feat({ name: 'Two-Weapon Fighting', type: 'fighting', summary: 'Add your ability modifier to the Light property’s extra attack.', description: `When the Light property gives you an extra attack, add your ability modifier to that attack’s damage if it is not already included.` }),
  feat({ name: 'Unarmed Fighting', type: 'fighting', summary: 'Improve your Unarmed Strikes and damage creatures you grapple.', description: `Your damaging Unarmed Strikes deal 1d6 + Strength modifier Bludgeoning damage, or 1d8 + Strength modifier while neither hand holds a weapon or Shield. Once per turn, deal 1d4 Bludgeoning damage to one creature you are grappling.`, uses: 'Grapple damage once per turn' }),

  feat({
    name: 'Boon of Combat Prowess',
    type: 'epic',
    summary: 'Increase any ability and turn one missed attack per turn into a hit.',
    description: `Increase one ability by 1, to a maximum of 30. When an attack roll misses, you may make it hit instead. After using this benefit, you cannot use it again until the start of your next turn.`,
    uses: 'Once per round',
  }),
  feat({
    name: 'Boon of Dimensional Travel',
    type: 'epic',
    summary: 'Increase any ability and teleport after taking the Attack or Magic action.',
    description: `Increase one ability by 1, to a maximum of 30. Immediately after taking the Attack or Magic action, teleport up to 30 feet to an unoccupied space you can see.`,
  }),
  feat({
    name: 'Boon of Energy Resistance',
    type: 'epic',
    summary: 'Increase any ability, gain two energy Resistances, and redirect their damage.',
    description: `Increase one ability by 1, to a maximum of 30. Choose two of Acid, Cold, Fire, Lightning, Necrotic, Poison, Psychic, Radiant, or Thunder; gain Resistance to them and change the choices after a Long Rest. When one of those types damages you, use your Reaction to target a visible creature within 60 feet that lacks Total Cover. It makes a Dexterity save against DC 8 + your Constitution modifier + Proficiency Bonus, taking 2d12 + your Constitution modifier of that type on a failure.`,
    actionType: 'Reaction',
  }),
  feat({
    name: 'Boon of Fate',
    type: 'epic',
    summary: 'Increase any ability and alter a nearby creature’s successful or failed D20 Test by 2d4.',
    description: `Increase one ability by 1, to a maximum of 30. When you or a creature within 60 feet succeeds or fails a D20 Test, roll 2d4 and add or subtract the total from the d20, potentially changing the result. Recharge this benefit when you roll Initiative or finish a Short or Long Rest.`,
    uses: 'Once until recharged',
    recharge: 'Initiative, Short Rest, or Long Rest',
  }),
  feat({
    name: 'Boon of Fortitude',
    type: 'epic',
    summary: 'Increase any ability, gain 40 maximum Hit Points, and improve healing received.',
    description: `Increase one ability by 1, to a maximum of 30. Your Hit Point maximum rises by 40. Once per turn when you regain Hit Points, regain additional Hit Points equal to your Constitution modifier.`,
    uses: 'Extra healing once per turn',
  }),
  feat({
    name: 'Boon of Irresistible Offense',
    type: 'epic',
    summary: 'Increase Strength or Dexterity, bypass physical Resistance, and empower natural 20s.',
    description: `Increase Strength or Dexterity by 1, to a maximum of 30. Your Bludgeoning, Piercing, and Slashing damage ignores Resistance. When an attack roll’s d20 shows 20, deal extra damage equal to the ability score increased by this feat; the extra damage matches the attack’s type.`,
  }),
  feat({
    name: 'Boon of Recovery',
    type: 'epic',
    summary: 'Increase any ability, survive a fall to 0 Hit Points, and draw healing from a d10 pool.',
    description: `Increase one ability by 1, to a maximum of 30. Once per Long Rest when you would fall to 0 Hit Points, remain at 1 and then regain half your Hit Point maximum. You also have a pool of ten d10s; as a Bonus Action, spend any number, roll them, and regain that many Hit Points. The pool refreshes after a Long Rest.`,
    actionType: 'Bonus Action',
    uses: '10d10 healing pool; Last Stand once',
    recharge: 'Long Rest',
  }),
  feat({
    name: 'Boon of Skill',
    type: 'epic',
    summary: 'Increase any ability, gain every skill proficiency, and gain one Expertise.',
    description: `Increase one ability by 1, to a maximum of 30. Gain proficiency in every skill. Choose one skill in which you do not already have Expertise and gain Expertise with it.`,
  }),
  feat({
    name: 'Boon of Speed',
    type: 'epic',
    summary: 'Increase any ability, add 30 feet to Speed, and escape danger as a Bonus Action.',
    description: `Increase one ability by 1, to a maximum of 30. Your Speed increases by 30 feet. As a Bonus Action, take the Disengage action and also end the Grappled condition on yourself.`,
    actionType: 'Bonus Action',
  }),
  feat({
    name: 'Boon of Spell Recall',
    type: 'epic',
    prerequisite: 'Level 19+; Spellcasting feature',
    summary: 'Increase a spellcasting ability and sometimes retain level 1–4 spell slots when casting.',
    description: `Increase Intelligence, Wisdom, or Charisma by 1, to a maximum of 30. Whenever you cast using a level 1–4 spell slot, roll 1d4. If the roll equals the slot’s level, the slot is not expended.`,
  }),
  feat({
    name: 'Boon of the Night Spirit',
    type: 'epic',
    summary: 'Increase any ability and become invisible and damage-resistant in dim light or darkness.',
    description: `Increase one ability by 1, to a maximum of 30. In Dim Light or Darkness, use a Bonus Action to become Invisible until immediately after you take an action, Bonus Action, or Reaction. While in Dim Light or Darkness, you also have Resistance to every damage type except Psychic and Radiant.`,
    actionType: 'Bonus Action',
  }),
  feat({
    name: 'Boon of Truesight',
    type: 'epic',
    summary: 'Increase any ability and gain Truesight to 60 feet.',
    description: `Increase one ability by 1, to a maximum of 30. You gain Truesight with a range of 60 feet.`,
  }),
]

const perCategoryOrder = new Map()
const records = FEATS.map((entry) => {
  const category = CATEGORY[entry.type]
  const featureOrder = (perCategoryOrder.get(entry.type) ?? 0) + 1
  perCategoryOrder.set(entry.type, featureOrder)

  return {
    slug: `phb24-feat-${slugify(entry.name)}`,
    name: entry.name,
    category: category.label,
    ability_kind: 'feat',
    class_key: null,
    level_required: category.level,
    feature_order: featureOrder,
    action_type: entry.actionType,
    uses: entry.uses,
    recharge: entry.recharge,
    summary: entry.summary,
    description: entry.description,
    prerequisite: entry.prerequisite ?? category.prerequisite,
    repeatable: entry.repeatable,
    source: 'Player’s Handbook (2024)',
    tags: [
      'feat',
      category.label.toLowerCase(),
      '2024 rules',
      ...(entry.repeatable ? ['repeatable'] : []),
    ],
    source_type: 'book',
  }
})

const counts = records.reduce((result, record) => {
  result[record.category] = (result[record.category] ?? 0) + 1
  return result
}, {})

if (records.length !== 75) throw new Error(`Expected 75 feats, found ${records.length}.`)
if (new Set(records.map((record) => record.slug)).size !== records.length) {
  throw new Error('Feat slugs must be unique.')
}

await writeFile(OUTPUT_URL, `${JSON.stringify(records, null, 2)}\n`)

const migration = await readFile(MIGRATION_URL, 'utf8')
const marker = '$feat_data$'
const start = migration.indexOf(marker)
const end = migration.indexOf(marker, start + marker.length)
if (start < 0 || end < 0) throw new Error('Feat migration data markers are missing.')
await writeFile(
  MIGRATION_URL,
  `${migration.slice(0, start + marker.length)}${JSON.stringify(records)}${migration.slice(end)}`,
)

console.log(`Wrote ${records.length} PHB 2024 feats to ${fileURLToPath(OUTPUT_URL)}.`)
console.log(counts)
