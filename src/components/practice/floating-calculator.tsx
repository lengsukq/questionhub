"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Delete, GripVertical, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingCalculatorProps {
  open: boolean;
  onClose: () => void;
}

type CalcMode = "standard" | "scientific";
type CalcSize = "compact" | "medium" | "large";
type Operator = "＋" | "－" | "×" | "÷" | "^";

const OPERATOR_MAP: Record<Operator, string> = {
  "＋": "+",
  "－": "-",
  "×": "×",
  "÷": "÷",
  "^": "^",
};

const STANDARD_WIDTH = 280;
const SCIENTIFIC_WIDTH = 320;
const MODE_STORAGE_KEY = "qh-calc-mode";
const SIZE_STORAGE_KEY = "qh-calc-size";

const SIZE_SCALE: Record<CalcSize, number> = {
  compact: 0.9,
  medium: 1,
  large: 1.12,
};

const SIZE_LABEL: Record<CalcSize, string> = {
  compact: "小",
  medium: "中",
  large: "大",
};

const SIZE_ORDER: CalcSize[] = ["compact", "medium", "large"];

/** 安全二元运算：规避浮点误差与 eval 注入 */
function compute(a: number, b: number, op: Operator): number | null {
  switch (op) {
    case "＋":
      return a + b;
    case "－":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      if (b === 0) return null;
      return a / b;
    case "^":
      return Math.pow(a, b);
  }
}

function formatResult(value: number): string {
  if (!Number.isFinite(value)) return "错误";
  const rounded = Number(value.toPrecision(10));
  let text = String(rounded);
  if (text.length > 12) text = rounded.toExponential(6).replace("e", "E");
  return text;
}

function formatOperand(text: string): string {
  if (text === "" || text === "-") return "0";
  if (text === "错误") return text;
  const num = Number(text);
  if (!Number.isFinite(num)) return text;
  return Number(num.toPrecision(10)).toLocaleString("zh-CN", {
    maximumFractionDigits: 8,
  });
}

function factorial(value: number): number | null {
  if (!Number.isInteger(value) || value < 0 || value > 170) return null;
  let result = 1;
  for (let i = 2; i <= value; i += 1) result *= i;
  return result;
}

function loadMode(): CalcMode {
  try {
    return window.localStorage.getItem(MODE_STORAGE_KEY) === "scientific"
      ? "scientific"
      : "standard";
  } catch {
    return "standard";
  }
}

function loadCalcSize(): CalcSize {
  try {
    const saved = window.localStorage.getItem(SIZE_STORAGE_KEY);
    return saved === "compact" || saved === "medium" || saved === "large"
      ? saved
      : "medium";
  } catch {
    return "medium";
  }
}

export function FloatingCalculator({ open, onClose }: FloatingCalculatorProps) {
  const [current, setCurrent] = useState("");
  const [previous, setPrevious] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [lastExpression, setLastExpression] = useState("");
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [mode, setMode] = useState<CalcMode>(loadMode);
  const [calcSize, setCalcSize] = useState<CalcSize>(loadCalcSize);
  const [angleMode, setAngleMode] = useState<"deg" | "rad">("deg");
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null,
  );

  const panelRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
    lastX: number;
    lastY: number;
    rafId: number | null;
  } | null>(null);

  const baseWidth = mode === "scientific" ? SCIENTIFIC_WIDTH : STANDARD_WIDTH;
  const panelWidth = Math.round(baseWidth * SIZE_SCALE[calcSize]);
  const keyScale = SIZE_SCALE[calcSize];

  // 首次打开时定位到右下角（底部操作栏上方），避开题目正文
  const positionInitRef = useRef(false);
  useEffect(() => {
    if (!open) {
      positionInitRef.current = false;
      return;
    }
    if (positionInitRef.current) return;
    positionInitRef.current = true;
    const left = Math.max(8, window.innerWidth - panelWidth - 16);
    const top = Math.max(80, window.innerHeight - 430);
    queueMicrotask(() => setPosition({ left, top }));
  }, [open, panelWidth]);

  // 切换模式后把面板收敛回可视区内
  const clampPosition = useCallback(
    (nextMode: CalcMode, nextSize: CalcSize) => {
      const nextWidth = Math.round(
        (nextMode === "scientific" ? SCIENTIFIC_WIDTH : STANDARD_WIDTH) *
          SIZE_SCALE[nextSize],
      );
      setPosition((prev) =>
        prev
          ? {
              left: Math.min(Math.max(8, prev.left), Math.max(8, window.innerWidth - nextWidth - 8)),
              top: prev.top,
            }
          : prev,
      );
    },
    [],
  );

  // 切换模式后把面板收敛回可视区内
  const switchMode = useCallback(
    (next: CalcMode) => {
      setMode(next);
      try {
        window.localStorage.setItem(MODE_STORAGE_KEY, next);
      } catch {
        // 隐私模式下忽略持久化失败
      }
      clampPosition(next, calcSize);
    },
    [calcSize, clampPosition],
  );

  const switchSize = useCallback(
    (next: CalcSize) => {
      setCalcSize(next);
      try {
        window.localStorage.setItem(SIZE_STORAGE_KEY, next);
      } catch {
        // 隐私模式下忽略持久化失败
      }
      clampPosition(mode, next);
    },
    [mode, clampPosition],
  );

  const inputDigit = useCallback(
    (digit: string) => {
      setLastExpression("");
      if (current === "错误" || justEvaluated) {
        setCurrent(digit === "." ? "0." : digit);
        setJustEvaluated(false);
        return;
      }
      if (digit === "." && current.includes(".")) return;
      if (current.replace(/[-.]/g, "").length >= 10) return;
      if (current === "0" && digit !== ".") {
        setCurrent(digit);
        return;
      }
      if (current === "-0" && digit !== ".") {
        setCurrent(`-${digit}`);
        return;
      }
      setCurrent((prev) => (prev === "" && digit === "." ? "0." : `${prev}${digit}`));
    },
    [current, justEvaluated],
  );

  const inputOperator = useCallback(
    (nextOp: Operator) => {
      if (current === "错误") return;
      const currentValue = current === "" || current === "-" ? null : Number(current);
      if (previous !== null && operator && currentValue !== null && !justEvaluated) {
        const result = compute(previous, currentValue, operator);
        if (result === null || !Number.isFinite(result)) {
          setCurrent("错误");
          setPrevious(null);
          setOperator(null);
          setJustEvaluated(true);
          return;
        }
        setPrevious(result);
        setCurrent("");
        setOperator(nextOp);
        setJustEvaluated(false);
        return;
      }
      if (currentValue !== null) {
        setPrevious(currentValue);
        setCurrent("");
      } else if (previous === null) {
        setPrevious(0);
      }
      setOperator(nextOp);
      setJustEvaluated(false);
      setLastExpression("");
    },
    [current, previous, operator, justEvaluated],
  );

  const evaluate = useCallback(() => {
    if (current === "错误") return;
    if (previous === null || !operator) return;
    const currentValue = current === "" || current === "-" ? previous : Number(current);
    const result = compute(previous, currentValue, operator);
    if (result === null || !Number.isFinite(result)) {
      setLastExpression(`${formatOperand(String(previous))} ${OPERATOR_MAP[operator]} ${formatOperand(current)} =`);
      setCurrent("错误");
      setPrevious(null);
      setOperator(null);
      setJustEvaluated(true);
      return;
    }
    const text = formatResult(result);
    setLastExpression(
      `${formatOperand(String(previous))} ${OPERATOR_MAP[operator]} ${formatOperand(String(currentValue))} =`,
    );
    setCurrent(text);
    setPrevious(null);
    setOperator(null);
    setJustEvaluated(true);
  }, [current, previous, operator]);

  const clearAll = useCallback(() => {
    setCurrent("");
    setPrevious(null);
    setOperator(null);
    setLastExpression("");
    setJustEvaluated(false);
  }, []);

  const backspace = useCallback(() => {
    if (justEvaluated) {
      clearAll();
      return;
    }
    if (current === "错误") {
      clearAll();
      return;
    }
    setCurrent((prev) => prev.slice(0, -1));
  }, [justEvaluated, current, clearAll]);

  const negate = useCallback(() => {
    if (current === "" || current === "错误") return;
    setCurrent((prev) => (prev.startsWith("-") ? prev.slice(1) : `-${prev}`));
    setJustEvaluated(false);
  }, [current]);

  const percent = useCallback(() => {
    if (current === "" || current === "错误") return;
    const value = Number(current);
    if (!Number.isFinite(value)) return;
    setCurrent(formatResult(value / 100));
    setJustEvaluated(true);
  }, [current]);

  // 科学函数：作用于当前输入（无输入时作用于显示值），保留未完成的二元运算
  const applyUnary = useCallback(
    (fn: (value: number) => number | null, label: (operand: string) => string) => {
      if (current === "错误") return;
      const hasEntry = current !== "" && current !== "-";
      const base = hasEntry ? Number(current) : (previous ?? 0);
      if (!Number.isFinite(base)) return;
      const operandLabel = formatOperand(String(base));
      const result = fn(base);
      if (result === null || !Number.isFinite(result)) {
        setLastExpression(`${label(operandLabel)} =`);
        if (hasEntry) {
          setCurrent("错误");
        } else {
          setPrevious(null);
          setOperator(null);
          setCurrent("错误");
        }
        setJustEvaluated(true);
        return;
      }
      const text = formatResult(result);
      setLastExpression(`${label(operandLabel)} =`);
      if (hasEntry) {
        setCurrent(text);
      } else {
        setPrevious(result);
      }
      setJustEvaluated(true);
    },
    [current, previous],
  );

  const inputConstant = useCallback(
    (value: number) => {
      setLastExpression("");
      setCurrent(formatResult(value));
      setJustEvaluated(false);
    },
    [],
  );

  const degreeSuffix = angleMode === "deg" ? "°" : "";
  const toRadians = useCallback(
    (value: number) => (angleMode === "deg" ? (value * Math.PI) / 180 : value),
    [angleMode],
  );
  const snapZero = (value: number) => (Math.abs(value) < 1e-12 ? 0 : value);

  const applySine = useCallback(
    () => applyUnary((v) => snapZero(Math.sin(toRadians(v))), (o) => `sin(${o}${degreeSuffix})`),
    [applyUnary, toRadians, degreeSuffix],
  );
  const applyCosine = useCallback(
    () => applyUnary((v) => snapZero(Math.cos(toRadians(v))), (o) => `cos(${o}${degreeSuffix})`),
    [applyUnary, toRadians, degreeSuffix],
  );
  const applyTangent = useCallback(
    () => applyUnary((v) => snapZero(Math.tan(toRadians(v))), (o) => `tan(${o}${degreeSuffix})`),
    [applyUnary, toRadians, degreeSuffix],
  );
  const applyLn = useCallback(
    () => applyUnary((v) => (v <= 0 ? null : Math.log(v)), (o) => `ln(${o})`),
    [applyUnary],
  );
  const applyLog = useCallback(
    () => applyUnary((v) => (v <= 0 ? null : Math.log10(v)), (o) => `log(${o})`),
    [applyUnary],
  );
  const applySqrt = useCallback(
    () => applyUnary((v) => (v < 0 ? null : Math.sqrt(v)), (o) => `√(${o})`),
    [applyUnary],
  );
  const applySquare = useCallback(
    () => applyUnary((v) => v * v, (o) => `(${o})²`),
    [applyUnary],
  );
  const applyReciprocal = useCallback(
    () => applyUnary((v) => (v === 0 ? null : 1 / v), (o) => `1/(${o})`),
    [applyUnary],
  );
  const applyFactorial = useCallback(
    () => applyUnary(factorial, (o) => `(${o})!`),
    [applyUnary],
  );
  const applyPow10 = useCallback(
    () => applyUnary((v) => Math.pow(10, v), (o) => `10^(${o})`),
    [applyUnary],
  );
  const applyExp = useCallback(
    () => applyUnary((v) => Math.exp(v), (o) => `e^(${o})`),
    [applyUnary],
  );

  // 物理键盘直输：打开时接管数字与运算符，练习快捷键在外层同步停用
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      if (/^[0-9.]$/.test(event.key)) {
        event.preventDefault();
        inputDigit(event.key);
      } else if (event.key === "+" || event.key === "＋") {
        event.preventDefault();
        inputOperator("＋");
      } else if (event.key === "-") {
        event.preventDefault();
        inputOperator("－");
      } else if (event.key === "*" || event.key === "×") {
        event.preventDefault();
        inputOperator("×");
      } else if (event.key === "/" || event.key === "÷") {
        event.preventDefault();
        inputOperator("÷");
      } else if (event.key === "^" && mode === "scientific") {
        event.preventDefault();
        inputOperator("^");
      } else if (event.key === "!" && mode === "scientific") {
        event.preventDefault();
        applyFactorial();
      } else if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        evaluate();
      } else if (event.key === "Backspace") {
        event.preventDefault();
        backspace();
      } else if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, mode, inputDigit, inputOperator, evaluate, backspace, applyFactorial, onClose]);

  // 丝滑拖拽：pointermove 只记录坐标，rAF 节流后统一写一次位置，避免高频 setState 卡顿
  const cancelDragFrame = () => {
    const drag = dragState.current;
    if (drag?.rafId != null) cancelAnimationFrame(drag.rafId);
    if (drag) drag.rafId = null;
  };

  useEffect(
    () => () => {
      cancelDragFrame();
      dragState.current = null;
    },
    [],
  );

  const applyDragPosition = (clientX: number, clientY: number) => {
    const drag = dragState.current;
    if (!drag) return;
    drag.rafId = null;
    const panelHeight = panelRef.current?.offsetHeight ?? 400;
    const nextLeft = Math.min(
      Math.max(8, drag.originLeft + clientX - drag.startX),
      Math.max(8, window.innerWidth - panelWidth - 8),
    );
    const nextTop = Math.min(
      Math.max(64, drag.originTop + clientY - drag.startY),
      Math.max(64, window.innerHeight - panelHeight - 96),
    );
    if (nextLeft !== drag.lastX || nextTop !== drag.lastY) {
      drag.lastX = nextLeft;
      drag.lastY = nextTop;
      setPosition({ left: nextLeft, top: nextTop });
    }
  };

  const handleDragStart = (pointerId: number, clientX: number, clientY: number) => {
    if (!position) return;
    cancelDragFrame();
    dragState.current = {
      pointerId,
      startX: clientX,
      startY: clientY,
      originLeft: position.left,
      originTop: position.top,
      lastX: position.left,
      lastY: position.top,
      rafId: null,
    };
  };

  const handleDragMove = (pointerId: number, clientX: number, clientY: number) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== pointerId) return;
    if (drag.rafId != null) return;
    drag.rafId = requestAnimationFrame(() => applyDragPosition(clientX, clientY));
  };

  const handleDragEnd = (pointerId: number) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== pointerId) return;
    cancelDragFrame();
    dragState.current = null;
  };

  if (!open) return null;

  const expression =
    lastExpression ||
    (previous !== null && operator
      ? `${formatOperand(String(previous))} ${OPERATOR_MAP[operator]} ${current ? formatOperand(current) : ""}`
      : "");
  const display = current === "" ? (previous !== null ? formatOperand(String(previous)) : "0") : formatOperand(current);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="浮动计算器"
      className={cn(
        "fixed z-40 rounded-[24px] border shadow-2xl animate-fade-in-up bg-white/40 backdrop-blur-md dark:bg-[#12141d]/40",
        "border-white/60 shadow-black/10 dark:border-white/10 dark:shadow-black/50",
      )}
      style={{ width: panelWidth, ...(position ? { left: position.left, top: position.top } : undefined) }}
    >
      {/* 拖拽标题栏 */}
      <div
        className="flex cursor-grab touch-none items-center gap-1 px-3 pt-3 pb-1 select-none active:cursor-grabbing"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          handleDragStart(e.pointerId, e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0) handleDragMove(e.pointerId, e.clientX, e.clientY);
        }}
        onPointerUp={(e) => handleDragEnd(e.pointerId)}
        onPointerCancel={(e) => handleDragEnd(e.pointerId)}
      >
        <GripVertical className="h-4 w-4 shrink-0 text-ios-label-tertiary" />
        <span className="text-[12px] font-bold text-ios-label-secondary">计算器 · 可拖动</span>
        <div className="flex-1" />
        {/* 大小切换：小 / 中 / 大循环 */}
        <button
          type="button"
          onClick={() =>
            switchSize(SIZE_ORDER[(SIZE_ORDER.indexOf(calcSize) + 1) % SIZE_ORDER.length])
          }
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`切换计算器大小，当前${SIZE_LABEL[calcSize]}`}
          title={`大小：${SIZE_LABEL[calcSize]}（点击切换）`}
          className="flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[12px] font-bold text-ios-label-secondary transition-colors hover:bg-black/5 hover:text-ios-label dark:hover:bg-white/10"
        >
          {SIZE_LABEL[calcSize]}
        </button>
        <button
          type="button"
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="关闭计算器"
          className="flex h-7 w-7 items-center justify-center rounded-full text-ios-label-secondary transition-colors hover:bg-black/5 hover:text-ios-label dark:hover:bg-white/10"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 显示区 */}
      <div className="px-4 pb-2">
        <div className="min-h-[18px] truncate text-right text-[12px] tabular-nums text-ios-label-tertiary">
          {expression || " "}
        </div>
        <div
          className="truncate text-right leading-tight font-bold tabular-nums text-ios-label"
          style={{ fontSize: `${Math.round(32 * keyScale)}px` }}
        >
          {display}
        </div>
      </div>

      {/* 普通 / 科学模式切换 */}
      <div className="mx-3 mb-2 grid grid-cols-2 gap-1 rounded-2xl bg-black/[0.04] p-1 dark:bg-white/10">
        {(
          [
            { key: "standard", label: "普通" },
            { key: "scientific", label: "科学" },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => switchMode(item.key)}
            aria-pressed={mode === item.key}
            className={cn(
              "h-8 rounded-xl text-[13px] font-bold transition-all",
              mode === item.key
                ? "bg-white text-ios-label shadow-sm dark:bg-white/20 dark:text-white"
                : "text-ios-label-secondary hover:text-ios-label",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 科学函数区 */}
      {mode === "scientific" && (
        <div className="grid grid-cols-5 gap-1.5 px-3 pb-1.5">
          <CalcButton
            tone="scientific"
            sizeScale={keyScale}
            onClick={() => setAngleMode((prev) => (prev === "deg" ? "rad" : "deg"))}
            label={angleMode === "deg" ? "DEG" : "RAD"}
            ariaLabel="切换角度单位"
          />
          <CalcButton tone="scientific" sizeScale={keyScale} onClick={applySine} label="sin" ariaLabel="正弦" />
          <CalcButton tone="scientific" sizeScale={keyScale} onClick={applyCosine} label="cos" ariaLabel="余弦" />
          <CalcButton tone="scientific" sizeScale={keyScale} onClick={applyTangent} label="tan" ariaLabel="正切" />
          <CalcButton tone="scientific" sizeScale={keyScale} onClick={applyLn} label="ln" ariaLabel="自然对数" />

          <CalcButton tone="scientific" sizeScale={keyScale} onClick={applyLog} label="log" ariaLabel="常用对数" />
          <CalcButton tone="scientific" sizeScale={keyScale} onClick={applySqrt} label="√" ariaLabel="平方根" />
          <CalcButton tone="scientific" sizeScale={keyScale} onClick={applySquare} label="x²" ariaLabel="平方" />
          <CalcButton
            tone="scientific"
            sizeScale={keyScale}
            active={operator === "^" && current === ""}
            onClick={() => inputOperator("^")}
            label="xʸ"
            ariaLabel="幂"
          />
          <CalcButton tone="scientific" sizeScale={keyScale} onClick={applyReciprocal} label="1/x" ariaLabel="倒数" />

          <CalcButton tone="scientific" sizeScale={keyScale} onClick={() => inputConstant(Math.PI)} label="π" ariaLabel="圆周率" />
          <CalcButton tone="scientific" sizeScale={keyScale} onClick={() => inputConstant(Math.E)} label="e" ariaLabel="自然常数" />
          <CalcButton tone="scientific" sizeScale={keyScale} onClick={applyFactorial} label="n!" ariaLabel="阶乘" />
          <CalcButton tone="scientific" sizeScale={keyScale} onClick={applyPow10} label="10ˣ" ariaLabel="十的幂" />
          <CalcButton tone="scientific" sizeScale={keyScale} onClick={applyExp} label="eˣ" ariaLabel="指数函数" />
        </div>
      )}

      {/* 按键区 */}
      <div className="grid grid-cols-4 gap-1.5 px-3 pb-3.5" style={{ fontSize: `${16 * keyScale}px` }}>
        <CalcButton tone="utility" sizeScale={keyScale} onClick={clearAll} label="C" ariaLabel="清空" />
        <CalcButton tone="utility" sizeScale={keyScale} onClick={negate} label="±" ariaLabel="正负切换" />
        <CalcButton tone="utility" sizeScale={keyScale} onClick={percent} label="%" ariaLabel="百分号" />
        <CalcButton tone="operator" sizeScale={keyScale} active={operator === "÷" && current === ""} onClick={() => inputOperator("÷")} label="÷" ariaLabel="除以" />

        <CalcButton sizeScale={keyScale} onClick={() => inputDigit("7")} label="7" ariaLabel="数字7" />
        <CalcButton sizeScale={keyScale} onClick={() => inputDigit("8")} label="8" ariaLabel="数字8" />
        <CalcButton sizeScale={keyScale} onClick={() => inputDigit("9")} label="9" ariaLabel="数字9" />
        <CalcButton tone="operator" sizeScale={keyScale} active={operator === "×" && current === ""} onClick={() => inputOperator("×")} label="×" ariaLabel="乘以" />

        <CalcButton sizeScale={keyScale} onClick={() => inputDigit("4")} label="4" ariaLabel="数字4" />
        <CalcButton sizeScale={keyScale} onClick={() => inputDigit("5")} label="5" ariaLabel="数字5" />
        <CalcButton sizeScale={keyScale} onClick={() => inputDigit("6")} label="6" ariaLabel="数字6" />
        <CalcButton tone="operator" sizeScale={keyScale} active={operator === "－" && current === ""} onClick={() => inputOperator("－")} label="－" ariaLabel="减去" />

        <CalcButton sizeScale={keyScale} onClick={() => inputDigit("1")} label="1" ariaLabel="数字1" />
        <CalcButton sizeScale={keyScale} onClick={() => inputDigit("2")} label="2" ariaLabel="数字2" />
        <CalcButton sizeScale={keyScale} onClick={() => inputDigit("3")} label="3" ariaLabel="数字3" />
        <CalcButton tone="operator" sizeScale={keyScale} active={operator === "＋" && current === ""} onClick={() => inputOperator("＋")} label="＋" ariaLabel="加" />

        <CalcButton sizeScale={keyScale} onClick={() => inputDigit("0")} label="0" ariaLabel="数字0" />
        <CalcButton sizeScale={keyScale} onClick={() => inputDigit(".")} label="." ariaLabel="小数点" />
        <CalcButton sizeScale={keyScale} onClick={backspace} label={<Delete style={{ width: 20 * keyScale, height: 20 * keyScale }} />} ariaLabel="退格" />
        <CalcButton tone="equals" sizeScale={keyScale} onClick={evaluate} label="=" ariaLabel="等于" />
      </div>
    </div>
  );
}

function buttonSizeStyle(sizeScale: number): CSSProperties {
  return { height: `${Math.round(44 * sizeScale)}px`, fontSize: "1.125em" };
}

function scientificButtonStyle(sizeScale: number): CSSProperties {
  return { height: `${Math.round(40 * sizeScale)}px`, fontSize: `${Math.round(13 * sizeScale)}px` };
}

function CalcButton({
  label,
  onClick,
  ariaLabel,
  tone = "digit",
  active = false,
  sizeScale = 1,
}: {
  label: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
  tone?: "digit" | "utility" | "operator" | "equals" | "scientific";
  active?: boolean;
  sizeScale?: number;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={tone === "scientific" ? scientificButtonStyle(sizeScale) : buttonSizeStyle(sizeScale)}
      className={cn(
        "squircle-press flex items-center justify-center rounded-2xl font-semibold tabular-nums transition-colors",
        tone === "scientific" && "rounded-xl",
        tone === "digit" &&
          "bg-black/[0.04] text-ios-label hover:bg-black/[0.07] dark:bg-white/10 dark:hover:bg-white/15",
        tone === "utility" &&
          "bg-ios-surface-tertiary/80 text-ios-label-secondary hover:text-ios-label dark:bg-white/10",
        tone === "scientific" &&
          (active
            ? "bg-ios-blue text-white shadow-md shadow-ios-blue/30"
            : "bg-ios-surface-tertiary/60 text-ios-label hover:bg-ios-surface-tertiary dark:bg-white/10 dark:hover:bg-white/15"),
        tone === "operator" &&
          (active
            ? "bg-ios-blue text-white shadow-md shadow-ios-blue/30"
            : "bg-ios-blue/12 text-ios-blue hover:bg-ios-blue/20 dark:bg-ios-blue/20"),
        tone === "equals" &&
          "bg-gradient-to-br from-ios-blue to-ios-indigo text-white shadow-md shadow-ios-blue/30 hover:opacity-95",
      )}
    >
      {label}
    </button>
  );
}
