import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import Layout from '@/components/Layout';
import { handleSuccessfulPayment, storePaymentTransactionDetails } from '@/services/stripeService';
import { useUsageStore } from '@/services/usageService';
import { useAuthStore } from '@/services/firebaseService';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PaymentSuccessPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { setIsPremium, syncPremiumStatus } = useUsageStore();
  const { user } = useAuthStore();
  const [processing, setProcessing] = useState(true);
  const [success, setSuccess] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const db = getFirestore();

  useEffect(() => {
    const processPayment = async () => {
      try {
        // Get data primarily from localStorage (for payment links)
        // Fallback to URL parameters (for server-based payments)
        const params = new URLSearchParams(location.search);
        
        // Check if we have a redirect_status from Stripe, which indicates a successful payment
        const redirectStatus = params.get('redirect_status');
        const isRedirectSuccess = redirectStatus === 'succeeded';
        
        // First try localStorage (our main storage mechanism)
        const storedUserId = localStorage.getItem('payment_user_id');
        const storedNonce = localStorage.getItem('payment_nonce');
        const storedReturnUrl = localStorage.getItem('payment_return_url');
        
        // Then try URL params as fallback
        const urlUserId = params.get('user');
        const urlNonce = params.get('nonce');
        const urlReturnUrl = params.get('returnUrl');
        
        // Use stored values with fallbacks to URL parameters
        const userId = storedUserId || urlUserId || user?.uid;
        const nonce = storedNonce || urlNonce;
        const returnUrl = urlReturnUrl || storedReturnUrl;
        const sessionId = params.get('session_id');
        
        console.log('Processing payment success - localStorage values:', { 
          storedUserId, 
          storedNonce, 
          storedReturnUrl,
          isRedirectSuccess,
          redirectStatus
        });
        
        // Validate required parameters
        if (!userId) {
          toast({
            title: "Error",
            description: "Payment information is missing. Please try again.",
            variant: "destructive"
          });
          setProcessing(false);
          setSuccess(false);
          console.error('No user ID found for payment processing');
          return;
        }

        // Set a flag in localStorage to indicate payment processing in progress
        // This will be used for recovery if the page is closed before completion
        localStorage.setItem('payment_success_pending', 'true');
        localStorage.setItem('payment_user_id', userId);
        if (nonce) {
          localStorage.setItem('payment_nonce', nonce);
        }

        // Immediately update local state for responsive UX
        setIsPremium(true);
        
        try {
          // Record the payment success page visit
          storePaymentTransactionDetails({
            userId,
            success: false, // Will be updated after DB update
            source: 'payment-success-page',
            timestamp: new Date().toISOString(),
            status: 'processing',
            nonce: nonce || undefined,
            returnUrl: returnUrl || undefined
          });

          // If we have a userId, update premium status in the database
          if (userId) {
            // First try to sync premium status if user is logged in to ensure we get the latest state
            if (user && user.uid === userId) {
              await syncPremiumStatus();
            }
            
            // Process the payment through our main handler
            console.log(`Processing payment for user ${userId} with nonce ${nonce || 'none'}`);
            const dbUpdateSuccess = await handleSuccessfulPayment(userId, nonce);
            console.log(`Payment processing result: ${dbUpdateSuccess ? 'success' : 'failed'}`);
            
            if (!dbUpdateSuccess) {
              setWarning('Your premium status was activated, but we encountered an issue syncing with our server. Your access is still enabled, and we\'ll automatically retry the sync.');
            } else {
              // Clear payment processing flags on successful DB update
              localStorage.removeItem('payment_success_pending');
              
              // Don't remove user_id and nonce yet - needed for checking premium status
              // They will be removed on successful redirect or payment verification
              console.log('Payment processing completed successfully - keeping user_id and nonce for verification');
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
          
          // Record the error for later analysis
          storePaymentTransactionDetails({
            userId,
            success: false,
            source: 'payment-success-page',
            timestamp: new Date().toISOString(),
            status: 'error',
            error: updateError instanceof Error ? updateError.message : String(updateError),
            nonce: nonce || undefined
          });
        }
        
        // Always mark as success for user experience
        setSuccess(true);
        setProcessing(false);
        
        // Get return URL from params or localStorage
        let redirectUrl = '/';
        if (returnUrl) {
          redirectUrl = decodeURIComponent(returnUrl);
          console.log('Using returnUrl:', redirectUrl);
        } else {
          console.log('No return URL found, using default: /');
        }
        
        // Store the redirect URL for the Return Now button to use
        localStorage.setItem('success_redirect_url', redirectUrl);
        
        // No auto-redirect - user will click the Return Now button
        console.log('Payment processed successfully. Waiting for user to click Return Now.');
        
      } catch (error: any) {
        console.error('Error processing payment:', error);
        toast({
          title: "Error",
          description: error.message || "There was an error processing your payment.",
          variant: "destructive",
        });
        setProcessing(false);
        setSuccess(false);
        
        // Record the critical error
        if (user) {
          storePaymentTransactionDetails({
            userId: user.uid,
            success: false,
            source: 'payment-success-page',
            timestamp: new Date().toISOString(),
            status: 'critical-error',
            error: error.message || String(error)
          });
        }
      }
    };

    processPayment();
    
    // This cleanup function will run if the component unmounts before processing is complete
    return () => {
      // If we're still processing, make sure we don't lose the payment info
      if (processing) {
        console.log('Payment success page unmounted while processing - preserving payment info for recovery');
        // Don't remove any payment flags if we're still processing
      }
    };
  }, [location.search, toast, setIsPremium, syncPremiumStatus, navigate, user]);

  // Add this as a new function in the component before the return statement
  const handleReturnNow = () => {
    // Get stored redirect URL
    const redirectUrl = localStorage.getItem('success_redirect_url') || '/';
    
    console.log('User clicked Return Now. Redirecting to:', redirectUrl);
    
    // Clean up all payment-related localStorage items when redirecting
    localStorage.removeItem('payment_return_url'); 
    localStorage.removeItem('payment_nonce');
    localStorage.removeItem('payment_user_id');
    localStorage.removeItem('payment_success_pending');
    localStorage.removeItem('payment_initiated');
    localStorage.removeItem('success_redirect_url');
    
    // Navigate to the redirect URL
    navigate(redirectUrl);
  };

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
              </p>
              
              {warning && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-md p-3 mb-4 flex items-start">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0 mr-2 mt-0.5 text-amber-500" />
                  <p className="text-sm text-left">{warning}</p>
                </div>
              )}
              
              <Button 
                onClick={handleReturnNow} 
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