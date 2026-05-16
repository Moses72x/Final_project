// Import Supabase client library to interact with Supabase backend services
import { createClient } from "@supabase/supabase-js";
// Import dotenv to load environment variables from .env file
import dotenv from "dotenv";

// Load environment variables (SUPABASE_URL and SUPABASE_ANON_KEY)
dotenv.config();

// Retrieve Supabase connection URL from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
// Retrieve Supabase anonymous API key from environment variables
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Create and export a configured Supabase client instance
// This client will be used throughout the application to interact with the database
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
