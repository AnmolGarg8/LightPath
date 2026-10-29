# LightPath Demo Recording Guide & Fallback Procedures

This document provides instructions for capturing and reviewing the 90-second judge walkthrough of LightPath.

---

## 1. Automated Headless Recording (Fast & Reproducible)

The repository provides an automated headless recording script that boots the production web build in a headless Chrome instance, steps through all 8 guided tour checkpoints, and compiles them into an MP4 video using `ffmpeg`.

### Automated Command
```bash
# Build the production bundle
npm --prefix web run build

# Run the automated demo recorder
node scripts/record_demo.cjs
```

### Outputs
- **Video File**: `docs/demo.mp4` (1080p H.264 video, 30 FPS, ~760 KB)
- **High-Resolution Frames**: `docs/demo_frames/step_01.png` through `step_08.png`

---

## 2. Interactive Browser Demo Tour

To view or screen-record the tour live in a browser with interactive controls:

1. **Start the local server**:
   ```bash
   cd web
   npm run preview
   # Or: npx serve dist -p 4173
   ```
2. **Open the Demo URL**:
   - Standard 90-Second Tour: `http://localhost:4173/#/?demo=1`
   - Kiosk Auto-Looping Tour: `http://localhost:4173/#/?kiosk=1`
   - Educational Walkthrough: `http://localhost:4173/#/explain`

### Keyboard Shortcuts
- **Spacebar**: Pause or resume the automatic progression timer.
- **Right Arrow**: Skip forward to the next step.
- **Left Arrow**: Go back to the previous step.
- **Key 'P'**: Toggle **Presenter Mode** (enlarges typography by 20%, hides secondary UI chrome for projection).
- **Escape**: Exit the demo overlay.

---

## 3. Manual Screen Recording Fallback (OBS Studio / Screen Recorders)

If preparing a backup video file for NASA Space Apps Challenge submission:

1. **Resolution & Canvas**: Set your screen or capture window to **1920 × 1080** (16:9 aspect ratio).
2. **Audio**: No audio track is embedded in the web app; refer to [`docs/EXPLAIN_SCRIPT.md`](EXPLAIN_SCRIPT.md) for the exact 90-second voiceover narration script.
3. **Recording Steps**:
   - **Step 1 (0:00 - 0:11)**: Start on the Mission Browser (`/#/?demo=1`). Highlight the CLPS mission cards, unverified badges, and key availability metrics.
   - **Step 2 (0:11 - 0:23)**: Panorama view (`/#/site/synthetic-proving-ground`). Scrub the timeline slider back and forth to show real-time clipping of the true-scale Sun ($0.53^\circ$) and Earth ($1.90^\circ$) discs by the terrain skyline.
   - **Step 3 (0:23 - 0:33)**: Switch observer mast height from $2.0\text{ m}$ to $5.0\text{ m}$. Show how raising the mast depresses the skyline and recovers lost sunlight.
   - **Step 4 (0:33 - 0:44)**: Scroll down to the multi-lane Timeline. Highlight the simultaneous Sun visibility, Earth line-of-sight, and DSN ground station contact lanes (Goldstone, Madrid, Canberra).
   - **Step 5 (0:44 - 0:58)**: Open Route Planner (`/#/route/synthetic-proving-ground`). Click **Solve Lunar Traverse**; observe the rover path avoiding moving shadows in under 1 second.
   - **Step 6 (0:58 - 1:10)**: Increase maximum slope constraint or move goal into an illuminated bottleneck to demonstrate the **Infeasible Explanation** and one-click suggested relaxation.
   - **Step 7 (1:10 - 1:20)**: Open Evidence Card (`/#/evidence/synthetic-proving-ground`). Click **Print / Save PDF** to demonstrate the single-page A4 audit report and synthetic data watermark.
   - **Step 8 (1:20 - 1:30)**: Navigate to Trust page (`/#/trust`). Point out the live verification suite (V1–V8), audit hash, and mathematical references (Barker et al. 2021).
