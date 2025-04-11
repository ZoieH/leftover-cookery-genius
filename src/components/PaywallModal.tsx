import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/services/firebaseService';
import { createCheckoutSession } from '@/services/stripeService';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: string;
}

const PaywallModal = ({ isOpen, onClose, feature }: PaywallModalProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [loading, setLoading] = React.useState(false);

  const features = [
    'Unlimited recipe searches',
    'All dietary requirement filters',
    'Calorie limits and nutritional filtering',
    'Print shopping lists',
    'Change serving sizes (meal planning)',
    'Priority customer support',
  ];

  const handleUpgrade = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "Please sign in to upgrade to premium.",
        variant: "destructive",
      });
      onClose();
      navigate('/login'); // Adjust to your auth route if different
      return;
    }

    setLoading(true);
    
    try {
      // Go directly to Stripe checkout
      await createCheckoutSession(user.uid, user.email!);
      // The createCheckoutSession function will handle the redirect
      onClose();
    } catch (error: any) {
      toast({
        title: "Upgrade Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upgrade to Premium</DialogTitle>
          <DialogDescription>
            {feature ? (
              <>
                <span className="text-primary font-medium">{feature}</span> is a premium feature.
                Upgrade now to unlock all premium features!
              </>
            ) : (
              'Unlock all premium features to get the most out of your cooking experience!'
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            {features.map((feat, index) => (
              <div key={index} className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-1" />
                <span>{feat}</span>
              </div>
            ))}
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <div className="text-2xl font-bold">
              $4.99
              <span className="text-sm font-normal text-muted-foreground">/month</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Cancel anytime. No commitment required.
            </p>
            <p className="text-sm font-medium mt-2">
              Use code <span className="font-bold text-primary">ZOIEFRIEND</span> for your first month free!
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button 
              onClick={handleUpgrade} 
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Upgrade Now'
              )}
            </Button>
            <Button variant="outline" onClick={onClose} className="w-full">
              Maybe Later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaywallModal; 