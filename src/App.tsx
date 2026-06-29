/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Word,
  WordLevel,
  UserSettings,
  StudyHistoryLog,
  PriorityRule,
  ReviewRecurrenceSetting,
} from "./types";
import { defaultWords } from "./defaultWords";
import StatisticsView from "./components/StatisticsView";
import {
  BookOpen,
  PlusCircle,
  Settings,
  BarChart3,
  Trash2,
  ChevronRight,
  RefreshCw,
  Home,
  Check,
  X,
  FileText,
  Sparkles,
  HelpCircle,
  Eye,
  RotateCcw,
  Languages,
  Volume2,
  Bell,
  LogOut,
  Download,
} from "lucide-react";

// Helper for formatting today's date based on local timezone
const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Web Speech API client-side free Spanish pronunciation
const speakSpanish = (text: string) => {
  if (!window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    
    // Find voice for es-ES if available
    const voices = window.speechSynthesis.getVoices();
    const esVoice = voices.find(
      (v) => v.lang === "es-ES" || v.lang.toLowerCase().startsWith("es-es")
    );
    if (esVoice) {
      utterance.voice = esVoice;
    }
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error("Speech Synthesis Error:", err);
  }
};

const isSpanishMatch = (sentenceWord: string, target: string): boolean => {
  const clean = (str: string) =>
    str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zñ]/g, "");

  const w = clean(sentenceWord);
  const t = clean(target);
  
  if (!w || !t) return false;
  if (w === t) return true;

  // Verb infinitives (ends in "ar", "er", "ir" with length >= 4)
  if (t.length >= 4 && (t.endsWith("ar") || t.endsWith("er") || t.endsWith("ir"))) {
    const stem = t.slice(0, -2);
    // Conjugations often start with the stem and add up to 5 letters (e.g. hablábamos)
    if (w.startsWith(stem) && w.length <= stem.length + 5) {
      return true;
    }
  }

  // Adjective/Noun variations (plurals and genders)
  // helper to get the root of standard words
  const getAdjectiveStem = (str: string) => {
    if (str.endsWith("os") || str.endsWith("as")) return str.slice(0, -2);
    if (str.endsWith("es") && str.length > 3) return str.slice(0, -2);
    if (str.endsWith("o") || str.endsWith("a") || str.endsWith("e")) return str.slice(0, -1);
    return str;
  };

  const stemW = getAdjectiveStem(w);
  const stemT = getAdjectiveStem(t);
  
  if (stemW === stemT && stemW.length >= 3) {
    return true;
  }

  // General substring match: if one completely wraps another and is within close length
  if (t.length >= 4 && w.startsWith(t.slice(0, -1)) && Math.abs(w.length - t.length) <= 3) {
    return true;
  }

  return false;
};

// Highlight target word in a sentence (smart Spanish variation highlighting)
const renderSentenceWithHighlightedWord = (sentence: string, targetWord: string) => {
  if (!targetWord) return sentence;

  // Match words (including Spanish letters like ñ, á, é, í, ó, ú, ü)
  const regex = /([a-zA-ZñÑáéíóúüÁÉÍÓÚÜüí]+)/g;
  const parts = sentence.split(regex);

  return (
    <>
      {parts.map((part, index) => {
        const matched = isSpanishMatch(part, targetWord);
        return matched ? (
          <strong
            key={index}
            className="font-bold text-natural-sage underline decoration-solid bg-natural-accent/15 px-1 rounded"
          >
            {part}
          </strong>
        ) : (
          part
        );
      })}
    </>
  );
};

// Return only today empty log so history starts exactly from the first day of usage
const getInitialHistoryLogs = (): StudyHistoryLog[] => {
  return [
    {
      date: getTodayDateString(),
      masteredCount: 0,
      reviewedCount: 0,
    }
  ];
};

export default function App() {
  // --- STATE PERSISTENCE ---
  const [words, setWords] = useState<Word[]>([]);
  const [historyLogs, setHistoryLogs] = useState<StudyHistoryLog[]>([]);
  const [settings, setSettings] = useState<UserSettings>({
    dailyReviewLimit: 10,
    recurrenceRule: "never",
    priorityRule: "level",
    language: "zh",
    reminderEnabled: false,
    reminderTime: "20:00",
  });

  const [inAppReminderActive, setInAppReminderActive] = useState(false);

  // Load from LocalStorage
  const [reviewedTodayIds, setReviewedTodayIds] = useState<string[]>([]);

  useEffect(() => {
    const savedWords = localStorage.getItem("spanish_cards_words");
    if (savedWords) {
      setWords(JSON.parse(savedWords));
    } else {
      setWords(defaultWords);
      localStorage.setItem("spanish_cards_words", JSON.stringify(defaultWords));
    }

    const savedHistory = localStorage.getItem("spanish_cards_history");
    const migrated = localStorage.getItem("spanish_cards_history_migrated_v2");
    if (savedHistory && migrated === "true") {
      setHistoryLogs(JSON.parse(savedHistory));
    } else {
      const initialLogs = getInitialHistoryLogs();
      setHistoryLogs(initialLogs);
      localStorage.setItem("spanish_cards_history", JSON.stringify(initialLogs));
      localStorage.setItem("spanish_cards_history_migrated_v2", "true");
    }

    const savedSettings = localStorage.getItem("spanish_cards_settings");
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }

    const todayStr = getTodayDateString();
    const savedReviewedToday = localStorage.getItem("hola_reviewed_today");
    if (savedReviewedToday) {
      try {
        const parsed = JSON.parse(savedReviewedToday);
        if (parsed.date === todayStr) {
          setReviewedTodayIds(parsed.ids || []);
        } else {
          localStorage.setItem("hola_reviewed_today", JSON.stringify({ date: todayStr, ids: [] }));
          setReviewedTodayIds([]);
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      localStorage.setItem("hola_reviewed_today", JSON.stringify({ date: todayStr, ids: [] }));
      setReviewedTodayIds([]);
    }
  }, []);

  // Save to LocalStorage helpers
  const saveWordsToStorage = (updatedWords: Word[]) => {
    setWords(updatedWords);
    localStorage.setItem("spanish_cards_words", JSON.stringify(updatedWords));
  };

  const saveHistoryToStorage = (updatedLogs: StudyHistoryLog[]) => {
    setHistoryLogs(updatedLogs);
    localStorage.setItem("spanish_cards_history", JSON.stringify(updatedLogs));
  };

  const saveSettingsToStorage = (updatedSettings: UserSettings) => {
    setSettings(updatedSettings);
    localStorage.setItem("spanish_cards_settings", JSON.stringify(updatedSettings));
  };

  const saveReviewedTodayIds = (ids: string[]) => {
    setReviewedTodayIds(ids);
    const todayStr = getTodayDateString();
    localStorage.setItem("hola_reviewed_today", JSON.stringify({ date: todayStr, ids }));
  };

  // Midnight auto-reset checker: ensures reviewedTodayIds is cleared when clock strikes 24:00 (00:00)
  useEffect(() => {
    const checkMidnight = () => {
      const todayStr = getTodayDateString();
      const savedReviewedToday = localStorage.getItem("hola_reviewed_today");
      if (savedReviewedToday) {
        try {
          const parsed = JSON.parse(savedReviewedToday);
          if (parsed.date !== todayStr) {
            console.log(`[Midnight Reset] Date changed from ${parsed.date} to ${todayStr}. Resetting reviewedTodayIds.`);
            saveReviewedTodayIds([]);
            setSessionFinished(false);
            generateTodayQueue(words, []);
            
            triggerFeedback(
              settings.language === "zh"
                ? "已经过了 24 点！新一天的复习计划已开启！🌅"
                : "It's past midnight! A new day of review has begun! 🌅",
              "success"
            );
          }
        } catch (e) {
          console.error(e);
        }
      }
    };

    const interval = setInterval(checkMidnight, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [words, settings.language]);

  const requestNotificationPermission = () => {
    if ("Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            triggerFeedback(
              settings.language === "zh" ? "系统通知权限已开启！到点会发送系统提醒通知" : "System notifications enabled successfully!",
              "success"
            );
          }
        });
      }
    }
  };

  // Daily reminder background checker
  useEffect(() => {
    if (!settings.reminderEnabled || !settings.reminderTime) return;

    const checkReminder = () => {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, "0");
      const currentMinutes = String(now.getMinutes()).padStart(2, "0");
      const currentTimeStr = `${currentHours}:${currentMinutes}`;

      if (currentTimeStr === settings.reminderTime) {
        const todayStr = getTodayDateString();
        const lastTriggeredDate = localStorage.getItem("hola_last_reminder_date");

        if (lastTriggeredDate !== todayStr) {
          localStorage.setItem("hola_last_reminder_date", todayStr);
          
          // Trigger Web Notification
          if ("Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(settings.language === "zh" ? "📚 学习时间到了！" : "📚 Time to study!", {
                body: settings.language === "zh" 
                  ? "Hola! 每天坚持复习，西班牙语更上一层楼！" 
                  : "Hola! Stick to your daily review and improve your Spanish!",
              });
            } catch (err) {
              console.error("Web Notification Error:", err);
            }
          }

          // Trigger In-app Popup Modal
          setInAppReminderActive(true);
        }
      }
    };

    // Check immediately and then every 15 seconds
    checkReminder();
    const intervalId = setInterval(checkReminder, 15000);

    return () => clearInterval(intervalId);
  }, [settings.reminderEnabled, settings.reminderTime, settings.language]);

  // --- NAVIGATION STATE ---
  const [currentPage, setCurrentPage] = useState<"home" | "personal-center">("home");
  const [personalTab, setPersonalTab] = useState<"dictionary" | "input" | "rules" | "statistics">(
    "dictionary"
  );

  // --- REVIEWING STATE ENGINE ---
  const [todayQueue, setTodayQueue] = useState<Word[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState<number>(0);
  const [isTranslationVisible, setIsTranslationVisible] = useState<boolean>(false);
  const [sessionFinished, setSessionFinished] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // --- DICTIONARY STATE (Sorting & Searching) ---
  const [dictSearch, setDictSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<"time" | "level">("time");
  const [sortDescending, setSortDescending] = useState<boolean>(true);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);

  // --- WORD INPUT FORM STATE ---
  const [inputWord, setInputWord] = useState<string>("");
  const [inputTranslationZh, setInputTranslationZh] = useState<string>("");
  const [inputTranslationEn, setInputTranslationEn] = useState<string>("");
  const [inputExampleSentence, setInputExampleSentence] = useState<string>("");
  const [inputExampleTranslation, setInputExampleTranslation] = useState<string>("");
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [lastSavedWord, setLastSavedWord] = useState<Word | null>(null);
  const [isUndoing, setIsUndoing] = useState<boolean>(false);
  const [sessionVotedUnfamiliarIds, setSessionVotedUnfamiliarIds] = useState<string[]>([]);
  const [isAutoAdvancing, setIsAutoAdvancing] = useState<boolean>(false);
  const [advanceSecondsLeft, setAdvanceSecondsLeft] = useState<number>(4);
  const [autoAdvanceTimerId, setAutoAdvanceTimerId] = useState<any>(null);
  const [pendingNextAction, setPendingNextAction] = useState<any>(null);

  // --- IMPORT & AI TEXT RECOGNITION STATE ---
  const [aiPasteText, setAiPasteText] = useState<string>("");
  const [isAiParsing, setIsAiParsing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- MULTILINGUAL DICTIONARY KEYWORDS ---
  const t = {
    zh: {
      appName: "¡Hola! 西班牙语单词本",
      homeBtn: "复习单词",
      statsBtn: "学习统计",
      rulesBtn: "复习规则",
      dictBtn: "总词库",
      inputBtn: "自主录入",
      backToHome: "返回主页",
      totalDays: "累计学习",
      totalWords: "累计掌握",
      noWords: "您的单词库是空的，点击下方按钮导入默认单词或去录入！",
      loadDefaults: "加载默认单词",
      addBtn: "添加单词",
      settingsBtn: "复习设置",
      next: "下一个",
      revealTip: "点击卡片或按 [空格键] 显示翻译",
      learnSuccess: "今日单词学习完毕！太棒了！🎉",
      learnAgain: "再学一组",
      resetQueue: "重新生成今日复习队列",
      notLearned: "不会",
      learned: "会了",
      notLearnedShortcut: "[←] 键",
      learnedShortcut: "[→] 键",
      progress: "今日学习进度",
      deleteConfirm: "确定要删除该单词吗？",
      wordEmptyError: "请输入有效的西班牙语单词和翻译！",
      wordSaved: "单词已成功保存到词库中！",
      editing: "编辑单词",
      newEntry: "录入新单词",
      spanishLabel: "西班牙语单词 / 动词短语",
      chineseLabel: "中文翻译",
      englishLabel: "英文翻译",
      confirmSave: "确定保存",
      cancel: "取消",
      aiSection: "Gemini AI 智能文本识别录入",
      aiPlaceholder: "将您从PDF、网页或文章中复制的内容（包含西班牙语和翻译）直接粘贴在此处。Gemini AI 会自动为您分析并导入单词卡！",
      aiParseBtn: "Gemini 智能识别并导入",
      aiSuccess: "Gemini 成功提取并导入了 {count} 个单词卡！",
      uploadFile: "或者，上传外部字典文件 ( 支持 CSV, JSON, TXT )",
      dragTip: "点击上传或拖拽文件到此处",
      rulesTitle: "复习单词原则",
      rulesTime: "时间优先",
      rulesLevel: "熟悉度优先",
      frequencyTitle: "复习频率",
      dailyLimit: "每日复习单词上限",
      recurrenceTitle: "掌握后的单词出现规则",
      recurrenceNever: "“会了”的单词不再出现",
      recurrence7days: "“会了”的单词 7 天后再出现",
      recurrenceAlways: "“会了”的单词仍然出现",
      levelFamiliar: "熟练",
      levelBlur: "模糊",
      levelUnfamiliar: "不熟悉",
      levelAll: "全部级别",
      searchWord: "搜索单词...",
      sortingTime: "时间排序",
      sortingLevel: "熟悉度排序",
      timeAsc: "最早录入",
      timeDesc: "最新录入",
      levelAsc: "不熟悉优先",
      levelDesc: "已掌握优先",
      doubleClickTip: "💡 双击任何单词可以重新编辑它",
    },
    en: {
      appName: "¡Hola! Spanish Flashcards",
      homeBtn: "Study Words",
      statsBtn: "Statistics",
      rulesBtn: "Review Rules",
      dictBtn: "Dictionary",
      inputBtn: "Manual Input",
      backToHome: "Return Home",
      totalDays: "Total Days",
      totalWords: "Total Mastered",
      noWords: "Your word bank is empty. Click below to load defaults or add words!",
      loadDefaults: "Load Default Words",
      addBtn: "Add Word",
      settingsBtn: "Settings",
      next: "Next",
      revealTip: "Click card or press [Space] to reveal translation",
      learnSuccess: "All words for today are learned! Great job! 🎉",
      learnAgain: "Review Another Set",
      resetQueue: "Regenerate Today's Queue",
      notLearned: "Won't",
      learned: "Will/Learned",
      notLearnedShortcut: "[←] Arrow",
      learnedShortcut: "[→] Arrow",
      progress: "Today's Progress",
      deleteConfirm: "Are you sure you want to delete this word?",
      wordEmptyError: "Please enter a valid Spanish word and translations!",
      wordSaved: "Word successfully saved to dictionary!",
      editing: "Edit Word",
      newEntry: "Input New Word",
      spanishLabel: "Spanish Word / Phrase",
      chineseLabel: "Chinese Translation",
      englishLabel: "English Translation",
      confirmSave: "Save Word",
      cancel: "Cancel",
      aiSection: "Gemini AI Text Recognition & Import",
      aiPlaceholder: "Paste any raw text copied from PDFs, websites, or notes containing Spanish words and translations. Gemini AI will analyze and import them automatically!",
      aiParseBtn: "Smart Parse & Import with Gemini",
      aiSuccess: "Gemini successfully extracted and imported {count} cards!",
      uploadFile: "Or, upload a dictionary file (CSV, JSON, TXT)",
      dragTip: "Click or drag files here to upload",
      rulesTitle: "Word Priority Selection Rule",
      rulesTime: "Time Priority (Latest input first)",
      rulesLevel: "Familiarity Priority (Unfamiliar first)",
      frequencyTitle: "Review Frequency Settings",
      dailyLimit: "Daily Max Review Limit",
      recurrenceTitle: "Recurrence rule for mastered words",
      recurrenceNever: "Mastered words never appear again",
      recurrence7days: "Mastered words reappear after 7 days",
      recurrenceAlways: "Familiar words always continue to repeat",
      levelFamiliar: "Familiar",
      levelBlur: "Blur (Neutral)",
      levelUnfamiliar: "Unfamiliar",
      levelAll: "All Levels",
      searchWord: "Search words...",
      sortingTime: "Sort by Time",
      sortingLevel: "Sort by Familiarity",
      timeAsc: "Oldest First",
      timeDesc: "Latest First",
      levelAsc: "Unfamiliar First",
      levelDesc: "Mastered First",
      doubleClickTip: "💡 Double-click any word row to edit it",
    },
  }[settings.language];

  // Helper to show temporary feedback
  const triggerFeedback = (text: string, type: "success" | "error" | "info" = "success") => {
    setFeedbackMessage({ text, type });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4500);
  };

  // --- CORE QUEUE SELECTION ALGORITHM ---
  // Calculates which words should be reviewed today based on user rules
  const generateTodayQueue = (currentWordsList: Word[] = words, reviewedIdsOverride?: string[]) => {
    if (currentWordsList.length === 0) {
      setTodayQueue([]);
      return;
    }

    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const activeReviewedIds = reviewedIdsOverride !== undefined ? reviewedIdsOverride : reviewedTodayIds;

    // Filter words eligible for review today
    const eligibleWords = currentWordsList.filter((word) => {
      // Exclude words already reviewed today, "即使未掌握也不复现"
      if (activeReviewedIds.includes(word.id)) {
        return false;
      }

      if (word.level === "familiar") {
        if (settings.recurrenceRule === "never") {
          return false; // Never show "会了" words again
        }
        if (settings.recurrenceRule === "7days") {
          // Only show "会了" words if it's been at least 7 days
          if (!word.lastReviewedTime) return true;
          return now - word.lastReviewedTime >= SEVEN_DAYS;
        }
        if (settings.recurrenceRule === "always") {
          return true; // Familiar words always continue to repeat
        }
      }
      return true; // Unfamiliar, Blur or new words are always eligible
    });

    if (eligibleWords.length === 0) {
      setTodayQueue([]);
      setSessionFinished(true);
      return;
    }

    let selectedWords: Word[] = [];

    // Helper to shuffle items randomly
    const shuffle = (array: Word[]) => [...array].sort(() => Math.random() - 0.5);

    // Rule 1: Latest Input Time prioritized
    if (settings.priorityRule === "time") {
      // Sort primarily by input time descending (latest first)
      const sortedByTime = [...eligibleWords].sort((a, b) => b.inputTime - a.inputTime);
      
      // Check if we need to apply random selection for the latest input batch
      // Let's find the words added in the most recent timestamp batch (within 10 seconds of the max timestamp)
      const maxTime = sortedByTime[0]?.inputTime || 0;
      const latestBatch = sortedByTime.filter((w) => Math.abs(w.inputTime - maxTime) < 10000);

      if (latestBatch.length > settings.dailyReviewLimit) {
        // If the latest input batch alone exceeds the limit, choose randomly from this batch
        const shuffledBatch = [...latestBatch].sort(() => Math.random() - 0.5);
        selectedWords = shuffledBatch.slice(0, settings.dailyReviewLimit);
      } else {
        // Otherwise, take the latest batch and fill up remaining slots with the next most recent
        selectedWords = sortedByTime.slice(0, settings.dailyReviewLimit);
      }
    } 
    // Rule 2: Unfamiliar words priority
    else {
      // Prioritize: unfamiliar -> blur -> familiar (which has the lowest priority)
      // Shuffle within each group so subsequent sets feature randomized selections but respect level grouping
      const unfamiliarGroup = shuffle(eligibleWords.filter((w) => w.level === "unfamiliar"));
      const blurGroup = shuffle(eligibleWords.filter((w) => w.level === "blur"));
      const familiarGroup = shuffle(eligibleWords.filter((w) => w.level === "familiar"));

      const sortedEligible = [
        ...unfamiliarGroup,
        ...blurGroup,
        ...familiarGroup,
      ];

      selectedWords = sortedEligible.slice(0, settings.dailyReviewLimit);
    }

    setTodayQueue(selectedWords);
    setCurrentQueueIndex(0);
    setIsTranslationVisible(false);
    setSessionFinished(false);
    setSessionVotedUnfamiliarIds([]);
  };

  // Re-generate queue if settings, words or reviewedTodayIds change
  useEffect(() => {
    if (words.length > 0 && todayQueue.length === 0 && !sessionFinished) {
      generateTodayQueue(words);
    }
  }, [words, settings.dailyReviewLimit, settings.recurrenceRule, settings.priorityRule, reviewedTodayIds]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerId) {
        clearInterval(autoAdvanceTimerId);
      }
    };
  }, [autoAdvanceTimerId]);

  const skipAutoAdvance = () => {
    if (autoAdvanceTimerId) {
      clearInterval(autoAdvanceTimerId);
      setAutoAdvanceTimerId(null);
    }
    setIsAutoAdvancing(false);
    setIsTranslationVisible(false);
    
    // Perform the transition immediately
    if (pendingNextAction) {
      pendingNextAction();
      setPendingNextAction(null);
    }
  };

  // --- SHORTCUT KEYS LISTENER ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in form inputs
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (currentPage === "home" && todayQueue.length > 0 && !sessionFinished) {
        if (isAutoAdvancing) {
          if (e.code === "Space" || e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Enter") {
            e.preventDefault();
            skipAutoAdvance();
          }
          return;
        }

        if (e.code === "Space") {
          e.preventDefault();
          setIsTranslationVisible((prev) => !prev);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          handleVote(false); // "不会"
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          handleVote(true); // "会了"
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentPage, todayQueue, currentQueueIndex, isTranslationVisible, sessionFinished, isAutoAdvancing, autoAdvanceTimerId, pendingNextAction]);

  // --- VOTE ACTIONS ENGINE ("不会" / "会了") ---
  const handleVote = (mastered: boolean) => {
    if (todayQueue.length === 0 || currentQueueIndex >= todayQueue.length) return;

    const currentCard = todayQueue[currentQueueIndex];
    const todayStr = getTodayDateString();
    const now = Date.now();

    // Check if this card was already voted "不会" in the current session
    const isReappearance = sessionVotedUnfamiliarIds.includes(currentCard.id);

    // 1. Update card level and stats in local words state
    const updatedWords = words.map((w) => {
      if (w.id === currentCard.id) {
        let newLevel: WordLevel = w.level;
        if (mastered) {
          if (isReappearance) {
            // "1）第二次每日复习词汇出现完毕后复现时再点击会，则为模糊"
            newLevel = "blur";
          } else {
            // "直到下一次复习第一次就点击“会了” [才恢复为熟练]"
            newLevel = "familiar";
          }
        } else {
          // "2）如果复现时仍为不会，则为不会"
          newLevel = "unfamiliar";
        }

        return {
          ...w,
          level: newLevel,
          reviewCount: w.reviewCount + 1,
          lastReviewedTime: now,
          isNew: false,
        };
      }
      return w;
    });

    saveWordsToStorage(updatedWords);

    // 2. Update Study History Logs
    const updatedLogs = [...historyLogs];
    let logIndex = updatedLogs.findIndex((log) => log.date === todayStr);
    
    if (logIndex === -1) {
      updatedLogs.push({
        date: todayStr,
        masteredCount: mastered ? 1 : 0,
        reviewedCount: 1,
      });
    } else {
      updatedLogs[logIndex] = {
        ...updatedLogs[logIndex],
        reviewedCount: updatedLogs[logIndex].reviewedCount + 1,
        masteredCount: mastered
          ? updatedLogs[logIndex].masteredCount + 1
          : updatedLogs[logIndex].masteredCount,
      };
    }
    saveHistoryToStorage(updatedLogs);

    // 3. Handle queue progression
    // Mark this word as reviewed today so it won't appear in subsequent sessions today ("即使未掌握也不复现")
    if (!reviewedTodayIds.includes(currentCard.id)) {
      const updatedReviewedIds = [...reviewedTodayIds, currentCard.id];
      saveReviewedTodayIds(updatedReviewedIds);
    }

    if (!mastered) {
      if (!isReappearance) {
        // If marked "不会" for the first time in this session, it MUST reappear at the end of the session
        const reAddCard = { ...currentCard, level: "unfamiliar" as WordLevel };
        setTodayQueue((prevQueue) => [...prevQueue, reAddCard]);
        
        // Record that this card was voted "不会" in the current session
        setSessionVotedUnfamiliarIds((prev) => [...prev, currentCard.id]);

        triggerFeedback(
          settings.language === "zh" ? "已记录。将在本轮末尾重新出现进行巩固复现！" : "Word logged. It will reappear at the end of this session to reinforce learning!",
          "info"
        );
      } else {
        // If they click "不会" again on the second appearance, do not append it again (only 2 appearances max)
        triggerFeedback(
          settings.language === "zh" ? "已记录。此词今天不再复现，改日再加油！" : "Logged. This word won't reappear again today. Try again tomorrow!",
          "info"
        );
      }
    } else {
      if (isReappearance) {
        triggerFeedback(
          settings.language === "zh" ? "不错！复现巩固已成功，此卡标记为：模糊 💫" : "Good recovery! Card is marked as Neutral/Blur 💫",
          "success"
        );
      } else {
        triggerFeedback(
          settings.language === "zh" ? "做得好！已直接标记为熟练掌握 👏" : "Great job! Marked as familiar 👏",
          "success"
        );
      }
    }

    // Set translation to visible to make sure they can see the translation before moving
    setIsTranslationVisible(true);

    const isLastWord = currentQueueIndex + 1 >= todayQueue.length;

    if (isLastWord) {
      // Last word of the session: show translation, do not start automatic countdown
      setIsAutoAdvancing(true);
      setAdvanceSecondsLeft(0);

      if (autoAdvanceTimerId) {
        clearInterval(autoAdvanceTimerId);
        setAutoAdvanceTimerId(null);
      }

      const nextAction = () => {
        setIsAutoAdvancing(false);
        setIsTranslationVisible(false);
        setSessionFinished(true);
      };
      setPendingNextAction(() => nextAction);
    } else {
      // Standard card: automatically advance after 4 seconds
      setIsAutoAdvancing(true);
      setAdvanceSecondsLeft(4);

      if (autoAdvanceTimerId) {
        clearInterval(autoAdvanceTimerId);
      }

      const nextAction = () => {
        setIsAutoAdvancing(false);
        setIsTranslationVisible(false);
        if (currentQueueIndex + 1 < todayQueue.length) {
          setCurrentQueueIndex((prev) => prev + 1);
        } else {
          setSessionFinished(true);
        }
      };
      setPendingNextAction(() => nextAction);

      let secs = 4;
      const intervalId = setInterval(() => {
        secs -= 1;
        setAdvanceSecondsLeft(secs);
        if (secs <= 0) {
          clearInterval(intervalId);
          setAutoAdvanceTimerId(null);
          nextAction();
        }
      }, 1000);
      setAutoAdvanceTimerId(intervalId);
    }
  };

  // --- EXPORT FUNCTIONALITY ---
  const handleExportWords = (format: "markdown" | "csv") => {
    if (words.length === 0) {
      triggerFeedback(
        settings.language === "zh" ? "当前词库为空，无法导出" : "Dictionary is empty, nothing to export",
        "error"
      );
      return;
    }

    let fileContent = "";
    let fileExtension = "";
    let mimeType = "";

    if (format === "csv") {
      fileExtension = "csv";
      mimeType = "text/csv;charset=utf-8;";
      
      // UTF-8 BOM to make sure Excel opens it correctly with Chinese/Spanish characters
      fileContent = "\uFEFF";
      
      const headers = ["单词", "中文翻译", "英文翻译", "例句", "例句翻译"];
      fileContent += headers.join(",") + "\n";

      words.forEach((w) => {
        const escapeCsv = (str: string = "") => {
          let cleaned = str.replace(/"/g, '""');
          if (cleaned.includes(",") || cleaned.includes("\n") || cleaned.includes('"')) {
            cleaned = `"${cleaned}"`;
          }
          return cleaned;
        };

        const row = [
          escapeCsv(w.word),
          escapeCsv(w.translationZh),
          escapeCsv(w.translationEn),
          escapeCsv(w.exampleSentence || ""),
          escapeCsv(w.exampleTranslation || "")
        ];
        fileContent += row.join(",") + "\n";
      });
    } else {
      fileExtension = "md";
      mimeType = "text/markdown;charset=utf-8;";

      fileContent = `# Es-ES Spanish Word Bank (共 ${words.length} 个单词)\n\n`;
      fileContent += `| 单词 (Word) | 中文翻译 (Chinese) | 英文翻译 (English) | 例句 (Example) | 例句翻译 (Translation) |\n`;
      fileContent += `| :--- | :--- | :--- | :--- | :--- |\n`;

      words.forEach((w) => {
        const cleanMd = (str: string = "") => {
          return str.replace(/\|/g, "\\|").replace(/\n/g, " ");
        };
        fileContent += `| **${cleanMd(w.word)}** | ${cleanMd(w.translationZh)} | *${cleanMd(w.translationEn)}* | ${cleanMd(w.exampleSentence || "-")} | ${cleanMd(w.exampleTranslation || "-")} |\n`;
      });
    }

    // Trigger file download in browser
    try {
      const blob = new Blob([fileContent], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `hola_spanish_words_${getTodayDateString()}.${fileExtension}`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      triggerFeedback(
        settings.language === "zh" ? "词库导出成功！" : "Dictionary exported successfully!",
        "success"
      );
    } catch (err) {
      console.error(err);
      triggerFeedback(
        settings.language === "zh" ? "导出失败，请重试" : "Export failed, please try again",
        "error"
      );
    }
  };

  // --- MANUAL INPUT CRUD ---
  const handleSaveWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputWord.trim() || !inputTranslationZh.trim() || !inputTranslationEn.trim()) {
      triggerFeedback(t.wordEmptyError, "error");
      return;
    }

    // Check for duplicate word recording
    const normalizedInputWord = inputWord.trim().toLowerCase();
    const isDuplicate = words.some((w) => w.word === normalizedInputWord && w.id !== editingWordId);
    if (isDuplicate) {
      triggerFeedback(
        settings.language === "zh" ? "你已录入过该单词" : "You have already entered this word",
        "error"
      );
      return;
    }

    const nowTimestamp = Date.now();
    let savedObj: Word;

    if (editingWordId) {
      // Update existing
      let matchedObj: Word | null = null;
      const updated = words.map((w) => {
        if (w.id === editingWordId) {
          matchedObj = {
            ...w,
            word: inputWord.trim().toLowerCase(),
            translationZh: inputTranslationZh.trim(),
            translationEn: inputTranslationEn.trim(),
            exampleSentence: inputExampleSentence.trim() || undefined,
            exampleTranslation: inputExampleTranslation.trim() || undefined,
          };
          return matchedObj;
        }
        return w;
      });
      saveWordsToStorage(updated);
      savedObj = matchedObj || {
        id: editingWordId,
        word: inputWord.trim().toLowerCase(),
        translationZh: inputTranslationZh.trim(),
        translationEn: inputTranslationEn.trim(),
        exampleSentence: inputExampleSentence.trim() || undefined,
        exampleTranslation: inputExampleTranslation.trim() || undefined,
        level: "unfamiliar",
        inputTime: nowTimestamp,
        lastReviewedTime: null,
        reviewCount: 0,
        isNew: true,
      };
      triggerFeedback(settings.language === "zh" ? "单词卡编辑保存成功！" : "Word card updated successfully!", "success");
      setEditingWordId(null);
    } else {
      // Insert new
      savedObj = {
        id: "word-" + Math.random().toString(36).substring(2, 9),
        word: inputWord.trim().toLowerCase(),
        translationZh: inputTranslationZh.trim(),
        translationEn: inputTranslationEn.trim(),
        exampleSentence: inputExampleSentence.trim() || undefined,
        exampleTranslation: inputExampleTranslation.trim() || undefined,
        level: "unfamiliar",
        inputTime: nowTimestamp,
        lastReviewedTime: null,
        reviewCount: 0,
        isNew: true,
      };
      saveWordsToStorage([savedObj, ...words]);
      triggerFeedback(t.wordSaved, "success");
    }

    // Record the saved word so we can undo / recall it later
    setLastSavedWord(savedObj);
    setIsUndoing(false);

    // Reset inputs & refresh queue
    setInputWord("");
    setInputTranslationZh("");
    setInputTranslationEn("");
    setInputExampleSentence("");
    setInputExampleTranslation("");
  };

  const handleDeleteWord = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(t.deleteConfirm)) {
      const filtered = words.filter((w) => w.id !== id);
      saveWordsToStorage(filtered);
      triggerFeedback(settings.language === "zh" ? "单词已从词库中删除" : "Word deleted from dictionary", "info");
      
      // Remove from current queue if present to avoid indexing errors
      setTodayQueue((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const handleStartEditWord = (wordObj: Word) => {
    setEditingWordId(wordObj.id);
    setInputWord(wordObj.word);
    setInputTranslationZh(wordObj.translationZh);
    setInputTranslationEn(wordObj.translationEn);
    setInputExampleSentence(wordObj.exampleSentence || "");
    setInputExampleTranslation(wordObj.exampleTranslation || "");
    setIsUndoing(false);
    setPersonalTab("input"); // Switch to input view
  };

  // --- GEMINI AI SMART TEXT RECOGNITION AND PARSING ---
  const handleGeminiParse = async () => {
    if (!aiPasteText.trim()) {
      triggerFeedback(settings.language === "zh" ? "请先粘贴带有单词释义的文本！" : "Please paste some text first!", "error");
      return;
    }

    setIsAiParsing(true);
    triggerFeedback(settings.language === "zh" ? "Gemini 正在帮您分析文本，请稍候..." : "Gemini is analyzing text, please wait...", "info");

    try {
      const response = await fetch("/api/gemini/parse-words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiPasteText }),
      });

      const data = await response.json();
      if (data.success && data.cards && data.cards.length > 0) {
        const nowTimestamp = Date.now();
        const newCards: Word[] = data.cards.map((card: any, idx: number) => ({
          id: "word-gemini-" + Math.random().toString(36).substring(2, 9) + "-" + idx,
          word: card.word.trim().toLowerCase(),
          translationZh: card.translationZh.trim(),
          translationEn: card.translationEn.trim(),
          level: "unfamiliar" as WordLevel,
          inputTime: nowTimestamp,
          lastReviewedTime: null,
          reviewCount: 0,
          isNew: true,
        }));

        const mergedWords = [...newCards, ...words];
        saveWordsToStorage(mergedWords);
        
        // Notify of fallback if Gemini was mock-parsed
        if (data.fallback) {
          triggerFeedback(data.warning, "info");
        } else {
          triggerFeedback(
            t.aiSuccess.replace("{count}", data.cards.length.toString()),
            "success"
          );
        }

        setAiPasteText(""); // Clear parser text
        generateTodayQueue(mergedWords); // Automatically update today's review candidates
      } else {
        triggerFeedback(settings.language === "zh" ? "未能提取到有效的西班牙语单词，请检查文本格式" : "No valid words extracted, please verify text format", "error");
      }
    } catch (err) {
      console.error(err);
      triggerFeedback(settings.language === "zh" ? "调用智能接口失败，请检查网络或重试" : "AI parsing failed, please try again", "error");
    } finally {
      setIsAiParsing(false);
    }
  };

  // --- FILE IMPORT (JSON / CSV / TXT) ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        let importedCards: Array<{ word: string; translationZh: string; translationEn: string }> = [];

        if (file.name.endsWith(".json")) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            importedCards = parsed;
          } else if (parsed.words && Array.isArray(parsed.words)) {
            importedCards = parsed.words;
          }
        } else if (file.name.endsWith(".csv")) {
          const rows = text.split("\n");
          for (const row of rows) {
            const cols = row.split(/,|，/);
            if (cols.length >= 2) {
              importedCards.push({
                word: cols[0]?.trim() || "",
                translationZh: cols[1]?.trim() || "",
                translationEn: cols[2]?.trim() || cols[1]?.trim() || "",
              });
            }
          }
        } else {
          // Normal TXT tab-separated or line-separated fallback
          const lines = text.split("\n");
          for (const line of lines) {
            const parts = line.split(/\t|\s{2,}/);
            if (parts.length >= 2) {
              importedCards.push({
                word: parts[0]?.trim() || "",
                translationZh: parts[1]?.trim() || "",
                translationEn: parts[2]?.trim() || parts[1]?.trim() || "",
              });
            }
          }
        }

        if (importedCards.length === 0) {
          triggerFeedback(settings.language === "zh" ? "未发现匹配的导入单词数据" : "No matching word data found", "error");
          return;
        }

        const nowTimestamp = Date.now();
        const validImported: Word[] = importedCards
          .filter((c) => c.word && c.word.trim())
          .map((c, idx) => ({
            id: "word-import-" + Math.random().toString(36).substring(2, 9) + "-" + idx,
            word: c.word.trim().toLowerCase(),
            translationZh: c.translationZh || "（暂无）",
            translationEn: c.translationEn || "（None）",
            level: "unfamiliar",
            inputTime: nowTimestamp,
            lastReviewedTime: null,
            reviewCount: 0,
            isNew: true,
          }));

        const merged = [...validImported, ...words];
        saveWordsToStorage(merged);
        triggerFeedback(
          settings.language === "zh" ? `成功导入了 ${validImported.length} 个单词卡！` : `Successfully imported ${validImported.length} cards!`,
          "success"
        );
        generateTodayQueue(merged);
      } catch (err) {
        console.error(err);
        triggerFeedback(settings.language === "zh" ? "解析文件失败，请确保文件格式正确" : "Parsing file failed, please check structure", "error");
      }
    };
    reader.readAsText(file);
  };

  // --- DICTIONARY LIST SEARCH & FILTER & SORT ---
  const filteredWords = useMemo(() => {
    let result = words.filter((w) => {
      const matchSearch =
        w.word.includes(dictSearch.toLowerCase()) ||
        w.translationZh.includes(dictSearch) ||
        w.translationEn.toLowerCase().includes(dictSearch.toLowerCase());
      return matchSearch;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "time") {
        // Time sorting based on input time
        return sortDescending ? b.inputTime - a.inputTime : a.inputTime - b.inputTime;
      } else {
        // Similarity/Familiarity sorting: 会(familiar) -> 模糊(blur) -> 不会(unfamiliar)
        const getWeight = (lvl: WordLevel) => {
          if (lvl === "familiar") return 3;
          if (lvl === "blur") return 2;
          return 1;
        };
        const weightA = getWeight(a.level);
        const weightB = getWeight(b.level);
        return sortDescending ? weightB - weightA : weightA - weightB;
      }
    });

    return result;
  }, [words, dictSearch, sortBy, sortDescending]);

  // Handle Sort Button Toggles
  const handleSortToggle = (type: "time" | "level") => {
    if (sortBy === type) {
      setSortDescending((prev) => !prev); // Toggle ASC/DESC
    } else {
      setSortBy(type);
      setSortDescending(true); // Default to Descending when clicking new sort type
    }
  };

  return (
    <div className="min-h-screen bg-natural-bg text-natural-text flex flex-col font-sans transition-colors duration-300">
      
      {/* GLOBAL NOTIFICATION BANNER */}
      {feedbackMessage && (
        <div
          className={`fixed top-4 left-1/2 z-50 flex items-center gap-2 py-3 px-5 rounded-lg shadow-lg border text-sm font-medium animate-fade-in-toast ${
            feedbackMessage.type === "success"
              ? "bg-[#E9F5E9] text-[#2D5A27] border-[#CDE6CD]"
              : feedbackMessage.type === "error"
              ? "bg-[#FFECEC] text-[#C53030] border-[#FCD3D3]"
              : "bg-natural-sidebar text-natural-text border-natural-border"
          }`}
        >
          {feedbackMessage.type === "success" && <Check className="w-4 h-4 text-[#2D5A27]" />}
          {feedbackMessage.type === "error" && <X className="w-4 h-4 text-[#C53030]" />}
          {feedbackMessage.type === "info" && <Sparkles className="w-4 h-4 text-natural-sage" />}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* GLOBAL HEADER BAR */}
      <header className="border-b border-natural-border bg-natural-white px-6 py-4 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-natural-accent text-white flex items-center justify-center font-display font-bold text-xl shadow-sm italic">
            Es
          </div>
          <span className="text-lg font-semibold tracking-tight font-display text-natural-sage">
            {t.appName}
          </span>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-3">
          {/* Language Switcher */}
          <button
            id="lang-toggle-btn"
            onClick={() =>
              saveSettingsToStorage({
                ...settings,
                language: settings.language === "zh" ? "en" : "zh",
              })
            }
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-natural-muted bg-natural-sidebar hover:text-natural-text hover:bg-natural-active border border-natural-border rounded-lg transition-all"
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{settings.language === "zh" ? "English" : "中文"}</span>
          </button>
        </div>
      </header>

      {/* MAIN SCREEN ROUTER */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
        
        {/* PAGE 1: HOMEPAGE (STUDYING FLASHCARDS) */}
        {currentPage === "home" && (
          <div className="w-full max-w-2xl flex flex-col justify-between items-center min-h-[600px] py-6 relative">
            
            {/* NO WORDS STATE */}
            {words.length === 0 ? (
              <div className="bg-natural-white border border-natural-border p-8 rounded-2xl text-center shadow-sm max-w-md my-auto space-y-5">
                <HelpCircle className="w-12 h-12 text-natural-accent mx-auto" />
                <p className="text-natural-muted text-sm leading-relaxed">
                  {t.noWords}
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      saveWordsToStorage(defaultWords);
                      generateTodayQueue(defaultWords);
                      triggerFeedback(settings.language === "zh" ? "成功加载默认单词库！" : "Default words loaded!");
                    }}
                    className="w-full py-2.5 px-4 bg-natural-sage hover:bg-natural-sage-hover text-white text-sm font-semibold rounded-xl shadow transition-all flex items-center justify-center gap-1.5"
                  >
                    <BookOpen className="w-4 h-4" />
                    {t.loadDefaults}
                  </button>
                  <button
                    onClick={() => {
                      setCurrentPage("personal-center");
                      setPersonalTab("input");
                    }}
                    className="w-full py-2.5 px-4 bg-natural-sidebar hover:bg-natural-active text-natural-text border border-natural-border text-sm font-semibold rounded-xl transition-all"
                  >
                    {t.inputBtn}
                  </button>
                </div>
              </div>
            ) : sessionFinished || todayQueue.length === 0 ? (
              
              /* FINISHED TODAY SESSION STATE */
              <div className="bg-natural-white border border-natural-border p-12 rounded-3xl text-center shadow-md max-w-xl my-auto space-y-6 flex flex-col items-center w-full aspect-auto md:aspect-[16/10] justify-center">
                <div className="w-20 h-20 rounded-full bg-[#E9F5E9] text-[#2D5A27] flex items-center justify-center text-4xl shadow-inner animate-pulse mb-2">
                  🎉
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-natural-text mb-2">
                    {t.learnSuccess}
                  </h3>
                  <p className="text-sm text-natural-muted">
                    {settings.language === "zh"
                      ? `今日复习上限: ${settings.dailyReviewLimit} 词。当前词库总容量: ${words.length} 词。`
                      : `Daily limit: ${settings.dailyReviewLimit} words. Dict capacity: ${words.length} words.`}
                  </p>
                </div>
                <div className="w-full pt-2 flex flex-col gap-3 max-w-xs">
                  <button
                    id="btn-review-again"
                    onClick={() => generateTodayQueue(words)}
                    className="w-full py-3 px-5 bg-natural-sage hover:bg-natural-sage-hover text-white text-sm font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01] active:scale-95"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {t.learnAgain}
                  </button>
                  <button
                    onClick={() => {
                      setCurrentPage("personal-center");
                      setPersonalTab("rules");
                    }}
                    className="w-full py-3 px-5 bg-natural-sidebar hover:bg-natural-active text-natural-text border border-natural-border text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.01] active:scale-95"
                  >
                    <Settings className="w-4 h-4 text-natural-muted" />
                    {t.settingsBtn}
                  </button>
                </div>
              </div>
            ) : (
              
              /* ACTIVE FLASHCARD GAMEPLAY SCREEN */
              <>
                {/* Center Flashcard Container */}
                <div
                  id="flashcard-container"
                  onClick={() => {
                    if (isAutoAdvancing) {
                      skipAutoAdvance();
                    } else {
                      setIsTranslationVisible((prev) => !prev);
                    }
                  }}
                  className="w-full max-w-2xl bg-natural-white border border-natural-border rounded-3xl shadow-md p-10 flex flex-col justify-between items-center cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:shadow-lg relative group select-none min-h-[380px] aspect-auto md:aspect-[16/10]"
                >
                  {/* Category Card Tag Badge */}
                  <div className="absolute top-4 left-4 flex gap-1.5 items-center">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-natural-sidebar py-1 px-2 rounded-md text-natural-muted">
                      es-ES
                    </span>
                    {todayQueue[currentQueueIndex].level === "unfamiliar" && (
                      <span className="text-[10px] font-bold bg-[#FFECEC] text-[#C53030] py-1 px-2 rounded-md border border-[#FCD3D3]">
                        {t.levelUnfamiliar}
                      </span>
                    )}
                    {todayQueue[currentQueueIndex].level === "blur" && (
                      <span className="text-[10px] font-bold bg-[#FFF4E6] text-[#A67C00] py-1 px-2 rounded-md border border-[#FFE3B3]">
                        {t.levelBlur}
                      </span>
                    )}
                  </div>

                  {/* Word Content Display */}
                  <div className="flex-1 flex flex-col items-center justify-center w-full mt-4">
                    {/* Big Spanish Word */}
                    <div className="flex items-center gap-3 justify-center">
                      <h1 className="text-4xl md:text-5xl font-bold text-natural-sage font-display text-center tracking-tight leading-tight select-text">
                        {todayQueue[currentQueueIndex].word}
                      </h1>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          speakSpanish(todayQueue[currentQueueIndex].word);
                        }}
                        className="p-2 rounded-full hover:bg-natural-sidebar text-natural-muted hover:text-natural-sage transition-all cursor-pointer active:scale-90 flex items-center justify-center border border-transparent hover:border-natural-border/40 shadow-sm"
                        title="Pronounce"
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Translations Section between the top word and bottom buttons */}
                    {isTranslationVisible ? (
                      <div className="mt-6 text-center w-full animate-fade-in select-text border-t border-natural-border pt-4">
                        <div className="grid grid-cols-2 gap-4">
                          {/* Chinese translation */}
                          <div className="border-r border-natural-border/60 pr-2 flex flex-col justify-center items-center">
                            <p className="text-[10px] uppercase tracking-wider text-natural-muted font-bold mb-1">中文翻译</p>
                            <p className="text-base md:text-lg font-bold text-natural-text font-sans leading-normal">
                              {todayQueue[currentQueueIndex].translationZh}
                            </p>
                          </div>
                          {/* English translation */}
                          <div className="pl-2 flex flex-col justify-center items-center">
                            <p className="text-[10px] uppercase tracking-wider text-natural-muted font-bold mb-1">English</p>
                            <p className="text-base md:text-lg font-bold text-natural-muted font-sans leading-normal">
                              {todayQueue[currentQueueIndex].translationEn}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 text-xs text-natural-muted font-medium flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <Eye className="w-3.5 h-3.5 text-natural-sage" />
                        {t.revealTip}
                      </p>
                    )}

                    {/* Optional Example Sentence */}
                    {settings.showExampleSentence !== false && todayQueue[currentQueueIndex].exampleSentence && (
                      <div className="mt-6 pt-4 border-t border-dashed border-natural-border/60 text-center w-full max-w-lg">
                        <p className="text-[10px] text-natural-muted font-medium mb-1.5">
                          {settings.language === "zh" ? "例句" : "Example"}
                        </p>
                        <div className="flex items-center justify-center gap-2.5">
                          <p className="text-sm md:text-base text-natural-text font-semibold leading-relaxed italic">
                            {renderSentenceWithHighlightedWord(
                              todayQueue[currentQueueIndex].exampleSentence!,
                              todayQueue[currentQueueIndex].word
                            )}
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              speakSpanish(todayQueue[currentQueueIndex].exampleSentence!);
                            }}
                            className="p-1.5 rounded-full hover:bg-natural-sidebar text-natural-muted hover:text-natural-sage transition-all cursor-pointer active:scale-90 flex items-center justify-center flex-shrink-0"
                            title="Pronounce Sentence"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        </div>
                        {/* Only show translation after revealing */}
                        {isTranslationVisible && todayQueue[currentQueueIndex].exampleTranslation && (
                          <p className="text-xs md:text-sm text-natural-muted font-medium mt-2 leading-normal animate-fade-in">
                            {todayQueue[currentQueueIndex].exampleTranslation}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Left/Right Buttons directly below card */}
                <div className="w-full max-w-2xl mt-6">
                  {isAutoAdvancing ? (
                    <button
                      id="btn-skip-advance"
                      onClick={skipAutoAdvance}
                      className="w-full py-4 px-6 rounded-2xl bg-natural-sage hover:bg-natural-sage-hover text-white text-base font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01] active:scale-95 animate-pulse"
                    >
                      {advanceSecondsLeft > 0 ? (
                        <>
                          <span>{settings.language === "zh" ? `下一个 (${advanceSecondsLeft}s 后自动切换)` : `Next (Auto-advance in ${advanceSecondsLeft}s)`}</span>
                          <ChevronRight className="w-5 h-5" />
                        </>
                      ) : (
                        <>
                          <span>{settings.language === "zh" ? "完成！" : "Finish!"}</span>
                          <Check className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {/* LEFT BUTTON: 不会 (Will Not) */}
                      <button
                        id="btn-not-learned"
                        onClick={() => handleVote(false)}
                        className="py-4 px-6 rounded-2xl bg-natural-sidebar hover:bg-[#FFECEC] border border-natural-border hover:border-[#FCD3D3] text-natural-text hover:text-[#C53030] text-sm font-bold shadow-sm transition-all flex flex-col items-center justify-center gap-1 active:scale-95 group cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5 text-base">
                          <X className="w-5 h-5 text-natural-muted group-hover:text-[#C53030] transition-colors" />
                          {t.notLearned}
                        </span>
                        <span className="text-[11px] text-natural-muted font-normal font-mono group-hover:text-[#C53030]/80">
                          {t.notLearnedShortcut}
                        </span>
                      </button>

                      {/* RIGHT BUTTON: 会了 (Have learned) */}
                      <button
                        id="btn-learned"
                        onClick={() => handleVote(true)}
                        className="py-4 px-6 rounded-2xl bg-natural-sage hover:bg-natural-sage-hover text-white text-sm font-bold shadow-sm transition-all flex flex-col items-center justify-center gap-1 active:scale-95 cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5 text-base">
                          <Check className="w-5 h-5" />
                          {t.learned}
                        </span>
                        <span className="text-[11px] text-natural-sidebar/80 font-normal font-mono">
                          {t.learnedShortcut}
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Bottom Middle Progress */}
                <div className="mt-8 flex flex-col items-center gap-2 w-full max-w-xs">
                  <span className="text-xs font-mono font-semibold text-natural-muted">
                    {t.progress}: {currentQueueIndex + 1} / {todayQueue.length}
                  </span>
                  <div className="w-full bg-natural-sidebar h-1.5 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${((currentQueueIndex + 1) / todayQueue.length) * 100}%`,
                      }}
                      className="bg-natural-sage h-full rounded-full transition-all duration-300"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Bottom Left Corner Settings Button */}
            <div className="absolute bottom-2 left-2">
              <button
                id="btn-goto-settings"
                onClick={() => {
                  setCurrentPage("personal-center");
                  setPersonalTab("dictionary");
                }}
                className="p-3.5 rounded-2xl bg-natural-white hover:bg-natural-sidebar border border-natural-border text-natural-muted hover:text-natural-text transition-all flex items-center justify-center shadow-md cursor-pointer hover:scale-[1.05] active:scale-95"
                title={t.settingsBtn}
              >
                <Settings className="w-6 h-6 text-natural-sage" />
              </button>
            </div>
          </div>
        )}

        {/* PAGE 2: PERSONAL CENTER (MANAGE & STATISTICS) */}
        {currentPage === "personal-center" && (
          <div className="w-full bg-natural-white border border-natural-border rounded-2xl shadow-sm flex flex-col md:flex-row min-h-[620px] overflow-hidden relative">
            
            {/* COLUMN 1: LEFT COLUMN (1/5 narrower sidebar) */}
            <aside className="w-full md:w-1/5 bg-natural-sidebar border-b md:border-b-0 md:border-r border-natural-border p-4 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="px-2">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-natural-accent mb-1">
                    Management
                  </p>
                  <p className="text-xs text-natural-muted font-medium">个人中心</p>
                </div>

                {/* Interactive Nav Tabs */}
                <nav className="space-y-1">
                  <button
                    id="sidebar-btn-dictionary"
                    onClick={() => setPersonalTab("dictionary")}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                      personalTab === "dictionary"
                        ? "bg-natural-active text-natural-text border border-natural-border shadow-sm"
                        : "text-natural-muted hover:bg-natural-active"
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>{t.dictBtn}</span>
                  </button>
                  <button
                    id="sidebar-btn-input"
                    onClick={() => {
                      setEditingWordId(null); // Reset edit state when manually clicking录入
                      setInputWord("");
                      setInputTranslationZh("");
                      setInputTranslationEn("");
                      setPersonalTab("input");
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                      personalTab === "input"
                        ? "bg-natural-active text-natural-text border border-natural-border shadow-sm"
                        : "text-natural-muted hover:bg-natural-active"
                    }`}
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{editingWordId ? t.editing : t.inputBtn}</span>
                  </button>
                  <button
                    id="sidebar-btn-rules"
                    onClick={() => setPersonalTab("rules")}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                      personalTab === "rules"
                        ? "bg-natural-active text-natural-text border border-natural-border shadow-sm"
                        : "text-natural-muted hover:bg-natural-active"
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    <span>{t.rulesBtn}</span>
                  </button>
                  <button
                    id="sidebar-btn-stats"
                    onClick={() => setPersonalTab("statistics")}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                      personalTab === "statistics"
                        ? "bg-natural-active text-natural-text border border-natural-border shadow-sm"
                        : "text-natural-muted hover:bg-natural-active"
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>{t.statsBtn}</span>
                  </button>
                </nav>
              </div>

              {/* Bottom Container: Return Home Button + Capacity Indicator */}
              <div className="mt-auto space-y-3 pt-2">
                {/* Return Home Button in Sidebar */}
                <div className="px-1">
                  <button
                    id="btn-return-home-sidebar"
                    onClick={() => {
                      setCurrentPage("home");
                      setIsTranslationVisible(false);
                    }}
                    className="w-full py-2.5 px-3 bg-natural-sage hover:bg-natural-sage-hover text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 transition-all cursor-pointer hover:shadow-sm"
                  >
                    <Home className="w-4 h-4" />
                    <span>{t.backToHome}</span>
                  </button>
                </div>

                {/* Sidebar bottom indicator */}
                <div className="hidden md:block p-2 border-t border-natural-border">
                  <div className="flex justify-between text-[10px] text-natural-muted font-mono">
                    <span>Capacity:</span>
                    <span className="font-bold text-natural-sage">{words.length} cards</span>
                  </div>
                </div>
              </div>
            </aside>

            {/* COLUMN 2: MAIN COLUMN (4/5 width content body) */}
            <section className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[620px]">
              
              {/* TAB 1: TOTAL DICTIONARY (总词库) */}
              {personalTab === "dictionary" && (
                <div className="space-y-6">
                  {/* Sorting & Search Controls Bar */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center border-b border-natural-border pb-4">
                    <h2 id="dictionary-title" className="text-xl font-bold font-display text-natural-text flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-natural-sage" />
                      {t.dictBtn}
                    </h2>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      {/* 1. Dedicated Sort Order Arrow Switcher (排序符号) */}
                      <button
                        id="dict-sort-direction-btn"
                        onClick={() => setSortDescending((prev) => !prev)}
                        className="px-3 py-1.5 font-medium rounded-lg bg-natural-white border border-natural-border hover:bg-natural-sidebar active:scale-95 transition-all flex items-center justify-center gap-0.5 cursor-pointer text-sm"
                        title={settings.language === "zh" ? "点击切换升序/降序" : "Click to toggle Ascending/Descending"}
                      >
                        <span className={sortDescending ? "text-natural-muted/30 font-normal" : "text-natural-sage font-extrabold"}>↑</span>
                        <span className={sortDescending ? "text-natural-sage font-extrabold" : "text-natural-muted/30 font-normal"}>↓</span>
                      </button>

                      {/* 2. Time Sorting Button (时间排序) */}
                      <button
                        id="dict-sort-time-btn"
                        onClick={() => setSortBy("time")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border flex items-center gap-1.5 cursor-pointer ${
                          sortBy === "time"
                            ? "bg-natural-active border-natural-border text-natural-text font-bold"
                            : "bg-natural-white border-natural-border text-natural-muted hover:bg-natural-sidebar"
                        }`}
                      >
                        {t.sortingTime}
                      </button>

                      {/* 3. Familiarity Sorting Button (熟悉度排序) */}
                      <button
                        id="dict-sort-similarity-btn"
                        onClick={() => setSortBy("level")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border flex items-center gap-1.5 cursor-pointer ${
                          sortBy === "level"
                            ? "bg-natural-active border-natural-border text-natural-text font-bold"
                            : "bg-natural-white border-natural-border text-natural-muted hover:bg-natural-sidebar"
                        }`}
                      >
                        {t.sortingLevel}
                      </button>

                      {/* 4. Export Button (导出符号，使用 Download 呈现，开口朝上、箭头向下) */}
                      <div className="relative">
                        <button
                          id="dict-export-btn"
                          onClick={() => setShowExportMenu((prev) => !prev)}
                          className="px-3 py-1.5 bg-natural-white border border-natural-border text-natural-muted hover:text-natural-sage hover:bg-natural-sidebar rounded-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                          title={settings.language === "zh" ? "导出词库数据" : "Export word list"}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        
                        {showExportMenu && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                            <div className="absolute right-0 mt-2 w-44 bg-natural-white border border-natural-border rounded-xl shadow-lg py-1.5 z-50 animate-fade-in">
                              <button
                                onClick={() => {
                                  handleExportWords("markdown");
                                  setShowExportMenu(false);
                                }}
                                className="w-full text-left px-3.5 py-2 text-xs font-semibold hover:bg-natural-sidebar text-natural-text flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5 text-natural-sage" />
                                <span>{settings.language === "zh" ? "导出 Markdown (.md)" : "Export Markdown (.md)"}</span>
                              </button>
                              <button
                                onClick={() => {
                                  handleExportWords("csv");
                                  setShowExportMenu(false);
                                }}
                                className="w-full text-left px-3.5 py-2 text-xs font-semibold hover:bg-natural-sidebar text-natural-text flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5 text-[#3b82f6]" />
                                <span>{settings.language === "zh" ? "导出 CSV (.csv)" : "Export CSV (.csv)"}</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Grouped Search, Tip, and List to reduce vertical gaps */}
                  <div className="space-y-2.5">
                    {/* Inline Search Bar */}
                    <div className="relative">
                      <input
                        id="dictionary-search-input"
                        type="text"
                        placeholder={t.searchWord}
                        value={dictSearch}
                        onChange={(e) => setDictSearch(e.target.value)}
                        className="w-full pl-4 pr-10 py-2.5 text-sm bg-natural-sidebar/50 border border-natural-border rounded-xl focus:outline-none focus:ring-2 focus:ring-natural-sage/20 focus:border-natural-sage"
                      />
                      <span className="absolute right-3.5 top-3 text-natural-muted text-xs"></span>
                    </div>

                    <p className="text-[11px] text-natural-muted font-medium px-1">
                      {t.doubleClickTip}
                    </p>

                    {/* Words List View Grid */}
                    <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 pt-1">
                      {filteredWords.length === 0 ? (
                        <p className="text-center py-12 text-sm text-natural-muted">
                          {settings.language === "zh" ? "没有找到符合条件的词条" : "No matching words found"}
                        </p>
                      ) : (
                        filteredWords.map((wordObj) => (
                          <div
                            key={wordObj.id}
                            onDoubleClick={() => handleStartEditWord(wordObj)}
                            className="flex items-center justify-between p-3.5 bg-natural-white border border-natural-border rounded-xl hover:border-natural-accent transition-all cursor-pointer group hover:bg-natural-sidebar/40 select-none"
                          >
                            {/* Word detail column */}
                            <div className="flex-1 pr-4">
                              <div className="flex items-center gap-2">
                                <span className="text-base font-bold text-natural-text font-display select-all">
                                  {wordObj.word}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    speakSpanish(wordObj.word);
                                  }}
                                  className="p-1 rounded-full hover:bg-natural-sidebar text-natural-muted hover:text-natural-sage transition-all cursor-pointer active:scale-90 inline-flex items-center justify-center"
                                  title="Pronounce Word"
                                >
                                  <Volume2 className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-[10px] font-mono text-natural-muted">
                                  {new Date(wordObj.inputTime).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-xs text-natural-muted mt-1 flex items-center gap-1 select-all">
                                <span className="font-medium text-natural-text">
                                  {wordObj.translationZh}
                                </span>
                                <span className="text-natural-border">|</span>
                                <span className="font-mono text-[11px] text-natural-muted">
                                  {wordObj.translationEn}
                                </span>
                              </p>
                              {wordObj.exampleSentence && (
                                <div className="flex items-center gap-1.5 mt-1.5">
                                  <p className="text-[11px] text-natural-muted italic font-sans leading-relaxed select-all">
                                    📖 {wordObj.exampleSentence}
                                    {wordObj.exampleTranslation && (
                                      <span className="text-natural-muted font-normal not-italic ml-1">
                                        ({wordObj.exampleTranslation})
                                      </span>
                                    )}
                                  </p>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      speakSpanish(wordObj.exampleSentence);
                                    }}
                                    className="p-1 rounded-full hover:bg-natural-sidebar text-natural-muted hover:text-natural-sage transition-all cursor-pointer active:scale-90 inline-flex items-center justify-center flex-shrink-0"
                                    title="Pronounce Sentence"
                                  >
                                    <Volume2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Level badge and action controls */}
                            <div className="flex items-center gap-3">
                              {wordObj.level === "familiar" && (
                                <span className="text-[10px] font-bold bg-[#E9F5E9] text-[#2D5A27] py-1 px-2.5 rounded-md border border-[#CDE6CD]">
                                  {t.levelFamiliar}
                                </span>
                              )}
                              {wordObj.level === "blur" && (
                                <span className="text-[10px] font-bold bg-[#FFF4E6] text-[#A67C00] py-1 px-2.5 rounded-md border border-[#FFE3B3]">
                                  {t.levelBlur}
                                </span>
                              )}
                              {wordObj.level === "unfamiliar" && (
                                <span className="text-[10px] font-bold bg-[#FFECEC] text-[#C53030] py-1 px-2.5 rounded-md border border-[#FCD3D3]">
                                  {t.levelUnfamiliar}
                                </span>
                              )}

                              {/* Delete trash can */}
                              <button
                                id={`btn-delete-${wordObj.id}`}
                                onClick={(e) => handleDeleteWord(wordObj.id, e)}
                                className="p-1.5 text-natural-muted hover:text-[#C53030] hover:bg-[#FFECEC] rounded-lg transition-colors"
                                title="Delete Word"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: MANUAL INPUT (录入) */}
              {personalTab === "input" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center border-b border-natural-border pb-4">
                    <h2 id="input-title" className="text-xl font-bold font-display text-natural-text flex items-center gap-2">
                      <PlusCircle className="w-5 h-5 text-natural-sage" />
                      {editingWordId ? t.editing : t.newEntry}
                    </h2>
                  </div>

                  {/* Word Input Form Layout */}
                  <form onSubmit={handleSaveWord} className="space-y-5 mt-4">
                    {/* 1. Spanish Word Field (加宽至整行) */}
                    <div className="flex flex-col gap-2">
                      <label id="lbl-spanish" className="text-xs font-bold text-natural-muted uppercase tracking-wider">
                        {t.spanishLabel}
                      </label>
                      <input
                        id="input-spanish-word"
                        type="text"
                        required
                        value={inputWord}
                        onChange={(e) => setInputWord(e.target.value)}
                        placeholder="e.g. hablar"
                        className="w-full py-3 px-4 text-base bg-natural-sidebar/50 border border-natural-border rounded-xl focus:outline-none focus:ring-1.5 focus:ring-natural-sage/20 focus:border-natural-sage text-natural-text font-medium"
                      />
                    </div>

                    {/* 2. Chinese and English Translation Fields side-by-side (并列) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="flex flex-col gap-2">
                        <label id="lbl-chinese" className="text-xs font-bold text-natural-muted uppercase tracking-wider">
                          {t.chineseLabel}
                        </label>
                        <input
                          id="input-chinese-translation"
                          type="text"
                          required
                          value={inputTranslationZh}
                          onChange={(e) => setInputTranslationZh(e.target.value)}
                          placeholder="e.g. 说话，谈话"
                          className="w-full py-3 px-4 text-sm bg-natural-sidebar/50 border border-natural-border rounded-xl focus:outline-none focus:ring-1.5 focus:ring-natural-sage/20 focus:border-natural-sage text-natural-text font-medium"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label id="lbl-english" className="text-xs font-bold text-natural-muted uppercase tracking-wider">
                          {t.englishLabel}
                        </label>
                        <input
                          id="input-english-translation"
                          type="text"
                          required
                          value={inputTranslationEn}
                          onChange={(e) => setInputTranslationEn(e.target.value)}
                          placeholder="e.g. to speak, to talk"
                          className="w-full py-3 px-4 text-sm bg-natural-sidebar/50 border border-natural-border rounded-xl focus:outline-none focus:ring-1.5 focus:ring-natural-sage/20 focus:border-natural-sage text-natural-text font-medium"
                        />
                      </div>
                    </div>

                    {/* 3. Example Sentence Input Field */}
                    <div className="flex flex-col gap-2">
                      <label id="lbl-example-sentence" className="text-xs font-bold text-natural-muted flex justify-between items-center uppercase tracking-wider">
                        <span>{settings.language === "zh" ? "例句 (选填)" : "Example Sentence (Optional)"}</span>
                        <span className="text-[10px] text-natural-accent font-normal italic normal-case lowercase tracking-normal">
                          {settings.language === "zh" ? "句子中的目标单词会自动加粗" : "Target word will be automatically bolded on flashcards"}
                        </span>
                      </label>
                      <textarea
                        id="input-example-sentence"
                        rows={2}
                        value={inputExampleSentence}
                        onChange={(e) => setInputExampleSentence(e.target.value)}
                        placeholder={
                          settings.language === "zh"
                            ? "例如：Ella prefiere hablar en español conmigo."
                            : "e.g. Ella prefiere hablar en español conmigo."
                        }
                        className="w-full py-3 px-4 text-sm bg-natural-sidebar/50 border border-natural-border rounded-xl focus:outline-none focus:ring-1.5 focus:ring-natural-sage/20 focus:border-natural-sage text-natural-text font-medium animate-none resize-none"
                      />
                    </div>

                    {/* 4. Example Sentence Translation Input Field */}
                    <div className="flex flex-col gap-2">
                      <label id="lbl-example-translation" className="text-xs font-bold text-natural-muted flex justify-between items-center uppercase tracking-wider">
                        <span>{settings.language === "zh" ? "例句翻译 (选填)" : "Example Sentence Translation (Optional)"}</span>
                      </label>
                      <textarea
                        id="input-example-translation"
                        rows={2}
                        value={inputExampleTranslation}
                        onChange={(e) => setInputExampleTranslation(e.target.value)}
                        placeholder={
                          settings.language === "zh"
                            ? "例如：她更喜欢和我用西班牙语交谈。"
                            : "e.g. She prefers to speak in Spanish with me."
                        }
                        className="w-full py-3 px-4 text-sm bg-natural-sidebar/50 border border-natural-border rounded-xl focus:outline-none focus:ring-1.5 focus:ring-natural-sage/20 focus:border-natural-sage text-natural-text font-medium animate-none resize-none"
                      />
                    </div>

                    {/* Centered Confirm/Recall/Cancel buttons */}
                    <div className="pt-5 mt-5 flex items-center justify-center gap-3 border-t border-natural-border">
                      <button
                        id="btn-confirm-save"
                        type="submit"
                        className="py-2 px-5 bg-natural-sage hover:bg-natural-sage-hover text-white text-sm font-semibold rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        {editingWordId
                          ? (settings.language === "zh" ? "保存修改" : "Save Changes")
                          : (settings.language === "zh" ? "保存单词" : "Save Word")}
                      </button>

                      {isUndoing ? (
                        <button
                          id="btn-reset-input"
                          type="button"
                          onClick={() => {
                            setInputWord("");
                            setInputTranslationZh("");
                            setInputTranslationEn("");
                            setInputExampleSentence("");
                            setInputExampleTranslation("");
                            setEditingWordId(null);
                            setIsUndoing(false);
                            triggerFeedback(
                              settings.language === "zh" ? "已清空当前输入文本" : "Inputs reset successfully!",
                              "info"
                            );
                          }}
                          className="py-2 px-5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-sm font-semibold rounded-xl transition-all cursor-pointer"
                        >
                          {settings.language === "zh" ? "重置" : "Reset"}
                        </button>
                      ) : lastSavedWord ? (
                        <button
                          id="btn-undo-last"
                          type="button"
                          onClick={() => {
                            // Load last saved word
                            setInputWord(lastSavedWord.word);
                            setInputTranslationZh(lastSavedWord.translationZh);
                            setInputTranslationEn(lastSavedWord.translationEn);
                            setInputExampleSentence(lastSavedWord.exampleSentence || "");
                            setInputExampleTranslation(lastSavedWord.exampleTranslation || "");
                            setEditingWordId(lastSavedWord.id);
                            setIsUndoing(true);
                            
                            // Remove the word from words array to simulate a recall/edit
                            const filtered = words.filter((w) => w.id !== lastSavedWord.id);
                            saveWordsToStorage(filtered);
                            setTodayQueue((prev) => prev.filter((item) => item.id !== lastSavedWord.id));

                            triggerFeedback(
                              settings.language === "zh"
                                        ? "已撤回上一个录入的单词，可直接在此修改！"
                                : "Recalled the last saved word. You can modify it now!",
                              "info"
                            );
                          }}
                          className="py-2 px-5 bg-[#FFF9E6] hover:bg-[#FFF2CC] text-[#B28200] border border-[#FFEBA6] text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          {settings.language === "zh" ? "撤回" : "Undo"}
                        </button>
                      ) : (
                        <button
                          id="btn-cancel-input"
                          type="button"
                          onClick={() => {
                            setInputWord("");
                            setInputTranslationZh("");
                            setInputTranslationEn("");
                            setInputExampleSentence("");
                            setInputExampleTranslation("");
                            setEditingWordId(null);
                            setPersonalTab("dictionary");
                          }}
                          className="py-2 px-5 bg-natural-sidebar hover:bg-natural-active text-natural-text border border-natural-border text-sm font-semibold rounded-xl transition-all cursor-pointer"
                        >
                          {settings.language === "zh" ? "返回" : "Back"}
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 3: RULES SETTINGS (规则设置) */}
              {personalTab === "rules" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center border-b border-natural-border pb-4">
                    <h2 id="rules-main-title" className="text-xl font-bold font-display text-natural-text flex items-center gap-2">
                      <Settings className="w-5 h-5 text-natural-sage" />
                      {t.rulesBtn}
                    </h2>
                  </div>

                  {/* Word selection rule */}
                  <div className="space-y-3 mt-4">
                    <h3 id="rules-title" className="text-sm font-bold text-natural-text flex items-center gap-2">
                      <Settings className="w-4 h-4 text-natural-sage" />
                      {t.rulesTitle}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Priority option 1: TIME */}
                      <button
                        id="btn-rule-time"
                        onClick={() =>
                          saveSettingsToStorage({
                            ...settings,
                            priorityRule: "time",
                          })
                        }
                        className={`px-4 py-3.5 rounded-xl border text-left flex flex-col justify-center h-[72px] transition-all cursor-pointer ${
                          settings.priorityRule === "time"
                            ? "bg-natural-active border-natural-sage text-natural-text shadow-sm"
                            : "bg-natural-white border-natural-border text-natural-muted hover:border-natural-accent"
                        }`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider text-natural-muted">
                          {settings.language === "zh" ? "优先级 1" : "Priority 1"}
                        </span>
                        <span className={`text-sm font-semibold mt-1 ${
                          settings.priorityRule === "time" ? "text-natural-text" : "text-natural-muted"
                        }`}>
                          {t.rulesTime}
                        </span>
                      </button>

                      {/* Priority option 2: LEVEL */}
                      <button
                        id="btn-rule-level"
                        onClick={() =>
                          saveSettingsToStorage({
                            ...settings,
                            priorityRule: "level",
                          })
                        }
                        className={`px-4 py-3.5 rounded-xl border text-left flex flex-col justify-center h-[72px] transition-all cursor-pointer ${
                          settings.priorityRule === "level"
                            ? "bg-natural-active border-natural-sage text-natural-text shadow-sm"
                            : "bg-natural-white border-natural-border text-natural-muted hover:border-natural-accent"
                        }`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider text-natural-muted">
                          {settings.language === "zh" ? "优先级 2" : "Priority 2"}
                        </span>
                        <span className={`text-sm font-semibold mt-1 ${
                          settings.priorityRule === "level" ? "text-natural-text" : "text-natural-muted"
                        }`}>
                          {t.rulesLevel}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Mastered word recurrence rule */}
                  <div className="space-y-3 pt-4 border-t border-natural-border">
                    <h2 id="recurrence-title" className="text-sm font-bold text-natural-text flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-natural-sage" />
                      {t.recurrenceTitle}
                    </h2>
                    <div className="flex bg-natural-sidebar p-1 rounded-xl text-sm border border-natural-border">
                      <button
                        id="radio-recurrence-never"
                        onClick={() => {
                          saveSettingsToStorage({
                            ...settings,
                            recurrenceRule: "never",
                          });
                          generateTodayQueue(words);
                        }}
                        className={`flex-1 text-center py-2.5 rounded-lg font-semibold transition-all cursor-pointer ${
                          settings.recurrenceRule === "never"
                            ? "bg-natural-white text-natural-text shadow-sm"
                            : "text-natural-muted hover:text-natural-text"
                        }`}
                      >
                        {t.recurrenceNever}
                      </button>

                      <button
                        id="radio-recurrence-7days"
                        onClick={() => {
                          saveSettingsToStorage({
                            ...settings,
                            recurrenceRule: "7days",
                          });
                          generateTodayQueue(words);
                        }}
                        className={`flex-1 text-center py-2.5 rounded-lg font-semibold transition-all cursor-pointer ${
                          settings.recurrenceRule === "7days"
                            ? "bg-natural-white text-natural-text shadow-sm"
                            : "text-natural-muted hover:text-natural-text"
                        }`}
                      >
                        {t.recurrence7days}
                      </button>

                      <button
                        id="radio-recurrence-always"
                        onClick={() => {
                          saveSettingsToStorage({
                            ...settings,
                            recurrenceRule: "always",
                          });
                          generateTodayQueue(words);
                        }}
                        className={`flex-1 text-center py-2.5 rounded-lg font-semibold transition-all cursor-pointer ${
                          settings.recurrenceRule === "always"
                            ? "bg-natural-white text-natural-text shadow-sm"
                            : "text-natural-muted hover:text-natural-text"
                        }`}
                      >
                        {t.recurrenceAlways}
                      </button>
                    </div>
                  </div>

                  {/* Review Frequency & Daily Reminder settings */}
                  <div className="pt-4 border-t border-natural-border">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Left Column: Review Frequency settings */}
                      <div className="space-y-2">
                        <h2 id="frequency-title" className="text-sm font-bold text-natural-text flex items-center gap-2">
                          <RotateCcw className="w-4 h-4 text-natural-sage" />
                          {t.frequencyTitle}
                        </h2>

                        <div className="flex flex-col gap-1.5">
                          <label id="lbl-daily-limit" className="text-[11px] font-semibold text-natural-muted">
                            {t.dailyLimit}
                          </label>
                          <div className="flex gap-2 items-center">
                            <select
                              id="select-daily-limit"
                              value={[5, 10, 15, 20, 30, 50, 100].includes(settings.dailyReviewLimit) ? settings.dailyReviewLimit.toString() : "custom"}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "custom") {
                                  const limit = 25; // default custom limit to 25
                                  saveSettingsToStorage({
                                    ...settings,
                                    dailyReviewLimit: limit,
                                  });
                                  generateTodayQueue(words);
                                } else {
                                  const limit = parseInt(val);
                                  saveSettingsToStorage({
                                    ...settings,
                                    dailyReviewLimit: limit,
                                  });
                                  generateTodayQueue(words);
                                }
                              }}
                              className="p-2.5 bg-natural-sidebar border border-natural-border rounded-xl focus:outline-none focus:ring-1.5 focus:ring-natural-sage/20 focus:border-natural-sage text-sm text-natural-text font-sans font-semibold cursor-pointer"
                            >
                              <option value="5" className="font-sans font-semibold">5</option>
                              <option value="10" className="font-sans font-semibold">10</option>
                              <option value="15" className="font-sans font-semibold">15</option>
                              <option value="20" className="font-sans font-semibold">20</option>
                              <option value="30" className="font-sans font-semibold">30</option>
                              <option value="50" className="font-sans font-semibold">50</option>
                              <option value="100" className="font-sans font-semibold">100</option>
                              <option value="custom" className="font-sans font-semibold">{settings.language === "zh" ? "自定义" : "Custom"}</option>
                            </select>

                            {/* Custom daily review input */}
                            {![5, 10, 15, 20, 30, 50, 100].includes(settings.dailyReviewLimit) && (
                              <div className="flex items-center gap-1.5 animate-fade-in">
                                <input
                                  id="input-custom-daily-limit"
                                  type="number"
                                  min="1"
                                  max="1000"
                                  value={settings.dailyReviewLimit}
                                  onChange={(e) => {
                                    const limit = Math.max(1, parseInt(e.target.value) || 1);
                                    saveSettingsToStorage({
                                      ...settings,
                                      dailyReviewLimit: limit,
                                    });
                                    generateTodayQueue(words);
                                  }}
                                  className="w-20 p-2 bg-natural-white border border-natural-border rounded-xl focus:outline-none focus:ring-1.5 focus:ring-natural-sage/20 focus:border-natural-sage text-sm text-natural-text font-semibold text-center"
                                />
                                <span className="text-xs text-natural-muted">{settings.language === "zh" ? "词" : "words"}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Daily Reminder settings */}
                      <div className="space-y-2">
                        <h2 id="reminder-title" className="text-sm font-bold text-natural-text flex items-center gap-2">
                          <Bell className="w-4 h-4 text-natural-sage" />
                          {settings.language === "zh" ? "每日提醒" : "Daily Reminder"}
                        </h2>

                        <div className="flex flex-col gap-1.5 pt-0.5">
                          <div className="flex items-center gap-3">
                            <button
                              id="toggle-reminder"
                              type="button"
                              onClick={() => {
                                const enabled = !settings.reminderEnabled;
                                saveSettingsToStorage({
                                  ...settings,
                                  reminderEnabled: enabled,
                                });
                                if (enabled) {
                                  requestNotificationPermission();
                                }
                              }}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                settings.reminderEnabled ? "bg-natural-sage" : "bg-natural-border"
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-natural-white shadow ring-0 transition duration-200 ease-in-out ${
                                  settings.reminderEnabled ? "translate-x-5" : "translate-x-0"
                                }`}
                              />
                            </button>
                            <span className="text-sm font-semibold text-natural-text">
                              {settings.language === "zh" ? "开启每日定时提醒" : "Enable Daily Reminder"}
                            </span>
                          </div>

                          {settings.reminderEnabled && (
                            <div className="flex items-center gap-2 animate-fade-in pt-1">
                              <input
                                id="input-reminder-time"
                                type="time"
                                value={settings.reminderTime || "20:00"}
                                onChange={(e) => {
                                  saveSettingsToStorage({
                                    ...settings,
                                    reminderTime: e.target.value,
                                  });
                                }}
                                className="p-2 bg-natural-white border border-natural-border rounded-xl focus:outline-none focus:ring-1.5 focus:ring-natural-sage/20 focus:border-natural-sage text-sm text-natural-text font-semibold text-center"
                              />
                              <span className="text-xs text-natural-muted">
                                {settings.language === "zh" ? "定时提醒" : "Scheduled reminder"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Example Sentence settings */}
                  <div className="space-y-2 pt-4 border-t border-natural-border">
                    <h2 id="example-sentence-setting-title" className="text-sm font-bold text-natural-text flex items-center gap-2">
                      <FileText className="w-4 h-4 text-natural-sage" />
                      {settings.language === "zh" ? "例句显示设置" : "Example Display Settings"}
                    </h2>

                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-natural-sidebar/40 hover:bg-natural-active border border-natural-border cursor-pointer transition-all text-natural-text">
                      <input
                        id="checkbox-show-example"
                        type="checkbox"
                        checked={settings.showExampleSentence !== false}
                        onChange={(e) => {
                          saveSettingsToStorage({
                            ...settings,
                            showExampleSentence: e.target.checked,
                          });
                        }}
                        className="w-4 h-4 accent-natural-sage text-natural-sage focus:ring-natural-sage border-natural-border rounded cursor-pointer"
                      />
                      <span className="text-sm font-semibold text-natural-muted">
                        {settings.language === "zh" ? "在卡片上显示例句" : "Show example sentences on flashcards"}
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 4: STATISTICS VIEW (统计) */}
              {personalTab === "statistics" && (
                <StatisticsView
                  words={words}
                  historyLogs={historyLogs}
                  language={settings.language}
                />
              )}
            </section>
          </div>
        )}
      </main>

      {/* GLOBAL DAILY REMINDER POPUP MODAL */}
      {inAppReminderActive && (
        <div id="reminder-modal-overlay" className="fixed inset-0 z-[100] flex items-center justify-center bg-natural-text/40 backdrop-blur-sm animate-fade-in p-4">
          <div id="reminder-modal-card" className="bg-natural-bg text-natural-text p-6 w-full max-w-sm rounded-2xl border border-natural-border shadow-2xl flex flex-col items-center text-center space-y-4 animate-scale-in">
            <div className="w-12 h-12 rounded-full bg-natural-active flex items-center justify-center border border-natural-sage/20 text-natural-sage animate-bounce">
              <Bell className="w-6 h-6 animate-pulse" />
            </div>
            
            <div className="space-y-1.5">
              <h3 id="reminder-modal-title" className="text-lg font-bold text-natural-text">
                {settings.language === "zh" ? "📚 学习时间到啦！" : "📚 Study Time!"}
              </h3>
              <p id="reminder-modal-body" className="text-sm text-natural-muted leading-relaxed">
                {settings.language === "zh" 
                  ? "Hola! 每天坚持复习，西班牙语更上一层楼！今天还有新单词在等待您的复习哦。" 
                  : "Hola! Stick to your daily review and improve your Spanish! New words are waiting for you today."}
              </p>
            </div>

            <div className="w-full space-y-2 pt-2">
              <button
                id="btn-reminder-modal-learn"
                onClick={() => {
                  setInAppReminderActive(false);
                  setCurrentPage("home");
                  setIsTranslationVisible(false);
                }}
                className="w-full py-2.5 px-4 bg-natural-sage hover:bg-natural-sage-hover text-white rounded-xl font-semibold shadow transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <BookOpen className="w-4 h-4" />
                <span>{settings.language === "zh" ? "立即学习" : "Start Learning"}</span>
              </button>
              
              <button
                id="btn-reminder-modal-later"
                onClick={() => setInAppReminderActive(false)}
                className="w-full py-2 bg-natural-sidebar hover:bg-natural-active text-natural-muted hover:text-natural-text rounded-xl text-sm font-semibold transition-all border border-natural-border cursor-pointer"
              >
                {settings.language === "zh" ? "稍后再说" : "Later"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
