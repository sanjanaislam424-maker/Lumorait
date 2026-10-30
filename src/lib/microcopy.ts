import { supabase } from '@/lib/supabase';
import type { Lang } from '@/lib/i18n';

const STATIC_FALLBACKS: Record<string, string> = {
  tasksHeader_bn: "কাজের তালিকা প্রস্তুত আছে, এবার একটু পরিশ্রম করলে উপার্জনও হবে।",
  tasksHeader_en: "Your task list is ready; a little effort can turn it into real earnings.",
  loadingTasks_bn: "কাজগুলো আসছে, একটু অপেক্ষা করুন; ধৈর্যও এক ধরনের দক্ষতা।",
  loadingTasks_en: "Your tasks are loading; patience is a useful skill too.",
  categoryEmpty_bn: "এই বিভাগে এখন কোনো কাজ নেই; অন্য বিভাগটি দেখে নিন।",
  categoryEmpty_en: "There are no tasks in this category right now; try another one.",
  yourTasksFirst_bn: "আপনার কাজগুলো সবার আগে দেখানো হচ্ছে, যাতে সুযোগ হাতছাড়া না হয়।",
  yourTasksFirst_en: "Your tasks appear first so you never miss an opportunity.",
  videoTutorialHeader_bn: "কাজ শুরু করার আগে ছোট টিউটোরিয়ালটি দেখে নিন।",
  videoTutorialHeader_en: "Watch the short tutorial before you start the task.",
  videoPanelSubtitle_bn: "দুই মিনিটের নির্দেশনা আপনার কাজটি সঠিকভাবে শেষ করতে সাহায্য করবে।",
  videoPanelSubtitle_en: "A two-minute guide can help you complete the task correctly.",
  dailyTip_bn: "প্রতিদিন নির্দিষ্ট সময়ে মানসম্মত পোস্ট করুন; অনিয়মিত প্রচারে অ্যালগরিদমও বিভ্রান্ত হয়।",
  dailyTip_en: "Post quality content consistently; irregular promotion confuses the algorithm too.",
  dashboardAlert_bn: "আজকের চেক-ইনটি সম্পন্ন করুন, কারণ ছোট অভ্যাসই বড় ফল তৈরি করে।",
  dashboardAlert_en: "Complete today's check-in because small habits create meaningful results.",
  taskAvailable_bn: "আপনার জন্য নতুন কাজ অপেক্ষা করছে; সুযোগটি কাজে লাগান।",
  taskAvailable_en: "A new task is waiting for you; make the opportunity count.",
  watchTutorial_bn: "টিউটোরিয়ালটি দেখে কাজটি আরও আত্মবিশ্বাসের সঙ্গে শুরু করুন।",
  watchTutorial_en: "Watch the tutorial and start the task with confidence.",
};

const DB_FIELD_MAP: Record<string, string> = {
  tasksHeader: 'tasks_header',
  loadingTasks: 'loading_tasks',
  categoryEmpty: 'category_empty',
  yourTasksFirst: 'your_tasks_first',
  videoTutorialHeader: 'video_tutorial_header',
  videoPanelSubtitle: 'video_panel_subtitle',
  dailyTip: 'daily_tip',
  dashboardAlert: 'dashboard_alert',
  taskAvailable: 'task_available',
  watchTutorial: 'watch_tutorial',
};

type CopyKey = keyof typeof DB_FIELD_MAP;

interface AiCopyCache {
  date: string;
  copy: Record<string, string>;
}

let memoryCache: AiCopyCache | null = null;
let fetchPromise: Promise<Record<string, string>> | null = null;

function getCacheKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getLocalStorageCache(): AiCopyCache | null {
  try {
    const raw = localStorage.getItem('lumora_ai_ui_copy');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AiCopyCache;
    if (parsed.date !== getCacheKey()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setLocalStorageCache(copy: Record<string, string>) {
  try {
    localStorage.setItem('lumora_ai_ui_copy', JSON.stringify({ date: getCacheKey(), copy }));
  } catch {
    // ignore
  }
}

async function fetchDailyCopy(): Promise<Record<string, string>> {
  if (memoryCache && memoryCache.date === getCacheKey()) {
    return memoryCache.copy;
  }

  const lsCache = getLocalStorageCache();
  if (lsCache) {
    memoryCache = lsCache;
    return lsCache.copy;
  }

  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const today = getCacheKey();
      const { data: dbRow } = await supabase
        .from('daily_ai_ui_copy')
        .select('*')
        .eq('content_date', today)
        .maybeSingle();

      let copy: Record<string, string> = {};

      if (dbRow) {
        for (const [jsKey, dbKey] of Object.entries(DB_FIELD_MAP)) {
          const bnKey = `${dbKey}_bn`;
          const enKey = `${dbKey}_en`;
          const dbRecord = dbRow as Record<string, string>;
          copy[`${jsKey}_bn`] = dbRecord[bnKey] || STATIC_FALLBACKS[`${jsKey}_bn`];
          copy[`${jsKey}_en`] = dbRecord[enKey] || STATIC_FALLBACKS[`${jsKey}_en`];
        }
      } else {
        const { data } = await supabase.functions.invoke('ai-ui-copy', {});
        if (data) {
          const d = data as Record<string, string>;
          for (const [jsKey, dbKey] of Object.entries(DB_FIELD_MAP)) {
            copy[`${jsKey}_bn`] = d[`${dbKey}_bn`] || STATIC_FALLBACKS[`${jsKey}_bn`];
            copy[`${jsKey}_en`] = d[`${dbKey}_en`] || STATIC_FALLBACKS[`${jsKey}_en`];
          }
        } else {
          copy = { ...STATIC_FALLBACKS };
        }
      }

      memoryCache = { date: getCacheKey(), copy };
      setLocalStorageCache(copy);
      return copy;
    } catch {
      return { ...STATIC_FALLBACKS };
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

let currentCopy: Record<string, string> = { ...STATIC_FALLBACKS };
let initialized = false;

export function initAiCopy() {
  if (initialized) return;
  initialized = true;
  fetchDailyCopy().then((copy) => { currentCopy = copy; });
}

export function invalidateAiCopyCache() {
  memoryCache = null;
  fetchPromise = null;
  try { localStorage.removeItem('lumora_ai_ui_copy'); } catch { /* ignore */ }
  initialized = false;
  initAiCopy();
}

function pick(copy: Record<string, string>, key: string, lang: Lang): string {
  const langKey = `${key}_${lang}`;
  return currentCopy[langKey] ?? copy[langKey] ?? STATIC_FALLBACKS[langKey] ?? STATIC_FALLBACKS[`${key}_${lang === 'bn' ? 'en' : 'bn'}`];
}

const STATIC_PROMO_COPY = {
  promoExpired: [
    { bn: 'প্রমো কোডের মেয়াদ শেষ হয়ে গেছে; আগামীবার আরও দ্রুত হোন।', en: 'This promo code has expired; be faster next time.' },
    { bn: 'মেয়াদ শেষ! সময়মতো না এলে বোনাস বাতাসে উড়ে যায়।', en: 'Deadline passed! Bonuses fly away if you arrive late.' },
    { bn: 'সময় ফুরিয়েছে; পরবর্তী প্রমো কোডের জন্য প্রস্তুত থাকুন।', en: 'Time is up; stay ready for the next promo code.' },
  ],
  promoUsed: [
    { bn: 'এই কোডটি আগেই ব্যবহার করা হয়েছে; একটি নতুন কোড চেষ্টা করুন।', en: 'This code was already used; try a different one.' },
    { bn: 'একই কোড দুবার কাজে লাগানো যায় না; নতুনটি খুঁজুন।', en: 'You cannot use the same code twice; find a new one.' },
    { bn: 'বোনাস ইতিমধ্যেই গ্রহণ করা হয়েছে; পরবর্তী সুযোগের জন্য অপেক্ষা করুন।', en: 'Bonus already claimed; wait for the next opportunity.' },
  ],
  promoInvalid: [
    { bn: 'ভুল কোড দিয়ে বিভ্রান্ত করবেন না; সঠিক কোডটি যাচাই করুন।', en: 'Do not confuse with a wrong code; verify the correct one.' },
    { bn: 'এই কোডটি বাতিল; আবার সঠিকভাবে চেষ্টা করুন।', en: 'This code is invalid; try again with the correct one.' },
    { bn: 'কোডটি মিলছে না; আরেকবার যত্ন সহকারে দেখুন।', en: 'The code does not match; check carefully once more.' },
  ],
  promoSuccess: [
    { bn: 'সাবাশ! বোনাস কয়েন আপনার অ্যাকাউন্টে যুক্ত হয়েছে।', en: 'Well done! Bonus coins have been added to your account.' },
    { bn: 'অভিনন্দন! বোনাস কয়েন সফলভাবে প্রদান করা হয়েছে।', en: 'Congratulations! Bonus coins have been credited successfully.' },
    { bn: 'কাজে লেগে যান; বোনাস পকেটে চলে এসেছে।', en: 'Get to work; the bonus has landed in your pocket.' },
  ],
  promoLimit: [
    { bn: 'প্রমো কোডের সীমা শেষ; আগামীবার আরও দ্রুত হোন।', en: 'This promo code has reached its limit; be faster next time.' },
    { bn: 'সব টিকিট বিক্রি হয়ে গেছে; পরবর্তীবার আগে আসুন।', en: 'All tickets are sold out; come earlier next time.' },
    { bn: 'স্টক ফুরিয়েছে; পরবর্তী সুযোগে আবার চেষ্টা করুন।', en: 'Stock is exhausted; try again on the next opportunity.' },
  ],
  promoInactive: [
    { bn: 'এই প্রমো কোডটি এখন নিষ্ক্রিয়; পরে আবার চেষ্টা করুন।', en: 'This promo code is currently inactive; try again later.' },
    { bn: 'কোডটি বর্তমানে বন্ধ আছে; কিছুক্ষণ পর ফিরে আসুন।', en: 'The code is currently disabled; come back in a while.' },
    { bn: 'প্রমোটি এখন চালু নেই; সক্রিয় হলে জানিয়ে দেওয়া হবে।', en: 'The promo is not active now; you will be notified when it resumes.' },
  ],
  promotionSuccess: [
    { bn: 'কাজটি সফলভাবে প্রচার করা হয়েছে; এখন সবাই এটি দেখতে পাবে।', en: 'Your task has been promoted successfully; everyone will see it now.' },
    { bn: 'বুস্ট সফল! আপনার কাজ এখন সবার শীর্ষে অবস্থান করছে।', en: 'Boost successful! Your task now appears at the top for everyone.' },
    { bn: 'প্রচার সম্পন্ন; সুযোগটি এখন আরও বেশি মানুষের কাছে পৌঁছাবে।', en: 'Promotion complete; the opportunity will reach more people now.' },
  ],
  promotionEmpty: [
    { bn: 'এখন কোনো প্রচারিত কাজ নেই; নিজের কাজ প্রচার করুন।', en: 'No promoted tasks right now; promote your own task.' },
    { bn: 'কেউ এখনো বুস্ট করেনি; প্রথম হয়ে যান।', en: 'No one has boosted yet; be the first.' },
    { bn: 'প্রচারিত কাজের তালিকা খালি; দ্রুত নিজের কাজ বুস্ট করুন।', en: 'The promoted tasks list is empty; boost your task quickly.' },
  ],
  notEnoughPromoCoins: [
    { bn: 'প্রচারের জন্য পর্যাপ্ত কয়েন নেই; আরও কাজ সম্পন্ন করুন।', en: 'Not enough coins for promotion; complete more tasks first.' },
    { bn: 'কয়েন কম আছে; প্রচারের আগে ব্যালেন্স বাড়ান।', en: 'Coins are low; increase your balance before promoting.' },
    { bn: 'প্রচার করতে কয়েন প্রয়োজন; প্রথমে কিছু কাজ করুন।', en: 'Promotion requires coins; do some tasks first.' },
  ],
  errorGeneric: [
    { bn: 'কিছু একটা সমস্যা হয়েছে; কিছুক্ষণ পর আবার চেষ্টা করুন।', en: 'Something went wrong; please try again in a moment.' },
    { bn: 'সাময়িক ব্যাঘাত; রিফ্রেশ করে আবার দেখুন।', en: 'A temporary issue; refresh and try again.' },
    { bn: 'নেটওয়ার্কে সমস্যা; কিছুক্ষণ পর আবার চেষ্টা করুন।', en: 'Network issue; please try again shortly.' },
  ],
  taskEditSuccess: [
    { bn: 'কাজটি সম্পাদনা করা হয়েছে; সব এখন ঠিকঠাক।', en: 'Task edited successfully; everything is in order now.' },
    { bn: 'সম্পাদনা সফল! কাজটি আপডেট হয়েছে।', en: 'Edit successful! The task has been updated.' },
    { bn: 'কাজ আপডেট হয়েছে; এখন প্রস্তুত হোন।', en: 'Task updated; get ready now.' },
  ],
};

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function createMicrocopy(lang: Lang) {
  return {
    promoExpired: () => {
      const p = randomPick(STATIC_PROMO_COPY.promoExpired);
      return lang === 'bn' ? p.bn : p.en;
    },
    promoUsed: () => {
      const p = randomPick(STATIC_PROMO_COPY.promoUsed);
      return lang === 'bn' ? p.bn : p.en;
    },
    promoInvalid: () => {
      const p = randomPick(STATIC_PROMO_COPY.promoInvalid);
      return lang === 'bn' ? p.bn : p.en;
    },
    promoSuccess: () => {
      const p = randomPick(STATIC_PROMO_COPY.promoSuccess);
      return lang === 'bn' ? p.bn : p.en;
    },
    promoLimit: () => {
      const p = randomPick(STATIC_PROMO_COPY.promoLimit);
      return lang === 'bn' ? p.bn : p.en;
    },
    promoInactive: () => {
      const p = randomPick(STATIC_PROMO_COPY.promoInactive);
      return lang === 'bn' ? p.bn : p.en;
    },
    tasksHeader: () => pick(currentCopy, 'tasksHeader', lang),
    tasksCounter: (n: number) => `${n} ${pick(currentCopy, 'taskAvailable', lang)}`,
    categoryEmpty: () => pick(currentCopy, 'categoryEmpty', lang),
    loadingTasks: () => pick(currentCopy, 'loadingTasks', lang),
    errorGeneric: () => {
      const p = randomPick(STATIC_PROMO_COPY.errorGeneric);
      return lang === 'bn' ? p.bn : p.en;
    },
    taskEditSuccess: () => {
      const p = randomPick(STATIC_PROMO_COPY.taskEditSuccess);
      return lang === 'bn' ? p.bn : p.en;
    },
    yourTasksFirst: () => pick(currentCopy, 'yourTasksFirst', lang),
    videoTutorialHeader: () => pick(currentCopy, 'videoTutorialHeader', lang),
    videoPanelSubtitle: () => pick(currentCopy, 'videoPanelSubtitle', lang),
    promotionSuccess: () => {
      const p = randomPick(STATIC_PROMO_COPY.promotionSuccess);
      return lang === 'bn' ? p.bn : p.en;
    },
    promotionEmpty: () => {
      const p = randomPick(STATIC_PROMO_COPY.promotionEmpty);
      return lang === 'bn' ? p.bn : p.en;
    },
    notEnoughPromoCoins: () => {
      const p = randomPick(STATIC_PROMO_COPY.notEnoughPromoCoins);
      return lang === 'bn' ? p.bn : p.en;
    },
    dailyTip: () => pick(currentCopy, 'dailyTip', lang),
    dashboardAlert: () => pick(currentCopy, 'dashboardAlert', lang),
    watchTutorial: () => pick(currentCopy, 'watchTutorial', lang),
  };
}

export { fetchDailyCopy };
export type { CopyKey };
