import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, formatDate } from "@/lib/utils/cn";

export interface ReportDataRow {
  [key: string]: any;
}

export const reportService = {
  exportToCSV(filename: string, rows: ReportDataRow[]): void {
    if (!rows || rows.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvOutput], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  exportToExcel(filename: string, rows: ReportDataRow[], sheetName: string = "Report"): void {
    if (!rows || rows.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  },

  exportToPDF(
    title: string,
    headers: string[],
    rows: (string | number)[][],
    filename: string,
    summaryMetrics?: { label: string; value: string }[]
  ): void {
    const doc = new jsPDF();

    // Header Branding
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text(title, 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${formatDate(new Date())}`, 14, 28);

    let startY = 36;

    // Optional Summary Box
    if (summaryMetrics && summaryMetrics.length > 0) {
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      summaryMetrics.forEach((m, idx) => {
        const xPos = 14 + (idx % 3) * 62;
        const yPos = startY + Math.floor(idx / 3) * 12;
        doc.text(`${m.label}: ${m.value}`, xPos, yPos);
      });
      startY += Math.ceil(summaryMetrics.length / 3) * 14 + 6;
    }

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY,
      theme: "grid",
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: "bold",
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    doc.save(`${filename}.pdf`);
  },
};
