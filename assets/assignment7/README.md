# assets/assignment7/

Place the exported AI-generated movie here:

```
assets/assignment7/ai-cybersecurity-movie.mp4
```

The video player on `dos-ddos-research.html` expects exactly this path. While the
file is missing, the page shows a friendly "Movie coming soon" fallback instead
of a broken player. Once the MP4 exists (exported from Google Flow), the player
works automatically — no page edits needed.

Tips for the export:

- Format: MP4 (H.264 video + AAC audio works in every browser)
- 16:9 aspect ratio matches the player wrapper best
- Keep the file reasonably sized (a few hundred MB max) so the page still loads
  quickly on mobile
