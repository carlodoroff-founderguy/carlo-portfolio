# MKT 385 submission readiness

## Implemented

| Requirement | Location |
| --- | --- |
| Home plus 4–8 content pages | Home + About, Work, Writing, Résumé, Contact + three essays (eight content pages) |
| Clear personal brand and audience | Homepage positioning; About values, interests, direction; Work contributions |
| Portfolio | `/work`: Morsa, Craze, EcoShield, with context, role, and evidence |
| Résumé / CV | `/resume` and original downloadable `/assets/carlo-doroff-resume.pdf` |
| Three posts of at least 600 words each | `/journal`: 750, 802, and 771 words; checked by build and check scripts |
| Social account | Exact LinkedIn profile from supplied résumé |
| Email link and call to action | Header/footer/contact page and essay signoffs |
| Two external links | LinkedIn and Craze |
| Appropriate unique page titles | All nine primary pages |
| Images/visuals labeled | Descriptive SVG filename and alt text; project art has accessible descriptions |
| Personal introduction video | `/about#introduction`: 62-second recording, local MP4, captions, transcript, and poster |
| Responsive design | Browser checked at 320, 390, 768, and 1440 CSS pixels |

The creative lab and its puzzle are supplementary archived experiments linked from the portfolio, outside the primary assignment navigation.

## Still required from Carlo

1. A high-resolution portrait. Save under `public/assets/` with a descriptive filename, then set `portrait` and `portraitAlt` in `content/profile.json`.
2. Review the three first-person essay drafts, proposed values, and brand narrative for accuracy and voice. Facts come from the supplied résumé; the interpretations and reflective language are editorial drafts, not direct quotations from Carlo.
3. If available, compare the completed personal branding worksheet with the proposed narrative and revise any differences.
4. Publish to the chosen host and submit the public URL in Blackboard. A local preview is not a published submission. Verify the live links and final media after deployment.

## Recording script

Approximately 130 words, intended for a natural one-minute delivery. Time a take rather than rushing to fit. The assignment requires Carlo to appear and speak in the video.

## Video integration

The supplied Drive recording (`IMG_5058.MOV`, file ID `1ItuipTIW63T5SCcxsyZ0yBLvu-tldCSO`) is 61.75 seconds long. It was converted from a 684 MB 4K HEVC MOV to a 12.4 MB 720 × 1280 H.264/AAC MP4 with fast-start metadata. The full recording and original vertical framing are preserved. The original stays in gitignored `.context/video/`; only the web assets are shipped.

Captions were transcribed locally from the actual recording, with corrections to names and the pest-control phrase. The transcript reflects the delivered introduction, which differs from the earlier suggested script. The thumbnail is a frame from the supplied recording.

## Content sources

- `RESUMEcarlodoroff.pdf`, supplied in this session: experience, dates, company outcomes, education, languages, and interests. Served unchanged as the downloadable résumé.
- Original portfolio: preserved in `public/lab.html`, with the existing puzzle engine and endpoints retained.
- Assignment text: `.context/attachments/8lqKxO/pasted_text_2026-11-09_12-40-55.txt`.

LinkedIn blocks automated requests with HTTP 999; its exact URL is taken from the résumé. Craze's website returned HTTP 200. Check the LinkedIn profile manually before submission.
