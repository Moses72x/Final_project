// Import required dependencies
import express from "express"; // Web framework for Node.js
import cors from "cors"; // Middleware to enable CORS (Cross-Origin Resource Sharing)
import { supabase } from "./config/supabase.js"; // Supabase client for database operations
import dotenv from "dotenv"; // Load environment variables from .env file
import path from "path"; // For handling file paths
import { fileURLToPath } from "url"; // For ES module compatibility
import { runScan } from "./scanner.js"; // Import the vulnerability scanner

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables (API keys, ports, etc.)
dotenv.config();

// Initialize Express application
const app = express();
// Set port from environment variable or default to 3000
const port = process.env.PORT || 3000;

// Middleware setup
app.use(express.json()); // Parse incoming JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Configure CORS for Render deployment
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.RENDER_URL || "https://your-app.onrender.com"
        : "http://localhost:3000",
    credentials: true,
  }),
);

// Set view engine and views directory
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// Serve static files from public directory (if you have one)
app.use(express.static(path.join(__dirname, "public")));

// Route: Home page
app.get("/", async (req, res) => {
  try {
    // Fetch a random security tip from the security_tip table
    const { data: tips, error } = await supabase
      .from("security_tip")
      .select("tip");

    let randomTip = null;

    if (error) {
      console.error("Error fetching security tips:", error);
    } else if (tips && tips.length > 0) {
      // Select a random tip from the array
      const randomIndex = Math.floor(Math.random() * tips.length);
      randomTip = tips[randomIndex].tip;
      console.log(`[Home Page] Loaded security tip: "${randomTip}"`);
    } else {
      console.log("[Home Page] No security tips found in database");
    }

    // Render the index page with the random tip
    res.render("index", { securityTip: randomTip });
  } catch (error) {
    console.error("Error rendering index:", error);
    res.status(500).send("Error loading home page");
  }
});

// Route: Security Topics page
app.get("/topics", async (req, res) => {
  try {
    const { data, error } = await supabase.from("topic").select("*");
    if (error) throw error;
    res.render("topics", { topics: data || [] });
  } catch (error) {
    console.error("Error fetching topics:", error);
    res.status(500).send("Error loading topics page");
  }
});

// Route: Vulnerabilities page
app.get("/vuln", async (req, res) => {
  try {
    const { data, error } = await supabase.from("vulnerability").select("*");
    if (error) throw error;
    res.render("vuln", { vulnerabilities: data || [] });
  } catch (error) {
    console.error("Error fetching vulnerabilities:", error);
    res.status(500).send("Error loading vulnerabilities page");
  }
});

// Route: AI Chat page
app.get("/chat", async (req, res) => {
  try {
    // Fetch all topic titles from the database to give the AI awareness of available content
    const { data, error } = await supabase.from("topic").select("title");

    // Fetch all preset questions from the ai_question table
    const { data: aiQuestions, error: aiQuestionsError } = await supabase
      .from("ai_question")
      .select("*");

    let titlesList = [];

    if (error) {
      console.error("Supabase error fetching topics:", error);
    }

    if (aiQuestionsError) {
      console.error("Supabase error fetching AI questions:", aiQuestionsError);
    }

    // Convert array of topics into a comma-separated string for the AI prompt
    if (data && data.length > 0) {
      titlesList = data.map((item) => item.title).join(", ");
    }

    // Log how many questions were loaded for debugging
    if (aiQuestions && aiQuestions.length > 0) {
      console.log(`[Chat Page] Loaded ${aiQuestions.length} preset questions`);
    } else {
      console.log("[Chat Page] No preset questions found in database");
    }

    // Render the EJS template and pass the topic list and AI questions for context
    res.render("ai", {
      titlesList: titlesList,
      aiQuestions: aiQuestions || [],
      pageTitle: "AI Security Assistant - SecureCodeHub",
    });
  } catch (error) {
    console.error("Error loading chat page:", error);
    res.status(500).send("Error loading chat interface");
  }
});

// Route: Vulnerability Scanner page
app.get("/scanner", async (req, res) => {
  try {
    res.render("scanner", {
      pageTitle: "Website Vulnerability Scanner - SecureCodeHub",
    });
  } catch (error) {
    console.error("Error loading scanner page:", error);
    res.status(500).send("Error loading scanner interface");
  }
});

// API Endpoint: Run vulnerability scan
app.post("/api/scan", async (req, res) => {
  const { url } = req.body;

  // Validate request
  if (!url || url.trim() === "") {
    return res.status(400).json({ error: "URL is required" });
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch (error) {
    return res.status(400).json({
      error: "Please enter a valid URL (including http:// or https://)",
    });
  }

  console.log(`[Scan API] Starting scan of: ${url}`);

  try {
    // Run the scan
    const result = await runScan(url);

    if (result.success) {
      console.log(
        `[Scan API] Scan completed for ${url}, found ${result.alerts?.length || 0} issues`,
      );
      res.json(result);
    } else {
      console.error(`[Scan API] Scan failed for ${url}:`, result.error);
      res.status(500).json({ error: result.error || "Scan failed" });
    }
  } catch (error) {
    console.error("[Scan API] Error:", error.message);
    res.status(500).json({ error: "Failed to run vulnerability scan" });
  }
});

// API Endpoint: AI Chat Handler (POST)
app.post("/api/chat", async (req, res) => {
  const { message, history = [] } = req.body;

  // Validate request
  if (!message || message.trim() === "") {
    return res.status(400).json({ error: "Message is required" });
  }

  console.log(`[Chat API] Received message: "${message.substring(0, 50)}..."`);

  try {
    // Fetch all topic titles to provide context to the AI
    const { data, error } = await supabase.from("topic").select("title");

    if (error) {
      console.error("Supabase error in chat API:", error);
    }

    let titlesList = [];
    if (data && data.length > 0) {
      titlesList = data.map((item) => item.title).join(", ");
      console.log(`[Chat API] Loaded ${data.length} topics for context`);
    } else {
      console.log("[Chat API] No topics found in database");
    }

    // Check if API key exists
    if (!process.env.API_KEY) {
      console.error("[Chat API] API_KEY is not set in environment variables");
      return res
        .status(500)
        .json({ error: "API configuration error on server" });
    }

    // Call OpenRouter API to get AI response
    console.log("[Chat API] Calling OpenRouter API...");
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            process.env.RENDER_URL || "https://securecodehub.onrender.com",
          "X-Title": "SecureCodeHub",
        },
        body: JSON.stringify({
          model: "openrouter/free",
          messages: [
            {
              role: "system",
              content: `You are an assistant on a website called SecureCodeHub, which functions as a guide book that helps web developers with no background in security learn what they need to implement security measures to their own websites. Your main job is to guide them to what security topics on this website they need to secure their websites. Here is the database of topics available: ${titlesList} (assume that it's complete for now). Keep responses concise, helpful, short, and simple.`,
            },
            ...history,
            { role: "user", content: message },
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      },
    );

    console.log(`[Chat API] OpenRouter response status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[Chat API] OpenRouter API error:", errorData);
      throw new Error(
        errorData.error?.message || `API returned status ${response.status}`,
      );
    }

    const responseData = await response.json();

    if (
      !responseData.choices ||
      !responseData.choices[0] ||
      !responseData.choices[0].message
    ) {
      console.error("[Chat API] Invalid response structure:", responseData);
      throw new Error("Invalid response from AI API");
    }

    const reply = responseData.choices[0].message.content;
    console.log(`[Chat API] Successfully got reply (${reply.length} chars)`);

    res.json({ reply });
  } catch (error) {
    console.error("[Chat API] Error:", error.message);
    res.status(500).json({
      error: "Failed to get response from AI",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Health check endpoint for Render
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    apiKeyConfigured: !!process.env.API_KEY,
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Local: http://localhost:${port}`);
  if (process.env.RENDER_URL) {
    console.log(`Render: ${process.env.RENDER_URL}`);
  }
  console.log(`API Key configured: ${!!process.env.API_KEY}`);
});
