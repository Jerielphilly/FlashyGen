import React, { useState, useEffect } from "react";

export default function QuizCard({ question, onNext }) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setFlipped(false);
  }, [question]);

  if (!question) {
    return <div className="text-red-500 text-center text-xl font-bold p-8">Error: Quiz question data is missing.</div>;
  }

  return (
    <div
      className="relative w-full max-w-xl h-96 mx-auto cursor-pointer perspective"
      onClick={handleCardClick}
    >
      <div
        className={`absolute w-full h-full transition-transform duration-500 rounded-3xl shadow-2xl ${
          flipped ? "rotate-y-180" : ""
        }`}
        style={{
          transformStyle: "preserve-3d",
        }}
      >
        {/* Front (Question) */}
        <div
          className="absolute w-full h-full bg-white rounded-3xl flex items-center justify-center text-3xl font-bold text-gray-800 backface-hidden p-8 text-center"
        >
          {question.question || "No Question Provided"}
        </div>
        {/* Back (Answer) */}
        <div
          className="absolute w-full h-full bg-purple-700 rounded-3xl flex flex-col items-center justify-center text-2xl text-white backface-hidden p-8 rotate-y-180 text-center"
        >
          <div>
            <span className="font-semibold">Answer:</span> {question.answer || "No Answer Provided"}
          </div>
          <button
            className="mt-8 py-3 px-8 bg-white text-purple-700 rounded-full font-bold shadow-lg hover:bg-purple-200 transition-all duration-300 transform hover:scale-105"
            onClick={(e) => {
              e.stopPropagation();
              setFlipped(false);
              onNext();
            }}
          >
            Next Card
          </button>
        </div>
      </div>
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

  function handleCardClick() {
    setFlipped((f) => !f);
  }
}import { Bookmark } from "lucide-react";
import React, { useState, useEffect } from "react";

export default function QuizCard({ question, onNext, onSave }) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => setFlipped(false), [question]);

  if (!question) {
    return <div className="text-red-500 text-center text-xl font-bold p-8">Error: Quiz question data is missing.</div>;
  }

  return (
    <div
      className="relative w-full max-w-xl h-96 mx-auto cursor-pointer perspective"
      onClick={handleCardClick}
    >
      {/* Save Icon Button */}
      <button
        className="absolute top-4 right-4 z-20 bg-white/80 rounded-full p-2 shadow hover:bg-purple-200 transition"
        onClick={e => {
          e.stopPropagation();
          onSave(question);
        }}
        title="Save this card"
      >
        <Bookmark className="w-6 h-6 text-purple-700" />
      </button>
      <div
        className={`absolute w-full h-full transition-transform duration-500 rounded-3xl shadow-2xl ${
          flipped ? "rotate-y-180" : ""
        }`}
        style={{
          transformStyle: "preserve-3d",
        }}
      >
        {/* Front (Question) */}
        <div
          className="absolute w-full h-full bg-white rounded-3xl flex items-center justify-center text-3xl font-bold text-gray-800 backface-hidden p-8 text-center"
        >
          {question.question || "No Question Provided"}
        </div>
        {/* Back (Answer) */}
        <div
          className="absolute w-full h-full bg-purple-700 rounded-3xl flex flex-col items-center justify-center text-2xl text-white backface-hidden p-8 rotate-y-180 text-center"
        >
          <div>
            <span className="font-semibold">Answer:</span> {question.answer || "No Answer Provided"}
          </div>
          <button
            className="mt-8 py-3 px-8 bg-white text-purple-700 rounded-full font-bold shadow-lg hover:bg-purple-200 transition-all duration-300 transform hover:scale-105"
            onClick={e => {
              e.stopPropagation();
              setFlipped(false);
              onNext();
            }}
          >
            Next Card
          </button>
        </div>
      </div>
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

  function handleCardClick() {
    setFlipped(f => !f);
  }
}