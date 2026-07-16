import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import 'dotenv/config'; 

const API_KEY = process.env.GEMINI_API_KEY; 

if (!API_KEY) {
    console.error("FATAL: GEMINI_API_KEY environment variable not set.");
    console.error("Please ensure you have a .env file in your root folder with GEMINI_API_KEY='YOUR_KEY'");
    // Note: The process.exit(1) line is removed here to ensure the file runs in the environment,
    // but in a real Node.js environment, it should remain.
}

const app = express();
const port = 3000;

// Hardcoded user for simulation (credentials are now ignored for authentication, but variables kept for context)
const VALID_USERNAME = 'notewise_user';
const VALID_PASSWORD = 'password123'; 

// Middleware setup
app.use(cors({
    origin: '*', // Allows your frontend (e.g., index.html) to talk to the server
    methods: ['GET', 'POST']
}));

app.use(express.json());

// --- 1. Authentication Endpoint (FIXED to allow any user to log in) ---
app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;

    // Check if a username and password were provided at all.
    // If they were, the login is considered successful for demonstration purposes.
    if (username && password) {
        console.log(`Successful demo login for user: ${username}`);
        // Return the entered username to the frontend
        return res.json({ success: true, message: `Login successful for user: ${username}`, user: username });
    } else {
        // Fail if either field is missing
        return res.status(401).json({ success: false, error: 'Username and password cannot be empty.' });
    }
});


// --- 2. Core API Endpoint (AI Generation) ---
app.post('/generate-content', async (req, res) => {
    const { documentText, quizCount } = req.body;
    
    if (!documentText) {
        return res.status(400).json({ error: 'Missing document text.' });
    }

    console.log(`Received request to process document and generate ${quizCount} quiz questions...`);
    
    const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';

    const systemInstruction = `You are NoteWise AI, an expert educational content generator. Analyze the provided notes and generate a detailed summary, a set of flashcards, and a ${quizCount}-question multiple-choice quiz. 
    
    The summary MUST be a comprehensive, detailed list of bullet points, not a single paragraph. 
    The flashcards should cover key terms and concepts.
    Respond only with a single, perfectly formatted JSON object that adheres to the provided schema.`;

    const userQuery = `Analyze the following lecture notes/document and generate the required structured content:\n\n---\n${documentText}\n---`;

    const responseSchema = {
        type: "OBJECT",
        properties: {
            // Summary is now a list of bullet points
            summary: {
                type: "ARRAY",
                description: "A detailed list of bullet points summarizing the main topics.",
                items: { type: "STRING" }
            },
            flashcards: {
                type: "ARRAY",
                description: "A list of key concepts and their definitions.",
                items: {
                    type: "OBJECT",
                    properties: {
                        term: { type: "STRING" },
                        definition: { type: "STRING" }
                    }
                }
            },
            quiz: {
                type: "ARRAY",
                description: `A ${quizCount}-question multiple-choice quiz based on the notes.`,
                items: {
                    type: "OBJECT",
                    properties: {
                        question: { type: "STRING" },
                        options: {
                            type: "ARRAY",
                            description: "Exactly 4 multiple-choice options.",
                            items: { type: "STRING" }
                        },
                        correctAnswer: {
                            type: "STRING",
                            description: "The text of the correct option."
                        }
                    },
                    required: ["question", "options", "correctAnswer"]
                }
            }
        },
        required: ["summary", "flashcards", "quiz"]
    };

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: responseSchema
        }
    };

    try {
        let response;
        for (let i = 0; i < 3; i++) {
            try {
                response = await fetch(`${apiUrl}?key=${API_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (response.ok) break;
                if (response.status === 429) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
                } else {
                    if (!response.ok) throw new Error(`API returned status ${response.status}`);
                }
            } catch (err) {
                if (i === 2) throw err;
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            }
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            return res.status(response.status).json({ error: 'Failed to communicate with the AI model after retries. Check API key or quotas.' });
        }

        const result = await response.json();
        const jsonString = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!jsonString) {
             return res.status(500).json({ error: 'AI model returned an empty or invalid response.' });
        }

        const structuredContent = JSON.parse(jsonString);

        res.json({ 
            success: true, 
            data: structuredContent 
        });

    } catch (error) {
        console.error('Server error during AI generation:', error);
        res.status(500).json({ error: 'An unexpected server error occurred.' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`NoteWise AI backend listening on http://localhost:${port}`);
    console.log(`Login is now open! Use ANY non-empty username/password combination.`);
});
