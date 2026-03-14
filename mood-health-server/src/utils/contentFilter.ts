const SENSITIVE_WORDS = [
  "暴力",
  "恐怖",
  "自杀",
  "杀人",
  "毒品",
  "赌博",
  "色情",
  "诈骗",
  "传销",
  "邪教",
  "枪支",
  "炸弹",
  "爆炸",
  "投毒",
  "绑架",
  "勒索",
  "抢劫",
  "强奸",
  "猥亵",
  "卖淫",
  "嫖娼",
  "赌博",
  "吸毒",
  "贩毒",
  "制毒",
  "洗钱",
  "贪污",
  "受贿",
  "行贿",
  "诈骗",
  "敲诈",
  "勒索",
  "诽谤",
  "造谣",
  "传谣",
  "煽动",
  "颠覆",
  "分裂",
  "恐怖主义",
  "极端主义",
  "邪教组织",
  "黑社会",
  "黑恶势力",
  "涉黑",
  "涉恶",
  "涉毒",
  "涉黄",
  "涉赌",
  "涉枪",
  "涉爆",
  "涉恐",
  "涉邪",
  "涉诈",
  "涉骗",
  "涉黑涉恶",
  "涉黄涉赌",
  "涉毒涉枪",
  "涉恐涉爆",
  "涉邪涉诈",
  "涉黑涉恶涉毒",
  "涉黄涉赌涉枪",
  "涉恐涉爆涉邪",
  "涉诈涉骗涉黑",
  "涉恶涉毒涉黄",
  "涉赌涉枪涉爆",
  "涉恐涉邪涉诈",
  "涉黑涉恶涉毒涉黄",
  "涉赌涉枪涉爆涉邪",
  "涉恐涉邪涉诈涉骗",
  "涉黑涉恶涉毒涉黄涉赌",
  "涉枪涉爆涉邪涉诈涉骗",
  "涉黑涉恶涉毒涉黄涉赌涉枪",
  "涉爆涉邪涉诈涉骗涉黑涉恶",
  "涉毒涉黄涉赌涉枪涉爆涉邪",
  "涉邪涉诈涉骗涉黑涉恶涉毒涉黄",
  "涉赌涉枪涉爆涉邪涉诈涉骗涉黑涉恶",
  "涉恐涉邪涉诈涉骗涉黑涉恶涉毒涉黄涉赌",
  "涉枪涉爆涉邪涉诈涉骗涉黑涉恶涉毒涉黄涉赌涉恐",
  "涉爆涉邪涉诈涉骗涉黑涉恶涉毒涉黄涉赌涉枪涉爆",
  "涉邪涉诈涉骗涉黑涉恶涉毒涉黄涉赌涉枪涉爆涉邪",
  "涉诈涉骗涉黑涉恶涉毒涉黄涉赌涉枪涉爆涉邪涉诈",
  "涉骗涉黑涉恶涉毒涉黄涉赌涉枪涉爆涉邪涉诈涉骗",
  "涉黑涉恶涉毒涉黄涉赌涉枪涉爆涉邪涉诈涉骗涉黑",
  "涉恶涉毒涉黄涉赌涉枪涉爆涉邪涉诈涉骗涉黑涉恶",
  "涉毒涉黄涉赌涉枪涉爆涉邪涉诈涉骗涉黑涉恶涉毒",
  "涉黄涉赌涉枪涉爆涉邪涉诈涉骗涉黑涉恶涉毒涉黄",
  "涉赌涉枪涉爆涉邪涉诈涉骗涉黑涉恶涉毒涉黄涉赌",
  "涉枪涉爆涉邪涉诈涉骗涉黑涉恶涉毒涉黄涉赌涉枪",
  "涉爆涉邪涉诈涉骗涉黑涉恶涉毒涉黄涉赌涉枪涉爆",
  "涉邪涉诈涉骗涉黑涉恶涉毒涉黄涉赌涉枪涉爆涉邪",
  "涉诈涉骗涉黑涉恶涉毒涉黄涉赌涉枪涉爆涉邪涉诈",
  "涉骗涉黑涉恶涉毒涉黄涉赌涉枪涉爆涉邪涉诈涉骗"
];

export interface ContentFilterResult {
  isSafe: boolean;
  detectedWords: string[];
  severity: "low" | "medium" | "high";
}

export const filterContent = (content: string): ContentFilterResult => {
  const detectedWords: string[] = [];
  const lowerContent = content.toLowerCase();

  for (const word of SENSITIVE_WORDS) {
    if (lowerContent.includes(word.toLowerCase())) {
      detectedWords.push(word);
    }
  }

  if (detectedWords.length === 0) {
    return {
      isSafe: true,
      detectedWords: [],
      severity: "low"
    };
  }

  let severity: "low" | "medium" | "high" = "low";
  if (detectedWords.length >= 3) {
    severity = "high";
  } else if (detectedWords.length >= 2) {
    severity = "medium";
  }

  return {
    isSafe: false,
    detectedWords,
    severity
  };
};

export const shouldAutoReject = (content: string): boolean => {
  const result = filterContent(content);
  return !result.isSafe && result.severity === "high";
};

export const shouldMarkForReview = (content: string): boolean => {
  const result = filterContent(content);
  return !result.isSafe && result.severity !== "high";
};
