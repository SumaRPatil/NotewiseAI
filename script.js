/**
 * NoteWise AI Frontend Logic
 * Handles navigation, input processing (including text file reading), 
 * and communication with the Node.js backend API.
 */

// Global state for user and navigation
let userName = '';
let currentSection = 'login';
let generatedData = null; // Stores the last set of AI-generated content

// --- UI AND NAVIGATION FUNCTIONS ---

/**
 * Handles the login process by calling the backend /auth/login endpoint.
 */
async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('http://localhost:3000/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (result.success) {
            userName = result.user;
            document.getElementById('user-name').textContent = userName;
            
            // Success: Hide login, show main content
            document.getElementById('login').classList.remove('active');
            document.getElementById('main-header').style.display = 'block';
            document.getElementById('main-footer').style.display = 'block';
            show('home');
        } else {
            alert(`Login Failed: ${result.error}`);
        }

    } catch (error) {
        console.error('Login connection error:', error);
        alert('Could not connect to the backend server. Please ensure the server.js is running.');
    }
}

/**
 * Switches the active content section.
 * @param {string} sectionId - The ID of the section to show (e.g., 'home', 'upload').
 */
function show(sectionId) {
    // Hide all sections
    document.querySelectorAll('section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show the requested section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        currentSection = sectionId;
    }
}

/**
 * Clears the input fields in the upload section and removes displayed content.
 */
function clearInput() {
    document.getElementById('notes-textarea').value = '';
    document.getElementById('notes-file-input').value = '';
    document.getElementById('summaries-content').innerHTML = '<p>No summaries yet. Upload notes to generate.</p>';
    document.getElementById('flashcards-content').innerHTML = '<p>No flashcards yet. Upload notes to generate.</p>';
    document.getElementById('quizzes-content').innerHTML = '<p>No quizzes yet. Upload notes to generate.</p>';
    generatedData = null;
    document.getElementById('quiz-count').value = '5'; // Reset count
}

// --- AI GENERATION AND COMMUNICATION ---

/**
 * Reads the content of an uploaded text file.
 * @param {File} file - The file object to read.
 * @returns {Promise<string>} - A promise that resolves with the text content.
 */
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error("Failed to read file."));
        reader.readAsText(file);
    });
}

/**
 * Calls the backend API to generate content from the user's notes (either pasted or uploaded).
 */
async function generateContent() {
    const loadingIndicator = document.getElementById('loading-indicator');
    const notesTextarea = document.getElementById('notes-textarea');
    const fileInput = document.getElementById('notes-file-input');
    const quizCount = document.getElementById('quiz-count').value; 
    
    let documentText = notesTextarea.value.trim();
    
    // Check for uploaded file first
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        // Only allow plain text file types for now
        if (file.type && !file.type.includes('text/plain')) {
            alert(`File type not supported for text extraction. Please use a plain text file (.txt) or paste content.`);
            fileInput.value = ''; // Clear input
            return;
        }
        
        // **NEW LOGIC: Read file content**
        try {
            loadingIndicator.style.display = 'block';
            documentText = await readFileAsText(file);
        } catch(error) {
            loadingIndicator.style.display = 'none';
            alert(`Error reading file: ${error.message}`);
            return;
        }
    }

    if (!documentText) {
        loadingIndicator.style.display = 'none';
        alert("Please paste your notes, upload a text file, or enter some text before generating content.");
        return;
    }

    // Show loading state if not already visible from file reading
    loadingIndicator.style.display = 'block';
    
    try {
        const response = await fetch('http://localhost:3000/generate-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Sending documentText (from file or textarea) and quizCount to the backend
            body: JSON.stringify({ documentText: documentText, quizCount: quizCount }) 
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server responded with status ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success && result.data) {
            generatedData = result.data;
            
            // Render all generated content
            renderSummary(generatedData.summary);
            renderFlashcards(generatedData.flashcards);
            renderQuiz(generatedData.quiz);
            
            // Automatically switch to summaries page
            show('summaries');
            
        } else {
            throw new Error('AI generation failed to return structured data.');
        }

    } catch (error) {
        console.error('Generation Error:', error);
        alert(`Error generating content. Please check your backend terminal for details. Error: ${error.message}`);
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// --- RENDERING FUNCTIONS ---

/**
 * Renders the generated summary as a detailed bulleted list.
 */
function renderSummary(summary) {
    const container = document.getElementById('summaries-content');
    
    // Renders summary as a detailed bulleted list (summary is an Array of strings from backend)
    if (!Array.isArray(summary) || summary.length === 0) {
        container.innerHTML = '<p>The AI failed to generate a detailed summary.</p>';
        return;
    }

    container.innerHTML = `
        <h3>Detailed AI Summary</h3>
        <div class="summary-text card-content">
            <ul>
                ${summary.map(point => `<li>${point}</li>`).join('')}
            </ul>
        </div>
    `;
}

/**
 * Renders the generated flashcards using an improved flip design.
 */
function renderFlashcards(flashcards) {
    const container = document.getElementById('flashcards-content');
    if (!flashcards || flashcards.length === 0) {
         container.innerHTML = '<p>The AI did not generate any flashcards for the provided notes.</p>';
         return;
    }
    
    // Improved Flashcard Rendering with flip effect
    container.innerHTML = `
        <h3>Generated Flashcards (${flashcards.length})</h3>
        <p style="margin-bottom: 1rem; color: #555;">Click any card to flip and reveal the definition.</p>
        <div class="flashcard-grid">
            ${flashcards.map((card, index) => `
                <div class="card flashcard" onclick="this.classList.toggle('flipped')">
                    <div class="card-inner">
                        <div class="card-face card-front">
                            <span class="term-label">TERM</span>
                            <h4 style="margin-top: 0.5rem;">${card.term}</h4>
                        </div>
                        <div class="card-face card-back">
                            <span class="term-label">DEFINITION</span>
                            <p>${card.definition}</p>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        <style>
            /* Flashcard specific CSS for improved UX */
            .flashcard-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                gap: 1.5rem;
                margin-top: 1rem;
            }
            .flashcard {
                perspective: 1000px;
                height: 180px; 
                cursor: pointer;
                background: none;
                box-shadow: none;
                padding: 0;
            }
            .card-inner {
                position: relative;
                width: 100%;
                height: 100%;
                text-align: center;
                transition: transform 0.8s;
                transform-style: preserve-3d;
            }
            .flashcard.flipped .card-inner {
                transform: rotateY(180deg);
            }
            .card-face {
                position: absolute;
                width: 100%;
                height: 100%;
                backface-visibility: hidden;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                padding: 1.5rem;
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
            }
            .card-front {
                background-color: #0d47a1; /* Dark blue */
                color: white;
                border: 3px solid #c9f0ff;
            }
            .card-back {
                background-color: white;
                color: #222;
                border: 3px solid #0d47a1;
                transform: rotateY(180deg);
            }
            .term-label {
                font-size: 0.75rem;
                font-weight: bold;
                letter-spacing: 1px;
                margin-bottom: 0.5rem;
                opacity: 0.7;
            }
        </style>
    `;
}

/**
 * Renders the generated quiz and adds option selection highlighting.
 */
function renderQuiz(quiz) {
    const container = document.getElementById('quizzes-content');
     if (!quiz || quiz.length === 0) {
         container.innerHTML = '<p>The AI did not generate a quiz for the provided notes.</p>';
         return;
    }

    container.innerHTML = `
        <h3>Practice Quiz (${quiz.length} Questions)</h3>
        <div id="quiz-results" class="card" style="display: none; margin-bottom: 1.5rem; padding: 1.5rem;">
            <h4>Quiz Results</h4>
            <div id="quiz-chart-container" style="display: flex; justify-content: center; margin: 1rem 0;">
                <canvas id="quiz-pie-chart" width="150" height="150"></canvas>
            </div>
            <div id="quiz-stats" style="text-align: center; font-size: 1.1rem; display: grid; grid-template-columns: repeat(3, 1fr);">
                <!-- Stats injected here -->
            </div>
        </div>
        <form id="quiz-form">
            ${quiz.map((q, qIndex) => `
                <div class="quiz-question card" style="margin-bottom: 1.5rem; border: 1px solid #ddd;">
                    <p><strong>Question ${qIndex + 1}:</strong> ${q.question}</p>
                    ${q.options.map((option, oIndex) => `
                        <div class="form-group quiz-option-wrapper" style="margin-top: 0.5rem;">
                            <input type="radio" id="q${qIndex}o${oIndex}" name="question${qIndex}" value="${option}" data-correct="${option === q.correctAnswer}" onchange="highlightSelection(this)">
                            <label for="q${qIndex}o${oIndex}" class="quiz-option">${option}</label>
                        </div>
                    `).join('')}
                    <div class="feedback-area" id="feedback${qIndex}" style="margin-top: 1rem; font-weight: bold;"></div>
                </div>
            `).join('')}
            <div style="display: flex; gap: 1rem;">
                <button type="button" class="btn btn-primary quiz-btn" onclick="submitQuiz()">Submit Quiz</button>
                <button type="button" class="btn btn-outline quiz-btn" onclick="resetQuiz()">Reset Quiz</button>
            </div>
        </form>
        <style>
            /* Quiz option styling for selection and feedback */
            .quiz-btn {
                width: 150px; /* New: Make buttons narrower */
            }
            .quiz-option { 
                cursor: pointer; 
                display: block; 
                padding: 0.5rem; 
                border-radius: 6px;
                border: 1px solid #ccc;
                transition: background-color 0.2s ease;
                margin-left: 1.5rem; 
            }
            .quiz-option-wrapper input[type="radio"] {
                display: none; /* Hide the default radio button */
            }
            /* Highlights the option when clicked/selected */
            .quiz-option-wrapper input[type="radio"]:checked + .quiz-option {
                background-color: #c9f0ff; /* Light blue on selection */
                border-color: #0d47a1; /* Primary color border on selection */
            }
            /* Styling for feedback after submission */
            .quiz-option.correct { 
                background-color: #e6ffed !important; 
                border: 1px solid #38c172 !important;
            }
            .quiz-option.incorrect { 
                background-color: #ffe6e6 !important; 
                border: 1px solid #e3342f !important; 
            }
            .quiz-option[data-correct="true"]:after { content: " (✓)"; color: #38c172; font-size: 1.2em;}
        </style>
    `;
}

/**
 * Renders the pie chart based on quiz statistics.
 * @param {number} correct - Number of correct answers.
 * @param {number} incorrect - Number of incorrect answers.
 * @param {number} unattempted - Number of unattempted questions.
 */
function drawPieChart(correct, incorrect, unattempted) {
    const canvas = document.getElementById('quiz-pie-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const total = correct + incorrect + unattempted;
    const center = canvas.width / 2;
    const radius = center - 5; // Small margin
    let currentAngle = 0;

    // Define colors
    const colors = {
        correct: '#38c172',   // Green
        incorrect: '#e3342f', // Red
        unattempted: '#ccc'   // Gray
    };

    // Data points and their properties
    const data = [
        { count: correct, color: colors.correct, label: 'Correct' },
        { count: incorrect, color: colors.incorrect, label: 'Incorrect' },
        { count: unattempted, color: colors.unattempted, label: 'Unattempted' }
    ];

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    data.forEach(slice => {
        if (slice.count > 0) {
            const sliceAngle = (slice.count / total) * 2 * Math.PI;

            ctx.beginPath();
            ctx.fillStyle = slice.color;
            ctx.moveTo(center, center);
            ctx.arc(center, center, radius, currentAngle, currentAngle + sliceAngle);
            ctx.closePath();
            ctx.fill();

            currentAngle += sliceAngle;
        }
    });
}

/**
 * Handles the quiz submission, calculates scores, displays feedback, and shows the progress chart.
 */
function submitQuiz() {
    if (!generatedData || !generatedData.quiz) {
        alert("No quiz data found. Please generate content first.");
        return;
    }
    
    const quiz = generatedData.quiz;
    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;
    
    quiz.forEach((q, qIndex) => {
        const selectedOption = document.querySelector(`input[name="question${qIndex}"]:checked`);
        const feedbackArea = document.getElementById(`feedback${qIndex}`);
        const options = document.querySelectorAll(`input[name="question${qIndex}"] + .quiz-option`);

        feedbackArea.textContent = '';
        
        // Disable inputs after submission
        document.querySelectorAll(`input[name="question${qIndex}"]`).forEach(input => input.disabled = true);


        // Highlight the correct answer regardless of selection
        options.forEach(opt => {
            const radio = document.getElementById(opt.htmlFor);
            if (radio && radio.value === q.correctAnswer) {
                opt.classList.add('correct');
            }
        });

        if (selectedOption) {
            const selectedValue = selectedOption.value;
            const selectedLabel = document.querySelector(`label[for="${selectedOption.id}"]`);
            
            if (selectedValue === q.correctAnswer) {
                correctCount++;
                feedbackArea.textContent = 'Correct!';
                feedbackArea.style.color = '#38c172';
            } else {
                incorrectCount++;
                feedbackArea.textContent = `Incorrect. The correct answer was highlighted above.`;
                feedbackArea.style.color = '#e3342f';
                selectedLabel.classList.add('incorrect');
            }
        } else {
             unattemptedCount++;
             feedbackArea.textContent = 'Unanswered. Reviewing the correct answer.';
             feedbackArea.style.color = '#888';
        }
    });

    const totalQuestions = quiz.length;
    
    // Show results section
    document.getElementById('quiz-results').style.display = 'block';

    // Draw the pie chart
    drawPieChart(correctCount, incorrectCount, unattemptedCount);
    
    // Display text stats
    document.getElementById('quiz-stats').innerHTML = `
        <span style="color: #38c172;">Correct: ${correctCount}</span>
        <span style="color: #e3342f;">Incorrect: ${incorrectCount}</span>
        <span style="color: #ccc;">Unattempted: ${unattemptedCount}</span>
    `;

    // Optionally show an alert for overall score
    alert(`Quiz Complete! You scored ${correctCount} out of ${totalQuestions}.`);
}

/**
 * Resets the quiz to its initial state, allowing the user to try again.
 */
function resetQuiz() {
    const quiz = generatedData.quiz;

    quiz.forEach((q, qIndex) => {
        // Clear selection and re-enable inputs
        document.querySelectorAll(`input[name="question${qIndex}"]`).forEach(input => {
            input.checked = false;
            input.disabled = false;
        });

        // Remove feedback and highlighting
        document.getElementById(`feedback${qIndex}`).textContent = '';
        document.querySelectorAll(`input[name="question${qIndex}"] + .quiz-option`).forEach(opt => {
            opt.classList.remove('correct', 'incorrect');
        });
    });

    // Hide results section
    document.getElementById('quiz-results').style.display = 'none';
}

/**
 * Highlights the quiz option selected by the user (CSS handles the visual change).
 * @param {HTMLInputElement} radio - The radio button element that was changed.
 */
function highlightSelection(radio) {
    // CSS handles the highlight, no JS needed here.
}


// Ensure the necessary functions are available globally when the script is loaded.
window.login = login;
window.show = show;
window.generateContent = generateContent;
window.clearInput = clearInput;
window.highlightSelection = highlightSelection; 
window.submitQuiz = submitQuiz; 
window.resetQuiz = resetQuiz;
