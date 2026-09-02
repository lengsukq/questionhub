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
const LEGACY_DEFAULT_BANK_ID = "default";

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
        // 首个导入的作为默认题库（isDefault=true），其余为普通题库
        const isFirstDefault = existing.length === 0 && entry === manifest[0];
        // 保留原有逻辑：首题库用 default id 以兼容“默认题库”选中
        const result = isFirstDefault
          ? await importQuestionBank(raw, entry.name, LEGACY_DEFAULT_BANK_ID)
          : await importQuestionBank(raw, entry.name);
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

async function migrateLegacyDefaultIfNeeded(): Promise<void> {
  const legacy = await db.banks.get(LEGACY_DEFAULT_BANK_ID);
  if (!legacy) return;
  // 旧版默认题库为"中级轻二"，需移除并清理孤儿数据，9套押题将作为新默认
  const isLegacyQingEr = legacy.name.includes("轻二") || legacy.name.includes("中级轻二");
  if (!isLegacyQingEr) return;
  try {
    await db.transaction("rw", [db.banks, db.questions, db.attempts, db.questionStats, db.sessions], async () => {
      await db.banks.delete(LEGACY_DEFAULT_BANK_ID);
      await db.questions.where("bankId").equals(LEGACY_DEFAULT_BANK_ID).delete();
      await db.attempts.where("bankId").equals(LEGACY_DEFAULT_BANK_ID).delete();
      await db.questionStats.where("bankId").equals(LEGACY_DEFAULT_BANK_ID).delete();
      const sessions = await db.sessions.where("bankId").equals(LEGACY_DEFAULT_BANK_ID).toArray();
      if (sessions.length > 0) await db.sessions.bulkDelete(sessions.map((s) => s.id));
    });
    const active = localStorage.getItem(ACTIVE_BANK_KEY);
    if (active === LEGACY_DEFAULT_BANK_ID) localStorage.removeItem(ACTIVE_BANK_KEY);
    console.info("[migrate] 已移除旧默认题库（中级轻二），将由9套押题接管默认");
  } catch (e) {
    console.warn("[migrate] 旧默认题库清理失败:", e);
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
      // 已有用户的旧 default（中级轻二）自动迁移：先清理再导入新默认
      await migrateLegacyDefaultIfNeeded();

      let banks = await listBanks();

      // 首次启动（空库）：直接导入9套押题，首套作为 default
      if (banks.length === 0) {
        await autoImportBanks();
        banks = await listBanks();
        // 若 manifest 仍为空或加载失败，回退到旧 question-bank.json（兼容极端情况）
        if (banks.length === 0) {
          try {
            const response = await fetch("/data/question-bank.json");
            if (response.ok) {
              const rawJson = await response.text();
              const result = await importQuestionBank(rawJson, "2026 中级轻二题库", LEGACY_DEFAULT_BANK_ID);
              if (!result.ok) throw new Error(result.errors.join("；") || "内置题库导入失败");
              banks = await listBanks();
            }
          } catch {
            // 忽略回退失败，交由下方 activeBank 逻辑与错误态处理
          }
        }
      } else {
        // 非空库：仍尝试补齐 manifest 中的题库（幂等）
        await autoImportBanks();
        banks = await listBanks();
      }

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
