function downloadPDF() {
  if (!this.analysisResult) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const r = this.analysisResult;
  const url = r.url || 'N/A';
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const score = r.score || 0;
  let host = '';
  try { host = new URL(url).hostname.replace('www.', ''); } catch(e) { host = 'website'; }

  function sc(s) { return s >= 80 ? [16,185,129] : s >= 50 ? [245,158,11] : [239,68,68]; }
  function st(s) { return s >= 80 ? 'Good' : s >= 50 ? 'Needs Work' : 'Poor'; }
  function cp(y) { if (y > 265) { doc.addPage(); return 20; } return y; }
  function hdr(title, color) {
    let yy = 20;
    doc.setFontSize(20);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(title, 20, yy);
    yy += 4;
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(0.5);
    doc.line(20, yy, 190, yy);
    return yy + 10;
  }
  function footer(pg, tot) {
    doc.setPage(pg);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.setDrawColor(200);
    doc.line(20, 283, 190, 283);
    doc.text('SEOBoost SEO Audit Report  |  Page ' + pg + ' of ' + tot, 105, 289, { align: 'center' });
  }

  // ===== PAGE 1: COVER =====
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, 210, 297, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 110, 210, 100, 'F');
  doc.setFontSize(36);
  doc.setTextColor(99, 102, 241);
  doc.text('SEOBoost', 105, 138, { align: 'center' });
  doc.setFontSize(18);
  doc.setTextColor(50);
  doc.text('Website SEO Audit Report', 105, 152, { align: 'center' });
  doc.setDrawColor(99, 102, 241);
  doc.setLineWidth(0.5);
  doc.line(65, 158, 145, 158);
  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text('Client: ' + url, 105, 170, { align: 'center' });
  doc.text('Date: ' + date, 105, 180, { align: 'center' });
  var c = sc(score);
  doc.setFillColor(c[0], c[1], c[2]);
  doc.roundedRect(72, 186, 66, 22, 3, 3, 'F');
  doc.setFontSize(18);
  doc.setTextColor(255);
  doc.text(score + ' / 100', 105, 200, { align: 'center' });

  // ===== PAGE 2: EXECUTIVE SUMMARY =====
  doc.addPage();
  var y = hdr('Executive Summary', [99, 102, 241]);
  var ts = r.stats.titleLength >= 30 && r.stats.titleLength <= 60 ? 85 : r.stats.titleLength > 0 ? 50 : 20;
  var ms = r.stats.metaDescLength >= 120 && r.stats.metaDescLength <= 160 ? 85 : r.stats.metaDescLength > 0 ? 55 : 20;
  var hs = r.stats.h1Count === 1 ? 90 : r.stats.h1Count > 1 ? 60 : 30;
  var cs2 = r.stats.wordCount >= 500 ? 85 : r.stats.wordCount >= 300 ? 70 : r.stats.wordCount >= 100 ? 50 : 25;
  var tech = Math.round((ts + ms + hs) / 3);
  var rows = [
    ['Overall SEO Score', score], ['Title Tag', ts], ['Meta Description', ms],
    ['Heading Structure', hs], ['Content Quality', cs2], ['Technical SEO', tech], ['Mobile Friendly', 80]
  ];
  doc.setFillColor(248, 250, 252);
  doc.rect(20, y, 170, 10, 'F');
  doc.setFontSize(9);
  doc.setTextColor(50);
  doc.text('Metric', 22, y + 7);
  doc.text('Score', 115, y + 7);
  doc.text('Status', 155, y + 7);
  y += 12;
  rows.forEach(function(row) {
    doc.setDrawColor(230); doc.line(20, y, 190, y);
    doc.setFontSize(9); doc.setTextColor(60);
    doc.text(row[0], 22, y + 6);
    var cc = sc(row[1]);
    doc.setTextColor(cc[0], cc[1], cc[2]);
    doc.text(row[1] + '/100', 115, y + 6);
    doc.text(st(row[1]), 155, y + 6);
    y += 12;
  });

  // ===== PAGE 3: ISSUES =====
  doc.addPage();
  y = hdr('Issues Found', [239, 68, 68]);
  var critical = (r.issues || []).filter(function(i){ return i.type === 'error'; });
  var warnings = (r.issues || []).filter(function(i){ return i.type === 'warning'; });
  var infos = (r.issues || []).filter(function(i){ return i.type === 'info'; });
  if (critical.length > 0) {
    doc.setFontSize(12); doc.setTextColor(239, 68, 68);
    doc.text('Critical Issues (Fix Immediately)', 20, y); y += 8;
    doc.setFillColor(254, 226, 226); doc.rect(20, y - 5, 170, 8, 'F');
    doc.setFontSize(8); doc.setTextColor(50);
    doc.text('Issue', 22, y + 1); doc.text('Impact', 120, y + 1); doc.text('Fix', 150, y + 1);
    y += 8;
    critical.forEach(function(issue) {
      y = cp(y);
      doc.setFontSize(8); doc.setTextColor(60);
      doc.text(issue.category + ': ' + issue.message, 22, y);
      doc.setTextColor(239, 68, 68); doc.text('High', 120, y);
      doc.setTextColor(100);
      var fix = doc.splitTextToSize(issue.suggestion, 45);
      doc.text(fix[0] || '', 150, y);
      y += 5;
    });
    y += 6;
  }
  if (warnings.length > 0) {
    y = cp(y);
    doc.setFontSize(12); doc.setTextColor(245, 158, 11);
    doc.text('Warnings (Fix Soon)', 20, y); y += 8;
    doc.setFillColor(254, 243, 199); doc.rect(20, y - 5, 170, 8, 'F');
    doc.setFontSize(8); doc.setTextColor(50);
    doc.text('Issue', 22, y + 1); doc.text('Impact', 120, y + 1); doc.text('Fix', 150, y + 1);
    y += 8;
    warnings.forEach(function(issue) {
      y = cp(y);
      doc.setFontSize(8); doc.setTextColor(60);
      doc.text(issue.category + ': ' + issue.message, 22, y);
      doc.setTextColor(245, 158, 11); doc.text('Medium', 120, y);
      doc.setTextColor(100);
      var fix = doc.splitTextToSize(issue.suggestion, 45);
      doc.text(fix[0] || '', 150, y);
      y += 5;
    });
    y += 6;
  }
  if (infos.length > 0) {
    y = cp(y);
    doc.setFontSize(12); doc.setTextColor(59, 130, 246);
    doc.text('Suggestions', 20, y); y += 8;
    infos.forEach(function(issue) {
      y = cp(y);
      doc.setFontSize(8); doc.setTextColor(60);
      doc.text(issue.category + ': ' + issue.message, 22, y);
      doc.setTextColor(100);
      var fix = doc.splitTextToSize(issue.suggestion, 150);
      fix.forEach(function(line) { y += 4; doc.text(line, 28, y); });
      y += 3;
    });
  }
  if ((r.issues || []).length === 0) {
    doc.setFontSize(12); doc.setTextColor(16, 185, 129);
    doc.text('No issues found! Your website SEO is in great shape.', 20, y);
  }

  // ===== PAGE 4: PASSED CHECKS =====
  doc.addPage();
  y = hdr('Passed Checks', [16, 185, 129]);
  if (r.passed && r.passed.length > 0) {
    doc.setFillColor(236, 253, 245); doc.rect(20, y - 5, 170, 8, 'F');
    doc.setFontSize(8); doc.setTextColor(50);
    doc.text('Check', 22, y + 1); doc.text('Status', 155, y + 1);
    y += 8;
    r.passed.forEach(function(check) {
      y = cp(y);
      doc.setDrawColor(230); doc.line(20, y - 2, 190, y - 2);
      doc.setFontSize(9); doc.setTextColor(60);
      doc.text(check, 22, y + 4);
      doc.setTextColor(16, 185, 129); doc.text('PASS', 155, y + 4);
      y += 10;
    });
  } else {
    doc.setFontSize(12); doc.setTextColor(100);
    doc.text('No passed checks recorded.', 20, y);
  }

  // ===== PAGE 5: STATISTICS =====
  doc.addPage();
  y = hdr('Statistics & Analysis', [99, 102, 241]);
  doc.setFontSize(12); doc.setTextColor(50);
  doc.text('Website Statistics', 20, y); y += 10;
  var stats = [
    ['Title Length', r.stats.titleLength, r.stats.titleLength >= 30 && r.stats.titleLength <= 60 ? 'Optimal' : 'Needs adjustment'],
    ['Meta Description Length', r.stats.metaDescLength, r.stats.metaDescLength >= 120 && r.stats.metaDescLength <= 160 ? 'Optimal' : 'Needs adjustment'],
    ['Word Count', r.stats.wordCount, r.stats.wordCount >= 300 ? 'Good' : 'Add more content'],
    ['H1 Tags', r.stats.h1Count, r.stats.h1Count === 1 ? 'Correct' : r.stats.h1Count === 0 ? 'Missing' : 'Multiple H1s'],
    ['Images', r.stats.imageCount, r.stats.imageCount > 0 ? 'Present' : 'Add images'],
    ['Links', r.stats.linkCount, r.stats.linkCount > 0 ? 'Present' : 'Add links']
  ];
  doc.setFillColor(248, 250, 252); doc.rect(20, y - 5, 170, 8, 'F');
  doc.setFontSize(8); doc.setTextColor(50);
  doc.text('Metric', 22, y + 1); doc.text('Value', 105, y + 1); doc.text('Status', 140, y + 1);
  y += 8;
  stats.forEach(function(s) {
    doc.setDrawColor(230); doc.line(20, y, 190, y);
    doc.setFontSize(9); doc.setTextColor(60);
    doc.text(s[0], 22, y + 6);
    doc.text(String(s[1]), 105, y + 6);
    var ok = s[2] === 'Optimal' || s[2] === 'Good' || s[2] === 'Correct' || s[2] === 'Present';
    doc.setTextColor(ok ? 16 : 245, ok ? 185 : 158, ok ? 129 : 11);
    doc.text(s[2], 140, y + 6);
    y += 12;
  });

  // ===== PAGE 6: RECOMMENDATIONS =====
  doc.addPage();
  y = hdr('Recommendations', [99, 102, 241]);
  doc.setFontSize(11); doc.setTextColor(239, 68, 68);
  doc.text('Immediate Actions (This Week)', 20, y); y += 8;
  doc.setFontSize(9); doc.setTextColor(60);
  var immediate = [];
  if (r.stats.h1Count === 0) immediate.push('Add an H1 tag to the page');
  if (r.stats.metaDescLength === 0) immediate.push('Add a meta description (150-160 characters)');
  if (r.stats.titleLength === 0) immediate.push('Add a title tag (30-60 characters)');
  if (r.stats.h1Count > 1) immediate.push('Reduce to only one H1 tag per page');
  (r.issues || []).filter(function(i){ return i.type === 'error'; }).forEach(function(i){ immediate.push(i.suggestion); });
  if (immediate.length === 0) immediate.push('No critical issues - keep up the good work!');
  immediate.forEach(function(item) {
    y = cp(y);
    doc.setFillColor(239, 68, 68); doc.circle(24, y + 1, 1.5, 'F');
    doc.setFontSize(9); doc.setTextColor(60);
    doc.text(item, 30, y + 3);
    y += 8;
  });
  y += 6;
  doc.setFontSize(11); doc.setTextColor(245, 158, 11);
  doc.text('Short Term (This Month)', 20, y); y += 8;
  doc.setFontSize(9); doc.setTextColor(60);
  var shortTerm = [
    'Add 300+ words of quality content',
    'Improve domain authority with quality content',
    'Optimize all images with descriptive alt text'
  ];
  shortTerm.forEach(function(item) {
    doc.setFillColor(245, 158, 11); doc.circle(24, y + 1, 1.5, 'F');
    doc.text(item, 30, y + 3);
    y += 8;
  });
  y += 6;
  doc.setFontSize(11); doc.setTextColor(16, 185, 129);
  doc.text('Long Term (3 Months)', 20, y); y += 8;
  doc.setFontSize(9); doc.setTextColor(60);
  var longTerm = [
    'Publish regular blog posts with target keywords',
    'Set up social media integration',
    'Implement local SEO if applicable'
  ];
  longTerm.forEach(function(item) {
    doc.setFillColor(16, 185, 129); doc.circle(24, y + 1, 1.5, 'F');
    doc.text(item, 30, y + 3);
    y += 8;
  });

  // ===== PAGE 7: SCORE BREAKDOWN =====
  doc.addPage();
  y = hdr('Score Breakdown', [99, 102, 241]);
  doc.setFontSize(24); doc.setTextColor(99, 102, 241);
  doc.text('Overall Score: ' + score + '/100', 20, y + 10);
  y += 25;
  var cats = [
    ['Title Tags', ts], ['Meta Tags', ms], ['Headings', hs],
    ['Content', cs2], ['Technical', tech], ['Mobile', 80]
  ];
  cats.forEach(function(cat) {
    doc.setFontSize(10); doc.setTextColor(60);
    doc.text(cat[0] + ': ' + cat[1] + '%', 22, y + 5);
    doc.setFillColor(220, 220, 220);
    doc.roundedRect(20, y + 8, 170, 8, 2, 2, 'F');
    var cc = sc(cat[1]);
    doc.setFillColor(cc[0], cc[1], cc[2]);
    var barW = Math.max(4, (cat[1] / 100) * 170);
    doc.roundedRect(20, y + 8, barW, 8, 2, 2, 'F');
    doc.setFontSize(8); doc.setTextColor(255);
    if (barW > 15) doc.text(cat[1] + '%', 20 + barW - 15, y + 14);
    y += 22;
  });

  // Add footers to all pages
  var total = doc.getNumberOfPages();
  for (var i = 1; i <= total; i++) { footer(i, total); }

  doc.save('SEO-Report-' + host + '.pdf');
}
