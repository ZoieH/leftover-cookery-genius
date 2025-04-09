import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { seedFirebaseDatabase } from '@/utils/seedDatabase';
import { useToast } from '@/components/ui/use-toast';

/**
 * Admin component for seeding the Firebase database with recipes
 * This should only be accessible to administrators in a real application
 */
const AdminSeedDatabase: React.FC = () => {
  const [isSeeding, setIsSeeding] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSeedDatabase = async () => {
    if (isSeeding) return;

    try {
      setIsSeeding(true);
      setResult(null);

      await seedFirebaseDatabase();

      setResult('Database seeded successfully!');
      toast({
        title: 'Success',
        description: 'Database seeded successfully!',
      });
    } catch (error) {
      console.error('Error seeding database:', error);
      setResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
      toast({
        title: 'Error',
        description: 'Failed to seed database. See console for details.',
        variant: 'destructive',
      });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Admin: Seed Database</CardTitle>
        <CardDescription>
          Upload the initial recipe data to Firebase. Only do this once to avoid duplicates.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          This will upload all recipes from the local database to Firebase Firestore.
          Make sure your Firebase configuration is set up correctly in the .env file.
        </p>
        {result && (
          <div className={`p-3 rounded-md mb-4 ${result.startsWith('Error') ? 'bg-destructive/10 text-destructive' : 'bg-green-100 text-green-800'}`}>
            {result}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleSeedDatabase} 
          disabled={isSeeding}
          className="w-full"
        >
          {isSeeding ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Seeding Database...
            </>
          ) : (
            'Seed Database'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default AdminSeedDatabase; 