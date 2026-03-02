require("dotenv").config();
const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const multer = require("multer");
const fs = require("fs");

const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const upload = multer({ dest: "uploads/" });

const SITE_PASSWORD = process.env.SITE_PASSWORD;
const SYSTEM_PROMPT = `You are a helpful, knowledgeable assistant. You give clear, accurate answers and format responses with markdown where helpful.`;

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

// Chat app served at /app
app.use("/app", express.static("public"));

// Chat endpoint
app.post("/chat", upload.single("file"), async (req, res) => {
  try {
    let messages = JSON.parse(req.body.messages);

    if (req.file) {
      const fileData = fs.readFileSync(req.file.path);
      const base64 = fileData.toString("base64");
      const mimeType = req.file.mimetype;

      const lastMsg = messages[messages.length - 1];
      lastMsg.content = [
        {
          type: "image",
          source: { type: "base64", media_type: mimeType, data: base64 },
        },
        { type: "text", text: lastMsg.content || "What is in this image?" },
      ];
      fs.unlinkSync(req.file.path);
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages,
    });

    res.json({ reply: response.content[0].text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Something went wrong." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
