import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { resolve } from 'path';

const execFileAsync = promisify(execFile);
const DATA_DIR = process.env.DATA_DIR || './data';

export async function fetchVideo(url: string, id: string): Promise<string | null> {
  const outputPath = resolve(DATA_DIR, 'media', `${id}.wav`);
  try {
    await execFileAsync(
      'yt-dlp',
      [
        '-x',
        '--audio-format',
        'wav',
        '-o',
        resolve(DATA_DIR, 'media', `${id}.%(ext)s`),
        url,
      ],
      { timeout: 120000 }
    );
  } catch (err) {
    console.error('yt-dlp failed:', err);
    return null;
  }

  if (!existsSync(outputPath)) {
    return null;
  }

  try {
    const audioBuffer = readFileSync(outputPath);
    const deepgramKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramKey) throw new Error('Missing DEEPGRAM_API_KEY');
    const res = await fetch('https://api.deepgram.com/v1/listen?model=nova-3&detect_language=true', {
      method: 'POST',
      headers: { Authorization: `Token ${deepgramKey}` },
      body: audioBuffer,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Deepgram API error ${res.status} ${res.statusText}: ${body}`);
    }
    const data = await res.json();
    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? null;
    unlinkSync(outputPath);
    return transcript;
  } catch (err) {
    console.error('Deepgram transcription failed:', err);
    if (existsSync(outputPath)) unlinkSync(outputPath);
    return null;
  }
}
