import { scrapeAndSaveRecipe, testWebsiteScraping } from '../services/scraperService';
import { getAllRecipes } from '@/services/firebaseService';

interface BulkScrapeResult {
  totalAttempted: number;
  successful: number;
  failed: {
    url: string;
    error: string;
  }[];
  successfulRecipes: {
    title: string;
    url: string;
  }[];
}

/**
 * The bulk recipe scraper utility
 * This can be run from an admin interface to populate your database
 */
export async function bulkScrapeRecipes(
  urls: string[],
  progressCallback?: (current: number, total: number) => void
): Promise<BulkScrapeResult> {
  console.log(`Starting bulk scrape of ${urls.length} URLs`);
  
  // First test all the URLs to see which ones we can access
  const testResults = await bulkTestRecipeUrls(urls, progressCallback);
  
  // Only proceed with URLs that passed the test
  const validUrls = testResults.validUrls;
  console.log(`${validUrls.length} URLs passed access testing, proceeding with scraping`);
  
  const totalToScrape = validUrls.length;
  const totalAttempted = urls.length;
  let successful = 0;
  const successfulRecipes: Array<{ title: string; url: string; }> = [];
  const failed: string[] = [...testResults.failed]; // Start with URLs that failed testing
  
  // Process each valid URL sequentially to avoid rate limiting
  for (let i = 0; i < totalToScrape; i++) {
    const url = validUrls[i];
    
    try {
      // Report progress, accounting for previously tested URLs
      if (progressCallback) {
        const overallProgress = Math.floor(((testResults.failed.length + i) / totalAttempted) * 100);
        progressCallback(testResults.failed.length + i, totalAttempted);
      }
      
      console.log(`Scraping URL ${i+1}/${totalToScrape}: ${url}`);
      
      // Scrape the recipe and add it to the database
      const result = await scrapeAndSaveRecipe(url);
      
      if (result.success && result.recipe) {
        successful++;
        successfulRecipes.push({
          title: result.recipe.title,
          url
        });
        console.log(`✅ Successfully imported: ${result.recipe.title}`);
      } else {
        failed.push(url);
        console.log(`❌ Failed to import: ${url} - ${result.error}`);
      }
    } catch (error) {
      failed.push(url);
      console.error(`Error scraping URL ${url}:`, error);
    }
    
    // Add a small delay to prevent hitting rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Final progress update
  if (progressCallback) {
    progressCallback(totalAttempted, totalAttempted);
  }
  
  return {
    totalAttempted,
    successful,
    failed: failed.map(url => ({
      url,
      error: 'Unknown error'
    })),
    successfulRecipes
  };
}

/**
 * Pre-defined recipe URLs for popular categories
 * You can add more URLs to these lists as needed
 */
export const recipeUrlLists = {
  quickMeals: [
    'https://www.recipetineats.com/chicken-stir-fry/',
    'https://www.seriouseats.com/quick-easy-stir-fried-beef-with-snap-peas-and-oyster-sauce-recipe',
    'https://www.simplyrecipes.com/recipes/pasta_with_spinach_artichokes_and_ricotta/',
    // Add more quick meal URLs as needed
  ],
  vegetarian: [
    'https://pinchofyum.com/sweet-potato-curry',
    'https://www.thekitchn.com/recipe-vegetarian-chili-22983',
    'https://www.epicurious.com/recipes/food/views/roasted-cauliflower-with-lemon-zest-parsley-capers-and-jalape-o',
    // Add more vegetarian URLs as needed
  ],
  desserts: [
    'https://www.recipetineats.com/chocolate-cake/',
    'https://www.seriouseats.com/best-chocolate-chip-cookie-recipe',
    'https://pinchofyum.com/soft-chocolate-chip-cookies',
    // Add more dessert URLs as needed
  ],
  healthyOptions: [
    'https://www.thekitchn.com/recipe-grain-bowl-with-roasted-sweet-potatoes-and-miso-dressing-252592',
    'https://www.simplyrecipes.com/recipes/quinoa_bowls_with_avocado_and_egg/',
    'https://www.epicurious.com/recipes/food/views/grilled-chicken-and-quinoa-with-matbucha',
    // Add more healthy option URLs as needed
  ]
};

/**
 * Check for recipe duplication to avoid scraping recipes we already have
 */
export async function checkForDuplicateRecipes(urls: string[]): Promise<string[]> {
  // This is a simple implementation. In a real app, you might want to
  // store the source URLs in your database to check more accurately.
  
  // For now, we'll just check if we have recipes with similar titles
  try {
    const existingRecipes = await getAllRecipes();
    
    // Filter out URLs that might lead to recipes we already have
    // This is an approximation based on recipe titles
    return urls.filter(url => {
      // Extract potential title from URL
      const urlSegments = url.split('/');
      const potentialTitle = urlSegments[urlSegments.length - 2] || '';
      
      // Convert URL slug to spaces and capitalize for comparison
      const formattedTitle = potentialTitle
        .replace(/-/g, ' ')
        .replace(/[0-9]/g, '')
        .trim()
        .toLowerCase();
      
      // Check if we have a recipe with a similar title
      const duplicate = existingRecipes.find(recipe => 
        recipe.title.toLowerCase().includes(formattedTitle) || 
        formattedTitle.includes(recipe.title.toLowerCase())
      );
      
      return !duplicate; // Keep URLs that don't match existing recipes
    });
  } catch (error) {
    console.error('Error checking for duplicates:', error);
    return urls; // If we can't check, just return all URLs
  }
}

/**
 * Get all recipe URLs to scrape, filtered for duplicates
 */
export async function getAllRecipeUrlsToScrape(): Promise<string[]> {
  const allUrls: string[] = [];
  
  Object.values(recipeUrlLists).forEach(list => {
    allUrls.push(...list);
  });
  
  return allUrls;
}

/**
 * Bulk test multiple recipe URLs without scraping them
 * @param urls Array of recipe URLs to test
 * @param progressCallback Optional callback for progress updates
 * @returns Results of the testing process
 */
export async function bulkTestRecipeUrls(
  urls: string[],
  progressCallback?: (current: number, total: number) => void
): Promise<{
  successful: number;
  failed: string[];
  total: number;
  validUrls: string[];
}> {
  const total = urls.length;
  let successful = 0;
  const failed: string[] = [];
  const validUrls: string[] = [];
  
  // Process each URL sequentially to avoid rate limiting
  for (let i = 0; i < total; i++) {
    const url = urls[i];
    
    try {
      // Report progress
      if (progressCallback) {
        progressCallback(i, total);
      }
      
      console.log(`Testing URL ${i+1}/${total}: ${url}`);
      
      // Test if the URL can be accessed
      const testResult = await testWebsiteScraping(url);
      
      if (testResult.success) {
        successful++;
        validUrls.push(url);
        console.log(`✅ URL test successful: ${url}`);
      } else {
        failed.push(url);
        console.log(`❌ URL test failed: ${url} - ${testResult.message}`);
      }
    } catch (error) {
      failed.push(url);
      console.error(`Error testing URL ${url}:`, error);
    }
    
    // Add a small delay to prevent hitting rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Final progress update
  if (progressCallback) {
    progressCallback(total, total);
  }
  
  return {
    successful,
    failed,
    total,
    validUrls
  };
}

/**
 * Automatically test a list of URLs and scrape the ones that pass
 * @param urls Array of recipe URLs to test and scrape
 * @param progressCallback Optional callback for progress updates
 * @returns Results of the auto-test-and-scrape process
 */
export async function autoTestAndScrapeUrls(
  urls: string[],
  progressCallback?: (current: number, total: number, phase: 'testing' | 'scraping') => void
): Promise<{
  testedUrls: number;
  validUrls: number;
  scrapedUrls: number;
  recipes: Array<{ title: string; url: string; }>;
}> {
  console.log(`Starting auto-test-and-scrape of ${urls.length} URLs`);
  
  // Phase 1: Test all URLs
  const testResults = await bulkTestRecipeUrls(
    urls, 
    (current, total) => progressCallback?.(current, total, 'testing')
  );
  
  // Phase 2: Scrape valid URLs
  const scrapeResults = await bulkScrapeRecipes(
    testResults.validUrls,
    (current, total) => progressCallback?.(current, total, 'scraping')
  );
  
  return {
    testedUrls: testResults.total,
    validUrls: testResults.successful,
    scrapedUrls: scrapeResults.successful,
    recipes: scrapeResults.successfulRecipes
  };
} 