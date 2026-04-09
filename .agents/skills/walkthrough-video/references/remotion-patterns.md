# Remotion Patterns Reference

## Project Config Files

### remotion.config.ts

```ts
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "outDir": "dist",
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

### package.json scripts

```json
{
  "scripts": {
    "studio": "remotion studio",
    "render": "remotion render Walkthrough output.mp4 --codec h264",
    "render:web": "remotion render Walkthrough output.webm --codec vp8",
    "render:gif": "remotion render Walkthrough frames/ --image-format png --sequence"
  }
}
```

## config.ts — Load Manifest and Calculate Durations

```tsx
import screensData from "../screens.json";

export interface ScreenConfig {
  id: string;
  title: string;
  description: string;
  imagePath: string;
  durationSeconds: number;
  transition: "fade" | "slide-left" | "slide-right" | "slide-up" | "wipe" | "none";
  zoomTarget: { x: number; y: number; width: number; height: number; delay: number } | null;
}

export const FPS = screensData.fps || 30;
export const WIDTH = screensData.width || 1280;
export const HEIGHT = screensData.height || 720;
export const screens: ScreenConfig[] = screensData.screens;

const TRANSITION_FRAMES = 15; // frames per transition

export const totalDurationInFrames = screens.reduce(
  (total, s) => total + s.durationSeconds * FPS,
  0
) + (screens.length > 1 ? (screens.length - 1) * TRANSITION_FRAMES : 0)
  + 90  // intro
  + 120; // outro
```

## Transition Helper

```tsx
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";

type TransitionType = "fade" | "slide-left" | "slide-right" | "slide-up" | "wipe" | "none";

export function getTransition(type: TransitionType) {
  switch (type) {
    case "slide-left":
      return slide({ direction: "from-right" });
    case "slide-right":
      return slide({ direction: "from-left" });
    case "slide-up":
      return slide({ direction: "from-bottom" });
    case "wipe":
      return wipe({ direction: "from-left" });
    case "fade":
    default:
      return fade();
  }
}
```

## Title Card Component

```tsx
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface TitleCardProps {
  projectName: string;
  tagline?: string;
  backgroundColor?: string;
}

export const TitleCard: React.FC<TitleCardProps> = ({
  projectName,
  tagline,
  backgroundColor = "#0f172a",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = spring({ frame, fps, config: { damping: 20 } });
  const taglineOpacity = spring({ frame: frame - 20, fps, config: { damping: 20 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <h1
        style={{
          color: "#fff",
          fontSize: 56,
          fontWeight: 800,
          fontFamily: "Inter, system-ui, sans-serif",
          opacity: titleOpacity,
          transform: `translateY(${(1 - titleOpacity) * 20}px)`,
        }}
      >
        {projectName}
      </h1>
      {tagline && (
        <p
          style={{
            color: "#94a3b8",
            fontSize: 24,
            fontWeight: 400,
            marginTop: 16,
            opacity: taglineOpacity,
          }}
        >
          {tagline}
        </p>
      )}
    </AbsoluteFill>
  );
};
```

## CTA Card Component

```tsx
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface CtaCardProps {
  text: string;
  url: string;
  backgroundColor?: string;
}

export const CtaCard: React.FC<CtaCardProps> = ({
  text,
  url,
  backgroundColor = "#0f172a",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = spring({ frame, fps, config: { damping: 20 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
      }}
    >
      <p
        style={{
          color: "#fff",
          fontSize: 40,
          fontWeight: 700,
          opacity,
        }}
      >
        {text}
      </p>
      <p
        style={{
          color: "#3b82f6",
          fontSize: 28,
          fontWeight: 500,
          opacity: spring({ frame: frame - 15, fps }),
        }}
      >
        {url}
      </p>
    </AbsoluteFill>
  );
};
```

## Progress Bar Component

```tsx
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

interface ProgressBarProps {
  totalScreens: number;
  currentScreen: number;
  color?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  totalScreens,
  currentScreen,
  color = "#3b82f6",
}) => {
  const progress = (currentScreen + 1) / totalScreens;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 4,
        backgroundColor: "rgba(255,255,255,0.1)",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress * 100}%`,
          backgroundColor: color,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
};
```

## GIF Conversion (Post-Render)

For short walkthrough GIFs (social media, README):

```bash
# Render as PNG sequence first
npx remotion render Walkthrough frames/ --image-format png --sequence

# Convert to GIF with ffmpeg (good quality, reasonable size)
ffmpeg -framerate 30 -i frames/frame%d.png -vf "fps=15,scale=640:-1:flags=lanczos" -loop 0 walkthrough.gif

# Or use gifski for better quality (install: brew install gifski)
gifski --fps 15 --width 640 -o walkthrough.gif frames/frame*.png
```

## Video Dimensions by Platform

| Platform | Dimensions | Aspect | Notes |
|----------|-----------|--------|-------|
| YouTube / general | 1920x1080 | 16:9 | Standard HD |
| Web embed | 1280x720 | 16:9 | Good balance of quality/size |
| Twitter/X | 1280x720 | 16:9 | Max 2:20 length |
| LinkedIn | 1920x1080 | 16:9 | Max 10 min |
| Instagram feed | 1080x1080 | 1:1 | Square format |
| Instagram stories | 1080x1920 | 9:16 | Vertical |
| Mobile demo | 390x844 | ~9:19.5 | iPhone viewport |
