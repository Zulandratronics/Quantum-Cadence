import React, { useState, useRef, useCallback } from 'react';
import { getAI, transcribeAudioFile } from '../services/geminiService';
import { Modality, LiveServerMessage } from '@google/genai';
import { MicIcon, UploadIcon } from './icons';
import { Settings, ChevronDown, ChevronUp } from 'lucide-react';
import Loader from './Loader';

// Audio Encoding/Decoding helpers
function encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function createAudioPart(data: Float32Array, sampleRate: number) {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: `audio/pcm;rate=${sampleRate}`,
    };
}

const Transcriber: React.FC = () => {
  // Live recording state
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscription, setLiveTranscription] = useState('');
  const [liveError, setLiveError] = useState('');
  const [liveModel, setLiveModel] = useState('gemini-3.1-flash-live-preview');
  const [transcriptionEncoding, setTranscriptionEncoding] = useState('linear16');
  const [transcriptionSampleRate, setTranscriptionSampleRate] = useState(16000);
  const [transcriptionModel, setTranscriptionModel] = useState('models/speech-to-text');
  const [showSettings, setShowSettings] = useState(false);

  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  // File transcription state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [fileTranscription, setFileTranscription] = useState('');
  const [isFileTranscribing, setIsFileTranscribing] = useState(false);
  const [fileError, setFileError] = useState('');


  const stopRecording = useCallback(async () => {
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => session.close());
        sessionPromiseRef.current = null;
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startRecording = async () => {
    setLiveError('');
    setLiveTranscription('');
    setIsRecording(true);

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const context = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: transcriptionSampleRate });
        audioContextRef.current = context;

        const ai = getAI();
        sessionPromiseRef.current = ai.live.connect({
            model: liveModel,
            config: {
                responseModalities: [Modality.AUDIO],
                inputAudioTranscription: {
                    encoding: transcriptionEncoding,
                    sampleRateHertz: transcriptionSampleRate,
                    model: transcriptionModel
                } as any,
            },
            callbacks: {
                onopen: () => {
                    const source = context.createMediaStreamSource(stream);
                    const scriptProcessor = context.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current = scriptProcessor;

                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmPart = createAudioPart(inputData, transcriptionSampleRate);
                        sessionPromiseRef.current?.then((session) => {
                            session.sendRealtimeInput({ audio: pcmPart });
                        });
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(context.destination);
                },
                onmessage: (message: LiveServerMessage) => {
                    if (message.serverContent?.inputTranscription) {
                        const text = message.serverContent.inputTranscription.text;
                        setLiveTranscription(prev => prev + text);
                    }
                },
                onerror: (e: ErrorEvent) => {
                    console.error('Live API Error:', e);
                    setLiveError('An API error occurred. Please try again.');
                    stopRecording();
                },
                onclose: () => {},
            },
        });
    } catch (err) {
        console.error('Error starting recording:', err);
        setLiveError('Could not start recording. Please ensure microphone access is granted.');
        setIsRecording(false);
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('audio/')) {
        setFileError('Please upload a valid audio file (e.g., .wav, .mp3, .m4a, .webm).');
        setAudioFile(null);
        setFileTranscription('');
        return;
      }
      setAudioFile(file);
      setFileError('');
      setFileTranscription('');
    }
  };
  
  const handleTranscribeFile = async () => {
    if (!audioFile) {
      setFileError('Please select an audio file first.');
      return;
    }
    
    setIsFileTranscribing(true);
    setFileError('');
    setFileTranscription('');
    
    try {
        const result = await transcribeAudioFile(audioFile);
        if (result.startsWith('An error occurred during transcription')) {
            setFileError(result);
        } else {
            setFileTranscription(result);
        }
    } catch (err) {
        console.error("Transcription failed:", err);
        setFileError(`Transcription failed: ${(err as Error).message}`);
    } finally {
        setIsFileTranscribing(false);
    }
  };

  const clearFile = () => {
    setAudioFile(null);
    setFileTranscription('');
    setFileError('');
    const input = document.getElementById('audio-upload') as HTMLInputElement;
    if (input) input.value = '';
  };

  return (
    <div>
       <h2 className="text-2xl font-bold text-gray-100 mb-4 text-center">Transcription Hub</h2>
      <p className="text-gray-400 mb-8 max-w-3xl mx-auto text-center">
        Capture your musical ideas as they come. Use the live transcriber for real-time notes, or upload an existing audio file to get a full transcription.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Live Transcription Card */}
        <div className="flex flex-col bg-gray-800/50 p-6 rounded-lg border border-gray-700">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-100">Live Transcription</h3>
                <button 
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-2 hover:bg-gray-700 rounded-full transition-colors text-gray-400 hover:text-gray-200"
                    title="Transcription Settings"
                >
                    <Settings className="w-5 h-5" />
                </button>
            </div>

            {showSettings && (
                <div className="mb-4 p-4 bg-gray-900/80 rounded-lg border border-gray-600 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Model</label>
                            <select 
                                value={liveModel}
                                onChange={(e) => setLiveModel(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-purple-500"
                            >
                                <option value="gemini-3.1-flash-live-preview">Gemini 3.1 Flash Live</option>
                                <option value="gemini-2.5-flash-native-audio-preview-09-2025">Gemini 2.5 Flash Native Audio</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Encoding</label>
                            <select 
                                value={transcriptionEncoding}
                                onChange={(e) => setTranscriptionEncoding(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-purple-500"
                            >
                                <option value="linear16">Linear16</option>
                                <option value="flac">FLAC</option>
                                <option value="mulaw">mu-law</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Sample Rate (Hz)</label>
                            <input 
                                type="number"
                                value={transcriptionSampleRate}
                                onChange={(e) => setTranscriptionSampleRate(parseInt(e.target.value))}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Transcription Model</label>
                            <input 
                                type="text"
                                value={transcriptionModel}
                                onChange={(e) => setTranscriptionModel(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-purple-500"
                            />
                        </div>
                        <div className="sm:col-span-2 flex justify-end">
                            <button 
                                onClick={() => {
                                    setLiveModel('gemini-3.1-flash-live-preview');
                                    setTranscriptionEncoding('linear16');
                                    setTranscriptionSampleRate(16000);
                                    setTranscriptionModel('models/speech-to-text');
                                }}
                                className="text-xs text-purple-400 hover:text-purple-300 underline"
                            >
                                Reset to Defaults
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-grow w-full bg-gray-900 rounded-lg p-4 border border-gray-600 min-h-[150px]">
                <div className="text-left text-gray-300 leading-relaxed">
                    {liveTranscription || <span className="text-gray-500">Your live transcription will appear here...</span>}
                </div>
            </div>
            {liveError && <p className="text-red-400 mt-2 text-sm text-center">{liveError}</p>}
            <div className="flex flex-col items-center mt-4">
                <button
                    onClick={handleToggleRecording}
                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-purple-500/50 ${
                    isRecording ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-purple-600 hover:bg-purple-700'
                    }`}
                >
                    <MicIcon className="w-8 h-8 text-white" />
                </button>
                <p className="mt-2 text-gray-400 text-sm font-semibold">{isRecording ? 'Recording...' : 'Tap to Record'}</p>
            </div>
        </div>

        {/* File Transcription Card */}
        <div className="flex flex-col bg-gray-800/50 p-6 rounded-lg border border-gray-700">
           <h3 className="text-xl font-bold text-gray-100 mb-4 text-center">Upload & Transcribe</h3>
            <div className="flex-grow w-full bg-gray-900 rounded-lg p-4 border border-gray-600 min-h-[150px]">
              {isFileTranscribing ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <Loader />
                    <p className="mt-4 text-gray-400">Transcribing audio...</p>
                  </div>
              ) : (
                <div className="text-left text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {fileTranscription || <span className="text-gray-500">Upload an audio file and its transcription will appear here...</span>}
                </div>
              )}
            </div>
            {fileError && <p className="text-red-400 mt-2 text-sm text-center">{fileError}</p>}
           <div className="flex flex-col items-center mt-4">
                <div className="w-full flex gap-2">
                    <label htmlFor="audio-upload" className="flex-grow cursor-pointer bg-gray-700 hover:bg-gray-600/80 border border-gray-600 rounded-md p-3 text-center transition">
                        <div className="flex items-center justify-center gap-2 text-gray-300">
                        <UploadIcon className="w-5 h-5"/>
                            <span className="truncate max-w-[200px]">{audioFile ? audioFile.name : 'Choose an audio file'}</span>
                        </div>
                    </label>
                    {audioFile && (
                        <button 
                            onClick={clearFile}
                            className="bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-500/30 px-4 rounded-md transition"
                            title="Clear file"
                        >
                            ✕
                        </button>
                    )}
                </div>
                <input type="file" id="audio-upload" className="hidden" onChange={handleFileChange} accept=".wav,.mp3,.m4a,audio/*"/>
                <button
                    onClick={handleTranscribeFile}
                    disabled={!audioFile || isFileTranscribing}
                    className="mt-3 w-full flex justify-center items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition-all duration-200"
                >
                    {isFileTranscribing ? 'Transcribing...' : 'Transcribe with Gemini'}
                </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Transcriber;