
import React from 'react';
import { ChatMessage } from '../types';
import { AI_NAME } from '../constants'; // USER_NAME removed as it's dynamic now
import BotIcon from './icons/BotIcon';
import UserIcon from './icons/UserIcon';

interface MessageBubbleProps {
  message: ChatMessage;
  currentUserName: string; // Added to display actual user name
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, currentUserName }) => {
  const isUser = message.sender === 'user';
  const bubbleClasses = isUser
    ? 'bg-orange-600 text-white self-end rounded-l-xl rounded-tr-xl'
    : 'bg-stone-700 text-yellow-100 self-start rounded-r-xl rounded-tl-xl';
  
  const alignmentClasses = isUser ? 'items-end' : 'items-start';

  // Basic markdown-like formatting for newlines
  const formattedText = message.text.split('\n').map((line, index, arr) => (
    <React.Fragment key={index}>
      {line}
      {index < arr.length - 1 && <br />}
    </React.Fragment>
  ));
  
  const senderDisplayName = isUser ? currentUserName : AI_NAME;

  return (
    <div className={`flex flex-col w-full ${alignmentClasses}`}>
      <div className={`flex items-end space-x-2 max-w-xl ${isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${isUser ? 'bg-yellow-500 text-stone-800' : 'bg-orange-500 text-white'}`}>
          {isUser ? <UserIcon className="w-5 h-5"/> : <BotIcon className="w-5 h-5"/>}
        </div>
        <div
          className={`px-4 py-3 shadow-md ${bubbleClasses} ${message.isError ? 'bg-red-600 text-white' : ''}`}
          style={{ overflowWrap: 'break-word', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
        >
          <p className="text-sm">{formattedText}</p>
        </div>
      </div>
      <p className={`text-xs text-orange-300/80 mt-1 ${isUser ? 'text-right' : 'text-left ml-10'}`}>
        {senderDisplayName} - {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
};

export default MessageBubble;
