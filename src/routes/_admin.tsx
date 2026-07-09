import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AIAssistant } from "@/components/AIAssistant";
import {
  LayoutDashboard, BookOpen, Users, ClipboardList, AlertCircle,
  BookmarkCheck, Armchair, FileBarChart, LogOut, Search, Sun, Moon, AlertOctagon, Shield,
} from "lucide-react";

export const Route = createFileRoute("/_admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const isOwner = data.user.email?.toLowerCase() === "nivishna689@gmail.com";
    const isAdmin = isOwner || roles?.some((r) => r.role === "admin");
    if (!isAdmin) throw redirect({ to: "/student" });
    return { user: data.user };
  },
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/catalog", label: "Catalog", icon: BookOpen },
  { to: "/admin/students", label: "Students", icon: Users },
  { to: "/admin/issues", label: "Issues", icon: ClipboardList },
  { to: "/admin/fines", label: "Fines", icon: AlertCircle },
  { to: "/admin/reservations", label: "Reservations", icon: BookmarkCheck },
  { to: "/admin/lost-books", label: "Lost Books", icon: AlertOctagon },
  { to: "/admin/seats", label: "Seat Booking", icon: Armchair },
  { to: "/admin/reports", label: "Reports", icon: FileBarChart },
  { to: "/admin/requests", label: "Admin Requests", icon: Shield },
] as const;

function AdminLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState("");
  const [roleLabel, setRoleLabel] = useState("Admin");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const userEmail = data.user?.email ?? "";
      setEmail(userEmail);
      setRoleLabel(userEmail.toLowerCase() === "nivishna689@gmail.com" ? "Owner / Admin" : "Admin");
    });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 border-r border-border bg-card/60 backdrop-blur p-4 flex flex-col">
        <div className="px-3 py-4">
          <div className="font-display text-xl neon-text tracking-[0.2em] flicker">ECLIPSESOUL</div>
          <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mt-1">
            Restricted Access
          </div>
        </div>
        <nav className="flex-1 mt-4 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || (to !== "/admin" && pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition ${
                  active
                    ? "bg-primary/15 text-primary neon-border"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border pt-4 mt-4 space-y-3">
          <div className="px-3">
            <div className="text-sm font-medium truncate">{email || "Operator"}</div>
            <div className="text-[10px] uppercase tracking-widest text-primary">{roleLabel}</div>
          </div>
          <div className="flex items-center justify-between px-3">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={signOut}
              className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-secondary transition"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="border-b border-border bg-card/40 backdrop-blur px-8 py-4 flex items-center gap-4">
          <div className="flex-1 relative max-w-xl">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search books, students, ISBN, barcode..."
              className="w-full pl-9 pr-3 py-2 bg-input border border-border rounded-md text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </header>
        <div className="p-8">
          <Outlet />
        </div>
      </main>
      <AIAssistant defaultPersona="orion" role="admin" />
    </div>
  );
}
