import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function PrivacyPolicy() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4 lg:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-emerald-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-emerald-900">سياسة الخصوصية</h1>
              <p className="text-gray-600 mt-2">Privacy Policy</p>
            </div>
            <Button
              variant="outline"
              onClick={() => setLocation("/login")}
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              <ArrowRight className="w-4 h-4 ml-2" />
              العودة
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl shadow-sm p-8 border border-emerald-100 space-y-6">
          <section>
            <h2 className="text-2xl font-bold text-emerald-900 mb-4">مقدمة</h2>
            <p className="text-gray-700 leading-relaxed">
              نحن في صيدلية جونيا نلتزم بحماية خصوصيتك وأمان بياناتك الشخصية. توضح سياسة الخصوصية هذه كيفية جمع واستخدام وحماية المعلومات التي تقدمها عند استخدام نظام إدارة الطلبات والتوصيل الخاص بنا.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-emerald-900 mb-4">المعلومات التي نجمعها</h2>
            <div className="space-y-3 text-gray-700">
              <p className="font-semibold text-emerald-800">1. معلومات الحساب:</p>
              <ul className="list-disc list-inside mr-6 space-y-2">
                <li>الاسم الكامل</li>
                <li>اسم المستخدم</li>
                <li>رقم الهاتف</li>
                <li>الدور الوظيفي (مدير، موظف، مندوب توصيل)</li>
              </ul>

              <p className="font-semibold text-emerald-800 mt-4">2. معلومات الطلبات:</p>
              <ul className="list-disc list-inside mr-6 space-y-2">
                <li>بيانات الزبائن (الاسم، رقم الهاتف، العنوان)</li>
                <li>تفاصيل الطلبات والمنتجات</li>
                <li>حالة الطلب وتاريخ التسليم</li>
              </ul>

              <p className="font-semibold text-emerald-800 mt-4">3. بيانات الموقع:</p>
              <ul className="list-disc list-inside mr-6 space-y-2">
                <li>موقع GPS للمندوبين أثناء التوصيل (بموافقتهم)</li>
                <li>مسارات التوصيل والمسافات المقطوعة</li>
              </ul>

              <p className="font-semibold text-emerald-800 mt-4">4. بيانات الاستخدام:</p>
              <ul className="list-disc list-inside mr-6 space-y-2">
                <li>سجلات النشاطات والعمليات</li>
                <li>الإحصائيات والأداء</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-emerald-900 mb-4">كيفية استخدام المعلومات</h2>
            <div className="space-y-3 text-gray-700">
              <p>نستخدم المعلومات التي نجمعها للأغراض التالية:</p>
              <ul className="list-disc list-inside mr-6 space-y-2">
                <li>إدارة ومعالجة الطلبات</li>
                <li>تتبع عمليات التوصيل وتحسين الخدمة</li>
                <li>التواصل مع الزبائن والمندوبين</li>
                <li>تحليل الأداء وإعداد التقارير</li>
                <li>تحسين تجربة المستخدم</li>
                <li>ضمان أمان النظام ومنع الاحتيال</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-emerald-900 mb-4">حماية البيانات</h2>
            <div className="space-y-3 text-gray-700">
              <p>نتخذ إجراءات أمنية صارمة لحماية بياناتك:</p>
              <ul className="list-disc list-inside mr-6 space-y-2">
                <li>تشفير البيانات أثناء النقل والتخزين</li>
                <li>استخدام كلمات مرور مشفرة</li>
                <li>صلاحيات وصول محدودة حسب الدور الوظيفي</li>
                <li>نسخ احتياطية منتظمة للبيانات</li>
                <li>مراقبة النظام للكشف عن أي نشاط مشبوه</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-emerald-900 mb-4">مشاركة البيانات</h2>
            <div className="space-y-3 text-gray-700">
              <p>نحن لا نشارك بياناتك الشخصية مع أطراف ثالثة إلا في الحالات التالية:</p>
              <ul className="list-disc list-inside mr-6 space-y-2">
                <li>بموافقتك الصريحة</li>
                <li>للامتثال للقوانين والأنظمة</li>
                <li>لحماية حقوقنا وسلامة المستخدمين</li>
                <li>مع مقدمي الخدمات الموثوقين (مثل خدمات الاستضافة) الذين يلتزمون بحماية البيانات</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-emerald-900 mb-4">حقوقك</h2>
            <div className="space-y-3 text-gray-700">
              <p>لديك الحق في:</p>
              <ul className="list-disc list-inside mr-6 space-y-2">
                <li>الوصول إلى بياناتك الشخصية</li>
                <li>تصحيح أو تحديث بياناتك</li>
                <li>طلب حذف بياناتك (مع مراعاة المتطلبات القانونية)</li>
                <li>الاعتراض على معالجة بياناتك</li>
                <li>سحب موافقتك على تتبع الموقع في أي وقت</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-emerald-900 mb-4">الاحتفاظ بالبيانات</h2>
            <p className="text-gray-700 leading-relaxed">
              نحتفظببياناتك الشخصية طالما كان حسابك نشطاً أو حسب الحاجة لتقديم خدماتنا. قد نحتفظ ببعض البيانات لفترة أطول للامتثال للالتزامات القانونية أو لحل النزاعات.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-emerald-900 mb-4">ملفات تعريف الارتباط (Cookies)</h2>
            <p className="text-gray-700 leading-relaxed">
              نستخدم ملفات تعريف الارتباط لتحسين تجربتك وتذكر تفضيلاتك. يمكنك تعطيل ملفات تعريف الارتباط من إعدادات المتصفح، لكن قد يؤثر ذلك على بعض وظائف النظام.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-emerald-900 mb-4">التحديثات على سياسة الخصوصية</h2>
            <p className="text-gray-700 leading-relaxed">
              قد نقوم بتحديث سياسة الخصوصية من وقت لآخر. سنقوم بإعلامك بأي تغييرات جوهرية عبر النظام أو البريد الإلكتروني. يُنصح بمراجعة هذه الصفحة بشكل دوري.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-emerald-900 mb-4">الاتصال بنا</h2>
            <div className="bg-emerald-50 rounded-lg p-6 border border-emerald-200">
              <p className="text-gray-700 leading-relaxed mb-4">
                إذا كان لديك أي أسئلة أو استفسارات حول سياسة الخصوصية أو كيفية معالجة بياناتك، يرجى التواصل معنا:
              </p>
              <div className="space-y-2 text-gray-700">
                <p><span className="font-semibold text-emerald-800">الشركة:</span> HarthHDR</p>
                <p><span className="font-semibold text-emerald-800">الموقع:</span> صيدلية جونيا</p>
                <p><span className="font-semibold text-emerald-800">البريد الإلكتروني:</span> support@joniah.xyz</p>
              </div>
            </div>
          </section>

          <section className="border-t border-emerald-200 pt-6 mt-8">
            <p className="text-sm text-gray-600 text-center">
              آخر تحديث: ديسمبر 2024
              <br />
              Last updated: December 2024
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-600 text-sm">
          <p>جميع الحقوق محفوظة © 2025 HarthHDR</p>
        </div>
      </div>
    </div>
  );
}
