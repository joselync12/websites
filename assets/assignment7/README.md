# assets/assignment7/

## AI-generated movie (Assignment 7)

The movie was exported from Google Flow as **five separate scene files** in
`scenes/`:

| Scene | File |
|---|---|
| 1 | `scenes/Cinematic_educational_video_for_a_6dc3b58a.mp4` |
| 2 | `scenes/Cinematic_educational_video_for_a_d143e11f.mp4` |
| 3 | `scenes/Cinematic_educational_video_for_a_e6fa560c.mp4` |
| 4 | `scenes/Continue_directly_from_the_previous_534d78a5.mp4` |
| 5 | `scenes/Cinematic_final_educational_video_for_e09efddb.mp4` |

These were **combined into one movie** at:

```
assets/assignment7/ai-cybersecurity-movie.mp4
```

(~40 seconds, 1280×720, ~10 MB — all five scenes in order, lossless stream
copy, no re-encoding.)

The "AI-Generated Movie" section of `dos-ddos-research.html` plays this single
file with a responsive player (standard controls: play/pause, volume, captions,
fullscreen) and a fallback note if the file is ever missing.

### Recombine the movie

If you re-export or reorder the scenes, rebuild the combined file with ffmpeg
(e.g. `pip install imageio-ffmpeg`, then use the binary it provides):

```bash
FF=$(python3 -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())")
cd assets/assignment7
"$FF" -f concat -safe 0 -i scenes.txt -c copy -movflags +faststart ai-cybersecurity-movie.mp4
```

where `scenes.txt` lists the scene files in order, one `file '<path>'` per
line. All scenes must share the same codec/resolution/fps (they do: h264
1280×720 24fps + AAC 48 kHz stereo) for the lossless `-c copy` path to work.

Export tips (if you re-export from Google Flow):

- Format: MP4 (H.264 video + AAC audio works in every browser)
- 16:9 aspect ratio matches the player wrapper best (current files are 1280×720)
- GitHub rejects single files over 100 MB — compress if an export gets large
  (HandBrake, or `ffmpeg -i in.mp4 -crf 28 out.mp4`)
