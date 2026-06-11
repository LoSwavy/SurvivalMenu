/* =========================================================
   THE LAST OF US — SURVIVOR DASHBOARD
   Pure HTML/CSS/JS. No frameworks, no build, no deps.

   ARCHITECTURE
   - GAME_DATA  : all rules content (backgrounds, perks, trees,
                  weapon templates, inventory, keywords). Add to
                  these objects to expand the game — the UI reads
                  from them and never hardcodes character data.
   - character  : the live, saved state (localStorage).
   - derive()   : computes stats + the "what can I do" dashboard
                  by walking every active source of effects.
   - render*()  : paint each tab from state. Called on any change.
   ========================================================= */

/* ============================================================
   1. GAME DATA  (expand freely — UI is data-driven)
   ============================================================ */

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const ABILITY_NAMES = { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };

/* Black & white line-art icons (icons/*.svg) */
function icon(name, cls = "") {
  return `<img class="icon ${cls}" src="icons/${name}.svg" alt="" />`;
}

/* Skill -> governing ability (for the Rolls page) */
const SKILL_ABILITY = {
  "Athletics": "str", "Acrobatics": "dex", "Sleight of Hand": "dex", "Stealth": "dex",
  "Investigation": "int", "Engineering": "int",
  "Perception": "wis", "Medicine": "wis", "Survival": "wis", "Insight": "wis",
  "Persuasion": "cha", "Deception": "cha", "Intimidation": "cha",
};

/* Dashboard categories */
const CAT = { ACTION: "action", BONUS: "bonus", REACT: "reaction", PASSIVE: "passive" };

/* --- Backgrounds ---------------------------------------------------------
   Each: icon, tag, fixed survivor perks (proficiencies), a unique
   background perk (with dashboard + stat effects + weapon effects),
   and starting gear (weapons + inventory).                                  */
const GAME_DATA = {};

/* --- Weapon templates (defined first: background gear references them) ---- */
GAME_DATA.weaponTemplates = {
  "": { name: "", category: "rifle" },
  "Bolt-Action Rifle": { name: "Bolt-Action Rifle", category: "rifle", damage: "2d8 + DEX", range: "300 ft", ammoType: "Rifle Ammo", maxAmmo: 6, sound: "Very Loud" },
  "Hunting Rifle":      { name: "Hunting Rifle", category: "rifle", damage: "2d8 + DEX", range: "250 ft", ammoType: "Rifle Ammo", maxAmmo: 5, sound: "Very Loud" },
  "Shotgun":            { name: "Shotgun", category: "shotgun", damage: "2d6", ammoType: "Shotgun Shells", maxAmmo: 2, range: "Short", sound: "Very Loud" },
  "9mm Pistol":         { name: "9mm Pistol", category: "handgun", damage: "2d6 + DEX", range: "60 ft", ammoType: "Handgun Ammo", maxAmmo: 12, sound: "Very Loud" },
  "Snubnose Revolver":  { name: "Snubnose Revolver", category: "handgun", damage: "2d6 + DEX", range: "40 ft", ammoType: "Handgun Ammo", maxAmmo: 6, sound: "Very Loud" },
  "Hunting Bow":        { name: "Hunting Bow", category: "bow", damage: "1d8 + DEX", range: "120 ft", ammoType: "Arrows", maxAmmo: 8, sound: "Quiet" },
  "Metal Pipe":         { name: "Metal Pipe", category: "blunt", damage: "1d6 + STR", range: "Melee (5 ft)", ammoType: "", maxAmmo: 0, sound: "Medium" },
  "Baseball Bat":       { name: "Baseball Bat", category: "blunt", damage: "1d6 + STR", range: "Melee (5 ft)", ammoType: "", maxAmmo: 0, sound: "Medium" },
  "Machete":            { name: "Machete", category: "melee", damage: "1d8 + STR", range: "Melee (5 ft)", ammoType: "", maxAmmo: 0, sound: "Medium" },
  "Improvised Weapon":  { name: "Improvised Weapon", category: "improvised", damage: "1d4 + STR", range: "Melee (5 ft)", ammoType: "", maxAmmo: 0, sound: "Medium" },
  "Upgraded Improvised":{ name: "Upgraded Improvised Weapon", category: "improvised", damage: "1d10 + STR", range: "Melee (5 ft)", ammoType: "", maxAmmo: 0, sound: "Loud", upgrades: ["Upgraded (breaks on 1)"] },
};
const WEAPON_TYPE_LABEL = { rifle: "Rifle", shotgun: "Shotgun", handgun: "Handgun", bow: "Bow", blunt: "Blunt Melee", improvised: "Improvised Melee", melee: "Melee" };

GAME_DATA.backgrounds = {
  brawler: {
    id: "brawler", name: "Brawler", icon: "🔨", flavor: "armored in muscle",
    perks: [
      { type: "weapon", choice: "Blunt Melee" },
      { type: "skill", choice: "Athletics" },
    ],
    backgroundPerk: {
      name: "Thick-Skinned",
      dash: [{ cat: CAT.PASSIVE, name: "Thick-Skinned", desc: "While unarmored, add your CON modifier to AC. Stacks with other unarmored AC bonuses." }],
      stat: (d, c) => { if (!c.character.wearingArmor) d.ac += c.mods.con; },
    },
    gear: {
      weapons: [tmplWeapon("Metal Pipe", "blunt")],
      inventory: { binding: 2 },
    },
  },
  sharpshooter: {
    id: "sharpshooter", name: "Sharpshooter", icon: "🎯", flavor: "one shot, one kill",
    perks: [
      { type: "weapon", choice: "Rifles" },
      { type: "skill", choice: "Perception" },
    ],
    backgroundPerk: {
      name: "Kill Shot",
      dash: [{ cat: CAT.PASSIVE, name: "Kill Shot (Aimed Shot: Rifles)", desc: "Before a rifle attack you may take −5 to hit for +10 damage (rifles only)." }],
      weapon: { match: (w) => w.category === "rifle", name: "Aimed Shot", desc: "−5 to hit, +10 damage (once per attack)." },
    },
    gear: {
      weapons: [tmplWeapon("Bolt-Action Rifle", "rifle", { upgrades: ["Scope Attachment"] })],
      inventory: { longGunAmmo: 6 },
    },
  },
  medic: {
    id: "medic", name: "Medic", icon: "🩹", flavor: "keeps the group breathing",
    perks: [
      { type: "weapon", choice: "Handguns" },
      { type: "skill", choice: "Medicine" },
    ],
    backgroundPerk: {
      name: "Combat Healer",
      dash: [{ cat: CAT.BONUS, name: "Combat Heal", desc: "Use healing items as a bonus action. If you instead spend your action, the item heals its maximum amount." }],
      flags: { healAsBonus: true },
    },
    gear: {
      weapons: [tmplWeapon("9mm Pistol", "handgun")],
      inventory: { bandage: 2, alcohol: 1 },
    },
  },
  smuggler: {
    id: "smuggler", name: "Smuggler", icon: "📦", flavor: "gets the goods, gets around",
    perks: [
      { type: "weapon", choice: "Handguns" },
      { type: "skill", choice: "Investigation" },
    ],
    backgroundPerk: {
      name: "Smuggler's Routes",
      dash: [{ cat: CAT.PASSIVE, name: "Smuggler's Routes", desc: "Ignore difficult terrain; +10 ft speed; climbing & swimming speed equal to your walking speed." }],
      stat: (d) => { d.speed += 10; },
    },
    gear: {
      weapons: [tmplWeapon("Snubnose Revolver", "handgun", { currentAmmo: 4, maxAmmo: 6 })],
      inventory: { scrap: 2, binding: 1 },
    },
  },
  hunter: {
    id: "hunter", name: "Hunter", icon: "🐺", flavor: "stalks, hides, strikes unseen",
    perks: [
      { type: "weapon", choice: "Bows" },
      { type: "skill", choice: "Stealth" },
    ],
    backgroundPerk: {
      name: "Stalker",
      dash: [{ cat: CAT.PASSIVE, name: "Stalker", desc: "Advantage on Initiative rolls. Creatures have Disadvantage on Stealth checks to hide from you." }],
      flags: { initAdvantage: true },
    },
    gear: {
      weapons: [tmplWeapon("Hunting Bow", "bow")],
      inventory: { arrows: 8, shiv: 1 },
    },
  },
};

/* --- Survivor Perk menu --------------------------------------------------
   Player-chosen perks (background grants 2 fixed automatically).            */
GAME_DATA.survivorPerks = {
  weapon: {
    type: "weapon", label: "Weapon Training", repeatable: true,
    needsChoice: true, choices: ["Blunt Melee", "Improvised", "Handguns", "Rifles", "Bows", "Shotguns"],
    effect: (ch) => `Add Proficiency Bonus to ${ch} attack rolls.`,
  },
  skill: {
    type: "skill", label: "Cross-Training", repeatable: true,
    needsChoice: true,
    choices: ["Athletics", "Acrobatics", "Stealth", "Sleight of Hand", "Investigation", "Perception", "Medicine", "Engineering", "Survival", "Persuasion", "Deception", "Intimidation", "Insight"],
    effect: (ch) => `Add Proficiency Bonus to ${ch} checks.`,
  },
  lightfeet: {
    type: "lightfeet", label: "Light Feet", repeatable: true, max: 2,
    effect: () => "+5 ft speed.",
    dash: [{ cat: CAT.PASSIVE, name: "Light Feet", desc: "+5 ft movement speed." }],
    stat: (d) => { d.speed += 5; },
  },
  acclimated: {
    type: "acclimated", label: "Acclimated", repeatable: true, max: 2,
    needsChoice: true, choices: ["Cold", "Heat", "Gas", "Spores", "Other Hazard"],
    effect: (ch) => `Advantage on saves vs ${ch}.`,
  },
  steel: {
    type: "steel", label: "Steel Nerves", max: 1,
    needsChoice: true, choices: ["STR Saves", "DEX Saves", "CON Saves", "INT Saves", "WIS Saves", "CHA Saves"],
    effect: (ch) => `Add Proficiency Bonus to ${ch.replace(" Saves", "")} saving throws.`,
  },
  abilityImprovement: {
    type: "abilityImprovement", label: "Ability Improvement", repeatable: true, max: 2,
    needsChoice: true, choices: ["str", "dex", "con", "int", "wis", "cha"],
    effect: (ch) => `+1 ${ABILITY_NAMES[ch] || ch.toUpperCase()}.`,
  },
};

/* --- Skill Trees ---------------------------------------------------------
   13 trees, grouped. Each tier: name, cost, desc, optional dashboard
   entries, optional stat fn, optional weapon effect.                        */
const T1 = 1, T2 = 3, T3 = 5;

GAME_DATA.skillTrees = {
  // ===== COMBAT =====
  cqc: {
    id: "cqc", category: "Combat", name: "Close-Quarters Control", flavor: "grapples, pressure, finishing chains",
    tiers: [
      { name: "Iron Fist", cost: T1, desc: "Fists & blunt melee are +1 weapons. Once per turn, after a melee attack, Grapple a creature in reach as a bonus action (contested Athletics).",
        dash: [{ cat: CAT.BONUS, name: "Grapple", desc: "After a melee attack, grapple a creature in reach (contested Athletics)." }],
        weapon: { match: (w) => w.category === "blunt", name: "Iron Fist (+1)", desc: "Counts as a +1 weapon." } },
      { name: "Break Them Down", cost: T2, desc: "Once per turn on a melee hit: push 5 ft; or target makes a STR save vs your Maneuver DC — on a fail, Disadvantage on its next attack or drops a held item.",
        dash: [{ cat: CAT.PASSIVE, name: "Break Them Down", desc: "On a melee hit (1/turn): push 5 ft, or force STR save vs your Maneuver DC to debuff/disarm." }] },
      { name: "Chain Fighter", cost: T3, desc: "Fists & blunt melee become +2 weapons. When you drop a creature to 0 HP, move up to 10 ft and make one free melee attack.",
        dash: [{ cat: CAT.PASSIVE, name: "Chain Fighter", desc: "On a melee kill: move 10 ft and make one free melee attack." }],
        weapon: { match: (w) => w.category === "blunt", name: "Chain Fighter (+2)", desc: "Counts as a +2 weapon (overrides Iron Fist)." } },
    ],
  },
  handgun: {
    id: "handgun", category: "Combat", name: "Handgun Specialist", flavor: "quickdraw, precision sidearm",
    tiers: [
      { name: "Precision Shooter", cost: T1, desc: "+2 to attack rolls with handguns. Ignore Disadvantage from long range with handguns.",
        weapon: { match: (w) => w.category === "handgun", name: "Precision Shooter", desc: "+2 to attack rolls; ignore long-range Disadvantage." } },
      { name: "Tactical Reload", cost: T2, desc: "Reload a handgun as part of your Attack. You gain Aimed Shot with handguns.",
        weapon: { match: (w) => w.category === "handgun", name: "Tactical Reload + Aimed Shot", desc: "Reload as part of Attack. Aimed Shot: −5 to hit, +10 damage." } },
      { name: "Double Tap", cost: T3, desc: "When you Attack with a handgun, you may fire twice. Both shots hit the same target unless the first drops it to 0 HP. Each shot spends ammo.",
        dash: [{ cat: CAT.ACTION, name: "Double Tap", desc: "Attack with a handgun to fire twice (each shot spends ammo)." }],
        weapon: { match: (w) => w.category === "handgun", name: "Double Tap", desc: "Fire twice when you take the Attack action (each shot spends ammo)." } },
    ],
  },
  marksman: {
    id: "marksman", category: "Combat", name: "Precision Marksman", flavor: "long-range control & punishment",
    tiers: [
      { name: "Marksman's Focus", cost: T1, desc: "Long guns are +1 weapons. If you make no movement on your turn, gain Advantage on your next long-gun attack.",
        weapon: { match: (w) => w.category === "rifle", name: "Marksman's Focus (+1)", desc: "+1 weapon. Advantage on your next shot if you didn't move this turn." } },
      { name: "Suppressive Fire", cost: T2, desc: "Instead of attacking, spend a shot to Suppress a target you can see (WIS save vs your Maneuver DC). If it moves, react to shoot it with Advantage (crit 18–20).",
        dash: [{ cat: CAT.ACTION, name: "Suppressive Fire", desc: "Spend a shot to Suppress a visible target (WIS save vs Maneuver DC). Moving triggers a reaction shot with Advantage." }] },
      { name: "Zeroed In", cost: T3, desc: "Your long guns ignore half and three-quarters cover. A Suppressed target you hit takes +10 damage.",
        weapon: { match: (w) => w.category === "rifle", name: "Zeroed In", desc: "Ignores half/¾ cover. +10 damage vs Suppressed targets." } },
    ],
  },
  improvised: {
    id: "improvised", category: "Combat", name: "Brawler / Improvised", flavor: "scrappy, resourceful melee",
    tiers: [
      { name: "Scrap Brawler", cost: T1, desc: "Fists & improvised weapons deal 1d6. Your improvised weapons break only on a 1 (Durability Check).",
        weapon: { match: (w) => w.category === "improvised", name: "Scrap Brawler", desc: "Deals 1d6; breaks only on a 1." } },
      { name: "Adrenaline Surge", cost: T2, desc: "When you drop a creature to 0 HP with fists or an improvised weapon, gain 5 temp HP (doesn't stack with itself).",
        dash: [{ cat: CAT.PASSIVE, name: "Adrenaline Surge", desc: "Gain 5 temp HP when you kill with fists/improvised weapons." }] },
      { name: "Brutal Finisher", cost: T3, desc: "Once per turn, perform a Finisher on a Fodder creature at or below 25% HP as a free action.",
        dash: [{ cat: CAT.ACTION, name: "Brutal Finisher (free)", desc: "1/turn free action: Finisher on a Fodder creature at ≤25% HP." }] },
    ],
  },
  infiltrator: {
    id: "infiltrator", category: "Combat", name: "Silent Infiltrator", flavor: "stealth lethality",
    tiers: [
      { name: "Ambusher", cost: T1, desc: "Attacks vs Unaware creatures deal +1d6. If Hidden when combat begins, +5 Initiative.",
        dash: [{ cat: CAT.PASSIVE, name: "Ambusher", desc: "+1d6 vs Unaware creatures. +5 Initiative if Hidden when combat starts." }] },
      { name: "Ghost Step", cost: T2, desc: "Ambusher die becomes +2d6. When you hit while Hidden, Dash or Disengage as a bonus action.",
        dash: [{ cat: CAT.BONUS, name: "Ghost Step", desc: "After a hit while Hidden, Dash or Disengage as a bonus action (Ambusher becomes +2d6)." }] },
      { name: "Predator's Kill", cost: T3, desc: "Once per encounter, your attack from Hidden is a guaranteed critical hit. If it kills, the use isn't spent.",
        dash: [{ cat: CAT.ACTION, name: "Predator's Kill", desc: "1/encounter: guaranteed crit from Hidden. Refunds itself on a kill." }] },
    ],
  },
  defensive: {
    id: "defensive", category: "Combat", name: "Defensive Combatant", flavor: "block, brace, counter",
    tiers: [
      { name: "Bob and Weave", cost: T1, desc: "With a melee weapon or fists, +2 AC. If you make no movement on your turn, you're automatically Braced.",
        dash: [{ cat: CAT.PASSIVE, name: "Bob and Weave", desc: "+2 AC with a melee weapon/fists. No movement = automatically Braced (can't be shoved/knocked prone)." }],
        stat: (d) => { d.ac += 2; } },
      { name: "Reactive Guard", cost: T2, desc: "While Braced, when a creature misses you with a melee attack, react to make a melee attack (Riposte) or shove it 5 ft.",
        dash: [{ cat: CAT.REACT, name: "Reactive Guard", desc: "While Braced, when a melee attack misses you: Riposte or shove 5 ft." }] },
      { name: "Parry and Counter", cost: T3, desc: "Once per turn, when hit by a melee attack, reduce the damage by 1d8. If reduced to 0, make a free melee attack against the attacker.",
        dash: [{ cat: CAT.REACT, name: "Parry and Counter", desc: "1/turn: reduce a melee hit by 1d8. If reduced to 0, free melee attack back." }] },
    ],
  },
  // ===== CRAFTING =====
  fieldcraft: {
    id: "fieldcraft", category: "Crafting", name: "Field Craftsman", flavor: "craft mid-fight",
    tiers: [
      { name: "Fast Hands", cost: T1, desc: "Craft basic items as a bonus action.",
        dash: [{ cat: CAT.BONUS, name: "Craft Item (Fast Hands)", desc: "Craft a basic item as a bonus action." }],
        flags: { craftAsBonus: true } },
      { name: "On the Fly", cost: T2, desc: "Craft even with enemies within 10 ft, and craft up to two basic items in a single craft.",
        dash: [{ cat: CAT.PASSIVE, name: "On the Fly", desc: "Craft within 10 ft of enemies without provoking; craft two basic items at once." }] },
      { name: "Seamless Use", cost: T3, desc: "When you craft with your action, immediately use one crafted item as part of that same action (frees your bonus action).",
        dash: [{ cat: CAT.PASSIVE, name: "Seamless Use", desc: "Crafting with your action lets you use one crafted item for free as part of it." }] },
    ],
  },
  resource: {
    id: "resource", category: "Crafting", name: "Resource Efficiency", flavor: "stretch materials",
    tiers: [
      { name: "Spread Thin", cost: T1, desc: "When you craft, roll a d6; on a 6, don't consume one ingredient.",
        dash: [{ cat: CAT.PASSIVE, name: "Spread Thin", desc: "On a craft, roll d6: on a 6, save one ingredient." }] },
      { name: "Efficient Workflow", cost: T2, desc: "Spread Thin now triggers on 4–6. Crafted items stack one higher (max 3).",
        dash: [{ cat: CAT.PASSIVE, name: "Efficient Workflow", desc: "Spread Thin triggers on 4–6. Crafted items stack to 3." }],
        flags: { craftedStack3: true } },
      { name: "High Yield", cost: T3, desc: "When you craft, roll a d6: on 4–6 save an ingredient; on a 6, also craft double.",
        dash: [{ cat: CAT.PASSIVE, name: "High Yield", desc: "On a craft, roll d6: 4–6 saves an ingredient; a 6 also doubles the craft." }] },
    ],
  },
  mastercraft: {
    id: "mastercraft", category: "Crafting", name: "Master Craftsman", flavor: "quality over quantity",
    tiers: [
      { name: "Refined Skill", cost: T1, desc: "Items you craft gain +1 effectiveness: crafted weapons +1 to hit or +1 save DC; crafted bandages heal +1.",
        dash: [{ cat: CAT.PASSIVE, name: "Refined Skill", desc: "Crafted items +1 effectiveness (to hit / save DC / bandage healing)." }] },
      { name: "Hardened Goods", cost: T2, desc: "Items you craft during a rest are Hardened (+2 to hit/DC; bandages heal +2; resists breaking once).",
        dash: [{ cat: CAT.PASSIVE, name: "Hardened Goods", desc: "Items crafted during a rest are Hardened (+2; resist breaking once)." }] },
      { name: "Masterwork Tools", cost: T3, desc: "During a rest, a number of items equal to your PB are Masterwork (+3; resists breaking twice).",
        dash: [{ cat: CAT.PASSIVE, name: "Masterwork Tools", desc: "During a rest, PB items become Masterwork (+3; resist breaking twice)." }] },
    ],
  },
  // ===== SURVIVAL =====
  predator: {
    id: "predator", category: "Survival", name: "Predator Instincts", flavor: "track, focus, execute",
    tiers: [
      { name: "Tracker's Mark", cost: T1, desc: "As a bonus action, Mark a creature you can see for 1 hour: +2 to attack rolls vs it, +1d4 damage once per turn, Advantage to track it.",
        dash: [{ cat: CAT.BONUS, name: "Tracker's Mark", desc: "Mark a visible creature: +2 to hit it, +1d4 damage (1/turn), Advantage to track." }],
        weapon: { match: () => true, name: "Tracker's Mark", desc: "+2 to hit & +1d4 dmg vs your Marked target (1/turn)." } },
      { name: "Deadeye Focus", cost: T2, desc: "Mark damage becomes +1d6. Your Marked target gains no benefit from half/¾ cover; you auto-succeed tracking checks against it.",
        dash: [{ cat: CAT.PASSIVE, name: "Deadeye Focus", desc: "Mark damage becomes +1d6. Marked target ignores cover; auto-succeed tracking." }] },
      { name: "Execution", cost: T3, desc: "When your Marked target drops below 25% HP, react to perform a Finisher on it. On a kill, move your Mark to a creature within 30 ft.",
        dash: [{ cat: CAT.REACT, name: "Execution", desc: "When your Marked target falls below 25% HP, react to Finisher it. Kill moves the Mark 30 ft." }] },
    ],
  },
  silentmove: {
    id: "silentmove", category: "Survival", name: "Silent Movement", flavor: "crouch mobility, stealth escape",
    tiers: [
      { name: "Fluid Movement", cost: T1, desc: "No speed penalty while crouched. If you Dash into cover, you may Hide as part of that action.",
        dash: [{ cat: CAT.PASSIVE, name: "Fluid Movement", desc: "No crouch speed penalty. Dash into cover lets you Hide as part of the action." }] },
      { name: "Soft Steps", cost: T2, desc: "Creatures have Disadvantage to detect you. Your movement sound drops one level (e.g. Medium → Quiet).",
        dash: [{ cat: CAT.PASSIVE, name: "Soft Steps", desc: "Creatures roll Disadvantage to detect you. Movement sound drops one level." }] },
      { name: "Last Chance Kill", cost: T3, desc: "When a creature spots you, react to move up to 10 ft and make a melee or ranged attack. A kill with no other witnesses raises no alarm.",
        dash: [{ cat: CAT.REACT, name: "Last Chance Kill", desc: "When spotted, react to move 10 ft and attack. A clean kill raises no alarm." }] },
    ],
  },
  scavenger: {
    id: "scavenger", category: "Survival", name: "Scavenger", flavor: "consistent finds",
    tiers: [
      { name: "Keen Eye", cost: T1, desc: "Advantage on Investigation to search areas/bodies. Reroll one failed loot check per rest.",
        dash: [{ cat: CAT.PASSIVE, name: "Keen Eye", desc: "Advantage on Investigation to search. Reroll one failed loot check per rest." }] },
      { name: "Opportunist", cost: T2, desc: "When you succeed on a loot check, roll once more on the item table for a bonus item.",
        dash: [{ cat: CAT.PASSIVE, name: "Opportunist", desc: "A successful loot check grants one extra roll on the item table." }] },
      { name: "Scrap Magnet", cost: T3, desc: "When you find basic materials, roll a d4; on 2–4, gain +1 of that item. Once per loot check.",
        dash: [{ cat: CAT.PASSIVE, name: "Scrap Magnet", desc: "Finding basic materials: roll d4, on 2–4 gain +1 (once per loot check)." }] },
    ],
  },
  endure: {
    id: "endure", category: "Survival", name: "Endure the World", flavor: "durability, resilience",
    tiers: [
      { name: "Hardened Survivor", cost: T1, desc: "Gain 5 + CON max HP. Advantage on saves vs environmental effects (cold, gas, heat, etc.).",
        dash: [{ cat: CAT.PASSIVE, name: "Hardened Survivor", desc: "+ (5 + CON) max HP. Advantage on saves vs environmental hazards." }],
        stat: (d, c) => { d.maxHp += 5 + c.mods.con; } },
      { name: "Grit", cost: T2, desc: "Once per short rest, when you'd be reduced to 0 HP, drop to 1 HP instead. Immune to Frightened.",
        dash: [{ cat: CAT.REACT, name: "Grit", desc: "1/short rest: drop to 1 HP instead of 0. Immune to Frightened." }] },
      { name: "Survivor's Resolve", cost: T3, desc: "Gain another 5 + CON max HP. Take half damage on failed saves and none on successful ones.",
        dash: [{ cat: CAT.PASSIVE, name: "Survivor's Resolve", desc: "+ (5 + CON) max HP. Half damage on failed saves, none on success." }],
        stat: (d, c) => { d.maxHp += 5 + c.mods.con; } },
    ],
  },
};

/* --- Inventory definitions ----------------------------------------------- */
GAME_DATA.inventory = [
  { group: "Crafting Materials", items: [
    { id: "rag", name: "Rag", icon: "inv-rag", desc: "A scrap of cloth. Used to craft bandages, molotovs and silencers." },
    { id: "scrap", name: "Scrap", icon: "inv-scrap", desc: "Bits of metal and parts. Used to craft shivs and upgraded improvised weapons." },
    { id: "alcohol", name: "Alcohol", icon: "inv-alcohol", desc: "High-proof liquid. Used to craft bandages and molotovs." },
    { id: "binding", name: "Binding", icon: "inv-binding", desc: "Tape, cord or wire. Used to craft shivs and upgraded improvised weapons." },
    { id: "bottle", name: "Bottle", icon: "inv-bottle", desc: "An empty glass bottle. Used to craft silencers." },
  ]},
  { group: "Ammunition", items: [
    { id: "handgunAmmo", name: "Handgun Ammo", icon: "inv-handgunAmmo", desc: "Ammunition for handguns." },
    { id: "longGunAmmo", name: "Rifle Ammo", icon: "inv-longGunAmmo", desc: "Ammunition for rifles." },
    { id: "shotgunAmmo", name: "Shotgun Shells", icon: "inv-shotgunAmmo", desc: "Ammunition for shotguns." },
    { id: "arrows", name: "Arrows", icon: "inv-arrows", desc: "Ammunition for bows. Can sometimes be retrieved after combat." },
  ]},
  { group: "Crafted Items", items: [
    { id: "bandage", name: "Bandage", icon: "inv-bandage", recipe: "Rag + Alcohol", craft: { rag: 1, alcohol: 1 }, desc: "Heals 1d4 + CON when used. Crafting consumes 1 Rag + 1 Alcohol." },
    { id: "molotov", name: "Molotov", icon: "inv-molotov", recipe: "Rag + Alcohol", craft: { rag: 1, alcohol: 1 }, desc: "Thrown weapon: 1d10 fire damage; DC 15 DEX save vs catching fire. Crafting consumes 1 Rag + 1 Alcohol." },
    { id: "shiv", name: "Shiv", icon: "inv-shiv", recipe: "Scrap + Binding", craft: { scrap: 1, binding: 1 }, desc: "Instant kill vs an Unaware creature with max HP ≤ 30; otherwise the target makes a DC 15 CON save or dies. Crafting consumes 1 Scrap + 1 Binding." },
    { id: "silencer", name: "Silencer", icon: "inv-silencer", recipe: "Rag + Bottle", craft: { rag: 1, bottle: 1 }, desc: "Attach to a firearm to make it Quiet, regardless of its normal sound level. Crafting consumes 1 Rag + 1 Bottle." },
    { id: "upgradedWeapon", name: "Upgraded Improv. Weapon", icon: "inv-upgradedWeapon", recipe: "2× Scrap + Binding", craft: { scrap: 2, binding: 1 }, desc: "An improvised weapon reinforced to deal 1d10 damage and only break on a roll of 1. Crafting consumes 2 Scrap + 1 Binding." },
    { id: "medkit", name: "Medkit", icon: "inv-medkit", recipe: "Found only", desc: "Heals 2d6 + CON when used. Cannot be crafted — found only." },
  ]},
];
/* flat lookup */
GAME_DATA.invById = {};
GAME_DATA.inventory.forEach(g => g.items.forEach(i => { GAME_DATA.invById[i.id] = i; }));

/* --- Status effect presets ----------------------------------------------- */
GAME_DATA.statusPresets = [
  { label: "Open", cls: "green" },
  { label: "Bleeding", cls: "danger" },
  { label: "Braced", cls: "green" },
  { label: "Hidden", cls: "green" },
  { label: "Marked Target", cls: "warn" },
  { label: "Suppressed", cls: "warn" },
  { label: "Prone", cls: "danger" },
  { label: "Grappled", cls: "warn" },
  { label: "Infected — Stage 1", cls: "danger" },
  { label: "Infected — Stage 2", cls: "danger" },
  { label: "Infected — Stage 3", cls: "danger" },
  { label: "Exhausted", cls: "warn" },
  { label: "Temp HP", cls: "green" },
];

/* --- Rules quick-reference keywords -------------------------------------- */
GAME_DATA.keywords = [
  { term: "Hidden", def: "Unseen after a successful Stealth check behind cover/concealment. You stop being Hidden when you attack or are seen." },
  { term: "Open", def: "Prone, stunned, downed, begging, knocked down, or concussed — a valid Finisher target." },
  { term: "Unaware", def: "A creature that hasn't noticed you (hasn't acted against you, or you're Hidden from it)." },
  { term: "Marked", def: "Tagged by Predator Instincts. +2 to hit it and bonus damage once per turn. One Mark at a time." },
  { term: "Suppressed", def: "Pinned by Precision Marksman — can't move; moving triggers a reaction shot. Ends when it moves or your next turn starts." },
  { term: "Braced", def: "Made no movement this turn (needs Bob and Weave): can't be shoved/knocked prone/knocked down; can use Reactive Guard." },
  { term: "Finisher", def: "Instant kill (no roll) on a Fodder creature that is Open or Unaware. Apex enemies are immune." },
  { term: "Aimed Shot", def: "Before a ranged attack, take −5 to hit for +10 damage. Once per attack, regardless of how many features grant it." },
  { term: "Maneuver DC", def: "8 + PB + relevant modifier (STR or DEX). The save DC for maneuvers a feature forces on a target." },
  { term: "Fodder / Apex", def: "Fodder = almost everything (incl. Clickers); fully subject to lethality rules. Apex = rare bosses immune to instant-death/Finishers." },
  { term: "Downed", def: "A PC at 0 HP: unconscious & Open. DC 10 CON saves each turn — 3 successes stabilize, 3 failures = dead." },
  { term: "Durability Check", def: "On an improvised-weapon hit, roll d4: base breaks on 1–3; Upgraded/Brawler weapons break only on 1." },
  { term: "Massive Injury", def: "An enemy hit for 50%+ of its max HP rolls on the 1d10 injury table. 75%+ instantly kills Fodder." },
  { term: "Resolve", def: "Resolve = level ÷ 2, rounded up (max 5). Refreshes fully on a long rest. Spend 1 Resolve to: reroll any d20 (yours or one forced on you) and take the new result; OR make a Last Stand while Downed (act and move at half speed without stabilizing)." },
];

/* ============================================================
   2. WEAPON TEMPLATE HELPER (used by background gear above)
   ============================================================ */
function tmplWeapon(name, category, overrides = {}) {
  const base = GAME_DATA.weaponTemplates[name] || GAME_DATA.weaponTemplates[Object.keys(GAME_DATA.weaponTemplates).find(k => GAME_DATA.weaponTemplates[k].name === name)] || {};
  const w = {
    id: uid(),
    name,
    category: category || base.category || "melee",
    damage: base.damage || "1d6",
    range: base.range || "Melee (5 ft)",
    ammoType: base.ammoType || "",
    maxAmmo: base.maxAmmo || 0,
    currentAmmo: base.maxAmmo || 0,
    sound: base.sound || "Medium",
    silenced: false,
    upgrades: (base.upgrades || []).slice(),
    notes: "",
  };
  return Object.assign(w, overrides);
}

/* ============================================================
   3. STATE
   ============================================================ */
const STORAGE_KEY = "tlou-survivor-dashboard-v1";

function uid() { return "x" + Math.random().toString(36).slice(2, 9); }
function mod(score) { return Math.floor((Number(score) - 10) / 2); }
function fmtMod(m) { return (m >= 0 ? "+" : "") + m; }

/* AP gained per level (cumulative) & PB by level */
const AP_BY_LEVEL = { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10, 6: 13, 7: 16, 8: 19, 9: 22, 10: 25 };
function pbForLevel(lvl) { return lvl >= 9 ? 4 : lvl >= 5 ? 3 : 2; }
function resolveForLevel(lvl) { return Math.min(5, Math.ceil(lvl / 2)); }

function defaultCharacter() {
  return {
    name: "",
    background: "",
    level: 1,
    abilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    currentHP: 10,
    tempHP: 0,
    wearingArmor: false,
    weapons: [],
    inventory: {},          // id -> qty
    unlocked: {},           // treeId -> highest tier index unlocked (1..3)
    perks: [],              // [{type, choice}]  (player-chosen survivor perks)
    statuses: [],           // [string]
    notes: [],              // [{id, title, body, collapsed}]
    resolveCurrent: null,   // null = full (synced to max)
    weaponSlots: [null],    // rifle/bow/melee weapon ids (max 3)
    holsters: [null],       // handgun ids (max 2)
    armor: null,            // { type, acBonus, other } or null
    deathSaves: { success: 0, fail: 0 },
    customItems: [],        // [{id, name, desc, qty}]
  };
}

let character = loadCharacter();

function loadCharacter() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const c = Object.assign(defaultCharacter(), JSON.parse(raw));
      // Migrate old fixed equip {longgun, handgun, melee} → addable slot arrays.
      if (!Array.isArray(c.weaponSlots)) {
        const ws = [];
        if (c.equip && c.equip.longgun) ws.push(c.equip.longgun);
        if (c.equip && c.equip.melee) ws.push(c.equip.melee);
        c.weaponSlots = ws.length ? ws : [null];
      }
      if (!Array.isArray(c.holsters)) {
        c.holsters = (c.equip && c.equip.handgun) ? [c.equip.handgun] : [null];
      }
      if (c.armor === undefined) c.armor = null;
      if (!c.deathSaves) c.deathSaves = { success: 0, fail: 0 };
      if (!Array.isArray(c.customItems)) c.customItems = [];
      delete c.equip;
      return c;
    }
  } catch (e) { console.warn("Load failed", e); }
  return defaultCharacter();
}

let saveTimer = null;
function save(flash = true) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(character));
    if (flash) {
      const ind = document.getElementById("save-indicator");
      ind.textContent = "Saved ✓";
      ind.classList.add("flash");
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { ind.classList.remove("flash"); ind.textContent = "Saved"; }, 1200);
    }
  } catch (e) { console.warn("Save failed", e); }
}

/* ============================================================
   4. DERIVE — stats + active effects + dashboard
   ============================================================ */
function derive() {
  const abilityBonuses = {};
  character.perks.forEach(p => {
    if (p.type === "abilityImprovement" && p.choice) {
      abilityBonuses[p.choice] = (abilityBonuses[p.choice] || 0) + 1;
    }
  });
  const mods = {};
  ABILITIES.forEach(a => mods[a] = mod(character.abilities[a] + (abilityBonuses[a] || 0)));
  const level = Number(character.level) || 1;
  const pb = pbForLevel(level);

  // Gather every active source of effects.
  const sources = collectActiveSources();

  // Base derived stats
  const d = {
    maxHp: 10 + mods.con,
    ac: 10 + mods.dex,
    speed: 30,
    initiative: mods.dex,
    pb,
    resolve: resolveForLevel(level),
    flags: {},
  };

  const ctx = { mods, pb, level, character };

  // Apply stat + flag contributions
  sources.forEach(s => {
    if (typeof s.stat === "function") s.stat(d, ctx);
    if (s.flags) Object.assign(d.flags, s.flags);
  });

  // Worn armor's AC bonus
  if (character.armor) d.ac += Number(character.armor.acBonus) || 0;

  d.maneuverDC = 8 + pb + Math.max(mods.str, mods.dex);

  // AP economy
  const apTotal = AP_BY_LEVEL[level] || 2;
  let apSpent = 0;
  Object.keys(character.unlocked).forEach(tid => {
    const tree = GAME_DATA.skillTrees[tid];
    const lvlUnlocked = character.unlocked[tid];
    if (tree && lvlUnlocked) for (let i = 0; i < lvlUnlocked; i++) apSpent += tree.tiers[i].cost;
  });
  d.apTotal = apTotal;
  d.apSpent = apSpent;
  d.apAvailable = apTotal - apSpent;

  // Build dashboard from all sources' dash entries + dynamic (inventory/weapon) actions
  d.dashboard = buildDashboard(sources, d);

  // ---- Resolve pool (level/4 rounded down + 1: 1 @ lvl1-4, 2 @ 5-8, 3 @ 9-10) ----
  d.resolveMax = d.resolve;
  if (character.resolveCurrent == null || character.resolveCurrent > d.resolveMax) {
    character.resolveCurrent = d.resolveMax;
  }
  d.resolveCurrent = character.resolveCurrent;

  // ---- Proficiencies for the Rolls page ----
  d.mods = mods;
  const bg = GAME_DATA.backgrounds[character.background];
  const allPerks = (bg ? bg.perks : []).concat(character.perks);
  const profSkills = new Set(allPerks.filter(p => p.type === "skill").map(p => p.choice));
  const profSaveAbility = (allPerks.find(p => p.type === "steel") || {}).choice;
  const profSaveKey = profSaveAbility ? profSaveAbility.replace(" Saves", "").toLowerCase() : null;

  d.saves = {};
  ABILITIES.forEach(a => { d.saves[a] = mods[a] + (a === profSaveKey ? pb : 0); });

  d.skills = {};
  Object.keys(SKILL_ABILITY).forEach(skill => {
    const a = SKILL_ABILITY[skill];
    d.skills[skill] = { ability: a, mod: mods[a] + (profSkills.has(skill) ? pb : 0), proficient: profSkills.has(skill) };
  });

  return d;
}

/* Returns a flat list of active effect-bearing objects:
   - background backgroundPerk
   - chosen survivor perks (with their menu definition)
   - each unlocked skill tier                                                 */
function collectActiveSources() {
  const out = [];

  const bg = GAME_DATA.backgrounds[character.background];
  if (bg) out.push(Object.assign({ _srcLabel: bg.name }, bg.backgroundPerk));

  // Survivor perks (only ones with dash/stat/flags matter for effects)
  character.perks.forEach(p => {
    const def = GAME_DATA.survivorPerks[p.type];
    if (!def) return;
    if (def.dash || def.stat || def.flags) {
      out.push({ _srcLabel: def.label, dash: def.dash, stat: def.stat, flags: def.flags });
    }
  });

  // Unlocked skill tiers
  Object.keys(character.unlocked).forEach(tid => {
    const tree = GAME_DATA.skillTrees[tid];
    const n = character.unlocked[tid];
    if (!tree || !n) return;
    for (let i = 0; i < n; i++) {
      const tier = tree.tiers[i];
      out.push(Object.assign({ _srcLabel: tree.name, _tier: i }, tier));
    }
  });

  return out;
}

function buildDashboard(sources, d) {
  const board = { action: [], bonus: [], reaction: [], passive: [] };
  const push = (cat, name, desc, src) => board[cat].push({ name, desc, src });

  // ---- Baseline universal options (always available) ----
  push(CAT.ACTION, "Attack", "Make one weapon attack (see your Weapons for damage, bonuses & ammo).", "Core");
  push(CAT.ACTION, "Dash", "Double your movement speed this turn.", "Core");
  push(CAT.ACTION, "Disengage", "Move without provoking opportunity attacks.", "Core");
  push(CAT.ACTION, "Hide", "Make a Stealth check to become Hidden (needs cover/concealment).", "Core");
  push(CAT.REACT, "Opportunity Attack", "Melee attack a creature that leaves your reach.", "Core");

  // ---- Crafting action (action by default, bonus with Fast Hands) ----
  if (d.flags.craftAsBonus) {
    // handled by the Fast Hands dash entry already; also keep an action option
    push(CAT.ACTION, "Craft Item", "Craft a basic item from materials (or use Fast Hands as a bonus action).", "Core");
  } else {
    push(CAT.ACTION, "Craft Item", "Craft a basic item from materials (no enemies within 10 ft).", "Core");
  }

  // ---- Inventory-driven actions ----
  const inv = character.inventory;
  const healCat = d.flags.healAsBonus ? CAT.BONUS : CAT.ACTION;
  if ((inv.bandage || 0) > 0) push(healCat, "Use Bandage", `Heal 1d4 + CON. (${inv.bandage} carried)`, "Backpack");
  if ((inv.medkit || 0) > 0) push(healCat, "Use Medkit", `Heal 2d6 + CON per use. (${inv.medkit} carried)`, "Backpack");
  if ((inv.molotov || 0) > 0) push(CAT.ACTION, "Throw Molotov", `1d10 fire; DC 15 DEX save vs catching fire. (${inv.molotov} carried)`, "Backpack");
  if ((inv.shiv || 0) > 0) push(CAT.ACTION, "Use Shiv", `Instant kill vs Unaware (max HP ≤ 30); else DC 15 CON or die. (${inv.shiv} carried)`, "Backpack");

  // ---- All dash entries from sources ----
  sources.forEach(s => {
    if (!s.dash) return;
    s.dash.forEach(entry => push(entry.cat, entry.name, entry.desc, s._srcLabel || "Perk"));
  });

  // De-duplicate by name within a category (e.g. Chain Fighter overriding Iron Fist text stays separate; identical entries merge)
  Object.keys(board).forEach(cat => {
    const seen = new Set();
    board[cat] = board[cat].filter(e => {
      const key = e.name + "|" + e.desc;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  });

  return board;
}

/* Active bonuses on a given weapon (from background + tiers' weapon effects) */
function weaponBonuses(weapon) {
  const out = [];
  collectActiveSources().forEach(s => {
    if (s.weapon && s.weapon.match(weapon)) {
      out.push({ name: s.weapon.name, desc: s.weapon.desc });
    }
  });
  return out;
}

/* Weapon category -> Weapon Training choice that grants proficiency */
const WEAPON_PROF_MAP = { blunt: "Blunt Melee", improvised: "Improvised", handgun: "Handguns", rifle: "Rifles", shotgun: "Shotguns", bow: "Bows" };
function weaponProficient(w) {
  const bg = GAME_DATA.backgrounds[character.background];
  const allPerks = (bg ? bg.perks : []).concat(character.perks);
  const need = WEAPON_PROF_MAP[w.category];
  return !!need && allPerks.some(p => p.type === "weapon" && p.choice === need);
}
/* Ability used for a weapon's attack roll */
function weaponAbility(w) {
  return (w.category === "blunt" || w.category === "improvised" || w.category === "melee") ? "str" : "dex";
}
function weaponToHitMod(w) {
  return D.mods[weaponAbility(w)] + (weaponProficient(w) ? D.pb : 0);
}

/* Ammo type -> backpack inventory id */
function ammoInvId(w) {
  if (w.category === "handgun") return "handgunAmmo";
  if (w.category === "bow") return "arrows";
  if (w.category === "rifle") return "longGunAmmo";
  if (w.category === "shotgun") return "shotgunAmmo";
  return null;
}

/* ============================================================
   4b. DICE & ROLLING
   ============================================================ */
function rollDie(sides) { return 1 + Math.floor(Math.random() * sides); }

/* Parse a dice/modifier expression like "2d8 + 3" or "1d20 + STR".
   Ability tokens (STR/DEX/...) are replaced with the character's modifier. */
function parseFormula(expr) {
  let str = String(expr || "").toUpperCase();
  ABILITIES.forEach(a => {
    const re = new RegExp("\\b" + a.toUpperCase() + "\\b", "g");
    str = str.replace(re, (D.mods[a] >= 0 ? "+" : "") + D.mods[a]);
  });
  const parts = [];
  const re = /([+-]?\s*\d*d\d+)|([+-]?\s*\d+)/gi;
  let m;
  while ((m = re.exec(str))) {
    const tok = m[0].replace(/\s+/g, "");
    if (!tok) continue;
    if (/d/i.test(tok)) {
      let sign = 1, t = tok;
      if (t[0] === "+") t = t.slice(1);
      else if (t[0] === "-") { sign = -1; t = t.slice(1); }
      const [nStr, sidesStr] = t.split(/d/i);
      const n = nStr === "" ? 1 : parseInt(nStr, 10);
      const sides = parseInt(sidesStr, 10);
      parts.push({ type: "dice", n, sides, sign });
    } else {
      parts.push({ type: "flat", value: parseInt(tok, 10) });
    }
  }
  return parts;
}

function rollFormula(parts) {
  let total = 0;
  const detail = [];
  parts.forEach(p => {
    if (p.type === "dice") {
      const rolls = [];
      for (let i = 0; i < p.n; i++) rolls.push(rollDie(p.sides));
      const sum = rolls.reduce((a, b) => a + b, 0) * p.sign;
      total += sum;
      detail.push(`${p.sign < 0 ? "-" : ""}${p.n}d${p.sides} [${rolls.join(", ")}]`);
    } else {
      total += p.value;
      if (p.value !== 0) detail.push(fmtMod(p.value));
    }
  });
  return { total, detail: detail.join(" ") || "0" };
}

let rollLogTimer = 0;
function addRollLog(title, detail, total, natType) {
  const log = document.getElementById("roll-log");
  const entry = document.createElement("div");
  entry.className = "roll-entry" + (natType ? ` ${natType}` : "");
  const banner = natType === "nat20" ? `<div class="re-nat">★ NATURAL 20! ★</div>`
    : natType === "nat1" ? `<div class="re-nat">NATURAL 1...</div>` : "";
  entry.innerHTML = `${banner}<div class="re-title">${esc(title)}<span class="re-total">${total}</span></div><div class="re-detail">${esc(detail)}</div>`;
  log.appendChild(entry);
  while (log.children.length > 5) log.removeChild(log.firstChild);
  setTimeout(() => entry.remove(), natType ? 12000 : 8000);
}

/* Roll a formula string (e.g. weapon damage "2d8 + DEX") and log it */
function rollDamage(formula, label) {
  const parts = parseFormula(formula);
  if (!parts.length) { toast("Nothing to roll."); return; }
  const { total, detail } = rollFormula(parts);
  addRollLog(label, detail, total);
}

/* Roll d20 + a flat modifier and log it */
function rollD20(modifier, label) {
  const die = rollDie(20);
  const total = die + modifier;
  const natType = die === 20 ? "nat20" : die === 1 ? "nat1" : null;
  addRollLog(label, `d20 [${die}] ${fmtMod(modifier)}`, total, natType);
}

/* ============================================================
   5. RENDER
   ============================================================ */
let D = derive();  // cached derived snapshot, refreshed in renderAll()

function renderAll() {
  D = derive();
  renderSummary();
  renderCharacterTab();
  renderActionsDashboard();
  renderPerks();
  renderProficiencies();
  renderStatuses();
  renderWeapons();
  renderBackpack();
  renderSkillTrees();
  renderRollsTab();
  renderNotes();
}

/* ---- Summary bar ---- */
function renderSummary() {
  document.getElementById("summary-name").value = character.name;
  document.getElementById("summary-level").textContent = character.level;
  const bg = GAME_DATA.backgrounds[character.background];
  document.getElementById("summary-bg").textContent = bg ? `${bg.icon} ${bg.name}` : "No Background";

  const hpVal = `${character.currentHP}/${D.maxHp}` + (character.tempHP > 0 ? ` +${character.tempHP}` : "");
  const stats = [
    { lbl: "HP", val: hpVal, cls: "hp" },
    { lbl: "AC", val: D.ac },
    { lbl: "Init", val: fmtMod(D.initiative) + (D.flags.initAdvantage ? "▲" : "") },
    { lbl: "Prof", val: fmtMod(D.pb) },
    { lbl: "Speed", val: D.speed + "ft" },
    { lbl: "AP", val: D.apAvailable, cls: "ap" },
    { lbl: "Resolve", val: `${D.resolveCurrent}/${D.resolveMax}`, cls: "ap resolve-pill", id: "summary-resolve" },
    { lbl: "Mnvr DC", val: D.maneuverDC },
  ];
  document.getElementById("summary-stats").innerHTML = stats.map(s =>
    `<div class="stat-pill ${s.cls || ""}" ${s.id ? `id="${s.id}"` : ""}><span class="sp-val">${s.val}</span><span class="sp-lbl">${s.lbl}</span></div>`
  ).join("");

  // Status chips
  const statusEl = document.getElementById("summary-status");
  if (character.statuses.length) {
    statusEl.innerHTML = character.statuses.map(s => `<span class="chip ${statusCls(s)}">${esc(s)}</span>`).join("");
  } else {
    statusEl.innerHTML = `<span class="chip empty">None</span>`;
  }

  // Perks chips (background fixed + chosen)
  const perkChips = [];
  if (bg) bg.perks.forEach(p => perkChips.push(perkLabel(p)));
  character.perks.forEach(p => perkChips.push(perkLabel(p)));
  document.getElementById("summary-perks").innerHTML = perkChips.length
    ? perkChips.map(t => `<span class="chip green">${esc(t)}</span>`).join("")
    : `<span class="chip empty">None</span>`;
}

function statusCls(s) {
  const found = GAME_DATA.statusPresets.find(p => p.label === s);
  return found ? found.cls : "";
}
function perkLabel(p) {
  const def = GAME_DATA.survivorPerks[p.type];
  const lbl = def ? def.label : p.type;
  return p.choice ? `${lbl}: ${p.choice}` : lbl;
}

/* ---- Character tab ---- */
function renderCharacterTab() {
  // selects
  const bgSel = document.getElementById("char-background");
  if (!bgSel.dataset.built) {
    bgSel.innerHTML = `<option value="">— Choose Background —</option>` +
      Object.values(GAME_DATA.backgrounds).map(b => `<option value="${b.id}">${b.icon} ${b.name}</option>`).join("");
    bgSel.dataset.built = "1";
  }
  bgSel.value = character.background;

  const lvlSel = document.getElementById("char-level");
  if (!lvlSel.dataset.built) {
    lvlSel.innerHTML = Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">Level ${i + 1}</option>`).join("");
    lvlSel.dataset.built = "1";
  }
  lvlSel.value = character.level;

  document.getElementById("char-name").value = character.name;

  // background callout
  const callout = document.getElementById("background-perk-callout");
  const bg = GAME_DATA.backgrounds[character.background];
  if (bg) {
    callout.classList.remove("empty");
    callout.innerHTML = `<strong>${bg.icon} ${bg.name}</strong> — <em>${bg.flavor}</em><br>
      <strong>${bg.backgroundPerk.name}:</strong> ${bg.backgroundPerk.dash ? bg.backgroundPerk.dash[0].desc : ""}`;
  } else {
    callout.classList.add("empty");
    callout.innerHTML = "";
  }

  // HP
  document.getElementById("hp-current").textContent = character.currentHP;
  document.getElementById("hp-max").textContent = D.maxHp;
  const pct = Math.max(0, Math.min(100, (character.currentHP / D.maxHp) * 100));
  const fill = document.getElementById("hp-bar-fill");
  fill.style.width = pct + "%";
  fill.className = "hp-bar-fill" + (pct <= 25 ? " crit" : pct <= 50 ? " low" : "");

  // Temp HP
  document.getElementById("temp-hp-val").textContent = character.tempHP || 0;

  // Death saves
  renderDeathSaves();

  // derived stat cards
  const cards = [
    { lbl: "Armor Class", val: D.ac, accent: true },
    { lbl: "Initiative", val: fmtMod(D.initiative) + (D.flags.initAdvantage ? " ▲" : ""), accent: true },
    { lbl: "Proficiency", val: fmtMod(D.pb) },
    { lbl: "Movement", val: D.speed + " ft" },
    { lbl: "Available AP", val: D.apAvailable, accent: true },
    { lbl: "Resolve", val: `${D.resolveCurrent} / ${D.resolveMax}`, id: "char-resolve-card", cls: "resolve-pill", title: "Click to spend, right-click to restore" },
    { lbl: "Maneuver DC", val: D.maneuverDC },
    { lbl: "Max HP", val: D.maxHp },
  ];
  document.getElementById("char-stat-grid").innerHTML = cards.map(c =>
    `<div class="stat-card ${c.accent ? "accent" : ""} ${c.cls || ""}" ${c.id ? `id="${c.id}"` : ""} ${c.title ? `title="${esc(c.title)}"` : ""}><div class="sc-val">${c.val}</div><div class="sc-lbl">${c.lbl}</div></div>`
  ).join("");

  // ability scores
  document.getElementById("ability-grid").innerHTML = ABILITIES.map(a => {
    const m = mod(character.abilities[a]);
    return `<div class="ability-card">
      <div class="ab-name">${ABILITY_NAMES[a]}</div>
      <div class="ab-mod rollable" data-roll-ability="${a}" title="Roll d20 ${fmtMod(m)}">${fmtMod(m)}</div>
      <input type="number" min="1" max="20" value="${character.abilities[a]}" data-ability="${a}" />
    </div>`;
  }).join("");
}

function renderDeathSaves() {
  const block = document.getElementById("death-save-block");
  if (character.currentHP > 0) {
    block.hidden = true;
    return;
  }
  if (!character.deathSaves) character.deathSaves = { success: 0, fail: 0 };
  const ds = character.deathSaves;
  block.hidden = false;
  let status = "Downed";
  if (ds.fail >= 3) status = "Dead";
  else if (ds.success >= 3) status = "Stable";
  document.getElementById("ds-status").textContent = status;
  document.getElementById("ds-success-pips").innerHTML =
    Array.from({ length: 3 }, (_, i) => `<span class="ds-pip success ${i < ds.success ? "filled" : ""}"></span>`).join("");
  document.getElementById("ds-fail-pips").innerHTML =
    Array.from({ length: 3 }, (_, i) => `<span class="ds-pip fail ${i < ds.fail ? "filled" : ""}"></span>`).join("");
  const rollBtn = document.getElementById("ds-roll-btn");
  rollBtn.hidden = (status !== "Downed");
}

/* ---- Actions dashboard ---- */
function renderActionsDashboard() {
  const cols = [
    { key: "action", cls: "act", icon: "attack", label: "Actions" },
    { key: "bonus", cls: "bonus", icon: "icon-ap", label: "Bonus Actions" },
    { key: "reaction", cls: "react", icon: "icon-ac", label: "Reactions" },
    { key: "passive", cls: "pass", icon: "icon-resolve-pb", label: "Passive Effects" },
  ];
  document.getElementById("actions-dashboard").innerHTML = cols.map(col => {
    const list = D.dashboard[col.key] || [];
    const body = list.length
      ? list.map(e => `<div class="ability">
            <div class="ab-top"><span class="ab-title">${esc(e.name)}</span><span class="ab-src">${esc(e.src)}</span></div>
            <div class="ab-desc">${esc(e.desc)}</div>
          </div>`).join("")
      : `<div class="empty-note">Nothing yet — invest in trees, perks &amp; gear.</div>`;
    return `<div class="action-col ${col.cls}">
        <div class="action-col-head">${icon(col.icon)} ${col.label}<span class="count">${list.length}</span></div>
        <div class="action-col-body">${body}</div>
      </div>`;
  }).join("");
}

/* ---- Survivor Perks ---- */
function renderPerks() {
  const list = document.getElementById("perks-list");
  const bg = GAME_DATA.backgrounds[character.background];
  let html = "";

  if (bg) {
    bg.perks.forEach(p => {
      const def = GAME_DATA.survivorPerks[p.type];
      html += `<div class="perk-card fixed">
        <div><div class="pk-name">${esc(perkLabel(p))}</div>
        <div class="pk-desc">${esc(def ? def.effect(p.choice) : "")}</div>
        <div class="pk-tag">From ${esc(bg.name)} background</div></div>
      </div>`;
    });
  }
  character.perks.forEach((p, idx) => {
    const def = GAME_DATA.survivorPerks[p.type];
    html += `<div class="perk-card">
      <div><div class="pk-name">${esc(perkLabel(p))}</div>
      <div class="pk-desc">${esc(def ? def.effect(p.choice) : "")}</div>
      <div class="pk-tag">Chosen perk</div></div>
      <button class="icon-btn" data-remove-perk="${idx}" title="Remove">✕</button>
    </div>`;
  });
  if (!html) html = `<div class="prof-empty">No perks yet. Choose a background and add survivor perks below.</div>`;
  list.innerHTML = html;

  // Adder
  const adder = document.getElementById("perk-adder");
  const opts = Object.values(GAME_DATA.survivorPerks).map(d => `<option value="${d.type}">${d.label}</option>`).join("");
  adder.innerHTML = `
    <label class="field"><span class="field-label">Add Survivor Perk</span>
      <select id="perk-type">${opts}</select></label>
    <label class="field" id="perk-choice-wrap"><span class="field-label">Choice</span>
      <select id="perk-choice"></select></label>
    <button class="btn accent" id="perk-add-btn">+ Add</button>`;
  updatePerkChoiceField();
  document.getElementById("perk-type").addEventListener("change", updatePerkChoiceField);
  document.getElementById("perk-add-btn").addEventListener("click", addPerk);
}

function updatePerkChoiceField() {
  const type = document.getElementById("perk-type").value;
  const def = GAME_DATA.survivorPerks[type];
  const wrap = document.getElementById("perk-choice-wrap");
  const sel = document.getElementById("perk-choice");
  if (def && def.needsChoice) {
    wrap.style.display = "";
    sel.innerHTML = def.choices.map(c => `<option value="${c}">${ABILITY_NAMES[c] || c}</option>`).join("");
  } else {
    wrap.style.display = "none";
    sel.innerHTML = "";
  }
}

function addPerk() {
  const type = document.getElementById("perk-type").value;
  const def = GAME_DATA.survivorPerks[type];
  const choice = def.needsChoice ? document.getElementById("perk-choice").value : null;

  // enforce limits
  const count = character.perks.filter(p => p.type === type).length;
  if (def.max && count >= def.max) { toast(`${def.label}: max ${def.max} reached.`); return; }
  if (!def.repeatable && !def.max && count >= 1) { toast(`${def.label} already taken.`); return; }
  // avoid duplicate specific choice (abilityImprovement may be taken twice with the
  // same ability — each is a separate +1 entry — so skip this check for it)
  if (type !== "abilityImprovement" && choice && character.perks.some(p => p.type === type && p.choice === choice)) {
    toast(`Already have ${def.label}: ${choice}.`); return;
  }

  character.perks.push({ type, choice });
  save(); renderAll();
  toast(`Added ${perkLabel({ type, choice })}`);
}

/* ---- Proficiencies ---- */
function renderProficiencies() {
  const bg = GAME_DATA.backgrounds[character.background];
  const groups = {
    "Weapon Training": [],
    "Cross-Training": [],
    "Saving Throw Proficiencies": [],
    "Hazard Resistances": [],
  };
  const add = (type, p) => {
    const def = GAME_DATA.survivorPerks[type];
    if (!def) return;
    const entry = { name: perkLabel(p), eff: def.effect(p.choice) };
    if (type === "weapon") groups["Weapon Training"].push(entry);
    else if (type === "skill") groups["Cross-Training"].push(entry);
    else if (type === "steel") groups["Saving Throw Proficiencies"].push(entry);
    else if (type === "acclimated") groups["Hazard Resistances"].push(entry);
    else if (type === "lightfeet") {/* movement, not a proficiency */}
  };

  if (bg) bg.perks.forEach(p => add(p.type, p));
  character.perks.forEach(p => add(p.type, p));

  const order = ["Weapon Training", "Cross-Training", "Saving Throw Proficiencies", "Hazard Resistances"];
  document.getElementById("proficiencies").innerHTML = order.map(g => {
    const items = groups[g];
    const body = items.length
      ? items.map(it => `<div class="prof-item"><div class="pi-name">${esc(it.name)}</div><div class="pi-eff">${esc(it.eff)}</div></div>`).join("")
      : `<div class="prof-empty">None yet.</div>`;
    return `<div class="prof-group"><h3>${g}</h3>${body}</div>`;
  }).join("");
}

/* ---- Status effects ---- */
function renderStatuses() {
  const el = document.getElementById("status-active");
  el.innerHTML = character.statuses.length
    ? character.statuses.map((s, i) => `<span class="chip ${statusCls(s)}" data-remove-status="${i}">${esc(s)}<span class="x">✕</span></span>`).join("")
    : `<span class="chip empty">No active status effects</span>`;

  const adder = document.getElementById("status-adder");
  adder.innerHTML = GAME_DATA.statusPresets
    .filter(p => !character.statuses.includes(p.label))
    .map(p => `<button class="status-preset" data-add-status="${esc(p.label)}">+ ${esc(p.label)}</button>`).join("")
    + `<button class="status-preset" id="status-custom">+ Custom…</button>`;
}

/* ---- Weapons ---- */
function renderWeapons() {
  const grid = document.getElementById("weapons-grid");
  if (!character.weapons.length) {
    grid.innerHTML = `<div class="empty-state">No weapons yet. Tap “+ Add Weapon” to arm up.</div>`;
    return;
  }
  grid.innerHTML = character.weapons.map(w => {
    const bonuses = weaponBonuses(w);
    const hasAmmo = w.maxAmmo > 0 || (w.ammoType && w.ammoType.trim());
    const effectiveSound = w.silenced ? "Quiet" : (w.sound || "");
    const soundCls = "sound " + effectiveSound.toLowerCase().replace(/\s+/g, "");
    const canSilence = w.maxAmmo > 0 && w.category !== "rifle" && w.category !== "shotgun"; // handguns/bows only
    const haveSilencer = (character.inventory.silencer || 0) > 0;
    return `<div class="weapon-card cat-${w.category}">
      <div class="weapon-head">
        <div><div class="weapon-name">${esc(w.name || "Unnamed")}</div>
          <div class="weapon-type">${WEAPON_TYPE_LABEL[w.category] || w.category}</div></div>
        <div class="weapon-actions">
          <button class="icon-btn" data-edit-weapon="${w.id}" title="Edit">✎</button>
          <button class="icon-btn" data-del-weapon="${w.id}" title="Remove">✕</button>
        </div>
      </div>

      <div class="weapon-rolls">
        <button class="attack-roll-btn" data-roll-attack="${w.id}">${icon("attack")} Attack ${fmtMod(weaponToHitMod(w))}</button>
      </div>

      <div class="weapon-stats">
        <div class="wstat"><div class="ws-lbl">Damage</div><div class="ws-val rollable" data-roll-damage="${w.id}" title="Click to roll">${esc(w.damage || "—")}</div></div>
        <div class="wstat"><div class="ws-lbl">Range</div><div class="ws-val">${esc(w.range || "—")}</div></div>
        <div class="wstat ${soundCls}"><div class="ws-lbl">Sound</div><div class="ws-val">${esc(effectiveSound || "—")}</div></div>
        <div class="wstat"><div class="ws-lbl">Ammo Type</div><div class="ws-val">${esc(w.ammoType || "—")}</div></div>
      </div>

      ${canSilence ? `
        <div class="silencer-row">
          <button class="silencer-btn ${w.silenced ? "on" : ""}" data-toggle-silencer="${w.id}" ${(!w.silenced && !haveSilencer) ? "disabled" : ""}>
            ${icon("inv-silencer")} ${w.silenced ? "Remove Silencer" : "Attach Silencer"}
          </button>
          ${!w.silenced && !haveSilencer ? `<span class="silencer-hint">Need a Silencer in your backpack</span>` : ""}
        </div>` : ""}

      <div class="ammo-track ${hasAmmo ? "" : "none"}">
        <div class="ammo-top">
          <span class="ammo-label">Current Ammo</span>
          <span class="ammo-count"><span class="cur">${w.currentAmmo || 0}</span><span class="max"> / ${w.maxAmmo || 0}</span></span>
        </div>
        <div class="ammo-controls">
          <button class="ammo-btn minus" data-ammo="${w.id}:-1">−</button>
          <button class="ammo-btn plus" data-ammo="${w.id}:1">＋</button>
          <button class="ammo-btn reload" data-ammo="${w.id}:reload">RELOAD</button>
        </div>
      </div>

      ${w.upgrades && w.upgrades.length ? `
        <div class="weapon-section-label">Upgrades</div>
        <div class="upgrade-chips">${w.upgrades.map(u => `<span class="chip warn">${esc(u)}</span>`).join("")}</div>` : ""}

      ${bonuses.length ? `
        <div class="weapon-section-label">Active Bonuses</div>
        <div class="bonus-list">${bonuses.map(b => `<div class="bonus-item"><div class="bi-name">${esc(b.name)}</div><div class="bi-desc">${esc(b.desc)}</div></div>`).join("")}</div>` : ""}

      ${w.notes ? `<div class="weapon-notes">${esc(w.notes)}</div>` : ""}
    </div>`;
  }).join("");
}

/* ---- Backpack ---- */
const GENERAL_SLOTS = 12;
const MAX_HOLSTERS = 2;
const MAX_WEAPON_SLOTS = 3;
const HOLSTER_CATS = ["handgun"];
const WEAPON_SLOT_CATS = ["rifle", "shotgun", "bow", "blunt", "melee", "improvised"];

function ensureEquipArrays() {
  if (!Array.isArray(character.weaponSlots)) character.weaponSlots = [null];
  if (!Array.isArray(character.holsters)) character.holsters = [null];
}

function equipSlotHtml(group, idx, wid, cats, iconName, labelWord) {
  const w = character.weapons.find(x => x.id === wid);
  const choices = character.weapons.filter(x => cats.includes(x.category));
  const opts = [`<option value="">— Empty —</option>`]
    .concat(choices.map(x => `<option value="${x.id}" ${x.id === wid ? "selected" : ""}>${esc(x.name || "Unnamed")}</option>`));
  return `<div class="equip-slot ${w ? "filled" : ""}">
    <div class="es-label">${icon(iconName)} ${labelWord} ${idx + 1}
      <button class="es-remove" data-remove-slot="${group}:${idx}" title="Remove slot">✕</button></div>
    <select data-equip-slot="${group}:${idx}">${opts.join("")}</select>
  </div>`;
}

function renderEquipSlots() {
  ensureEquipArrays();
  const root = document.getElementById("equip-slots");
  let html = "";
  character.weaponSlots.forEach((wid, i) => { html += equipSlotHtml("weapon", i, wid, WEAPON_SLOT_CATS, "slot-weapon", "Weapon Slot"); });
  if (character.weaponSlots.length < MAX_WEAPON_SLOTS)
    html += `<button class="add-slot-btn" data-add-slot="weapon">${icon("slot-weapon")} + Add Weapon Slot</button>`;
  character.holsters.forEach((wid, i) => { html += equipSlotHtml("holster", i, wid, HOLSTER_CATS, "slot-holster", "Holster"); });
  if (character.holsters.length < MAX_HOLSTERS)
    html += `<button class="add-slot-btn" data-add-slot="holster">${icon("slot-holster")} + Add Holster</button>`;

  if (character.armor) {
    const a = character.armor;
    html += `<div class="equip-slot filled">
      <div class="es-label">${icon("slot-holster")} Armor
        <button class="es-remove" data-remove-armor title="Remove armor">✕</button></div>
      <div class="es-armor-name">${esc(a.type || "Armor")} (AC ${a.acBonus >= 0 ? "+" : ""}${a.acBonus || 0})</div>
      ${a.other ? `<div class="es-armor-other">${esc(a.other)}</div>` : ""}
    </div>`;
  } else {
    html += `<button class="add-slot-btn" data-add-slot="armor">${icon("slot-holster")} + Add Armor</button>`;
  }
  root.innerHTML = html;
}

function renderBackpack() {
  renderEquipSlots();

  const stack3 = !!(D && D.flags && D.flags.craftedStack3);
  const filledItems = GAME_DATA.inventory.flatMap(g => g.items).filter(it => (character.inventory[it.id] || 0) > 0);
  // Build one slot per stack (items overflow into additional slots when over their stack max).
  const cells = [];
  filledItems.forEach(it => {
    let remaining = character.inventory[it.id] || 0;
    const max = stackMax(it, stack3);
    while (remaining > 0) {
      const inThis = Math.min(max, remaining);
      remaining -= inThis;
      cells.push(`<div class="gen-slot filled" data-item-info="${it.id}">
        <span class="gs-icon">${icon(it.icon)}</span>
        <div class="gs-name">${esc(it.name)}</div>
        <div class="gs-qty">${inThis}/${max}</div>
      </div>`);
    }
  });
  const usedSlots = cells.length;
  while (cells.length < GENERAL_SLOTS) cells.push(`<div class="gen-slot"></div>`);
  document.getElementById("general-slots").innerHTML = cells.slice(0, GENERAL_SLOTS).join("");

  const root = document.getElementById("backpack");
  root.innerHTML = GAME_DATA.inventory.map(group => {
    const items = group.items.map(it => {
      const qty = character.inventory[it.id] || 0;
      return `<div class="inv-item ${qty > 0 ? "has-qty" : "zero"}" data-item-info="${it.id}">
        <span class="inv-icon">${icon(it.icon)}</span>
        <div class="inv-name">${esc(it.name)}</div>
        <div class="inv-qty">${qty}</div>
        <div class="inv-controls">
          <button class="inv-btn minus" data-inv="${it.id}:-1">−</button>
          <button class="inv-btn plus" data-inv="${it.id}:1">＋</button>
        </div>
        ${it.recipe ? `<div class="inv-recipe">${esc(it.recipe)}</div>` : ""}
      </div>`;
    }).join("");
    return `<div class="inv-cat">
      <div class="inv-cat-head"><span class="ic-icon">${groupIcon(group.group)}</span><h3>${esc(group.group)}</h3></div>
      <div class="inv-grid">${items}</div>
    </div>`;
  }).join("");

  document.getElementById("slot-counter").textContent = `Slots used: ${Math.min(usedSlots, GENERAL_SLOTS)} / ${GENERAL_SLOTS}`;

  renderCustomItems();
  renderCrafting();
}

/* Custom items */
function renderCustomItems() {
  const root = document.getElementById("custom-items");
  if (!Array.isArray(character.customItems)) character.customItems = [];
  root.innerHTML = character.customItems.map(it => `
    <div class="inv-item has-qty" data-item-info="${esc(it.id)}">
      <div class="inv-name">${esc(it.name)}</div>
      <div class="inv-qty">${it.qty}</div>
      <div class="inv-controls">
        <button class="inv-btn minus" data-custom-qty="${esc(it.id)}:-1">−</button>
        <button class="inv-btn plus" data-custom-qty="${esc(it.id)}:1">＋</button>
        <button class="inv-btn" data-custom-del="${esc(it.id)}">✕</button>
      </div>
    </div>`).join("");
}

/* Max stack size per item: materials 5, ammo 10, crafted 2 (3 with Efficient Workflow). */
function stackMax(it, stack3) {
  if (it.craft || it.id === "medkit") return stack3 ? 3 : 2;
  if (/Ammo|arrows/i.test(it.id)) return 10;
  return 5;
}

function groupIcon(name) {
  return icon(name.includes("Crafting") ? "inv-scrap" : name.includes("Ammuni") ? "inv-handgunAmmo" : "inv-medkit");
}

/* ---- Crafting ---- */
function renderCrafting() {
  const root = document.getElementById("crafting");
  const craftables = GAME_DATA.invById ? GAME_DATA.inventory.flatMap(g => g.items).filter(it => it.craft) : [];
  root.innerHTML = craftables.map(it => {
    const have = (id, n) => (character.inventory[id] || 0) >= n;
    const canCraft = Object.entries(it.craft).every(([id, n]) => have(id, n));
    return `<div class="craft-card">
      <div class="cc-name">${icon(it.icon)} ${esc(it.name)}</div>
      <div class="cc-recipe">${esc(it.recipe)}</div>
      <button data-craft="${it.id}" ${canCraft ? "" : "disabled"}>Craft</button>
    </div>`;
  }).join("");
}


/* ---- Skill trees ---- */
function renderSkillTrees() {
  document.getElementById("ap-available").textContent = D.apAvailable;
  document.getElementById("ap-spent").textContent = D.apSpent;
  document.getElementById("ap-total").textContent = D.apTotal;

  // group by category
  const cats = {};
  Object.values(GAME_DATA.skillTrees).forEach(t => { (cats[t.category] = cats[t.category] || []).push(t); });

  const root = document.getElementById("skill-trees");
  let html = "";
  Object.keys(cats).forEach(cat => {
    html += `<div class="tree-category-label" style="grid-column:1/-1">${esc(cat)}</div>`;
    cats[cat].forEach(tree => { html += renderTree(tree); });
  });
  root.innerHTML = html;
}

function renderTree(tree) {
  const unlocked = character.unlocked[tree.id] || 0; // count of tiers unlocked
  const tiers = tree.tiers.map((tier, i) => {
    const isUnlocked = i < unlocked;
    const isNext = i === unlocked;
    const canAfford = D.apAvailable >= tier.cost;
    const available = isNext && canAfford;
    const isHighestUnlocked = isUnlocked && i === unlocked - 1;

    let stateCls, statusText;
    if (isUnlocked) {
      stateCls = "unlocked";
      statusText = isHighestUnlocked ? "✓ Unlocked — tap to refund" : "✓ Unlocked";
    } else if (isNext) {
      stateCls = "locked" + (canAfford ? "" : " unavailable");
      statusText = canAfford ? `Tap to unlock (${tier.cost} AP)` : `Need ${tier.cost} AP`;
    } else {
      stateCls = "locked unavailable";
      statusText = `Requires Tier ${roman(i)}`;
    }

    const roman_ = roman(i + 1);
    const clickable = (isNext && canAfford) || isHighestUnlocked;
    return `<div class="tier ${stateCls}">
      <div class="tier-card" ${clickable ? `data-tier="${tree.id}:${i}"` : ""}>
        <div class="tier-top">
          <span class="tier-name"><span class="tier-roman">${roman_} · </span>${esc(tier.name)}</span>
          <span class="tier-cost">${tier.cost} AP</span>
        </div>
        <div class="tier-desc">${esc(tier.desc)}</div>
        <div class="tier-status">${statusText}</div>
      </div>
    </div>`;
  }).join("");

  return `<div class="tree-card">
    <div class="tree-title">${esc(tree.name)}</div>
    <div class="tree-flavor">${esc(tree.flavor)}</div>
    ${tiers}
  </div>`;
}

function roman(n) { return ["I", "II", "III", "IV"][n - 1] || n; }

/* ---- Notes ---- */
function renderNotes() {
  const root = document.getElementById("notes-list");
  if (!character.notes.length) {
    root.innerHTML = `<div class="empty-state">No notes yet. Track NPCs, safehouses, and objectives here.</div>`;
    return;
  }
  root.innerHTML = character.notes.map(n => `
    <div class="note-card ${n.collapsed ? "collapsed" : ""}" data-note="${n.id}">
      <div class="note-head">
        <span class="note-arrow" data-note-toggle="${n.id}">▾</span>
        <input type="text" value="${esc(n.title)}" placeholder="Note title…" data-note-title="${n.id}" />
        <button class="icon-btn" data-note-del="${n.id}" title="Delete">✕</button>
      </div>
      <div class="note-body">
        <textarea placeholder="Write here…" data-note-body="${n.id}">${esc(n.body)}</textarea>
      </div>
    </div>`).join("");
}

/* ---- Rolls tab ---- */
function renderRollsTab() {
  document.getElementById("roll-abilities").innerHTML = ABILITIES.map(a => `
    <div class="roll-card">
      <div class="rc-name">${ABILITY_NAMES[a]}</div>
      <div class="rc-sub">Ability Check</div>
      <div class="rc-mod" data-roll-d20="${D.mods[a]}" data-roll-label="${esc(ABILITY_NAMES[a])} Check">${fmtMod(D.mods[a])}</div>
    </div>`).join("");

  document.getElementById("roll-saves").innerHTML = ABILITIES.map(a => `
    <div class="roll-card">
      <div class="rc-name">${ABILITY_NAMES[a]}</div>
      <div class="rc-sub">Saving Throw</div>
      <div class="rc-mod" data-roll-d20="${D.saves[a]}" data-roll-label="${esc(ABILITY_NAMES[a])} Save">${fmtMod(D.saves[a])}</div>
    </div>`).join("");

  document.getElementById("roll-skills").innerHTML = Object.keys(SKILL_ABILITY).map(skill => {
    const s = D.skills[skill];
    return `<div class="roll-card">
      <div class="rc-name">${esc(skill)}${s.proficient ? " ★" : ""}</div>
      <div class="rc-sub">${ABILITY_NAMES[s.ability]}</div>
      <div class="rc-mod" data-roll-d20="${s.mod}" data-roll-label="${esc(skill)}">${fmtMod(s.mod)}</div>
    </div>`;
  }).join("");
}

/* ---- Rules reference ---- */
function renderReference() {
  document.getElementById("ref-body").innerHTML = GAME_DATA.keywords.map(k =>
    `<div class="ref-item"><div class="rf-term">${esc(k.term)}</div><div class="rf-def">${esc(k.def)}</div></div>`
  ).join("");
}

/* ============================================================
   6. EVENT HANDLING
   ============================================================ */
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, 1800);
}

/* Tabs */
document.getElementById("tab-nav").addEventListener("click", e => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b === btn));
  const tab = btn.dataset.tab;
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === "tab-" + tab));
  document.body.dataset.activeTab = tab;
  window.scrollTo({ top: 0, behavior: "smooth" });
});

/* Identity inputs */
document.getElementById("char-name").addEventListener("input", e => { character.name = e.target.value; document.getElementById("summary-name").value = e.target.value; save(); });
document.getElementById("summary-name").addEventListener("input", e => { character.name = e.target.value; document.getElementById("char-name").value = e.target.value; save(); });

document.getElementById("char-background").addEventListener("change", e => {
  const newBg = e.target.value;
  const old = character.background;
  character.background = newBg;
  // offer to load starting gear when switching to a real background and arsenal/inv is empty
  if (newBg && newBg !== old) maybeLoadStartingGear(newBg);
  save(); renderAll();
});

document.getElementById("char-level").addEventListener("change", e => {
  character.level = Number(e.target.value);
  save(); renderAll();
});

/* Ability score edits (delegated) */
document.getElementById("ability-grid").addEventListener("input", e => {
  const a = e.target.dataset.ability;
  if (!a) return;
  let v = parseInt(e.target.value, 10);
  if (isNaN(v)) return;
  v = Math.max(1, Math.min(30, v));
  character.abilities[a] = v;
  // keep currentHP within new max
  const newMax = derive().maxHp;
  if (character.currentHP > newMax) character.currentHP = newMax;
  save(); renderAll();
});

/* HP controls */
document.querySelectorAll(".hp-btn[data-hp]").forEach(btn => {
  btn.addEventListener("click", () => {
    const delta = Number(btn.dataset.hp);
    character.currentHP = Math.max(0, Math.min(D.maxHp, character.currentHP + delta));
    if (character.currentHP > 0) character.deathSaves = { success: 0, fail: 0 };
    save(); renderSummary(); renderCharacterTab(); renderActionsDashboard();
  });
});

/* Death saves */
document.getElementById("ds-roll-btn").addEventListener("click", () => {
  if (!character.deathSaves) character.deathSaves = { success: 0, fail: 0 };
  const ds = character.deathSaves;
  const die = rollDie(20);
  const success = die >= 10;
  if (success) ds.success = Math.min(3, ds.success + 1);
  else ds.fail = Math.min(3, ds.fail + 1);
  addRollLog("Death Save", `d20 [${die}] vs DC 10`, die, die === 20 ? "crit" : die === 1 ? "fumble" : null);
  save(); renderCharacterTab();
});
document.getElementById("hp-full").addEventListener("click", () => {
  character.currentHP = D.maxHp; character.deathSaves = { success: 0, fail: 0 }; save(); renderSummary(); renderCharacterTab();
});

/* Temp HP controls */
document.querySelectorAll(".hp-btn[data-temp]").forEach(btn => {
  btn.addEventListener("click", () => {
    const delta = Number(btn.dataset.temp);
    character.tempHP = Math.max(0, (character.tempHP || 0) + delta);
    save(); renderAll();
  });
});
document.getElementById("temp-hp-clear").addEventListener("click", () => {
  character.tempHP = 0; save(); renderAll();
});

/* Resolve: click to spend, shift-click (or right-click) to restore */
document.getElementById("summary-stats").addEventListener("click", e => {
  if (!e.target.closest("#summary-resolve")) return;
  if (character.resolveCurrent > 0) {
    character.resolveCurrent -= 1;
    toast(`Resolve spent (${character.resolveCurrent}/${D.resolveMax})`);
  } else {
    toast("No Resolve remaining.");
  }
  save(); renderAll();
});
document.getElementById("summary-stats").addEventListener("contextmenu", e => {
  if (!e.target.closest("#summary-resolve")) return;
  e.preventDefault();
  if (character.resolveCurrent < D.resolveMax) {
    character.resolveCurrent += 1;
    toast(`Resolve restored (${character.resolveCurrent}/${D.resolveMax})`);
  }
  save(); renderAll();
});

/* Resolve button on the Character tab */
document.getElementById("char-stat-grid").addEventListener("click", e => {
  if (!e.target.closest("#char-resolve-card")) return;
  if (character.resolveCurrent > 0) {
    character.resolveCurrent -= 1;
    toast(`Resolve spent (${character.resolveCurrent}/${D.resolveMax})`);
  } else {
    toast("No Resolve remaining.");
  }
  save(); renderAll();
});
document.getElementById("char-stat-grid").addEventListener("contextmenu", e => {
  if (!e.target.closest("#char-resolve-card")) return;
  e.preventDefault();
  if (character.resolveCurrent < D.resolveMax) {
    character.resolveCurrent += 1;
    toast(`Resolve restored (${character.resolveCurrent}/${D.resolveMax})`);
  }
  save(); renderAll();
});

/* Rests */
document.getElementById("rest-btn").addEventListener("click", e => {
  e.stopPropagation();
  document.getElementById("rest-menu").hidden = !document.getElementById("rest-menu").hidden;
});
document.addEventListener("click", e => {
  const menu = document.getElementById("rest-menu");
  if (!menu.hidden && !e.target.closest("#rest-menu") && !e.target.closest("#rest-btn")) menu.hidden = true;
});
document.getElementById("rest-menu").addEventListener("click", e => {
  const btn = e.target.closest("[data-rest]");
  if (!btn) return;
  const type = btn.dataset.rest;
  if (type === "short") {
    toast("Short Rest: tend wounds, craft, or recover short-rest abilities.");
  } else if (type === "camp") {
    const missing = D.maxHp - character.currentHP;
    character.currentHP = Math.min(D.maxHp, character.currentHP + Math.ceil(missing / 2));
    character.tempHP = 0;
    if (character.currentHP > 0) character.deathSaves = { success: 0, fail: 0 };
    toast("Camp rest taken — half of missing HP restored.");
  } else if (type === "long") {
    character.currentHP = D.maxHp;
    character.tempHP = 0;
    character.resolveCurrent = D.resolveMax;
    character.statuses = [];
    character.deathSaves = { success: 0, fail: 0 };
    toast("Long rest taken — HP, Resolve restored and statuses cleared.");
  }
  document.getElementById("rest-menu").hidden = true;
  save(); renderAll();
});

/* Rolls tab click-to-roll (delegated) */
document.getElementById("tab-rolls").addEventListener("click", e => {
  const el = e.target.closest("[data-roll-d20]");
  if (!el) return;
  rollD20(Number(el.dataset.rollD20), el.dataset.rollLabel);
});

/* Custom dice roller — accepts any formula (e.g. "3d5 + 5d76 + 21", "2d6 + STR"). */
function doCustomRoll() {
  const input = document.getElementById("custom-roll-input");
  const expr = input.value.trim();
  if (!expr) { toast("Enter a dice formula, e.g. 2d6 + 3"); return; }
  const parts = parseFormula(expr);
  if (!parts.length) { toast("Couldn't read that formula."); return; }
  const { total, detail } = rollFormula(parts);
  addRollLog(`Custom: ${expr}`, detail, total);
}
document.getElementById("custom-roll-btn").addEventListener("click", doCustomRoll);
document.getElementById("custom-roll-input").addEventListener("keydown", e => {
  if (e.key === "Enter") doCustomRoll();
});

/* Ability score click-to-roll (delegated) */
document.getElementById("ability-grid").addEventListener("click", e => {
  const el = e.target.closest("[data-roll-ability]");
  if (!el) return;
  const a = el.dataset.rollAbility;
  rollD20(D.mods[a], `${ABILITY_NAMES[a]} Check`);
});

/* Perk removal (delegated) */
document.getElementById("perks-list").addEventListener("click", e => {
  const idx = e.target.dataset.removePerk;
  if (idx == null) return;
  character.perks.splice(Number(idx), 1);
  save(); renderAll();
});

/* Status add/remove (delegated) */
document.getElementById("status-active").addEventListener("click", e => {
  const chip = e.target.closest("[data-remove-status]");
  if (!chip) return;
  character.statuses.splice(Number(chip.dataset.removeStatus), 1);
  save(); renderAll();
});
document.getElementById("status-adder").addEventListener("click", e => {
  if (e.target.id === "status-custom") {
    const v = prompt("Custom status effect:");
    if (v && v.trim()) { character.statuses.push(v.trim()); save(); renderAll(); }
    return;
  }
  const label = e.target.dataset.addStatus;
  if (label) { character.statuses.push(label); save(); renderAll(); }
});

/* Weapons: ammo, edit, delete (delegated) */
document.getElementById("weapons-grid").addEventListener("click", e => {
  const atkBtn = e.target.closest("[data-roll-attack]");
  if (atkBtn) {
    const w = character.weapons.find(x => x.id === atkBtn.dataset.rollAttack);
    if (w) rollD20(weaponToHitMod(w), `${w.name || "Weapon"} — Attack`);
    return;
  }
  const dmgBtn = e.target.closest("[data-roll-damage]");
  if (dmgBtn) {
    const w = character.weapons.find(x => x.id === dmgBtn.dataset.rollDamage);
    if (w) rollDamage(w.damage, `${w.name || "Weapon"} — Damage`);
    return;
  }
  const ammoBtn = e.target.closest("[data-ammo]");
  if (ammoBtn) {
    const [id, op] = ammoBtn.dataset.ammo.split(":");
    const w = character.weapons.find(x => x.id === id);
    if (!w) return;
    const invId = ammoInvId(w);
    if (op === "reload") {
      const needed = (w.maxAmmo || 0) - (w.currentAmmo || 0);
      const have = invId ? (character.inventory[invId] || 0) : Infinity;
      const take = Math.max(0, Math.min(needed, have));
      w.currentAmmo = (w.currentAmmo || 0) + take;
      if (invId) character.inventory[invId] = (character.inventory[invId] || 0) - take;
    } else if (op === "1") {
      const have = invId ? (character.inventory[invId] || 0) : Infinity;
      if ((w.currentAmmo || 0) < (w.maxAmmo || 0) && have > 0) {
        w.currentAmmo = (w.currentAmmo || 0) + 1;
        if (invId) character.inventory[invId] -= 1;
      }
    } else if (op === "-1") {
      if ((w.currentAmmo || 0) > 0) {
        w.currentAmmo -= 1;
        if (invId) character.inventory[invId] = (character.inventory[invId] || 0) + 1;
      }
    }
    save(); renderAll();
    return;
  }
  const silBtn = e.target.closest("[data-toggle-silencer]");
  if (silBtn) {
    const w = character.weapons.find(x => x.id === silBtn.dataset.toggleSilencer);
    if (!w) return;
    if (!w.silenced) {
      if ((character.inventory.silencer || 0) <= 0) return;
      character.inventory.silencer -= 1;
      w.silenced = true;
    } else {
      character.inventory.silencer = (character.inventory.silencer || 0) + 1;
      w.silenced = false;
    }
    save(); renderAll();
    return;
  }
  const editBtn = e.target.closest("[data-edit-weapon]");
  if (editBtn) { openWeaponModal(editBtn.dataset.editWeapon); return; }
  const delBtn = e.target.closest("[data-del-weapon]");
  if (delBtn) {
    const w = character.weapons.find(x => x.id === delBtn.dataset.delWeapon);
    if (w) {
      showConfirmModal(`Remove ${w.name || "this weapon"}?`, () => {
        character.weapons = character.weapons.filter(x => x.id !== w.id);
        save(); renderAll();
      });
    }
  }
});

/* Backpack qty / item info (delegated) */
document.getElementById("backpack").addEventListener("click", e => {
  const btn = e.target.closest("[data-inv]");
  if (btn) {
    const [id, delta] = btn.dataset.inv.split(":");
    const cur = character.inventory[id] || 0;
    character.inventory[id] = Math.max(0, cur + Number(delta));
    save(); renderAll();
    return;
  }
  const info = e.target.closest("[data-item-info]");
  if (info) showItemPopup(info.dataset.itemInfo);
});

/* Equip slot selects (delegated) */
document.getElementById("equip-slots").addEventListener("change", e => {
  const sel = e.target.closest("[data-equip-slot]");
  if (!sel) return;
  const [group, idxStr] = sel.dataset.equipSlot.split(":");
  const arr = group === "holster" ? character.holsters : character.weaponSlots;
  arr[Number(idxStr)] = sel.value || null;
  save(); renderAll();
});

/* Add / remove equip slots (delegated) */
document.getElementById("equip-slots").addEventListener("click", e => {
  const addBtn = e.target.closest("[data-add-slot]");
  if (addBtn) {
    ensureEquipArrays();
    if (addBtn.dataset.addSlot === "holster" && character.holsters.length < MAX_HOLSTERS) character.holsters.push(null);
    else if (addBtn.dataset.addSlot === "weapon" && character.weaponSlots.length < MAX_WEAPON_SLOTS) character.weaponSlots.push(null);
    else if (addBtn.dataset.addSlot === "armor") {
      openArmorModal();
      return;
    }
    save(); renderAll();
    return;
  }
  const rmBtn = e.target.closest("[data-remove-slot]");
  if (rmBtn) {
    const [group, idxStr] = rmBtn.dataset.removeSlot.split(":");
    const arr = group === "holster" ? character.holsters : character.weaponSlots;
    arr.splice(Number(idxStr), 1);
    if (arr.length === 0) arr.push(null); // always keep at least one slot
    save(); renderAll();
    return;
  }
  if (e.target.closest("[data-remove-armor]")) {
    character.armor = null;
    character.wearingArmor = false;
    save(); renderAll();
  }
});

/* Crafting (delegated) */
document.getElementById("crafting").addEventListener("click", e => {
  const btn = e.target.closest("[data-craft]");
  if (!btn || btn.disabled) return;
  const id = btn.dataset.craft;
  const item = GAME_DATA.invById[id];
  const have = Object.entries(item.craft).every(([mid, n]) => (character.inventory[mid] || 0) >= n);
  if (!have) return;
  Object.entries(item.craft).forEach(([mid, n]) => { character.inventory[mid] -= n; });
  character.inventory[id] = (character.inventory[id] || 0) + 1;
  save(); renderAll();
  toast(`Crafted ${item.name}`);
});

/* Custom items: add / qty / delete */
document.getElementById("add-custom-item-btn").addEventListener("click", () => {
  const name = prompt("Item name:");
  if (!name) return;
  const desc = prompt("Item description (optional):") || "";
  if (!Array.isArray(character.customItems)) character.customItems = [];
  character.customItems.push({ id: "custom-" + Date.now() + "-" + Math.floor(Math.random() * 10000), name, desc, qty: 1 });
  save(); renderAll();
});
document.getElementById("custom-items").addEventListener("click", e => {
  const qtyBtn = e.target.closest("[data-custom-qty]");
  if (qtyBtn) {
    const [id, delta] = qtyBtn.dataset.customQty.split(":");
    const it = character.customItems.find(i => i.id === id);
    if (it) it.qty = Math.max(0, it.qty + Number(delta));
    save(); renderAll();
    return;
  }
  const delBtn = e.target.closest("[data-custom-del]");
  if (delBtn) {
    character.customItems = character.customItems.filter(i => i.id !== delBtn.dataset.customDel);
    save(); renderAll();
    return;
  }
  const info = e.target.closest("[data-item-info]");
  if (info) showItemPopup(info.dataset.itemInfo);
});

/* ============================================================
   GENERIC MODAL SYSTEM
   ============================================================ */
function showModal(contentHtml) {
  const overlay = document.getElementById("modal-overlay");
  const box = document.getElementById("modal-box");
  box.innerHTML = contentHtml;
  overlay.classList.remove("hidden");
}
function hideModal() {
  const overlay = document.getElementById("modal-overlay");
  overlay.classList.add("hidden");
  document.getElementById("modal-box").innerHTML = "";
}
document.getElementById("modal-overlay").addEventListener("click", e => {
  if (e.target.id === "modal-overlay") hideModal();
});
document.getElementById("modal-overlay").addEventListener("click", e => {
  if (e.target.closest("[data-modal-close]")) hideModal();
});

/* Centered Yes/No confirm modal. Calls onConfirm() if the user picks Yes. */
function showConfirmModal(message, onConfirm) {
  showModal(`
    <div class="modal-head"><h3>Confirm</h3><button class="modal-close" data-modal-close>✕</button></div>
    <div class="modal-body"><div class="modal-confirm-msg">${esc(message)}</div></div>
    <div class="modal-foot">
      <button class="btn ghost" data-modal-close>No</button>
      <button class="btn accent" id="modal-confirm-yes">Yes</button>
    </div>
  `);
  document.getElementById("modal-confirm-yes").addEventListener("click", () => {
    hideModal();
    onConfirm();
  });
}

/* Armor modal: choose Type (Heavy/Light), AC modifier, and an "Other" note. */
function openArmorModal() {
  const a = character.armor || { type: "Light", acBonus: 0, other: "" };
  showModal(`
    <div class="modal-head"><h3>Armor</h3><button class="modal-close" data-modal-close>✕</button></div>
    <div class="modal-body">
      <label class="field"><span class="field-label">Type</span>
        <select id="armor-type">
          <option value="Heavy" ${a.type === "Heavy" ? "selected" : ""}>Heavy</option>
          <option value="Light" ${a.type !== "Heavy" ? "selected" : ""}>Light</option>
        </select>
      </label>
      <label class="field"><span class="field-label">AC Modifier</span>
        <input id="armor-ac" type="number" step="1" value="${Number(a.acBonus) || 0}" />
      </label>
      <label class="field"><span class="field-label">Other (notes / description)</span>
        <textarea id="armor-other" rows="2" placeholder="Anything else to remember…">${esc(a.other || "")}</textarea>
      </label>
    </div>
    <div class="modal-foot">
      <button class="btn ghost" data-modal-close>Cancel</button>
      <button class="btn accent" id="armor-save">Save</button>
    </div>
  `);
  document.getElementById("armor-save").addEventListener("click", () => {
    const type = document.getElementById("armor-type").value;
    const acBonus = Number(document.getElementById("armor-ac").value) || 0;
    const other = document.getElementById("armor-other").value.trim();
    character.armor = { type, acBonus, other };
    character.wearingArmor = true;
    save(); hideModal(); renderAll();
  });
}

/* Item info popup (now rendered in the generic modal) */
function showItemPopup(id) {
  const item = GAME_DATA.invById[id] || character.customItems.find(it => it.id === id);
  if (!item) return;
  showModal(`
    <div class="modal-head"><h3>${esc(item.name)}</h3><button class="modal-close" data-modal-close>✕</button></div>
    <div class="modal-body"><div class="modal-item-body">${esc(item.desc || "No description.")}</div></div>
  `);
}

/* Skill trees (delegated) */
document.getElementById("skill-trees").addEventListener("click", e => {
  const card = e.target.closest("[data-tier]");
  if (!card) return;
  const [treeId, idxStr] = card.dataset.tier.split(":");
  const idx = Number(idxStr);
  const tree = GAME_DATA.skillTrees[treeId];
  const unlocked = character.unlocked[treeId] || 0;

  if (idx < unlocked) {
    // refund (only highest unlocked is clickable)
    character.unlocked[treeId] = unlocked - 1;
    if (character.unlocked[treeId] === 0) delete character.unlocked[treeId];
    save(); renderAll();
    toast(`Refunded ${tree.tiers[idx].name}`);
  } else if (idx === unlocked) {
    const cost = tree.tiers[idx].cost;
    if (D.apAvailable < cost) { toast(`Not enough AP (need ${cost}).`); return; }
    character.unlocked[treeId] = unlocked + 1;
    save(); renderAll();
    toast(`Unlocked ${tree.tiers[idx].name}!`);
  }
});

/* Notes (delegated) */
document.getElementById("add-note-btn").addEventListener("click", () => {
  character.notes.unshift({ id: uid(), title: "", body: "", collapsed: false });
  save(); renderNotes();
});
document.getElementById("notes-list").addEventListener("click", e => {
  const tog = e.target.closest("[data-note-toggle]");
  if (tog) {
    const n = character.notes.find(x => x.id === tog.dataset.noteToggle);
    if (n) { n.collapsed = !n.collapsed; save(false); document.querySelector(`.note-card[data-note="${n.id}"]`).classList.toggle("collapsed", n.collapsed); }
    return;
  }
  const del = e.target.closest("[data-note-del]");
  if (del) {
    character.notes = character.notes.filter(x => x.id !== del.dataset.noteDel);
    save(); renderNotes();
  }
});
document.getElementById("notes-list").addEventListener("input", e => {
  const tId = e.target.dataset.noteTitle, bId = e.target.dataset.noteBody;
  if (tId) { const n = character.notes.find(x => x.id === tId); if (n) { n.title = e.target.value; save(); } }
  if (bId) { const n = character.notes.find(x => x.id === bId); if (n) { n.body = e.target.value; save(); } }
});

/* Rules reference toggle */
document.getElementById("ref-toggle").addEventListener("click", () => {
  const body = document.getElementById("ref-body");
  const panel = document.querySelector(".ref-panel");
  body.classList.toggle("collapsed");
  panel.classList.toggle("open", !body.classList.contains("collapsed"));
});

/* ============================================================
   7. WEAPON MODAL (add / edit)
   ============================================================ */
let editingWeaponId = null;

function buildWeaponTemplateSelect() {
  const sel = document.getElementById("wf-template");
  if (sel.dataset.built) return;
  sel.innerHTML = `<option value="">— Custom / blank —</option>` +
    Object.keys(GAME_DATA.weaponTemplates).filter(k => k).map(k => `<option value="${k}">${k}</option>`).join("");
  sel.dataset.built = "1";
  sel.addEventListener("change", () => {
    const t = GAME_DATA.weaponTemplates[sel.value];
    if (!t) return;
    document.getElementById("wf-name").value = t.name || "";
    document.getElementById("wf-category").value = t.category || "rifle";
    document.getElementById("wf-damage").value = t.damage || "";
    document.getElementById("wf-range").value = t.range || "";
    document.getElementById("wf-ammotype").value = t.ammoType || "";
    document.getElementById("wf-maxammo").value = t.maxAmmo || 0;
    document.getElementById("wf-sound").value = t.sound || "Medium";
    document.getElementById("wf-upgrades").value = (t.upgrades || []).join(", ");
  });
}

function openWeaponModal(id) {
  buildWeaponTemplateSelect();
  editingWeaponId = id || null;
  const w = id ? character.weapons.find(x => x.id === id) : null;
  document.getElementById("weapon-modal-title").textContent = w ? "Edit Weapon" : "Add Weapon";
  document.getElementById("wf-template").value = "";
  document.getElementById("wf-name").value = w ? w.name : "";
  document.getElementById("wf-category").value = w ? w.category : "rifle";
  document.getElementById("wf-damage").value = w ? w.damage : "";
  document.getElementById("wf-range").value = w ? w.range : "";
  document.getElementById("wf-ammotype").value = w ? w.ammoType : "";
  document.getElementById("wf-maxammo").value = w ? w.maxAmmo : 0;
  document.getElementById("wf-sound").value = w ? w.sound : "Very Loud";
  document.getElementById("wf-upgrades").value = w ? (w.upgrades || []).join(", ") : "";
  document.getElementById("wf-notes").value = w ? w.notes : "";
  document.getElementById("weapon-modal").hidden = false;
}
function closeWeaponModal() { document.getElementById("weapon-modal").hidden = true; editingWeaponId = null; }

function saveWeaponFromModal() {
  const data = {
    name: document.getElementById("wf-name").value.trim() || "Unnamed Weapon",
    category: document.getElementById("wf-category").value,
    damage: document.getElementById("wf-damage").value.trim(),
    range: document.getElementById("wf-range").value.trim(),
    ammoType: document.getElementById("wf-ammotype").value.trim(),
    maxAmmo: Math.max(0, parseInt(document.getElementById("wf-maxammo").value, 10) || 0),
    sound: document.getElementById("wf-sound").value,
    upgrades: document.getElementById("wf-upgrades").value.split(",").map(s => s.trim()).filter(Boolean),
    notes: document.getElementById("wf-notes").value.trim(),
  };
  if (editingWeaponId) {
    const w = character.weapons.find(x => x.id === editingWeaponId);
    Object.assign(w, data);
    if (w.currentAmmo > w.maxAmmo) w.currentAmmo = w.maxAmmo;
  } else {
    character.weapons.push(Object.assign({ id: uid(), currentAmmo: data.maxAmmo }, data));
  }
  save(); closeWeaponModal(); renderAll();
}

document.getElementById("add-weapon-btn").addEventListener("click", () => openWeaponModal(null));
document.getElementById("weapon-modal-close").addEventListener("click", closeWeaponModal);
document.getElementById("weapon-cancel").addEventListener("click", closeWeaponModal);
document.getElementById("weapon-save").addEventListener("click", saveWeaponFromModal);
document.getElementById("weapon-modal").addEventListener("click", e => { if (e.target.id === "weapon-modal") closeWeaponModal(); });

/* ============================================================
   8. STARTING GEAR, IMPORT / EXPORT, RESET
   ============================================================ */
function maybeLoadStartingGear(bgId) {
  const bg = GAME_DATA.backgrounds[bgId];
  if (!bg || !bg.gear) return;
  const invEmpty = Object.values(character.inventory).every(v => !v);
  if (character.weapons.length === 0 && invEmpty) {
    showConfirmModal(`Load ${bg.name} starting gear (weapon + supplies)?`, () => {
      character.weapons = (bg.gear.weapons || []).map(w => Object.assign({}, w, { id: uid() }));
      character.inventory = Object.assign({}, bg.gear.inventory || {});
      // sync HP to max for a fresh build
      character.currentHP = derive().maxHp;
      save(); renderAll();
      toast(`${bg.name} gear loaded`);
    });
  }
}

function exportCharacter() {
  const blob = new Blob([JSON.stringify(character, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe = (character.name || "survivor").replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  a.href = url; a.download = `tlou-${safe}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast("Character exported");
}

function importCharacter(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (typeof data !== "object" || !data) throw new Error("bad file");
      character = Object.assign(defaultCharacter(), data);
      // basic sanity
      character.weapons = (character.weapons || []).map(w => Object.assign({ id: uid() }, w));
      save(); renderAll();
      toast("Character imported ✓");
    } catch (err) {
      toast("Import failed — invalid file");
    }
  };
  reader.readAsText(file);
}

document.getElementById("export-btn").addEventListener("click", exportCharacter);
document.getElementById("import-btn").addEventListener("click", () => document.getElementById("import-file").click());
document.getElementById("import-file").addEventListener("change", e => {
  if (e.target.files[0]) importCharacter(e.target.files[0]);
  e.target.value = "";
});
document.getElementById("reset-btn").addEventListener("click", () => {
  showConfirmModal("Start a NEW character? This erases the current one (export first if you want to keep it).", () => {
    character = defaultCharacter();
    save(); renderAll();
    toast("New character created");
  });
});

/* ============================================================
   9. INIT
   ============================================================ */
function init() {
  document.body.dataset.activeTab = "character";
  renderReference();
  renderAll();
  save(false);
}
init();

/* Backstop: keep the display in sync with the data even if some handler
   forgets to re-render. Only re-renders when the data actually changed and
   never while you're typing in a field or have a dropdown open. */
let __lastSnapshot = JSON.stringify(character);
setInterval(() => {
  const ae = document.activeElement;
  if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return; // don't interrupt input
  const snap = JSON.stringify(character);
  if (snap !== __lastSnapshot) {
    __lastSnapshot = snap;
    renderAll();
  }
}, 1000);
