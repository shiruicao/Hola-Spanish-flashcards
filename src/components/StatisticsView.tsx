/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from "react";
import { Word, StudyHistoryLog } from "../types";
import { TrendingUp, PieChart, Award, Calendar, ChevronLeft, ChevronRight } from "lucide-react";

const getLocalDateString = (d: Date = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

interface StatisticsViewProps {
  words: Word[];
  historyLogs: StudyHistoryLog[];
  language: "zh" | "en";
}

export default function StatisticsView({ words, historyLogs, language }: StatisticsViewProps) {
  const [activeTab, setActiveTab] = useState<"daily" | "calendar" | "total">("daily");
  const [trendRange, setTrendRange] = useState<7 | 30>(7);

  // Calendar year and month state (starts at today's year & month)
  const [calYear, setCalYear] = useState<number>(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState<number>(() => new Date().getMonth()); // 0-11

  // Content helper
  const t = {
    zh: {
      title: "学习数据统计",
      daily: "今日数据",
      calendar: "打卡日历",
      total: "总体趋势",
      learnedTitle: "已掌握单词",
      unlearnedTitle: "未掌握单词",
      totalDays: "你已学习了",
      totalWords: "共掌握了",
      daysUnit: "天",
      wordsUnit: "词",
      todayLearned: "今日已学",
      todayRemaining: "今日待学",
      noData: "暂无数据",
      trendLabel: "掌握单词累计",
      learned: "已掌握",
      unmastered: "待掌握",
      todayProgress: "今日学习进度",
      hoverTip: "鼠标悬停查看详细数据",
      calendarTitle: "打卡日历",
      checkInCount: "本月打卡",
      totalCheckIn: "累计打卡",
      weekdays: ["日", "一", "二", "三", "四", "五", "六"],
      trend7days: "近 7 天",
      trend30days: "近 30 天",
      checkedInLegend: "已打卡",
      uncheckedInLegend: "未打卡",
      todayLegend: "今天",
    },
    en: {
      title: "Learning Statistics",
      daily: "Daily Status",
      calendar: "Study Calendar",
      total: "Total Trend",
      learnedTitle: "Mastered Words",
      unlearnedTitle: "Unmastered Words",
      totalDays: "You studied for",
      totalWords: "Mastered a total of",
      daysUnit: "days",
      wordsUnit: "words",
      todayLearned: "Learned Today",
      todayRemaining: "Pending Today",
      noData: "No Data Available",
      trendLabel: "Cumulative Mastered",
      learned: "Mastered",
      unmastered: "Unmastered",
      todayProgress: "Today's Learning Progress",
      hoverTip: "Hover over bars to view details",
      calendarTitle: "Check-in Calendar",
      checkInCount: "This Month",
      totalCheckIn: "Total Check-ins",
      weekdays: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
      trend7days: "7 Days",
      trend30days: "30 Days",
      checkedInLegend: "Checked in",
      uncheckedInLegend: "No activity",
      todayLegend: "Today",
    },
  }[language];

  // Calculated Metrics
  const totalMasteredWords = useMemo(() => {
    return words.filter((w) => w.level === "familiar").length;
  }, [words]);

  const totalLearningDays = useMemo(() => {
    if (historyLogs.length === 0) return 0;
    const activeDays = historyLogs.filter((log) => log.reviewedCount > 0 || log.masteredCount > 0);
    return Math.max(1, activeDays.length);
  }, [historyLogs]);

  // Find the absolute earliest learning date (oldest active history log date, or oldest word inputTime)
  const earliestStudyDate = useMemo(() => {
    let earliest = "";
    historyLogs.forEach((log) => {
      if ((log.reviewedCount > 0 || log.masteredCount > 0) && (!earliest || log.date < earliest)) {
        earliest = log.date;
      }
    });
    words.forEach((w) => {
      const inputDate = new Date(w.inputTime);
      const inputStr = getLocalDateString(inputDate);
      if (!earliest || inputStr < earliest) {
        earliest = inputStr;
      }
    });
    if (!earliest) {
      earliest = getLocalDateString();
    }
    return earliest;
  }, [historyLogs, words]);

  // Generate the full chronological array of dates from earliest study date up to today
  const allHistoricalDates = useMemo(() => {
    const dates: { dateStr: string; dateObj: Date }[] = [];
    if (!earliestStudyDate) return dates;

    const [startYear, startMonth, startDay] = earliestStudyDate.split("-").map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(); // today
    
    // Normalize times to local midnight to avoid daylight saving time hour mismatch
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    
    const current = new Date(start);
    // Safety break to prevent infinite loops if dates are corrupt
    let loopCount = 0;
    while (current <= end && loopCount < 1000) {
      dates.push({
        dateStr: getLocalDateString(current),
        dateObj: new Date(current),
      });
      current.setDate(current.getDate() + 1);
      loopCount++;
    }
    return dates;
  }, [earliestStudyDate]);

  // Generate cumulative total learning trend (last N days)
  const totalTrendData = useMemo(() => {
    // Slice only the last trendRange elements (7 or 30 days) from the historical list.
    // If the learning duration is shorter, it will only have the actual active days so far (e.g. 1 day, 2 days).
    const slicedDates = allHistoricalDates.slice(-trendRange);
    
    // To ensure the trend matches current actual mastered words at the end of the line:
    const currentFamiliarCount = words.filter((w) => w.level === "familiar").length;
    
    return slicedDates.map((item) => {
      const dateStr = item.dateStr;
      const d = item.dateObj;
      
      // Calculate cumulative mastered words up to this date
      let masteredAfterThisDate = 0;
      historyLogs.forEach((log) => {
        if (log.date > dateStr) {
          masteredAfterThisDate += log.masteredCount;
        }
      });
      const cumulativeMastered = Math.max(0, currentFamiliarCount - masteredAfterThisDate);
      
      return {
        date: dateStr,
        label: `${d.getMonth() + 1}-${d.getDate()}`, // M-D format
        value: cumulativeMastered,
      };
    });
  }, [allHistoricalDates, historyLogs, words, trendRange]);

  // Today progress for Pie chart
  const todayProgress = useMemo(() => {
    const todayStr = getLocalDateString();
    const todayLog = historyLogs.find((h) => h.date === todayStr);
    
    const learnedCount = todayLog ? todayLog.masteredCount : words.filter(
      (w) => w.level === "familiar" && w.lastReviewedTime && getLocalDateString(new Date(w.lastReviewedTime)) === todayStr
    ).length;

    const remainingReviewCount = words.filter((w) => {
      if (w.level === "familiar") return false; // already familiar
      return true; // still needs learning or review
    }).length;

    const total = learnedCount + remainingReviewCount;
    const pct = total > 0 ? Math.round((learnedCount / total) * 100) : 0;

    return {
      learned: learnedCount,
      remaining: remainingReviewCount,
      total,
      percentage: pct,
    };
  }, [words, historyLogs]);

  // Calendar logic and values
  const totalDaysInMonth = useMemo(() => {
    return new Date(calYear, calMonth + 1, 0).getDate();
  }, [calYear, calMonth]);

  const firstDayIndex = useMemo(() => {
    return new Date(calYear, calMonth, 1).getDay();
  }, [calYear, calMonth]);

  const calendarCells = useMemo(() => {
    const cells = [];
    // Preceding empty slots
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ day: null, dateStr: "" });
    }
    // Days of the month
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const yearStr = calYear.toString();
      const monthStr = (calMonth + 1).toString().padStart(2, "0");
      const dayStr = d.toString().padStart(2, "0");
      const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
      cells.push({ day: d, dateStr });
    }
    return cells;
  }, [calYear, calMonth, totalDaysInMonth, firstDayIndex]);

  // Look up set of dates where user checked in (reviewed or mastered)
  const checkedInDates = useMemo(() => {
    const set = new Set<string>();
    historyLogs.forEach((log) => {
      if (log.reviewedCount > 0 || log.masteredCount > 0) {
        set.add(log.date);
      }
    });
    return set;
  }, [historyLogs]);

  // Checked-in days in selected month
  const monthCheckInsCount = useMemo(() => {
    const prefix = `${calYear}-${(calMonth + 1).toString().padStart(2, "0")}`;
    return historyLogs.filter(
      (log) => log.date.startsWith(prefix) && (log.reviewedCount > 0 || log.masteredCount > 0)
    ).length;
  }, [historyLogs, calYear, calMonth]);

  // Month navigation
  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  // Label showing condition on X-axis for trend chart
  const shouldShowLabel = (idx: number, total: number) => {
    if (total <= 7) return true;
    if (idx === 0 || idx === total - 1) return true;
    return idx % 5 === 0;
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center border-b border-natural-border pb-4">
        <h2 id="stats-title" className="text-xl font-bold font-display text-natural-text flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-natural-sage" />
          {t.title}
        </h2>
        <div className="flex bg-natural-sidebar p-0.5 rounded-lg text-sm border border-natural-border">
          <button
            id="stats-btn-daily"
            onClick={() => setActiveTab("daily")}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
              activeTab === "daily"
                ? "bg-natural-active text-natural-text border border-natural-border shadow-sm"
                : "text-natural-muted hover:text-natural-text"
            }`}
          >
            {t.daily}
          </button>
          <button
            id="stats-btn-calendar"
            onClick={() => setActiveTab("calendar")}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
              activeTab === "calendar"
                ? "bg-natural-active text-natural-text border border-natural-border shadow-sm"
                : "text-natural-muted hover:text-natural-text"
            }`}
          >
            {t.calendar}
          </button>
          <button
            id="stats-btn-total"
            onClick={() => setActiveTab("total")}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
              activeTab === "total"
                ? "bg-natural-active text-natural-text border border-natural-border shadow-sm"
                : "text-natural-muted hover:text-natural-text"
            }`}
          >
            {t.total}
          </button>
        </div>
      </div>

      {/* Main Chart Card - Enlarged & Widened as requested (h-[390px]) */}
      <div className="bg-natural-white border border-natural-border p-5 rounded-xl shadow-sm h-[390px] flex flex-col justify-between overflow-hidden">
        {/* DAILY STATS (Pie Chart) */}
        {activeTab === "daily" && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center h-full my-auto">
            <div className="md:col-span-8 flex justify-center">
              <div className="relative w-64 h-64">
                {/* SVG Donut Chart */}
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background Circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className="stroke-natural-sidebar"
                    strokeWidth="11"
                    fill="transparent"
                  />
                  {/* Progress Circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className="stroke-natural-sage transition-all duration-1000 ease-out"
                    strokeWidth="11"
                    fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${
                      2 * Math.PI * 40 * (1 - (todayProgress.percentage || 0) / 100)
                    }`}
                    strokeLinecap="round"
                  />
                </svg>
                {/* Percentage Center Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-extrabold text-natural-text font-sans tracking-tight">
                    {todayProgress.percentage}%
                  </span>
                  <span className="text-xs text-natural-muted font-bold mt-1 tracking-wide uppercase">
                    {language === "zh" ? "今日进度" : "Today"}
                  </span>
                </div>
              </div>
            </div>

            <div className="md:col-span-4 space-y-4">
              <h3 className="text-base font-bold text-natural-text flex items-center gap-2 font-display">
                <PieChart className="w-4.5 h-4.5 text-natural-sage" />
                {t.todayProgress}
              </h3>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center p-2.5 rounded-xl bg-natural-sidebar/50 border border-natural-border/40">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-natural-sage"></span>
                    <span className="text-xs font-semibold text-natural-muted">
                      {t.todayLearned}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-natural-text">
                    {todayProgress.learned} {t.wordsUnit}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded-xl bg-natural-sidebar/50 border border-natural-border/40">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#D4CFC9]"></span>
                    <span className="text-xs font-semibold text-natural-muted">
                      {t.todayRemaining}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-natural-text">
                    {todayProgress.remaining} {t.wordsUnit}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STUDY CALENDAR (Monthly Check-in Calendar) */}
        {activeTab === "calendar" && (
          <div className="space-y-3 flex-1 flex flex-col justify-between h-full">
            {/* Calendar Control Header */}
            <div className="flex justify-between items-center bg-natural-sidebar/40 p-2 rounded-lg border border-natural-border/30">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handlePrevMonth}
                  className="p-1 hover:bg-natural-sidebar rounded-lg border border-natural-border text-natural-text cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <select
                  value={calYear}
                  onChange={(e) => setCalYear(Number(e.target.value))}
                  className="px-2 py-1 bg-natural-white border border-natural-border rounded-lg text-xs font-semibold text-natural-text focus:outline-none cursor-pointer"
                >
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                  <option value="2028">2028</option>
                </select>
                <select
                  value={calMonth}
                  onChange={(e) => setCalMonth(Number(e.target.value))}
                  className="px-2 py-1 bg-natural-white border border-natural-border rounded-lg text-xs font-semibold text-natural-text focus:outline-none cursor-pointer"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>
                      {language === "zh" ? `${i + 1}月` : new Date(2026, i, 1).toLocaleString("en-US", { month: "short" })}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleNextMonth}
                  className="p-1 hover:bg-natural-sidebar rounded-lg border border-natural-border text-natural-text cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Check-in stats indicator */}
              <div className="text-xs font-bold text-natural-sage bg-natural-active/80 border border-natural-border/50 px-3 py-1 rounded-full shadow-sm">
                {t.checkInCount}: <span className="text-sm font-extrabold">{monthCheckInsCount}</span> {t.daysUnit}
              </div>
            </div>

            {/* Calendar Table Container */}
            <div className="flex-1 flex flex-col justify-center py-1">
              {/* Weekday Header Row */}
              <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-natural-muted uppercase tracking-wider pb-1 border-b border-natural-border/20">
                {t.weekdays.map((w, idx) => (
                  <div key={idx}>{w}</div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-y-1.5 gap-x-1 mt-2 text-center text-xs font-medium">
                {calendarCells.map((cell, idx) => {
                  if (cell.day === null) {
                    return <div key={`empty-${idx}`} className="h-7 w-7"></div>;
                  }

                  const isCheckedIn = checkedInDates.has(cell.dateStr);
                  const cellDate = new Date(cell.dateStr);
                  const today = new Date();
                  const todayStr = getLocalDateString(today);
                  const isToday = cell.dateStr === todayStr;
                  const isFuture = cellDate > today && !isToday;

                  let cellStyle = "text-natural-text hover:bg-natural-sidebar/70 cursor-pointer";
                  if (isCheckedIn) {
                    // Olive green check-in
                    cellStyle = "bg-natural-sage text-white font-bold shadow-sm";
                  } else if (isToday) {
                    // Today ring
                    cellStyle = "ring-2 ring-natural-accent border border-natural-text font-bold text-natural-text";
                  } else if (isFuture) {
                    // Faded future
                    cellStyle = "text-natural-muted/30 pointer-events-none";
                  }

                  return (
                    <div key={`day-${cell.day}`} className="relative flex items-center justify-center">
                      <div
                        className={`h-7 w-7 rounded-full flex items-center justify-center transition-all duration-200 ${cellStyle}`}
                        title={isCheckedIn ? (language === "zh" ? "已打卡复习" : "Checked-in") : undefined}
                      >
                        {cell.day}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Simple Legend for Calendar */}
            <div className="flex justify-center items-center gap-4 text-[10px] font-semibold text-natural-muted border-t border-natural-border/10 pt-2 pb-0.5">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-natural-sage"></span>
                {t.checkedInLegend}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full border border-natural-border bg-natural-white"></span>
                {t.uncheckedInLegend}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full ring-1 ring-natural-accent border border-natural-text bg-natural-white"></span>
                {t.todayLegend}
              </span>
            </div>
          </div>
        )}

        {/* TOTAL STATS (Line Chart - Enhanced Tall Aspect Ratio) */}
        {activeTab === "total" && (
          <div className="space-y-3 flex-1 flex flex-col justify-between h-full">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-semibold text-natural-text flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-natural-sage" />
                {t.trendLabel}
              </h3>

              {/* Range Toggle Controls: 7 Days vs 30 Days */}
              <div className="flex bg-natural-sidebar p-0.5 rounded-md text-[10px] border border-natural-border">
                <button
                  onClick={() => setTrendRange(7)}
                  className={`px-2 py-1 rounded-sm font-bold transition-all cursor-pointer ${
                    trendRange === 7
                      ? "bg-natural-white text-natural-sage shadow-sm"
                      : "text-natural-muted hover:text-natural-text"
                  }`}
                >
                  {t.trend7days}
                </button>
                <button
                  onClick={() => setTrendRange(30)}
                  className={`px-2 py-1 rounded-sm font-bold transition-all cursor-pointer ${
                    trendRange === 30
                      ? "bg-natural-white text-natural-sage shadow-sm"
                      : "text-natural-muted hover:text-natural-text"
                  }`}
                >
                  {t.trend30days}
                </button>
              </div>
            </div>

            {/* Custom SVG Line Chart - Taller and using uniform aspect-ratio to prevent flattening */}
            <div className="relative w-full h-[270px] mt-1">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 800 240">
                {/* Horizontal Grid Lines */}
                <line x1="0" y1="30" x2="800" y2="30" className="stroke-natural-sidebar" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0" y1="80" x2="800" y2="80" className="stroke-natural-sidebar" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0" y1="130" x2="800" y2="130" className="stroke-natural-sidebar" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0" y1="180" x2="800" y2="180" className="stroke-natural-sidebar" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0" y1="210" x2="800" y2="210" className="stroke-natural-sidebar" strokeWidth="1" strokeDasharray="4 4" />

                {/* Draw Area Fill & Line Path */}
                {(() => {
                  const width = 800;
                  const height = 240;
                  const paddingY = 30;
                  const paddingX = 35;
                  const usableHeight = height - paddingY * 2;
                  
                  const vals = totalTrendData.map((d) => d.value);
                  const maxVal = Math.ceil(Math.max(...vals, 5) * 1.15);
                  const minVal = 0;
                  const valRange = maxVal - minVal || 1;

                  const points = totalTrendData.map((d, i) => {
                    const x = totalTrendData.length > 1
                      ? paddingX + (i / (totalTrendData.length - 1)) * (width - paddingX * 2)
                      : width / 2;
                    const y = height - paddingY - ((d.value - minVal) / valRange) * usableHeight;
                    return { x, y, label: d.label, value: d.value };
                  });

                  if (points.length === 0) {
                    return (
                      <text x="400" y="120" textAnchor="middle" className="fill-natural-muted font-sans text-sm font-medium">
                        {t.noData}
                      </text>
                    );
                  }

                  // Helper for smooth bezier curves
                  const getBezierPath = (pts: { x: number; y: number }[]) => {
                    if (pts.length === 0) return "";
                    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
                    let pathStr = `M ${pts[0].x} ${pts[0].y}`;
                    for (let i = 0; i < pts.length - 1; i++) {
                      const p0 = pts[i];
                      const p1 = pts[i + 1];
                      const cpX1 = p0.x + (p1.x - p0.x) / 3;
                      const cpY1 = p0.y;
                      const cpX2 = p0.x + 2 * (p1.x - p0.x) / 3;
                      const cpY2 = p1.y;
                      pathStr += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
                    }
                    return pathStr;
                  };

                  const linePath = getBezierPath(points);

                  const fillPath = points.length > 1
                    ? `${linePath} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`
                    : "";

                  const is30Days = trendRange === 30;

                  return (
                    <>
                      {/* Gradient Fill under the line */}
                      {points.length > 1 && (
                        <defs>
                          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6B705C" stopOpacity="0.30" />
                            <stop offset="100%" stopColor="#6B705C" stopOpacity="0.00" />
                          </linearGradient>
                        </defs>
                      )}
                      {points.length > 1 && <path d={fillPath} fill="url(#chartGrad)" />}
                      
                      {/* Highlighted path stroke */}
                      {points.length > 1 && (
                        <path d={linePath} fill="none" className="stroke-natural-sage" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      )}

                      {/* Data Dots & Text */}
                      {points.map((p, idx) => {
                        const showLbl = shouldShowLabel(idx, points.length);
                        return (
                          <g key={idx} className="group/dot">
                            {/* Large invisible circle overlay to catch mouse events stably without flickering */}
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r="18"
                              className="fill-transparent stroke-none cursor-pointer"
                            />
                            {/* Visible small circle */}
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={is30Days ? "3.5" : "4.5"}
                              className={`fill-natural-white stroke-natural-sage cursor-pointer group-hover/dot:stroke-natural-accent group-hover/dot:stroke-[3.5px] ${
                                is30Days ? "opacity-0 group-hover/dot:opacity-100" : "opacity-100"
                              }`}
                              strokeWidth={is30Days ? "1.5" : "2.5"}
                            />
                            {/* Floating value on dot hover */}
                            <g className="opacity-0 group-hover/dot:opacity-100 transition-opacity duration-200 pointer-events-none">
                              <rect
                                x={p.x - 22}
                                y={p.y - 32}
                                width="44"
                                height="20"
                                rx="5"
                                className="fill-natural-text"
                              />
                              <text
                                x={p.x}
                                y={p.y - 18}
                                textAnchor="middle"
                                className="fill-natural-bg font-mono text-[10px] font-bold"
                              >
                                {p.value}
                              </text>
                            </g>
                            
                            {/* X-Axis labels at the bottom (conditional) */}
                            {showLbl && (
                              <text
                                x={p.x}
                                y={height - 6}
                                textAnchor="middle"
                                className="fill-natural-muted font-mono text-[10px] font-medium"
                              >
                                {p.label}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Metric Cards Bottom Summary - Stays locked at the bottom, unaffected by tab switching */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-natural-sidebar/50 border border-natural-border p-4 rounded-xl flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-natural-active text-natural-sage flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-natural-muted font-display">
              {t.totalDays}
            </p>
            <p className="text-lg font-bold text-natural-text mt-0.5">
              {totalLearningDays} <span className="text-xs font-normal text-natural-muted">{t.daysUnit}</span>
            </p>
          </div>
        </div>

        <div className="bg-natural-sidebar/50 border border-natural-border p-4 rounded-xl flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-natural-active text-natural-sage flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-natural-muted font-display">
              {t.totalWords}
            </p>
            <p className="text-lg font-bold text-natural-text mt-0.5">
              {totalMasteredWords} <span className="text-xs font-normal text-natural-muted">{t.wordsUnit}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
