# Maple Falls loading introduction

An eight-second, continuous establishing shot using the supplied town reference:
`art/new/new-menu/c84fbc37-26f1-4649-bda2-ea7e953eb0ba.png`.

| Time | Shot |
| --- | --- |
| 0-1.5s | Low camera glides over the grassy hill crest. |
| 1.5-4.8s | Warm, peaceful town, lake and wooded hills are revealed. |
| 4.8-6.7s | A zombie's boot steps over the lens into the foreground; its back faces the town. |
| 6.7-8s | Camera and zombie settle; hold the final composition. |
| After video | Freeze the actual final frame, then fade in the existing transparent logo and real loading progress. |

`town-reveal.prompt.txt` is the generation prompt. The video contains no logo or
loading graphics; the game supplies crisp, responsive overlays afterward.

Live RUN CLI estimates checked on 2026-10-15 for this game, eight seconds,
reference-to-video, without generated audio:

| Version | Provider | Resolution | Exact estimate |
| --- | --- | --- | --- |
| First draft | seedance-2.0-fast | 720p | 2,904 credits |
| Finished version | seedance-2.0 | 1080p | 8,184 credits |

Run `scripts/generate-loading-intro.ps1 -Quality draft` to refresh the estimate
without generating. Add `-Generate` only when the credit spend is approved.
Use `-Quality final` for 1080p. The script caps the charge at the reviewed
estimate, uses a stable idempotency key and supports `-Resume` to recover the
same job without submitting a duplicate.

After generation, review the camera movement and zombie framing before copying
the selected MP4 into `public/`. Preserve the original output and CLI metadata.
Prepare an optimized muted MP4 and a poster of its final frame for runtime.

Loading integration should start asset loading in parallel with the video,
preserve playback when React mounts, hold the final frame, and animate the logo
and progress overlay independently. Provide Skip and a still-image path for
reduced motion, blocked autoplay, missing video or playback failure. A completed
load should not restart when the logo appears or wait on an artificial progress
bar. Do not autoplay sound before user interaction.

## Approved generated clip

The 1080p generation was approved at a maximum of 8,184 RUN credits and completed
as job `G6zLDaJRIfk7be36xn5D`. Its unchanged master and generation metadata are
`town-reveal-1080p-v1.mp4` and the adjacent `.json` file. Review the master in a
video player or open `contact-sheet.jpg` for eight sampled frames.

`npm run art:intro` packs the runtime H.264 MP4, removes its audio track and
extracts the actual opening and final video frames. The source remains intact.
The runtime file is approximately 5.3 MB. The generated composition ends with
the zombie's boot and lower leg framing the right side of the town.

The cinematic starts in `public/boot-intro.js` before SDK initialization. Its
DOM video element persists outside React's root; `LoadingIntro.tsx` adds the
existing logo and true asset-loading progress only after the film settles.
Skip, reduced-motion, data-saver, playback-error and timeout paths use the
final-frame poster. Run `npm run test:loading-intro` for browser verification.
