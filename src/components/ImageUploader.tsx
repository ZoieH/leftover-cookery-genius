
import React, { useRef, useState } from 'react';
import { Upload, Camera } from 'lucide-react';

type ImageUploaderProps = {
  onImageCapture: (imageData: string) => void;
};

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageCapture }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // In a real app, this would process actual files
  // For this demo, we'll just use a placeholder image
  const handleImageSelect = () => {
    // Use a placeholder image for the demo
    const placeholderImage = '/lovable-uploads/d600b92f-527e-4ada-85b7-50ad5678eca4.png';
    onImageCapture(placeholderImage);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    handleImageSelect();
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div
      className={`w-full h-full cursor-pointer ${dragging ? 'bg-primary/10' : ''}`}
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
      <div className="flex flex-col items-center justify-center">
        <div className="p-3 bg-primary/10 rounded-full mb-2">
          <Upload size={24} className="text-primary" />
        </div>
        <p className="font-medium">Upload an image</p>
        <p className="text-xs text-muted-foreground mt-1">or drag and drop</p>
      </div>
    </div>
  );
};

export default ImageUploader;
