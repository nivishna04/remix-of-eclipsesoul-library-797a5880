import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AIAssistant } from "@/components/AIAssistant";
import { LayoutDashboard, BookOpen, BookMarked, AlertCircle, Bookmark, Armchair, LogOut, User, Sun, Moon, AlertOctagon } from "lucide-react";

export const Route = createFileRoute("/_student")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const isOwner = data.user.email?.toLowerCase() === "nivishna689@gmail.com";
    const isAdmin = isOwner || roles?.some((r) => r.role === "admin");
    if (isAdmin) throw redirect({ to: "/admin" });
    return { user: data.user };
  },
  component: StudentLayout,
});

const NAV = [
  { to: "/student", label: "Dashboard", icon: LayoutDashboard },
  { to: "/student/catalog", label: "Catalog", icon: BookOpen },
  { to: "/student/my-books", label: "My Books", icon: BookMarked },
  { to: "/student/reservations", label: "Reservations", icon: Bookmark },
  { to: "/student/fines", label: "Fines", icon: AlertCircle },
  { to: "/student/lost-books", label: "Lost Book", icon: AlertOctagon },
  { to: "/student/seats", label: "Seat Booking", icon: Armchair },
  { to: "/student/profile", label: "Profile", icon: User },
] as const;

function StudentLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState("");
  const [roleLabel, setRoleLabel] = useState("Student");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) return;
      setEmail(user.email ?? "");
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const isAdmin = roles?.some((r) => r.role === "admin");
      const isOwner = user.email?.toLowerCase() === "nivishna689@gmail.com";
      setRoleLabel(isOwner ? "Owner" : isAdmin ? "Admin" : "Student");
    });
  }, []);
  useEffect(() => { document.documentElement.classList.toggle("light", theme === "light"); }, [theme]);

  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); };

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 border-r border-border bg-card/60 backdrop-blur p-4 flex flex-col">
        <div className="px-3 py-4">
          <div className="font-display text-xl neon-text tracking-[0.2em] flicker">ECLIPSESOUL</div>
          <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mt-1">Student Portal</div>
        </div>
        <nav className="flex-1 mt-4 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || (to !== "/student" && pathname.startsWith(to));
            return (
              <Link key={to} to={to} className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition ${
                active ? "bg-primary/15 text-primary neon-border" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}>
                <Icon className="w-4 h-4" /><span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border pt-4 mt-4 space-y-3">
          <div className="px-3">
            <div className="text-sm font-medium truncate">{email || "Reader"}</div>
            <div className="text-[10px] uppercase tracking-widest text-primary">{roleLabel}</div>
          </div>
          <div className="flex items-center justify-between px-3">
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={signOut} className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-secondary transition">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-8"><Outlet /></main>
      <AIAssistant defaultPersona="lyra" role="student" />
    </div>
  );
}
