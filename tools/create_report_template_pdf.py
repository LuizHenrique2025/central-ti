from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle


OUTPUT = Path(__file__).resolve().parents[1] / 'output' / 'pdf' / 'modelo-relatorio-central-ti.pdf'


def header_footer(canvas, document):
    canvas.saveState()
    width, height = landscape(A4)
    canvas.setFillColor(colors.HexColor('#14202D'))
    canvas.rect(0, height - 22 * mm, width, 22 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont('Helvetica-Bold', 16)
    canvas.drawString(12 * mm, height - 12 * mm, 'Central TI')
    canvas.setFont('Helvetica', 8)
    canvas.drawString(12 * mm, height - 17 * mm, 'Hospital Dia Revitalite')
    canvas.setFont('Helvetica-Bold', 8)
    canvas.drawRightString(width - 12 * mm, height - 11 * mm, 'DOCUMENTO CONFIDENCIAL')
    canvas.setFont('Helvetica', 8)
    canvas.drawRightString(width - 12 * mm, height - 16 * mm, 'Relatorio de Exclusoes - modelo padrao')
    canvas.setStrokeColor(colors.HexColor('#D7E0E7'))
    canvas.line(12 * mm, 13 * mm, width - 12 * mm, 13 * mm)
    canvas.setFillColor(colors.HexColor('#526274'))
    canvas.setFont('Helvetica', 7.5)
    canvas.drawCentredString(width / 2, 7 * mm, f'Central TI - Uso interno e auditoria - Pagina {document.page}')
    canvas.restoreState()


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    document = SimpleDocTemplate(
        str(OUTPUT), pagesize=landscape(A4),
        leftMargin=12 * mm, rightMargin=12 * mm,
        topMargin=31 * mm, bottomMargin=19 * mm,
        title='Modelo de Relatorio Central TI', author='Central TI'
    )
    styles = getSampleStyleSheet()
    title = ParagraphStyle('Title', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=18, leading=22, textColor=colors.HexColor('#172234'), spaceAfter=5)
    muted = ParagraphStyle('Muted', parent=styles['BodyText'], fontName='Helvetica', fontSize=9, leading=13, textColor=colors.HexColor('#526274'))
    heading = ParagraphStyle('Heading', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=11, leading=14, textColor=colors.HexColor('#172234'), spaceBefore=12, spaceAfter=6)
    story = [
        Paragraph('Relatorio de Exclusoes', title),
        Paragraph('Periodo: Todo o periodo  |  Emitido em: modelo de demonstracao', muted),
        Spacer(1, 8 * mm),
    ]
    metrics = Table([
        ['SOLICITACOES', 'CONCLUIDAS', 'PENDENTES', 'RECUSADAS / CANCELADAS'],
        ['24', '15', '7', '2']
    ], colWidths=[64 * mm] * 4)
    metrics.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F1F4F7')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#526274')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('FONTSIZE', (0, 1), (-1, 1), 18),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D8E0E7')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
    ]))
    story.extend([metrics, Paragraph('Tabela detalhada para auditoria', heading)])
    rows = [
        ['Ticket', 'Atendimento', 'Paciente', 'Solicitante', 'Setor', 'Tipo', 'Motivo', 'Status', 'Conclusao'],
        ['TI-0001', 'ATD-2026-001', 'Paciente de demonstracao', 'Equipe de TI', 'Atendimento', 'Exclusao de atendimento', 'Atendimento duplicado', 'Concluida', '22/08/2026 10:40'],
        ['TI-0002', 'ATD-2026-002', 'Paciente de demonstracao', 'Recepcao', 'Recepcao', 'Exclusao de fatura', 'Lancamento por engano', 'Pendente', '-'],
    ]
    details = Table(rows, colWidths=[21 * mm, 30 * mm, 38 * mm, 31 * mm, 25 * mm, 38 * mm, 38 * mm, 25 * mm, 31 * mm], repeatRows=1)
    details.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#14202D')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#172234')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 7.5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#D8E0E7')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F7F9FB')]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.extend([details, Paragraph('Este modelo e utilizado como referencia visual para todos os relatorios exportados em PDF pela Central TI.', muted)])
    document.build(story, onFirstPage=header_footer, onLaterPages=header_footer)


if __name__ == '__main__':
    main()
