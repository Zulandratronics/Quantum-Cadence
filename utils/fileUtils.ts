
export const ACCEPTED_FILE_TYPES: Record<string, string[]> = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'text/plain': ['.txt'],
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'audio/x-m4a': ['.m4a'],
  // Some browsers report .m4a as audio/mp4, so we accept it and handle normalization.
  'audio/mp4': ['.m4a'], 
  'audio/webm': ['.webm'],
  'audio/ogg': ['.ogg'],
};

export type AcceptedMimeType = keyof typeof ACCEPTED_FILE_TYPES;

export interface ProcessedFile {
    file: File;
    type: 'image' | 'audio' | 'text';
    // Base64 for images/audio, text content for .txt
    content: string; 
    // data: URL for image previews
    previewUrl?: string; 
}

/**
 * Validates and processes a file against a list of accepted types.
 * @param selectedFile The file to process.
 * @returns A promise that resolves with the processed file data or rejects with an error message.
 */
export function processAndValidateFile(selectedFile: File): Promise<ProcessedFile> {
  return new Promise((resolve, reject) => {
    
    // Normalize file type for cases like .m4a being reported as 'audio/mp4'
    const normalizedFileType = (selectedFile.type === 'audio/mp4' && selectedFile.name.endsWith('.m4a')) 
        ? 'audio/x-m4a' 
        : selectedFile.type;
    
    // Handle generic audio/webm (often lacks codecs parameter in type string from input)
    // We check if the key starts with the type or if it's an exact match
    const isValidType = Object.keys(ACCEPTED_FILE_TYPES).some(type => 
        normalizedFileType === type || (normalizedFileType.startsWith('audio/webm') && type === 'audio/webm')
    );

    if (!isValidType) {
      return reject(new Error('Unsupported file type. Please upload a .txt, .png, .jpg, .mp3, .wav, .m4a, .webm or .ogg file.'));
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error('An error occurred while reading the file.'));

    reader.onload = () => {
      const result = reader.result as string;
      const fileType = selectedFile.type;

      if (fileType.startsWith('image/')) {
        resolve({
          file: selectedFile,
          type: 'image',
          content: result.split(',')[1],
          previewUrl: result,
        });
      } else if (fileType.startsWith('audio/')) {
        resolve({
          file: selectedFile,
          type: 'audio',
          content: result.split(',')[1],
        });
      } else if (fileType === 'text/plain') {
        resolve({
          file: selectedFile,
          type: 'text',
          content: result,
        });
      }
    };

    if (selectedFile.type.startsWith('image/') || selectedFile.type.startsWith('audio/')) {
      reader.readAsDataURL(selectedFile);
    } else {
      reader.readAsText(selectedFile);
    }
  });
}
