import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Pill, Package, Users, TrendingUp, MapPin, BarChart3, ArrowLeft } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50" dir="rtl">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
              <Pill className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">صيدلية جونيا</h1>
              <p className="text-sm text-gray-600">نظام إدارة الطلبات والتوصيل</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link href="/register-pharmacy">
              <Button variant="outline" className="shadow-md">
                إنشاء صيدلية
              </Button>
            </Link>
            <Link href="/login">
              <Button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg">
                ابدأ
                <ArrowLeft className="mr-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full mb-6">
            <Pill className="w-4 h-4" />
            <span className="text-sm font-medium">نظام إدارة متكامل</span>
          </div>
          
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            نظام إدارة الطلبات
            <br />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              لصيدلية جونيا
            </span>
          </h2>
          
          <p className="text-xl text-gray-600 mb-10 leading-relaxed max-w-2xl mx-auto">
            نظام شامل لإدارة الطلبات والمندوبين مع إحصائيات متقدمة وتتبع دقيق لجميع العمليات
          </p>
          
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/register-pharmacy">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6 shadow-xl border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50">
                إنشاء صيدلية جديدة
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-lg px-8 py-6 shadow-2xl">
                ابدأ الآن
                <ArrowLeft className="mr-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-gray-100">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center mb-4">
              <Package className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">إدارة الطلبات</h3>
            <p className="text-gray-600 leading-relaxed">
              نظام متكامل لإدارة الطلبات مع إمكانية التعيين للمندوبين وتتبع حالة كل طلب
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-gray-100">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">إدارة المندوبين</h3>
            <p className="text-gray-600 leading-relaxed">
              إضافة وإدارة المندوبين مع صلاحيات مخصصة ومتابعة أدائهم بشكل دقيق
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-gray-100">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">إحصائيات متقدمة</h3>
            <p className="text-gray-600 leading-relaxed">
              رسوم بيانية تفاعلية وتقارير شاملة لتحليل الأداء والأرباح
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-gray-100">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mb-4">
              <MapPin className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">إدارة المناطق</h3>
            <p className="text-gray-600 leading-relaxed">
              تنظيم المناطق والمحافظات لتوزيع الطلبات بكفاءة عالية
            </p>
          </div>

          {/* Feature 5 */}
          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-gray-100">
            <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center mb-4">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">تتبع الأداء</h3>
            <p className="text-gray-600 leading-relaxed">
              متابعة أداء المندوبين والطلبات المسلمة والمؤجلة في الوقت الفعلي
            </p>
          </div>

          {/* Feature 6 */}
          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-gray-100">
            <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center mb-4">
              <Pill className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">سهولة الاستخدام</h3>
            <p className="text-gray-600 leading-relaxed">
              واجهة عربية بسيطة وسهلة الاستخدام لجميع المستخدمين
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl p-12 text-center shadow-2xl">
          <h2 className="text-4xl font-bold text-white mb-4">
            جاهز للبدء؟
          </h2>
          <p className="text-xl text-emerald-100 mb-8 max-w-2xl mx-auto">
            ابدأ في إدارة طلبات صيدليتك بكفاءة وسهولة
          </p>
          <Link href="/login">
            <Button size="lg" variant="outline" className="bg-white text-emerald-600 hover:bg-emerald-50 border-0 text-lg px-8 py-6 shadow-xl">
              تسجيل الدخول الآن
              <ArrowLeft className="mr-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <Pill className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-900">صيدلية جونيا</p>
                <p className="text-sm text-gray-600">نظام إدارة الطلبات</p>
              </div>
            </div>
            <p className="text-gray-600">
              جميع الحقوق محفوظة لـ{" "}
              <span className="font-bold text-emerald-600">HarthHDR</span> ©{" "}
              {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
