
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import MessageBubble from './MessageBubble';
import SendIcon from './icons/SendIcon';
import SpinnerIcon from './icons/SpinnerIcon';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  error: string | null; // Kept for future if specific errors needed here, but App.tsx handles general ones
  userName: string; // Added userName
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isLoading, error, userName }) => {
  const [inputValue, setInputValue] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'; // Reset height
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`; // Set to scroll height
    }
  }, [inputValue]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <div className="flex flex-col flex-grow h-full overflow-hidden">
      <div className="flex-grow overflow-y-auto p-4 md:p-6 space-y-4 bg-stone-800/60 scroll-smooth">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} currentUserName={userName} />
        ))}
        {isLoading && messages[messages.length-1]?.sender === 'user' && (
           <div className="flex items-center space-x-2 animate-pulse p-2 rounded-lg max-w-xs md:max-w-md lg:max-w-lg self-start">
             <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-stone-800">
                AI
             </div>
             <div className="p-1">
                <SpinnerIcon className="w-5 h-5 text-yellow-400" />
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* Global error display is in App.tsx now
      {error && <div className="p-3 bg-red-600 text-white text-sm text-center">{error}</div>} 
      */}
      <form onSubmit={handleSubmit} className="bg-stone-900 border-t border-orange-700/50 p-3 md:p-4 flex items-end space-x-3">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type your answer..."
          className="flex-grow p-3 bg-stone-700 text-yellow-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none resize-none max-h-40 overflow-y-auto placeholder-yellow-500/70"
          rows={1}
          disabled={isLoading}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !inputValue.trim()}
          className="p-3 bg-orange-600 hover:bg-orange-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-orange-400 flex items-center justify-center h-[50px] w-[50px] aspect-square"
        >
          {isLoading && messages[messages.length-1]?.sender === 'user' ? <SpinnerIcon className="w-5 h-5" /> : <SendIcon className="w-5 h-5" />}
        </button>
      </form>
    </div>
  );
};

export default ChatInterface;
