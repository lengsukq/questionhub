import { create } from "zustand";
import { db, listBanks } from "@/lib/db";
import { importQuestionBank, type ImportResult } from "@/lib/import-question-bank";

const ACTIVE_BANK_KEY = "questionhub.activeBankId";
const BUILTIN_MANIFEST_PATH = "/data/banks/manifest.json";
const BUILTIN_FALLBACK_ORIGIN = "https://quest.lengsu.top";

export interface ImportFailure {
  name: string;
  reason: string;
}

export interface BanksManifestEntry {
  file: string;
  name: string;
  questionCount?: number;
  subjects?: Array<{ id: string; name: string; year?: number; exam?: string }>;
  typeCounts?: Record<string, number>;
}

interface BankState {
  banks: Awaited<ReturnType<typeof listBanks>>;
  activeBankId: string | null;
  manifest: BanksManifestEntry[];
  ready: boolean;
  loading: boolean;
  importingAll: boolean;
  importProgress: { current: number; total: number } | null;
  error: string | null;

  initialize: () => Promise<void>;
  loadManifest: () => Promise<BanksManifestEntry[]>;
  refreshBanks: () => Promise<void>;
  importBank: (rawJson: string, name: string) => Promise<ImportResult>;
  importBuiltinBank: (file: string, name: string) => Promise<ImportResult>;
  importAllBuiltinBanks: (
    onProgress?: (current: number, total: number) => void,
  ) => Promise<{ success: number; failed: number; failures: ImportFailure[] }>;
  setActiveBank: (bankId: string) => void;
  removeBank: (bankId: string) => Promise<void>;
  resetForReload: () => void;
}

/**
 * 内置题库下载：本地优先，失败回退远程镜像。
 * 三处调用共用，域名与路径收敛到模块顶部常量。
 */
async function fetchBuiltinFile(path: string): Promise<Response> {
  const local = await fetch(path);
  if (local.ok) return local;
  return fetch(`${BUILTIN_FALLBACK_ORIGIN}${path}`);
}

export const useBankStore = create<BankState>((set, get) => ({
  banks: [],
  activeBankId: null,
  manifest: [],
  ready: false,
  loading: false,
  importingAll: false,
  importProgress: null,
  error: null,

  // 1. 极致轻量初始化：只读取本地数据库已有题库，毫秒级就绪，不阻塞任何下载
  initialize: async () => {
    if (get().ready) return;
    set({ loading: true, error: null });

    try {
      const banks = await listBanks();
      let activeBankId = localStorage.getItem(ACTIVE_BANK_KEY);

      if (!activeBankId || !banks.some((b) => b.id === activeBankId)) {
        activeBankId = banks[0]?.id ?? null;
        if (activeBankId) localStorage.setItem(ACTIVE_BANK_KEY, activeBankId);
      }

      set({ banks, activeBankId, ready: true, loading: false });
    } catch (err) {
      set({
        ready: true,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  // 2. 按需获取系统自带题库清单（失败时透出错误，不再吞成空清单）
  loadManifest: async () => {
    if (get().manifest.length > 0) return get().manifest;

    const res = await fetchBuiltinFile(BUILTIN_MANIFEST_PATH);
    if (!res.ok) {
      throw new Error(`系统题库清单下载失败（${res.status}），请检查网络后重试`);
    }
    const list: BanksManifestEntry[] = await res.json();
    if (!Array.isArray(list)) {
      throw new Error("系统题库清单格式异常，请稍后重试");
    }
    set({ manifest: list });
    return list;
  },

  refreshBanks: async () => {
    const banks = await listBanks();
    const activeBankId = get().activeBankId;
    if (activeBankId && !banks.some((b) => b.id === activeBankId)) {
      const newActive = banks[0]?.id ?? null;
      set({ banks, activeBankId: newActive });
      if (newActive) localStorage.setItem(ACTIVE_BANK_KEY, newActive);
      else localStorage.removeItem(ACTIVE_BANK_KEY);
      return;
    }
    set({ banks });
  },

  importBank: async (rawJson, name) => {
    const result = await importQuestionBank(rawJson, name);
    if (result.ok && result.bank) {
      await get().refreshBanks();
      get().setActiveBank(result.bank.id);
    }
    return result;
  },

  // 3. 导入单个系统自带题库
  importBuiltinBank: async (file, name) => {
    try {
      const response = await fetchBuiltinFile(`/data/banks/${encodeURIComponent(file)}`);
      if (!response.ok) {
        return {
          ok: false,
          errors: [`无法下载题库文件: ${file}`],
          warnings: [],
          questionCount: 0,
          typeCounts: {},
        };
      }
      const raw = await response.text();
      const result = await importQuestionBank(raw, name);
      if (result.ok && result.bank) {
        await get().refreshBanks();
        if (!get().activeBankId) {
          get().setActiveBank(result.bank.id);
        }
      }
      return result;
    } catch (e) {
      return {
        ok: false,
        errors: [e instanceof Error ? e.message : String(e)],
        warnings: [],
        questionCount: 0,
        typeCounts: {},
      };
    }
  },

  // 4. 一键导入所有系统自带题库（带实时进度，失败项携带原因）
  importAllBuiltinBanks: async (onProgress) => {
    const manifest = await get().loadManifest();
    if (manifest.length === 0) return { success: 0, failed: 0, failures: [] };

    set({ importingAll: true, importProgress: { current: 0, total: manifest.length } });

    const existing = await listBanks();
    const existingNames = new Set(existing.map((b) => b.name));

    let success = 0;
    const failures: ImportFailure[] = [];

    for (let i = 0; i < manifest.length; i++) {
      const entry = manifest[i];
      if (onProgress) onProgress(i + 1, manifest.length);
      set({ importProgress: { current: i + 1, total: manifest.length } });

      if (existingNames.has(entry.name)) {
        success++;
        continue;
      }

      try {
        const response = await fetchBuiltinFile(`/data/banks/${encodeURIComponent(entry.file)}`);
        if (!response.ok) {
          failures.push({ name: entry.name, reason: `下载失败（${response.status}）` });
          continue;
        }
        const raw = await response.text();
        const result = await importQuestionBank(raw, entry.name);
        if (result.ok) {
          success++;
        } else {
          failures.push({ name: entry.name, reason: result.errors.join("；") || "导入失败" });
        }
      } catch (error) {
        failures.push({
          name: entry.name,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await get().refreshBanks();
    const currentBanks = get().banks;
    if (!get().activeBankId && currentBanks.length > 0) {
      get().setActiveBank(currentBanks[0].id);
    }

    set({ importingAll: false, importProgress: null });
    return { success, failed: failures.length, failures };
  },

  setActiveBank: (bankId) => {
    localStorage.setItem(ACTIVE_BANK_KEY, bankId);
    set({ activeBankId: bankId });
  },

  resetForReload: () => {
    localStorage.removeItem(ACTIVE_BANK_KEY);
    set({ banks: [], activeBankId: null, ready: false, loading: false, error: null });
  },

  removeBank: async (bankId) => {
    await db.transaction("rw", [db.banks, db.questions, db.attempts, db.questionStats, db.sessions], async () => {
      await db.banks.delete(bankId);
      await db.questions.where("bankId").equals(bankId).delete();
      await db.attempts.where("bankId").equals(bankId).delete();
      await db.questionStats.where("bankId").equals(bankId).delete();
      const sessions = await db.sessions.where("bankId").equals(bankId).toArray();
      if (sessions.length > 0) await db.sessions.bulkDelete(sessions.map((s) => s.id));
    });
    await get().refreshBanks();
  },
}));
