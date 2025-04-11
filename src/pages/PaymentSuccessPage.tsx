import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import Layout from '@/components/Layout';
import { handleSuccessfulPayment } from '@/services/stripeService';
import { useUsageStore } from '@/services/usageService';
import { useAuthStore } from '@/services/firebaseService';

const PaymentSuccessPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { setIsPremium, syncPremiumStatus } = useUsageStore();
  const { user } = useAuthStore();
  const [processing, setProcessing] = useState(true);
  const [success, setSuccess] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    const processPayment = async () => {
      try {
        // Parse URL parameters
        const params = new URLSearchParams(location.search);
        const userId = params.get('user') || user?.uid;
        const sessionId = params.get('session_id');
        const nonce = params.get('nonce');
        const returnUrl = params.get('returnUrl');
        
        console.log('Processing payment success:', { userId, sessionId, nonce });

        // Validate required parameters
        if (!userId && !sessionId) {
          toast({
            title: "Error",
            description: "Payment information is missing. Please try again.",
            variant: "destructive"
          });
          setProcessing(false);
          setSuccess(false);
          return;
        }

        // Immediately update local state for responsive UX
        setIsPremium(true);
        
        // Set up recovery if the page is closed before processing completes
        localStorage.setItem('payment_success_pending', 'true');
        if (userId) {
          localStorage.setItem('pending_premium_user_id', userId);
        }
        
        try {
          // If we have a userId, update premium status in the database
          if (userId) {
            // First try to sync premium status if user is logged in to ensure we get the latest state
            if (user && user.uid === userId) {
              await syncPremiumStatus();
            }
            
            const dbUpdateSuccess = await handleSuccessfulPayment(userId, nonce);
            
            if (!dbUpdateSuccess) {
              setWarning('Your premium status was activated, but we encountered an issue syncing with our server. Your access is still enabled, and we\'ll automatically retry the sync.');
            }
            
            // Re-sync to ensure everything is updated correctly
            if (user && user.uid === userId) {
              setTimeout(async () => {
                await syncPremiumStatus();
              }, 1000); // Slight delay to allow database updates to propagate
            }
          } 
          else if (sessionId) {
            // For server-initiated flow (likely not used in client-only mode)
            localStorage.setItem('isPremium', 'true');
            localStorage.setItem('premiumSince', new Date().toISOString());
            setWarning('Your payment was successful, but we couldn\'t identify your account. Please contact support if you experience any issues with premium access.');
          }
          
          // Show success toast
          toast({
            title: "Premium Activated!",
            description: "You now have access to all premium features.",
          });
        } catch (updateError) {
          console.error('Error updating user status:', updateError);
          setWarning('We had trouble updating your account status on our servers, but your premium access has been activated locally. We\'ll automatically try again later.');
          
          // Store information for later retry
          localStorage.setItem('payment_recovery_needed', 'true');
          if (userId) {
            localStorage.setItem('recovery_user_id', userId);
          }
        }
        
        // Clear pending flags since we've handled the payment
        localStorage.removeItem('payment_success_pending');
        localStorage.removeItem('pending_premium_user_id');
        
        // Always mark as success for user experience
        setSuccess(true);
        setProcessing(false);
        
        // Get return URL from params or localStorage
        let redirectUrl = '/';
        if (returnUrl) {
          redirectUrl = decodeURIComponent(returnUrl);
          console.log('Using returnUrl from params:', redirectUrl);
        } else {
          const storedReturnUrl = localStorage.getItem('payment_return_url');
          if (storedReturnUrl) {
            redirectUrl = storedReturnUrl;
            console.log('Using returnUrl from localStorage:', redirectUrl);
            localStorage.removeItem('payment_return_url'); // Clean up
          } else {
            console.log('No return URL found, using default: /');
          }
        }
        
        // Delay redirect to show success message and potential warnings
        setTimeout(() => {
          console.log('Redirecting to:', redirectUrl);
          navigate(redirectUrl);
        }, warning ? 5000 : 2000); // Longer delay if there's a warning
      } catch (error: any) {
        console.error('Error processing payment:', error);
        toast({
          title: "Error",
          description: error.message || "There was an error processing your payment.",
          variant: "destructive",
        });
        setProcessing(false);
        setSuccess(false);
      }
    };

    processPayment();
  }, [location.search, toast, setIsPremium, syncPremiumStatus, navigate, user]);

  return (
    <Layout>
      <div className="container max-w-md mx-auto py-12 px-4">
        <div className="bg-card border rounded-lg shadow-sm p-6 text-center">
          {processing ? (
            <>
              <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin mb-4" />
              <h1 className="text-2xl font-bold mb-2">Processing Your Payment</h1>
              <p className="text-muted-foreground mb-6">
                Please wait while we confirm your subscription...
              </p>
            </>
          ) : success ? (
            <>
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
              <p className="text-muted-foreground mb-6">
                Thank you for upgrading to Premium! You now have access to all premium features.
                <br />
                <span className="text-sm mt-2 block">
                  Redirecting you back in a few seconds...
                </span>
              </p>
              
              {warning && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-md p-3 mb-4 flex items-start">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0 mr-2 mt-0.5 text-amber-500" />
                  <p className="text-sm text-left">{warning}</p>
                </div>
              )}
              
              <Button 
                onClick={() => {
                  // Get return URL from params or localStorage
                  const params = new URLSearchParams(location.search);
                  const returnUrl = params.get('returnUrl');
                  
                  let redirectUrl = '/';
                  
                  if (returnUrl) {
                    redirectUrl = decodeURIComponent(returnUrl);
                  } else {
                    const storedReturnUrl = localStorage.getItem('payment_return_url');
                    if (storedReturnUrl) {
                      redirectUrl = storedReturnUrl;
                      localStorage.removeItem('payment_return_url'); // Clean up
                    }
                  }
                  
                  navigate(redirectUrl);
                }} 
                className="w-full"
              >
                Return Now
              </Button>
            </>
          ) : (
            <>
              <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Something Went Wrong</h1>
              <p className="text-muted-foreground mb-6">
                We couldn't process your payment. Please try again or contact support.
              </p>
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={() => navigate('/upgrade')} 
                  className="w-full"
                >
                  Try Again
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/')} 
                  className="w-full"
                >
                  Return Home
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default PaymentSuccessPage; 