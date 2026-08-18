function analyzeSEO(data) {
  const issues = [];
  let score = 100;

  if (!data.title) {
    issues.push({ type: 'error', category: 'Title', message: 'Missing page title', suggestion: 'Add a descriptive title between 50-60 characters' });
    score -= 20;
  } else if (data.title.length < 30) {
    issues.push({ type: 'warning', category: 'Title', message: `Title is too short (${data.title.length} characters)`, suggestion: 'Aim for 50-60 characters for optimal display' });
    score -= 10;
  } else if (data.title.length > 60) {
    issues.push({ type: 'warning', category: 'Title', message: `Title is too long (${data.title.length} characters)`, suggestion: 'Keep title under 60 characters' });
    score -= 5;
  }

  if (!data.metaDescription) {
    issues.push({ type: 'error', category: 'Meta Description', message: 'Missing meta description', suggestion: 'Add a compelling meta description between 150-160 characters' });
    score -= 15;
  } else if (data.metaDescription.length < 120) {
    issues.push({ type: 'warning', category: 'Meta Description', message: `Meta description is too short (${data.metaDescription.length} characters)`, suggestion: 'Aim for 150-160 characters' });
    score -= 5;
  } else if (data.metaDescription.length > 160) {
    issues.push({ type: 'warning', category: 'Meta Description', message: `Meta description is too long (${data.metaDescription.length} characters)`, suggestion: 'Keep under 160 characters' });
    score -= 5;
  }

  if (data.h1.length === 0) {
    issues.push({ type: 'error', category: 'Headings', message: 'No H1 tag found', suggestion: 'Add exactly one H1 tag that describes the page content' });
    score -= 15;
  } else if (data.h1.length > 1) {
    issues.push({ type: 'warning', category: 'Headings', message: `Multiple H1 tags found (${data.h1.length})`, suggestion: 'Use only one H1 tag per page' });
    score -= 5;
  }

  if (data.h2.length === 0 && data.h1.length > 0) {
    issues.push({ type: 'info', category: 'Headings', message: 'No H2 tags found', suggestion: 'Add H2 tags to organize content into sections' });
    score -= 3;
  }

  const imagesWithoutAlt = data.images.filter(img => !img.alt).length;
  if (imagesWithoutAlt > 0) {
    issues.push({ type: 'warning', category: 'Images', message: `${imagesWithoutAlt} image(s) missing alt text`, suggestion: 'Add descriptive alt text to all images' });
    score -= Math.min(imagesWithoutAlt * 2, 10);
  }

  if (!data.ogTitle) {
    issues.push({ type: 'info', category: 'Social', message: 'Missing Open Graph title', suggestion: 'Add og:title meta tag for better social sharing' });
    score -= 2;
  }

  if (!data.ogDescription) {
    issues.push({ type: 'info', category: 'Social', message: 'Missing Open Graph description', suggestion: 'Add og:description meta tag for social previews' });
    score -= 2;
  }

  if (!data.canonical) {
    issues.push({ type: 'info', category: 'Technical', message: 'No canonical URL set', suggestion: 'Add a canonical link tag to prevent duplicate content issues' });
    score -= 3;
  }

  if (data.wordCount < 300) {
    issues.push({ type: 'warning', category: 'Content', message: `Low word count (${data.wordCount} words)`, suggestion: 'Aim for at least 300 words for meaningful content' });
    score -= 5;
  }

  const recommendations = [];
  if (data.h1.length > 0) recommendations.push(`Your main heading "${data.h1[0].substring(0, 50)}..." is ${data.h1[0].length > 70 ? 'long' : 'good length'}`);
  if (data.wordCount > 500) recommendations.push('Good content length! Keep providing valuable information');
  if (data.links.filter(l => l.isExternal).length > 0) recommendations.push(`You have ${data.links.filter(l => l.isExternal).length} external link(s) which is good for SEO`);

  score = Math.max(0, Math.min(100, score));

  return {
    url: data.url,
    score,
    issues,
    stats: {
      titleLength: data.title.length,
      metaDescLength: data.metaDescription.length,
      h1Count: data.h1.length,
      h2Count: data.h2.length,
      linkCount: data.links.length,
      externalLinkCount: data.links.filter(l => l.isExternal).length,
      imageCount: data.images.length,
      imagesWithoutAlt,
      wordCount: data.wordCount
    },
    recommendations
  };
}

module.exports = { analyzeSEO };
