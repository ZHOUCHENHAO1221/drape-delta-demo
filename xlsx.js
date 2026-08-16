/* DRAPE DELTA — minimal .xlsx writer, lazy-loaded on first styled export.

   A spreadsheet is what the person receiving this file actually opens, and CSV carries no
   header colour, no column width and no frozen pane. This writes a real .xlsx (a ZIP of XML)
   with no library: the CSP is script-src 'self', so a CDN is not an option, and bundling a
   full spreadsheet library for one export would cost more than the rest of the page.

   Multiple sheets, because a metadata block and a data table cannot share one column grid:
   column A sized for a fabric id truncates a label like "Property isolation", and column B
   sized for a label explodes a sentence into six wrapped lines. They get a sheet each.

   Store-only ZIP, no deflate — the payload is seven rows; compression would save nothing and
   cost an implementation. Strings are inline, so there is no shared-string table to keep in
   sync with the row data. */
(function () {
  'use strict';

  var CRC = null;
  function crc32(u8) {
    if (!CRC) {
      CRC = new Int32Array(256);
      for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); CRC[n] = c; }
    }
    var c = -1;
    for (var i = 0; i < u8.length; i++) c = (c >>> 8) ^ CRC[(c ^ u8[i]) & 255];
    return (c ^ -1) >>> 0;
  }

  var u16 = function (v) { return [v & 255, (v >> 8) & 255]; };
  var u32 = function (v) { return [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]; };

  function zipStore(files) {
    var enc = new TextEncoder(), parts = [], central = [], off = 0, cd = [];
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = enc.encode(f.xml), crc = crc32(data), n = data.length;
      var lh = [].concat([0x50, 0x4b, 0x03, 0x04], u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(n), u32(n), u16(name.length), u16(0));
      parts.push(new Uint8Array(lh), name, data);
      cd.push({ name: name, crc: crc, n: n, off: off });
      off += lh.length + name.length + n;
    });
    var cdStart = off;
    cd.forEach(function (e) {
      var h = [].concat([0x50, 0x4b, 0x01, 0x02], u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(e.crc), u32(e.n), u32(e.n), u16(e.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(e.off));
      central.push(new Uint8Array(h), e.name);
      off += h.length + e.name.length;
    });
    var eocd = new Uint8Array([].concat([0x50, 0x4b, 0x05, 0x06], u16(0), u16(0),
      u16(cd.length), u16(cd.length), u32(off - cdStart), u32(cdStart), u16(0)));
    return new Blob(parts.concat(central, [eocd]),
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function colName(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - m - 1) / 26; } return s; }

  /* Style ids, in the order they are declared in cellXfs below:
     0 body · 1 title · 2 meta label · 3 meta value · 4 header · 5 fabric id · 6 body cell */
  var STYLES =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="6">' +
    '<font><sz val="10"/><name val="Calibri"/><color rgb="FF0D1014"/></font>' +
    '<font><b/><sz val="15"/><name val="Calibri"/><color rgb="FF16A34A"/></font>' +
    '<font><b/><sz val="10"/><name val="Calibri"/><color rgb="FF111827"/></font>' +
    '<font><sz val="10"/><name val="Calibri"/><color rgb="FF374151"/></font>' +
    '<font><b/><sz val="10"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>' +
    '<font><b/><sz val="10"/><name val="Consolas"/><color rgb="FF0D1014"/></font>' +
    '</fonts>' +
    '<fills count="4">' +
    '<fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF16A34A"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF5F6F8"/><bgColor indexed="64"/></patternFill></fill>' +
    '</fills>' +
    '<borders count="2">' +
    '<border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left/><right/><top/><bottom style="thin"><color rgb="FFE5E7EB"/></bottom><diagonal/></border>' +
    '</borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="7">' +
    '<xf xfId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment vertical="center"/></xf>' +
    '<xf xfId="0" fontId="1" fillId="0" borderId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
    '<xf xfId="0" fontId="2" fillId="3" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
    '<xf xfId="0" fontId="3" fillId="0" borderId="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
    '<xf xfId="0" fontId="4" fillId="2" borderId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
    '<xf xfId="0" fontId="5" fillId="0" borderId="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
    '<xf xfId="0" fontId="0" fillId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

  /* sheet: {name, rows:[{cells:[{v,s,num}], h}], widths:[n], freeze:n} */
  function sheetXml(sh) {
    var cols = (sh.widths || []).map(function (w, i) {
      return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>';
    }).join('');
    var body = sh.rows.map(function (r, ri) {
      var cells = (r.cells || []).map(function (c, ci) {
        if (c == null || c.v === '' || c.v == null) return '';
        var ref = colName(ci) + (ri + 1), s = c.s ? ' s="' + c.s + '"' : '';
        if (c.num) return '<c r="' + ref + '"' + s + '><v>' + c.v + '</v></c>';
        return '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' + esc(c.v) + '</t></is></c>';
      }).join('');
      return '<row r="' + (ri + 1) + '"' + (r.h ? ' ht="' + r.h + '" customHeight="1"' : '') + '>' + cells + '</row>';
    }).join('');
    var pane = sh.freeze
      ? '<sheetView showGridLines="0" workbookViewId="0"><pane ySplit="' + sh.freeze +
        '" topLeftCell="A' + (sh.freeze + 1) + '" activePane="bottomLeft" state="frozen"/>' +
        '<selection pane="bottomLeft"/></sheetView>'
      : '<sheetView showGridLines="0" workbookViewId="0"/>';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews>' + pane + '</sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/>' +
      (cols ? '<cols>' + cols + '</cols>' : '') +
      '<sheetData>' + body + '</sheetData></worksheet>';
  }

  window.DRAPE_XLSX = function (sheets) {
    var files = [
      { name: '[Content_Types].xml', xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        sheets.map(function (_, i) {
          return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
        }).join('') +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>' },
      { name: '_rels/.rels', xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>' },
      { name: 'xl/workbook.xml', xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        sheets.map(function (s, i) {
          return '<sheet name="' + esc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
        }).join('') + '</sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map(function (_, i) {
          return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
        }).join('') +
        '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>' },
      { name: 'xl/styles.xml', xml: STYLES }
    ];
    sheets.forEach(function (s, i) {
      files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', xml: sheetXml(s) });
    });
    return zipStore(files);
  };
})();
