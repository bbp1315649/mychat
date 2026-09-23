/**
 * Audio Recording and Synthesis Utilities for Real Voice Messaging
 */

export interface RecordingResult {
  blob: Blob;
  dataUrl: string;
  duration: number;
}

export interface ActiveRecorder {
  mediaRecorder: MediaRecorder;
  stream: MediaStream;
  analyser?: AnalyserNode;
  audioContext?: AudioContext;
  getAudioLevel: () => number;
  stop: () => Promise<RecordingResult>;
  cancel: () => void;
}

/**
 * Formats seconds into MM:SS or M:SS
 */
export function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Get the best supported audio MIME type for MediaRecorder
 */
function getSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return '';
}

/**
 * Converts a Blob to a Base64 Data URL
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Starts recording from the user's real microphone with live audio level analysis
 */
export async function startAudioRecording(): Promise<ActiveRecorder> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('دستگاه یا مرورگر شما از ضبط صدا پشتیبانی نمی‌کند.');
  }

  // Request microphone stream with voice-optimized settings
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const mimeType = getSupportedAudioMimeType();
  const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
  const mediaRecorder = new MediaRecorder(stream, options);

  const audioChunks: Blob[] = [];
  const startTime = Date.now();

  // Setup live audio analyser for visual waveforms
  let audioContext: AudioContext | undefined;
  let analyser: AnalyserNode | undefined;
  let dataArray: Uint8Array | undefined;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      audioContext = new AudioCtx();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      dataArray = new Uint8Array(analyser.frequencyBinCount);
    }
  } catch (e) {
    console.warn('AudioContext analyser setup skipped:', e);
  }

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  // Start recording chunks every 200ms
  mediaRecorder.start(200);

  const getAudioLevel = (): number => {
    if (!analyser || !dataArray) return 0;
    analyser.getByteFrequencyData(dataArray as any);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avg = sum / dataArray.length;
    // Normalize to 0 - 100
    return Math.min(100, Math.round((avg / 128) * 100));
  };

  const cleanup = () => {
    try {
      stream.getTracks().forEach((track) => track.stop());
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
      }
    } catch (e) {
      // ignore
    }
  };

  const stop = (): Promise<RecordingResult> => {
    return new Promise((resolve, reject) => {
      mediaRecorder.onstop = async () => {
        cleanup();
        try {
          const duration = Math.max(1, Math.round((Date.now() - startTime) / 1000));
          const effectiveMime = mediaRecorder.mimeType || mimeType || 'audio/webm';
          const blob = new Blob(audioChunks, { type: effectiveMime });
          const dataUrl = await blobToDataUrl(blob);
          resolve({ blob, dataUrl, duration });
        } catch (err) {
          reject(err);
        }
      };

      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    });
  };

  const cancel = () => {
    cleanup();
    if (mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop();
      } catch (e) {
        // ignore
      }
    }
  };

  return {
    mediaRecorder,
    stream,
    analyser,
    audioContext,
    getAudioLevel,
    stop,
    cancel,
  };
}

/**
 * Generates an audible educational voice chime (WAV data URL)
 * Used as an audible fallback for existing demo voice notes that had no recorded fileUrl
 */
export function generateSyntheticVoiceWav(durationSeconds = 3): string {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * Math.max(1, Math.min(10, durationSeconds)));
  const buffer = new Int16Array(numSamples);

  // Generate pleasant harmonic chord / voice tone frequencies
  // Fundamental + harmonic voice frequencies: 220Hz (A3), 330Hz (E4), 440Hz (A4)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Envelope: smooth attack, gentle sustain, soft fade out
    const progress = i / numSamples;
    const envelope = Math.sin(progress * Math.PI) * Math.min(1, t * 10);

    // Human-like vocal chord melody modulation
    const melody = 261.63 + Math.sin(t * 3) * 40; // ~C4 with vibrato
    const s1 = Math.sin(2 * Math.PI * melody * t) * 0.45;
    const s2 = Math.sin(2 * Math.PI * (melody * 1.5) * t) * 0.25;
    const s3 = Math.sin(2 * Math.PI * (melody * 2) * t) * 0.15;
    const sample = (s1 + s2 + s3) * envelope * 0.7;

    buffer[i] = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
  }

  // Create WAV Header
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // "RIFF" chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + buffer.byteLength, true);
  writeString(view, 8, 'WAVE');

  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1: Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, buffer.byteLength, true);

  const combined = new Uint8Array(44 + buffer.byteLength);
  combined.set(new Uint8Array(header), 0);
  combined.set(new Uint8Array(buffer.buffer), 44);

  // Convert to Base64 data URL
  let binary = '';
  const len = combined.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
