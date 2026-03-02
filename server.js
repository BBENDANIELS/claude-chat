require("dotenv").config();
const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const upload = multer({ dest: "uploads/", limits: { fileSize: 20 * 1024 * 1024 } });

const SITE_PASSWORD = process.env.SITE_PASSWORD;
const SYSTEM_PROMPT = `You are Claude, a helpful, harmless, and honest AI assistant made by Anthropic. You give clear, accurate, and thoughtful answers. Format responses with markdown where helpful — use code blocks for code, bullet points for lists, and headers for long structured responses.`;

app.use(express.json({ limit: "20mb" }));

// Login page at root
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/login.html");
});

// Auth endpoint
app.post("/auth", (req, res) => {
  if (req.body.password === SITE_PASSWORD) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false });
  }
});

// Chat app at /app
app.use("/app", express.static("public"));

// Streaming chat endpoint
app.post("/chat", upload.single("file"), async (req, res) => {
  try {
    let messages = JSON.parse(req.body.messages);

    // Handle file attachment
    if (req.file) {
      const fileData = fs.readFileSync(req.file.path);
      const base64 = fileData.toString("base64");
      const mimeType = req.file.mimetype;
      const lastMsg = messages[messages.length - 1];

      if (mimeType === "application/pdf") {
        lastMsg.content = [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          },
          { type: "text", text: lastMsg.content || "Please summarise this document." },
        ];
      } else {
        lastMsg.content = [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType, data: base64 },
          },
          { type: "text", text: lastMsg.content || "What is in this image?" },
        ];
      }
      fs.unlinkSync(req.file.path);
    }

    // Set up SSE streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = client.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages,
    });

    stream.on("text", (text) => {
      res.write(`data: ${JSON.stringify({ type: "text", text })}\n\n`);
    });

    stream.on("message", () => {
      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    });

    stream.on("error", (err) => {
      res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
      res.end();
    });

    // Handle client disconnect
    req.on("close", () => stream.abort());

  } catch (err) {
    console.error(err);
    res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
    res.end();
  }
});

// Auto-title endpoint
app.post("/title", async (req, res) => {
  try {
    const { messages } = req.body;
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 20,
      system: "Generate a very short title (3-5 words max) for this conversation. Reply with ONLY the title, no punctuation, no quotes.",
      messages: messages.slice(0, 2),
    });
    res.json({ title: response.content[0].text.trim() });
  } catch (err) {
    res.json({ title: "New conversation" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
