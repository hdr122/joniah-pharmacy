import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Loader2, Pill, LogOut } from "lucide-react";
import { useCustomAuth } from "@/hooks/useCustomAuth";

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
      // Invalidate auth query to refetch user data
      await utils.auth.me.invalidate();
      // Small delay to ensure session is properly set
      await new Promise(resolve => setTimeout(resolve, 500));
      // Redirect based on role
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

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Show loading state during redirect or initial auth check
  if (loading || isRedirecting || loginMutation.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50" dir="rtl">
        <div className="text-center">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg mb-6">
            <Pill className="w-10 h-10 text-white" />
          </div>
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // If user is already logged in (OAuth), show logout prompt
  if (isAuthenticated && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50" dir="rtl">
        <Card className="w-full max-w-md mx-4 shadow-2xl border-emerald-100">
          <CardHeader className="space-y-4 text-center pb-8">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Pill className="w-10 h-10 text-white" />
            </div>
            <div>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                صيدلية جونيا
              </CardTitle>
              <CardDescription className="text-base mt-2 text-gray-600">
                أنت مسجل دخول بالفعل
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
              <p className="text-gray-700 mb-1">مرحباً،</p>
              <p className="text-emerald-700 font-bold text-lg">{user.name || user.username}</p>
              {isOwner && (
                <p className="text-sm text-gray-500 mt-1">مالك النظام</p>
              )}
            </div>
            
            <div className="space-y-3">
              <Button
                onClick={() => setLocation(user.role === "admin" ? "/admin" : "/delivery")}
                className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              >
                الذهاب إلى لوحة التحكم
              </Button>
              
              <Button
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
                variant="outline"
                className="w-full h-12 border-2 border-gray-300 hover:border-red-500 hover:bg-red-50 text-gray-700 hover:text-red-600 font-semibold transition-all duration-200"
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
            
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-center text-sm text-gray-500">
                جميع الحقوق محفوظة © {new Date().getFullYear()} HarthHDR
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50" dir="rtl">
      <Card className="w-full max-w-md mx-4 shadow-2xl border-emerald-100">
        <CardHeader className="space-y-4 text-center pb-8">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Pill className="w-10 h-10 text-white" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              صيدلية جونيا
            </CardTitle>
            <CardDescription className="text-base mt-2 text-gray-600">
              نظام إدارة الطلبات والتوصيل
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-gray-700 font-medium">
                اسم المستخدم
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                disabled={loginMutation.isPending}
                className="h-11 border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700 font-medium">
                كلمة المرور
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                disabled={loginMutation.isPending}
                className="h-11 border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                autoComplete="current-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
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
          
          <div className="mt-8 pt-6 border-t border-gray-200 space-y-3">
            <div className="text-center">
              <button
                type="button"
                onClick={() => setLocation("/privacy-policy")}
                className="text-xs text-gray-500 hover:text-emerald-600 underline transition-colors"
              >
                سياسة الخصوصية / Privacy Policy
              </button>
            </div>
            <p className="text-center text-sm text-gray-500">
              جميع الحقوق محفوظة © {new Date().getFullYear()} HarthHDR
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
