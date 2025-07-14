import fs from 'fs';
import path from 'path';
import { executeFFmpeg, executeFFprobe } from '../ffmpeg';
import { Detection, Word } from '../types/transcribe.types';
import { timeToSeconds } from './analyzeSpeech';

export function isVideo(file: string) {
	if (!fs.existsSync(file)) {
		return false;
	}

	const ext = path.extname(file).toLowerCase();

	const videoExtensions = [
		'.mp4',
		'.avi',
		'.mov',
		'.wmv',
		'.flv',
		'.webm',
		'.mkv',
		'.m4v',
		'.3gp',
		'.3g2',
		'.mts',
		'.m2ts',
		'.vob',
		'.ogv',
		'.dv',
		'.asf',
		'.rm',
		'.rmvb',
		'.divx',
		'.xvid',
	];

	return videoExtensions.includes(ext);
}

interface TimeRange {
	start: number;
	end: number;
}

function parseFillerTimestamps(aiOutput: Detection[]): TimeRange[] {
	const ranges: TimeRange[] = [];

	for (const output of aiOutput) {
		const start = timeToSeconds(output.start);
		const end = timeToSeconds(output.end);
		ranges.push({ start, end });
	}

	return ranges;
}

function createKeepSegments(
	fillerRanges: TimeRange[],
	totalDuration: number
): TimeRange[] {
	const keepSegments: TimeRange[] = [];

	// Sort filler ranges by start time
	fillerRanges.sort((a, b) => a.start - b.start);

	let currentTime = 0;

	for (const fillerRange of fillerRanges) {
		// If there's a gap between current time and filler start, keep that segment
		if (currentTime < fillerRange.start) {
			keepSegments.push({ start: currentTime, end: fillerRange.start });
		}
		currentTime = fillerRange.end;
	}

	// Add the final segment if there's remaining video after the last filler
	if (currentTime < totalDuration) {
		keepSegments.push({ start: currentTime, end: totalDuration });
	}

	return keepSegments;
}

export async function removeFillerSections(
	inputFile: string,
	aiOutput: Detection[]
): Promise<string | null> {
	try {
		// Get video info to know the total duration
		const videoInfo = await getVideoInfo(inputFile);
		if (!videoInfo) {
			console.error('Could not get video info');
			return null;
		}

		const fillerRanges = parseFillerTimestamps(aiOutput);

		console.log(`Time saved: ${timeSaved(fillerRanges)} seconds`);

		if (fillerRanges.length === 0) {
			console.log('No filler sections found to remove');
			return null;
		}

		console.log(`Found ${fillerRanges.length} filler sections to remove`);

		// Create segments to keep (everything except filler sections)
		const keepSegments = createKeepSegments(fillerRanges, videoInfo.duration);

		if (keepSegments.length === 0) {
			console.log('No segments to keep');
			return null;
		}

		const fileName = path.parse(inputFile).name;
		const outputFile = `src/output/${fileName}_output.mp4`;

		// Ensure output directory exists
		const outputDir = path.dirname(outputFile);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		const filterParts: string[] = [];

		keepSegments.forEach((segment, index) => {
			const duration = segment.end - segment.start;
			filterParts.push(
				`[0:v]trim=start=${segment.start}:duration=${duration},setpts=PTS-STARTPTS[v${index}];`
			);
			filterParts.push(
				`[0:a]atrim=start=${segment.start}:duration=${duration},asetpts=PTS-STARTPTS[a${index}];`
			);
		});

		// Concatenate all segments
		const vInputs = keepSegments.map((_, index) => `[v${index}]`).join('');
		const aInputs = keepSegments.map((_, index) => `[a${index}]`).join('');
		filterParts.push(`${vInputs}concat=n=${keepSegments.length}:v=1:a=0[outv];`);
		filterParts.push(`${aInputs}concat=n=${keepSegments.length}:v=0:a=1[outa]`);

		const filterComplex = filterParts.join('');

		console.log('Processing video segments...');

		await executeFFmpeg([
			'-i',
			inputFile,
			'-filter_complex',
			filterComplex,
			'-map',
			'[outv]',
			'-map',
			'[outa]',
			'-c:v',
			'libx264',
			'-c:a',
			'aac',
			'-y', // Overwrite output file
			outputFile,
		]);

		console.log(`Successfully created ${outputFile}`);
		return outputFile;
	} catch (e) {
		console.error('Error removing filler sections:', e);
		return null;
	}
}

export async function getVideoInfo(file: string) {
	try {
		const output = await executeFFprobe([
			'-v',
			'quiet',
			'-print_format',
			'json',
			'-show_format',
			'-show_streams',
			file,
		]);

		const metadata = JSON.parse(output);
		const videoStream = metadata.streams.find(
			(stream: any) => stream.codec_type === 'video'
		);

		if (!videoStream) {
			console.error('No video stream found');
			return null;
		}

		const duration = parseFloat(metadata.format.duration) || 0;
		const width = parseInt(videoStream.width) || 0;
		const height = parseInt(videoStream.height) || 0;

		let frameRate = 0;
		if (videoStream.r_frame_rate) {
			const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
			frameRate = den ? num / den : 0;
		}

		return { duration, width, height, frameRate };
	} catch (e) {
		console.error('Error with getting video info: ', e);
		return null;
	}
}

export async function trimStart(words: Word[]): Promise<Detection> {
	const firstWord = words[0];
	const start = firstWord.start;
	const end = words[words.length - 1].end;
	return {
		type: 'Pause',
		start: secondsToTimeString(start),
		end: secondsToTimeString(end - 0.5),
		word: 'trimStart',
	};
}

function secondsToTimeString(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);
	const milliseconds = Math.round((seconds % 1) * 1000);

	const hoursStr = hours.toString().padStart(2, '0');
	const minutesStr = minutes.toString().padStart(2, '0');
	const secsStr = secs.toString().padStart(2, '0');
	const msStr = milliseconds.toString().padStart(3, '0');

	return `${hoursStr}:${minutesStr}:${secsStr}.${msStr}`;
}

export function timeSaved(timesRanges: TimeRange[]) {
	let total = 0;
	for (const time of timesRanges) {
		total += time.end - time.start;
	}
	return total;
}
