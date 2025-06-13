
import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import ChatInterface from './components/ChatInterface';
import { ChatMessage, InterviewPhase, InterviewType, DifficultyLevel, User, InterviewRecord, RecentInterviewSummary } from './types';
import { GoogleGenAI, Chat, GenerateContentResponse } from '@google/genai';
import { INITIAL_SYSTEM_INSTRUCTION, AI_NAME, INTERVIEW_TYPES, DIFFICULTY_LEVELS, FINAL_SUMMARY_REQUEST_PROMPT } from './constants';
import SpinnerIcon from './components/icons/SpinnerIcon';


const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginNameInput, setLoginNameInput] = useState<string>('');
  const [loginAgeInput, setLoginAgeInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [interviewPhase, setInterviewPhase] = useState<InterviewPhase>(InterviewPhase.INITIALIZING);
  const [selectedInterviewType, setSelectedInterviewType] = useState<InterviewType | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel | null>(null);
  const [isAwaitingFinalSummary, setIsAwaitingFinalSummary] = useState<boolean>(false);
  const [recentInterviewsSummary, setRecentInterviewsSummary] = useState<RecentInterviewSummary[]>([]);


  const MAX_RECENT_INTERVIEWS = 5;

  const loadRecentInterviewsSummary = useCallback(() => {
    const summaries: RecentInterviewSummary[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('interviewHistory_')) {
          const historyJson = localStorage.getItem(key);
          if (historyJson) {
            const userRecords: InterviewRecord[] = JSON.parse(historyJson);
            if (Array.isArray(userRecords) && userRecords.length > 0) {
              userRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              const latestRecord = userRecords[0];
              summaries.push({
                userName: latestRecord.userId,
                userAgeAtInterview: latestRecord.userAgeAtInterview,
                lastOverallScore: latestRecord.overallScore,
                lastInterviewTimestamp: latestRecord.timestamp,
              });
            }
          }
        }
      }
      summaries.sort((a, b) => new Date(b.lastInterviewTimestamp).getTime() - new Date(a.lastInterviewTimestamp).getTime());
      setRecentInterviewsSummary(summaries.slice(0, MAX_RECENT_INTERVIEWS));
    } catch (e) {
      console.error("Failed to load or parse recent interview summaries:", e);
      setRecentInterviewsSummary([]);
    }
  }, []);

  const initializeApp = useCallback(() => {
    setIsLoading(true);
    setError(null);
    if (!process.env.API_KEY) {
      setError("API_KEY environment variable is not set. Please configure it to use the AI features.");
      setApiKeyMissing(true);
      setInterviewPhase(InterviewPhase.ERROR);
      setIsLoading(false);
      return;
    }
    setApiKeyMissing(false);
    loadRecentInterviewsSummary(); 

    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        const user: User = JSON.parse(storedUser);
        setCurrentUser(user);
        setInterviewPhase(InterviewPhase.SELECTING_TYPE);
      } catch (e) {
        console.error("Failed to parse stored user:", e);
        localStorage.removeItem('currentUser');
        setInterviewPhase(InterviewPhase.LOGIN);
      }
    } else {
      setInterviewPhase(InterviewPhase.LOGIN);
    }
    setIsLoading(false);
  }, [loadRecentInterviewsSummary]);

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const age = parseInt(loginAgeInput, 10);
    if (!loginNameInput.trim()) {
      setLoginError("Name cannot be empty.");
      return;
    }
    if (isNaN(age) || age < 5 || age > 120) {
      setLoginError("Please enter a valid age (5-120).");
      return;
    }
    const user: User = { name: loginNameInput.trim(), age };
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    setInterviewPhase(InterviewPhase.SELECTING_TYPE);
    setLoginNameInput(''); 
    setLoginAgeInput('');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    setMessages([]);
    setChatSession(null);
    setSelectedInterviewType(null);
    setSelectedDifficulty(null);
    setError(null);
    setIsAwaitingFinalSummary(false);
    loadRecentInterviewsSummary(); 
    setInterviewPhase(InterviewPhase.LOGIN);
  };

  const handleSelectInterviewType = (type: InterviewType) => {
    setSelectedInterviewType(type);
    setInterviewPhase(InterviewPhase.SELECTING_DIFFICULTY);
  };

  const handleGoBackToTypeSelection = () => {
    setInterviewPhase(InterviewPhase.SELECTING_TYPE);
    setSelectedDifficulty(null); 
  };
  
  const parseAISummaryForScoreAndText = (text: string): { score?: number; summaryText: string } => {
    const scoreRegexPattern = "(?:Overall\\s+(?:Numerical\\s+)?Score|Final\\s+Score|Numerical\\s+Score|Interview\\s+Score):\\s*(\\d{1,2})\\s*(?:\\/\\s*10|\\s+out\\s+of\\s+10)";
    const scoreRegex = new RegExp(scoreRegexPattern, "i");
    
    const scoreMatch = text.match(scoreRegex);
    const score = scoreMatch && scoreMatch[1] ? parseInt(scoreMatch[1], 10) : undefined;
    
    let fallbackScore: number | undefined = undefined;
    if (score === undefined) {
        const fallbackRegexPattern = "(?:Overall|Final)\\s+Score:\\s*(\\d{1,2})\\/10";
        const fallbackRegex = new RegExp(fallbackRegexPattern, "i");
        const fallbackMatch = text.match(fallbackRegex);

        if (fallbackMatch && fallbackMatch[1]) {
            fallbackScore = parseInt(fallbackMatch[1], 10);
        } else {
            const genericScoreRegexPattern = "(?<!Question\\s*for this question:\\s*)\\bScore:\\s*(\\d{1,2})\\/10";
            const genericScoreRegex = new RegExp(genericScoreRegexPattern, "i");
            const genericMatch = text.match(genericScoreRegex);

            if (genericMatch && genericMatch[1]) {
                const precedingText = text.substring(0, genericMatch.index);
                const individualQuestionScorePattern = "Score for this question:";
                const individualQuestionScoreRegex = new RegExp(individualQuestionScorePattern, "i");
                if (!individualQuestionScoreRegex.test(precedingText.slice(-50))) { 
                    fallbackScore = parseInt(genericMatch[1], 10);
                }
            }
        }
    }
    
    return { score: score !== undefined ? score : fallbackScore, summaryText: text };
  };

  const saveInterviewRecord = (finalAiText: string) => {
    if (!currentUser || !selectedInterviewType || !selectedDifficulty) return;

    const { score, summaryText } = parseAISummaryForScoreAndText(finalAiText);

    const record: InterviewRecord = {
      id: Date.now().toString(),
      userId: currentUser.name,
      userAgeAtInterview: currentUser.age, 
      interviewType: selectedInterviewType,
      difficultyLevel: selectedDifficulty,
      timestamp: new Date().toISOString(),
      messages: messages, 
      finalSummaryText: summaryText,
      overallScore: score,
    };

    try {
      const historyKey = `interviewHistory_${currentUser.name}`;
      const existingHistoryJson = localStorage.getItem(historyKey);
      const history: InterviewRecord[] = existingHistoryJson ? JSON.parse(existingHistoryJson) : [];
      history.push(record);
      localStorage.setItem(historyKey, JSON.stringify(history));
      
      if (finalAiText.startsWith("Error: Could not get AI response")) {
        setError("Interview attempt (with AI error) saved locally.");
      } else {
        setError("Interview summary and score saved locally!");
      }
      setTimeout(() => setError(null), 5000); 
      loadRecentInterviewsSummary(); 
    } catch (e) {
      console.error("Failed to save interview record:", e);
      setError("Failed to save interview record to local storage.");
    }
  };


  const handleSelectDifficulty = async (difficulty: DifficultyLevel) => {
    if (!currentUser) {
        setError("User not logged in. Please login first.");
        setInterviewPhase(InterviewPhase.LOGIN);
        return;
    }
    setSelectedDifficulty(difficulty);
    setInterviewPhase(InterviewPhase.STARTING_INTERVIEW);
    setIsLoading(true);
    setError(null);
    setMessages([]);

    if (!selectedInterviewType) {
        setError("Interview type not selected. Please restart.");
        setInterviewPhase(InterviewPhase.ERROR);
        setIsLoading(false);
        return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      const chat = ai.chats.create({
        model: 'gemini-2.5-flash-preview-04-17',
        config: {
          systemInstruction: INITIAL_SYSTEM_INSTRUCTION,
        },
      });
      setChatSession(chat);

      const initialUserPrompt = `User is ${currentUser.name}, ${currentUser.age} years old. I'd like to start a mock interview. Type: ${INTERVIEW_TYPES.find(it => it.id === selectedInterviewType)?.label || selectedInterviewType}, Difficulty: ${DIFFICULTY_LEVELS.find(dl => dl.id === difficulty)?.label || difficulty}. Please greet me by name, briefly explain that you provide qualitative feedback and numerical scores, confirm my selections, inform me I can ask for an interim summary, and then ask the first question.`;
      
      const aiWelcomeMessageId = Date.now().toString() + '_ai_initial';
      setMessages([{
        id: aiWelcomeMessageId,
        text: '', 
        sender: 'ai',
        timestamp: new Date()
      }]);
      
      const response: GenerateContentResponse = await chat.sendMessage({ message: initialUserPrompt });
      const accumulatedText = response.text; 

      setMessages(prevMessages => prevMessages.map(msg => 
        msg.id === aiWelcomeMessageId ? { ...msg, text: accumulatedText } : msg
      ));
      
      setInterviewPhase(InterviewPhase.READY);

    } catch (err) {
      console.error("Failed to initialize AI chat session or get first question:", err);
      let detailedErrorMessage = `Failed to start interview. `;
      if (err instanceof Error) {
        detailedErrorMessage += `Error: ${err.message}.`;
      } else {
        detailedErrorMessage += `Unknown error: ${String(err)}.`;
      }
      setError(detailedErrorMessage);
      setInterviewPhase(InterviewPhase.ERROR);
    } finally {
      setIsLoading(false);
    }
  };


  const handleSendMessage = async (text: string, isSummaryRequest: boolean = false) => {
    if (!chatSession || isLoading || apiKeyMissing || interviewPhase !== InterviewPhase.READY || !currentUser) return;

    if (isSummaryRequest) {
      setIsAwaitingFinalSummary(true);
    }

    const newUserMessage: ChatMessage = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prevMessages => [...prevMessages, newUserMessage]);
    setIsLoading(true);
    setError(null);

    const aiResponseId = (Date.now() + 1).toString() + '_ai';
    setMessages(prevMessages => [...prevMessages, {
      id: aiResponseId,
      text: '', 
      sender: 'ai',
      timestamp: new Date()
    }]);
    
    let accumulatedText = ""; 

    try {
      const stream: AsyncIterable<GenerateContentResponse> = await chatSession.sendMessageStream({ message: text });
      for await (const chunk of stream) {
        if (chunk.text) {
          accumulatedText += chunk.text;
          setMessages(prevMessages => prevMessages.map(msg => 
            msg.id === aiResponseId ? { ...msg, text: accumulatedText } : msg
          ));
        }
      }
      if (accumulatedText === "" && !isSummaryRequest) { 
         setMessages(prevMessages => prevMessages.map(msg => 
            msg.id === aiResponseId ? { ...msg, text: "[The AI didn't provide a textual response. Try rephrasing or ask another question.]" } : msg
        ));
      }

    } catch (err) {
      console.error("Failed to send message or get AI response:", err);
      const errorMessage = `AI Error: ${err instanceof Error ? err.message : 'Could not get response'}`;
      setError(errorMessage); 
      accumulatedText = `Error: Could not get AI response. ${errorMessage}`; 
      setMessages(prevMessages => prevMessages.map(msg => 
        msg.id === aiResponseId ? { ...msg, text: accumulatedText, isError: true } : msg
      ));
    } finally {
      setIsLoading(false);
    }

    if (isSummaryRequest && isAwaitingFinalSummary) {
      saveInterviewRecord(accumulatedText); 
      setIsAwaitingFinalSummary(false); 
    }
  };

  const handleRestartInterview = () => {
    setMessages([]);
    setSelectedInterviewType(null);
    setSelectedDifficulty(null);
    setChatSession(null); 
    setError(null);
    setIsLoading(false);
    setIsAwaitingFinalSummary(false);
    if (currentUser) {
        setInterviewPhase(InterviewPhase.SELECTING_TYPE);
    } else {
        setInterviewPhase(InterviewPhase.LOGIN); 
    }
  };

  const handleEndInterviewRequest = () => {
    if (interviewPhase === InterviewPhase.READY && !isLoading) {
        handleSendMessage(FINAL_SUMMARY_REQUEST_PROMPT, true);
    }
  };

  const handleLoginAsRecentUser = (userSummary: RecentInterviewSummary) => {
    setLoginNameInput(userSummary.userName);
    setLoginAgeInput(userSummary.userAgeAtInterview.toString()); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const renderSelectionButton = (label: string, onClickHandler: () => void, key: string, primary: boolean = true, customClasses: string = "", disabled: boolean = false) => (
    <button
      key={key}
      onClick={onClickHandler}
      disabled={disabled}
      className={`w-full md:w-auto min-w-[150px] font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-opacity-75 disabled:opacity-50 disabled:cursor-not-allowed ${
        primary 
          ? 'bg-orange-500 hover:bg-orange-600 text-white focus:ring-orange-400' 
          : 'bg-yellow-500 hover:bg-yellow-600 text-stone-800 focus:ring-yellow-400'
      } ${customClasses}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-stone-900 via-stone-800 to-yellow-900/30">
      <header className="bg-stone-950/80 backdrop-blur-md shadow-lg p-4 flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-yellow-300">
            {currentUser ? `Welcome, ${currentUser.name} (${currentUser.age})` : "Welcome!"}
        </div>
        <div className="text-center flex-grow min-w-[200px]">
            <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400">
            Mock Interviewer AI
            </h1>
        </div>
        <div className="flex items-center space-x-2 flex-wrap">
            {currentUser && interviewPhase === InterviewPhase.READY && !isAwaitingFinalSummary && (
                 <button
                    onClick={handleEndInterviewRequest}
                    disabled={isLoading}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-3 rounded-lg shadow-md text-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-500"
                    aria-label="End Interview and Get Summary"
                >
                    End & Save
                </button>
            )}
            {currentUser && (interviewPhase === InterviewPhase.READY || interviewPhase === InterviewPhase.SELECTING_DIFFICULTY || interviewPhase === InterviewPhase.SELECTING_TYPE) && (
                <button
                    onClick={handleRestartInterview}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-lg shadow-md text-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Restart Session"
                >
                    Restart Session
                </button>
            )}
            {currentUser && (
                <button
                    onClick={handleLogout}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-3 rounded-lg shadow-md text-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label="Logout"
                >
                    Logout
                </button>
            )}
        </div>
      </header>
      
      {apiKeyMissing && (
        <div className="p-4 bg-red-700 text-white text-center">
          API Key error. Please configure the API_KEY environment variable.
        </div>
      )}
      {error && !apiKeyMissing && (
        <div className={`p-3 text-white text-sm text-center ${error.startsWith("Failed to save") || error.startsWith("AI Error:") || error.startsWith("Failed to load public") || error.startsWith("Failed to start interview") || error.startsWith("Failed to access") ? 'bg-red-500' : 'bg-green-600'}`}>
          {error}
        </div>
      )}


      <div className="flex-grow flex flex-col items-center justify-center p-4 overflow-y-auto">
        {interviewPhase === InterviewPhase.INITIALIZING && !apiKeyMissing && (
            <div className="text-center">
                <SpinnerIcon className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                <p className="text-xl text-yellow-300">Initializing Interviewer AI...</p>
            </div>
        )}

        {interviewPhase === InterviewPhase.LOGIN && !apiKeyMissing && (
        <div className="w-full max-w-xl p-2 md:p-4">
          <form onSubmit={handleLogin} className="w-full bg-stone-800/70 rounded-xl shadow-2xl p-6 md:p-8 space-y-6 mb-8">
            <h2 className="text-3xl font-bold text-center text-yellow-400 mb-6">User Login</h2>
            {loginError && <p className="text-red-400 text-sm bg-red-900/50 p-2 rounded-md">{loginError}</p>}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-orange-300 mb-1">Your Name</label>
              <input
                type="text"
                id="name"
                value={loginNameInput}
                onChange={(e) => setLoginNameInput(e.target.value)}
                className="w-full p-3 bg-stone-700 text-yellow-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none placeholder-yellow-500/70"
                placeholder="E.g., Ada Lovelace"
                required
              />
            </div>
            <div>
              <label htmlFor="age" className="block text-sm font-medium text-orange-300 mb-1">Your Age</label>
              <input
                type="number"
                id="age"
                value={loginAgeInput}
                onChange={(e) => setLoginAgeInput(e.target.value)}
                className="w-full p-3 bg-stone-700 text-yellow-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none placeholder-yellow-500/70"
                placeholder="E.g., 28"
                min="5"
                max="120"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-opacity-75 bg-orange-500 hover:bg-orange-600 text-white focus:ring-orange-400"
            >
              Start Session
            </button>
          </form>

          {recentInterviewsSummary.length > 0 && (
            <div className="w-full bg-stone-800/50 rounded-xl shadow-xl p-6 md:p-8">
              <h3 className="text-2xl font-semibold text-center text-yellow-300 mb-6">Recent Interviews</h3>
              <ul className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {recentInterviewsSummary.map((summary, index) => (
                  <li key={`${summary.userName}-${index}`} className="p-4 bg-stone-700/80 rounded-lg shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <p className="text-lg font-semibold text-orange-400">{summary.userName}</p>
                      <p className="text-sm text-yellow-200">Age at interview: {summary.userAgeAtInterview}</p>
                      <p className="text-sm text-yellow-200">Last Score: {summary.lastOverallScore !== undefined ? `${summary.lastOverallScore}/10` : 'N/A'}</p>
                      <p className="text-xs text-yellow-400/80">Date: {new Date(summary.lastInterviewTimestamp).toLocaleDateString()}</p>
                    </div>
                    <button
                      onClick={() => handleLoginAsRecentUser(summary)}
                      className="bg-sky-600 hover:bg-sky-700 text-white font-medium py-2 px-4 rounded-md text-sm shadow-md transition-colors duration-150 whitespace-nowrap"
                    >
                      Login as {summary.userName.split(' ')[0]}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        )}
        
        {interviewPhase === InterviewPhase.ERROR && !apiKeyMissing && !error?.startsWith("Interview summary and score saved") && !error?.startsWith("Interview attempt (with AI error) saved") && ( 
          <p className="text-xl text-red-400 text-center">{error || "An unexpected error occurred."}</p>
        )}

        {currentUser && interviewPhase === InterviewPhase.SELECTING_TYPE && !apiKeyMissing && (
          <div className="text-center space-y-6 w-full max-w-md">
            <h2 className="text-2xl font-semibold text-yellow-200 mb-6">Select Interview Type</h2>
            <div className="space-y-4 md:space-y-0 md:space-x-4 flex flex-col md:flex-row justify-center">
              {INTERVIEW_TYPES.map(type => renderSelectionButton(type.label, () => handleSelectInterviewType(type.id), type.id))}
            </div>
          </div>
        )}

        {currentUser && interviewPhase === InterviewPhase.SELECTING_DIFFICULTY && selectedInterviewType && !apiKeyMissing && (
          <div className="text-center space-y-6 w-full max-w-lg">
            <p className="text-orange-300">Selected Type: <span className="font-semibold text-yellow-400">{INTERVIEW_TYPES.find(it => it.id === selectedInterviewType)?.label || selectedInterviewType}</span></p>
            <h2 className="text-2xl font-semibold text-yellow-200 mb-6">Select Difficulty Level</h2>
            <div className="space-y-4 md:space-y-0 md:space-x-4 flex flex-col md:flex-row justify-center mb-6">
              {DIFFICULTY_LEVELS.map(level => renderSelectionButton(level.label, () => handleSelectDifficulty(level.id), level.id))}
            </div>
            {renderSelectionButton("Back to Type Selection", handleGoBackToTypeSelection, "back-button", false, "md:min-w-[200px]")}
          </div>
        )}
        
        {currentUser && interviewPhase === InterviewPhase.STARTING_INTERVIEW && !apiKeyMissing && (
             <div className="text-center">
                <SpinnerIcon className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                <p className="text-xl text-yellow-300">
                  Preparing your <span className="font-semibold text-orange-400">{INTERVIEW_TYPES.find(it => it.id === selectedInterviewType)?.label || selectedInterviewType}</span> interview 
                  at <span className="font-semibold text-orange-400">{DIFFICULTY_LEVELS.find(dl => dl.id === selectedDifficulty)?.label || selectedDifficulty}</span> difficulty for {currentUser.name}...
                </p>
            </div>
        )}

      </div>

      {currentUser && interviewPhase === InterviewPhase.READY && !apiKeyMissing && (
        <ChatInterface
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          error={null} 
          userName={currentUser.name}
        />
      )}
    </div>
  );
};

export default App;
