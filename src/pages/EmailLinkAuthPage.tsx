import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { completeSignInWithEmailLink } from '@/services/firebaseService';
import { useToast } from '@/components/ui/use-toast';

export default function EmailLinkAuthPage() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const completeSignIn = async () => {
      const { user, error } = await completeSignInWithEmailLink();
      
      if (error) {
        setError(error);
        toast({
          title: "Sign-in Error",
          description: error,
          variant: "destructive",
        });
        // Redirect to home after a delay
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      if (user) {
        toast({
          title: "Welcome to Leftover Cookery Genius!",
          description: "You're now signed in. Ready to cook something delicious?",
        });
        // Redirect to the previous page or home
        const returnUrl = sessionStorage.getItem('authReturnUrl') || '/';
        sessionStorage.removeItem('authReturnUrl');
        navigate(returnUrl);
      }
    };

    completeSignIn();
  }, [navigate, toast]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-semibold text-destructive">Sign-in Error</h1>
          <p className="text-muted-foreground">{error}</p>
          <p className="text-sm">Redirecting you back...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <h1 className="text-2xl font-semibold">Completing Sign-in</h1>
        <p className="text-muted-foreground">Please wait while we verify your email link...</p>
      </div>
    </div>
  );
} 