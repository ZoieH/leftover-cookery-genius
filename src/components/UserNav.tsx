import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/services/firebaseService';
import AuthModal from '@/components/AuthModal';
import { User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function UserNav() {
  const { user } = useAuthStore();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const navigate = useNavigate();

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <Button 
          variant="default" 
          className="font-medium flex items-center gap-2"
          onClick={() => navigate('/portal')}
        >
          <User className="h-4 w-4" />
          User Portal
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button 
        variant="default" 
        className="font-medium"
        onClick={() => setShowAuthModal(true)}
      >
        Sign up
      </Button>

      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        feature="all premium features"
      />
    </>
  );
} 