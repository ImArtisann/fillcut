import { isVideo, removeFillerSections, trimStart } from './utils/video.utils';
import { transcribeWithWhisper } from './transcribe';
import { analyzeChunk, chunkWords, timeToSeconds } from './utils/analyzeSpeech';
import pLimit from 'p-limit';
import { Detection } from './types/transcribe.types';

async function main() {
	const inputFiles = process.argv.slice(2);

	if (inputFiles.length === 0) {
		console.log('Please provide a video file as argument');
		process.exit(1);
	}

	for (const file of inputFiles) {
		if (!isVideo(file)) {
			console.log(
				`${file} is not a video file make sure the file or directory only contains video files`
			);
			process.exit(1);
		}
	}

	for (const inputFile of inputFiles) {
		console.log('Creating transcription with Whisper...');
		try {
			const whisperOutput = await transcribeWithWhisper(inputFile);
			const chunks = chunkWords(whisperOutput, 15);

			console.log(
				`Loaded ${whisperOutput.length} words in ${chunks.length} chunks.`
			);

			const limit = pLimit(3);

			const detections: Detection[] = (
				await Promise.all(
					chunks.map((chunk, i) => limit(() => analyzeChunk(i, chunk)))
				)
			).flat();

			// add start trim since AI doesn't always pick it up
			detections.push(await trimStart(whisperOutput));

			detections.sort((a, b) => timeToSeconds(a.start) - timeToSeconds(b.start));

			console.log(`Filler detections found: ${detections.length}`);

			const outputFile = await removeFillerSections(inputFile, detections);

			if (outputFile) {
				console.log(`\nProcessing complete! Output saved to: ${outputFile}`);
			} else {
				console.log(
					`Failed to process video file ${inputFile}. Check the logs for more details.`
				);
			}
		} catch (e) {
			console.error(`Error processing video file ${inputFile}: ${e}`);
		}
	}
}

main().catch(console.error);
