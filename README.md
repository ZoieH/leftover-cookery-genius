# Leftover Cookery Genius

A web application that helps you reduce food waste by generating delicious recipes from your leftover ingredients.

## Features

- **Image Recognition**: Upload images of your leftover ingredients using Google Gemini 1.5 Flash model
- **Ingredient Management**: Edit, add, or remove identified ingredients
- **Customizable Recipes**: Set dietary preferences and calorie limits
- **Recipe Generation**: Get personalized recipes based on your available ingredients
- **Recipe Sharing**: Share, print, or save your favorite recipes

## Project info

**URL**: https://lovable.dev/projects/91e84543-1d54-4e92-8254-ac7bc18dd47a

## Technology Stack

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- React Router
- Tanstack Query
- Google Gemini API for ingredient recognition
- OpenAI API for recipe extraction and generation

## Setup

### API Key Setup

To use all features of the application, you need to set up the following API keys:

#### Google Gemini API (for ingredient recognition)

1. Visit [Google AI Studio](https://ai.google.dev/) and sign in with your Google account
2. Create an API key from the API keys section
3. Create a `.env` file in the root of the project (or copy from `.env.example`)
4. Add your API key: `VITE_GEMINI_API_KEY=your_api_key_here`

#### OpenAI API (for recipe extraction)

1. Visit [OpenAI API Keys](https://platform.openai.com/api-keys) and create an account if needed
2. Create a new API key
3. Add to your `.env` file: `VITE_OPENAI_API_KEY=your_openai_api_key_here`

### Running the Project

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

## How to Use

1. Upload a photo of your leftover ingredients
2. Verify and adjust the identified ingredients as needed
3. Set your dietary preferences and calorie goals
4. Generate a custom recipe
5. Cook and enjoy your meal!

## Future Enhancements

- Integration with real image recognition API
- User accounts to save favorite recipes
- Weekly meal planning based on ingredients
- Nutritional information for recipes
- Community features to share custom recipes

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/91e84543-1d54-4e92-8254-ac7bc18dd47a) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```
