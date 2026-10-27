# Responsive layout per screen

Rules and size classes: `.agents/skills/mykx-design-system/SKILL.md` §3a. Boards: [myKx Screens](https://claude.ai/artifact/8crEyKVQm9QxCHLDqPXioP), with the four-size previews on the **Devices** page.

| Screen (board) | Native frame | Compact (< 600) | Medium (600–1023; foldable, tablet portrait) | Desktop (≥ 1600) |
|---|---|---|---|---|
| Sidekick Studio picker (`Main`) | 1280 × 800 | Kix 180 px with nameplate as a header; panel below; pack tiles in a horizontal snap row; chips wrap; Transform in a sticky bottom bar | Kix 260 px on top, panel full width below, tiles stay 5 across; side by side from 700 px when the height allows | container 1440; Kix 440 px |
| Studio transform and reveal (`StudioReveal`) | 1280 × 800 | vortex or reveal as a full-width hero; the two variants in 2 columns; Keep / Adopt in a sticky bar | hero on top, variants and actions below | container 1440 |
| Home (`Home`) | 1280 × 800 | one-column feed: greeting with Kix, today's quest, Pip, squadron as a snap row | two columns of cards | container 1440; more scene visible |
| Quest map (`QuestMap`) | 1280 × 800 | the map art becomes a banner; nodes become a vertical trail with a connecting line | vertical trail in a wider column, banner taller | map at full width, container 1440 |
| Question and reward (`Question`) | 1280 × 800 | question first; options full width, stacked, 56 px; Kix docks as a HUD above the answer bar; hint and reward as bottom sheets | Kix small beside the question; options 2 × 2 | container 1280, Kix larger |
| Treasure Realm (`Treasure`) | 1280 × 800 | vault banner shorter; cards in 2 columns; collections as tabs | 3 columns | 5 columns; vault scene fills the margins |
| Study deck, Teen (`StudyDeck`) | 1280 × 800 | stacked sections | 2 columns | container 1440 |
| Parent summary (`Parent`) | 390 × 844 | as designed | child cards in 2 columns | centred 3-column dashboard |
| Critter Lab (`CritterLab`) | 1280 × 800 | life-cycle stages as a swipe carousel; Pip large on top | stages in 2 × 2 | container 1440 |
| Sky Squadron (`SkySquadron`) | 1280 × 800 | banner on top; jets as a horizontal snap carousel | jets 2 × 2 | jets in one row, banner wider |
| Vibe Zone (`VibeZone`) | 1280 × 800 | the brief chat first; the deck below as a snap carousel; cards full width | chat on top, deck below | container 1440 |
| Talk to Kix and Study Song (`VoiceSound`) | 1280 × 800 | Talk to Kix first, Study Song below; mic button large and sticky at the bottom | stacked panels | container 1440 |
| Skills catalogue (`AdminSkills`) | 1440 × 900 | top bar with menu; level chips scroll; one-column cards; agents and trace stacked below | icon rail; 2-column cards; aside below | container 1600 |
| Add knowledge (`AdminUpload`) | 1440 × 900 | compact stepper; questions list first, "View page" opens the source; publish bar sticky | Source / Questions as two tabs | wider source pane |
| What Kix remembers (`Notebook`) | 390 × 844 | as designed | pages as a left list, content on the right | three columns: children, pages, content with changes |

Foldable book posture (two horizontal viewport segments) puts the first pane left of the hinge and the second right for Studio, Question, Vibe Zone, Talk to Kix, Add knowledge and Notebook.
