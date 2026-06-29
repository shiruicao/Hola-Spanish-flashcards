/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Word } from "./types";

const now = Date.now();
const ONE_DAY = 24 * 60 * 60 * 1000;

export const defaultWords: Word[] = [
  {
    id: "default-1",
    word: "hola",
    translationZh: "你好",
    translationEn: "hello",
    level: "familiar",
    inputTime: now - 10 * ONE_DAY,
    lastReviewedTime: now - ONE_DAY,
    reviewCount: 5,
    isNew: false
  },
  {
    id: "default-2",
    word: "gracias",
    translationZh: "谢谢",
    translationEn: "thank you",
    level: "familiar",
    inputTime: now - 9 * ONE_DAY,
    lastReviewedTime: now - ONE_DAY,
    reviewCount: 4,
    isNew: false
  },
  {
    id: "default-3",
    word: "buenos días",
    translationZh: "早上好",
    translationEn: "good morning",
    level: "blur",
    inputTime: now - 8 * ONE_DAY,
    lastReviewedTime: now - 2 * ONE_DAY,
    reviewCount: 2,
    isNew: false
  },
  {
    id: "default-4",
    word: "amigo",
    translationZh: "朋友",
    translationEn: "friend",
    level: "unfamiliar",
    inputTime: now - 7 * ONE_DAY,
    lastReviewedTime: now - 3 * ONE_DAY,
    reviewCount: 3,
    isNew: false
  },
  {
    id: "default-5",
    word: "manzana",
    translationZh: "苹果",
    translationEn: "apple",
    level: "unfamiliar",
    inputTime: now - 6 * ONE_DAY,
    lastReviewedTime: null,
    reviewCount: 0,
    isNew: true
  },
  {
    id: "default-6",
    word: "por favor",
    translationZh: "请",
    translationEn: "please",
    level: "familiar",
    inputTime: now - 5 * ONE_DAY,
    lastReviewedTime: now - ONE_DAY,
    reviewCount: 6,
    isNew: false
  },
  {
    id: "default-7",
    word: "lo siento",
    translationZh: "对不起 / 抱歉",
    translationEn: "I'm sorry",
    level: "blur",
    inputTime: now - 4 * ONE_DAY,
    lastReviewedTime: now - 2 * ONE_DAY,
    reviewCount: 1,
    isNew: false
  },
  {
    id: "default-8",
    word: "adiós",
    translationZh: "再见",
    translationEn: "goodbye",
    level: "familiar",
    inputTime: now - 3 * ONE_DAY,
    lastReviewedTime: now - ONE_DAY,
    reviewCount: 3,
    isNew: false
  },
  {
    id: "default-9",
    word: "tiempo",
    translationZh: "时间 / 天气",
    translationEn: "time / weather",
    level: "unfamiliar",
    inputTime: now - 2 * ONE_DAY,
    lastReviewedTime: null,
    reviewCount: 0,
    isNew: true
  },
  {
    id: "default-10",
    word: "comida",
    translationZh: "食物",
    translationEn: "food",
    level: "blur",
    inputTime: now - 1 * ONE_DAY,
    lastReviewedTime: null,
    reviewCount: 0,
    isNew: true
  },
  {
    id: "default-11",
    word: "agua",
    translationZh: "水",
    translationEn: "water",
    level: "unfamiliar",
    inputTime: now,
    lastReviewedTime: null,
    reviewCount: 0,
    isNew: true
  },
  {
    id: "default-12",
    word: "libro",
    translationZh: "书",
    translationEn: "book",
    level: "unfamiliar",
    inputTime: now,
    lastReviewedTime: null,
    reviewCount: 0,
    isNew: true
  }
];
