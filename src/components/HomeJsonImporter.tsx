import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { useToast } from './ui/use-toast';
import { Loader2, FileJson, Upload } from 'lucide-react';
import { processAndImportJsonRecipe } from '@/utils/recipeImport';

const HomeJsonImporter: React.FC = () => {
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setJsonFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!jsonFile) {
      toast({
        title: "No File Selected",
        description: "Please select a JSON recipe file to import.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Read the file content
      const fileContent = await readFileAsText(jsonFile);
      
      // Parse the JSON to determine if it's a single recipe or array
      let parsedData;
      try {
        parsedData = JSON.parse(fileContent);
      } catch (error) {
        toast({
          title: "Invalid JSON",
          description: "The file contains invalid JSON. Please check the format.",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }
      
      // Check if we have an array of recipes or a single recipe
      const isArray = Array.isArray(parsedData);
      
      if (isArray) {
        // Check if array is empty
        if (parsedData.length === 0) {
          toast({
            title: "Empty Array",
            description: "The JSON file contains an empty array with no recipes.",
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }
        
        // Import multiple recipes
        let successCount = 0;
        
        for (const recipe of parsedData) {
          try {
            // Process and import individual recipe
            const result = await processAndImportJsonRecipe(JSON.stringify(recipe));
            if (result.success) {
              successCount++;
            }
          } catch (error) {
            console.error("Error importing recipe:", error);
          }
        }
        
        if (successCount > 0) {
          toast({
            title: "Recipes Imported",
            description: `Successfully imported ${successCount} of ${parsedData.length} recipes.`,
            variant: "default"
          });
        } else {
          toast({
            title: "Import Failed",
            description: "Failed to import any of the recipes from the file.",
            variant: "destructive"
          });
        }
      } else {
        // Process single recipe
        const result = await processAndImportJsonRecipe(fileContent);
        
        if (result.success) {
          toast({
            title: "Recipe Imported",
            description: "The recipe was successfully imported to your collection.",
            variant: "default"
          });
        } else {
          toast({
            title: "Import Failed",
            description: result.error || "Failed to import the recipe.",
            variant: "destructive"
          });
        }
      }
      
      // Reset the form
      setJsonFile(null);
      if (document.getElementById('json-file-input') as HTMLInputElement) {
        (document.getElementById('json-file-input') as HTMLInputElement).value = '';
      }
    } catch (error) {
      console.error("Error importing recipe:", error);
      toast({
        title: "Import Error",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to read file content
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          resolve(event.target.result as string);
        } else {
          reject(new Error("Failed to read file"));
        }
      };
      reader.onerror = () => reject(new Error("File read error"));
      reader.readAsText(file);
    });
  };

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <CardTitle className="text-center mb-2">Import Recipe</CardTitle>
        <CardDescription className="text-center mb-6">
          Add one or more recipes from a JSON file
        </CardDescription>
        
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <Input
              id="json-file-input"
              type="file"
              accept=".json"
              onChange={handleFileChange}
              disabled={isLoading}
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground text-center">
              Select a JSON file with a single recipe or an array of recipes
            </p>
          </div>
          
          <Button 
            className="w-full gap-2" 
            onClick={handleImport}
            disabled={!jsonFile || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Import Recipe
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default HomeJsonImporter; 