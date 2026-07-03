"""
Generate pronunciation audio files using Microsoft Edge TTS (edge-tts).
Reads all vocabulary JSON files, deduplicates words, generates US + UK MP3.

Usage:
  pip install edge-tts
  python scripts/generate-audio.py

Output: assets/audio/vocab/<word>_us.mp3 and <word>_uk.mp3
"""
import json
import os
import sys
import asyncio
import glob

# edge-tts: pip install edge-tts
# https://github.com/rany2/edge-tts

async def generate_audio(word, accent, output_dir):
    """Generate MP3 for a single word using edge-tts."""
    voice = "en-US-AriaNeural" if accent == "us" else "en-GB-SoniaNeural"
    filename = f"{word}_{accent}.mp3"
    filepath = os.path.join(output_dir, filename)

    # Skip if already exists
    if os.path.exists(filepath):
        return "skip"

    try:
        import edge_tts
        communicate = edge_tts.Communicate(word, voice)
        retries = 3
        for attempt in range(retries):
            try:
                await communicate.save(filepath)
                return "ok"
            except Exception as inner_e:
                if attempt == retries - 1:
                    raise inner_e
                print(f"    retry {attempt+1}...", end=" ")
                await asyncio.sleep(1)
    except ImportError:
        print("ERROR: edge-tts not installed. Run: pip install edge-tts", file=sys.stderr)
        return "error"
    except Exception as e:
        print(f"\n  ERROR [{word}_{accent}]: {e}")
        return "error"
    return "error"


async def main():
    vocab_dir = os.path.join("assets", "questions", "vocabulary")
    audio_dir = os.path.join("assets", "audio", "vocab")

    # Collect all unique words
    seen = set()
    words = []
    subjects = ["reading", "listening", "speaking", "writing"]
    for subj in subjects:
        path = os.path.join(vocab_dir, f"{subj}-words.json")
        if not os.path.exists(path):
            continue
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        for entry in data:
            w = entry.get("word", "").strip().lower()
            if w and w not in seen:
                seen.add(w)
                words.append(w)

    print(f"Total unique words: {len(words)}")
    print(f"Output directory: {audio_dir}")
    print(f"Estimated size: ~{len(words) * 2 * 20 // 1024} MB")

    # Create output directory
    os.makedirs(audio_dir, exist_ok=True)

    # Import edge_tts late to avoid import error on dry check
    try:
        import edge_tts
        _ = edge_tts  # suppress unused import
    except ImportError:
        print("ERROR: Please install edge-tts first:")
        print("  pip install edge-tts")
        print("Then re-run: python scripts/generate-audio.py")
        sys.exit(1)

    total = len(words) * 2
    ok_count = 0
    skip_count = 0
    err_count = 0

    for idx, word in enumerate(words):
        for accent in ["us", "uk"]:
            current = idx * 2 + (0 if accent == "us" else 1) + 1
            print(f"[{current}/{total}] {word}_{accent}...", end=" ", flush=True)
            result = await generate_audio(word, accent, audio_dir)
            print(result)
            if result == "ok":
                ok_count += 1
            elif result == "skip":
                skip_count += 1
            else:
                err_count += 1
            # Short pause to avoid rate limiting
            await asyncio.sleep(0.1)

    print(f"\nDone: {ok_count} generated, {skip_count} skipped (already exist), {err_count} errors")

    # Calculate total size
    total_size = 0
    for pattern in [os.path.join(audio_dir, "*.mp3")]:
        for f in glob.glob(pattern):
            total_size += os.path.getsize(f)
    print(f"Total audio size: {total_size / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    asyncio.run(main())
