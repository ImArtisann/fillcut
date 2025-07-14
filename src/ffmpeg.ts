import { spawn } from 'child_process';
import { promisify } from 'util';

export function executeFFmpeg(args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const ffmpegProcess = spawn('ffmpeg', args);
		let output = '';
		let error = '';

		ffmpegProcess.stdout.on('data', (data) => {
			output += data.toString();
		});

		ffmpegProcess.stderr.on('data', (data) => {
			error += data.toString();
		});

		ffmpegProcess.on('close', (code) => {
			if (code === 0) {
				resolve(output);
			} else {
				reject(new Error(`FFmpeg process exited with code ${code}: ${error}`));
			}
		});
	});
}

export function executeFFprobe(args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const ffprobeProcess = spawn('ffprobe', args);
		let output = '';
		let error = '';

		ffprobeProcess.stdout.on('data', (data) => {
			output += data.toString();
		});

		ffprobeProcess.stderr.on('data', (data) => {
			error += data.toString();
		});

		ffprobeProcess.on('close', (code) => {
			if (code === 0) {
				resolve(output);
			} else {
				reject(new Error(`FFprobe process exited with code ${code}: ${error}`));
			}
		});
	});
}
