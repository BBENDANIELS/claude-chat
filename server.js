require("dotenv").config();
const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json());
app.use(express.static("public"));

app.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      messages,
    });
    res.json({ reply: response.content[0].text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
