import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useAuthStore, signOutUser } from '@/services/firebaseService';
import { CreditCard, BookMarked, LogOut, Crown, Check, Info, CalendarDays, AlertCircle, ExternalLink } from 'lucide-react';
import PaywallModal from '@/components/PaywallModal';
import { useUsageStore } from '@/services/usageService';
import { Badge } from '@/components/ui/badge';
import { SubscriptionDetails, getSubscriptionDetails, cancelSubscription, reactivateSubscription } from '@/services/stripeService';
import { getSavedRecipes } from '@/services/recipeService';
import type { Recipe } from '@/types/recipe';
import PaymentDebugInfo from '@/components/PaymentDebugInfo';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function UserPortalPage() {
  const [activeTab, setActiveTab] = useState('subscription');
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [isLoadingSavedRecipes, setIsLoadingSavedRecipes] = useState(false);
  const { user } = useAuthStore();
  const { isPremium } = useUsageStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Load subscription details when the component mounts
  useEffect(() => {
    const loadSubscriptionDetails = async () => {
      if (user && isPremium) {
        setIsLoadingDetails(true);
        try {
          const details = await getSubscriptionDetails(user.uid);
          setSubscriptionDetails(details);
        } catch (error) {
          console.error('Error loading subscription details:', error);
        } finally {
          setIsLoadingDetails(false);
        }
      }
    };
    
    loadSubscriptionDetails();
  }, [user, isPremium]);
  
  // Load saved recipes when user is authenticated or tab changes
  useEffect(() => {
    const loadSavedRecipes = async () => {
      if (user && activeTab === 'saved') {
        setIsLoadingSavedRecipes(true);
        try {
          const recipes = await getSavedRecipes(user.uid);
          setSavedRecipes(recipes);
        } catch (error) {
          console.error('Error loading saved recipes:', error);
          toast({
            title: "Error",
            description: "Failed to load saved recipes.",
            variant: "destructive",
          });
        } finally {
          setIsLoadingSavedRecipes(false);
        }
      }
    };
    
    loadSavedRecipes();
  }, [user, activeTab, toast]);

  const handleSignOut = async () => {
    const { error } = await signOutUser();
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Signed out",
        description: "You have been signed out successfully.",
      });
      navigate('/');
    }
  };

  const handleCancelSubscription = async () => {
    if (!user) return;
    
    setIsProcessingAction(true);
    try {
      const success = await cancelSubscription(user.uid);
      if (success) {
        toast({
          title: "Subscription Canceled",
          description: "Your subscription will remain active until the end of the billing period.",
        });
        // Refresh subscription details
        const updatedDetails = await getSubscriptionDetails(user.uid);
        setSubscriptionDetails(updatedDetails);
      } else {
        toast({
          title: "Error",
          description: "Failed to cancel subscription. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleReactivateSubscription = async () => {
    if (!user) return;
    
    setIsProcessingAction(true);
    try {
      const success = await reactivateSubscription(user.uid);
      if (success) {
        toast({
          title: "Subscription Reactivated",
          description: "Your subscription is now active again.",
        });
        // Refresh subscription details
        const updatedDetails = await getSubscriptionDetails(user.uid);
        setSubscriptionDetails(updatedDetails);
      } else {
        toast({
          title: "Error",
          description: "Failed to reactivate subscription. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Function to view a recipe
  const handleViewRecipe = (recipe: Recipe) => {
    // Add debugging to see the recipe structure
    console.log('Recipe to view:', recipe);
    
    // Make sure the recipe has all required fields
    const recipeToSave = {
      ...recipe,
      // Ensure these fields exist to prevent errors in RecipePage
      instructions: Array.isArray(recipe.instructions) ? recipe.instructions : [],
      ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
      prepTime: recipe.prepTime || '0 mins',
      cookTime: recipe.cookTime || '0 mins',
      servings: recipe.servings || 1,
      dietaryTags: Array.isArray(recipe.dietaryTags) ? recipe.dietaryTags : [],
      // Ensure source is present (RecipePage may rely on this)
      source: recipe.source || 'LOCAL',
      // Add any other fields that might be required by the RecipePage component
      author: recipe.author || '',
      attribution: recipe.attribution || '',
      sourceUrl: recipe.sourceUrl || ''
    };
    
    console.log('Saving recipe to session storage:', recipeToSave);
    
    // First, clear the existing data to avoid any stale state
    sessionStorage.removeItem('matching_recipes');
    
    // Then store the updated recipe in session storage
    sessionStorage.setItem('matching_recipes', JSON.stringify([recipeToSave]));
    
    // Navigate to recipe page
    navigate('/recipe');
  };

  if (!user) {
    navigate('/');
    return null;
  }

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Determine subscription status text and color
  const getStatusInfo = () => {
    if (!subscriptionDetails) {
      return { text: 'Active', color: 'text-green-500' };
    }
    
    if (subscriptionDetails.status === 'canceled') {
      return { text: 'Canceled', color: 'text-yellow-500' };
    }
    
    return { text: 'Active', color: 'text-green-500' };
  };

  const statusInfo = getStatusInfo();

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto p-6">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">User Portal</h1>
            <p className="text-muted-foreground">
              Manage your account and preferences
            </p>
          </div>
          {isPremium && (
            <Badge variant="default" className="px-3 py-1">
              <Crown className="h-3 w-3 mr-1" />
              Premium
            </Badge>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="subscription" className="gap-2">
              <Crown className="h-4 w-4" />
              Subscription
            </TabsTrigger>
            <TabsTrigger value="saved" className="gap-2">
              <BookMarked className="h-4 w-4" />
              Saved Recipes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="subscription">
            <Card>
              <CardHeader>
                <CardTitle>Premium Subscription</CardTitle>
                <CardDescription>
                  Manage your subscription and billing details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      {isPremium ? (
                        <>
                          <h3 className="font-semibold flex items-center">
                            Premium Plan
                            <Crown className="h-4 w-4 ml-2 text-yellow-500" />
                            {subscriptionDetails && (
                              <span className={`ml-2 text-sm ${statusInfo.color}`}>
                                ({statusInfo.text})
                              </span>
                            )}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {subscriptionDetails?.status === 'canceled' 
                              ? 'Your subscription will end on the renewal date'
                              : 'Enjoy unlimited access to all premium features'
                            }
                          </p>
                        </>
                      ) : (
                        <>
                          <h3 className="font-semibold">Free Plan</h3>
                          <p className="text-sm text-muted-foreground">
                            Limited features and recipe generation
                          </p>
                        </>
                      )}
                    </div>
                    
                    {!isPremium && (
                      <Button 
                        className="gap-2"
                        onClick={() => setPaywallOpen(true)}
                      >
                        <CreditCard className="h-4 w-4" />
                        Upgrade to Pro
                      </Button>
                    )}
                  </div>
                </div>
                
                {isPremium && subscriptionDetails && (
                  <div className="space-y-4 rounded-lg border p-4">
                    <h3 className="font-semibold">Subscription Details</h3>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <CalendarDays className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <span className="font-medium">Next billing date: </span>
                          {formatDate(subscriptionDetails.renewalDate)}
                          <br />
                          <span className="text-muted-foreground">
                            {subscriptionDetails.status === 'canceled' 
                              ? 'Your subscription will end on this date'
                              : `You'll be charged ${subscriptionDetails.nextBillingAmount} on this date`
                            }
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <span className="font-medium">Subscription started: </span>
                          {formatDate(subscriptionDetails.premiumSince)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-2 text-right">
                      {subscriptionDetails.status === 'canceled' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleReactivateSubscription}
                          disabled={isProcessingAction}
                        >
                          Reactivate Subscription
                        </Button>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-muted-foreground hover:text-destructive"
                            >
                              Cancel Subscription
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Your subscription will remain active until {formatDate(subscriptionDetails.renewalDate)}, 
                                after which it will expire. You will lose access to premium features after this date.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={handleCancelSubscription}
                                disabled={isProcessingAction}
                              >
                                Yes, Cancel
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="space-y-4">
                  <h3 className="font-semibold">Premium Features</h3>
                  <ul className="space-y-2">
                    <li className={`flex items-center gap-2 text-sm ${isPremium ? "text-foreground" : "text-muted-foreground"}`}>
                      {isPremium ? <Check className="h-4 w-4 text-green-500" /> : "•"} Unlimited recipe generations
                    </li>
                    <li className={`flex items-center gap-2 text-sm ${isPremium ? "text-foreground" : "text-muted-foreground"}`}>
                      {isPremium ? <Check className="h-4 w-4 text-green-500" /> : "•"} Advanced filters and customization
                    </li>
                    <li className={`flex items-center gap-2 text-sm ${isPremium ? "text-foreground" : "text-muted-foreground"}`}>
                      {isPremium ? <Check className="h-4 w-4 text-green-500" /> : "•"} Save and organize favorite recipes
                    </li>
                    <li className={`flex items-center gap-2 text-sm ${isPremium ? "text-foreground" : "text-muted-foreground"}`}>
                      {isPremium ? <Check className="h-4 w-4 text-green-500" /> : "•"} Priority support
                    </li>
                  </ul>
                </div>
                
                {/* Payment Debug Information */}
                <PaymentDebugInfo />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="saved">
            <Card>
              <CardHeader>
                <CardTitle>Saved Recipes</CardTitle>
                <CardDescription>
                  Access your favorite and saved recipes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingSavedRecipes ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : savedRecipes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookMarked className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No saved recipes yet.</p>
                    <p className="text-sm">Your saved recipes will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {savedRecipes.map((recipe) => (
                      <div key={recipe.id} className="border rounded-lg p-4 flex flex-col sm:flex-row gap-4">
                        {recipe.image && (
                          <div className="w-full sm:w-24 h-24 rounded-md overflow-hidden flex-shrink-0">
                            <img 
                              src={recipe.image}
                              alt={recipe.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = '/placeholder.svg';
                              }}
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="font-medium text-lg">{recipe.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{recipe.description}</p>
                          <div className="flex flex-wrap gap-2">
                            {recipe.dietaryTags?.map((tag, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex sm:flex-col justify-end gap-2 sm:ml-4">
                          <Button 
                            size="sm" 
                            onClick={() => handleViewRecipe(recipe)}
                            className="w-full flex gap-1 items-center"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-8 flex justify-center">
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
      <PaywallModal 
        isOpen={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        feature="Premium subscription"
      />
    </Layout>
  );
} 