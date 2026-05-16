// Import required dependencies
import express from "express"; // Web framework for Node.js
import cors from "cors"; // Middleware to enable CORS (Cross-Origin Resource Sharing)
import { supabase } from "./config/supabase.js"; // Supabase client for database operations
import dotenv from "dotenv"; // Load environment variables from .env file

// Load environment variables (API keys, ports, etc.)
dotenv.config();

// Initialize Express application
const app = express();
// Set port from environment variable or default to 3000
const port = process.env.PORT || 3000;

// Middleware setup
app.use(express.json()); // Parse incoming JSON request bodies
app.use(cors()); // Allow cross-origin requests from frontend
app.set("view engine", "ejs"); // Set EJS as the templating engine for rendering HTML

// Route: Home page
// Renders the main landing page (index.ejs)
app.get("/", async (req, res) => {
  res.render("index");
  console.log(data); // Note: 'data' is not defined here - appears to be a debugging oversight
});

// Route: Security Topics page
// Fetches all topics from the 'topic' table in Supabase and passes them to the topics.ejs template
app.get("/topics", async (req, res) => {
  const { data, error } = await supabase.from("topic").select("*");
  res.render("topics", { topics: data });
});

// Route: Vulnerabilities page
// Fetches all vulnerabilities from the 'vulnerability' table and passes them to the vuln.ejs template
app.get("/vuln", async (req, res) => {
  const { data, error } = await supabase.from("vulnerability").select("*");
  res.render("vuln", { vulnerabilities: data });
});

// Route: AI Chat page
// Fetches all topic titles to provide context to the AI assistant,
// then renders the chat interface (ai.ejs) with the topic list
app.get("/chat", async (req, res) => {
  try {
    // Fetch all topic titles from the database to give the AI awareness of available content
    const { data, error } = await supabase.from("topic").select("title");
    let titlesList = [];

    if (error) {
      console.error("Supabase error:", error);
    }

    // Convert array of topics into a comma-separated string for the AI prompt
    if (data && data.length > 0) {
      titlesList = data.map((item) => item.title).join(", ");
    }

    // Render the EJS template and pass the topic list for context
    res.render("ai", {
      titlesList: titlesList,
      pageTitle: "AI Security Assistant - SecureCodeHub",
    });
  } catch (error) {
    console.error("Error loading chat page:", error);
    res.status(500).send("Error loading chat interface");
  }
});

// API Endpoint: AI Chat Handler (POST)
// Receives user messages and conversation history, sends to OpenRouter API (Gemini model),
// and returns AI-generated responses that guide users to relevant security topics
app.post("/api/chat", async (req, res) => {
  // Extract user message and conversation history from request body
  const { message, history = [] } = req.body;

  // Fetch all topic titles to provide context to the AI
  const { data, error } = await supabase.from("topic").select("title");
  let titlesList = [];
  titlesList = data.map((item) => item.title).join(", ");

  try {
    // Call OpenRouter API to get AI response
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`, // API key from environment variables
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openrouter/free", // Use free tier model
          messages: [
            {
              role: "system",
              // System prompt defines AI's role: guide users to relevant security topics on SecureCodeHub
              content: `You are an assistant on a website called SecureCodeHub, which functions as a guide book that helps web developers with no background in security learn what they need to implament security measures to there own websits. and your main job is to guide them to what security topics on this website they need to secure there websites. and this is the database of topics ${titlesList} (assume that its complete for now).`,
            },
            ...history, // Include previous conversation messages for context
            { role: "user", content: message }, // Current user message
          ],
        }),
      },
    );

    const data = await response.json();

    // Handle API errors
    if (!response.ok) {
      throw new Error(data.error?.message || "API Error");
    }

    // Extract AI reply from response
    const reply = data.choices[0].message.content;
    res.json({ reply }); // Send reply back to frontend
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to get response from AI" });
  }
});

// Start the server and listen for incoming requests
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
