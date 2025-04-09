import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Settings, ArrowLeft } from 'lucide-react';
import Logo from '@/components/Logo';

interface LayoutProps {
  children: React.ReactNode;
  showBackButton?: boolean;
}

const Layout = ({ 
  children, 
  showBackButton = false,
}: LayoutProps) => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b">
        <div className="container max-w-4xl mx-auto py-4">
          <div className="flex flex-col space-y-2">
            <div className="flex justify-between items-center">
              {showBackButton && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(-1)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <Link to="/" className="hover:opacity-90 transition-opacity">
                <Logo />
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              Turn your leftover ingredients into delicious meals
            </p>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};

export default Layout; 