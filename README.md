# FillCut

FillCut is a tool that automatically removes filler words, pauses, and coughs from video files. It uses Whisper for transcription, OpenAI for speech pattern analysis, and FFmpeg for video editing.

## Features

- Transcribes video files using Whisper
- Analyzes transcriptions to detect:
  - Filler words (um, uh, like, etc.)
  - Pauses (silence > 0.5 seconds)
  - Coughs and throat clearing
- Automatically cuts out these elements from the video
- Preserves video and audio quality
- Provides information about time saved

## Requirements

- Node.js (v16 or higher)
- TypeScript
- FFmpeg and FFprobe installed on your system
- [whisper_timestamped](https://github.com/linto-ai/whisper-timestamped) Python package
- OpenAI API key

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/ImArtisann/fillcut.git
   cd fillcut
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Install external dependencies:

   **Linux (Ubuntu/Debian)**:
   ```bash
   # Install FFmpeg
   sudo apt update
   sudo apt install ffmpeg

   # Install whisper_timestamped
   pip install git+https://github.com/linto-ai/whisper-timestamped
   ```

   **macOS**:
   ```bash
   # Install FFmpeg using Homebrew
   brew install ffmpeg

   # Install whisper_timestamped
   pip3 install git+https://github.com/linto-ai/whisper-timestamped
   ```

   **Windows**:
   ```powershell
   # Install FFmpeg
   # 1. Download FFmpeg from https://ffmpeg.org/download.html#build-windows
   # 2. Extract the zip file
   # 3. Add the bin folder to your PATH environment variable

   # Install whisper_timestamped
   pip install git+https://github.com/linto-ai/whisper-timestamped
   ```

   Alternatively, you can use [Chocolatey](https://chocolatey.org/) to install FFmpeg on Windows:
   ```powershell
   choco install ffmpeg
   ```

4. Create a `.env` file in the project root with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

## Usage

Run the tool with a video file as an argument:

```
npx tsx src/index.ts path/to/your/video.mp4
```

You can process multiple videos at once:

```
npx tsx src/index.ts video1.mp4 video2.mp4 video3.mp4
```

## How It Works

1. **Transcription**: The video is transcribed using Whisper, which generates a JSON file with word-level timestamps.

2. **Analysis**: The transcription is divided into chunks and analyzed using OpenAI's GPT-4o model to identify filler words, pauses, and coughs.

3. **Video Processing**: FFmpeg is used to cut out the identified sections and concatenate the remaining parts into a new video file.

4. **Output**: The processed video is saved in the `src/output` directory with "_output" appended to the filename.

## Configuration

- You can change the Whisper model used for transcription by modifying the `model` parameter in `transcribeWithWhisper()` function. Available options are 'base', 'small', 'medium', and 'large'. The default is 'medium'.

- The analysis uses GPT-4o by default. You can modify the model in the `analyzeChunk()` function in `src/utils/analyzeSpeech.ts`.

## Example

```
npx tsx src/index.ts my_presentation.mp4
```

Output:
```
Creating transcription with Whisper...
Running: whisper_timestamped "my_presentation.mp4" --output_dir "./transcripts" --output_format json --model medium
Loaded 500 words in 35 chunks.
Chunk 1 analyzed
...
Chunk 35 analyzed
Filler detections found: 42
Found 42 filler sections to remove
Time saved: 78.5 seconds
Processing video segments...
Successfully created src/output/my_presentation_output.mp4

Processing complete! Output saved to: src/output/my_presentation_output.mp4
```

## Limitations

- The quality of filler word and pause detection depends on the accuracy of the transcription and the AI analysis.
- Very short videos may not be processed correctly.
- Processing long videos may take significant time and computational resources.

## License

[MIT License](LICENSE)
