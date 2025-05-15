# Leftover Cookery Genius

A smart recipe recommendation app that helps you make delicious meals from leftover ingredients. Built with Vite, React, and Firebase, featuring AI-powered recipe suggestions and premium features through Stripe integration.

## Features

- AI-powered recipe suggestions based on available ingredients
- Premium subscription with Stripe integration
- Firebase authentication and user management
- Real-time recipe saving and favorites
- Spoonacular API integration for recipe data

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Firebase account
- Stripe account
- OpenAI API key
- Spoonacular API key

### Installation

1. Clone the repository:
```bash
git clone [your-repo-url]
cd leftover-cookery-genius
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id

# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
VITE_STRIPE_PREMIUM_PRICE_ID=your_stripe_price_id
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# API Keys
OPENAI_API_KEY=your_openai_api_key
SPOONACULAR_API_KEY=your_spoonacular_api_key
GEMINI_API_KEY=your_gemini_api_key

# App Configuration
VITE_RATE_LIMIT_REQUESTS=100
VITE_RATE_LIMIT_WINDOW_MS=3600000
```

4. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3001`

## Development

To run the Stripe webhook listener locally:
```bash
stripe listen --forward-to localhost:3001/api/webhook
```

## Deployment

The app is configured for deployment on platforms like Vercel or Netlify. Make sure to:
1. Configure environment variables in your deployment platform
2. Set up the Stripe webhook endpoint
3. Configure Firebase security rules

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Recent Updates

- Fixed OpenAI recipe parsing to handle markdown code blocks correctly
- Improved recipe display to ensure all recipes are shown properly
- Enhanced filtering logic for recipe recommendations
- Added better handling of dietary tags for AI-generated recipes

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
3. Add to your `.env` file: `VITE_OPENAI_API_KEY=your_openai_api_key`

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
