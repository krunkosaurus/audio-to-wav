# Audio to WAV Converter

This script was created to quickly convert audiobooks into `.wav` files, specifically for playback on the Teenage Engineering TP-7. It's designed to run really fast by using all available CPU cores on your machine, making it super efficient for handling large audio folders.

## Features
- Converts `.mp3` and `.m4v` audio files to `.wav` format.
- Supports recursive folder searching, so it can process files in nested folders.
- Optional concatenation: combines all `.wav` files in each folder into a single file (for easy audiobook playback).
- Deletes original `.wav` files after concatenation to save space.

## Prerequisites
- **Node.js**: Make sure you have Node.js installed.
- **FFmpeg**: The script relies on FFmpeg for audio processing. Install it through Homebrew:
  ```bash
  brew install ffmpeg

## Usage

1.	Clone or download this repo on your device.
2.	Place all your audiobook files (in .mp3 or .m4v format) in the audio/ folder.
3.	Run the script by executing:

```bash
node script.js
```

The converted .wav files will appear in the wav/ folder. If you use the --concat option, it’ll also combine files into single .wav files per folder.

Note: I wrote and tested this on a MacBook Pro, so I can’t guarantee it works on other setups.

Important Settings

- Concat Mode: Set concatMode in the script to 1 if you want to concatenate files by folder. By default, this is enabled.
- Concurrency: The script automatically detects and uses all your CPU cores for maximum speed!
