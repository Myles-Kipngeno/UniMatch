# UniMatch 45-Second Promotional Video (Remotion & CSS 3D)

A high-production promotional video composition for **UniMatch**, synchronized to a **140 BPM** electronic trap beat with an American collegiate voiceover.

## Specifications
- **Format**: 9:16 Vertical (1080 × 1920)
- **Frame Rate**: 60 FPS
- **Duration**: 45.0 Seconds (2700 Frames)
- **Tempo**: 140 BPM (1 bar ≈ 1.714s, 1 beat ≈ 25.7 frames)
- **Theme**: Obsidian dark glassmorphism (`#0b0914`), glowing purple (`#7c3aed`), neon violet (`#a78bfa`), magenta (`#ec4899`).
- **Hardware**: CSS 3D Black Titanium iPhone 16 Pro with specular glass glints and Z-lifted UI cards.

---

## Storyboard & Timeline Structure

| Scene | Timestamp | Frames | Action & Visuals |
|---|---|---|---|
| **Scene 1: Hook** | `0:00.0 - 0:03.4` | `0 - 205` | Purple glow epicenter, kinetic text slam ("ACTUALLY met?"), 6-frame shake. |
| **Scene 2: Verification** | `0:03.4 - 0:08.6` | `206 - 515` | Titanium iPhone whips up, typing `@...ac.ke`, 3D Z-lift `✓ VERIFIED` badge, blocked fake/catfish cards. |
| **Scene 3: Step 4 Onboarding** | `0:08.6 - 0:15.4` | `516 - 925` | Glowing circular avatar with edit pencil badge, 6-slot grid filling on each beat, Slot 1 gets `Main` badge. |
| **Scene 4: Campus Pulse** | `0:15.4 - 0:22.3` | `926 - 1339` | Top-down radar sweep, live spots (**Library**, **Student Center**, **The Mess**), active check-in count bump. |
| **Scene 5: Discovery Deck** | `0:22.3 - 0:29.1` | `1340 - 1749` | Fluid swipe physics (±12° tilt), photo carousel, shared tags (🎵 Music, ⚽ Football, 📚 Library grind). |
| **Scene 6: Match Moment** | `0:29.1 - 0:34.3` | `1750 - 2059` | 0.5s silence tape-stop, avatar collision from screen edges, shockwave ring, `"IT'S A MATCH"`, floating icebreaker chip (`☕ Coffee between lectures?`). |
| **Scene 7: Real-Time Chat** | `0:34.3 - 0:39.4` | `2060 - 2367` | Springy chat bubble, typing indicator, reply, location card (`📍 Student Center · 2:15 PM`), read receipts. |
| **Scene 8: Outro & CTA** | `0:39.4 - 0:45.0` | `2368 - 2700` | Floating dual phones in V-lockup, radiant UniMatch logo bloom, `uni-match-one.vercel.app · Link in bio`, beat fade out. |

---

## Word-For-Word Voiceover Script (General American)

1. `0:00.0 - 0:03.4`: *"Okay, real talk… how many people on campus have you actually met?"*
2. `0:03.4 - 0:08.6`: *"This is UniMatch. Everyone here is a verified student: school email or student ID. [beat] No randoms. No catfish."*
3. `0:08.6 - 0:15.4`: *"Setup takes, like, sixty seconds. Drop your main pic, fill your gallery… [beat] and you're in."*
4. `0:15.4 - 0:22.3`: *"Then there's Campus Pulse. See who's live at the library, the Student Center, the Mess… right now."*
5. `0:22.3 - 0:29.1`: *"Swipe through people who actually get you. Same interests, same campus, same late-night library grind."*
6. `0:29.1 - 0:34.3`: *"And when it clicks? [beat 0.5s] It's a match. We'll even give you the opener."*
7. `0:34.3 - 0:39.4`: *"'Coffee between lectures?' [beat] Say less."*
8. `0:39.4 - 0:45.0`: *"UniMatch. Your campus is waiting. [beat] Link in bio."*

---

## File Organization
- `remotion/types.ts`: Master timing constants, frame boundaries, theme variables.
- `remotion/components/PhoneMockup.tsx`: CSS 3D realistic iPhone 16 Pro chassis.
- `remotion/scenes/`: Dedicated scene components matching each storyboard phase.
- `remotion/UniMatchPromo.tsx`: Master sequence controller.
- `remotion/Root.tsx`: Remotion composition root.
