const express = require('express');
const router = express.Router();

function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

router.post('/', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const totalWords = words.length;
    const totalSentences = sentences.length;
    const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);

    const avgWordsPerSentence = totalSentences > 0 ? (totalWords / totalSentences).toFixed(1) : 0;
    const avgSyllablesPerWord = totalWords > 0 ? (totalSyllables / totalWords).toFixed(1) : 0;

    // Flesch Reading Ease
    const fleschScore = Math.round(206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord);
    const clampedScore = Math.min(100, Math.max(0, fleschScore));

    let grade = '';
    if (clampedScore >= 90) grade = 'Very Easy - 5th grade';
    else if (clampedScore >= 80) grade = 'Easy - 6th grade';
    else if (clampedScore >= 70) grade = 'Fairly Easy - 7th grade';
    else if (clampedScore >= 60) grade = 'Standard - 8th-9th grade';
    else if (clampedScore >= 50) grade = 'Fairly Difficult - 10th-12th grade';
    else if (clampedScore >= 30) grade = 'Difficult - College level';
    else grade = 'Very Difficult - Graduate level';

    // Long words count
    const longWords = words.filter(w => w.length > 6).length;
    const longWordPercent = totalWords > 0 ? Math.round((longWords / totalWords) * 100) : 0;

    res.json({
      success: true,
      data: {
        textLength: text.length,
        wordCount: totalWords,
        sentenceCount: totalSentences,
        avgWordsPerSentence: parseFloat(avgWordsPerSentence),
        avgSyllablesPerWord: parseFloat(avgSyllablesPerWord),
        fleschScore: clampedScore,
        grade,
        longWords,
        longWordPercent
      }
    });
  } catch (error) {
    console.error('Readability error:', error.message);
    res.status(500).json({ error: 'Failed to analyze readability' });
  }
});

module.exports = router;
