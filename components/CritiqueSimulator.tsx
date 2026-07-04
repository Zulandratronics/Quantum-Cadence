import React, { useState } from 'react';
import { getCritique } from '../services/geminiService';
import Loader from './Loader';
import { UsersIcon, UploadIcon, MusicNoteIcon } from './icons';
import { processAndValidateFile, ACCEPTED_FILE_TYPES } from '../utils/fileUtils';

const renderMarkdown = (text: string) => {
  const lines = text.split('\n');
  return lines.map((line, index) => {
    if (line.startsWith('**') && line.endsWith('**')) {
      return <h3 key={index} className="text-xl font-bold mt-6 mb-2 text-cyan-300">{line.replace(/\*\*/g, '')}</h3>;
    }
     if (line.startsWith('---')) {
      return <hr key={index} className="my-6 border-gray-600" />;
    }
    return <p key={index} className="my-2">{line}</p>;
  });
};

const personas = [
    { id: 'producer', name: 'The Seasoned Producer', description: 'Focuses on arrangement, production, and hits.' },
    { id: 'poet', name: 'The Lyrical Poet', description: 'Dives deep into wordplay and emotional resonance.' },
    { id: 'theorist', name: 'The Music Theorist', description: 'Analyzes structure, harmony, and composition.' },
    { id: 'cynic', name: 'The Cynical Critic', description: 'Brutally honest, looking for every flaw.' },
    { id: 'fan', name: 'The Enthusiastic Fan', description: 'Hyped-up, positive, and full of excitement.' },
];


const CritiqueSimulator: React.FC = () => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [concept, setConcept] = useState('');
  const [critique, setCritique] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [persona, setPersona] = useState<string>(personas[0].id);

  const handleFileChange = async (selectedFile: File | null) => {
    if (!selectedFile) return;
    
    setError('');
    // Clear previous file state before processing new one
    clearFile();

    try {
        const processed = await processAndValidateFile(selectedFile);
        setFile(processed.file);

        switch (processed.type) {
            case 'image':
                setLyrics(''); // Can't have lyrics and an image
                setFilePreview(processed.previewUrl || null);
                break;
            case 'audio':
                setLyrics(''); // Can't have lyrics and audio
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

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFileChange(e.dataTransfer.files?.[0] ?? null);
  };
  
  const handleGetCritique = async () => {
    if (!lyrics && !file) {
      setError('Please provide lyrics or a file for critique.');
      return;
    }
    setError('');
    setIsLoading(true);
    setCritique('');
    const result = await getCritique(title, artist, lyrics, concept, file, persona);
    setCritique(result);
    setIsLoading(false);
  };

  const isButtonDisabled = isLoading || (!lyrics && !file);
  const acceptedTypesString = Object.keys(ACCEPTED_FILE_TYPES).join(',');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Critique Input</h2>
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
          <div 
            className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center cursor-pointer hover:border-purple-400 transition-colors bg-gray-900/50"
            onClick={() => document.getElementById('critique-file-upload')?.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input type="file" id="critique-file-upload" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)} accept={acceptedTypesString}/>
            {file ? (
              <div className="flex flex-col items-center">
                {filePreview ? (
                    <img src={filePreview} alt="Preview" className="max-h-24 mx-auto mb-2 rounded border border-gray-700"/>
                ) : file.type.startsWith('audio/') ? (
                    <MusicNoteIcon className="w-16 h-16 text-gray-500 mb-2" />
                ) : null }
                <p className="text-gray-300 text-sm font-medium">{file.name}</p>
                <button onClick={(e) => { e.stopPropagation(); clearFile(); }} className="mt-1 text-xs text-red-400 hover:text-red-300">Remove</button>
              </div>
            ) : (
              <div className='flex flex-col items-center gap-2'>
                <UploadIcon className="w-8 h-8 text-gray-500"/>
                <p className="text-gray-400">Drag & drop or <span className="text-purple-400 font-semibold">browse</span></p>
                <p className="text-xs text-gray-500">.txt, .png, .jpg, .mp3, .wav, .m4a</p>
              </div>
            )}
          </div>
          <textarea
            value={lyrics}
            onChange={(e) => { 
              setLyrics(e.target.value);
              // If user starts typing, remove any non-text file
              if(file && file.type !== 'text/plain') clearFile(); 
            }}
            placeholder="Paste your lyrics here..."
            rows={8}
            className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 focus:ring-purple-500 focus:border-purple-500 transition"
          />
          <textarea
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="Describe the concept or theme (Optional)"
            rows={3}
            className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 focus:ring-purple-500 focus:border-purple-500 transition"
          />
           <div className="bg-gray-900/70 p-4 rounded-md border border-gray-700">
             <label className="block text-sm font-medium text-gray-300 mb-2">Choose a Critic Persona</label>
             <select
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 focus:ring-purple-500 focus:border-purple-500 transition"
             >
                {personas.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>
            <p className="text-xs text-gray-400 mt-2">{personas.find(p => p.id === persona)?.description}</p>
           </div>
           {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={handleGetCritique}
            disabled={isButtonDisabled}
            className="w-full flex justify-center items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-md transition-all duration-200"
          >
            {isLoading ? (
              <>
                <Loader /> Critiquing...
              </>
            ) : (
                <>
                <UsersIcon className="w-5 h-5" /> Get Critique
                </>
            )}
          </button>
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Critique Output</h2>
        <div className="bg-gray-900/70 p-4 rounded-md border border-gray-700 min-h-[60vh] text-gray-300 leading-relaxed whitespace-pre-wrap">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader />
              <p className="mt-4 text-gray-400">The critic is listening...</p>
               <p className="mt-2 text-sm text-gray-500">Please wait for their feedback.</p>
            </div>
          ) : critique ? (
            <div>{renderMarkdown(critique)}</div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                <UsersIcon className="w-16 h-16 mb-4"/>
                <p>The critic's feedback will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CritiqueSimulator;