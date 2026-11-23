import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CalculationResult, Regime, Incoterm, ArticleResult } from '../types';
import { formatDecimal, formatRounded } from './calculations';

export const generatePDFReport = (
  result: CalculationResult,
  regime: Regime,
  incoterm: Incoterm
) => {
  const doc = new jsPDF() as any;
  const navyBlue: [number, number, number] = [30, 58, 138];
  const emeraldGreen: [number, number, number] = [5, 150, 105];
  const slateDark: [number, number, number] = [30, 41, 59];

  const fmtMAD = (val: number) => `${formatRounded(val)} DH`;
  const fmtMADNum = (val: number) => formatRounded(val);
  const fmtEUR = (val: number) => `${formatDecimal(val, 2)} €`;
  const fmtKG = (val: number) => `${formatRounded(val)} KG`;

  const has023 = !!result.regime023;
  const hasAT = !!result.regimeAT;
  const isMixed = has023 && hasAT;

  const isCFR = incoterm === Incoterm.CFR;
  const isDAT = incoterm === Incoterm.DAT;

  let atDUMName = 'DUM AT';
  if (regime === Regime.ONLY_311 || regime === Regime.MIXED_311) atDUMName = 'DUM 311 (AT)';
  if (regime === Regime.MIXED_312) atDUMName = 'DUM 312 EMBALLAGE';

  // Ensure exact reconciliation between rounded DUM columns and TOTAL GÉNÉRAL
  const r023 = result.regime023;
  const rAT = result.regimeAT;

  const totalCVRounded = isMixed
    ? Math.round(r023!.valeurMAD) + Math.round(rAT!.valeurMAD)
    : Math.round(result.totalValeurMAD);
  const totalFretRounded = isMixed
    ? Math.round(r023!.fretMAD) + Math.round(rAT!.fretMAD)
    : Math.round(result.totalFretMAD);
  const totalAssuranceRounded = isMixed
    ? Math.round(r023!.assuranceMAD) + Math.round(rAT!.assuranceMAD)
    : Math.round(result.totalAssuranceMAD);
  const totalRoyaltiesRounded = isMixed
    ? Math.round(r023!.royaltiesMAD) + Math.round(rAT!.royaltiesMAD)
    : Math.round(result.totalRoyaltiesMAD);
  const totalVDRounded = isMixed
    ? Math.round(r023!.valeurDouaneTotal) + Math.round(rAT!.valeurDouaneTotal)
    : Math.round(result.totalValeurDouane);
  const totalPoidsRounded = isMixed
    ? Math.round(r023!.poidsBrut) + Math.round(rAT!.poidsBrut)
    : Math.round(result.totalPoidsBrut);

  // Header Section
  doc.setFillColor(...navyBlue);
  doc.rect(0, 0, 210, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('DOUANE MAROC CALCULATOR', 105, 14, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Édité le ${new Date().toLocaleString('fr-FR')}`, 105, 22, { align: 'center' });

  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.line(45, 26, 165, 26);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `INCOTERM: ${incoterm}  |  RÉGIME: ${regime}  |  TAUX: ${formatDecimal(result.tauxEurMad, 4)} DH  |  ASSURANCE: ${formatDecimal(result.assuranceTaux, 2)}%`,
    105,
    33,
    { align: 'center' }
  );

  let yPos = 50;

  // Section 1: Summary Table
  doc.setTextColor(...navyBlue);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('1. RÉSUMÉ GLOBAL ET RÉPARTITION PAR DUM', 15, yPos);
  yPos += 5;

  const headers: string[][] = [
    isMixed
      ? ['ÉLÉMENTS DE CALCUL', 'DUM 023', atDUMName, 'TOTAL GÉNÉRAL']
      : hasAT
        ? ['ÉLÉMENTS DE CALCUL', atDUMName, 'TOTAL GÉNÉRAL']
        : ['ÉLÉMENTS DE CALCUL', 'DUM 023', 'TOTAL GÉNÉRAL']
  ];

  const fretLabel = isCFR
    ? 'Fret (MAD) — Inclus / Exclu VD'
    : isDAT
      ? 'Fret (MAD) — Inclus'
      : 'Fret (MAD)';

  const makeSummaryRow = (
    label: string,
    val023: string,
    valAT: string,
    valTotal: string
  ) => {
    if (isMixed) return [label, val023, valAT, valTotal];
    if (hasAT) return [label, valAT, valTotal];
    return [label, val023, valTotal];
  };

  const rows: any[] = [
    makeSummaryRow(
      'Valeur Marchandise (EUR)',
      has023 ? fmtEUR(r023!.valeurEUR) : '',
      hasAT ? fmtEUR(rAT!.valeurEUR) : '',
      fmtEUR(result.totalValeurEUR)
    ),
    makeSummaryRow(
      'Contre-Valeur (MAD)',
      has023 ? fmtMAD(r023!.valeurMAD) : '',
      hasAT ? fmtMAD(rAT!.valeurMAD) : '',
      fmtMAD(totalCVRounded)
    ),
    makeSummaryRow(
      isCFR ? 'Poids Net (KG)' : 'Poids Brut (KG)',
      has023 ? fmtKG(r023!.poidsBrut) : '',
      hasAT ? fmtKG(rAT!.poidsBrut) : '',
      fmtKG(totalPoidsRounded)
    )
  ];

  if (!isDAT) {
    rows.push(
      makeSummaryRow(
        fretLabel,
        has023 ? fmtMAD(r023!.fretMAD) : '',
        hasAT ? fmtMAD(rAT!.fretMAD) : '',
        fmtMAD(totalFretRounded)
      )
    );
  }

  rows.push(
    makeSummaryRow(
      `Assurance (${formatDecimal(result.assuranceTaux, 2)}%)`,
      has023 ? fmtMAD(r023!.assuranceMAD) : '',
      hasAT ? fmtMAD(rAT!.assuranceMAD) : '',
      fmtMAD(totalAssuranceRounded)
    )
  );

  if (!isDAT) {
    rows.push(
      makeSummaryRow(
        'Acconage (MAD)',
        has023 ? fmtMAD(r023!.royaltiesMAD) : '',
        hasAT ? fmtMAD(rAT!.royaltiesMAD) : '',
        fmtMAD(totalRoyaltiesRounded)
      )
    );
  }

  const totalCell = {
    content: fmtMAD(totalVDRounded),
    styles: { fontStyle: 'bold', fillColor: [254, 243, 199], textColor: [146, 64, 14] }
  };
  const cell023 = has023
    ? {
        content: fmtMAD(r023!.valeurDouaneTotal),
        styles: { fontStyle: 'bold', fillColor: [239, 246, 255], textColor: navyBlue }
      }
    : null;
  const cellAT = hasAT
    ? {
        content: fmtMAD(rAT!.valeurDouaneTotal),
        styles: { fontStyle: 'bold', fillColor: [236, 253, 245], textColor: emeraldGreen }
      }
    : null;

  const totalRow: any[] = [
    { content: 'TOTAL GÉNÉRAL DÉCLARÉ (VD)', styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: slateDark } }
  ];
  if (cell023) totalRow.push(cell023);
  if (cellAT) totalRow.push(cellAT);
  totalRow.push(totalCell);

  rows.push(totalRow);

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
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      halign: 'right',
      font: 'helvetica'
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', textColor: [51, 65, 85], cellWidth: 58 }
    },
    didParseCell: (data: any) => {
      if (data.section === 'head') {
        if (isMixed) {
          if (data.column.index === 2) data.cell.styles.fillColor = emeraldGreen;
          if (data.column.index === 3) data.cell.styles.fillColor = slateDark;
        } else if (hasAT) {
          if (data.column.index === 1) data.cell.styles.fillColor = emeraldGreen;
          if (data.column.index === 2) data.cell.styles.fillColor = slateDark;
        } else {
          if (data.column.index === 2) data.cell.styles.fillColor = slateDark;
        }
      }
    }
  });

  // Helper function to render article tables with rounded MAD values and TOTAL footer row
  const renderArticleTable = (
    title: string,
    articles: ArticleResult[],
    color: [number, number, number]
  ) => {
    yPos = doc.lastAutoTable.finalY + 11;
    if (yPos > 235) {
      doc.addPage();
      yPos = 20;
    }

    doc.setTextColor(...color);
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 15, yPos);
    yPos += 4;

    const showFretCol = !isDAT && !isCFR;
    const showAcconageCol = !isDAT;

    const headCols = ['Art.', 'Désignation', 'Valeur (€)', 'CV (MAD)'];
    if (showFretCol) headCols.push('Fret (MAD)');
    headCols.push('Assur. (MAD)');
    if (showAcconageCol) headCols.push('Acconage');
    headCols.push('VD Article');

    const articleRows = articles.map(art => {
      const r: string[] = [
        `#${art.id}`,
        art.designation,
        formatDecimal(art.valeurEUR, 2),
        fmtMADNum(art.contreValeurMAD)
      ];
      if (showFretCol) r.push(fmtMADNum(art.fretProRataMAD));
      r.push(fmtMADNum(art.assuranceMAD));
      if (showAcconageCol) r.push(fmtMADNum(art.partRoyaltiesMAD));
      r.push(fmtMADNum(art.valeurDouaneArticle));
      return r;
    });

    const sumEUR = articles.reduce((s, a) => s + a.valeurEUR, 0);
    const sumCV = articles.reduce((s, a) => s + Math.round(a.contreValeurMAD), 0);
    const sumFret = articles.reduce((s, a) => s + Math.round(a.fretProRataMAD), 0);
    const sumAssur = articles.reduce((s, a) => s + Math.round(a.assuranceMAD), 0);
    const sumAcc = articles.reduce((s, a) => s + Math.round(a.partRoyaltiesMAD), 0);
    const sumVD = articles.reduce((s, a) => s + Math.round(a.valeurDouaneArticle), 0);

    const footRow: string[] = [
      '',
      'TOTAL',
      formatDecimal(sumEUR, 2),
      fmtMADNum(sumCV)
    ];
    if (showFretCol) footRow.push(fmtMADNum(sumFret));
    footRow.push(fmtMADNum(sumAssur));
    if (showAcconageCol) footRow.push(fmtMADNum(sumAcc));
    footRow.push(fmtMAD(sumVD));

    autoTable(doc, {
      startY: yPos,
      head: [headCols],
      body: articleRows,
      foot: [footRow],
      theme: 'striped',
      headStyles: { fillColor: color, halign: 'center', fontSize: 8, cellPadding: 2.8 },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        halign: 'right',
        fontSize: 8,
        cellPadding: 3
      },
      styles: {
        fontSize: 7.8,
        halign: 'right',
        cellPadding: 2.4,
        font: 'helvetica',
        valign: 'middle'
      },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
        1: { halign: 'left', cellWidth: 'auto' }
      },
      didParseCell: (data: any) => {
        if (data.section === 'foot' && data.column.index === 1) {
          data.cell.styles.halign = 'left';
        }
      }
    });
  };

  if (isMixed) {
    renderArticleTable('2. DÉTAIL DES ARTICLES — DUM 023', result.perArticle023, navyBlue);
    renderArticleTable(`3. DÉTAIL DES ARTICLES — ${atDUMName}`, result.perArticleAT, emeraldGreen);
  } else if (hasAT) {
    renderArticleTable(`2. ANALYSE DÉTAILLÉE PAR ARTICLE (${atDUMName})`, result.perArticleAT, emeraldGreen);
  } else {
    renderArticleTable('2. ANALYSE DÉTAILLÉE PAR ARTICLE (DUM 023)', result.perArticle023, navyBlue);
  }

  // Grand Total Summary Box at bottom
  yPos = doc.lastAutoTable.finalY + 10;
  if (yPos > 258) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...navyBlue);
  doc.setLineWidth(0.5);
  doc.roundedRect(15, yPos, 180, 20, 2, 2, 'FD');

  doc.setTextColor(...slateDark);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL GÉNÉRAL VALEUR EN DOUANE (TOUS RÉGIMES CONFONDUS)', 20, yPos + 8);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const metaParts = [
    `Incoterm ${incoterm}`,
    `Régime ${regime}`,
    `Marchandise: ${fmtEUR(result.totalValeurEUR)}`,
    `Assurance: ${fmtMAD(totalAssuranceRounded)}`
  ];
  if (!isDAT) metaParts.push(`Acconage: ${fmtMAD(totalRoyaltiesRounded)}`);
  doc.text(metaParts.join('  ·  '), 20, yPos + 15);

  doc.setTextColor(...navyBlue);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtMAD(totalVDRounded), 190, yPos + 12.5, { align: 'right' });

  // Footer / Page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} / ${pageCount}`, 105, 285, { align: 'center' });
    doc.text('Designed & Developed by Abdellah', 105, 289, { align: 'center' });
  }

  doc.save(`Rapport_Douane_${incoterm}_${regime}_${new Date().toISOString().split('T')[0]}.pdf`);
};