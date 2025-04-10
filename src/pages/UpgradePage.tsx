import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Check, Loader2 } from 'lucide-react';
import Layout from '@/components/Layout';
import { useUsageStore } from '@/services/usageService';
import { useAuthStore } from '@/services/firebaseService';
import { createCheckoutSession, handleSuccessfulPayment } from '@/services/stripeService';

const UpgradePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { setIsPremium } = useUsageStore();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  const features = [
    'Unlimited recipe searches',
    'Dietary requirement filters',
    'Calorie limits and nutritional filtering',
    'Print shopping lists',
    'Change serving sizes (meal planning)',
    'Priority customer support',
  ];

  // Check for successful payment on component mount
  useEffect(() => {
    const checkPaymentStatus = async () => {
      // Get URL search params
      const params = new URLSearchParams(location.search);
      const success = params.get('success');
      const userId = params.get('user');
      
      // If success parameter exists and we have a user ID
      if (success === 'true' && userId && !processingPayment) {
        setProcessingPayment(true);
        
        try {
          // Update user's premium status in Firestore
          await handleSuccessfulPayment(userId);
          
          // Update local state
          setIsPremium(true);
          
          toast({
            title: "Upgrade Successful!",
            description: "Welcome to Premium! Enjoy all the features.",
          });
          
          // Remove the query parameters from the URL
          navigate('/upgrade', { replace: true });
        } catch (error: any) {
          console.error('Error processing successful payment:', error);
          toast({
            title: "Error Updating Subscription",
            description: error.message || "There was an error updating your subscription status.",
            variant: "destructive",
          });
        } finally {
          setProcessingPayment(false);
        }
      }
    };
    
    checkPaymentStatus();
  }, [location.search, setIsPremium, toast, navigate]);

  const handleUpgrade = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "Please sign in to upgrade to premium.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      await createCheckoutSession(user.uid, user.email!);
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
    <Layout>
      <div className="container max-w-5xl mx-auto p-4">
        <h1 className="text-3xl font-bold text-center mb-8">Upgrade to Premium</h1>
        
        {processingPayment && (
          <div className="bg-green-100 border border-green-300 text-green-700 px-4 py-3 rounded mb-6 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span>Processing your payment...</span>
          </div>
        )}
        
        <div className="grid gap-8 md:grid-cols-2">
          {/* Free Plan */}
          <Card className="relative">
            <CardHeader>
              <CardTitle>Free Plan</CardTitle>
              <CardDescription>Basic features for casual users</CardDescription>
              <div className="text-3xl font-bold mt-2">$0</div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>3 recipe searches per day</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Basic recipe search</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>View basic recipe details</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" disabled>
                Current Plan
              </Button>
            </CardFooter>
          </Card>

          {/* Premium Plan */}
          <Card className="relative border-primary">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-sm px-3 py-0.5 rounded-full">
              Recommended
            </div>
            <CardHeader>
              <CardTitle>Premium Plan</CardTitle>
              <CardDescription>All features for serious cooks</CardDescription>
              <div className="text-3xl font-bold mt-2">
                $4.99
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                onClick={handleUpgrade}
                disabled={loading || processingPayment}
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
            </CardFooter>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Maybe Later
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default UpgradePage; 