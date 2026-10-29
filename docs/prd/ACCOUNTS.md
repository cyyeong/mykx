# Sign-in and accounts: parents, kids and admins

**Written:** Tue 27 Oct 2026 (Day 1). **Status:** PRD_REVIEW E13; scheduled in `docs/plan/IMPLEMENTATION_PLAN.md`. Designs: [myKx Screens](https://claude.ai/artifact/8crEyKVQm9QxCHLDqPXioP), row 8.

## 1. Who signs in, and how

| Role | Signs in with | Lands on |
|---|---|---|
| **Parent** (owns a household) | email + password (Supabase Auth); "Forgot password" sends a reset email | the parent dashboard |
| **Admin** (platform content team) | the same form; admin is a flag on the account | the skills catalogue |
| **Kid** | on a family device a parent has signed in on: **"Who's learning?"** shows a door per child. **Junior:** a 4-picture code. **Teen:** a password. | their Home, in their world |

| **Kid, anywhere** (29 Oct) | the sign-in page: "Kids: tell me your magic name, and I shall bring your magical door". The kid types their **magic name** (unique across myKx, set by a parent in Your family); their own door flies in while their world replaces the city, then asks for the picture code or password. | their Home, in their world |

Kids never give an email. The magic-name door needs no grown-up on the device: the lookup (`/api/auth/kid/door`, 10 a minute per address) only says how to draw the door and sets a ten-minute door ticket; the sign-in then opens a **solo kid session**, tied to the kid's current secret instead of a grown-up's session, so a parent resetting the code ends it (`lib/auth/kid-session.ts`). The usual lockout applies.

## 2. The moment (design)

- **The page is a living city.** Behind the door, a twilight city (neon for teens) is alive: twinkling stars and the odd shooting star, lanterns drifting up, fireflies, little Kix characters flying past with sparkle trails, and small characters walking along the plaza, with parallax. All of it pauses under reduced motion and when the tab is hidden.
- **A grand double door** stands in the plaza with the sign-in card in front of it.
- **On success:** the card folds away, the two door leaves swing open on their hinges, light floods out, and a **time tunnel** (the transform vortex art plus rushing rings and star streaks) zooms the person into their landing page, in about 3 seconds. With sound on, the transform whoosh plays, then the world's chord. Reduced motion: a short crossfade instead.
- **Wrong password or code:** the door gives a small rattle and a calm message ("That's not it. Try again, or ask a grown-up."). After 5 tries there's a 1-minute pause, and the parent is told.
- **Age-based looks:** *default* (parents and admins): the grand twilight door with gold filigree. *Junior:* a storybook arched door with frog knockers, picture code, Kix guiding in a bubble, 56 px targets. *Teen:* a sleek glass portal with neon lines in a neon city, a password, minimal copy. A teen in the Anime Sky world gets the same password door drawn as a pearl-and-sky arched door with cherry blossoms, in a sky city with floating islands and falling petals (founder, 29 Oct: Abby and Leonard each have their own door). The look follows the kid's world (`lookFor` in `components/signin/looks.ts`); how they sign in follows the band.

## 3. Managing accounts

- **Parent ("Your family"):** add a kid (nickname, level P3, P6 or Sec 2, which sets the band, a world, and a starting picture code or password); reset a kid's code or password; set limits and voice; remove a kid (with a confirm step); change their own email and password; sign out on all devices.
- **Kid ("Me"):** change their nickname (up to 20 characters, with a tip: use a nickname, not your full name); change their picture code (enter the old one first) or password (old and new).
- **Admin ("People"):** search households and accounts; see role, status and last sign-in; reset a parent's password (sends the email) or start a kid's code or password reset (the old one stops working and the parent sets the new one); lock, unlock or disable an account; add or remove the admin flag; every action goes to an audit log. **Admins see account details, never a child's messages, Notebook or answers.**

## 4. Rules

1. Kids' codes and passwords are hashed on the server (scrypt), checked with rate limits, and never shown again. A parent can reset them.
2. A kid's session is a short-lived, signed, http-only cookie tied to the parent's session on that device (12 h, or until the parent signs out), or a solo session from the magic-name door, tied to the kid's current secret (12 h, or until the code or password is reset).
   **Sign out and idle (29 Oct):** a kid can sign out from the rail (from 600 px), the avatar menu or Me; after 14 minutes with no taps, keys or scrolls a "Still there?" card counts down the last minute, and at 15 minutes the kid is signed out (`components/nav/KidIdle.tsx`). Signing out ends the kid's session only: back to Kids' doors when a grown-up is signed in on the device, else to the sign-in page.
3. Nicknames, never full names, and no email for kids.
4. All admin actions are server routes that check the admin flag, write an `audit_log` row, and use the service role; RLS still scopes everything else by household.
5. Sign-in pages say what's stored and link the privacy note.

## 5. Data (adds to `supabase/schema.sql`)

- `profiles.username` (29 Oct, migration `20261030_kid_username.sql`): the kid's magic name, lowercase letters, digits and hyphens, 3 to 24 characters, unique across myKx.


`profiles`: `nickname`, `secret_kind` (`pictures` | `password`), `secret_hash`, `failed_attempts`, `locked_until`, `disabled_at`. New table `audit_log` (actor, action, target, created_at).
