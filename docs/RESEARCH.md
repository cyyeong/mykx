# The evidence behind myKx

Why myKx exists, and why it's built the way it is: the market and the need, what research says about monitoring children, and the learning science behind each design choice. Compiled on 29 Oct 2026 from public sources. Each figure gives its source. **How sure:** *read* means we read it in the primary source; *abstract* means in the paper's abstract only; *reported* means only in a reliable secondary report. We also list the claims we deliberately don't make.

## 1. The need: busy parents, big spending, uneven help

| Finding | Source | How sure |
|---|---|---|
| **56.6%** of married couples in Singapore are dual-career (2025), up from 52.5% in 2020 | Department of Statistics, [General Household Survey 2025](https://www.singstat.gov.sg/publication-resources/general-household-survey-2025), p.67 | read |
| Singapore households spent **S$1.8 billion** on private tuition in 2023 (S$1.1 bn in 2013, S$1.4 bn in 2018). The top income fifth spent **S$162.60** a month, the bottom fifth **S$36.30** | Household Expenditure Survey 2023, as reported by [The Straits Times](https://asianews.network/?p=185968) and [SingStat](https://www.singstat.gov.sg/news/parents-seem-persuaded-that-tuition-is-necessary-and-not-optional) | reported |
| Singapore parents spend **7.9 hours** a week helping with schoolwork, against a 6.7-hour average across 29 countries | Varkey Foundation, [Global Parents' Survey 2018](https://www.varkeyfoundation.org/_files/ugd/5c330e_08203a0b372c4a4fa9185c3ee517fcaa.pdf) (27,380 parents) | read |
| Tuition is common worldwide: **75.7%** of South Korean students in private education (2025); **30%** of 11–16-year-olds in England and Wales have had tuition (46% in London, 16% in the North East); **27%** of students in India took coaching (2025) | Korea's 2025 Survey on Private Education Expenses ([report](https://en.fnnews.com/news/202603121148498852)); Sutton Trust, [Tutoring: The new landscape](https://www.suttontrust.com/?p=31516) (2023); MoSPI, [Comprehensive Modular Survey: Education 2025](https://educationforallinindia.com/wp-content/uploads/2025/08/PIB-Press-Release-26-08-2025-NSSO-Comrephensive-Modular-Survey-on-Education.pdf) | reported; read; reported |
| The global private tutoring market is estimated at **US$154.8 bn by 2030** (Grand View Research); Technavio expects **US$25.7 bn** of growth over 2024–28. Firms define the market differently, so we quote ranges, not one number | [Grand View Research](https://www.grandviewresearch.com/press-release/global-private-tutoring-market) (2023); [Technavio](https://prnewswire.com/news-releases/private-tutoring-market-size-is-set-to-grow-by-usd-25-71-billion-from-2024-2028--growing-emphasis-on-stem-education-to-boost-the-market-growth-technavio-302191671.html) (2024) | read |
| Households pay **30%** of all education spending worldwide, and private tutoring is unregulated in 48% of countries | UNESCO, [GEM Report 2021/2](https://gem-report-2021.unesco.org/) | read |
| Parents will pay for AI homework help, and willingness rises as more of their child's peers use it | Bursztyn et al., PNAS 2026 ([summary](https://econtribute.de/ai-for-homework-the-more-childrens-peers-use-ai-the-more-parents-would-be-willing-to-pay-for-a-subscription/)) | reported |

**What it means for myKx.** Families already pay heavily for help after school, and that help is unequal: the richest fifth of Singapore households spend four and a half times what the poorest fifth do. myKx aims to give every child a patient tutor that follows them, and to give a working parent the afternoon back in a short evening summary. It isn't meant to replace the time parents spend with their children.

## 2. Monitoring children: what works, and what backfires

| Finding | Source | How sure |
|---|---|---|
| What parents know comes mostly from what children **choose to tell them**; that disclosure, not tracking, explained the link to good adjustment | Kerr & Stattin, *Developmental Psychology* 36(3), 2000 ([PubMed](https://pubmed.ncbi.nlm.nih.gov/10830980)) | abstract |
| Low-autonomy parents used monitoring apps most, and more parental control went with **more** online risk, not less | Ghosh et al., [CHI 2018](https://doi.org/10.1145/3173574.3173768) (215 parent–teen pairs) | abstract |
| **76%** of children's reviews of parental-control apps were one star: too restrictive, invasive, and harmful to the relationship | Ghosh et al., [CHI 2018](https://doi.org/10.1145/3173574.3173698) (736 reviews) | abstract |
| Talking with children about media (active mediation) did more to reduce risk than restriction | Chen & Shi, meta-analysis of 52 studies, [2019](https://doi.org/10.1177/1077699018754908) | abstract |
| The parental-control software market is about **US$1.3–1.6 bn**, growing 11–13% a year | Fortune Business Insights ([2026](https://www.fortunebusinessinsights.com/parental-control-software-market-104282)); Allied; Market Glass | read; reported |

**What it means for myKx (Guardian).** Monitoring is opt-in and the child always sees a chip when it's on. A teen can pause location for 30 minutes, and the parent is told. Alerts say "possibly" and ask the parent to review them (Right / Not right), so they start a conversation rather than impose a restriction. The evening summary suggests one thing to talk about, not a checklist. Limit: this evidence is correlational, and there's no outcome research yet on AI-read home cameras. We say Guardian is *designed in line with research on trust and disclosure*, not that it's proven to make children safer.

## 3. Learning science behind Kix

| What myKx does | The evidence | Source | How sure |
|---|---|---|---|
| **A tutor for every child, with step-by-step hints** | Intelligent tutoring systems outperformed teacher-led large-group teaching (g = .42) and were **not significantly different from one-to-one human tutoring** (107 effect sizes) | Ma et al., *J. Educational Psychology* 106(4), [2014](https://doi.org/10.1037/a0037123) | read |
| | Tutoring in pre-K–12 randomised trials averages **0.37 SD** | Nickow, Oreopoulos & Quan, [NBER 2020](https://www.nber.org/papers/w27476) | abstract |
| | AI tutors with teaching built in show real, moderate gains: about **0.3 SD** in six weeks in Nigeria; **0.37** for a maths tutor in Ghana | [World Bank 2025](https://blogs.worldbank.org/en/education/From-chalkboards-to-chatbots-Transforming-learning-in-Nigeria); Henkel et al., [2024 preprint](https://arxiv.org/abs/2402.09809) | read; abstract |
| **Hints, never answers** | Unguarded GPT-4 left high-school students **17% worse** once it was taken away; a hint-only tutor largely avoided the harm (about 1,000 students) | Bastani et al., [PNAS 2025](https://doi.org/10.1073/pnas.2422633122) | abstract |
| **Adapting to each child's level** | Technology that adapts to the learner's level had the largest effects (0.35) in 16 trials with 53,029 children aged 6–15 | Major, Francis & Tsapali, [BJET 2021](https://eprints.whiterose.ac.uk/176999) | abstract |
| **Mastery gates decided by code** | Mastery learning helps, more for weaker students, and works best with a high bar; it loses force when children purely set their own pace, so Kix nudges and the parent sees progress | Kulik, Kulik & Bangert-Drowns, [1990](https://www.academia.edu/81783373/Effectiveness_of_Mastery_Learning_Programs_A_Meta_Analysis); Slavin, [1987](https://www.gwern.net/doc/psychology/1987-slavin.pdf) | abstract; read |
| **Spaced review and fresh questions** | A week later, students who had been tested recalled **56%**, against **42%** for those who restudied; practice testing and spacing are the two "high utility" techniques | Roediger & Karpicke, [2006](https://psychology.ecu.edu/wp-content/pv-uploads/sites/216/2019/03/Roediger-Karpicke-2006.pdf); Dunlosky et al., [2013](https://doi.org/10.1177/1529100612453266) | read; abstract |
| **Feedback on the task, and "explain your reason"** | Feedback helps on average but over a third of feedback interventions hurt, mostly when it's about the person rather than the task; metacognition is among the highest-impact approaches | Kluger & DeNisi, 1996; Wisniewski, Zierer & Hattie, [2020](https://doi.org/10.3389/fpsyg.2019.03087); EEF Toolkit | abstract; reported |
| **Learning through the child's own interests** (critters, jets, anime, K-pop) | Problems personalised to students' interests improved their algebra, and the gain lasted into a later unit; struggling students gained most | Walkington, 2013; Bernacki & Walkington, [2018](https://doi.org/10.1037/edu0000250) | reported; abstract |
| **Relevant visuals in lessons; a calm question player** | Words with relevant pictures beat words alone (median d = 1.39), but irrelevant "seductive details" lowered learning (g = −0.33). So the art carries the concept in a lesson, and the spectacle stays on Home, the door and Treasure | Mayer, *Multimedia Learning*, [2009](https://www.cambridge.org/core/books/abs/multimedia-learning/multimedia-principle/1CC3DE892B0431BA48B4C4DCA10D0B8F); Sundararajan & Adesope, [2020](https://news.wsu.edu/press-release/2020/03/19/seductive-details-inhibit-learning) | read; reported |
| **Rewards as celebration, no leaderboards or loot** | Expected tangible rewards undermined children's intrinsic motivation (d = −0.34), while positive, informative feedback raised it; a leaderboard-and-badges course lowered motivation and exam scores | Deci, Koestner & Ryan, [1999](https://depts.washington.edu/techdocs/papers/deciExtrinsicRewardsAndIntrinsicMotivation99.pdf); Hanus & Fox, [2015](https://doi.org/10.1016/j.compedu.2014.08.019) | read; reported |
| **Learning games that teach** | Digital learning games beat non-game teaching (g = 0.33), most when combined with other teaching over several sessions | Clark, Tanner-Smith & Killingsworth, [2016](https://doi.org/10.3102/0034654315582065); Wouters et al., [2013](https://doi.org/10.1037/a0031311) | abstract |
| **Breaks, a gentle start after a hard day, a spark when focus drifts** | Short activity breaks raised on-task behaviour (pooled 0.60); boredom is persistent and goes with poorer learning, so it's worth catching early | Watson et al., [2017](https://doi.org/10.1186/s12966-017-0569-9); Baker et al., [2010](https://archium.ateneo.edu/discs-faculty-pubs/92) | abstract |
| **Screen time shown against national guidance** | Singapore's MOH recommends under 2 hours a day for ages 7–12 outside schoolwork, so myKx counts learning and play separately for the parent | MOH, [Grow Well SG](https://www.moh.gov.sg/newsroom/grow-well-sg-to-support-families--in-building-healthy-habits-in-children-/) (Jan 2025) | read |

## 4. Claims we don't make

The evidence is weak, contested or easy to misread here, so myKx doesn't claim:

- **"AI tutoring delivers Bloom's two-sigma."** That figure is inflated; realistic tutoring effects are about 0.3–0.4 SD ([von Hippel, 2024](https://www.educationnext.org/two-sigma-tutoring-separating-science-fiction-from-science-fact/)).
- **"AI tutors double learning."** That comes from one undergraduate physics lesson ([Kestin et al., 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12179260/)), with no test of retention.
- **Standardised-test gains from mastery learning or tutors.** Effects shrink sharply on standardised tests.
- **"Games and rewards boost motivation"**, **"rich visuals improve learning"** or **"myKx adapts to visual learners"**. Only relevant visuals help, and learning styles aren't supported.
- **"Detecting mood improves learning"** or **"monitoring keeps children safe"**. Both rest on correlational evidence. Kix's gentle start and the Guardian rules are care, built in line with the research, not proven outcomes.
- **A single "AI in education market size".** Estimates differ about tenfold between firms.
- **"Most Singapore children have tuition."** There's no official share; S$104.80 a month is an average over all households.

The full brief, with every source's reading notes and the figures we couldn't verify, is [docs/research/evidence-brief-2026-10-29.md](research/evidence-brief-2026-10-29.md).
