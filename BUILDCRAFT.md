# Buildcraft: synergy, multiplicative scaling, no hard caps

Trick or Treat is meant to be *broken* by players who find the right combination. This document is the
theorycrafter's reference. The rules live in `src/game/build.ts` (tags, tiers, overflow), and the hooks are in
`src/game/engine.ts`. In game, open **Your run build (I)** for the synergy board and the full damage maths of the gun
you're holding.

## 1. Pieces and tags

Every piece of a build carries one or more **tags**:

| Source | Counts while… | Where the table lives |
|---|---|---|
| Treats (level-ups, houses, the Candy Lady) | you own them. Every stack counts | `SCROLL_TAGS` |
| Inscriptions | the gun is **in your hand** (swapping guns re-tunes the build) | `INSC_TAGS` |
| The gun itself | in hand: its element (fire/shock/ecto), plus *blast* if it explodes | `Build` constructor |
| Costume | worn | `COSTUME_TAGS` |
| Talents | learned (1 per talent, not per rank) | `TALENT_TAGS` |
| Kid | always | `HERO_TAGS` |

Tags: 🎯 **Crit** · 🔥 **Fire** · ⚡ **Shock** · 🟢 **Ecto** · 💥 **Blast** · 💀 **Kill** · 🍭 **Sugar** · 🛡️ **Tank** · 👻 **Summon**

## 2. Resonance tiers (uncapped)

`tier = floor(tagCount / 3)`. There is **no top tier**. Each tier compounds that tag's multiplier forever:

| Tag | Per tier (compounding) |
|---|---|
| Crit | crit damage ×(1 + 0.15·tier) |
| Fire | burn damage ×1.25^tier |
| Shock | chain damage ×1.25^tier, +1 jump per tier |
| Ecto | ecto amplification ×(1 + 0.25·tier) |
| Blast | explosion damage ×1.2^tier |
| Kill | momentum per kill +25% per tier past 1 |
| Sugar | fire rate ×1.08^tier |
| Tank | max HP ×1.06^tier |
| Summon | summon damage ×1.3^tier (×1.5 more with Pack Leader) |

Tiers 1, 2 and 3 also switch on **keystones**. Keystones are where systems start feeding each other:

| Tag | T1 | T2 | T3 |
|---|---|---|---|
| Crit | **Lucky Streak**: each crit +2% crit chance for 3s, stacks never cap | **Critical Mass**: crits explode for 30% of the hit | **Snap**: each crit −0.15s skill cooldown |
| Fire | **Searing**: burn ticks can crit (and overcrit) | **Wildfire**: burns pass on when the host dies | **Inferno**: burns *add up* instead of keeping the strongest |
| Shock | **Conductive**: chain jumps are real hits (elements, gun inscriptions) | **Overload**: +2 jumps; a chain hitting a burning monster detonates its remaining burn | **Storm Front**: chains fork in two at every jump |
| Ecto | **Haunting**: every hit on an ecto'd monster adds +4% damage taken, forever | **Plague**: ecto spreads on death | **Possessed**: ecto amp also boosts burn and chain damage |
| Blast | **Bigger Booms**: +35% radius | **Elemental Payload**: explosions carry the gun's burn/shock/ecto chances | **Chain Reaction**: monsters killed by an explosion explode (50%) |
| Kill | **Momentum**: +1% damage per kill for 4s; every kill refreshes it; stacks never cap | **Scavenger**: kills refund 1 ammo | **Bloodlust**: kills −0.2s skill cooldown and dash recharge |
| Sugar | **Overclock**: fire rate past 12/s becomes extra projectiles | **Sugar High**: bonus move speed is also bonus damage | **Hyperactive**: every 20th shot also fires a ring of 8 |
| Tank | **Juggernaut**: +1% damage per 5 max HP over 100 | **Spiky Costume**: attackers take 50% of your max HP | **Bulwark**: +1% damage per 5 max shield |
| Summon | **Pack Leader**: orbit blades, ghost buddy, companion and Candy Cannon +50% | **Shared Tricks**: summon hits carry your gun's elements | **Army of Ghosts**: +2 orbit blades; ghost buddy fires twice as often |

## 3. The damage chain (every bucket multiplies)

```
hit = gun base
    × rarity & level            (1 + 0.15·rarity) · (1 + 0.14·(level−1))
    × inscription stat lines    Sugar-Coated, Tummy Ache, …
    × run damage                every treat/talent/kid/costume damage bonus, compounding
    × trigger inscriptions      Trick Shot ×2 first shot, Fresh Batch, Candy Corn Combo (+3%/hit, no cap), Sixth Sense…
    × run-wide treats           Lucky Number Six, Full Pillowcase, Statue Game, Brave Face
    × global "more"             (1 + momentum·perKill) · Juggernaut · Bulwark · Sugar High
    × crit                      critMul ^ layers   (see overcrit)
    × fire-rate overflow        when not overclocked
then on the monster:
    × (1 + ectoAmp · ectoMore · max(1, ectoChance))   while ecto'd
    × (1 + vuln)                                       Haunting stacks
```

Elements and procs come on top: burn (`hit × 0.45 × burnDmg × 1.25^fireTier × max(1, burnChance)`), chains, and explosions
(×1.2^blastTier). With Conductive, Critical Mass, Chain Reaction, Wildfire and Plague, each of those can start another.

## 4. Overflow: nothing caps, it spills over

* **Overcrit.** Crit chance has no ceiling. Every full 100% is a guaranteed crit layer, and the remainder is the chance of
  one more. Each layer multiplies by crit damage *again*: 250% crit at ×3 crit damage gives 3² = ×9, or a 50% chance
  of ×27. Damage numbers turn pink at two layers and purple at three or more.
* **Element chance > 100%** makes the effect stronger: burn ×chance, extra chain jumps (2 per extra 100% shock), and
  ecto amplification ×chance.
* **Fire rate.** A gun physically fires up to 20 shots a second (12 with Overclock). Everything past that turns into
  extra projectiles (Overclock) or damage (otherwise), so it is never wasted.
* **Projectiles past 16** per shot fold into damage, so the game stays smooth and the power is still there.
* **Treat stacks.** Stacking treats can be taken past their usual maximum (*overstack*), just offered less often.
  One-off switches (max 1) stay single.
* **Candy Corn Combo**, **Momentum**, **Lucky Streak** and **Haunting** stacks have no limit.

The only limits are engine safety limits on *entities*, never on power. Chain reactions resolve through a queue of up
to 5 generations per event, 12 explosions a frame, and the rest next frame.

## 5. Endless Night: the wall that always wins

Beating the last boss no longer ends the run. The night keeps going:

* There's a new wave every **30s**. Monster HP is **×1.16 per wave** and their damage is **×1.09 per wave**, both
  compounding with no ceiling.
* Each wave brings more monsters (spawn rate +0.8/s per wave, ring hordes up to 60), and the elite chance climbs to 50%.
* A **boss every 5th wave**, scaled by the same HP curve.
* The victory is banked the moment the night is beaten, and every wave adds +25 essence. Your best wave is saved.

At wave 30, monsters have ×86 HP. At wave 50, ×1,670. At wave 80, ×143,000. Your build compounds too, so the question is
*whose exponent is bigger*. That is the point.

## 6. Example god-tier builds (starting points, not answers)

* **Overcrit Blaster.** Stack Crit (Sour Patch, Jawbreaker, Owl Eyes, Lucky Socks, Jack-o'-Grin inscriptions) until crit
  passes 100%. Lucky Streak keeps adding crit while you hit, Critical Mass turns crits into explosions, and with Blast T3
  those explosions chain. Pair it with a high fire-rate gun.
* **Inferno Storm.** Fire + Shock with an elemental gun. Inferno stacks burns without limit, Overload detonates the
  whole stacked burn when a chain arrives, Storm Front forks the chain, and Conductive makes every jump re-apply burn.
  Add Ecto T3 (Possessed) so ecto amplifies both.
* **Momentum Shotgun.** Kill + Sugar. Overclocked pellets clear trash, every kill adds Momentum, and Scavenger refunds
  ammo. Piñata Pop and Two-for-One inscriptions turn kills into more kills.
* **Juggernaut Knight.** Tank stacking (Cardboard Knight, Mom's Lasagna, Costume Padding overstacked). Juggernaut and
  Bulwark turn HP and shield into damage, and Spiky Costume punishes everything that touches you. Man a Candy Cannon
  with Pack Leader.
* **Ghost Army.** Summon. Orbit blades, Ghost Buddy, a companion and the Candy Cannon, all ×1.3^tier. Shared Tricks
  hands them your gun's elements, and Army of Ghosts doubles up.

## 7. Adding new pieces

1. Add the treat, inscription, costume or talent to `data.ts` as usual.
2. Give it tags in the matching table in `build.ts`. Two tags on one piece is a strong signal: use it sparingly.
3. If it's a new *mechanic*, hook it in the engine next to its siblings (`shotMul`, `applyHit`, `killEnemy`,
   `chain`, `explode`) and route any follow-up explosions through `queueBlast` so it chains safely.
4. Check it in the build sheet: the damage-math panel shows every bucket it touches.
