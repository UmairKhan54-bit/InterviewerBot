
export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  isError?: boolean;
}

export interface User {
  name: string;
  age: number;
}

export enum InterviewType {
  CODING = 'Coding Questions',
  SYSTEM_DESIGN = 'System Design',
  GENERAL_MIX = 'General Mix',
}

export enum DifficultyLevel {
  EASY = 'Easy',
  INTERMEDIATE = 'Intermediate',
  HARD = 'Hard',
}

export enum InterviewPhase {
  INITIALIZING = 'INITIALIZING',
  LOGIN = 'LOGIN',
  SELECTING_TYPE = 'SELECTING_TYPE',
  SELECTING_DIFFICULTY = 'SELECTING_DIFFICULTY',
  STARTING_INTERVIEW = 'STARTING_INTERVIEW',
  READY = 'READY',
  ERROR = 'ERROR',
  // VIEW_PUBLIC_RECORDS was here
}

export interface InterviewRecord {
  id: string;
  userId: string; // User's name
  userAgeAtInterview: number; // User's age at the time of this specific interview
  interviewType: InterviewType;
  difficultyLevel: DifficultyLevel;
  timestamp: string; // ISO string for date
  messages: ChatMessage[];
  finalSummaryText?: string;
  overallScore?: number;
}

export interface RecentInterviewSummary {
  userName: string;
  userAgeAtInterview: number;
  lastOverallScore?: number;
  lastInterviewTimestamp: string;
}

// UserWithRecords interface was here
