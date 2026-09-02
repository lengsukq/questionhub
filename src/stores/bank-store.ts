import { create } from "zustand";
import { db, listBanks } from "@/lib/db";
import { importQuestionBank, type ImportResult } from "@/lib/import-question-bank";

const ACTIVE_BANK_KEY = "questionhub.activeBankId";
const AUTO_BANKS_VERSION_KEY = "questionhub.autoBanksVersion";

// 与 public/data/banks/manifest.json 保持一致
interface BanksManifestEntry {
  file: string;
  name: string;
}
const AUTO_BANKS_VERSION = "2026-mayong-9banks-v1";

async function autoImportBanks(): Promise<void> {
  try {
    const res = await fetch("/data/banks/manifest.json");
    if (!res.ok) return;
    const manifest: BanksManifestEntry[] = await res.json();
    if (!Array.isArray(manifest) || manifest.length === 0) return;

    const doneVersion = localStorage.getItem(AUTO_BANKS_VERSION_KEY);
    if (doneVersion === AUTO_BANKS_VERSION) return;

    const existing = await listBanks();
    const existingNames = new Set(existing.map((b) => b.name));

    for (const entry of manifest) {
      if (existingNames.has(entry.name)) continue;
      try {
        const r = await fetch(`/data/banks/${encodeURIComponent(entry.file)}`);
        if (!r.ok) continue;
        const raw = await r.text();
        const result = await importQuestionBank(raw, entry.name);
        if (!result.ok) {
          console.warn(`[autoImport] ${entry.name} 导入失败:`, result.errors);
        }
      } catch (e) {
        console.warn(`[autoImport] ${entry.name} 导入异常:`, e);
      }
    }

    localStorage.setItem(AUTO_BANKS_VERSION_KEY, AUTO_BANKS_VERSION);
  } catch (e) {
    console.warn("[autoImport] manifest 加载失败:", e);
  }
}

interface BankState {
  banks: Awaited<ReturnType<typeof listBanks>>;
  activeBankId: string | null;
  ready: boolean;
  loading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  refreshBanks: () => Promise<void>;
  importBank: (rawJson: string, name: string) => Promise<ImportResult>;
  setActiveBank: (bankId: string) => void;
  removeBank: (bankId: string) => Promise<void>;
}

export const useBankStore = create<BankState>((set, get) => ({
  banks: [],
  activeBankId: null,
  ready: false,
  loading: false,
  error: null,

  initialize: async () => {
    if (get().ready) return;
    set({ loading: true, error: null });

    try {
      let banks = await listBanks();

      if (banks.length === 0) {
        // 首次启动：从静态资源加载内置默认题库
        const response = await fetch("/data/question-bank.json");
        if (!response.ok) {
          throw new Error(`内置题库加载失败（HTTP ${response.status}）`);
        }
        const rawJson = await response.text();
        const result = await importQuestionBank(rawJson, "2026 中级轻二题库", "default");
        if (!result.ok) {
          throw new Error(result.errors.join("；") || "内置题库导入失败");
        }
        banks = await listBanks();
      }

      // 自动导入 data/banks 下的随版题库（如 9套马勇押题），幂等且以 name 去重
      await autoImportBanks();
      banks = await listBanks();

      let activeBankId = localStorage.getItem(ACTIVE_BANK_KEY);
      if (!activeBankId || !banks.some((bank) => bank.id === activeBankId)) {
        const defaultBank = banks.find((bank) => bank.isDefault) ?? banks[0];
        activeBankId = defaultBank?.id ?? null;
        if (activeBankId) localStorage.setItem(ACTIVE_BANK_KEY, activeBankId);
      }

      set({ banks, activeBankId, ready: true, loading: false });
    } catch (error) {
      set({
        ready: true,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  refreshBanks: async () => {
    const banks = await listBanks();
    const activeBankId = get().activeBankId;
    if (activeBankId && !banks.some((bank) => bank.id === activeBankId)) {
      set({ banks, activeBankId: null });
      localStorage.removeItem(ACTIVE_BANK_KEY);
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

  setActiveBank: (bankId) => {
    localStorage.setItem(ACTIVE_BANK_KEY, bankId);
    set({ activeBankId: bankId });
  },

  removeBank: async (bankId) => {
    const bank = get().banks.find((item) => item.id === bankId);
    if (bank?.isDefault) {
      throw new Error("内置默认题库不可删除");
    }
    await db.transaction("rw", [db.banks, db.questions], async () => {
      await db.banks.delete(bankId);
      await db.questions.where("bankId").equals(bankId).delete();
    });
    await get().refreshBanks();
  },
}));
