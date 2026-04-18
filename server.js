import express from "express";
import { supabase } from "./config/supabase.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.set("view engine", "ejs");

app.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("question")
    .select("correct_option");
  res.render("index", { test: data[0]["correct_option"] });
  console.log(data);
});

app.get("/quiz", async (req, res) => {
  const { data, error } = await supabase.from("question").select("*");
  res.render("quiz", { questions: data });
});

app.get("/main", async (req, res) => {
  const { data, error } = await supabase.from("topic").select("*");
  res.render("main", { topics: data });
  //console.log(data);
});

app.get("/vuln", async (req, res) => {
  const { data, error } = await supabase.from("vulnerability").select("*");
  res.render("vuln", { vulnerabilities: data });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
