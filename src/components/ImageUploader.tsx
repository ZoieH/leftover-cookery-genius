import React, { useRef, useState } from 'react';
import { Upload, Camera } from 'lucide-react';

type ImageUploaderProps = {
  onImageCapture: (imageData: string) => void;
};

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageCapture }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Convert file to base64 data URL
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle actual file selection
  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsLoading(true);
    try {
      const files = event.target.files;
      if (files && files.length > 0) {
        const file = files[0];
        // Check that it's an image
        if (!file.type.startsWith('image/')) {
          alert('Please select an image file.');
          setIsLoading(false);
          return;
        }

        // Convert to base64
        const base64 = await fileToBase64(file);
        onImageCapture(base64);
      }
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Error processing image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    setIsLoading(true);
    
    try {
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        // Check that it's an image
        if (!file.type.startsWith('image/')) {
          alert('Please drop an image file.');
          setIsLoading(false);
          return;
        }

        // Convert to base64
        const base64 = await fileToBase64(file);
        onImageCapture(base64);
      }
    } catch (error) {
      console.error('Error processing dropped image:', error);
      alert('Error processing image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div
      className={`w-full min-h-[200px] cursor-pointer transition-colors duration-200 ${
        dragging ? 'bg-primary/20 border-2 border-dashed border-primary' : 'bg-muted/50 border-2 border-dashed border-muted-foreground/30'
      } ${isLoading ? 'opacity-50' : ''} rounded-lg p-12`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={triggerFileInput}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleImageSelect}
      />
      <div className="flex flex-col items-center justify-center h-full">
        <div className="p-6 bg-primary/10 rounded-full mb-6">
          <Upload size={40} className="text-primary" />
        </div>
        <p className="font-medium text-xl mb-2">
          {isLoading ? 'Processing...' : 'Upload an image'}
        </p>
        <p className="text-base text-muted-foreground">
          {dragging ? 'Drop your image here' : 'or drag and drop'}
        </p>
      </div>
    </div>
  );
};

export default ImageUploader;
