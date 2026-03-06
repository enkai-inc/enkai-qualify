import PDFDocument from 'pdfkit';

interface Feature {
  id: string;
  name: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

interface ValidationData {
  overallScore: number;
  keywordScore: number;
  painPointScore: number;
  competitionScore: number;
  revenueEstimate: number;
  details: unknown;
}

interface IdeaData {
  title: string;
  description: string;
  industry: string;
  targetMarket: string;
  technologies: string[];
  features: Feature[];
  status: string;
  createdAt: Date;
}

// --- Color palette ---
const NAVY = '#1E293B';
const BLUE = '#2563EB';
const BLUE_LIGHT = '#DBEAFE';
const DARK_GRAY = '#1F2937';
const MED_GRAY = '#6B7280';
const LIGHT_GRAY = '#F3F4F6';
const BORDER_GRAY = '#E5E7EB';
const WHITE = '#FFFFFF';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  validated: { bg: '#059669', text: WHITE },
  draft: { bg: '#9CA3AF', text: WHITE },
  archived: { bg: '#DC2626', text: WHITE },
  in_progress: { bg: '#D97706', text: WHITE },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  high: { bg: '#FEE2E2', text: '#DC2626', border: '#DC2626' },
  medium: { bg: '#FEF3C7', text: '#D97706', border: '#D97706' },
  low: { bg: '#D1FAE5', text: '#059669', border: '#059669' },
};

const MARGIN = 50;
const PAGE_WIDTH_INNER = 595.28 - MARGIN * 2; // A4 width minus margins

export async function generateIdeaSummaryPdf(
  idea: IdeaData,
  validation: ValidationData | null
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: MARGIN,
      size: 'A4',
      bufferPages: true,
      info: {
        Title: idea.title,
        Author: 'Enkai Qualify',
      },
    });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ========================
    // 1. HEADER BANNER
    // ========================
    const titleFontSize = 22;
    const bannerPadX = 20;
    const bannerPadY = 16;

    // Measure title height
    doc.font('Helvetica-Bold').fontSize(titleFontSize);
    const titleHeight = doc.heightOfString(idea.title, {
      width: PAGE_WIDTH_INNER - bannerPadX * 2,
    });
    const bannerHeight = titleHeight + bannerPadY * 2;

    // Draw navy banner
    doc
      .save()
      .rect(0, 0, 595.28, bannerHeight + MARGIN)
      .fill(NAVY);

    // Title text
    doc
      .font('Helvetica-Bold')
      .fontSize(titleFontSize)
      .fillColor(WHITE)
      .text(idea.title, MARGIN + bannerPadX, MARGIN + bannerPadY, {
        width: PAGE_WIDTH_INNER - bannerPadX * 2,
      });
    doc.restore();

    // Blue accent bar below banner
    const accentY = bannerHeight + MARGIN;
    doc
      .save()
      .rect(0, accentY, 595.28, 3)
      .fill(BLUE)
      .restore();

    doc.y = accentY + 18;
    doc.x = MARGIN;

    // ========================
    // 2. STATUS BADGE + DATE
    // ========================
    const statusKey = idea.status.toLowerCase().replace(/\s+/g, '_');
    const statusColors = STATUS_COLORS[statusKey] || STATUS_COLORS.draft;
    const statusLabel = idea.status.replace(/_/g, ' ').toUpperCase();
    const dateStr = new Date(idea.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    drawPill(doc, MARGIN, doc.y, statusLabel, statusColors.bg, statusColors.text, 8);
    const pillWidth = doc.widthOfString(statusLabel) + 16;
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(MED_GRAY)
      .text(dateStr, MARGIN + pillWidth + 10, doc.y + 2);

    doc.y += 12;
    doc.moveDown(0.8);

    // ========================
    // 3. OVERVIEW
    // ========================
    drawSectionHeader(doc, 'Overview');
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor(DARK_GRAY)
      .text(idea.description, MARGIN, doc.y, {
        width: PAGE_WIDTH_INNER,
        lineGap: 3,
      });
    doc.moveDown(0.6);

    // Industry & Target Market as pills
    const tagY = doc.y;
    let tagX = MARGIN;
    if (idea.industry) {
      tagX = drawPill(doc, tagX, tagY, idea.industry, LIGHT_GRAY, DARK_GRAY, 9) + 8;
    }
    if (idea.targetMarket) {
      drawPill(doc, tagX, tagY, idea.targetMarket, LIGHT_GRAY, DARK_GRAY, 9);
    }
    doc.y = tagY + 26;
    doc.moveDown(0.4);

    // ========================
    // 4. TECHNOLOGY STACK
    // ========================
    if (idea.technologies.length > 0) {
      ensureSpace(doc, 60);
      drawSectionHeader(doc, 'Technology Stack');

      let techX = MARGIN;
      let techY = doc.y;
      const techRowHeight = 26;

      for (const tech of idea.technologies) {
        doc.font('Helvetica').fontSize(9);
        const pillW = doc.widthOfString(tech) + 16;

        // Wrap to next row if needed
        if (techX + pillW > MARGIN + PAGE_WIDTH_INNER) {
          techX = MARGIN;
          techY += techRowHeight;
        }

        drawPill(doc, techX, techY, tech, BLUE_LIGHT, BLUE, 9);
        techX += pillW + 8;
      }

      doc.y = techY + techRowHeight + 4;
    }

    // ========================
    // 5. FEATURES
    // ========================
    if (idea.features.length > 0) {
      ensureSpace(doc, 80);
      drawSectionHeader(doc, 'Features');

      for (const feature of idea.features) {
        ensureSpace(doc, 70);
        drawFeatureCard(doc, feature);
      }
    }

    // ========================
    // 6. VALIDATION SCORES
    // ========================
    ensureSpace(doc, 120);
    drawSectionHeader(doc, 'Validation Scores');

    if (!validation) {
      doc.font('Helvetica').fontSize(11).fillColor(MED_GRAY).text('Not yet validated');
      doc.moveDown(0.5);
    } else {
      drawScorePanel(doc, validation);
    }

    // ========================
    // 7. ANALYSIS DETAILS
    // ========================
    if (validation) {
      const details = validation.details as Record<string, unknown> | null;
      if (details && typeof details === 'object') {
        const hasContent =
          details.marketSize || details.competitorCount !== undefined || details.feasibilityNotes || details.summary;
        if (hasContent) {
          ensureSpace(doc, 80);
          drawSectionHeader(doc, 'Analysis Details');

          if (details.marketSize) {
            drawDetailRow(doc, 'Market Size', String(details.marketSize));
          }
          if (details.competitorCount !== undefined) {
            drawDetailRow(doc, 'Competitors Found', String(details.competitorCount));
          }
          if (details.feasibilityNotes) {
            drawDetailRow(doc, 'Feasibility', String(details.feasibilityNotes));
          }
          if (details.summary) {
            doc.moveDown(0.3);
            doc
              .font('Helvetica')
              .fontSize(10)
              .fillColor(MED_GRAY)
              .text(String(details.summary), MARGIN, doc.y, {
                width: PAGE_WIDTH_INNER,
                lineGap: 2,
              });
          }
          doc.moveDown(0.5);
        }
      }
    }

    // ========================
    // 8. PAGE FOOTERS
    // ========================
    const totalPages = doc.bufferedPageRange().count;
    const footerDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);

      const pageBottom = doc.page.height - 30;

      // Divider line
      doc
        .save()
        .strokeColor(BORDER_GRAY)
        .lineWidth(0.5)
        .moveTo(MARGIN, pageBottom - 8)
        .lineTo(MARGIN + PAGE_WIDTH_INNER, pageBottom - 8)
        .stroke()
        .restore();

      // Left: branding
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(MED_GRAY)
        .text(`Generated by Enkai Qualify  ·  ${footerDate}`, MARGIN, pageBottom, {
          width: PAGE_WIDTH_INNER / 2,
          lineBreak: false,
        });

      // Reset Y to prevent page overflow from creating blank pages
      doc.y = pageBottom;

      // Right: page number
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(MED_GRAY)
        .text(`Page ${i + 1} of ${totalPages}`, MARGIN + PAGE_WIDTH_INNER / 2, pageBottom, {
          width: PAGE_WIDTH_INNER / 2,
          align: 'right',
          lineBreak: false,
        });

      // Reset Y again after last text call on this page
      doc.y = pageBottom;
    }

    doc.end();
  });
}

// ============================================================
// Helper functions
// ============================================================

/**
 * Draw a section header: blue left accent bar + bold navy text
 */
function drawSectionHeader(doc: PDFKit.PDFDocument, title: string) {
  const y = doc.y;

  // Blue accent bar
  doc
    .save()
    .rect(MARGIN, y, 3, 18)
    .fill(BLUE)
    .restore();

  // Title text
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(NAVY)
    .text(title, MARGIN + 12, y + 1);

  doc.y = y + 26;
}

/**
 * Draw a rounded pill/badge
 * Returns the right edge X position for chaining
 */
function drawPill(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  label: string,
  bgColor: string,
  textColor: string,
  fontSize: number
): number {
  doc.font('Helvetica-Bold').fontSize(fontSize);
  const textWidth = doc.widthOfString(label);
  const pillWidth = textWidth + 16;
  const pillHeight = fontSize + 8;
  const radius = pillHeight / 2;

  // Pill background
  doc
    .save()
    .roundedRect(x, y, pillWidth, pillHeight, radius)
    .fill(bgColor)
    .restore();

  // Pill text
  doc
    .font('Helvetica-Bold')
    .fontSize(fontSize)
    .fillColor(textColor)
    .text(label, x + 8, y + 4, { width: textWidth + 2, lineBreak: false });

  return x + pillWidth;
}

/**
 * Draw a feature card with colored left border and priority badge
 */
function drawFeatureCard(doc: PDFKit.PDFDocument, feature: Feature) {
  const colors = PRIORITY_COLORS[feature.priority] || PRIORITY_COLORS.low;
  const cardX = MARGIN;
  const cardY = doc.y;
  const cardWidth = PAGE_WIDTH_INNER;

  // Measure content height
  doc.font('Helvetica-Bold').fontSize(11);
  const nameHeight = doc.heightOfString(feature.name, { width: cardWidth - 100 });
  doc.font('Helvetica').fontSize(10);
  const descHeight = doc.heightOfString(feature.description, {
    width: cardWidth - 24,
    lineGap: 2,
  });
  const cardHeight = Math.max(nameHeight + descHeight + 24, 50);

  // Card background
  doc
    .save()
    .roundedRect(cardX, cardY, cardWidth, cardHeight, 4)
    .fill(LIGHT_GRAY)
    .restore();

  // Colored left border
  doc
    .save()
    .rect(cardX, cardY, 4, cardHeight)
    .fill(colors.border)
    .restore();

  // Priority badge (top-right)
  const priorityLabel = feature.priority.toUpperCase();
  doc.font('Helvetica-Bold').fontSize(7);
  const badgeWidth = doc.widthOfString(priorityLabel) + 12;
  const badgeX = cardX + cardWidth - badgeWidth - 10;
  const badgeY = cardY + 8;

  doc
    .save()
    .roundedRect(badgeX, badgeY, badgeWidth, 14, 7)
    .fill(colors.bg)
    .restore();

  doc
    .font('Helvetica-Bold')
    .fontSize(7)
    .fillColor(colors.text)
    .text(priorityLabel, badgeX + 6, badgeY + 3, { width: badgeWidth, lineBreak: false });

  // Feature name
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(DARK_GRAY)
    .text(feature.name, cardX + 14, cardY + 10, { width: cardWidth - 100 });

  // Feature description
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(MED_GRAY)
    .text(feature.description, cardX + 14, cardY + 10 + nameHeight + 4, {
      width: cardWidth - 24,
      lineGap: 2,
    });

  doc.y = cardY + cardHeight + 8;
}

/**
 * Draw the validation score panel:
 * - Large overall score box on the left
 * - Horizontal score bars on the right
 * - Revenue as formatted text (no bar)
 */
function drawScorePanel(doc: PDFKit.PDFDocument, validation: ValidationData) {
  const panelY = doc.y;
  const scoreBoxSize = 72;
  const scoreBoxX = MARGIN;

  // --- Overall score box ---
  const overallColor = scoreColor(validation.overallScore);

  doc
    .save()
    .roundedRect(scoreBoxX, panelY, scoreBoxSize, scoreBoxSize, 6)
    .fill(overallColor)
    .restore();

  doc
    .font('Helvetica-Bold')
    .fontSize(32)
    .fillColor(WHITE)
    .text(String(validation.overallScore), scoreBoxX, panelY + 12, {
      width: scoreBoxSize,
      align: 'center',
      lineBreak: false,
    });

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(WHITE)
    .text('/ 100', scoreBoxX, panelY + 48, {
      width: scoreBoxSize,
      align: 'center',
      lineBreak: false,
    });

  // --- Sub-score bars to the right ---
  const barAreaX = scoreBoxX + scoreBoxSize + 20;
  const barAreaWidth = PAGE_WIDTH_INNER - scoreBoxSize - 20;
  let barY = panelY + 4;

  const subScores = [
    { label: 'Keyword Score', value: validation.keywordScore },
    { label: 'Pain Point Score', value: validation.painPointScore },
    { label: 'Competition Score', value: validation.competitionScore },
  ];

  for (const s of subScores) {
    drawHorizontalBar(doc, barAreaX, barY, barAreaWidth, s.label, s.value);
    barY += 22;
  }

  // --- Revenue (formatted, no bar) ---
  const revenueStr = formatRevenue(validation.revenueEstimate);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(MED_GRAY)
    .text('Revenue Estimate', barAreaX, barY + 2, { continued: true, lineBreak: false });
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(DARK_GRAY)
    .text(`   ${revenueStr}`, { lineBreak: false });

  doc.y = panelY + scoreBoxSize + 12;
}

/**
 * Draw a single horizontal bar with label and value
 */
function drawHorizontalBar(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  totalWidth: number,
  label: string,
  value: number
) {
  const labelWidth = 130;
  const valueWidth = 35;
  const barX = x + labelWidth + valueWidth + 8;
  const barWidth = totalWidth - labelWidth - valueWidth - 12;
  const barHeight = 10;

  // Label
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(MED_GRAY)
    .text(label, x, y + 1, { width: labelWidth, lineBreak: false });

  // Value
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(DARK_GRAY)
    .text(String(value), x + labelWidth, y + 1, { width: valueWidth, align: 'right', lineBreak: false });

  // Bar background
  doc
    .save()
    .roundedRect(barX, y + 2, barWidth, barHeight, 3)
    .fill(BORDER_GRAY)
    .restore();

  // Bar fill
  const fillWidth = Math.max(Math.min((value / 100) * barWidth, barWidth), 0);
  if (fillWidth > 0) {
    doc
      .save()
      .roundedRect(barX, y + 2, fillWidth, barHeight, 3)
      .fill(scoreColor(value))
      .restore();
  }
}

/**
 * Draw a detail row: bold label + body text
 */
function drawDetailRow(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(DARK_GRAY)
    .text(`${label}:`, MARGIN, doc.y, { continued: true });
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(MED_GRAY)
    .text(`  ${value}`, { lineGap: 2 });
  doc.moveDown(0.2);
}

/**
 * Ensure minimum vertical space remains on current page, else add page
 */
function ensureSpace(doc: PDFKit.PDFDocument, minSpace: number) {
  const remaining = doc.page.height - doc.y - 50; // 50 for footer area
  if (remaining < minSpace) {
    doc.addPage();
  }
}

/**
 * Return a color based on score range
 */
function scoreColor(score: number): string {
  if (score >= 75) return '#059669'; // green
  if (score >= 50) return '#2563EB'; // blue
  if (score >= 25) return '#D97706'; // amber
  return '#DC2626'; // red
}

/**
 * Format revenue as $X.XM or $X.XK
 */
function formatRevenue(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `$${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const thousands = value / 1_000;
    return `$${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)}K`;
  }
  return `$${value.toLocaleString()}`;
}
