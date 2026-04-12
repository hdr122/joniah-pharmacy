import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileDown, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ExportButtonProps {
  data: any[];
  filename: string;
  columns: {
    key: string;
    header: string;
    format?: (value: any, row: any) => string;
  }[];
  title?: string;
}

export function ExportButton({ data, filename, columns, title }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  // تصدير إلى CSV (يمكن فتحه في Excel)
  const exportToCSV = () => {
    try {
      setIsExporting(true);
      
      // إنشاء رأس الجدول
      const headers = columns.map(col => col.header);
      
      // إنشاء الصفوف
      const rows = data.map(row => {
        return columns.map(col => {
          const value = row[col.key];
          if (col.format) {
            return `"${col.format(value, row).replace(/"/g, '""')}"`;
          }
          if (value === null || value === undefined) return '""';
          if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
          return `"${value}"`;
        }).join(',');
      });
      
      // إضافة BOM للتوافق مع Excel العربي
      const BOM = '\uFEFF';
      const csvContent = BOM + [headers.join(','), ...rows].join('\n');
      
      // إنشاء وتحميل الملف
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('تم تصدير البيانات بنجاح');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('فشل تصدير البيانات');
    } finally {
      setIsExporting(false);
    }
  };

  // تصدير إلى HTML (يمكن طباعته كـ PDF)
  const exportToPDF = () => {
    try {
      setIsExporting(true);
      
      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>${title || filename}</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              direction: rtl;
              padding: 20px;
            }
            h1 {
              text-align: center;
              color: #059669;
              margin-bottom: 20px;
            }
            .date {
              text-align: center;
              color: #666;
              margin-bottom: 20px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 10px;
              text-align: right;
            }
            th {
              background-color: #059669;
              color: white;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            tr:hover {
              background-color: #f5f5f5;
            }
            .footer {
              margin-top: 20px;
              text-align: center;
              color: #666;
              font-size: 12px;
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>${title || filename}</h1>
          <p class="date">تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')} ${new Date().toLocaleTimeString('ar-SA')}</p>
          <table>
            <thead>
              <tr>
                ${columns.map(col => `<th>${col.header}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.map(row => `
                <tr>
                  ${columns.map(col => {
                    const value = row[col.key];
                    const displayValue = col.format ? col.format(value, row) : (value ?? '-');
                    return `<td>${displayValue}</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p class="footer">صيدلية جونيا - نظام إدارة الطلبات</p>
          <div class="no-print" style="text-align: center; margin-top: 20px;">
            <button onclick="window.print()" style="padding: 10px 20px; background: #059669; color: white; border: none; border-radius: 5px; cursor: pointer;">
              طباعة / حفظ كـ PDF
            </button>
          </div>
        </body>
        </html>
      `;
      
      // فتح نافذة جديدة للطباعة
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
      }
      
      toast.success('تم فتح نافذة الطباعة');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('فشل تصدير البيانات');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={isExporting || !data?.length}>
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileDown className="w-4 h-4" />
          )}
          تصدير
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>اختر صيغة التصدير</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportToCSV} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="w-4 h-4 text-green-600" />
          تصدير Excel (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToPDF} className="gap-2 cursor-pointer">
          <FileText className="w-4 h-4 text-red-600" />
          تصدير PDF (طباعة)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
