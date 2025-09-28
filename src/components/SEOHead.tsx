import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  structuredData?: object;
}

const SEOHead = ({ 
  title = "AI Recipe Generator - Turn Leftovers into Delicious Meals | Lefto",
  description = "Generate recipes with AI from your leftover ingredients. Smart recipe app that reduces food waste. Upload photos of ingredients and get instant AI cooking suggestions.",
  keywords = "AI recipe generator, generate recipes with AI, recipe generator from photo, AI cooking assistant, smart recipe app, AI meal planner, AI sustainable cooking, zero waste recipe generator, cook with what you have AI, reduce food waste app, leftover recipe generator, fridge recipe app, AI food waste reduction",
  canonical,
  ogImage = "https://lefto.com/og-image.jpg",
  structuredData
}: SEOHeadProps) => {
  const fullTitle = title.includes('Lefto') ? title : `${title} | Lefto`;
  
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      {canonical && <link rel="canonical" href={canonical} />}
      
      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:type" content="website" />
      
      {/* Twitter */}
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      
      {/* Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
};

export default SEOHead; 