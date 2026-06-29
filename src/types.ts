/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type WordLevel = "familiar" | "blur" | "unfamiliar";

export interface Word {
  id: string;
  word: string;          // Spanish word or phrase
  translationZh: string; // Chinese translation
  translationEn: string; // English translation
  level: WordLevel;      // familiar, blur, unfamiliar
  inputTime: number;     // Timestamp of creation/import
  lastReviewedTime: number | null; // Timestamp of last review
  reviewCount: number;   // Number of times reviewed
  isNew: boolean;        // Whether it has never been reviewed
  exampleSentence?: string; // Optional example sentence
  exampleTranslation?: string; // Optional example sentence translation
}

export type ReviewRecurrenceSetting = "never" | "7days" | "always";
export type PriorityRule = "time" | "level"; // Sort priority when selecting words for today's limit

export interface UserSettings {
  dailyReviewLimit: number;           // Max words to learn/review per day (e.g., 10, 20, 30, 50, 100)
  recurrenceRule: ReviewRecurrenceSetting; // What happens to "会了" (familiar) words
  priorityRule: PriorityRule;         // "时间" (time) vs "熟悉度" (level)
  language: "zh" | "en";              // Primary interface language
  showExampleSentence?: boolean;      // Toggle display of example sentences
  reminderEnabled?: boolean;          // Daily reminder enabled toggle
  reminderTime?: string;              // Time string for reminder (e.g., "09:00")
}

export interface StudyHistoryLog {
  date: string;       // YYYY-MM-DD
  masteredCount: number;  // Number of words marked "会了" on this day
  reviewedCount: number;  // Total reviews made on this day (both "会了" & "不会")
}
