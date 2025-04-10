import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { sendSignInLink } from '@/services/firebaseService';

interface EmailLinkAuthProps {
  onCancel: () => void;
}

export default function EmailLinkAuth({ onCancel }: EmailLinkAuthProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await sendSignInLink(email);

      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Check your email",
        description: "We've sent you a sign-in link. Click the link to complete sign-in.",
      });
      onCancel(); // Close the auth modal
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <Mail className="mx-auto h-12 w-12 text-primary" />
        <h3 className="text-lg font-medium">Sign in with Email Link</h3>
        <p className="text-sm text-muted-foreground">
          We'll send you a magic link to sign in instantly.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending link...
            </>
          ) : (
            "Send magic link"
          )}
        </Button>
      </form>

      <div className="text-center">
        <Button variant="link" onClick={onCancel}>
          Back to other sign-in options
        </Button>
      </div>
    </div>
  );
} 