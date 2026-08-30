import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Loader2, LogOut, User, Lock } from "lucide-react";
import { useCustomAuth } from "@/hooks/useCustomAuth";

/** Shared dark cosmic backdrop for all login states */
function XenonScene({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#120b26] flex items-center justify-center px-4 py-10"
      dir="rtl"
    >
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -top-32 right-1/4 h-96 w-96 rounded-full bg-violet-600/25 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-fuchsia-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 left-0 h-64 w-64 rounded-full bg-amber-500/10 blur-[100px]" />
      {/* Subtle star field */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,.5) 50%, transparent 51%), radial-gradient(1px 1px at 70% 15%, rgba(255,255,255,.35) 50%, transparent 51%), radial-gradient(1.5px 1.5px at 85% 60%, rgba(255,255,255,.4) 50%, transparent 51%), radial-gradient(1px 1px at 40% 80%, rgba(255,255,255,.3) 50%, transparent 51%), radial-gradient(1px 1px at 10% 65%, rgba(255,255,255,.35) 50%, transparent 51%)",
        }}
      />
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}

function XenonBrand() {
  return (
    <div className="text-center mb-8">
      <img
        src="/xenon-logo.svg"
        alt="Xenon"
        className="mx-auto w-24 h-24 xenon-logo-glow animate-[pulse_4s_ease-in-out_infinite]"
      />
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white">
        <span className="xenon-gradient-text">Xenon</span>
      </h1>
      <p className="mt-2 text-sm text-violet-200/70">نظام مندوبين شركة Xenon</p>
    </div>
  );
}

/** Glass panel */
function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(124,58,237,0.5)] p-8">
      {children}
    </div>
  );
}

export default function Login() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const utils = trpc.useUtils();
  const { user, isAuthenticated, isOwner, loading } = useCustomAuth();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      toast.success("تم تسجيل الدخول بنجاح");
      setIsRedirecting(true);
      await utils.auth.me.invalidate();
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (data.user.role === "admin") {
        window.location.href = "/admin";
      } else {
        window.location.href = "/delivery";
      }
    },
    onError: (error) => {
      toast.error(error.message || "فشل تسجيل الدخول");
    },
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success("تم تسجيل الخروج بنجاح");
    },
    onError: () => {
      toast.error("فشل تسجيل الخروج");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("الرجاء إدخال اسم المستخدم وكلمة المرور");
      return;
    }
    loginMutation.mutate({ username, password });
  };

  if (loading || isRedirecting || loginMutation.isPending) {
    return (
      <XenonScene>
        <div className="text-center">
          <img
            src="/xenon-logo.svg"
            alt="Xenon"
            className="mx-auto w-24 h-24 xenon-logo-glow animate-[pulse_1.6s_ease-in-out_infinite]"
          />
          <p className="mt-6 text-violet-200/80">جاري التحميل...</p>
        </div>
      </XenonScene>
    );
  }

  if (isAuthenticated && user) {
    return (
      <XenonScene>
        <XenonBrand />
        <GlassCard>
          <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 p-4 text-center">
            <p className="text-violet-200/80 mb-1">مرحباً،</p>
            <p className="text-white font-bold text-lg">{user.name || user.username}</p>
            {isOwner && <p className="text-sm text-violet-300/70 mt-1">مالك النظام</p>}
          </div>

          <div className="mt-6 space-y-3">
            <Button
              onClick={() => setLocation(user.role === "admin" ? "/admin" : "/delivery")}
              className="w-full h-12 xenon-gradient-bg text-white font-semibold shadow-lg hover:opacity-90 transition-opacity"
            >
              الذهاب إلى لوحة التحكم
            </Button>

            <Button
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              variant="outline"
              className="w-full h-12 border-white/15 bg-transparent text-violet-100 hover:bg-white/5 hover:text-white font-semibold"
            >
              {logoutMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                  جاري تسجيل الخروج...
                </>
              ) : (
                <>
                  <LogOut className="ml-2 h-5 w-5" />
                  تسجيل الخروج والدخول بحساب آخر
                </>
              )}
            </Button>
          </div>
        </GlassCard>
        <p className="mt-6 text-center text-xs text-violet-300/50">
          جميع الحقوق محفوظة © {new Date().getFullYear()} Xenon
        </p>
      </XenonScene>
    );
  }

  return (
    <XenonScene>
      <XenonBrand />
      <GlassCard>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-violet-100 font-medium">
              اسم المستخدم
            </Label>
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-300/50" />
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                disabled={loginMutation.isPending}
                className="h-12 pr-10 border-white/10 bg-white/[0.06] text-white placeholder:text-violet-300/40 focus-visible:border-fuchsia-400/60 focus-visible:ring-fuchsia-400/30"
                autoComplete="username"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-violet-100 font-medium">
              كلمة المرور
            </Label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-300/50" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                disabled={loginMutation.isPending}
                className="h-12 pr-10 border-white/10 bg-white/[0.06] text-white placeholder:text-violet-300/40 focus-visible:border-fuchsia-400/60 focus-visible:ring-fuchsia-400/30"
                autoComplete="current-password"
              />
            </div>
          </div>
          <Button
            type="submit"
            className="w-full h-12 xenon-gradient-bg text-white font-semibold shadow-[0_10px_30px_-10px_rgba(219,39,119,0.6)] hover:opacity-90 transition-opacity"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? (
              <>
                <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                جاري تسجيل الدخول...
              </>
            ) : (
              "تسجيل الدخول"
            )}
          </Button>
        </form>
      </GlassCard>

      <div className="mt-6 space-y-2 text-center">
        <button
          type="button"
          onClick={() => setLocation("/privacy-policy")}
          className="text-xs text-violet-300/60 hover:text-fuchsia-300 underline underline-offset-4 transition-colors"
        >
          سياسة الخصوصية / Privacy Policy
        </button>
        <p className="text-xs text-violet-300/50">
          جميع الحقوق محفوظة © {new Date().getFullYear()} Xenon
        </p>
      </div>
    </XenonScene>
  );
}
