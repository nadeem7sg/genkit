/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import express from 'express';
import { ai } from './genkit.js';
import { routingAgent } from './routingAgent.js';
import type { AgentState } from './types.js';

const app = express();
app.use(express.json());

const EXAMPLE_USER_CONTEXT: AgentState = {
  parentId: 4112,
  parentName: 'Francis Smith',
  students: [
    {
      id: 3734,
      name: 'Evelyn Smith',
      grade: 9,
      activities: ['Choir', 'Drama Club'],
    },
    { id: 9433, name: 'Evan Smith', grade: 11, activities: ['Chess Club'] },
  ],
};

// HTML UI
const HTML_UI = `<!DOCTYPE html>
<html>
<head>
  <title>School Agent AI - Sparkyville High School</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #2c3e50; text-align: center; }
    .chat-container { margin: 20px 0; padding: 15px; background: #ecf0f1; border-radius: 5px; }
    .input-group { display: flex; margin: 10px 0; }
    input[type="text"] { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 3px; }
    button { padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 3px; cursor: pointer; margin-left: 10px; }
    button:hover { background: #2980b9; }
    .response { margin: 10px 0; padding: 10px; background: white; border-radius: 3px; border-left: 3px solid #27ae60; }
    .error { border-left-color: #e74c3c; background: #fdf2f2; }
    .loading { border-left-color: #f39c12; background: #fef9e7; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🤖 School Agent AI - Sparkyville High School</h1>
    <p style="text-align: center; color: #7f8c8d;">Powered by Google AI - Ask me anything about your child's school!</p>

    <div class="chat-container">
      <h3>💬 Chat with School Agent</h3>
      <div class="input-group">
        <input type="text" id="userInput" placeholder="Ask about grades, events, or school information..." />
        <button onclick="sendMessage()">Send</button>
      </div>
      <div id="responses"></div>
    </div>

    <div class="chat-container">
      <h3>💡 Example Questions</h3>
      <ul>
        <li>"Show me my child's grades"</li>
        <li>"What events are coming up?"</li>
        <li>"Tell me about school announcements"</li>
        <li>"How is Evelyn doing in school?"</li>
        <li>"What activities is Evan involved in?"</li>
      </ul>
    </div>
  </div>

  <script>
    async function sendMessage() {
      const input = document.getElementById('userInput');
      const responses = document.getElementById('responses');
      const message = input.value.trim();

      if (!message) return;

      responses.innerHTML += '<div class="response"><strong>You:</strong> ' + message + '</div>';
      input.value = '';

      const loadingId = 'loading-' + Date.now();
      responses.innerHTML += '<div id="' + loadingId + '" class="response loading"><strong>School Agent:</strong> Thinking...</div>';
      responses.scrollTop = responses.scrollHeight;

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: message })
        });

        const data = await response.json();
        document.getElementById(loadingId).remove();

        if (response.ok) {
          responses.innerHTML += '<div class="response"><strong>School Agent:</strong> ' + data.response + '</div>';
        } else {
          responses.innerHTML += '<div class="response error"><strong>Error:</strong> ' + data.error + '</div>';
        }
      } catch (error) {
        document.getElementById(loadingId).remove();
        responses.innerHTML += '<div class="response error"><strong>Error:</strong> Failed to connect to AI service</div>';
      }

      responses.scrollTop = responses.scrollHeight;
    }

    document.getElementById('userInput').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
  </script>
</body>
</html>`;

// Serve HTML UI
app.get('/', (req, res) => {
  res.send(HTML_UI);
});

// Chat API endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Create a chat session with the routing agent
    const chat = ai
      .createSession({ initialState: EXAMPLE_USER_CONTEXT })
      .chat(routingAgent);

    // Send the message and get the response
    const { stream, response } = await chat.sendStream(message);

    // Collect streamed response
    let fullResponse = '';
    for await (const chunk of stream) {
      if (chunk && chunk.text) {
        fullResponse += chunk.text;
      }
    }

    // If no streamed response, try to get from response
    if (!fullResponse) {
      const responseData = await response;
      const modelMessage = responseData.messages
        .filter((m) => m.role === 'model')
        .pop();

      if (modelMessage && modelMessage.content) {
        const textContent = modelMessage.content.find((c) => c.text);
        fullResponse = textContent?.text || 'No response generated';
      }
    }

    res.json({
      response: fullResponse || 'No response generated',
      success: true
    });
  } catch (error: any) {
    console.error('Chat error:', error);

    let errorMessage = error.message || 'An error occurred while processing your request';
    if (errorMessage.includes('404') && errorMessage.includes('models')) {
      errorMessage = 'Model not available. Please check your GMODEL environment variable or API key permissions.';
    }

    res.status(500).json({
      error: errorMessage,
      success: false
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'school-agent' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 School Agent Web UI running on http://localhost:${PORT}`);
  console.log(`📝 Chat API available at http://localhost:${PORT}/api/chat`);
  console.log(`🔧 Using model: ${process.env.GMODEL || 'gemini-2.5-flash'}`);
});

