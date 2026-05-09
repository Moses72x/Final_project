import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: "AIzaSyBPXtOgKKDdoiRsX2_sDgzo80bV9HZAZkk", // Use your Google AI Studio API key
  baseURL: "https://generativelanguage.googleapis.com/v1beta/", // Google's OpenAI-compatible endpoint
});

async function main() {
  const response = await openai.chat.completions.create({
    model: "gemini-2.0-flash", // Specify the Gemini model
    messages: [
      { role: "system", content: "You are a helpful coding assistant." },
      { role: "user", content: "How do I create a promise in JavaScript?" },
    ],
  });

  console.log(response.choices[0].message);
}

main();
