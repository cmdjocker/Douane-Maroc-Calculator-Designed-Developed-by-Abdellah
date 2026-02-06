import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CalculationResult, Regime, Incoterm, ArticleResult } from '../types';
import { formatDecimal, formatCurrency } from './calculations';

export const generatePDFReport = (
  result: CalculationResult,
  regime: Regime,
  incoterm: Incoterm
) => {
  const doc = new jsPDF() as any;
  const navyBlue = [30, 58, 138];
  const emeraldGreen = [5, 150, 105];
  const slateGrey = [71, 85, 105];

  const roundedDecimal = (val: number) => formatDecimal(Math.round(val), 0);
  const roundedCurrency = (val: number) => formatCurrency(Math.round(val)).replace(',00', '').replace('.00', '');

  const isMixed = regime !== Regime.ONLY_023;
  
  // Calculate "Real" freight for display purposes even if excluded from VD (CFR mode)
  const realFret023 = result.perArticle023.reduce((sum, r) => sum + r.fretProRataMAD, 0);
  const realFretAT = result.perArticleAT.reduce((sum, r) => sum + r.fretProRataMAD, 0);
  const realTotalFret = realFret023 + realFretAT;

  // Header Section
  doc.setFillColor(...navyBlue);
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text("Douane Maroc Calculator", 105, 15, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${new Date().toLocaleString('fr-FR')}`, 105, 25, { align: 'center' });
  
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.line(60, 28, 150, 28);
  doc.text(`${incoterm} | RÉGIME: ${regime} | TAUX: ${formatDecimal(result.regime023.valeurMAD / result.regime023.valeurEUR, 4)} DH`, 105, 34, { align: 'center' });

  let yPos = 50;

  // Section 1: Summary Table
  doc.setTextColor(...navyBlue);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text("1. RÉSUMÉ GLOBAL ET RÉPARTITION PAR DUM", 15, yPos);
  yPos += 6;

  const hasAT = !!result.regimeSecondary;
  let secondaryDUMName = 'DUM AT';
  if (regime === Regime.MIXED_311) secondaryDUMName = 'DUM 311';
  if (regime === Regime.MIXED_312) secondaryDUMName = 'DUM 312 EMBALLAGE';

  const headers = [['ÉLÉMENTS DE CALCUL', 'DUM 023', hasAT ? secondaryDUMName : '', hasAT ? 'TOTAL GÉNÉRAL' : ''].filter(Boolean)];

  const rows = [
    [
      'Valeur Marchandise (EUR)', 
      formatDecimal(result.regime023.valeurEUR, 3), 
      hasAT ? formatDecimal(result.regimeSecondary!.valeurEUR, 3) : '', 
      hasAT ? formatDecimal(result.totalValeurEUR, 3) : ''
    ],
    [
      'Contre-Valeur (MAD)', 
      roundedDecimal(result.regime023.valeurMAD), 
      hasAT ? roundedDecimal(result.regimeSecondary!.valeurMAD) : '', 
      hasAT ? roundedDecimal(result.totalValeurMAD) : ''
    ],
    [
      'Poids Brut (KG)', 
      roundedDecimal(result.regime023.poidsBrut), 
      hasAT ? roundedDecimal(result.regimeSecondary!.poidsBrut) : '', 
      hasAT ? roundedDecimal(result.totalPoidsBrut) : ''
    ],
    [
      'Fret (MAD)', 
      roundedDecimal(realFret023), 
      hasAT ? roundedDecimal(realFretAT) : '', 
      hasAT ? roundedDecimal(realTotalFret) : ''
    ],
    [
      'Assurance (MAD)', 
      roundedDecimal(result.regime023.assuranceMAD), 
      hasAT ? roundedDecimal(result.regimeSecondary!.assuranceMAD) : '', 
      hasAT ? roundedDecimal(result.totalAssuranceMAD) : ''
    ],
    [
      'Acconage (MAD)', 
      roundedDecimal(result.regime023.royaltiesMAD), 
      hasAT ? roundedDecimal(result.regimeSecondary!.royaltiesMAD) : '', 
      hasAT ? roundedDecimal(result.totalRoyaltiesMAD) : ''
    ],
    [
      { content: 'VALEUR TOTAL DECLAREE', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } }, 
      { content: roundedCurrency(result.regime023.valeurDouaneTotal), styles: { fontStyle: 'bold', fillColor: [239, 246, 255], textColor: navyBlue } }, 
      hasAT ? { content: roundedCurrency(result.regimeSecondary!.valeurDouaneTotal), styles: { fontStyle: 'bold', fillColor: [236, 253, 245], textColor: emeraldGreen } } : '', 
      hasAT ? { content: roundedCurrency(result.totalValeurDouane), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [185, 28, 28] } } : ''
    ]
  ].map(row => row.filter((cell, idx) => idx === 0 || (idx === 1) || (hasAT && idx >= 2)));

  autoTable(doc, {
    startY: yPos,
    head: headers,
    body: rows,
    theme: 'grid',
    headStyles: { 
      fillColor: navyBlue, 
      halign: 'center', 
      fontSize: 8.5,
      cellPadding: 3.5
    },
    styles: { fontSize: 8.5, cellPadding: 3, halign: 'right', font: 'helvetica' },
    columnStyles: { 
      0: { halign: 'left', fontStyle: 'bold', textColor: [51, 65, 85], cellWidth: 55 }
    },
    didParseCell: (data: any) => {
      if (data.section === 'head' && hasAT) {
        if (data.column.index === 2) data.cell.styles.fillColor = emeraldGreen;
        if (data.column.index === 3) data.cell.styles.fillColor = slateGrey;
      }
    }
  });

  // Helper function to render article tables
  const renderArticleTable = (title: string, articles: ArticleResult[], color: number[]) => {
    yPos = doc.lastAutoTable.finalY + 12;
    if (yPos > 240) { doc.addPage(); yPos = 20; }

    doc.setTextColor(...color);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 15, yPos);
    yPos += 5;

    const articleRows = articles.map(art => [
      `#${art.id}`,
      art.designation,
      formatDecimal(art.valeurEUR, 2), 
      roundedDecimal(art.fretProRataMAD),
      roundedDecimal(art.assuranceMAD),
      roundedDecimal(art.partRoyaltiesMAD),
      roundedDecimal(art.valeurDouaneArticle)
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Article', 'Désignation', 'Valeur (€)', 'Fret (MAD)', 'Assur.', 'Acconage', 'VD Article']],
      body: articleRows,
      theme: 'striped',
      headStyles: { fillColor: color, halign: 'center', fontSize: 8.5, cellPadding: 3 },
      styles: { 
        fontSize: 8, 
        halign: 'right', 
        cellPadding: 2.5, 
        font: 'helvetica',
        valign: 'middle'
      },
      columnStyles: { 
        0: { halign: 'center', fontStyle: 'bold', cellWidth: 15 },
        1: { halign: 'left', cellWidth: 'auto' }
      }
    });
  };

  // Detailed breakdown
  if (!isMixed) {
    renderArticleTable("2. ANALYSE DÉTAILLÉE PAR ARTICLE (DUM 023)", result.perArticle023, navyBlue);
  } else {
    renderArticleTable("2. DÉTAIL DES ARTICLES - DUM 023", result.perArticle023, navyBlue);
    renderArticleTable(`3. DÉTAIL DES ARTICLES - ${secondaryDUMName}`, result.perArticleAT, emeraldGreen);
  }

  // Footer / Page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160);
    doc.text(`Page ${i} / ${pageCount}`, 105, 285, { align: 'center' });
    doc.text("Designed & Developed by Abdellah", 105, 289, { align: 'center' });
  }

  doc.save(`Rapport_Douane_${new Date().toISOString().split('T')[0]}.pdf`);
};