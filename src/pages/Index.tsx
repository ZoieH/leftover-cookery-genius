import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Upload, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import ImageUploader from '@/components/ImageUploader';
import Layout from '@/components/Layout';
import { identifyIngredientsFromImage } from '@/services/geminiService';
import { sendTelegramMessage } from './PaymentSuccessPage';

const Index = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);


  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setIsUploading(true);
      try {
        const file = files[0];
        // Convert to base64
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          if (reader.result) {
            handleImageUpload(reader.result.toString());
          }
        };
      } catch (error) {
        console.error('Error processing file:', error);
        setIsUploading(false);
      }
    }
  };

  const handleImageUpload = async (imageData: string) => {
    setImage(imageData);
    setIsUploading(false);
    setIsProcessing(true);
    
    toast({
      title: "Image uploaded successfully!",
      description: "Processing your ingredients...",
    });
    
    try {
      // Process the image with Gemini AI
      const identifiedIngredients = await identifyIngredientsFromImage(imageData);
      
      // Store the identified ingredients in sessionStorage
      // The ingredients already have the structure we need
      const ingredientsForStorage = identifiedIngredients.map((ingredient, index) => ({
        id: index + 1,
        name: ingredient.name,
        quantity: ingredient.quantity || '1', // Use identified quantity or default to 1
        unit: ingredient.unit || 'pieces', // Use identified unit or default to pieces
        selected: true
      }));
      
      sessionStorage.setItem('identified_ingredients', JSON.stringify(ingredientsForStorage));
      
      // Success message
      toast({
        title: "Ingredients identified!",
        description: `Found ${identifiedIngredients.length} ingredients in your image.`,
        variant: "default"
      });
      
      // Navigate to ingredients page
      setTimeout(() => {
        navigate('/ingredients');
      }, 500);
    } catch (error) {
      console.error('Error processing image with Gemini:', error);
      
      toast({
        title: "Error identifying ingredients",
        description: "There was a problem processing your image. Please try again.",
        variant: "destructive"
      });
      
      setIsProcessing(false);
    }
  };

  return (
    <Layout>
      <div className="container py-12">
        <div className="max-w-2xl mx-auto text-center mb-10">
          <h2 className="text-2xl font-semibold mb-4">Ready to cook something amazing?</h2>
          <p className="text-muted-foreground mb-6">
            Snap a picture of your leftover ingredients and we'll suggest delicious recipes you can make.
          </p>
        </div>
        
        <div className="max-w-md mx-auto mb-16">
          <Card>
            <CardContent className="pt-6">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />
              {!image ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-full flex flex-col items-center justify-center">
                    <ImageUploader onImageCapture={handleImageUpload} />
                    
                    <div className="text-center mt-6">
                      <p className="text-sm text-muted-foreground mb-4">
                        Snap a picture of your leftover ingredients and our AI will identify them
                      </p>
                      
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button 
                          variant="outline" 
                          className="flex items-center gap-2"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isProcessing}
                        >
                          <Camera size={18} />
                          Take a Photo
                        </Button>
                        
                        <Button 
                          variant="outline" 
                          className="flex items-center gap-2"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isProcessing}
                        >
                          <Upload size={18} />
                          Upload Image
                        </Button>
                      </div>
                    </div>
                  </div>
                  


                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <img 
                    src={image} 
                    alt="Uploaded ingredients" 
                    className="max-h-64 rounded-md object-cover mb-4" 
                  />
                  
                  <Button 
                    onClick={() => navigate('/ingredients')} 
                    className="w-full"
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 size={16} className="mr-2 animate-spin" />
                        Processing Image...
                      </>
                    ) : (
                      <>
                        Continue to Ingredients
                        <ArrowRight size={16} className="ml-2" />
                      </>
                    )}
                  </Button>
                  
                  {isProcessing && (
                    <div className="mt-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        Gemini AI is analyzing your image to identify ingredients...
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Powered by section */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-2xl font-semibold text-center mb-8">Powered by</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-lg mx-auto">
            {/* Gemini Logo */}
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-primary">
                  <path
                    fill="currentColor"
                    d="M2.5 5.5C2.5 3.84 3.84 2.5 5.5 2.5H8.5C10.16 2.5 11.5 3.84 11.5 5.5V8.5C11.5 10.16 10.16 11.5 8.5 11.5H5.5C3.84 11.5 2.5 10.16 2.5 8.5V5.5ZM12.5 5.5C12.5 3.84 13.84 2.5 15.5 2.5H18.5C20.16 2.5 21.5 3.84 21.5 5.5V8.5C21.5 10.16 20.16 11.5 18.5 11.5H15.5C13.84 11.5 12.5 10.16 12.5 8.5V5.5ZM2.5 15.5C2.5 13.84 3.84 12.5 5.5 12.5H8.5C10.16 12.5 11.5 13.84 11.5 15.5V18.5C11.5 20.16 10.16 21.5 8.5 21.5H5.5C3.84 21.5 2.5 20.16 2.5 18.5V15.5ZM12.5 15.5C12.5 13.84 13.84 12.5 15.5 12.5H18.5C20.16 12.5 21.5 13.84 21.5 15.5V18.5C21.5 20.16 20.16 21.5 18.5 21.5H15.5C13.84 21.5 12.5 20.16 12.5 18.5V15.5Z"
                  />
                </svg>
              </div>
              <h3 className="font-medium">Google Gemini</h3>
            </div>

            {/* ChatGPT Logo */}
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-[#10A37F]/10 rounded-full flex items-center justify-center mx-auto">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#10A37F]">
                  <path
                    fill="currentColor"
                    d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.0314 3.8065L12.53 8.3257l2.02-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.4024-.6813zm2.0107-3.0089l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2046V6.8627a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"
                  />
                </svg>
              </div>
              <h3 className="font-medium">ChatGPT</h3>
             
            </div>
          </div>
        </div>

        {/* How it works section */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-8">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Camera className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-medium">1. Snap a Photo</h3>
              <p className="text-sm text-muted-foreground">
                Take a picture of your leftover ingredients or upload one from your device
              </p>
            </div>
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-medium">2. AI Analysis</h3>
              <p className="text-sm text-muted-foreground">
                Our AI identifies your ingredients and suggests matching recipes
              </p>
            </div>
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" />
                </svg>
              </div>
              <h3 className="font-medium">3. Start Cooking</h3>
              <p className="text-sm text-muted-foreground">
                Follow the recipe instructions and enjoy your delicious meal
              </p>
            </div>
            </div>
          </div>
          
        {/* Features section */}
        <div className="max-w-4xl mx-auto mt-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Smart Recipe Matching</h3>
                  <p className="text-sm text-muted-foreground">
                    Our AI analyzes your ingredients and suggests recipes that make the most of what you have
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Reduce Food Waste</h3>
                  <p className="text-sm text-muted-foreground">
                    Turn your leftover ingredients into delicious meals instead of throwing them away
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-24 py-12 border-t border-border">
          <div className="max-w-4xl mx-auto text-center">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              <div>
                <h4 className="font-medium mb-3">About</h4>
                <p className="text-sm text-muted-foreground">
                  Turn your leftover ingredients into delicious meals with AI-powered recipe suggestions.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-3">Contact</h4>
                <p className="text-sm text-muted-foreground">
                  Have questions? Email us at<br />
                  <a href="mailto:hello@lefto.com" className="text-primary hover:underline">
                    hello@lefto.com
                  </a>
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-3">Follow Us</h4>
                <div className="flex items-center justify-center gap-4">
                  <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </a>
                  <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                    </svg>
                  </a>
                  <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Lefto. All rights reserved.
            </div>
        </div>
      </footer>
    </div>
    </Layout>
  );
};

export default Index;
