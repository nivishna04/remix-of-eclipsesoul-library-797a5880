import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { askAssistant } from "@/lib/ai.functions";
import { MessageCircle, Send, X, Sparkles, Volume2, VolumeX, History, Trash2 } from "lucide-react";
import lyraPortrait from "@/assets/lyra-portrait.jpg.asset.json";
import orionPortrait from "@/assets/orion-portrait.jpg.asset.json";


type Persona = "lyra" | "orion";
type Msg = { role: "user" | "assistant"; content: string };
type HistoryEntry = { id: string; persona: Persona; prompt: string; at: number };
const HISTORY_KEY = "eclipsesoul.assistant.history.v2";

type AvatarMeta = {
  url: string;
  name: string;
  tag: string;
  intro: string;
  voicePitch: number;
  voiceRate: number;
  aura: string;
  voiceHints: string[];
  female: boolean;
};

const AVATAR: Record<Persona, AvatarMeta> = {
  lyra: {
    url: lyraPortrait.url,
    name: "Lyra",
    tag: "Gentle · Elegant · Kind",
    intro: "Hello. Welcome back to EclipseSoul Library. How may I assist you today?",
    voicePitch: 1.45,
    voiceRate: 0.92,
    aura: "shadow-[0_0_30px_rgba(217,70,239,0.55)]",
    voiceHints: [
      "samantha", "victoria", "karen", "serena", "allison", "ava",
      "google uk english female", "google us english", "zira", "female",
    ],
    female: true,
  },
  orion: {
    url: orionPortrait.url,
    name: "Orion",
    tag: "Calm · Intelligent · Reliable",
    intro: "Welcome back. Your library is ready. How can I help?",
    voicePitch: 0.85,
    voiceRate: 1,
    aura: "shadow-[0_0_30px_rgba(56,189,248,0.55)]",
    voiceHints: [
      "daniel", "alex", "fred", "arthur", "oliver",
      "google uk english male", "david", "mark", "male",
    ],
    female: false,
  },
};

const ORDER: Persona[] = ["lyra", "orion"];

function pickVoice(meta: AvatarMeta): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const pool = en.length ? en : voices;
  for (const hint of meta.voiceHints) {
    const v = pool.find((x) => x.name.toLowerCase().includes(hint));
    if (v) return v;
  }
  if (meta.female) {
    const f = pool.find((v) => /female|woman|girl|samantha|victoria|karen|zira|tessa|moira|fiona/i.test(v.name));
    if (f) return f;
  }
  return pool[0] ?? null;
}

function speak(meta: AvatarMeta, text: string, onStart?: () => void, onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice(meta);
  if (v) u.voice = v;
  u.pitch = meta.voicePitch;
  u.rate = meta.voiceRate;
  u.volume = 1;
  u.onstart = () => onStart?.();
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

type Quick = { label: string; to: string };
const ADMIN_QUICK: Quick[] = [
  { label: "Issue", to: "/admin/issues" },
  { label: "Reservations", to: "/admin/reservations" },
  { label: "Lost Books", to: "/admin/lost-books" },
  { label: "Reports", to: "/admin/reports" },
];
const STUDENT_QUICK: Quick[] = [
  { label: "Reserve", to: "/student/reservations" },
  { label: "My Books", to: "/student/my-books" },
  { label: "Report Lost", to: "/student/lost-books" },
  { label: "Fines", to: "/student/fines" },
];

export function AIAssistant({ defaultPersona = "lyra", role = "student" }: { defaultPersona?: Persona; role?: "student" | "admin" }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [persona, setPersona] = useState<Persona>(defaultPersona);
  const [input, setInput] = useState("");
  const [voiceOn, setVoiceOn] = useState(false);
  const [showPeek, setShowPeek] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [hoverHint, setHoverHint] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
  });
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: AVATAR[defaultPersona].intro },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50))); } catch { /* ignore */ }
    }
  }, [history]);


  // Warm up the voice list (browsers load it async)
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const s = window.speechSynthesis;
    const handler = () => { /* triggers re-eval */ };
    s.onvoiceschanged = handler;
    s.getVoices();
    return () => { s.onvoiceschanged = null; };
  }, []);

  const switchPersona = (p: Persona) => {
    setPersona(p);
    setMessages([{ role: "assistant", content: AVATAR[p].intro }]);
    if (voiceOn) speak(AVATAR[p], AVATAR[p].intro, () => setSpeaking(true), () => setSpeaking(false));
  };

  const ask = useMutation({
    mutationFn: useServerFn(askAssistant),
    onSuccess: (res: any) => {
      const text = res.text;
      setMessages((m) => [...m, { role: "assistant", content: text }]);
      if (voiceOn) {
        speak(AVATAR[persona], text, () => setSpeaking(true), () => setSpeaking(false));
      } else {
        // Visualise speaking even when voice is muted so the avatar still reacts
        setSpeaking(true);
        setTimeout(() => setSpeaking(false), Math.min(6000, text.length * 45));
      }
    },
    onError: (e: Error) => setMessages((m) => [...m, { role: "assistant", content: `⚠ ${e.message}` }]),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, ask.isPending]);

  useEffect(() => {
    if (!open) {
      setShowPeek(true);
      const t = setTimeout(() => setShowPeek(false), 7000);
      return () => clearTimeout(t);
    }
  }, [open, persona]);

  const send = (override?: string) => {
    const text = (override ?? input).trim();
    if (!text) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setHistory((h) => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, persona, prompt: text, at: Date.now() }, ...h.filter((x) => x.prompt !== text)].slice(0, 50));
    ask.mutate({ data: { persona, messages: next.slice(-10) } } as any);
  };

  const reusePrompt = (entry: HistoryEntry) => {
    if (entry.persona !== persona) {
      setPersona(entry.persona);
      setMessages([{ role: "assistant", content: AVATAR[entry.persona].intro }]);
    }
    setHistoryOpen(false);
    setInput(entry.prompt);
    setTimeout(() => send(entry.prompt), 30);
  };

  const toggleVoice = () => {
    if (voiceOn && typeof window !== "undefined") { window.speechSynthesis?.cancel(); setSpeaking(false); }
    setVoiceOn((v) => {
      const next = !v;
      if (next) speak(AVATAR[persona], AVATAR[persona].intro, () => setSpeaking(true), () => setSpeaking(false));
      return next;
    });
  };

  const a = AVATAR[persona];
  const quick = useMemo(() => (role === "admin" ? ADMIN_QUICK : STUDENT_QUICK), [role]);

  return (
    <>
      {/* Floating launcher with idle bobbing + NPC speech peek + hover hint */}
      {!open && (
        <div className="fixed bottom-6 right-6 z-40 flex items-end gap-2">
          {(showPeek || hoverHint) && (
            <div className="mb-2 max-w-[220px] bg-card border border-primary/40 rounded-2xl rounded-br-sm px-3 py-2 text-xs leading-snug shadow-lg animate-in fade-in slide-in-from-right-2">
              <div className="font-semibold text-primary text-[10px] uppercase tracking-widest mb-0.5">{a.name}</div>
              {hoverHint ?? a.intro}
            </div>
          )}
          <button
            onClick={() => setOpen(true)}
            onMouseEnter={() => setHoverHint("Click to chat — quick actions inside.")}
            onMouseLeave={() => setHoverHint(null)}
            className={`relative w-16 h-16 rounded-full overflow-hidden border-2 border-primary ${a.aura} hover:scale-110 active:scale-95 transition animate-[bob_3s_ease-in-out_infinite]`}
            aria-label="Open AI assistant"
          >
            <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping opacity-30" />
            <img src={a.url} alt={a.name} className="relative w-full h-full object-cover object-top" />
            <span className="absolute -top-1 -right-1 bg-primary rounded-full p-1">
              <Sparkles className="w-3 h-3 text-primary-foreground" />
            </span>
          </button>
        </div>
      )}

      {/* Chat window */}
      {open && (
        <div className={`fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[680px] max-h-[92vh] card-surface rounded-xl border border-primary/40 ${a.aura} flex flex-col overflow-hidden`}>
          {/* Portrait stage */}
          <div className="relative h-56 bg-gradient-to-b from-primary/10 via-background to-background border-b border-border overflow-hidden">
            <img
              src={a.url}
              alt={a.name}
              className={`absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 ${speaking ? "scale-[1.03]" : "scale-100 animate-[bob_4s_ease-in-out_infinite]"}`}
            />
            <div className={`pointer-events-none absolute inset-0 ${a.aura} rounded-none`} />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
            <div className="absolute top-2 left-2 text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-background/70 border border-primary/40 text-primary">
              {a.name} · Eclipse AI
            </div>
            {speaking && (
              <div className="absolute bottom-2 left-2 text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/80 text-primary-foreground animate-pulse">
                Speaking…
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 p-3 border-b border-border bg-card/80">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm flex items-center gap-2">
                {a.name}
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{a.tag}</div>
            </div>
            <button onClick={() => setHistoryOpen((v) => !v)} className={`p-1.5 rounded hover:bg-secondary ${historyOpen ? "text-primary" : "text-muted-foreground"}`} aria-label="Prompt history" title="Prompt history">
              <History className="w-4 h-4" />
            </button>
            <button onClick={toggleVoice} className={`p-1.5 rounded hover:bg-secondary ${voiceOn ? "text-primary" : "text-muted-foreground"}`} aria-label="Toggle voice">
              {voiceOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button onClick={() => { setOpen(false); window.speechSynthesis?.cancel(); setSpeaking(false); }} className="p-1 rounded hover:bg-secondary" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>


          <div className="flex items-center justify-center gap-3 p-3 border-b border-border bg-background/40">
            {ORDER.map((p) => {
              const av = AVATAR[p];
              const active = p === persona;
              return (
                <button
                  key={p}
                  onClick={() => switchPersona(p)}
                  className={`flex flex-col items-center gap-1 transition ${active ? "scale-110" : "opacity-60 hover:opacity-100"}`}
                  aria-label={`Switch to ${av.name}`}
                >
                  <div className={`w-12 h-12 rounded-full overflow-hidden border-2 ${active ? `border-primary ${av.aura}` : "border-border"}`}>
                    <img src={av.url} alt={av.name} className="w-full h-full object-cover object-top" />
                  </div>
                  <div className={`text-[10px] font-mono uppercase tracking-widest ${active ? "text-primary" : "text-muted-foreground"}`}>{av.name}</div>
                </button>
              );
            })}
          </div>

          {/* NPC quick-action speech bubbles */}
          <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-border bg-background/20">
            {quick.map((q) => (
              <button
                key={q.to}
                onClick={() => { setOpen(false); navigate({ to: q.to as any }); }}
                className="text-[10px] uppercase tracking-widest font-mono px-2.5 py-1 rounded-full border border-primary/40 text-primary hover:bg-primary/10"
              >
                {q.label}
              </button>
            ))}
          </div>

          {historyOpen && (
            <div className="border-b border-border bg-background/40 max-h-56 overflow-y-auto">
              <div className="flex items-center justify-between px-3 py-2 sticky top-0 bg-background/90 backdrop-blur border-b border-border">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
                  <History className="w-3 h-3" /> Prompt history · {history.length}
                </div>
                <button
                  onClick={() => setHistory([])}
                  disabled={!history.length}
                  className="text-[10px] font-mono uppercase tracking-widest text-destructive hover:underline disabled:opacity-40 inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              </div>
              {!history.length && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No prompts yet. Ask {a.name} something and it'll show up here for reuse.
                </div>
              )}
              <ul className="divide-y divide-border">
                {history.map((h) => (
                  <li key={h.id} className="px-3 py-2 hover:bg-secondary/40 cursor-pointer" onClick={() => reusePrompt(h)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-primary">{AVATAR[h.persona].name}</span>
                      <span className="text-[9px] font-mono text-muted-foreground">{new Date(h.at).toLocaleString()}</span>
                    </div>
                    <div className="text-xs mt-1 line-clamp-2">{h.prompt}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-1`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                  m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary rounded-bl-sm"
                }`}>
                  <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                </div>
              </div>
            ))}
            {ask.isPending && (
              <div className="flex justify-start">
                <div className="bg-secondary rounded-2xl rounded-bl-sm px-3 py-2 text-xs text-muted-foreground inline-flex items-center gap-1">
                  <MessageCircle className="w-3 h-3 animate-pulse" />
                  <span className="inline-flex gap-0.5">
                    <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce [animation-delay:120ms]" />
                    <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce [animation-delay:240ms]" />
                  </span>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="border-t border-border p-2 flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask ${a.name}…`}
              className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
            <button type="submit" disabled={ask.isPending || !input.trim()}
              className="bg-primary text-primary-foreground rounded-md px-3 hover:bg-primary/90 disabled:opacity-50">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      <style>{`@keyframes bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }`}</style>
    </>
  );
}

