import fs from 'fs';
import { OpenAI } from 'openai';
import { Detection, Word } from '../types/transcribe.types';
import 'dotenv/config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export function loadWords(filePath: string): Word[] {
	const raw = fs.readFileSync(filePath, 'utf-8');
	const json = JSON.parse(raw);
	return json.segments.flatMap((s: any) => s.words);
}

export function chunkWords(words: Word[], maxDuration = 15): Word[][] {
	const chunks: Word[][] = [];
	let current: Word[] = [];

	for (const word of words) {
		if (current.length === 0) {
			current.push(word);
			continue;
		}
		const duration = word.end - current[0].start;
		if (duration < maxDuration) {
			current.push(word);
		} else {
			chunks.push(current);
			current = [word];
		}
	}
	if (current.length) chunks.push(current);
	return chunks;
}

function formatChunk(chunk: Word[]): string {
	return chunk
		.map((w) => `- "${w.text}" at ${w.start.toFixed(3)}–${w.end.toFixed(3)}`)
		.join('\n');
}

export async function analyzeChunk(index: number, chunk: Word[]): Promise<Detection[]> {
	const chunkText = formatChunk(chunk);

	const prompt = `
You're an expert at analyzing speech patterns. Given a list of words with timestamps, identify:

- Filler Words: "um", "uh", "like", "you know", etc.
- Pauses: any silence or non-verbal delay > 0.5s between words
- Coughs: any word that sounds like a cough or throat clear

Respond in this JSON format:
[
  { "type": "Filler Word", "start": "00:00:05.120", "end": "00:00:05.500", "word": "um" },
  { "type": "Pause", "start": "00:00:10.000", "end": "00:00:11.000" }
]

important: 
	- The start and end times are in the format HH:MM:SS.sss

Only return real detections. Here's the transcript:

${chunkText}
`;

	const res = await openai.chat.completions.create({
		model: 'gpt-4o',
		messages: [
			{ role: 'system', content: 'You are a speech pattern analyzer.' },
			{ role: 'user', content: prompt },
		],
		temperature: 0.2,
		max_completion_tokens: 1024,
	});

	const content = res.choices[0].message.content!;
	// @ts-ignore
	const json = content.match(/\[.*\]/s)?.[0];
	if (!json) return [];

	try {
		const parsed = JSON.parse(json);
		console.log(`Chunk ${index + 1} analyzed`);
		return parsed;
	} catch (e) {
		console.warn(`⚠️ Failed to parse JSON in chunk ${index + 1}`);
		return [];
	}
}

export function timeToSeconds(t: string): number {
	const [hh, mm, ss] = t.split(':');
	return parseInt(hh) * 3600 + parseInt(mm) * 60 + parseFloat(ss);
}
