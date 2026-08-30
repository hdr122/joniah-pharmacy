import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Package, Users, TrendingUp, MapPin, BarChart3, ArrowLeft, Bell } from "lucide-react";

const FEATURES = [
  {
    icon: Package,
    title: "إدارة الطلبات",
    text: "نظام متكامل لإدارة الطلبات مع إمكانية التعيين للمندوبين وتتبع حالة كل طلب",
  },
  {
    icon: Users,
    title: "إدارة المندوبين",
    text: "إضافة وإدارة المندوبين مع صلاحيات مخصصة ومتابعة أدائهم بشكل دقيق",
  },
  {
    icon: BarChart3,
    title: "إحصائيات متقدمة",
    text: "رسوم بيانية تفاعلية وتقارير شاملة لتحليل الأداء والأرباح",
  },
  {
    icon: MapPin,
    title: "تتبع مباشر",
    text: "تتبع حي لمواقع المندوبين على الخريطة أثناء التوصيل",
  },
  {
    icon: TrendingUp,
    title: "تتبع الأداء",
    text: "متابعة أداء المندوبين والطلبات المسلمة والمؤجلة في الوقت الفعلي",
  },
  {
    icon: Bell,
    title: "إشعارات فورية",
    text: "تنبيهات لحظية للمندوبين والإدارة عند كل تحديث على الطلبات",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#120b26] text-white" dir="rtl">
      {/* Header */}
      <header className="container mx-auto px-4 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/xenon-logo.svg" alt="Xenon" className="w-11 h-11 xenon-logo-glow" />
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">
                <span className="xenon-gradient-text">Xenon</span>
              </h1>
              <p className="text-xs text-violet-200/60">نظام المندوبين والتوصيل</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link href="/register-pharmacy">
              <Button
                variant="outline"
                className="border-white/15 bg-transparent text-violet-100 hover:bg-white/5 hover:text-white"
              >
                إنشاء فرع
              </Button>
            </Link>
            <Link href="/login">
              <Button className="xenon-gradient-bg text-white hover:opacity-90 transition-opacity">
                تسجيل الدخول
                <ArrowLeft className="mr-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Ambient glows */}
        <div className="pointer-events-none absolute -top-24 right-1/3 h-96 w-96 rounded-full bg-violet-600/25 blur-[130px]" />
        <div className="pointer-events-none absolute top-40 left-1/4 h-72 w-72 rounded-full bg-fuchsia-600/20 blur-[120px]" />

        <div className="container relative mx-auto px-4 pt-16 pb-24 text-center">
          <img
            src="/xenon-logo.svg"
            alt=""
            className="mx-auto mb-8 w-28 h-28 xenon-logo-glow animate-[pulse_5s_ease-in-out_infinite]"
          />

          <h2 className="mx-auto max-w-3xl text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
            نظام مندوبين
            <br />
            <span className="xenon-gradient-text">شركة Xenon</span>
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-lg md:text-xl leading-relaxed text-violet-200/70">
            إدارة الطلبات، تتبع المندوبين مباشرة على الخريطة، إشعارات فورية،
            وإحصائيات لكل فرع — في لوحة واحدة.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/login">
              <Button
                size="lg"
                className="xenon-gradient-bg px-8 py-6 text-lg text-white shadow-[0_15px_40px_-12px_rgba(219,39,119,0.55)] hover:opacity-90 transition-opacity"
              >
                ابدأ الآن
                <ArrowLeft className="mr-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/register-pharmacy">
              <Button
                size="lg"
                variant="outline"
                className="border-white/15 bg-transparent px-8 py-6 text-lg text-violet-100 hover:bg-white/5 hover:text-white"
              >
                إنشاء فرع جديد
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="group rounded-2xl border border-white/10 bg-white/[0.04] p-7 transition-colors hover:border-fuchsia-400/30 hover:bg-white/[0.07]"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 ring-1 ring-white/10">
                <Icon className="h-6 w-6 text-fuchsia-300 transition-colors group-hover:text-amber-300" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-white">{title}</h3>
              <p className="leading-relaxed text-violet-200/60">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-12 text-center">
          <div className="pointer-events-none absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-fuchsia-600/25 blur-[100px]" />
          <h2 className="relative text-3xl md:text-4xl font-extrabold">جاهز للانطلاق؟</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-lg text-violet-200/70">
            سجّل دخولك وابدأ بإدارة فرعك ومندوبيك خلال دقائق
          </p>
          <Link href="/login">
            <Button
              size="lg"
              className="relative mt-8 xenon-gradient-bg px-8 py-6 text-lg text-white hover:opacity-90 transition-opacity"
            >
              تسجيل الدخول الآن
              <ArrowLeft className="mr-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-8 md:flex-row">
          <div className="flex items-center gap-3">
            <img src="/xenon-logo.svg" alt="Xenon" className="w-8 h-8 xenon-logo-glow" />
            <div>
              <p className="font-bold">Xenon</p>
              <p className="text-sm text-violet-200/60">نظام المندوبين والتوصيل</p>
            </div>
          </div>
          <p className="text-violet-200/60">
            جميع الحقوق محفوظة لـ <span className="font-bold text-fuchsia-300">Xenon</span> ©{" "}
            {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
