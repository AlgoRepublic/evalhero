import jsPDF from 'jspdf';
import dayjs from 'dayjs';
import type { ComprehensiveTagStatsData } from '../services/tagsApi';
import type { Organization } from '../features/auth/authSlice';

/**
 * Generate PDF programmatically from stats data
 * Enhanced UI with charts and professional design
 */
export async function generateStatsPDF(
  stats: ComprehensiveTagStatsData,
  options: {
    title?: string;
    filename?: string;
    dateRange?: { startDate?: string; endDate?: string };
    tagName?: string;
    filterInfo?: {
      selectedSubjectIds?: string[];
      selectedSubjectId?: string;
      subjects?: Array<{ _id: string; user?: { name?: string } | string }>;
      selectedTagId?: string;
    };
    organization?: Organization;
  } = {}
): Promise<void> {
  const {
    // title = 'Tag Statistics Report',
    filename,
    // dateRange: _dateRange, // Used in commented-out filters section
    // tagName: _tagName, // Used in commented-out filters section
    // filterInfo: _filterInfo, // Used in commented-out filters section
    organization,
  } = options;

  try {
    // Create PDF in A4 format
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    let yPosition = margin;

    // Modern color palette with improved combinations
    const colors = {
      // Primary brand colors - modern blue gradient
      primary: [59, 130, 246], // Modern blue
      primaryDark: [37, 99, 235], // Darker blue for depth
      primaryLight: [147, 197, 253], // Light blue for accents
      
      // Success - modern green
      success: [34, 197, 94], // Vibrant green
      successDark: [22, 163, 74],
      successLight: [134, 239, 172],
      
      // Warning - modern amber/orange
      warning: [251, 146, 60], // Warm orange
      warningDark: [234, 88, 12],
      warningLight: [254, 215, 170],
      
      // Error - modern red
      error: [239, 68, 68], // Clean red
      errorDark: [220, 38, 38],
      errorLight: [254, 202, 202],
      
      // Info - modern cyan/teal
      info: [14, 165, 233], // Bright cyan
      infoDark: [2, 132, 199],
      infoLight: [125, 211, 252],
      
      // Purple - modern violet
      purple: [139, 92, 246], // Vibrant purple
      purpleDark: [124, 58, 237],
      purpleLight: [196, 181, 253],
      
      // Neutrals - modern grays
      gray: [107, 114, 128], // Medium gray
      lightGray: [249, 250, 251], // Very light gray
      darkGray: [75, 85, 99], // Dark gray for text
      borderGray: [229, 231, 235], // Border gray
      
      // Background colors
      bgWhite: [255, 255, 255],
      bgLight: [248, 250, 252], // Subtle background
    };

    // Helper function to add a new page if needed
    const checkPageBreak = (requiredHeight: number) => {
      if (yPosition + requiredHeight > pageHeight - margin - 15) {
        pdf.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    // Helper function to draw a section divider
    const drawSectionDivider = (y: number) => {
      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(0.5);
      pdf.line(margin, y, pageWidth - margin, y);
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.2);
    };


    // Helper function to draw a proper pie/donut chart with actual proportional slices
    const drawPieChart = (x: number, y: number, radius: number, data: { value: number; color: number[]; label: string }[]) => {
      const total = data.reduce((sum, item) => sum + item.value, 0);
      if (total === 0) return;

      const innerRadius = radius * 0.5; // For donut chart effect
      let currentAngle = -90; // Start from top (12 o'clock)

      // Verify data proportions
      // For example: Passed=3, Failed=7, Total=10
      // Passed slice = 3/10 * 360 = 108 degrees
      // Failed slice = 7/10 * 360 = 252 degrees

      // Draw each pie slice with proper proportions
      data.forEach((item) => {
        const sliceAngle = (item.value / total) * 360;
        if (sliceAngle <= 0) return;

        const startAngleRad = (currentAngle * Math.PI) / 180;
        const endAngleRad = ((currentAngle + sliceAngle) * Math.PI) / 180;

        // Set color for this slice
        pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
        pdf.setDrawColor(item.color[0], item.color[1], item.color[2]);
        pdf.setLineWidth(0.3);

        // Draw filled slice using many closely spaced radial lines
        // This creates a solid filled appearance
        // Calculation verification: For Passed=3, Failed=7, Total=10:
        //   Passed slice = (3/10) * 360 = 108 degrees (30% of circle)
        //   Failed slice = (7/10) * 360 = 252 degrees (70% of circle)
        const numRadialLines = Math.max(40, Math.ceil(sliceAngle / 1.2)); // More lines = better fill
        
        pdf.setLineWidth(0.6); // Thicker lines for better fill
        
        for (let i = 0; i <= numRadialLines; i++) {
          const angle = currentAngle + (i * sliceAngle / numRadialLines);
          const angleRad = (angle * Math.PI) / 180;
          
          // Draw line from inner radius to outer radius
          const innerX = x + innerRadius * Math.cos(angleRad);
          const innerY = y + innerRadius * Math.sin(angleRad);
          const outerX = x + radius * Math.cos(angleRad);
          const outerY = y + radius * Math.sin(angleRad);
          
          pdf.line(innerX, innerY, outerX, outerY);
        }
        
        // Draw concentric arcs at multiple radii to enhance filled appearance
        const numArcLayers = 12;
        for (let layer = 1; layer < numArcLayers; layer++) {
          const r = innerRadius + (layer * (radius - innerRadius) / numArcLayers);
          const arcSteps = Math.max(15, Math.ceil(sliceAngle / 1.5));
          
          pdf.setLineWidth(0.5);
          for (let i = 0; i < arcSteps; i++) {
            const angle1 = currentAngle + (i * sliceAngle / arcSteps);
            const angle2 = currentAngle + ((i + 1) * sliceAngle / arcSteps);
            const x1 = x + r * Math.cos((angle1 * Math.PI) / 180);
            const y1 = y + r * Math.sin((angle1 * Math.PI) / 180);
            const x2 = x + r * Math.cos((angle2 * Math.PI) / 180);
            const y2 = y + r * Math.sin((angle2 * Math.PI) / 180);
            pdf.line(x1, y1, x2, y2);
          }
        }

        // Draw the two radial edges (thicker for visibility)
        pdf.setLineWidth(1);
        const startInnerX = x + innerRadius * Math.cos(startAngleRad);
        const startInnerY = y + innerRadius * Math.sin(startAngleRad);
        const startOuterX = x + radius * Math.cos(startAngleRad);
        const startOuterY = y + radius * Math.sin(startAngleRad);
        pdf.line(startInnerX, startInnerY, startOuterX, startOuterY);
        
        const endInnerX = x + innerRadius * Math.cos(endAngleRad);
        const endInnerY = y + innerRadius * Math.sin(endAngleRad);
        const endOuterX = x + radius * Math.cos(endAngleRad);
        const endOuterY = y + radius * Math.sin(endAngleRad);
        pdf.line(endInnerX, endInnerY, endOuterX, endOuterY);

        currentAngle += sliceAngle;
      });

      // Draw inner white circle for donut effect (on top to cover slice inner edges)
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(1);
      pdf.circle(x, y, innerRadius, 'FD');
      
      // Draw outer border
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(1.5);
      pdf.circle(x, y, radius, 'D');
      
      // Add center text with pass rate (calculate from first data item which should be "Passed")
      // The data array is ordered: [Passed, Failed]
      const passedValue = data[0]?.value || 0;
      const passRate = total > 0 ? ((passedValue / total) * 100).toFixed(1) : '0';
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${passRate}%`, x, y + 1.5, { align: 'center' });
      
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
      pdf.text('Pass Rate', x, y + 4.5, { align: 'center' });
    };

    // Modern helper function to draw a horizontal bar chart with improved styling
    // Note: Currently using inline implementation for Score Statistics, keeping this for potential future use
    // const drawBarChart = (x: number, y: number, width: number, height: number, data: { label: string; value: number; color: number[] }[]) => {
    //   const maxValue = Math.max(...data.map(d => d.value), 1);
    //   const barY = y + 5; // Starting Y position for bars
    //   const barSpacing = 8; // Vertical spacing between bars
    //   const barHeight = 6; // Height of each bar
    //   const labelWidth = 25; // Width for labels on the left
    //   const chartAreaX = x + labelWidth + 5; // Start of chart area
    //   const chartAreaWidth = width - labelWidth - 5; // Width of chart area
      
    //   data.forEach((item, idx) => {
    //     const currentBarY = barY + (idx * barSpacing);
    //     const barLength = (item.value / maxValue) * chartAreaWidth;
        
    //     // Draw label on the left
    //     pdf.setFontSize(8);
    //     pdf.setFont('helvetica', 'normal');
    //     pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
    //     pdf.text(item.label, x, currentBarY + 4, { align: 'left' });
        
    //     // Draw horizontal bar
    //     pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
    //     pdf.roundedRect(chartAreaX, currentBarY, barLength, barHeight, 1, 1, 'F');
        
    //     // Draw value on the bar or next to it
    //     pdf.setFontSize(8);
    //     pdf.setFont('helvetica', 'bold');
    //     if (barLength > 20) {
    //       // Value on bar (white text)
    //       pdf.setTextColor(255, 255, 255);
    //       pdf.text(
    //         item.value.toFixed(1),
    //         chartAreaX + barLength / 2,
    //         currentBarY + 4.5,
    //         { align: 'center' }
    //       );
    //     } else {
    //       // Value next to bar (colored text)
    //       pdf.setTextColor(item.color[0], item.color[1], item.color[2]);
    //       pdf.text(
    //         item.value.toFixed(1),
    //         chartAreaX + barLength + 3,
    //         currentBarY + 4.5,
    //         { align: 'left' }
    //       );
    //     }
    //   });
      
    //   pdf.setTextColor(0, 0, 0);
    // };

    // Modern Professional Header with Gradient Effect
    // Main header background with modern blue
    pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    pdf.roundedRect(0, 0, pageWidth, 45, 0, 0, 'F');
    
    // Subtle gradient effect (darker at top)
    pdf.setFillColor(colors.primaryDark[0], colors.primaryDark[1], colors.primaryDark[2]);
    pdf.roundedRect(0, 0, pageWidth, 8, 0, 0, 'F');
    
    // Main branding
    pdf.setFontSize(28);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text('EVAL HERO', margin, 20);
    
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.primaryLight[0], colors.primaryLight[1], colors.primaryLight[2]);
    pdf.text('Statistics Report', margin, 28);
    
    // Organization name in header (if available)
    if (organization?.name) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(200, 220, 255);
      pdf.text(organization.name, margin, 35);
    }
    
    // Date and time - modern styling
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.primaryLight[0], colors.primaryLight[1], colors.primaryLight[2]);
    pdf.text(dayjs().format('MMMM DD, YYYY'), pageWidth - margin, 20, { align: 'right' });
    pdf.text(dayjs().format('hh:mm A'), pageWidth - margin, 26, { align: 'right' });
    
    yPosition = 55;

    // Organization Details Section - REMOVED (moved to header)

    // Report Title Section - Modern styling
    // pdf.setFontSize(20);
    // pdf.setFont('helvetica', 'bold');
    // pdf.setTextColor(colors.primaryDark[0], colors.primaryDark[1], colors.primaryDark[2]);
    // pdf.text(title, pageWidth / 2, yPosition, { align: 'center' });
    // yPosition += 12;

    // Tag Information & Filters Section - COMMENTED OUT for concise modern UI
    /*
    checkPageBreak(60);
    drawHeaderBox(yPosition, 8, colors.info);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text('Report Information & Filters', margin + 2, yPosition - 2);
    yPosition += 12;

    // Calculate dynamic height for info box
    let estimatedHeight = 20; // Base height
    if (tagName) estimatedHeight += 6;
    if (filterInfo?.selectedTagId) estimatedHeight += 5;
    estimatedHeight += 5; // Date range
    if (filterInfo?.selectedSubjectIds && filterInfo.selectedSubjectIds.length > 0) {
      estimatedHeight += Math.min(filterInfo.selectedSubjectIds.length, 5) * 4 + 5;
    } else if (filterInfo?.selectedSubjectId) {
      estimatedHeight += 5;
    } else {
      estimatedHeight += 5;
    }
    if (stats.filters) estimatedHeight += 5;

    // Tag Info Box with left border and borders on all sides (like Summary Statistics cards)
    const cornerRadius = 4;
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(colors.info[0], colors.info[1], colors.info[2]);
    pdf.setLineWidth(1);
    pdf.roundedRect(margin, yPosition, contentWidth, estimatedHeight, cornerRadius, cornerRadius, 'FD');
    
    // Left border bar (like Summary Statistics cards have top border bar)
    pdf.setFillColor(colors.info[0], colors.info[1], colors.info[2]);
    pdf.roundedRect(margin, yPosition, 4, estimatedHeight, cornerRadius, cornerRadius, 'F');
    
    let infoY = yPosition + 7;
    
    // Tag Name with icon indicator
    if (tagName) {
      // Draw colored dot indicator
      pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.circle(margin + 10, infoY - 1, 1.5, 'F');
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.text('Tag Name:', margin + 15, infoY);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);
      pdf.text(tagName, margin + 50, infoY);
      infoY += 7;
    }

    // Tag ID
    if (filterInfo?.selectedTagId) {
      pdf.setFillColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
      pdf.circle(margin + 10, infoY - 1, 1.5, 'F');
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
      pdf.text('Tag ID:', margin + 15, infoY);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'normal');
      pdf.text(filterInfo.selectedTagId.substring(0, 30) + (filterInfo.selectedTagId.length > 30 ? '...' : ''), margin + 50, infoY);
      infoY += 6;
    }

    // Date Range with calendar icon indicator
    pdf.setFillColor(colors.warning[0], colors.warning[1], colors.warning[2]);
    pdf.circle(margin + 10, infoY - 1, 1.5, 'F');
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
    pdf.text('Date Range:', margin + 15, infoY);
    pdf.setTextColor(0, 0, 0);
    if (dateRange?.startDate || dateRange?.endDate) {
      const dateStr = [
        dateRange.startDate ? dayjs(dateRange.startDate).format('MMM DD, YYYY') : 'Start',
        ' - ',
        dateRange.endDate ? dayjs(dateRange.endDate).format('MMM DD, YYYY') : 'End',
      ].join('');
      pdf.text(dateStr, margin + 50, infoY);
    } else {
      pdf.setFont('helvetica', 'bold');
      pdf.text('All Time', margin + 50, infoY);
      pdf.setFont('helvetica', 'normal');
    }
    infoY += 6;

    // Subject Filters with icon
    if (filterInfo) {
      if (filterInfo.selectedSubjectIds && filterInfo.selectedSubjectIds.length > 0 && filterInfo.subjects) {
        pdf.setFillColor(colors.success[0], colors.success[1], colors.success[2]);
        pdf.circle(margin + 10, infoY - 1, 1.5, 'F');
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
        pdf.text('Filtered Subjects:', margin + 15, infoY);
        pdf.setTextColor(0, 0, 0);
        
        const subjectNames = filterInfo.selectedSubjectIds
          .map(id => {
            const subject = filterInfo.subjects?.find((s) => s._id === id);
            if (subject) {
              const user = typeof subject.user === 'object' ? subject.user : null;
              return user?.name || 'Unknown';
            }
            return null;
          })
          .filter(Boolean)
          .slice(0, 5); // Limit to first 5 for space
        
        const subjectText = subjectNames.length > 0 
          ? subjectNames.join(', ') + (filterInfo.selectedSubjectIds.length > 5 ? ` (+${filterInfo.selectedSubjectIds.length - 5} more)` : '')
          : `${filterInfo.selectedSubjectIds.length} subject(s)`;
        
        const lines = pdf.splitTextToSize(subjectText, contentWidth - 45);
        pdf.text(lines, margin + 40, infoY);
        infoY += Math.max(lines.length * 4, 5) + 2;
      } else if (filterInfo.selectedSubjectId && filterInfo.subjects) {
        pdf.setFillColor(colors.success[0], colors.success[1], colors.success[2]);
        pdf.circle(margin + 10, infoY - 1, 1.5, 'F');
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
        pdf.text('Subject:', margin + 15, infoY);
        pdf.setTextColor(0, 0, 0);
        
        const subject = filterInfo.subjects.find((s) => s._id === filterInfo.selectedSubjectId);
        const subjectName = subject ? (typeof subject.user === 'object' ? subject.user?.name || 'Unknown' : 'Unknown') : 'Unknown';
        if (subjectName) {
          pdf.text(subjectName, margin + 50, infoY);
        }
        infoY += 6;
      } else {
        pdf.setFillColor(colors.gray[0], colors.gray[1], colors.gray[2]);
        pdf.circle(margin + 10, infoY - 1, 1.5, 'F');
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
        pdf.text('Subjects:', margin + 15, infoY);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'bold');
        pdf.text('All Subjects', margin + 50, infoY);
        pdf.setFont('helvetica', 'normal');
        infoY += 6;
      }
    }

    // Statistics from filters with icon
    if (stats.filters) {
      pdf.setFillColor(colors.purple[0], colors.purple[1], colors.purple[2]);
      pdf.circle(margin + 10, infoY - 1, 1.5, 'F');
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
      pdf.text('Analysis Includes:', margin + 15, infoY);
      pdf.setTextColor(0, 0, 0);
      
      const includes = [];
      if (stats.filters.includeGrowth) includes.push('Growth Trends');
      if (stats.filters.includeMomentum) includes.push('Momentum Analysis');
      if (includes.length > 0) {
        pdf.setFont('helvetica', 'bold');
        pdf.text(includes.join(', '), margin + 50, infoY);
        pdf.setFont('helvetica', 'normal');
      } else {
        pdf.text('Basic Statistics', margin + 50, infoY);
      }
    }

    yPosition = yPosition + estimatedHeight + 10;
    */
    pdf.setTextColor(0, 0, 0);
    drawSectionDivider(yPosition);
    yPosition += 10;

    // Summary Statistics Section with Modern Cards
    checkPageBreak(50);
    
    // Modern section header with improved styling
    pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    pdf.roundedRect(margin, yPosition - 10, contentWidth, 10, 3, 3, 'F');
    pdf.setFontSize(15);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text('Summary Statistics', margin + 4, yPosition - 2);
    yPosition += 5;

    const summaryData = [
      { label: 'Total Stats', value: stats.summary.totalStats.toString(), color: colors.primary, colorDark: colors.primaryDark },
      { label: 'Unique Submissions', value: stats.summary.uniqueSubmissions.toString(), color: colors.success, colorDark: colors.successDark },
      { label: 'Active Subjects', value: stats.summary.uniqueSubjects.toString(), color: colors.warning, colorDark: colors.warningDark },
      { label: 'Unique Assignees', value: stats.summary.uniqueAssignees.toString(), color: colors.info, colorDark: colors.infoDark },
      { label: 'Unique Questions', value: stats.summary.uniqueQuestions.toString(), color: colors.purple, colorDark: colors.purpleDark },
    ];

    const cardWidth = (contentWidth - 10) / 3;
    const cardHeight = 26;
    const cardSpacing = 5;
    let cardX = margin;
    let cardY = yPosition;

    summaryData.forEach((item, idx) => {
      if (idx > 0 && idx % 3 === 0) {
        cardX = margin;
        cardY += cardHeight + cardSpacing;
        checkPageBreak(cardHeight + cardSpacing);
      }

      // Modern card with subtle shadow effect (simulated with border)
      // Card background
      pdf.setFillColor(colors.bgWhite[0], colors.bgWhite[1], colors.bgWhite[2]);
      pdf.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(cardX, cardY, cardWidth, cardHeight, 4, 4, 'FD');
      
      // Top accent bar with modern gradient effect
      pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
      pdf.roundedRect(cardX, cardY, cardWidth, 5, 4, 4, 'F');
      
      // Subtle darker accent at very top
      pdf.setFillColor(item.colorDark[0], item.colorDark[1], item.colorDark[2]);
      pdf.roundedRect(cardX, cardY, cardWidth, 2, 4, 4, 'F');
      
      // Label with improved typography
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
      pdf.text(item.label, cardX + 5, cardY + 12);
      
      // Value with modern styling
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(item.color[0], item.color[1], item.color[2]);
      pdf.text(item.value, cardX + 5, cardY + 22);
      pdf.setTextColor(0, 0, 0);

      cardX += cardWidth + cardSpacing;
    });

    yPosition = cardY + cardHeight + 15;
    checkPageBreak(10);

    // Pass/Fail Statistics with Pie Chart - Modern Section
    yPosition += 8;
    checkPageBreak(60);
    
    // Modern section header
    pdf.setFillColor(colors.success[0], colors.success[1], colors.success[2]);
    pdf.roundedRect(margin, yPosition - 10, contentWidth, 10, 3, 3, 'F');
    pdf.setFontSize(15);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text('Pass/Fail Statistics', margin + 4, yPosition - 2);
    yPosition += 5;

    // Two column layout: data on left, chart on right
    const leftColX = margin;
    const rightColX = margin + contentWidth / 2 + 5;
    const chartY = yPosition;

    // Left column: Statistics
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    
    const passFailData = [
      { label: 'Total Evaluations', value: stats.passFail.total.toString(), color: colors.gray },
      { label: 'Passed', value: stats.passFail.passed.toString(), color: colors.success },
      { label: 'Failed', value: stats.passFail.failed.toString(), color: colors.error },
      // { label: 'Pass Rate', value: `${stats.passFail.passRate.toFixed(2)}%`, color: colors.primary },
    ];
    
    // Modern info box for pass/fail data
    const infoBoxHeight = 35;
    pdf.setFillColor(colors.bgLight[0], colors.bgLight[1], colors.bgLight[2]);
    pdf.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(leftColX, yPosition, contentWidth / 2 - 3, infoBoxHeight, 4, 4, 'FD');

    let dataY = yPosition + 8;
    passFailData.forEach((item) => {
      // Colored indicator dot
      pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
      pdf.circle(leftColX + 5, dataY - 1, 2, 'F');
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
      pdf.text(`${item.label}:`, leftColX + 10, dataY);
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(item.color[0], item.color[1], item.color[2]);
      pdf.text(item.value, leftColX + 50, dataY);
      dataY += 7;
    });

    // Enhanced modern progress bar
    // const barY = yPosition + infoBoxHeight - 12;
    // const barWidth = contentWidth / 2 - 15;
    // const barHeight = 7;
    
    // Background with modern styling
    // pdf.setFillColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
    // pdf.roundedRect(leftColX + 5, barY, barWidth, barHeight, 3.5, 3.5, 'F');
    
    // // Progress fill with gradient effect
    // pdf.setFillColor(colors.success[0], colors.success[1], colors.success[2]);
    // const progressWidth = (barWidth * stats.passFail.passRate) / 100;
    // pdf.roundedRect(leftColX + 5, barY, progressWidth, barHeight, 3.5, 3.5, 'F');
    
    // // Progress text with modern styling
    // pdf.setFontSize(10);
    // pdf.setFont('helvetica', 'bold');
    // pdf.setTextColor(255, 255, 255);
    // pdf.text(`${stats.passFail.passRate.toFixed(1)}%`, leftColX + 5 + barWidth / 2, barY + 5, { align: 'center' });

    // Right column: Pie Chart
    const pieX = rightColX + (contentWidth / 2 - 10) / 2;
    const pieY = chartY + 15;
    const pieRadius = 18;
    
    if (stats.passFail.total > 0) {
      // Draw pie chart with proper data order: Passed first (green), then Failed (red)
      // Verification: For Passed=3, Failed=7, Total=10:
      //   Passed: (3/10) * 360 = 108° (green slice from top, ~30% of circle)
      //   Failed: (7/10) * 360 = 252° (red slice continuing, ~70% of circle)
      drawPieChart(pieX, pieY, pieRadius, [
        { value: stats.passFail.passed, color: colors.success, label: 'Passed' },
        { value: stats.passFail.failed, color: colors.error, label: 'Failed' },
      ]);
      
      // Legend
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);
      
      // Passed legend
      pdf.setFillColor(colors.success[0], colors.success[1], colors.success[2]);
      pdf.rect(pieX - 15, pieY + pieRadius + 5, 3, 3, 'F');
      pdf.text(`Passed (${stats.passFail.passed})`, pieX - 11, pieY + pieRadius + 6.5);
      
      // Failed legend
      pdf.setFillColor(colors.error[0], colors.error[1], colors.error[2]);
      pdf.rect(pieX - 15, pieY + pieRadius + 10, 3, 3, 'F');
      pdf.text(`Failed (${stats.passFail.failed})`, pieX - 11, pieY + pieRadius + 12);
    }

    yPosition = Math.max(dataY + 15, pieY + pieRadius + 20);
    
    if (stats.momentum) {
      // Modern momentum display with arrow indicator
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      const momentumValue = stats.momentum.dPass || 0;
      const isPositive = momentumValue > 0;
      const isNegative = momentumValue < 0;
      
      // Arrow indicator
      pdf.setFont('helvetica', 'bold');
      if (isPositive) {
        pdf.setTextColor(colors.success[0], colors.success[1], colors.success[2]);
        pdf.text('↑', leftColX, yPosition);
      } else if (isNegative) {
        pdf.setTextColor(colors.error[0], colors.error[1], colors.error[2]);
        pdf.text('↓', leftColX, yPosition);
      } else {
        pdf.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
        pdf.text('→', leftColX, yPosition);
      }
      
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
      const momentumText = `Momentum: ${momentumValue > 0 ? '+' : ''}${momentumValue.toFixed(1)}% (last 7d vs prev 7d)`;
      pdf.text(momentumText, leftColX + 4, yPosition);
      yPosition += 8;
    }

    yPosition += 8;
    checkPageBreak(10);

    // Score Statistics with Bar Chart - Modern Section
    yPosition += 8;
    checkPageBreak(70);
    
    // Modern section header
    pdf.setFillColor(colors.warning[0], colors.warning[1], colors.warning[2]);
    pdf.roundedRect(margin, yPosition - 10, contentWidth, 10, 3, 3, 'F');
    pdf.setFontSize(15);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text('Score Statistics', margin + 4, yPosition - 2);
    yPosition += 5;

    // Score data in two columns
    const scoreData = [
      { label: 'Total Evaluations', value: stats.score.total.toString() },
      { label: 'Total Score', value: `${stats.score.earned.toFixed(2)} / ${stats.score.max.toFixed(2)}` },
      { label: 'Average Score', value: stats.score.avgScore.toFixed(2), highlight: true },
      { label: 'Average %', value: `${stats.score.avgPct.toFixed(2)}%`, highlight: true },
      { label: 'Min Score', value: stats.score.minScore.toFixed(2) },
      { label: 'Max Score', value: stats.score.maxScore.toFixed(2) },
    ];

    scoreData.forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const xPos = col === 0 ? leftColX : rightColX;
      const yPos = yPosition + row * 7;
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
      pdf.text(`${item.label}:`, xPos, yPos);
      
      pdf.setFont('helvetica', 'bold');
      if (item.highlight) {
        pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      } else {
        pdf.setTextColor(0, 0, 0);
      }
      pdf.text(item.value, xPos + 45, yPos);
    });

    yPosition += 20;

    // Modern vertical bar chart for score comparison
    const chartX = margin;
    const chartYPos = yPosition;
    const chartWidth = contentWidth;
    const chartHeight = 85; // Increased height for better visibility

    // Clean chart container
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
    pdf.setLineWidth(0.8);
    pdf.roundedRect(chartX, chartYPos, chartWidth, chartHeight, 6, 6, 'FD');

    // Prepare chart data - include Total Score (max) in comparison
    const maxValue = Math.max(stats.score.maxScore, stats.score.earned, stats.score.avgScore, stats.score.minScore, stats.score.max || 0, 1);
    const chartPadding = 15;
    const chartAreaX = chartX + chartPadding;
    const chartAreaWidth = chartWidth - (chartPadding * 2);
    const chartAreaY = chartYPos + 10;
    const chartAreaHeight = chartHeight - 25; // Space for labels and axis
    
    // Draw Y-axis and grid lines
    const axisX = chartAreaX;
    const axisY = chartAreaY + chartAreaHeight;
    const gridSteps = 5;
    
    pdf.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
    pdf.setLineWidth(0.3);
    
    // Draw horizontal grid lines
    for (let i = 0; i <= gridSteps; i++) {
      const gridY = chartAreaY + (i / gridSteps) * chartAreaHeight;
      const gridValue = maxValue - (i / gridSteps) * maxValue;
      
      // Grid line
      pdf.line(axisX, gridY, chartAreaX + chartAreaWidth, gridY);
      
      // Y-axis labels
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
      pdf.text(gridValue.toFixed(0), axisX - 3, gridY + 1.5, { align: 'right' });
    }
    
    // Draw Y-axis line
    pdf.setDrawColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
    pdf.setLineWidth(1);
    pdf.line(axisX, chartAreaY, axisX, axisY);
    
    // Draw X-axis line
    pdf.line(axisX, axisY, chartAreaX + chartAreaWidth, axisY);
    
    // Chart data with colors and labels - including Total Score
    const barData = [
      { label: 'Min', value: stats.score.minScore, color: colors.error, colorDark: colors.errorDark },
      { label: 'Avg', value: stats.score.avgScore, color: colors.primary, colorDark: colors.primaryDark },
      { label: 'Earned', value: stats.score.earned, color: colors.warning, colorDark: colors.warningDark },
      { label: 'Max', value: stats.score.maxScore, color: colors.success, colorDark: colors.successDark },
      { label: 'Total', value: stats.score.max || stats.score.maxScore, color: colors.info, colorDark: colors.infoDark },
    ];
    
    const barCount = barData.length;
    const barSpacing = 8;
    const barWidth = (chartAreaWidth - (barCount - 1) * barSpacing) / barCount;
    const baseX = axisX + 5; // Start after Y-axis
    
    barData.forEach((item, index) => {
      const barX = baseX + index * (barWidth + barSpacing);
      const barHeight = (item.value / maxValue) * chartAreaHeight;
      const barY = axisY - barHeight;
      
      // Draw bar with gradient effect
      pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
      pdf.roundedRect(barX, barY, barWidth, barHeight, 2, 2, 'F');
      
      // Darker accent at bottom for depth
      if (barHeight > 3) {
        pdf.setFillColor(item.colorDark[0], item.colorDark[1], item.colorDark[2]);
        pdf.roundedRect(barX, barY, barWidth, Math.min(4, barHeight * 0.2), 2, 2, 'F');
      }
      
      // Re-draw main bar border
      pdf.setDrawColor(item.color[0], item.color[1], item.color[2]);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(barX, barY, barWidth, barHeight, 2, 2, 'D');
      
      // Value on top of bar
      if (barHeight > 8) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(
          item.value.toFixed(1),
          barX + barWidth / 2,
          barY - 3,
          { align: 'center' }
        );
      } else {
        // Value next to bar if too small
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(item.color[0], item.color[1], item.color[2]);
        pdf.text(
          item.value.toFixed(1),
          barX + barWidth / 2,
          barY - 3,
          { align: 'center' }
        );
      }
      
      // Label below axis
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(item.color[0], item.color[1], item.color[2]);
      pdf.text(
        item.label,
        barX + barWidth / 2,
        axisY + 6,
        { align: 'center' }
      );
      
      // Value below label
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
      pdf.text(
        item.value.toFixed(1),
        barX + barWidth / 2,
        axisY + 11,
        { align: 'center' }
      );
    });
    
    // Chart title
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
    pdf.text('Score Comparison', chartAreaX + chartAreaWidth / 2, chartAreaY - 2, { align: 'center' });
    
    pdf.setTextColor(0, 0, 0);

    yPosition += chartHeight + 15; // Increased spacing after chart

    if (stats.momentum) {
      // Modern momentum display with arrow indicator
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      const momentumValue = stats.momentum.dPoints || 0;
      const isPositive = momentumValue > 0;
      const isNegative = momentumValue < 0;
      
      // Arrow indicator
      pdf.setFont('helvetica', 'bold');
      if (isPositive) {
        pdf.setTextColor(colors.success[0], colors.success[1], colors.success[2]);
        pdf.text('↑', margin, yPosition);
      } else if (isNegative) {
        pdf.setTextColor(colors.error[0], colors.error[1], colors.error[2]);
        pdf.text('↓', margin, yPosition);
      } else {
        pdf.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
        pdf.text('→', margin, yPosition);
      }
      
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
      const momentumText = `Momentum: ${momentumValue > 0 ? '+' : ''}${momentumValue.toFixed(1)}% (last 7d vs prev 7d)`;
      pdf.text(momentumText, margin + 4, yPosition);
      yPosition += 8;
    }

    // Add significant vertical margin before Tag Breakdown section
    yPosition += 15; // Increased from 5 to 15 for better spacing
    checkPageBreak(10);

    // Tag Breakdown Table - Modern Section
    if (stats.tagBreakdown && stats.tagBreakdown.length > 0) {
      yPosition += 12; // Increased spacing before section header
      checkPageBreak(40);
      
      // Modern section header
      pdf.setFillColor(colors.info[0], colors.info[1], colors.info[2]);
      pdf.roundedRect(margin, yPosition - 10, contentWidth, 10, 3, 3, 'F');
      pdf.setFontSize(15);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.text('Tag Breakdown', margin + 4, yPosition - 2);
      yPosition += 10;

      // Modern enhanced table header with better styling
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setFillColor(colors.infoDark[0], colors.infoDark[1], colors.infoDark[2]);
      pdf.roundedRect(margin, yPosition - 6, contentWidth, 9, 2, 2, 'F');
      pdf.setTextColor(255, 255, 255);
      
      pdf.text('Tag Name', margin + 4, yPosition);
      pdf.text('Count', margin + 85, yPosition);
      pdf.text('Score %', margin + 115, yPosition);
      pdf.text('Pass %', margin + 150, yPosition);
      
      yPosition += 9;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);

      const topTags = stats.tagBreakdown.slice(0, 20);
      topTags.forEach((tag, index) => {
        checkPageBreak(9);
        
        // Modern alternating row colors with subtle borders
        if (index % 2 === 0) {
          pdf.setFillColor(colors.bgLight[0], colors.bgLight[1], colors.bgLight[2]);
          pdf.roundedRect(margin, yPosition - 5, contentWidth, 8, 1, 1, 'F');
        }
        
        // Subtle border for all rows
        pdf.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
        pdf.setLineWidth(0.2);
        pdf.roundedRect(margin, yPosition - 5, contentWidth, 8, 1, 1, 'D');

        pdf.text(tag.tagName || 'N/A', margin + 4, yPosition);
        pdf.text((tag.relevantSubmissions || 0).toString(), margin + 85, yPosition);
        
        // Highlight score percentage
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        pdf.text((tag.pointsPct || 0).toFixed(2), margin + 115, yPosition);
        
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        pdf.text(`${(tag.passPct || 0).toFixed(1)}%`, margin + 150, yPosition);
        
        yPosition += 8;
      });

      if (stats.tagBreakdown.length > 20) {
        yPosition += 2;
        pdf.setFontSize(8);
        pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
        pdf.text(`(Showing top 20 of ${stats.tagBreakdown.length} tags)`, margin, yPosition);
        pdf.setTextColor(0, 0, 0);
        yPosition += 6;
      }

      // Add significant vertical margin after Tag Breakdown before Top Performers
      yPosition += 15; // Increased from 5 to 15 for better spacing
    }

    // Tag Leaderboard - Modern Section
    if (stats.tagLeaderboard && stats.tagLeaderboard.length > 0) {
      // Force new page for Top Performers section
      pdf.addPage();
      yPosition = margin;
      yPosition += 12; // Increased spacing before section header
      checkPageBreak(40);
      
      // Modern section header
      pdf.setFillColor(colors.purple[0], colors.purple[1], colors.purple[2]);
      pdf.roundedRect(margin, yPosition - 10, contentWidth, 10, 3, 3, 'F');
      pdf.setFontSize(15);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.text('Top Performers', margin + 4, yPosition - 2);
      yPosition += 10;

      // Modern enhanced table header with better styling
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setFillColor(colors.purpleDark[0], colors.purpleDark[1], colors.purpleDark[2]);
      pdf.roundedRect(margin, yPosition - 6, contentWidth, 9, 2, 2, 'F');
      pdf.setTextColor(255, 255, 255);
      
      // Column positions adjusted for all columns - fixed header text
      pdf.text('Rank', margin + 4, yPosition);
      pdf.text('Subject Name', margin + 18, yPosition);
      pdf.text('Rel Subs', margin + 70, yPosition);
      pdf.text('Score %', margin + 95, yPosition);
      pdf.text('Pass %', margin + 120, yPosition);
      pdf.text('7d Δ', margin + 145, yPosition); // Fixed: Full text "7d Δ" instead of truncated
      
      yPosition += 9;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);

      const topPerformers = stats.tagLeaderboard.slice(0, 15);
      topPerformers.forEach((item, index) => {
        checkPageBreak(10);
        
        // Modern row background with subtle borders
        if (index % 2 === 0) {
          pdf.setFillColor(colors.bgLight[0], colors.bgLight[1], colors.bgLight[2]);
          pdf.roundedRect(margin, yPosition - 5, contentWidth, 9, 1, 1, 'F');
        }
        
        // Subtle border for all rows
        pdf.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
        pdf.setLineWidth(0.2);
        pdf.roundedRect(margin, yPosition - 5, contentWidth, 9, 1, 1, 'D');

        // Modern rank badge with gradient effect
        pdf.setFillColor(colors.purple[0], colors.purple[1], colors.purple[2]);
        pdf.circle(margin + 5, yPosition, 3.5, 'F');
        // Darker center for depth
        pdf.setFillColor(colors.purpleDark[0], colors.purpleDark[1], colors.purpleDark[2]);
        pdf.circle(margin + 5, yPosition, 2.5, 'F');
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(255, 255, 255);
        pdf.text((index + 1).toString(), margin + 5, yPosition + 1, { align: 'center' });
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        
        // Subject Name (truncated to fit)
        pdf.text((item.userName || 'N/A').substring(0, 20), margin + 18, yPosition);
        
        // Rel Subs
        pdf.text((item.relSubs || 0).toString(), margin + 70, yPosition);
        
        // Score % - highlighted
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        pdf.text((item.pointsPct || 0).toFixed(1), margin + 95, yPosition);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        
        // Pass %
        pdf.text(`${(item.passPct || 0).toFixed(1)}%`, margin + 120, yPosition);
        
        // 7d Δ (7-day momentum/delta) with arrow indicator
        if (item.momentum !== null && item.momentum !== undefined) {
          const momentumValue = item.momentum;
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8);
          if (momentumValue > 0) {
            pdf.setTextColor(colors.success[0], colors.success[1], colors.success[2]);
            pdf.text(`↑ +${momentumValue.toFixed(1)}`, margin + 145, yPosition);
          } else if (momentumValue < 0) {
            pdf.setTextColor(colors.error[0], colors.error[1], colors.error[2]);
            pdf.text(`↓ ${momentumValue.toFixed(1)}`, margin + 145, yPosition);
          } else {
            pdf.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
            pdf.text(`→ 0.0`, margin + 145, yPosition);
          }
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
        } else {
          pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
          pdf.text('N/A', margin + 145, yPosition);
        }
        pdf.setTextColor(0, 0, 0);
        
        yPosition += 9;
      });

      if (stats.tagLeaderboard.length > 15) {
        yPosition += 2;
        pdf.setFontSize(8);
        pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
        pdf.text(`(Showing top 15 of ${stats.tagLeaderboard.length} performers)`, margin, yPosition);
        pdf.setTextColor(0, 0, 0);
        yPosition += 6;
      }
    }

    // Professional Footer with page numbers
    const totalPages = pdf.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      
      // Footer line
      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(0.5);
      pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      
      // Page number
      pdf.setFontSize(9);
      pdf.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
      pdf.text(
        `Page ${i} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
      
      // Footer text
      pdf.setFontSize(8);
      pdf.text('Eval Hero - Statistics Report', margin, pageHeight - 10);
      pdf.text(dayjs().format('YYYY'), pageWidth - margin, pageHeight - 10, { align: 'right' });
      
      pdf.setTextColor(0, 0, 0);
    }

    // Generate filename
    const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
    const finalFilename = filename || `tag-statistics-${timestamp}.pdf`;

    // Save the PDF
    pdf.save(finalFilename);

  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error(
      error instanceof Error 
        ? `Failed to generate PDF: ${error.message}`
        : 'Failed to generate PDF. Please try again.'
    );
  }
}
