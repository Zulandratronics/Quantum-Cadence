
import React, { useState, useRef } from 'react';
import { analyzeSong, generateConceptImages } from '../services/geminiService';
import Loader from './Loader';
import { SparkleIcon, UploadIcon, MusicNoteIcon, MicIcon, DownloadIcon } from './icons';
import { processAndValidateFile, ACCEPTED_FILE_TYPES } from '../utils/fileUtils';
import { AnalysisOptions, VisualizerPoint } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { parseAnalysisResponse } from '../utils/visualizerParser';
import { Visualizer } from './Visualizer';

const renderMarkdown = (text: string) => {
  const lines = text.split('\n');
  return lines.map((line, index) => {
    if (line.startsWith('**') && line.endsWith('**')) {
      return <h3 key={index} className="text-xl font-bold mt-6 mb-2 text-cyan-300">{line.replace(/\*\*/g, '')}</h3>;
    }
    if (/^\d+\./.test(line.trim())) {
      return <p key={index} className="ml-4 my-1">{line}</p>;
    }
     if (line.startsWith('---')) {
      return <hr key={index} className="my-6 border-gray-600" />;
    }
    return <p key={index} className="my-2">{line}</p>;
  });
};

const SongAnalysis: React.FC = () => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [concept, setConcept] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const analysisRef = useRef<HTMLDivElement>(null);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // New Options State
  const [options, setOptions] = useState<AnalysisOptions>({
    includeSuggestions: false,
    analyzeVideo: false,
    includeVideoPrompts: false,
    generateArt: false,
  });

  // Image Gen State
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [canRegen, setCanRegen] = useState(true);
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [regenInput, setRegenInput] = useState('');
  const [regenError, setRegenError] = useState('');
  const [visualizerPoints, setVisualizerPoints] = useState<VisualizerPoint[]>([]);

  const handleExportPDF = async () => {
    if (!analysisRef.current || isExporting) return;
    
    setIsExporting(true);
    try {
        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4',
            putOnlyUsedFonts: true
        });

        const canvas = await html2canvas(analysisRef.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#111827', // Match bg-gray-900
            logging: false,
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            doc.addPage();
            doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        const fileName = title ? `${title.replace(/\s+/g, '_')}_Analysis.pdf` : 'Song_Analysis.pdf';
        doc.save(fileName);
    } catch (err) {
        console.error('PDF Export failed:', err);
        setError('Failed to export PDF. Please try again.');
    } finally {
        setIsExporting(false);
    }
  };

  const handleExportTXT = () => {
    if (!analysis) return;

    let content = '';
    content += `=========================================\n`;
    content += `         QUANTUM CADENCE ANALYSIS        \n`;
    content += `=========================================\n\n`;
    if (title) content += `TITLE:  ${title}\n`;
    if (artist) content += `ARTIST: ${artist}\n`;
    content += `DATE:   ${new Date().toLocaleDateString()}\n\n`;

    if (visualizerPoints && visualizerPoints.length > 0) {
      content += `-----------------------------------------\n`;
      content += `       COMPOSITION TIMELINE PEAKS        \n`;
      content += `-----------------------------------------\n`;
      content += `Time   | Section          | Lyrical | Vocal\n`;
      content += `       |                  | Density | Intensity\n`;
      content += `-------|------------------|---------|----------\n`;
      visualizerPoints.forEach(p => {
        const sectionStr = p.section.padEnd(16, ' ').substring(0, 16);
        const timeStr = p.time.padEnd(6, ' ').substring(0, 6);
        const lyrStr = `${p.lyricalDensity}%`.padStart(7, ' ');
        const vocStr = `${p.vocalIntensity}%`.padStart(7, ' ');
        content += `${timeStr} | ${sectionStr} | ${lyrStr} | ${vocStr}\n`;
      });
      content += `-----------------------------------------\n\n`;
    }

    content += `-----------------------------------------\n`;
    content += `            DETAILED ANALYSIS            \n`;
    content += `-----------------------------------------\n\n`;
    content += analysis;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = title ? `${title.replace(/\s+/g, '_')}_Analysis.txt` : 'Song_Analysis.txt';
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (selectedFile: File | null) => {
    if (!selectedFile) return;
    
    setError('');
    clearFile();

    try {
        const processed = await processAndValidateFile(selectedFile);
        setFile(processed.file);

        switch (processed.type) {
            case 'image':
                setLyrics(''); 
                setFilePreview(processed.previewUrl || null);
                break;
            case 'audio':
                // Do not clear lyrics for audio files
                break;
            case 'text':
                setLyrics(processed.content);
                break;
        }
    } catch (err) {
        setError((err as Error).message);
        clearFile();
    }
  };
  
  const clearFile = () => {
    setFile(null);
    setFilePreview(null);
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Create a blob from the chunks
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Convert blob to File object
        const audioFile = new File([audioBlob], "live-recording.webm", { type: 'audio/webm' });
        
        handleFileChange(audioFile);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError('');
    } catch (err) {
      console.error(err);
      setError("Could not access microphone. Please allow permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFileChange(e.dataTransfer.files?.[0] ?? null);
  };
  
  const handleAnalyze = async () => {
    if (!lyrics && !file) {
      setError('Please provide lyrics, a file, or a recording to analyze.');
      return;
    }

    // Check for API Key if generating art (Nano Banana 2 requirement)
    if (options.generateArt) {
        try {
            const hasKey = await (window as any).aistudio.hasSelectedApiKey();
            if (!hasKey) {
                await (window as any).aistudio.openSelectKey();
                // Proceed assuming success as per guidelines
            }
        } catch (e) {
            console.error("API Key selection failed", e);
        }
    }

    setError('');
    setIsLoading(true);
    setAnalysis('');
    setGeneratedImages([]);
    setCanRegen(true);

    try {
        const result = await analyzeSong(title, artist, lyrics, concept, file, options);
        const parsed = parseAnalysisResponse(result);
        setAnalysis(parsed.cleanMarkdown);
        setVisualizerPoints(parsed.visualizerData);

        if (options.generateArt) {
            setIsGeneratingImages(true);
            const images = await generateConceptImages(title, artist, concept, parsed.cleanMarkdown);
            setGeneratedImages(images);
            setIsGeneratingImages(false);
        }
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        if (errorMessage.includes("Requested entity was not found") || 
            errorMessage.includes("The caller does not have permission") || 
            errorMessage.includes("PERMISSION_DENIED")) {
            setError('Image generation failed. Please ensure you have selected a valid API key from a paid project with billing enabled.');
            await (window as any).aistudio.openSelectKey();
        } else {
            setError('Analysis failed. Please try again.');
        }
    } finally {
        setIsLoading(false);
    }
  };

  const handleRegenSubmit = async () => {
    const words = regenInput.trim().split(/\s+/);
    if (words.length !== 2) {
        setRegenError('Please enter exactly 2 words.');
        return;
    }
    
    // Check for API Key for regen too
    try {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await (window as any).aistudio.openSelectKey();
        }
    } catch (e) {
        console.error("API Key selection failed", e);
    }

    setShowRegenModal(false);
    setIsGeneratingImages(true);
    setCanRegen(false); // One-shot only
    
    try {
        // Use the existing analysis as context
        const images = await generateConceptImages(title, artist, concept, analysis, regenInput);
        setGeneratedImages(images);
    } catch (e) {
        console.error("Regen failed", e);
        const errorMessage = e instanceof Error ? e.message : String(e);
        if (errorMessage.includes("Requested entity was not found") || 
            errorMessage.includes("The caller does not have permission") || 
            errorMessage.includes("PERMISSION_DENIED")) {
            await (window as any).aistudio.openSelectKey();
        }
    } finally {
        setIsGeneratingImages(false);
    }
  };

  const isButtonDisabled = isLoading || (!lyrics && !file);
  const acceptedTypesString = Object.keys(ACCEPTED_FILE_TYPES).join(',');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative">
      <div>
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Song Input</h2>
        <div className="space-y-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Song Title (Optional)"
            className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 focus:ring-purple-500 focus:border-purple-500 transition"
          />
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artist (Optional)"
            className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 focus:ring-purple-500 focus:border-purple-500 transition"
          />
          
          <div className="flex gap-4">
            {/* File Upload Area */}
            <div 
                className="flex-grow border-2 border-dashed border-gray-600 rounded-lg p-4 text-center cursor-pointer hover:border-purple-400 transition-colors bg-gray-900/50 flex flex-col items-center justify-center min-h-[140px]"
                onClick={() => document.getElementById('file-upload')?.click()}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <input type="file" id="file-upload" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)} accept={acceptedTypesString}/>
                {file ? (
                <div className="flex flex-col items-center animate-fadeIn">
                    {filePreview ? (
                        <img src={filePreview} alt="Preview" className="max-h-20 mx-auto mb-2 rounded border border-gray-700"/>
                    ) : file.type.startsWith('audio/') ? (
                        <div className="bg-purple-900/30 p-3 rounded-full mb-2">
                            <MusicNoteIcon className="w-8 h-8 text-purple-400" />
                        </div>
                    ) : null }
                    <p className="text-gray-300 text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                    <button onClick={(e) => { e.stopPropagation(); clearFile(); }} className="mt-2 text-xs text-red-400 hover:text-red-300 font-bold uppercase tracking-wider">Remove File</button>
                </div>
                ) : (
                <div className='flex flex-col items-center gap-2'>
                    <UploadIcon className="w-8 h-8 text-gray-500"/>
                    <p className="text-gray-400 text-sm">Drag & drop or <span className="text-purple-400 font-semibold">browse</span></p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Audio, Images, Text</p>
                </div>
                )}
            </div>

            {/* Recorder Button Area */}
            <div className="w-1/3 border border-gray-700 bg-gray-800/50 rounded-lg flex flex-col items-center justify-center p-2">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        isRecording ? stopRecording() : startRecording();
                    }}
                    disabled={!!file && !isRecording} // Disable if file exists unless currently recording
                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isRecording 
                            ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse' 
                            : !!file 
                                ? 'bg-gray-700 cursor-not-allowed opacity-50' 
                                : 'bg-gray-700 hover:bg-purple-600 hover:shadow-lg hover:scale-105'
                    }`}
                >
                    {isRecording ? (
                        <div className="w-6 h-6 bg-white rounded-sm" /> // Stop Icon
                    ) : (
                        <MicIcon className="w-8 h-8 text-white" />
                    )}
                </button>
                <p className="mt-3 text-xs text-gray-400 font-medium text-center">
                    {isRecording ? <span className="text-red-400 font-bold">Recording...</span> : "Record Input"}
                </p>
            </div>
          </div>

          <textarea
            value={lyrics}
            onChange={(e) => { 
              setLyrics(e.target.value); 
              // Only clear if the file is an image (prevents accidental mismatches)
              // We want to allow lyrics alongside audio.
              if(file && file.type.startsWith('image/')) clearFile(); 
            }}
            placeholder="Paste your lyrics here (optional if audio is provided)..."
            rows={4}
            className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 focus:ring-purple-500 focus:border-purple-500 transition"
          />
          <textarea
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="Describe the concept or theme (Optional)"
            rows={2}
            className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 focus:ring-purple-500 focus:border-purple-500 transition"
          />

          {/* Advanced Options */}
          <div className="bg-gray-800/50 p-4 rounded-md border border-gray-700 space-y-3">
             <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Analysis Controls</h3>
             
             <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                    type="checkbox" 
                    checked={options.includeSuggestions}
                    onChange={(e) => setOptions(prev => ({ ...prev, includeSuggestions: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-600 text-purple-600 focus:ring-purple-500 bg-gray-900" 
                />
                <span className="text-gray-300 group-hover:text-white transition">Include Improvement Suggestions</span>
             </label>

             <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                    type="checkbox" 
                    checked={options.analyzeVideo}
                    onChange={(e) => setOptions(prev => ({ ...prev, analyzeVideo: e.target.checked, includeVideoPrompts: e.target.checked ? prev.includeVideoPrompts : false }))}
                    className="w-4 h-4 rounded border-gray-600 text-purple-600 focus:ring-purple-500 bg-gray-900" 
                />
                <span className="text-gray-300 group-hover:text-white transition">Analyze Video Potential (Screenplay)</span>
             </label>

             {options.analyzeVideo && (
                <label className="flex items-center gap-2 cursor-pointer group ml-6">
                    <input 
                        type="checkbox" 
                        checked={options.includeVideoPrompts}
                        onChange={(e) => setOptions(prev => ({ ...prev, includeVideoPrompts: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-600 text-purple-600 focus:ring-purple-500 bg-gray-900" 
                    />
                    <span className="text-gray-400 group-hover:text-gray-200 transition text-sm">Include Video Gen Prompts (Pacing/Structure)</span>
                </label>
             )}

             <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                    type="checkbox" 
                    checked={options.generateArt}
                    onChange={(e) => setOptions(prev => ({ ...prev, generateArt: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-600 text-purple-600 focus:ring-purple-500 bg-gray-900" 
                />
                <span className="text-gray-300 group-hover:text-white transition">Generate Conceptual Art (2 Images)</span>
             </label>
          </div>

           {error && <p className="text-red-400 text-sm">{error}</p>}
           
          <button
            onClick={handleAnalyze}
            disabled={isButtonDisabled}
            className="w-full flex justify-center items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-md transition-all duration-200"
          >
            {isLoading ? (
              <>
                <Loader /> Analyzing...
              </>
            ) : (
                <>
                <SparkleIcon className="w-5 h-5" /> Analyze with Gemini Pro
                </>
            )}
          </button>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-100">Analysis Output</h2>
            {analysis && !isLoading && (
                <div className="flex gap-2">
                    <button 
                        onClick={handleExportTXT}
                        className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-gray-800 hover:bg-gray-750 text-cyan-400 border border-cyan-500/30 px-3 py-1.5 rounded-md transition-all cursor-pointer"
                        title="Download as a formatted Plain Text file"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Export TXT
                    </button>
                    <button 
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-gray-800 hover:bg-gray-700 text-purple-400 border border-purple-500/30 px-3 py-1.5 rounded-md transition-all disabled:opacity-50 cursor-pointer"
                        title="Download as a PDF document"
                    >
                        {isExporting ? <Loader /> : <DownloadIcon className="w-4 h-4" />}
                        {isExporting ? 'Exporting...' : 'Export PDF'}
                    </button>
                </div>
            )}
        </div>
        <div className="bg-gray-900/70 p-4 rounded-md border border-gray-700 min-h-[60vh] flex flex-col gap-6">
          {/* Analysis Text */}
          <div ref={analysisRef} className="text-gray-300 leading-relaxed whitespace-pre-wrap flex-grow p-2">
            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-40">
                <Loader />
                <p className="mt-4 text-gray-400">Gemini is listening & thinking...</p>
                </div>
            ) : analysis ? (
                <>
                    {(title || artist) && (
                        <div className="mb-6 border-b border-gray-700 pb-4">
                            {title && <h1 className="text-3xl font-black text-white uppercase tracking-tighter">{title}</h1>}
                            {artist && <p className="text-purple-400 font-mono text-sm uppercase tracking-widest mt-1">{artist}</p>}
                        </div>
                    )}
                    {visualizerPoints && visualizerPoints.length > 0 && (
                        <div className="mb-6">
                            <Visualizer data={visualizerPoints} />
                        </div>
                    )}
                    {renderMarkdown(analysis)}
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                    <SparkleIcon className="w-16 h-16 mb-4"/>
                    <p>Your detailed song analysis will appear here.</p>
                </div>
            )}
          </div>

          {/* Generated Images Section */}
          {(isGeneratingImages || generatedImages.length > 0) && (
              <div className="border-t border-gray-700 pt-6">
                  <h3 className="text-xl font-bold text-gray-100 mb-4 flex items-center gap-2">
                      <span className="text-purple-400">◆</span> Conceptual Art
                  </h3>
                  
                  {isGeneratingImages ? (
                        <div className="flex flex-col items-center justify-center py-8 bg-gray-800/30 rounded-lg">
                            <Loader />
                            <p className="mt-3 text-sm text-gray-400 animate-pulse">Designing visuals from analysis context...</p>
                        </div>
                  ) : (
                      <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            {generatedImages.map((img, idx) => (
                                <div key={idx} className="group relative aspect-square bg-gray-800 rounded-lg overflow-hidden border border-gray-600 shadow-lg">
                                    <img src={img} alt={`Concept Art ${idx + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <a href={img} download={`quantum-cadence-concept-${idx}.png`} className="bg-white/90 hover:bg-white text-gray-900 px-3 py-1 rounded text-sm font-bold">Download</a>
                                    </div>
                                </div>
                            ))}
                          </div>
                          
                          {canRegen && generatedImages.length > 0 && (
                            <button 
                                onClick={() => setShowRegenModal(true)}
                                className="text-xs text-purple-400 hover:text-purple-300 underline underline-offset-4"
                            >
                                Not quite right? Regenerate (One-Shot)
                            </button>
                          )}
                      </div>
                  )}
              </div>
          )}
        </div>
      </div>

      {/* Regen Modal */}
      {showRegenModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm rounded-lg">
            <div className="bg-gray-800 border border-gray-600 p-6 rounded-lg shadow-2xl max-w-sm w-full mx-4">
                <h3 className="text-lg font-bold text-white mb-2">Refine Conceptual Art</h3>
                <p className="text-sm text-gray-400 mb-4">You have <span className="text-purple-400 font-bold">one shot</span> to adjust the vibe. Enter exactly 2 words to steer the generation.</p>
                
                <input 
                    type="text" 
                    value={regenInput}
                    onChange={(e) => {
                        setRegenInput(e.target.value);
                        setRegenError('');
                    }}
                    placeholder="e.g. 'Darker Cyberpunk' or 'Softer Pastels'"
                    className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:ring-purple-500 mb-2"
                />
                {regenError && <p className="text-red-400 text-xs mb-3">{regenError}</p>}
                
                <div className="flex justify-end gap-3 mt-4">
                    <button 
                        onClick={() => setShowRegenModal(false)}
                        className="px-3 py-1 text-gray-400 hover:text-white"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleRegenSubmit}
                        className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded font-medium"
                    >
                        Regenerate
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default SongAnalysis;
