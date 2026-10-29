import { supabase } from '@/lib/supabase';

const STATIC_FALLBACKS: Record<string, string> = {
  tasksHeader: "Kaj er palla ora kore, apni boshe chaye khao moshay!",
  loadingTasks: "Kaj ane barita hocche moshay, ektu dhoyro doro!",
  categoryEmpty: "Ekhon kaj nai mama, cha-biskut khaiya asho!",
  yourTasksFirst: "Apnar kaj sobar upore, rajar moto bosun!",
  videoTutorialHeader: "Shob parbo bhabe bose theko na, ektukhani tutorial dekhe ashbe?",
  videoPanelSubtitle: "Dui minit video, baki jiboner jonno kaj shikhe nao!",
  dailyTip: "Ajker tippony: Chat-e ghumash na, kaj shesh kore baki ghumum.",
  dashboardAlert: "Arey moshay! Check-in kore coins nibe na? Koshto kore kamaiben!",
  taskAvailable: "Arey moshay! Kaj apnar jonno opekkha korche, ektu haat chalao!",
  watchTutorial: "Shob parbo bhabe bose theko na, bolo to ektukhani tutorial ta dekhe ashbe?",
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
          copy[jsKey] = (dbRow as Record<string, string>)[dbKey] || STATIC_FALLBACKS[jsKey];
        }
      } else {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-ui-copy`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        });
        if (res.ok) {
          const data = await res.json();
          for (const [jsKey, dbKey] of Object.entries(DB_FIELD_MAP)) {
            copy[jsKey] = (data as Record<string, string>)[dbKey] || STATIC_FALLBACKS[jsKey];
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

const STATIC_PROMO_COPY = {
  promoExpired: [
    'Khelar shomoy shesh, mama! Promo code er moyad paren hoye gese!',
    'Arey ostad, bas chere diche! Eto derite aile kaj hoy? Moyad shesh!',
    'Deadline shesh mama! Time moto na aile bonus ki batase ure jabe?',
  ],
  promoUsed: [
    'Arey ostad! Eita to ami agei mere disi! Ek maghe ki ar shito jay?',
    'Eki gase barbar it marele am por na mama! Already neso!',
    'Lover ekta sima ache mama! Ekbar bonus paiso na? Abart try maro keno?',
  ],
  promoInvalid: [
    'Vul code bosaiya fakira chal dio na ostad! Thik code ta valo kore dekhao!',
    'Arey mama, eita to khamir moto fule uth na! Thik code dao!',
    'Ekkere vul code diso? Choshma pore abar dekhao ostad!',
  ],
  promoSuccess: [
    'Sabash ostad! Kella fate! Account e bonus coin dhuke gese, ekhon party dao!',
    'Bah bah! Mamar bhagyo aj chomotkar! Bonus coin ashe gese — party!',
    'Kella fate ostad! Poket bhari holo, ekhon ektu jomji khao!',
  ],
  promoLimit: [
    'Khelar shomoy shesh, mama! Moyad pare gese. Poribar ekta fast hote hobe!',
    'Sit full mama! Sob ticket beche gese! Poribar age aso!',
    'Deri korle hoy mama! Stock shesh! Next time fast ho!',
  ],
  promoInactive: [
    'Ei promo code ta ekhon ghumache mama! Pore abart try koro!',
    'Code ta ekhon break nicche ostad! Ektu pore asho!',
    'Ei promo ekhon off mama! Chalu hole ami dak dimu!',
  ],
  promotionSuccess: [
    'Kaj promote hoye gese mama! Tomar kaj sobar chokhe porbe!',
    'Boost mara kamal ostad! Ekhn tomar kaj ekdom tope thakbe!',
    'Promotion successful! Kaj pin kora — sobai dekhbe aga aga!',
  ],
  promotionEmpty: [
    'Promote kora kaj nai ekhon! Tomar kaj promote koro, sobar upore thako!',
    'Keu ekhono boost mare nai! Prothom how mama, kaj promote koro!',
    'Promoted kaj faka! Taratari nije kaj boost koro!',
  ],
  notEnoughPromoCoins: [
    'Promotion er jonno coin kom mama! Ektu kamaw koro, tarpor boost maro!',
    'Coin kom ache ostad! Promotion er age poket bhari koro!',
    'Promote korte gele coin lage mama! Age kichu kaj koro!',
  ],
  errorGeneric: [
    'Arey mama, eibar ektu jhamela hoise! Ektu pore abart try koro!',
    'Kichu ekta golmal hoise ostad! Refresh diya abar dekho!',
    'Net ektu mond mama! Cha khaiya asho, totkhane thik hoibo!',
  ],
  taskEditSuccess: [
    'Kaj edit hoye gese mama! Ekhn sob thikthak, chaliye dao!',
    'Edit kamal ostad! Kaj ta ekhon jhakkas!',
    'Hushiar! Kaj update hoise, ekhon ready ho!',
  ],
};

function randomPick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const microcopy = {
  promoExpired: () => randomPick(STATIC_PROMO_COPY.promoExpired),
  promoUsed: () => randomPick(STATIC_PROMO_COPY.promoUsed),
  promoInvalid: () => randomPick(STATIC_PROMO_COPY.promoInvalid),
  promoSuccess: () => randomPick(STATIC_PROMO_COPY.promoSuccess),
  promoLimit: () => randomPick(STATIC_PROMO_COPY.promoLimit),
  promoInactive: () => randomPick(STATIC_PROMO_COPY.promoInactive),
  tasksHeader: () => currentCopy.tasksHeader ?? STATIC_FALLBACKS.tasksHeader,
  tasksCounter: (n: number) => `${n} ${currentCopy.taskAvailable ?? STATIC_FALLBACKS.taskAvailable}`,
  categoryEmpty: () => currentCopy.categoryEmpty ?? STATIC_FALLBACKS.categoryEmpty,
  loadingTasks: () => currentCopy.loadingTasks ?? STATIC_FALLBACKS.loadingTasks,
  errorGeneric: () => randomPick(STATIC_PROMO_COPY.errorGeneric),
  taskEditSuccess: () => randomPick(STATIC_PROMO_COPY.taskEditSuccess),
  yourTasksFirst: () => currentCopy.yourTasksFirst ?? STATIC_FALLBACKS.yourTasksFirst,
  videoTutorialHeader: () => currentCopy.videoTutorialHeader ?? STATIC_FALLBACKS.videoTutorialHeader,
  videoPanelSubtitle: () => currentCopy.videoPanelSubtitle ?? STATIC_FALLBACKS.videoPanelSubtitle,
  promotionSuccess: () => randomPick(STATIC_PROMO_COPY.promotionSuccess),
  promotionEmpty: () => randomPick(STATIC_PROMO_COPY.promotionEmpty),
  notEnoughPromoCoins: () => randomPick(STATIC_PROMO_COPY.notEnoughPromoCoins),
  dailyTip: () => currentCopy.dailyTip ?? STATIC_FALLBACKS.dailyTip,
  dashboardAlert: () => currentCopy.dashboardAlert ?? STATIC_FALLBACKS.dashboardAlert,
  watchTutorial: () => currentCopy.watchTutorial ?? STATIC_FALLBACKS.watchTutorial,
};

export { fetchDailyCopy };
export type { CopyKey };
