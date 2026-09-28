const { GoogleGenAI } = require('@google/genai');

const MODEL = 'gemini-3.8-flash';

const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_google_gemini_api_key_here') {
    throw new Error(
      'Gemini API key is not configured. Please add GEMINI_API_KEY to your .env file.'
    );
  }

  return new GoogleGenAI({ apiKey });
};

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const generateAnswer = async (question) => {
  try {
    const ai = getClient();

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `You are a helpful FAQ assistant.

Give a clear, concise and accurate answer to this question.
Do not include introductory text.
Do not use markdown.

Question: ${question}`,
    });

    if (!response || !response.text) {
      throw new Error('No response text received from Gemini API');
    }

    return response.text.trim();
  } catch (error) {
    console.error('Gemini generateAnswer error:', error);

    throw new Error(
      `AI Answer Generation failed: ${error.message}`
    );
  }
};

const generateFAQ = async (topic) => {
  const ai = getClient();

  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Gemini FAQ attempt ${attempt}/${maxRetries}`);

      const response = await ai.models.generateContent({
        model: MODEL,
        contents: `Generate one useful FAQ question and answer about this topic:

${topic}

Return ONLY valid JSON in this format:
{
  "question": "FAQ question",
  "answer": "Clear and detailed answer"
}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              question: {
                type: 'STRING',
                description: 'A clear frequently asked question.'
              },
              answer: {
                type: 'STRING',
                description: 'A clear and helpful answer.'
              }
            },
            required: ['question', 'answer']
          }
        }
      });

      if (!response || !response.text) {
        throw new Error('No response received from Gemini API');
      }

      let faqPair;

      try {
        faqPair = JSON.parse(response.text);
      } catch (parseError) {
        throw new Error('Gemini returned an invalid JSON response.');
      }

      if (!faqPair.question || !faqPair.answer) {
        throw new Error('Gemini response is missing question or answer.');
      }

      return faqPair;

    } catch (error) {
      console.error(
        `Gemini generateFAQ attempt ${attempt} failed:`,
        error.message
      );

      const isTemporaryError =
        error.status === 503 ||
        error.status === 429 ||
        error.status === 500;

      if (isTemporaryError && attempt < maxRetries) {
        const delay = 2000 * Math.pow(2, attempt - 1);

        console.log(`Retrying in ${delay / 1000} seconds...`);

        await sleep(delay);
        continue;
      }

      throw new Error(
        `AI FAQ Generation failed: ${error.message}`
      );
    }
  }
};

module.exports = {
  generateAnswer,
  generateFAQ
};