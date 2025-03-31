
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Upload, ArrowRight, Search, Utensils, ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import ImageUploader from '@/components/ImageUploader';

const Index = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleImageUpload = (imageData: string) => {
    setImage(imageData);
    setIsUploading(false);
    
    // Simulate successful upload and navigate to ingredients page
    toast({
      title: "Image uploaded successfully!",
      description: "Processing your ingredients...",
    });
    
    // In a real app, we would process the image here before navigating
    setTimeout(() => {
      navigate('/ingredients');
    }, 1500);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="py-6 border-b border-border">
        <div className="container">
          <h1 className="text-3xl font-bold text-primary">Leftover Cookery Genius</h1>
          <p className="text-muted-foreground">Turn your leftovers into delicious meals</p>
        </div>
      </header>
      
      <main className="container flex-1 py-12">
        <div className="max-w-2xl mx-auto text-center mb-10">
          <h2 className="text-2xl font-semibold mb-4">Ready to cook something amazing?</h2>
          <p className="text-muted-foreground mb-6">
            Snap a picture of your leftover ingredients and we'll suggest delicious recipes you can make.
          </p>
        </div>
        
        <Card className="max-w-md mx-auto mb-16">
          <CardContent className="pt-6">
            {!image ? (
              <div className="flex flex-col items-center space-y-4">
                <div className="border-2 border-dashed border-primary/50 rounded-lg p-12 w-full flex flex-col items-center justify-center bg-muted/50">
                  <ImageUploader onImageCapture={handleImageUpload} />
                  
                  <div className="text-center mt-6">
                    <p className="text-sm text-muted-foreground mb-4">
                      Snap a picture of your leftover ingredients and our AI will identify them
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button 
                        variant="outline" 
                        className="flex items-center gap-2"
                        onClick={() => setIsUploading(true)}
                      >
                        <Camera size={18} />
                        Take a Photo
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        className="flex items-center gap-2"
                        onClick={() => setIsUploading(true)}
                      >
                        <Upload size={18} />
                        Upload Image
                      </Button>
                    </div>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  For demo purposes, clicking either button will simulate an image upload
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <img 
                  src={image} 
                  alt="Uploaded ingredients" 
                  className="max-h-64 rounded-md object-cover mb-4" 
                />
                
                <Button onClick={() => navigate('/ingredients')} className="w-full">
                  Continue to Ingredients
                  <ArrowRight size={16} className="ml-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* How It Works Section */}
        <div className="max-w-4xl mx-auto mt-16 px-4">
          <h2 className="text-2xl font-semibold text-center mb-10">How It Works</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Camera className="text-primary w-8 h-8" />
              </div>
              <h3 className="text-lg font-medium mb-2">Snap a Photo</h3>
              <p className="text-muted-foreground">
                Use your camera to take a picture of your leftover ingredients or upload an existing image
              </p>
            </div>
            
            {/* Step 2 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mb-4">
                <Search className="text-secondary w-8 h-8" />
              </div>
              <h3 className="text-lg font-medium mb-2">AI Detection</h3>
              <p className="text-muted-foreground">
                Our AI recognizes your ingredients and allows you to adjust quantities and preferences
              </p>
            </div>
            
            {/* Step 3 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                <ChefHat className="text-accent w-8 h-8" />
              </div>
              <h3 className="text-lg font-medium mb-2">Get Recipes</h3>
              <p className="text-muted-foreground">
                Receive personalized recipe suggestions based on your ingredients and dietary preferences
              </p>
            </div>
          </div>
          
          <div className="flex justify-center mt-10">
            <Button 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="gap-2"
            >
              <Utensils size={18} />
              Get Started
            </Button>
          </div>
        </div>
      </main>
      
      <footer className="py-6 border-t border-border">
        <div className="container text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Leftover Cookery Genius. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Index;
