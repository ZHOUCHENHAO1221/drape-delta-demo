/* delta_table.js — the one definition of the exported 42-column table.
   index.html and mobile.html both read it from here, so the spreadsheet a phone
   produces and the spreadsheet a desktop produces cannot drift apart. */
var DT_F=[{"id": "P06", "name": "Cotton Poplin", "cat": "woven", "preset": "V2_Woven_Poplin_1", "brole": "Weave-type match (poplin)", "g1": 9.9, "g2": 2.4, "abl": false, "driver": "bending / anisotropy", "p": [[115, 111.7], [0.5, 0.258], [65, 55], [41, 52], [40, 83], [25, 53]]}, {"id": "P15", "name": "Cotton Jersey", "cat": "knit", "preset": "V2_Cut_Sew_Knit_Jersey_1", "brole": "Knit-type match (jersey)", "g1": 95, "g2": 48.8, "abl": true, "driver": "stretch", "p": [[200, 158], [0.5, 0.498], [51, 52], [10, 28], [11, 28], [11, 10]]}, {"id": "P24", "name": "Polyester Chiffon", "cat": "woven", "preset": "V2_Woven_Chiffon_1", "brole": "Fabric-type match (chiffon)", "g1": 10.9, "g2": 6, "abl": false, "driver": "bending + weight", "p": [[48, 101.7], [0.5, 0.364], [48, 22], [33, 16], [26, 23], [26, 30]]}, {"id": "P27", "name": "Worsted Wool", "cat": "woven", "preset": "V2_Woven_Twill_1", "brole": "Weave-family match (twill; fibre-agnostic)", "g1": 12.1, "g2": 4.3, "abl": false, "driver": "bending", "p": [[302, 184.7], [0.5, 0.374], [68, 65], [55, 53], [43, 72], [37, 55]]}, {"id": "P28", "name": "Felted Wool Knit", "cat": "knit", "preset": "V2_Woven_Melton_Boiled_1", "brole": "Nearest available CLO stand-in; not a construction match (woven preset for a knit)", "g1": 21.8, "g2": 3.5, "abl": true, "driver": "bending + stretch", "p": [[336, 371.5], [0.5, 2.194], [65, 77], [63, 66], [46, 31], [36, 29]]}, {"id": "P31", "name": "3-proof PET Twill · brown", "cat": "woven", "preset": "V2_Woven_Dewspo_1", "brole": "Family match (PET / Dewspo)", "g1": 12, "g2": 2.2, "abl": false, "driver": "bending", "p": [[71, 133.4], [0.5, 0.266], [39, 28], [53, 53], [28, 59], [31, 85]]}, {"id": "P32", "name": "3-proof PET Twill · cream", "cat": "woven", "preset": "V2_Woven_Dewspo_1", "brole": "Family match (PET / Dewspo)", "g1": 10, "g2": 3.5, "abl": false, "driver": "bending", "p": [[71, 136.6], [0.5, 0.246], [39, 32], [53, 53], [28, 76], [31, 84]]}];
window.DRAPE_DELTA_TABLE=function(){
 var d1=function(v){return (+v).toFixed(1);};
 var COLS=['Mass / area','Thickness','Bending \u00b7 warp','Bending \u00b7 weft','Stretch \u00b7 warp','Stretch \u00b7 weft'];
 var SLUG={'Mass / area':'mass_g_m2','Thickness':'thickness_mm','Bending \u00b7 warp':'bending_warp_idx','Bending \u00b7 weft':'bending_weft_idx','Stretch \u00b7 warp':'stretch_warp_idx','Stretch \u00b7 weft':'stretch_weft_idx'};
 var head=['fabric_id','name','category','baseline_preset','baseline_role','G1_drape_delta_mm','G2_fitted_delta_mm','G2_over_G1','property_isolation_run','dominant_property','material_version','material_status','supersedes','engine','particle_distance','calibrated_at','calibration_route','delta_computed_at','baseline_currency','mass_method','thickness_method','tensile_method','bending_method','shear_method','fibre_identification','conditioning','test_house','test_commissioned','test_report_date','provenance_status'];
 COLS.forEach(function(c){head.push(SLUG[c]+'_generic',SLUG[c]+'_measured');});
 var rows=DT_F.map(function(f){
  var r=[f.id,f.name,f.cat,f.preset,f.brole,d1(f.g1),d1(f.g2),(f.g2/f.g1).toFixed(2),f.abl?'yes':'no',f.abl?(f.driver||''):'',
   '1.0','current','','CLO3D 2026.0.374','10','2026-07-23/24','A','2026-07-27',
   'snapshot on CLO3D 2026.0.374 \u2014 does not auto-refresh when CLO updates',
   'ISO 3801 procedure \u00b7 n=5','ISO 5084 procedure (1 kPa) \u00b7 n=5',
   'ISO 13934-1 procedure \u00b7 n=5 per direction \u00b7 read as a stretch proxy, not an extensibility test',
   'cantilever 41.5 deg \u00b7 non-standard \u00b7 n=3 strips per direction \u00b7 2026-07-14',
   'not measured \u00b7 engine default retained',
   (f.id==='P27'?'SEM scale pattern + burn test \u00b7 100% wool confirmed':''),
   'ISO 139 not performed \u2014 declared departure',
   'Frankie, Jinan','2026-06-24','not recorded',
   'declared by contributor \u2014 not verified by this deployment'];
  f.p.forEach(function(m){r.push(m[0],m[1]);});
  return r;
 });
 var d=new Date().toISOString().slice(0,10);
 var meta=[
  ['# DRAPE \u25b3','generic-vs-measured delta records'],
  ['# Exported',d],
  ['# Source','https://drape-delta.netlify.app/'],
  ['# Table schema','v2 \u00b7 '+head.length+' columns \u00b7 read by header NAME; column order is not stable across schema versions'],
  ['# Material record','version 1.0 (current) \u00b7 no superseded versions in this export'],
  ['# Engine','CLO3D 2026.0.374 \u00b7 Fitting (Accurate Fabric) \u00b7 Particle Distance 10'],
  ['# Garment G1','FV2 Gathered A-Line Maxi Dress (drape-dominant)'],
  ['# Garment G2','FV2 Spaghetti-Strap H-Line Dress (fitted)'],
  ['# Delta','mean per-vertex absolute displacement between the generic-preset run and the measured-input run, within the same CLO3D garment scenario'],
  ['# Not an error','a difference between two simulations \u2014 there is no physical ground-truth validation behind these numbers'],
  ['# Dataset','7 specimens / 6 specifications (P31 and P32 are the same spec, dyed apart)'],
  ['# Measurement','mass ISO 3801 \u00b7 thickness ISO 5084 \u00b7 tensile ISO 13934-1 \u00b7 n=5 \u00b7 conditioning departure declared'],
  ['# Bending','non-standard cantilever'],
  ['# Stretch','low-load proxy, not an extensibility measurement'],
  ['# Shear','not measured \u2014 left at the engine baseline'],
  ['# Generic thickness','a constant 0.50 mm placeholder across all presets'],
  ['# Property isolation','run on P15 and P28 only; other dominant-property labels are inferred from input difference, not isolated'],
  ['# Index units','bending and stretch are CLO 0-99 index values with no natural zero \u2014 generic/measured pairs are comparable only within a column'],
  ['# Contributed uploads','not in this file \u2014 without a baseline comparison they have no delta to export']
 ];
 return {head:head,rows:rows,meta:meta,date:d};
};

/* Garment-level effect on G1, from before_after_log.xlsx (指标结果, 2026-07-24).
   hem  = change in widest hem, measured run vs generic run
   fold = folds counted off the rendered silhouette, generic -> measured
   note = only where a length change large enough to matter was recorded */
window.DRAPE_GARMENT={
 P06:{hem:'+6.5%',fold:'4 \u2192 5'},
 P15:{hem:'+8.3%',fold:'2 \u2192 2',note:'about 10 cm higher than the generic run'},
 P24:{hem:'\u221210.7%',fold:'3 \u2192 2'},
 P27:{hem:'+1.5%',fold:'5 \u2192 3'},
 P28:{hem:'+6.2%',fold:'4 \u2192 5'},
 P31:{hem:'\u22120.3%',fold:'6 \u2192 3'},
 P32:{hem:'\u22122.2%',fold:'5 \u2192 4'}
};

/* Property names as they appear in the comparison verdict, which is built at
   runtime and so cannot go through the whole-string dictionary. */
window.DRAPE_DRIVER_ZH={
 'stretch':'拉伸',
 'bending':'弯曲',
 'bending + stretch':'弯曲 + 拉伸',
 'bending + weight':'弯曲 + 克重',
 'bending / anisotropy':'弯曲 / 各向异性'
};
window.DRV=function(d){return (window.DRAPE_DRIVER_ZH||{})[d]||d;};

/* The six property rows, from either page's fabric record. The desktop stores them
   ready-made as f.rows; the phone stores the parts (mass, th, bend[2], stretch[2], gen).
   Verified 2026-08-29: deriving from the phone's parts reproduces the desktop rows
   exactly for all seven fabrics. Row shape: [label, generic, measured, unit, decimals]. */
window.DRAPE_ROWS=function(f){
 if(f && f.rows) return f.rows;
 if(!f || !f.gen) return [];
 return [['Mass / area',f.gen.mass,f.mass,'g/m\u00b2',0],
         ['Thickness',f.gen.th,f.th,'mm',3],
         ['Bending \u00b7 warp',f.gen.bend[0],f.bend[0],'idx',0],
         ['Bending \u00b7 weft',f.gen.bend[1],f.bend[1],'idx',0],
         ['Stretch \u00b7 warp',f.gen.stretch[0],f.stretch[0],'idx',0],
         ['Stretch \u00b7 weft',f.gen.stretch[1],f.stretch[1],'idx',0]];
};
