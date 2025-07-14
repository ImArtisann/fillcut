import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { loadWords } from './utils/analyzeSpeech';
import { Word } from './types/transcribe.types';

export async function transcribeWithWhisper(
	inputFile: string,
	model: 'base' | 'small' | 'medium' | 'large' = 'medium'
): Promise<Word[]> {
	const outDir = path.resolve('./transcripts');
	const fileName = path.basename(inputFile, path.extname(inputFile));
	const fileExtension = inputFile.split('.').pop();
	const outputJsonPath = path.join(outDir, `${fileName}.${fileExtension}.words.json`);

	fs.mkdirSync(outDir, { recursive: true });

	return new Promise((resolve, reject) => {
		const cmd = `whisper_timestamped "${inputFile}" --output_dir "${outDir}" --output_format json --model ${model}`;
		console.log(`Running: ${cmd}`);

		exec(cmd, (error, stdout, stderr) => {
			if (error) {
				return reject(`Transcription error: ${error.message}`);
			}

			if (!fs.existsSync(outputJsonPath)) {
				return reject(`Expected output JSON not found at ${outputJsonPath}`);
			}

			const raw = fs.readFileSync(outputJsonPath, 'utf8');
			const parsed = JSON.parse(raw);

			if (!parsed || !parsed.segments) {
				return reject('Unexpected whisper JSON structure');
			}

			resolve(loadWords(outputJsonPath));
		});
	});
}
