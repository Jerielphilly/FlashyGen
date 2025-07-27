import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Upload, PlayCircle, Bookmark, Sun, Moon, Database, Edit, Trash2, Check, X } from "lucide-react";

// Firebase imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, query, onSnapshot, deleteDoc, updateDoc } from 'firebase/firestore';


// Your Firebase configuration (PASTE THIS DIRECTLY INTO YOUR App.jsx)
const firebaseConfig = {
  apiKey: "AIzaSyAioG5N7StJuk5Hz0wKqujqoDKJEbfk7w0",
  authDomain: "flashygen-8c134.firebaseapp.com",
  projectId: "flashygen-8c134",
  storageBucket: "flashygen-8c134.firebasestorage.app",
  messagingSenderId: "838930296266",
  appId: "1:838930296266:web:de013c50420bccddb1b333",
  measurementId: "G-8BTLJELM8P" // Optional, can be removed if not using Analytics
};


// QuizCard Component - This implements the flashcard functionality.
function QuizCard({ question, onNext, onSave, onUnsave, savedCards = [] }) {
  const [flipped, setFlipped] = useState(false);
  const [justSaved, setJustSaved] = useState(false); // State for temporary save animation feedback

  // Reset flipped state when the question changes (i.e., when moving to a new card)
  useEffect(() => {
    setFlipped(false);
  }, [question]);

  // Reset justSaved state when the question changes, ensuring animation plays per card
  useEffect(() => {
    setJustSaved(false);
  }, [question]);

  // Handler for clicking the card to flip it
  const handleCardClick = () => setFlipped((f) => !f);

  // Defensive check: If question data is missing, display an error message
  if (!question) {
    return <div className="text-red-500 text-center text-xl font-bold p-8">Error: Quiz question data is missing.</div>;
  }

  // Determine if the current card is already in the savedCards list
  const isSaved = savedCards.some(
    c => c.question === question.question && c.answer === question.answer
  );

  return (
    <div
      className={`relative w-full max-w-xl h-96 mx-auto cursor-pointer perspective`} /* Increased height for better visibility */
      onClick={handleCardClick}
    >
      {/* Save/Unsave Icon Button */}
      <button
        className={`absolute top-4 right-4 z-20 rounded-full p-2 shadow transition
          ${isSaved || justSaved ? "bg-purple-200" : "bg-white/80"}
          ${justSaved ? "scale-125" : ""}
        `}
        onClick={e => {
          e.stopPropagation(); // Prevent the card from flipping when clicking the button
          if (isSaved) {
            onUnsave(question); // If already saved, call onUnsave
          } else {
            onSave(question); // If not saved, call onSave
            setJustSaved(true); // Trigger a temporary animation for saving
            setTimeout(() => setJustSaved(false), 500); // Reset animation state after a short delay
          }
        }}
        title={isSaved ? "Unsave this card" : "Save this card"} // Dynamic tooltip for accessibility
        aria-pressed={isSaved} // ARIA attribute to indicate pressed state for accessibility
      >
        <Bookmark
          className={`w-6 h-6 transition-colors duration-200
            ${isSaved || justSaved ? "text-purple-700 fill-purple-700" : "text-purple-700"}
          `}
          fill={isSaved || justSaved ? "#a21caf" : "none"} // Fill the bookmark icon if saved or just saved
        />
      </button>

      {/* The flip container for the card */}
      <div
        className={`absolute w-full h-full transition-transform duration-500 rounded-3xl shadow-2xl ${
          flipped ? "rotate-y-180" : ""
        }`}
        style={{
          transformStyle: "preserve-3d", // Required for 3D flip effect
        }}
      >
        {/* Front of the card (Question) */}
        <div
          className="absolute w-full h-full bg-white rounded-3xl flex items-center justify-center text-3xl font-bold text-gray-800 backface-hidden p-8 text-center"
        >
          {question.question || "No Question Provided"} {/* Display question, or fallback text */}
        </div>
        {/* Back of the card (Answer) */}
        <div
          className="absolute w-full h-full bg-purple-700 rounded-3xl flex flex-col items-center justify-center text-2xl text-white backface-hidden p-8 rotate-y-180 text-center"
        >
          <div>
            <span className="font-semibold">Answer:</span> {question.answer || "No Answer Provided"} {/* Display answer, or fallback text */}
          </div>
          <button
            className="mt-8 py-3 px-8 bg-white text-purple-700 rounded-full font-bold shadow-lg hover:bg-purple-200 transition-all duration-300 transform hover:scale-105"
            onClick={(e) => {
              e.stopPropagation(); // Prevent card from flipping back when button is clicked
              setFlipped(false); // Reset flipped state for the next card
              onNext(); // Call the onNext prop from App.jsx to advance the quiz
            }}
          >
            Next Card
          </button>
        </div>
      </div>
      {/* Inline styles for 3D effects */}
      <style>
        {`
          .perspective {
            perspective: 1200px;
          }
          .backface-hidden {
            backface-visibility: hidden;
          }
          .rotate-y-180 {
            transform: rotateY(180deg);
          }
        `}
      </style>
    </div>
  );
}


// App Component - This is your main application logic.
export default function App() {
  const [file, setFile] = useState(null);
  const [quiz, setQuiz] = useState([]);
  const [current, setCurrent] = useState(0);
  const [phase, setPhase] = useState("upload"); // Controls the current phase: upload | quiz | done
  const fileRef = useRef(); // Ref for file input
  const [loading, setLoading] = useState(false); // Indicates if an operation is in progress
  const [error, setError] = useState(null); // Stores any error messages to display
  const [infoMessage, setInfoMessage] = useState(null); // New state for success/info messages

  // Theme state: "dark" or "light"
  const [theme, setTheme] = useState("dark");

  // Firebase states
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false); // To track if auth is initialized

  // Quiz Customization states (for future backend integration)
  const [quizFormat, setQuizFormat] = useState("flashcard"); // 'flashcard', 'multiple_choice'
  const [difficulty, setDifficulty] = useState("medium"); // 'easy', 'medium', 'hard'
  const [numQuestions, setNumQuestions] = useState(10); // Number of questions to generate

  // State for saved cards, now fetched from Firestore
  const [savedCards, setSavedCards] = useState([]);
  // State to control visibility of saved cards modal
  const [showSaved, setShowSaved] = useState(false);

  // State for user's saved quizzes from Firestore
  const [userQuizzes, setUserQuizzes] = useState([]);
  const [showQuizLibrary, setShowQuizLibrary] = useState(false); // To toggle visibility of quiz library modal

  // State for editing a quiz name
  const [editingQuizId, setEditingQuizId] = useState(null);
  const [editingQuizName, setEditingQuizName] = useState("");


  // Loading messages for AI generation
  const loadingMessages = [
    "Analyzing document...",
    "Crafting insightful questions...",
    "Generating comprehensive answers...",
    "Assembling your personalized quiz...",
    "Almost ready! Just a few more seconds...",
    "Optimizing for maximum learning...",
  ];
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState(loadingMessages[0]);

  // Cycle through loading messages when loading is true
  useEffect(() => {
    let interval;
    if (loading) {
      let messageIndex = 0;
      interval = setInterval(() => {
        messageIndex = (messageIndex + 1) % loadingMessages.length;
        setCurrentLoadingMessage(loadingMessages[messageIndex]);
      }, 2000); // Change message every 2 seconds
    } else {
      clearInterval(interval);
      setCurrentLoadingMessage(loadingMessages[0]); // Reset message when not loading
    }
    return () => clearInterval(interval);
  }, [loading, loadingMessages]); // Added loadingMessages to dependency array


  // Firebase Initialization and Authentication
  useEffect(() => {
    try {
      // Initialize Firebase with your directly provided config
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestore);
      setAuth(firebaseAuth);

      // Set up authentication state listener
      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          setUserId(user.uid);
          console.log("Firebase: User signed in:", user.uid);
        } else {
          // Sign in anonymously if no user is authenticated (for local development)
          try {
            await signInAnonymously(firebaseAuth);
            console.log("Firebase: Signed in anonymously.");
          } catch (anonError) {
            console.error("Firebase: Anonymous sign-in failed:", anonError);
            setError("Authentication failed. Please try again.");
          }
        }
        setIsAuthReady(true); // Auth state is ready after initial check
      });

      return () => unsubscribe(); // Cleanup auth listener on component unmount
    } catch (firebaseError) {
      console.error("Firebase initialization failed:", firebaseError);
      setError("Failed to initialize application services. Please try again later.");
    }
  }, []); // Empty dependency array means this runs once on mount


  // Effect to load theme from localStorage on initial render
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) setTheme(savedTheme);
  }, []); // Run once on component mount

  // Effect to save theme to localStorage whenever the theme state changes
  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]); // Run whenever 'theme' changes

  // Effect to clear info messages after a delay
  useEffect(() => {
    if (infoMessage) {
      const timer = setTimeout(() => {
        setInfoMessage(null);
      }, 3000); // Clear message after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [infoMessage]);


  // Firestore: Listen for user's quizzes in real-time
  useEffect(() => {
    // Only run if Firestore, user ID, and auth are ready
    if (db && userId && isAuthReady) {
      // Use firebaseConfig.projectId as the base for the collection path
      const projectId = firebaseConfig.projectId;
      console.log(`Firestore: Attempting to fetch quizzes for projectId: ${projectId} and userId: ${userId}`);
      // Define the collection path for user-specific quizzes
      const userQuizzesRef = collection(db, `artifacts/${projectId}/users/${userId}/quizzes`);
      const q = query(userQuizzesRef); // Create a query to get all quizzes for this user

      // Set up a real-time listener using onSnapshot
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const quizzes = snapshot.docs.map(doc => ({
          id: doc.id, // Document ID from Firestore
          ...doc.data() // All other data in the document
        }));
        setUserQuizzes(quizzes);
        console.log("Firestore: User quizzes loaded:", quizzes);
      }, (error) => {
        console.error("Firestore: Error fetching user quizzes:", error);
        setError("Failed to load your saved quizzes.");
      });

      return () => unsubscribe(); // Cleanup the listener when component unmounts or dependencies change
    }
  }, [db, userId, isAuthReady]); // Re-run when db, userId, or auth status changes

  // Firestore: Listen for user's saved cards in real-time
  useEffect(() => {
    if (db && userId && isAuthReady) {
      const projectId = firebaseConfig.projectId;
      console.log(`Firestore: Attempting to fetch saved cards for projectId: ${projectId} and userId: ${userId}`);
      const savedCardsRef = collection(db, `artifacts/${projectId}/users/${userId}/savedCards`);
      const q = query(savedCardsRef);

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const cards = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setSavedCards(cards);
        console.log("Firestore: User saved cards loaded:", cards);
      }, (error) => {
        console.error("Firestore: Error fetching saved cards:", error);
        setError("Failed to load your saved cards.");
      });

      return () => unsubscribe();
    }
  }, [db, userId, isAuthReady]);


  // Dynamic Tailwind CSS classes based on the current theme
  const themeBg =
    theme === "dark"
      ? "bg-gradient-to-br from-slate-900 via-neutral-800 to-gray-900"
      : "bg-gradient-to-br from-pink-50 via-purple-50 to-blue-100";
  const themeText =
    theme === "dark" ? "text-white" : "text-gray-900";

  // Classes for the individual floating buttons
  const floatingButtonClasses =
    "rounded-full shadow-lg p-3 transition-all duration-300 transform active:scale-95 hover:scale-105";

  const themeCard = // Applied to saved cards modal background
    theme === "dark"
      ? "bg-gray-800 text-white" // Dark mode card style
      : "bg-white text-gray-800"; // Light mode card style


  // Function to handle saving a card (now to Firestore)
  const handleSaveCard = async (card) => {
    if (!db || !userId) {
      setError("User not authenticated or database not ready. Cannot save card.");
      return;
    }
    setLoading(true);
    try {
      const projectId = firebaseConfig.projectId;
      const savedCardsRef = collection(db, `artifacts/${projectId}/users/${userId}/savedCards`);
      // Create a unique ID for the card based on its content to prevent duplicates
      const cardId = btoa(unescape(encodeURIComponent(card.question + card.answer))).replace(/=/g, ''); // Simple base64 encoding for ID
      const cardDocRef = doc(savedCardsRef, cardId); // Use specific ID

      await setDoc(cardDocRef, {
        question: card.question,
        answer: card.answer,
        savedAt: new Date().toISOString(),
      }, { merge: true }); // Use merge to avoid overwriting if it exists
      setInfoMessage("Card saved successfully!");
      setError(null);
    } catch (firebaseError) {
      console.error("Firestore: Error saving card:", firebaseError);
      setError("Failed to save card to your library.");
    } finally {
      setLoading(false);
    }
  };

  // Function to handle unsaving a card (now from Firestore)
  const handleUnsaveCard = async (cardToUnsave) => {
    if (!db || !userId) {
      setError("User not authenticated or database not ready. Cannot unsave card.");
      return;
    }
    setLoading(true);
    try {
      const projectId = firebaseConfig.projectId;
      const savedCardsRef = collection(db, `artifacts/${projectId}/users/${userId}/savedCards`);
      const cardId = btoa(unescape(encodeURIComponent(cardToUnsave.question + cardToUnsave.answer))).replace(/=/g, '');
      const cardDocRef = doc(savedCardsRef, cardId);

      await deleteDoc(cardDocRef);
      setInfoMessage("Card unsaved!");
      setError(null);
    } catch (firebaseError) {
      console.error("Firestore: Error unsaving card:", firebaseError);
      setError("Failed to unsave card from your library.");
    } finally {
      setLoading(false);
    }
  };

  // Firestore: Save a generated quiz to Firestore
  const saveQuizToFirestore = async (quizData, fileName, format, difficulty) => {
    if (!db || !userId) {
      setError("User not authenticated or database not ready. Cannot save quiz.");
      return;
    }
    setLoading(true); // Start loading indicator for saving
    const projectId = firebaseConfig.projectId; // Get projectId here for logging
    console.log(`Saving quiz for projectId: ${projectId} and userId: ${userId}`); // Debugging log
    try {
      const userQuizzesRef = collection(db, `artifacts/${projectId}/users/${userId}/quizzes`);
      const newQuizRef = doc(userQuizzesRef); // Auto-generate a new document ID

      await setDoc(newQuizRef, {
        name: fileName.split('.')[0] || "Untitled Quiz", // Default name, can be edited later
        createdAt: new Date().toISOString(), // Timestamp
        quizData: JSON.stringify(quizData), // Store quiz data as a JSON string (important for complex objects)
        format: format,
        difficulty: difficulty,
        originalFileName: fileName,
      });
      console.log("Firestore: Quiz saved successfully with ID:", newQuizRef.id);
      setInfoMessage("Quiz saved successfully!"); // Success message
      setError(null); // Clear any previous errors
    } catch (firebaseError) {
      console.error("Firestore: Error saving quiz:", firebaseError);
      setError("Failed to save quiz to your library.");
    } finally {
      setLoading(false); // End loading indicator
    }
  };

  // Firestore: Delete a quiz from Firestore
  const deleteQuizFromFirestore = async (quizId) => {
    if (!db || !userId) {
      setError("User not authenticated or database not ready. Cannot delete quiz.");
      return;
    }
    setLoading(true); // Start loading indicator for deleting
    const projectId = firebaseConfig.projectId; // Get projectId here for logging
    console.log(`Deleting quiz for projectId: ${projectId} and userId: ${userId}`); // Debugging log
    try {
      const quizDocRef = doc(db, `artifacts/${projectId}/users/${userId}/quizzes`, quizId);
      await deleteDoc(quizDocRef);
      console.log("Firestore: Quiz deleted successfully with ID:", quizId);
      setInfoMessage("Quiz deleted successfully!"); // Success message
      setError(null); // Clear any previous errors
    } catch (firebaseError) {
      console.error("Firestore: Error deleting quiz:", firebaseError);
      setError("Failed to delete quiz from your library.");
    } finally {
      setLoading(false); // End loading indicator
    }
  };

  // Firestore: Rename a quiz
  const renameQuizInFirestore = async (quizId, newName) => {
    if (!db || !userId || !newName.trim()) {
      setError("User not authenticated, database not ready, or new name is empty.");
      return;
    }
    setLoading(true);
    try {
      const projectId = firebaseConfig.projectId;
      const quizDocRef = doc(db, `artifacts/${projectId}/users/${userId}/quizzes`, quizId);
      await updateDoc(quizDocRef, {
        name: newName.trim()
      });
      setInfoMessage("Quiz renamed successfully!");
      setError(null);
      setEditingQuizId(null); // Exit editing mode
      setEditingQuizName(""); // Clear editing state
    } catch (firebaseError) {
      console.error("Firestore: Error renaming quiz:", firebaseError);
      setError("Failed to rename quiz.");
    } finally {
      setLoading(false);
    }
  };


  // Function to load a quiz from Firestore and set it as the current quiz
  const loadQuizFromFirestore = (quizToLoad) => {
    try {
        setQuiz(JSON.parse(quizToLoad.quizData)); // Parse the stored JSON string back to an array
        setCurrent(0);
        setPhase("quiz");
        setShowQuizLibrary(false); // Close the library modal
        setError(null);
        setInfoMessage(`Loaded quiz: "${quizToLoad.name}"`); // Info message
        console.log("Quiz loaded from Firestore:", quizToLoad.name);
    } catch (e) {
        console.error("Error parsing quiz data from Firestore:", e);
        setError("Failed to load quiz data. It might be corrupted.");
    }
  };


  // Handles the file upload to the backend.
  const handleUpload = async () => {
    if (!file) {
      setError("Please choose a file first.");
      return;
    }

    setLoading(true); // Start loading
    setError(null); // Clear any previous errors
    setInfoMessage(null); // Clear any previous info messages
    const formData = new FormData();
    formData.append("file", file);

    try {
      // Send the file to the backend for quiz generation
      const res = await axios.post("http://localhost:8000/upload/", formData);
      // IMPORTANT: This assumes the backend returns quiz data as an array of objects,
      // where each object has 'question' and 'answer' properties (e.g., [{ question: "...", answer: "..." }]).
      if (res.data.quiz && res.data.quiz.length > 0) {
        setQuiz(res.data.quiz); // Set the generated quiz questions
        setCurrent(0); // Start from the first question
        setPhase("quiz"); // Transition to the quiz phase
        setInfoMessage("Quiz generated successfully!"); // Success message
      } else {
        setError("No quiz questions generated. Please try a different file.");
        setPhase("upload"); // Go back to the upload phase if no quiz is generated
      }
    } catch (err) {
      console.error("Error uploading file:", err);
      // Display a user-friendly error message
      setError(`Failed to generate quiz: ${err.response?.data?.detail || err.message}`);
      setPhase("upload"); // Go back to upload phase on error
    } finally {
      setLoading(false); // End loading
    }
  };

  // Handles moving to the next flashcard.
  const handleNext = () => {
    if (current + 1 < quiz.length) {
      setCurrent(current + 1); // Move to the next question
    } else {
      setPhase("done"); // All cards reviewed, transition to done phase
    }
  };

  // Resets the quiz state to start a new quiz.
  const resetQuiz = () => {
    setFile(null);
    setQuiz([]);
    setCurrent(0);
    setPhase("upload");
    setError(null);
    setInfoMessage(null); // Clear info message on reset
    setLoading(false);
  };


  return (
    // Main container for the entire application, applying theme background and font
    <div className={`min-h-screen flex flex-col items-center justify-center ${themeBg} p-6 font-inter transition-colors duration-500`}>

      {/* Floating Buttons Container */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-4"> {/* Changed flex to flex-col for vertical arrangement */}
        {/* Saved Cards Button */}
        <button
          className={`${floatingButtonClasses} ${
            theme === "dark"
              ? "bg-purple-700 text-white hover:bg-purple-800"
              : "bg-purple-200 text-purple-700 hover:bg-purple-300"
          }`}
          onClick={() => setShowSaved(s => !s)}
          aria-label={showSaved ? "Hide Saved Cards" : "Show Saved Cards"}
          title={showSaved ? "Hide Saved Cards" : "Show Saved Cards"}
        >
          <Bookmark className="w-6 h-6" />
        </button>

        {/* Quiz Library Button */}
        <button
          className={`${floatingButtonClasses} ${
            theme === "dark"
              ? "bg-blue-700 text-white hover:bg-blue-800"
              : "bg-blue-200 text-blue-700 hover:bg-blue-300"
          }`}
          onClick={() => setShowQuizLibrary(s => !s)}
          aria-label={showQuizLibrary ? "Hide Quiz Library" : "Show Quiz Library"}
          title={showQuizLibrary ? "Hide Quiz Library" : "Show Quiz Library"}
        >
          <Database className="w-6 h-6" />
        </button>

        {/* Theme Toggle Button */}
        <button
          className={`${floatingButtonClasses} ${
            theme === "dark"
              ? "bg-gradient-to-br from-purple-700 to-indigo-700 text-white shadow-xl hover:shadow-purple-700/50"
              : "bg-gradient-to-br from-pink-300 to-purple-400 text-purple-900 shadow-xl hover:shadow-purple-400/50"
          }`}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="w-6 h-6 text-yellow-400 animate-spin-subtle" />
          ) : (
            <Moon className="w-6 h-6 text-purple-700 animate-float-subtle" />
          )}
        </button>
      </div>


      {/* Main content area, applying theme text color */}
      <div className={`flex flex-col items-center justify-center w-full h-full ${themeText}`}>
        {/* Animated Title - Updated to FlashyGen */}
        <h1
          className="mb-12 text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-500 to-pink-500 animate-gradient drop-shadow-lg text-center"
          style={{
            animation: "gradientMove 3s ease-in-out infinite alternate"
          }}
        >
          FLASHYGEN
        </h1>

        {/* Error Message Display */}
        {error && (
          <div className="bg-red-100 text-red-800 text-lg font-semibold px-8 py-4 rounded-2xl shadow-lg mb-8 animate-fade-in">
            Error: {error}
          </div>
        )}

        {/* Info Message Display */}
        {infoMessage && (
          <div className="bg-green-100 text-green-800 text-lg font-semibold px-8 py-4 rounded-2xl shadow-lg mb-8 animate-fade-in">
            {infoMessage}
          </div>
        )}

        {/* Upload Phase UI */}
        {phase === "upload" && (
          <div className="flex flex-col items-center w-full max-w-xl">
            {/* Project Description */}
            <p className="mb-8 text-xl text-center text-gray-600 dark:text-gray-300 leading-relaxed">
              Transform your documents into interactive flashcards instantly!
              FlashyGen uses AI to extract key information and create personalized quizzes,
              helping you learn faster and more efficiently.
            </p>

            {/* Removed Call-to-Action */}
            {/* <p className="mb-10 text-2xl font-semibold text-center text-purple-700 dark:text-purple-300 animate-pulse-subtle">
              Ready to supercharge your study? Upload a document to begin!
            </p> */}

            <button
              className="w-full flex flex-col items-center justify-center py-10 px-6 text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 text-white rounded-3xl shadow-2xl hover:scale-105 hover:shadow-pink-300 transition-all duration-300"
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={loading} // Disable button when loading
            >
              {loading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {currentLoadingMessage} {/* Display dynamic loading message */}
                </div>
              ) : (
                <>
                  <Upload className="w-16 h-16 mb-4 text-white animate-bounce" />
                  {file ? file.name : "Choose File"} {/* Changed text for clarity */}
                  <span className="mt-2 text-lg font-medium text-white/80">
                    Only PDF, PPTX, or TXT files allowed
                  </span>
                </>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.pptx,.txt"
              onChange={(e) => setFile(e.target.files[0])}
              className="hidden"
              disabled={loading} // Disable input when loading
            />
            <button
              className={`w-full py-5 mt-8 text-2xl font-extrabold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white rounded-3xl shadow-2xl flex items-center justify-center transition-all duration-300 ${
                !file || loading ? "opacity-50 cursor-not-allowed" : "hover:scale-105 hover:shadow-pink-300"
              }`}
              onClick={handleUpload}
              disabled={!file || loading}
            >
              <PlayCircle className="w-8 h-8 mr-3" />
              Start Generating Flashcards
            </button>
          </div>
        )}

        {/* Saved Cards Modal/Display */}
        {showSaved && (
          <div className="fixed inset-0 bg-black/70 z-40 flex flex-col items-center justify-center p-4">
            <div className={`rounded-3xl p-8 max-w-xl w-full shadow-2xl overflow-y-auto max-h-[80vh] ${themeCard}`}>
              <h2 className="text-3xl font-bold mb-6 text-purple-700 text-center">Saved Cards</h2>
              {!isAuthReady && <div className="text-gray-500 text-center mb-4">Loading user data...</div>}
              {isAuthReady && savedCards.length === 0 ? (
                <div className="text-gray-500 text-center">No cards saved yet. Click the bookmark icon on a flashcard to save it!</div>
              ) : (
                savedCards.map((card) => (
                  <div key={card.id} className="mb-6 p-4 border rounded-xl shadow bg-purple-50 flex flex-col gap-2">
                    <div className="font-bold text-lg text-gray-800 mb-2">{card.question}</div>
                    <div className="text-purple-700">{card.answer}</div>
                    <button
                      className="mt-2 px-4 py-1 bg-red-100 text-red-700 rounded-full font-bold shadow hover:bg-red-200 transition self-end"
                      onClick={() => handleUnsaveCard(card)}
                    >
                      Unsave
                    </button>
                  </div>
                ))
              )}
              <button
                className="mt-4 px-6 py-2 bg-purple-700 text-white rounded-full font-bold shadow hover:bg-purple-800 transition"
                onClick={() => setShowSaved(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Quiz Library Modal/Display */}
        {showQuizLibrary && (
          <div className="fixed inset-0 bg-black/70 z-40 flex flex-col items-center justify-center p-4">
            <div className={`rounded-3xl p-8 max-w-xl w-full shadow-2xl overflow-y-auto max-h-[80vh] ${themeCard}`}>
              <h2 className="text-3xl font-bold mb-6 text-blue-700 text-center">My Quiz Library</h2>
              {!isAuthReady && <div className="text-gray-500 text-center mb-4">Loading user data...</div>}
              {isAuthReady && userQuizzes.length === 0 ? (
                <div className="text-gray-500 text-center">No quizzes saved yet. Generate one and save it!</div>
              ) : (
                userQuizzes.map((quizItem) => (
                  <div key={quizItem.id} className="mb-4 p-4 border rounded-xl shadow bg-blue-50 flex flex-col gap-2">
                    {editingQuizId === quizItem.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingQuizName}
                          onChange={(e) => setEditingQuizName(e.target.value)}
                          className="flex-grow p-2 rounded-md border border-gray-300 text-gray-800"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              renameQuizInFirestore(quizItem.id, editingQuizName);
                            }
                          }}
                        />
                        <button
                          className="p-2 rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition"
                          onClick={() => renameQuizInFirestore(quizItem.id, editingQuizName)}
                          title="Save Name"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          className="p-2 rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition"
                          onClick={() => { setEditingQuizId(null); setEditingQuizName(""); }}
                          title="Cancel Edit"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-lg text-gray-800">{quizItem.name}</div>
                        <button
                          className="p-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                          onClick={() => { setEditingQuizId(quizItem.id); setEditingQuizName(quizItem.name); }}
                          title="Edit Name"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <div className="text-sm text-gray-600">
                      Format: {quizItem.format} | Difficulty: {quizItem.difficulty}
                    </div>
                    <div className="text-sm text-gray-600">
                      Created: {new Date(quizItem.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        className="px-4 py-1 bg-blue-100 text-blue-700 rounded-full font-bold shadow hover:bg-blue-200 transition"
                        onClick={() => loadQuizFromFirestore(quizItem)}
                      >
                        Load
                      </button>
                      <button
                        className="px-4 py-1 bg-red-100 text-red-700 rounded-full font-bold shadow hover:bg-red-200 transition"
                        onClick={() => deleteQuizFromFirestore(quizItem.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
              <button
                className="mt-4 px-6 py-2 bg-blue-700 text-white rounded-full font-bold shadow hover:bg-blue-800 transition"
                onClick={() => setShowQuizLibrary(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Quiz Phase UI */}
        {phase === "quiz" && quiz.length > 0 && (
          <div className="w-full max-w-xl animate-fade-in">
            {/* IMPORTANT: Added key={current} to force re-render and reset internal state */}
            <QuizCard
              key={current}
              question={quiz[current]}
              onNext={handleNext}
              onSave={handleSaveCard}
              onUnsave={handleUnsaveCard}
              savedCards={savedCards}
            />
            <div className="text-center text-white mt-4 text-lg font-medium">
                Card {current + 1} of {quiz.length}
            </div>
            {/* Save Quiz to Firestore Button */}
            <button
              className="mt-8 py-3 px-8 bg-green-600 text-white rounded-full text-lg font-bold shadow-lg hover:bg-green-700 transition-all duration-300 transform hover:scale-105 w-full"
              // Pass current quiz format and difficulty for saving metadata
              onClick={() => saveQuizToFirestore(quiz, file.name, quizFormat, difficulty)}
              disabled={loading || !userId} // Disable if loading or not authenticated
            >
              Save Quiz to Library
            </button>
          </div>
        )}

        {/* Done Phase UI */}
        {phase === "done" && (
          <div className="flex flex-col items-center">
            <div className="bg-green-100 text-green-800 text-lg font-semibold px-8 py-6 rounded-2xl shadow-lg animate-bounce-in">
              🎉 You've reviewed all cards! 🎉
            </div>
            <button
              onClick={resetQuiz}
              className="mt-8 py-3 px-8 bg-blue-600 text-white rounded-full text-lg font-bold shadow-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-105"
            >
              Start New Quiz
            </button>
          </div>
        )}

        {/* Global Animations */}
        <style>
          {`
            @keyframes gradientMove {
              0% { background-position: 0% 50%; }
              100% { background-position: 100% 50%; }
            }
            .animate-gradient {
              background-size: 200% 200%;
            }
            /* Custom glow animations for theme toggle icons */
            @keyframes glowLight {
              0%, 100% { filter: brightness(1) drop-shadow(0 0 4px rgba(255, 255, 0, 0.4)); }
              50% { filter: brightness(1.25) drop-shadow(0 0 8px rgba(255, 255, 0, 0.8)); }
            }
            .animate-glow-light {
              animation: glowLight 1.5s ease-in-out infinite alternate;
            }

            @keyframes glowDark {
              0%, 100% { filter: brightness(1) drop-shadow(0 0 4px rgba(128, 0, 128, 0.4)); }
              50% { filter: brightness(1.25) drop-shadow(0 0 8px rgba(128, 0, 128, 0.8)); }
            }
            .animate-glow-dark {
              animation: glowDark 1.5s ease-in-out infinite alternate;
            }

            /* New subtle animations for Sun/Moon icons */
            @keyframes spin-subtle {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .animate-spin-subtle {
              animation: spin-subtle 8s linear infinite; /* Slower spin */
            }

            @keyframes float-subtle {
              0% { transform: translateY(0px); }
              50% { transform: translateY(-5px); }
              100% { transform: translateY(0px); }
            }
            .animate-float-subtle {
              animation: float-subtle 3s ease-in-out infinite; /* Gentle float */
            }

            /* New animation for CTA */
            @keyframes pulse-subtle {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.7; }
            }
            .animate-pulse-subtle {
              animation: pulse-subtle 2s ease-in-out infinite;
            }


            /* Existing animations */
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(30px);}
              to { opacity: 1; transform: translateY(0);}
            }
            .animate-fade-in {
              animation: fadeIn 0.7s;
            }
            @keyframes bounceIn {
              0% { transform: scale(0.8); opacity: 0;}
              60% { transform: scale(1.05);}
              100% { transform: scale(1); opacity: 1;}
            }
            .animate-bounce-in {
              animation: bounceIn 0.7s;
            }
            @keyframes fadeInUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .animate-fade-in-up {
              animation: fadeInUp 0.5s ease-out forwards;
            }
          `}
        </style>
      </div>
    </div>
  );
}
