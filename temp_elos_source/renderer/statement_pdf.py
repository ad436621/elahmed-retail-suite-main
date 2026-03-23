#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
كشف حساب العميل - PDF Generator (Enhanced)
ELOS Accounting System - Professional Edition
"""

import json
import sys
import os
from datetime import datetime
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, KeepTogether, Frame, PageTemplate
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.shapes import Drawing, Rect, Line, Circle
from reportlab.graphics.charts.linecharts import HorizontalLineChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics import renderPDF

# Arabic support
HAS_ARABIC_SUPPORT = True
try:
    import arabic_reshaper
    from bidi.algorithm import get_display
except Exception:
    HAS_ARABIC_SUPPORT = False
    print("WARNING: arabic-reshaper not installed", file=sys.stderr)

# Font config
AR_FONT_NAME = "DejaVuSans"  # Using system font that supports Arabic
AR_FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
AR_FONT_BOLD_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# Fallback to Cairo if available
CAIRO_PATH = os.path.join(os.path.dirname(__file__), "fonts", "Cairo-Regular.ttf")
if os.path.isfile(CAIRO_PATH):
    AR_FONT_NAME = "Cairo"
    AR_FONT_PATH = CAIRO_PATH
    AR_FONT_BOLD_PATH = os.path.join(os.path.dirname(__file__), "fonts", "Cairo-Bold.ttf")


def register_arabic_font():
    """Register Arabic fonts"""
    try:
        if os.path.isfile(AR_FONT_PATH):
            pdfmetrics.registerFont(TTFont(AR_FONT_NAME, AR_FONT_PATH))
            print(f"Registered font: {AR_FONT_NAME}", file=sys.stderr)
        if os.path.isfile(AR_FONT_BOLD_PATH):
            pdfmetrics.registerFont(TTFont(AR_FONT_NAME + "-Bold", AR_FONT_BOLD_PATH))
    except Exception as e:
        print(f"Font registration warning: {e}", file=sys.stderr)


def format_arabic(text: str) -> str:
    """Format Arabic text for PDF display"""
    if text is None:
        return ""
    text = str(text)
    if not text.strip():
        return ""
    if not HAS_ARABIC_SUPPORT:
        return text
    try:
        reshaped = arabic_reshaper.reshape(text)
        bidi_text = get_display(reshaped)
        return bidi_text
    except Exception:
        return text


def build_styles():
    """Build enhanced PDF styles"""
    styles = getSampleStyleSheet()

    # Title Style
    styles.add(ParagraphStyle(
        name="TitleAR",
        parent=styles["Title"],
        fontName=AR_FONT_NAME,
        fontSize=24,
        leading=28,
        alignment=2,  # Right align
        textColor=colors.HexColor("#1e40af"),
        spaceAfter=10,
        fontWeight='BOLD'
    ))

    # Subtitle
    styles.add(ParagraphStyle(
        name="SubtitleAR",
        parent=styles["Normal"],
        fontName=AR_FONT_NAME,
        fontSize=12,
        leading=16,
        alignment=2,
        textColor=colors.HexColor("#6b7280"),
        spaceAfter=6,
    ))

    # Section Header
    styles.add(ParagraphStyle(
        name="SectionHeaderAR",
        parent=styles["Normal"],
        fontName=AR_FONT_NAME,
        fontSize=14,
        leading=18,
        alignment=2,
        textColor=colors.HexColor("#111827"),
        spaceAfter=8,
        spaceBefore=12,
        fontWeight='BOLD'
    ))

    # Label
    styles.add(ParagraphStyle(
        name="LabelAR",
        parent=styles["Normal"],
        fontName=AR_FONT_NAME,
        fontSize=10,
        leading=14,
        alignment=2,
        textColor=colors.HexColor("#374151"),
    ))

    # Value
    styles.add(ParagraphStyle(
        name="ValueAR",
        parent=styles["Normal"],
        fontName=AR_FONT_NAME,
        fontSize=10,
        leading=14,
        alignment=2,
        textColor=colors.HexColor("#111827"),
    ))

    # Small Text
    styles.add(ParagraphStyle(
        name="SmallAR",
        parent=styles["Normal"],
        fontName=AR_FONT_NAME,
        fontSize=8,
        leading=11,
        alignment=2,
        textColor=colors.HexColor("#6b7280"),
    ))

    # Table Header
    styles.add(ParagraphStyle(
        name="TableHeaderAR",
        parent=styles["Normal"],
        fontName=AR_FONT_NAME,
        fontSize=9,
        leading=12,
        alignment=2,
        textColor=colors.white,
    ))

    # Table Cell
    styles.add(ParagraphStyle(
        name="TableCellAR",
        parent=styles["Normal"],
        fontName=AR_FONT_NAME,
        fontSize=9,
        leading=12,
        alignment=2,
        textColor=colors.HexColor("#111827"),
    ))

    return styles


def format_currency(value) -> str:
    """Format number as currency"""
    try:
        value = float(value)
    except Exception:
        value = 0.0
    return f"{value:,.2f} ج.م"


def parse_amount(value) -> float:
    """Parse amount to float"""
    try:
        return float(value)
    except Exception:
        return 0.0


def format_datetime(dt_str: str) -> str:
    """Format datetime string"""
    if not dt_str:
        return ""
    try:
        dt = datetime.fromisoformat(dt_str.replace(" ", "T"))
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return dt_str


def create_header(data: dict, styles) -> list:
    """Create enhanced PDF header with logo and branding"""
    elements = []
    
    # Company Header with Gradient Effect
    header_data = [[
        Paragraph(format_arabic("ELOS"), styles["TitleAR"]),
        Paragraph(format_arabic("كشف حساب العميل"), styles["TitleAR"])
    ]]
    
    header_table = Table(header_data, colWidths=[9*cm, 9*cm])
    header_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f0f9ff")),
        ('BOX', (0, 0), (-1, -1), 2, colors.HexColor("#3b82f6")),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    
    elements.append(header_table)
    elements.append(Spacer(1, 0.5*cm))
    
    # Document Info
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    date_from = data.get("date_from")
    date_to = data.get("date_to")
    
    if date_from or date_to:
        period_text = f"الفترة: من {date_from or '-'} إلى {date_to or '-'}"
    else:
        period_text = "الفترة: كل الحركات"
    
    info_text = f"تاريخ الإصدار: {now_str} • {period_text}"
    elements.append(Paragraph(format_arabic(info_text), styles["SmallAR"]))
    elements.append(Spacer(1, 0.7*cm))
    
    return elements


def create_client_section(client: dict, styles) -> list:
    """Create client information section"""
    elements = []
    
    # Section Title
    elements.append(Paragraph(format_arabic("📋 بيانات العميل"), styles["SectionHeaderAR"]))
    elements.append(Spacer(1, 0.3*cm))
    
    # Client Info Grid
    client_rows = [
        [
            Paragraph(format_arabic("اسم العميل"), styles["LabelAR"]),
            Paragraph(format_arabic(client.get("name", "")), styles["ValueAR"]),
            Paragraph(format_arabic("رقم الهاتف"), styles["LabelAR"]),
            Paragraph(format_arabic(client.get("phone", "")), styles["ValueAR"]),
        ],
        [
            Paragraph(format_arabic("العنوان"), styles["LabelAR"]),
            Paragraph(format_arabic(client.get("address", "") or "-"), styles["ValueAR"]),
            Paragraph(format_arabic("الرصيد الحالي"), styles["LabelAR"]),
            Paragraph(format_arabic(format_currency(client.get("balance", 0))), styles["ValueAR"]),
        ],
    ]
    
    client_table = Table(client_rows, colWidths=[3*cm, 5.5*cm, 3*cm, 5.5*cm])
    client_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#3b82f6")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#eff6ff")),
        ('BACKGROUND', (2, 0), (2, -1), colors.HexColor("#eff6ff")),
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    
    elements.append(client_table)
    elements.append(Spacer(1, 0.8*cm))
    
    return elements


def create_summary_section(summary: dict, client: dict, styles) -> list:
    """Create enhanced summary section with visual cards"""
    elements = []
    
    # Section Title
    elements.append(Paragraph(format_arabic("📊 ملخص الحساب"), styles["SectionHeaderAR"]))
    elements.append(Spacer(1, 0.3*cm))
    
    total_sales = parse_amount(summary.get("total_sales", 0))
    total_payments = parse_amount(summary.get("total_payments", 0))
    closing_balance = parse_amount(summary.get("closing_balance", client.get("balance", 0)))
    
    # Determine balance type
    if closing_balance > 0:
        balance_type = "رصيد مدين على العميل"
        balance_color = colors.HexColor("#ef4444")
    elif closing_balance < 0:
        balance_type = "رصيد دائن للعميل"
        balance_color = colors.HexColor("#10b981")
    else:
        balance_type = "الحساب مغلق"
        balance_color = colors.HexColor("#6b7280")
    
    # Summary Stats
    summary_rows = [
        [
            Paragraph(format_arabic("💰 إجمالي المبيعات"), styles["LabelAR"]),
            Paragraph(format_arabic(format_currency(total_sales)), styles["ValueAR"]),
            Paragraph(format_arabic("💳 إجمالي المدفوع"), styles["LabelAR"]),
            Paragraph(format_arabic(format_currency(total_payments)), styles["ValueAR"]),
        ],
        [
            Paragraph(format_arabic("📈 الرصيد النهائي"), styles["LabelAR"]),
            Paragraph(format_arabic(format_currency(closing_balance)), styles["ValueAR"]),
            Paragraph(format_arabic("📋 نوع الرصيد"), styles["LabelAR"]),
            Paragraph(format_arabic(balance_type), styles["ValueAR"]),
        ],
    ]
    
    summary_table = Table(summary_rows, colWidths=[3*cm, 5.5*cm, 3*cm, 5.5*cm])
    summary_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#3b82f6")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
        ('BACKGROUND', (0, 0), (1, 0), colors.HexColor("#fef3c7")),
        ('BACKGROUND', (2, 0), (3, 0), colors.HexColor("#dcfce7")),
        ('BACKGROUND', (0, 1), (1, 1), colors.HexColor("#fee2e2")),
        ('BACKGROUND', (2, 1), (3, 1), colors.HexColor("#f3f4f6")),
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    
    elements.append(summary_table)
    elements.append(Spacer(1, 1*cm))
    
    return elements


def create_transactions_table(transactions: list, client: dict, styles) -> list:
    """Create enhanced transactions table"""
    elements = []
    
    if not transactions:
        elements.append(Paragraph(
            format_arabic("لا توجد حركات مسجلة لهذا العميل."), 
            styles["SmallAR"]
        ))
        return elements
    
    # Section Title
    elements.append(Paragraph(format_arabic("📝 تفاصيل الحركات"), styles["SectionHeaderAR"]))
    elements.append(Spacer(1, 0.3*cm))
    
    # Table Header - using plain formatted text for proper Arabic rendering
    header = [
        format_arabic("التاريخ"),
        format_arabic("النوع"),
        format_arabic("البيان"),
        format_arabic("مدين"),
        format_arabic("دائن"),
        format_arabic("الرصيد"),
    ]
    
    table_data = [header]
    
    # Sort transactions by date
    sorted_txs = sorted(transactions, key=lambda tx: tx.get("created_at", "") or "")
    
    # Calculate running balance
    opening_balance = parse_amount(client.get("opening_balance", 0))
    running_balance = opening_balance
    
    for tx in sorted_txs:
        tx_type = str(tx.get("type", "")).lower()
        amount = parse_amount(tx.get("amount"))
        
        debit = 0
        credit = 0
        
        if tx_type == "sale":
            type_label = "فاتورة 📄"
            debit = amount
            running_balance += amount
        elif tx_type == "payment":
            type_label = "سداد 💳"
            credit = amount
            running_balance -= amount
        else:
            type_label = tx_type
            debit = amount
            running_balance += amount
        
        row = [
            Paragraph(format_arabic(format_datetime(tx.get("created_at", ""))), styles["TableCellAR"]),
            Paragraph(format_arabic(type_label), styles["TableCellAR"]),
            Paragraph(format_arabic(tx.get("description", "")), styles["TableCellAR"]),
            Paragraph(format_arabic(format_currency(debit) if debit else "-"), styles["TableCellAR"]),
            Paragraph(format_arabic(format_currency(credit) if credit else "-"), styles["TableCellAR"]),
            Paragraph(format_arabic(format_currency(running_balance)), styles["TableCellAR"]),
        ]
        table_data.append(row)
    
    # Table styling
    col_widths = [2.5*cm, 2.5*cm, 6*cm, 2.5*cm, 2.5*cm, 2.5*cm]
    
    tx_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    
    # Build table style
    tx_table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1e40af")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), AR_FONT_NAME),  # Arabic font for header
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),  # Center headers
        ('ALIGN', (0, 1), (-1, -1), 'RIGHT'),  # Right align content
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#3b82f6")),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]
    
    # Alternate row colors
    for i in range(1, len(table_data)):
        if i % 2 == 0:
            tx_table_style.append(
                ('BACKGROUND', (0, i), (-1, i), colors.HexColor("#f9fafb"))
            )
    
    tx_table.setStyle(TableStyle(tx_table_style))
    elements.append(tx_table)
    
    return elements


def create_footer(styles) -> list:
    """Create PDF footer"""
    elements = []
    
    elements.append(Spacer(1, 1*cm))
    
    # Footer line
    footer_line = Table([[""]], colWidths=[18*cm])
    footer_line.setStyle(TableStyle([
        ('LINEABOVE', (0, 0), (-1, 0), 2, colors.HexColor("#3b82f6")),
    ]))
    elements.append(footer_line)
    elements.append(Spacer(1, 0.3*cm))
    
    # Footer text
    footer_text = "ELOS Accounting System • نظام محاسبي متكامل"
    elements.append(Paragraph(format_arabic(footer_text), styles["SmallAR"]))
    
    return elements


def create_statement_pdf(data: dict, output_path: str) -> str:
    """Main function to create enhanced PDF statement"""
    register_arabic_font()
    styles = build_styles()
    
    # Create PDF document
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=1.5*cm,
        leftMargin=1.5*cm,
        topMargin=1.5*cm,
        bottomMargin=2*cm,
    )
    
    story = []
    
    # Build PDF content
    client = data.get("client", {}) or {}
    summary = data.get("summary", {}) or {}
    transactions = data.get("transactions", []) or []
    
    # Add sections
    story.extend(create_header(data, styles))
    story.extend(create_client_section(client, styles))
    story.extend(create_summary_section(summary, client, styles))
    story.extend(create_transactions_table(transactions, client, styles))
    story.extend(create_footer(styles))
    
    # Build PDF
    doc.build(story)
    
    return output_path


def main():
    """Main entry point"""
    try:
        if len(sys.argv) > 1:
            with open(sys.argv[1], "r", encoding="utf-8") as f:
                data = json.load(f)
            output_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.getcwd(), "statement.pdf")
        else:
            raw = sys.stdin.read()
            data = json.loads(raw)
            output_path = data.get("output_path") or os.path.join(os.getcwd(), "statement.pdf")
        
        result_path = create_statement_pdf(data, output_path)
        print(json.dumps({"success": True, "path": result_path}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()