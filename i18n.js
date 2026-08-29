/* DRAPE DELTA — lightweight EN→中文 i18n layer.
   Whole-string dictionary + DOM text replacement + MutationObserver.
   Numbers/units are never in the dict, so they stay identical across languages
   (protects the number-consistency gate). Toggle persists in localStorage and
   reloads to switch cleanly. Integrity terms are locked:
     measured=实测 · generic=通用 · delta/Δ=差值(绝不用"误差") ·
     not physical ground truth=非物理真值 · single engine=单一引擎 ·
     exploratory prototype=探索性原型.
   ⚠️ 中文待用户校对后再上线。 */
(function () {
  var ZH = {
  // ---- contribution surface / qualification record (2026-08-15) ----
  "Upload a calibrated .zfab — or the report behind it": "上传已标定的 .zfab — 或它背后的报告",
  "Drop a calibrated .zfab — or the report behind it": "拖入已标定的 .zfab — 或它背后的报告",
  "Drop a calibrated .zfab, or the report behind it": "拖入已标定的 .zfab，或它背后的报告",
  "You already have a CLO fabric file — bring it straight into the library, with the test report or spec sheet that backs it.": "你已经有 CLO 面料文件 —— 直接带进库，连同支撑它的检测报告或规格表。",
  "Accepted: .zfab · .csv · .pdf · .txt · .json · .xlsx. The .zfab is the fabric; the rest are stored alongside it as declared evidence — they are filed, not parsed into properties.": "可接收：.zfab · .csv · .pdf · .txt · .json · .xlsx。.zfab 是面料本体，其余作为声明证据一并存放 — 只归档，不解析成属性。",
  "Your email address": "你的邮箱地址",
  "drag to reveal · a wipe, not a blend": "拖动揭示 · 是抹开，不是混合",
  "3 of 5 engine inputs come from an ISO source · bending is a non-standard cantilever, shear is the engine default": "5 项引擎输入中有 3 项来自 ISO 标准 · 弯曲为非标悬臂，剪切为引擎默认值",
  "drag the handle to reveal · wipes between two renders, it does not blend": "拖动手柄揭示 · 在两张渲染图之间抹开，并非混合",
  "Deltas are generic-vs-measured differences computed inside CLO3D — not errors against physical reality.": "差值是在 CLO3D 内部计算的「通用 vs 实测」差异 — 并非相对物理真实的误差。",
  "Sort order only · the hero image and the 3D view show the drape (G1) scenario.": "仅排序 · 主图与 3D 视图始终展示垂坠（G1）情景。",

  // ---- per-fabric delta strings, regenerated 2026-08-16 at one decimal ----
  // Whole-sentence keys, so the printed FORMAT is part of the key. Regenerate these
  // whenever the number format changes, or Chinese mode silently falls back to English.
  "generic ↔ measured · drape G1 Δ 9.9 mm": "通用 ↔ 实测 · 悬垂 G1 Δ 9.9 mm",
  "drag to compare · drape G1 Δ 9.9 mm": "拖拽对比 · 悬垂 G1 Δ 9.9 mm",
  "G2 2.4 · thk 1.9×": "G2 2.4 · 厚 1.9×",
  "generic ↔ measured · drape G1 Δ 95.0 mm": "通用 ↔ 实测 · 悬垂 G1 Δ 95.0 mm",
  "drag to compare · drape G1 Δ 95.0 mm": "拖拽对比 · 悬垂 G1 Δ 95.0 mm",
  "G2 48.8 · thk 1.0×": "G2 48.8 · 厚 1.0×",
  "generic ↔ measured · drape G1 Δ 10.9 mm": "通用 ↔ 实测 · 悬垂 G1 Δ 10.9 mm",
  "drag to compare · drape G1 Δ 10.9 mm": "拖拽对比 · 悬垂 G1 Δ 10.9 mm",
  "G2 6.0 · thk 1.4×": "G2 6.0 · 厚 1.4×",
  "generic ↔ measured · drape G1 Δ 12.1 mm": "通用 ↔ 实测 · 悬垂 G1 Δ 12.1 mm",
  "drag to compare · drape G1 Δ 12.1 mm": "拖拽对比 · 悬垂 G1 Δ 12.1 mm",
  "G2 4.3 · thk 1.3×": "G2 4.3 · 厚 1.3×",
  "generic ↔ measured · drape G1 Δ 21.8 mm": "通用 ↔ 实测 · 悬垂 G1 Δ 21.8 mm",
  "drag to compare · drape G1 Δ 21.8 mm": "拖拽对比 · 悬垂 G1 Δ 21.8 mm",
  "G2 3.5 · thk 4.4×": "G2 3.5 · 厚 4.4×",
  "generic ↔ measured · drape G1 Δ 12.0 mm": "通用 ↔ 实测 · 悬垂 G1 Δ 12.0 mm",
  "drag to compare · drape G1 Δ 12.0 mm": "拖拽对比 · 悬垂 G1 Δ 12.0 mm",
  "G2 2.2 · thk 1.9×": "G2 2.2 · 厚 1.9×",
  "generic ↔ measured · drape G1 Δ 10.0 mm": "通用 ↔ 实测 · 悬垂 G1 Δ 10.0 mm",
  "drag to compare · drape G1 Δ 10.0 mm": "拖拽对比 · 悬垂 G1 Δ 10.0 mm",
  "G2 3.5 · thk 2.0×": "G2 3.5 · 厚 2.0×",
  "Set display name": "设置显示名",
  "Sign out": "退出登录",
  "Replaces an earlier upload of yours (optional)": "替换你之前的某次上传（选填）",
  "— nothing; this is a new fabric": "— 不替换；这是一块新面料",
  "Export all 7 delta records · CSV →": "导出全部 7 条差值记录 · CSV →",
  "CSV carries the engine, particle distance, baseline preset and measurement caveats alongside every number.": "CSV 会把引擎、粒子间距、基线预设与测量限定跟每个数字一起带走。",
  "Live file-intake demo · candidates pending review": "实时文件进料演示 · 候选待审核",
  "This deployment is passphrase-protected: a private file is hidden from the public listing, but anyone holding the passphrase can open it.": "本部署由口令保护：私有文件不会出现在公开列表里，但持有口令的任何人都能打开它。",
  "low-load response · 5% secant stiffness → CLO stretch index": "低载响应 · 5% 割线刚度 → CLO 拉伸指数",
  "Private uploads are unavailable on this deployment: sign-in is not configured on the server, so it cannot keep anything private. Public channel only.": "本部署无法提供私有上传:服务端未配置登录,因此它无法为任何文件保密。仅可使用公开通道。",
  "Copy a link to this view": "复制当前视图链接",
  "Layers this reaches": "本方法触及的层级",
  "Material layer — the cloth's own mass, thickness, bending and low-load stretch. This is the layer measured here.": "材料层 — 布自身的克重、厚度、弯曲与低载拉伸。这是本项目实测的层。",
  "Structural layer — how a pattern redistributes those properties. Partly reached: two garments, one drape-dominant and one fitted.": "结构层 — 版型如何重新分配这些属性。部分触及：两件服装，一件垂坠主导、一件合体。",
  "Process layer — seams, fusing, interlining and finishing all change how a panel behaves. Not reached: every panel in these runs carries the same fabric definition, with no fusing or seam-stiffness modelling.": "工艺层 — 接缝、粘合衬、里衬与后整理都会改变一块裁片的表现。未触及：这些运行中每块裁片都用同一份面料定义，未建模粘合或接缝刚度。",
  "Time layer — viscoelastic relaxation and creep. Not reached: each condition is a single solve captured at drape equilibrium, not a garment left hanging.": "时间层 — 粘弹松弛与蜿变。未触及：每个条件都是单次求解、在垂坠平衡处截取，而非一件长时间悬挂的成衣。",
  "A measured value is a known reference point, not a target — designers lower stiffness on purpose to exaggerate drape. Closer to measured is not automatically the better-looking garment.": "实测值是一个已知参照点，不是目标 — 设计师会故意调低刚度以夸张垂坠。更接近实测，并不自动等于更好看的成衣。",
  "Your measured-material workspace — how far each generic preset sits from the measured fabric, inside CLO3D.": "你的实测材料工作区 — 在 CLO3D 内，每个通用预设距离实测面料有多远。",
  "e.g. 100% cotton": "如 100% 棉",
  "woven / knit": "梭织 / 针织",
  "Public channel": "公开通道",
  "— listed in the shared library; anyone can browse it, download it and read its record.": "— 列入共享库；任何人都可浏览、下载并查看其记录。",
  "Private channel": "私有通道",
  "— not listed publicly; visible to you and to the library moderator.": "— 不公开列出；仅你本人与库管理员可见。",
  "Qualification record": "资格档案",
  "add record ▾": "填写档案 ▾",
  "hide ▴": "收起 ▴",
  "Supplier / mill": "供应商 / 厂",
  "Batch / roll": "批次 / 卷号",
  "Composition": "成分",
  "Construction": "组织结构",
  "Weight (g/m²)": "克重 (g/m²)",
  "Test method(s)": "测试方法",
  "Test date": "测试日期",
  "Lab / operator": "实验室 / 操作人",
  "CLO version": "CLO 版本",
  "Baseline preset": "基线预设",
  "Engine inputs physically measured — leave unticked whatever stayed at the engine default": "实测的引擎输入项 — 保持引擎默认值的项请不要勾选",
  "Optional. A file without a record is still accepted and is listed as an unqualified candidate. A record states what was measured and by whom — it is not a claim that the fabric is accurate.": "选填。没有档案的文件照样接收，但会标为未资格候选。档案只陈述测了什么、谁测的 — 它不声称该面料准确。",
  "Engine inputs measured": "已实测的引擎输入项",
  "Declared by the contributor, shown as filed — not verified by this deployment.": "由贡献者自行声明，按提交原样展示 — 本部署未作核验。",
  "loading record...": "正在读取档案…",
  "No record was filed with this upload.": "此次上传未附档案。",
  "record error": "档案读取出错",
  "no record filed": "未附档案",
  "sign in to download": "登录后下载",
  "private to its contributor": "仅其贡献者可见",
  "download error": "下载出错",
  "weight": "克重",
  "thickness": "厚度",
  "bending": "弯曲",
  "stretch": "拉伸",
  "shear": "剪切",

  // ---- design rule (M-C, 2026-08-15) ----
  "Design rule": "设计规则",
  "Measure bending for drape-dominant garments; measure stretch for any knit or elastic fabric, whatever the silhouette.": "垂坠主导的服装测弯曲；任何针织或弹力面料，无论版型都要测拉伸。",
  "Stretch differences survive fitting: the knit still differs by 48.8 mm on the fitted H-line, 51% of its drape figure.": "拉伸差值在合体版型上存活：针织在合体 H 型裙上仍差 48.8 mm，是其垂坠数值的 51%。",
  "Bending differences largely do not — five bending-driven fabrics fall to 16–36%. Their fitted Δ is 2.2–4.3 mm, inside the ~10 mm per-vertex solver repeatability band, so those ratios are indicative only; and the chiffon does not follow the pattern at all — it retains 55%, the highest in the set, above the knit's 51%.": "弯曲差值基本不存活——五块弯曲主导的面料落到 16–36%。但它们的合体态 Δ 仅 2.2–4.3 mm，处于约 10 mm 的逐顶点求解器重复性带内，该比值只作指示；而雪纺完全不服从这一模式——它保留 55%，是七块里最高的，高于针织的 51%。",

    // ---- brand / cover / entry ----
    "Measured, not assumed": "实测,而非假定",
    "MEASURED, NOT ASSUMED": "实测,而非假定",
    "A measured digital-material workspace for CLO3D — see how far a generic fabric preset sits from the measured fabric.": "面向 CLO3D 的实测数字面料工作台——直观看到通用面料预设与实测面料之间差多少。",
    "A measured digital-material workspace — see how far a generic fabric preset sits from the measured fabric.": "实测数字面料工作台——直观看到通用面料预设与实测面料之间差多少。",
    "Enter workspace →": "进入工作台 →",
    "Panel concept · single-engine pilot · Chenhao Zhou · LCF · UAL 2026": "面板概念 · 单一引擎试点 · Chenhao Zhou · LCF · UAL 2026",
    "Chenhao Zhou (He/Him) · London College of Fashion · UAL · 2026": "Chenhao Zhou(He/Him)· 伦敦时装学院 · UAL · 2026",
    "tap to begin": "轻触开始",
    "tap to continue": "轻触继续",
    "Welcome": "欢迎",
    "Sign in": "登录",
    "Sign in to contribute": "登录以贡献",
    "Pick up where the measuring left off.": "从上次测量处继续。",
    "Continue with Apple": "用 Apple 继续",
    "Continue with Google": "用 Google 继续",
    "Enter as guest →": "以访客进入 →",
    "Explore as guest →": "以访客浏览 →",
    "OR": "或",
    "Prototype — no account is created and nothing is stored. Any option opens the demonstration.": "原型——不创建账户、不存储任何内容。任一选项都进入演示。",
    "Your name (optional)": "你的名字(可选)",
    "Just exploring? Continue as guest — no account needed. Uploading a fabric needs sign-in (Google, or an email link opened on this device).": "只是看看?以访客继续——无需账户。上传面料才需登录(Google,或在本设备打开邮件链接)。",
    "Browsing as guest · not signed in": "以访客浏览 · 未登录",
    "Guest": "访客",

    // ---- top chrome / window ----
    "CLO3D 2026 · FV2_Gathered_A_Line_Maxi.zprj": "CLO3D 2026 · FV2_Gathered_A_Line_Maxi.zprj",
    "panel concept": "面板概念",
    "Measured materials": "实测材料",
    "Measured, not assumed": "实测,而非假定",

    // ---- viewer modes / controls ----
    "Before / After": "前 / 后对比",
    "Before/After": "前/后对比",
    "Δ map · 3D": "差值图 · 3D",
    "Δ map": "差值图",
    "Drape form · 3D": "悬垂形态 · 3D",
    "Drape form": "悬垂形态",
    "Form": "形态",
    "generic": "通用",
    "measured": "实测",
    "Reset view": "复位视角",
    "Reset 3D view": "复位 3D 视角",
    "Front view": "正视图",
    "Front 3D view": "3D 正视图",
    "Auto-rotate": "自动旋转",
    "Toggle auto-rotate": "切换自动旋转",
    "Before / after comparison — arrow keys to wipe": "前/后对比——方向键擦除",
    "scale max": "刻度上限",
    "generic-vs-measured · single engine": "通用 vs 实测 · 单一引擎",
    "per-vertex |Δ| · displacement 3D": "逐顶点 |Δ| · 位移 3D",
    "drag to rotate · scroll to zoom · CLO3D drape simulation · display mesh 9,999 of 117,150 faces · not physical ground truth": "拖拽旋转 · 滚轮缩放 · CLO3D 悬垂仿真 · 显示网格 9,999 / 117,150 面 · 非物理真值",
    "drag to rotate · scroll to zoom · per-vertex |Δ| · 13k-point display sample · source mesh 59,374 vertices": "拖拽旋转 · 滚轮缩放 · 逐顶点 |Δ| · 1.3 万点显示采样 · 源网格 59,374 顶点",
    "drag to rotate · per-vertex |Δ| · 13k-point sample · source mesh 59,374 verts · scale 0–135 mm": "拖拽旋转 · 逐顶点 |Δ| · 1.3 万点采样 · 源网格 59,374 顶点 · 刻度 0–135 mm",
    "drag to rotate · CLO3D drape simulation · display mesh 9,999 of 117,150 faces · not physical ground truth": "拖拽旋转 · CLO3D 悬垂仿真 · 显示网格 9,999 / 117,150 面 · 非物理真值",
    "drag to rotate · where P28 actually moves · generic → measured": "拖拽旋转 · P28 实际位移处 · 通用 → 实测",
    "drag to compare · generic vs measured": "拖拽对比 · 通用 vs 实测",
    "drag to compare · P28 felted wool · Δ 21.8 mm": "拖拽对比 · P28 毡呢针织 · Δ 21.8 mm",

    // ---- panel tabs / headings ----
    "Materials": "材料",
    "My Materials": "我的材料",
    "Methods": "方法",
    "About": "关于",
    "Compare": "对比",
    "Compare two fabrics": "对比两块面料",
    "My measured materials · drape G1 Δ": "我的实测材料 · 悬垂 G1 Δ",
    "Measured materials": "实测材料",
    "7 measured fabrics · ranked by difference": "7 块实测面料 · 按差值排序",
    "Sort order only · the 3D view shows the drape (G1) scenario.": "仅排序 · 3D 视图展示悬垂(G1)场景。",
    "ID": "编号",
    "Drape Δ": "悬垂 Δ",
    "Fitted Δ": "合体 Δ",
    "Drape · G1": "悬垂 · G1",
    "Fitted · G2": "合体 · G2",
    "G1 mean · 7 specimens": "G1 均值 · 7 试样",
    "G2 mean · 7 specimens": "G2 均值 · 7 试样",
    "G2 fitted mean · 7 specimens": "G2 合体均值 · 7 个试样",
    "current": "当前",
    "— · first version": "— · 首个版本",
    "Measured materials · drape G1 Δ": "实测材料 · 垂坠 G1 Δ",
    "Measured materials · fitted G2 Δ": "实测材料 · 合体 G2 Δ",
    "loading drape meshes": "正在加载垂坠网格",
    "loading displacement map": "正在加载位移图",
    "1.2 MB · first load only": "1.2 MB · 仅首次加载",
    "1.9 MB · first load only": "1.9 MB · 仅首次加载",
    "still loading · large mesh over a slow connection": "仍在加载 · 网络较慢且网格较大",
    "mesh unavailable": "网格不可用",
    "required once you start a record: without the CLO version and the baseline preset, the record cannot be re-checked when CLO revises its generic library. Optional. A file without a record is still accepted and is listed as an unqualified candidate. A record states what was measured and by whom — it is not a claim that the fabric is accurate.": "开始填写记录后为必填：没有 CLO 版本与基线预设，将来 CLO 修改其通用库时这条记录就无法重新核对。选填。没有记录的文件仍会被接收，列为未限定候选。记录说明的是测了什么、谁测的 —— 它不是在声称这块面料准确。",
    "Accepted: .zfab · .csv · .pdf · .txt · .json · .xlsx. The .zfab is the fabric; the rest are stored alongside it as declared evidence — they are filed, not parsed into properties. This live demo really uploads the file and stores it as a candidate. It is not registered as a measured asset and produces no delta — provenance review, a named baseline and a garment comparison are still required.": "接受的格式：.zfab · .csv · .pdf · .txt · .json · .xlsx。.zfab 是面料本体，其余作为声明证据一并存放 —— 只归档，不解析成属性。本实时演示会真的上传文件并存为候选。它不会登记为实测资产，也不产生差值 —— 仍需溯源审核、具名基线与服装对比。",
    "ISO 13934-1 tensile · low-load response · 5% secant stiffness → CLO stretch index · a proxy, not a standard stretch test": "ISO 13934-1 拉伸 · 低载响应 · 5% 割线刚度 → CLO 拉伸指数 · 代理，非标准拉伸测试",
    "Finding": "发现",
    "G1 FV2 A-line (drape) · G2 FV2 H-line (fitted)": "G1 FV2 A 字裙（垂坠）· G2 FV2 H 型裙（合体）",
    "Compare with another fabric": "与另一块面料对比",
    "What it does to the garment · G1 gathered A-line maxi": "换到衣服上是什么后果 · G1 抽褶 A 字长裙",
    "Widest hem": "最大摆宽",
    "Folds counted": "褶数（目测）",
    "Hem length": "下摆高度",
    "about 10 cm higher than the generic run": "比通用那一版高约 10 cm",
    "Folds are counted off the rendered silhouette, not read from the solver. These are differences between two simulations, not measurements of a real garment.": "褶数是从渲染侧影上数的，不是解算器输出。这些是两次仿真之间的差别，不是对真实服装的测量。",
    "preparing…": "准备中…",
    "export failed": "导出失败",
    "download unavailable": "无法下载",
    "download failed": "下载失败",
    "concept only": "仅为概念",
    "open the live site to upload": "请到线上站点上传",
    "showing the still image instead": "改为显示静态图",
    "These deltas are a snapshot, not a live reading: they were computed once, on CLO3D 2026.0.374. CLO ships two to three major versions a year, and a new engine or an updated preset library moves the generic side without touching this record — so a delta ages, and nothing here refreshes it for you.": "这些差值是一次快照，不是实时读数：它们只在 CLO3D 2026.0.374 上算过一次。CLO 每年发 2–3 个大版本，新引擎或更新后的预设库会改变 generic 一侧，而本记录不会跟着变 —— 所以差值会过期，这里不会自动刷新它。",
    "loading drape mesh": "正在加载垂坠网格",
    "Every row carries its own material record (version, calibration route and date) and measurement record (method, sample size, test house, declared departures) — a row lifted into another system still says what it is and how it was produced.": "每一行都自带它自己的材料档案（版本、标定路线与日期）与测量档案（方法、样本量、检测方、已声明的偏离）—— 单拿一行放进别的系统，它仍能说清楚自己是什么、怎么来的。",
    "Taking the data away": "把数据带走",
    "Export writes one row per specimen, and every row carries its own material record (version, calibration route, date) and measurement record (method, sample size, test house, declared departures).": "导出每个试样一行，而每一行都自带它自己的材料档案（版本、标定路线、日期）与测量档案（方法、样本量、检测方、已声明的偏离）。",
    "The engine build and particle distance travel with each row, so a number can be re-checked against the CLO version it was computed on.": "引擎 build 与粒子间距随每一行一起走，所以任一数字都能对回它当时所在的 CLO 版本重核。",
    "Provenance is exported exactly as it was declared — this deployment does not verify it.": "溯源信息按声明原样导出 —— 本部署不作核验。",
    "The CSV export runs on the desktop panel. The two shells hold different fields, so a phone export would produce different columns — one export, one schema.": "CSV 导出在桌面面板上。两端字段不同，手机导出会产出不同的列 —— 一个导出，一套 schema。",
    "Solver repeatability": "求解器重复性",
    "repeat runs were not performed on this fabric.": "本块面料未做重复跑。",
    "Repeatability was checked on P15 and P28 only, and only within a session — a fresh session moved P15 from 95.0 to 99–102 mm and P28 from 21.8 to 32.0 mm, further than the within-session spread. Read one delta as a single-session reading; the ranking and the 12.0 mm median are the sturdier parts.": "重复性只在 P15 与 P28 上测过，且只是同一会话内 —— 换一个会话重跑，P15 从 95.0 变到 99–102 mm，P28 从 21.8 变到 32.0 mm，比会话内的波动还大。单个差值请当作一次会话的读数；更经得起看的是排名与 12.0 mm 中位数。",
    "Export the 7 seed delta records · CSV →": "导出 7 条种子差值记录 · CSV →",
    "Every row carries its own material record (version, calibration route and date) and measurement record (method, sample size, test house, declared departures) — a row lifted into another system still says what it is and how it was produced. Contributed uploads are not in this file: they have no baseline comparison yet, so they have no delta to export.": "每一行都自带它自己的材料档案（版本、标定路线与日期）与测量档案（方法、样本量、检测方、已声明的偏离）—— 单拿一行放进别的系统，它仍能说清楚自己是什么、怎么来的。贡献上传的文件不在这份里：它们还没有基线对比，也就没有差值可导。",
    "per-vertex SD": "逐顶点 SD",
    "repeat runs, one session.": "次重复跑 · 同一会话。",
    "Re-running this comparison": "重跑这个对比",
    "Everything needed is on this page: the measured .zfab (download it from the fabric card), the named generic preset, both garment scenarios, the engine build, the particle distance and the fitting mode.": "需要的东西本页都有：实测 .zfab（在面料卡上下载）、具名的通用预设、两个服装场景、引擎 build、粒子间距与 fitting 模式。",
    "Method: build your own garment, apply the generic preset and simulate, export the mesh; apply the measured .zfab to the same garment and simulate again, export; compare the two meshes vertex by vertex.": "方法：搭你自己的服装，先用通用预设仿真并导出网格；再把实测 .zfab 应用到同一件服装上重跑并导出；两个网格逐顶点对比。",
    "You cannot reproduce these exact numbers.": "你无法复现这些确切的数字。",
    "A different CLO version is a different engine.": "换一个 CLO 版本就是换一个引擎。",
    "What the engine actually receives.": "引擎实际收到的是什么。",
    "Sign in first — a contributed fabric is stored against your account (account menu, top of the panel).": "请先登录 —— 贡献的面料会记在你的账户名下（面板顶部的账户菜单）。",
    "Mass and thickness go into CLO3D in their measured units — the fabric panel has a real g/m² field and a millimetre thickness field, filled 1:1. Bending, stretch and shear have no physical-unit entry at all: they exist only as a 0–99 index, so the measured values above had to be translated into index positions. That translation step is where a measured fabric stops being measured.": "克重与厚度是按实测单位直接填进 CLO3D 的 —— 面料面板里有真的 g/m² 输入框和毫米厚度框，1:1 填入。而弯曲、拉伸、剪切**根本没有物理单位入口**：它们只以 0–99 指数存在，所以上面那些实测值必须被换算成指数位置。这一步换算，就是一块实测面料停止“实测”的地方。",
    "The garment engineering files are not distributed, and a delta belongs to the garment it was measured on — what transfers is the method, not the millimetres.": "服装工程文件不对外分发，而一个差值属于它被测量时的那件服装 —— 能迁移的是方法，不是毫米数。",
    "Results from another build must be reported separately, not merged into this record.": "另一个 build 的结果必须单独报告，不能并进本记录。",
    "or sign in with email": "或用邮箱登录",
    "Email me a link": "发送登录链接到邮箱",
    "A measured digital-material workspace for CLO3D — see how far a generic fabric preset sits from the measured fabric.": "面向 CLO3D 的实测数字面料工作台——直观看到通用面料预设与实测面料之间差多少。",
    "3 of 5 engine inputs are ISO-sourced": "5 项引擎输入中 3 项源自 ISO",
    "Deltas are generic-vs-measured differences computed inside CLO3D — not errors against physical reality. Bending is a non-standard cantilever; shear is left at the engine default.": "差值是在 CLO3D 内部计算的「通用 vs 实测」差异 — 并非相对物理真实的误差。弯曲为非标悬臂，剪切保留引擎默认值。",
    "Guests can browse everything. Uploading a fabric needs sign-in.": "访客可浏览全部内容；上传面料才需登录。",
    "Export the 7 seed delta records · Excel →": "导出 7 条种子差值记录 · Excel →",
    "or download the same table as CSV": "或下载同一张表的 CSV 版",
    "Both files carry the same 42 columns: every row has its own material record (version, calibration route and date) and measurement record (method, sample size, test house, declared departures), so a row lifted into another system still says what it is and how it was produced. Contributed uploads are not included — without a baseline comparison they have no delta to export.": "两份文件带的是同一套 42 列：每一行都自带它自己的材料档案（版本、标定路线与日期）与测量档案（方法、样本量、检测方、已声明的偏离），单拿一行放进别的系统仍能说清楚自己是什么、怎么来的。贡献上传的文件不在内 —— 没有基线对比就没有差值可导。",
    "G1 median · robust": "G1 中位数 · 稳健",
    "specimens / specs": "试样 / 规格",
    "7 specimens · 6 specs (P31/P32 same spec, dyed apart)": "7 试样 · 6 规格(P31/P32 同规格分染)",
    "7 specimens · 6 specs (P31/P32 same spec, separately dyed)": "7 试样 · 6 规格(P31/P32 同规格分染)",
    "Mean is inflated by one high-stretch outlier — P15 jersey (own mean 95 mm · largest single vertex 134 mm). Median 12.0 mm is the robust summary.": "均值被一个高拉伸离群值抬高——P15 针织(自身均值 95 mm · 最大单顶点 134 mm)。中位数 12.0 mm 才是稳健概括。",
    "+ My fabric isn't here": "+ 我的面料不在这里",

    // ---- fabric names ----
    "Cotton Poplin": "棉府绸",
    "Cotton Jersey": "棉针织",
    "Polyester Chiffon": "涤纶雪纺",
    "Worsted Wool": "精纺羊毛",
    "Felted Wool Knit": "毡呢针织",
    "3-proof PET Twill · brown": "三防涤纶斜纹 · 棕",
    "3-proof PET Twill · cream": "三防涤纶斜纹 · 米",
    "P06 · Cotton Poplin": "P06 · 棉府绸",
    "P15 · Cotton Jersey": "P15 · 棉针织",
    "P24 · Polyester Chiffon": "P24 · 涤纶雪纺",
    "P27 · Worsted Wool": "P27 · 精纺羊毛",
    "P28 · Felted Wool Knit": "P28 · 毡呢针织",
    "P31 · 3-proof PET Twill · brown": "P31 · 三防涤纶斜纹 · 棕",
    "P32 · 3-proof PET Twill · cream": "P32 · 三防涤纶斜纹 · 米",
    "· P06": "· P06",
    "· P15": "· P15",

    // ---- asset detail: fabric meta lines (translate the woven/knit word, keep numbers) ----
    "knit · 158 g/m² · 0.50 mm": "针织 · 158 g/m² · 0.50 mm",
    "knit · 371.5 g/m² · 2.19 mm": "针织 · 371.5 g/m² · 2.19 mm",
    "woven · 101.7 g/m² · 0.36 mm": "梭织 · 101.7 g/m² · 0.36 mm",
    "woven · 111.7 g/m² · 0.26 mm": "梭织 · 111.7 g/m² · 0.26 mm",
    "woven · 133.4 g/m² · 0.27 mm": "梭织 · 133.4 g/m² · 0.27 mm",
    "woven · 136.6 g/m² · 0.25 mm": "梭织 · 136.6 g/m² · 0.25 mm",
    "woven · 184.7 g/m² · 0.37 mm": "梭织 · 184.7 g/m² · 0.37 mm",

    // ---- foot labels (per fabric, fixed numbers) ----

    // ---- property rows ----
    "Property difference": "属性差异",
    "Property difference · generic → measured · warp/weft": "属性差异 · 通用 → 实测 · 经向/纬向",
    "Mass / area": "单位面积质量",
    "Thickness": "厚度",
    "Weight": "克重",
    "Weight + thickness": "克重 + 厚度",
    "Bending": "弯曲",
    "Bending · warp": "弯曲 · 经向",
    "Bending · weft": "弯曲 · 纬向",
    "Stretch": "拉伸",
    "Stretch · warp": "拉伸 · 经向",
    "Stretch · weft": "拉伸 · 纬向",
    "Stretch map": "拉伸图",
    "Mass / thickness relative difference = |generic − measured| ÷ measured × 100 · bending / stretch = CLO 0–99 index (no natural zero), shown as Δ index points · bars scaled within each kind": "单位面积质量 / 厚度的相对差 = |通用 − 实测| ÷ 实测 × 100 · 弯曲 / 拉伸 = CLO 0–99 指数(无自然零点),以 Δ 指数点显示 · 条形在各类内部各自缩放",

    // ---- evidence / provenance ----
    "Evidence available": "可用证据",
    "Garment delta records · G1 / G2": "服装差值记录 · G1 / G2",
    "Visual before/after · G1": "视觉前/后 · G1",
    "3D displacement map · G1": "3D 位移图 · G1",
    "Property isolation (ablation)": "属性隔离(消融)",
    "Provenance": "溯源",
    "Generic baseline": "通用基线",
    "Baseline source": "基线来源",
    "Baseline role": "基线角色",
    "G1 mean · skewed by P15": "G1 均值 · 被 P15 拉偏",
    "Material record": "材料档案",
    "Measured input": "实测输入",
    "Supersedes": "取代",
    "Measurement record · 3 of 5 engine inputs ISO-sourced": "测量档案 · 5 项引擎输入中 3 项源自 ISO",
    "Low-load tensile": "低载拉伸",
    "Shear": "剪切",
    "Conditioning": "调湿",
    "Fibre identification": "纤维鉴别",
    "Test house": "检测方",
    "Calibration": "标定",
    "ISO 3801 procedure · n=5": "ISO 3801 方法 · n=5",
    "ISO 5084 procedure (1 kPa) · n=5": "ISO 5084 方法（1 kPa）· n=5",
    "ISO 13934-1 procedure · n=5 per direction · read as a stretch proxy, not an extensibility test": "ISO 13934-1 方法 · 每向 n=5 · 借作拉伸代理，并非延展性测试",
    "Cantilever at 41.5° · non-standard · n=3 strips per direction · 2026-07-14": "悬臂法 41.5° · 非标准 · 每向 n=3 条 · 2026-07-14",
    "Not measured · engine default retained": "未测 · 保留引擎默认值",
    "ISO 139 not performed — declared departure": "未做 ISO 139 调湿 —— 已声明偏离",
    "SEM scale pattern + burn test · 100% wool confirmed": "SEM 鳞片形态 + 燃烧测试 · 确认 100% 羊毛",
    "Frankie, Jinan · commissioned 2026-06-24 · report date not recorded": "Frankie（济南）· 2026-06-24 委测 · 报告日期未记录",
    "Route A · CLO3D 2026.0.374": "Route A · CLO3D 2026.0.374",
    "Declared by the contributor and shown as declared — this deployment does not verify it. A blank field is a blank field, not a pass.": "由贡献者声明并照实展示 —— 本部署不作核验。空白就是空白，不等于合格。",
    "Measured side": "实测一侧",
    "Engine": "引擎",
    "Garment scenarios": "服装场景",
    "Garment G1 / G2": "服装 G1 / G2",
    "G1 source mesh": "G1 源网格",
    "Comparison record": "对比记录",
    "Credit": "署名",
    "Coverage note": "覆盖说明",
    "not run": "未运行",
    "view →": "查看 →",
    "available →": "可用 →",
    "CLO 2026.0.374 built-in library · V2 · as shipped": "CLO 2026.0.374 内置库 · V2 · 出厂原样",
    "CLO built-in library · V2 · as shipped": "CLO 内置库 · V2 · 出厂原样",
    "CLO3D 2026.0.374 · PD 10": "CLO3D 2026.0.374 · PD 10",
    "FV2 A-line / H-line": "FV2 A 型 / H 型",
    "Nearest available CLO stand-in; not a construction match (woven preset for a knit)": "最接近的 CLO 替代;非结构匹配(用梭织预设代针织)",
    "Weave-type match (poplin)": "组织匹配(府绸)",
    "Knit-type match (jersey)": "组织匹配(针织)",
    "Fabric-type match (chiffon)": "面料类型匹配(雪纺)",
    "Weave-family match (twill; fibre-agnostic)": "组织族匹配(斜纹;不限纤维)",
    "Family match (PET / Dewspo)": "族匹配(PET / Dewspo)",
    "Route A calibration": "路线 A 标定",
    "Calibrate into CLO3D": "标定进 CLO3D",
    "Measured .zfab": "实测 .zfab",
    "Download measured .zfab →": "下载实测 .zfab →",
    "Physical fabric": "实体面料",
    "Property-isolation evidence is available only for P15 and P28.": "属性隔离证据仅 P15 与 P28 可用。",
    "Properties highlighted from the isolation result — examined in the available runs, not independent causal contributions.": "属性来自隔离结果的高亮——仅在可用运行中考察,非独立因果贡献。",
    "Highlighted from the isolation result — see Property isolation below; examined in the available runs, not an independent causal contribution.": "来自隔离结果的高亮——见下方属性隔离;仅在可用运行中考察,非独立因果贡献。",
    "Largest measured differences shown · property isolation was not run on this fabric.": "显示最大实测差异 · 该面料未做属性隔离。",
    "Property differences shown · property isolation was not run on this fabric.": "显示属性差异 · 该面料未做属性隔离。",

    // ---- isolation view ----
    "P28 · isolation": "P28 · 隔离",
    "Replace one property group generic→measured and observe the isolated change produced. They don't simply add.": "把一组属性由通用换成实测,观察由此产生的隔离变化。它们并非简单相加。",
    "Re-simulated per-property on the two fabrics selected for isolation (P15, P28) — one stretch-dominated, one strongly non-additive. The other five are measured but this decomposition wasn't run on them.": "对选作隔离的两块面料(P15、P28)逐属性重新仿真——一块拉伸主导,一块强非相加。其余五块已实测,但未做此分解。",
    "Bending and stretch each produced larger isolated magnitudes than the full measured-input run. The sum of all isolated magnitudes was approximately 3.5× the full result, indicating strong non-additivity.": "弯曲与拉伸各自的隔离幅度都大于完整实测输入的运行。所有隔离幅度之和约为完整结果的 3.5 倍,表明强非相加性。",
    "Sum of single runs": "单项运行之和",
    "All measured properties": "全部实测属性",
    "Weight + thickness": "克重 + 厚度",
    "differs 85.1 mm more on the drape dress — isolation run highlights: stretch.": "在悬垂连衣裙上多差 85.1 mm——隔离运行高亮:拉伸。",
    "show the largest mean delta on the drape dress.": "在悬垂连衣裙上呈现最大均值差值。",
    "P15 jersey (95 mm)": "P15 针织(95 mm)",
    "P28 felted wool (21.8 mm)": "P28 毡呢羊毛(21.8 mm)",
    "largest mean delta (P15)": "最大均值差值(P15)",
    "7 calibrated files, loadable in CLO3D": "7 个已标定文件,可在 CLO3D 加载",

    // ---- methods ----
    "How to read the numbers": "如何解读这些数字",
    "How Δ is computed": "Δ 如何计算",
    "Why measuring matters": "为何测量重要",
    "Measurement to model": "从测量到模型",
    "Measurement to model — how each fabric was made.": "从测量到模型——每块面料如何构成。",
    "ISO → CLO coverage": "ISO → CLO 覆盖",
    "3 of 5 engine inputs come from an ISO source": "5 项引擎输入中有 3 项来自 ISO 来源",
    "mass ISO 3801 · thickness ISO 5084 · tensile ISO 13934-1 · n=5 · conditioning departure declared": "克重 ISO 3801 · 厚度 ISO 5084 · 拉伸 ISO 13934-1 · n=5 · 已声明调湿偏离",
    "Bending non-standard cantilever · shear at engine default": "弯曲为非标悬臂 · 剪切取引擎默认",
    "bending calibrated to a 41.5° cantilever chord; stretch from 5% secant": "弯曲以 41.5° 悬臂弦角标定;拉伸取 5% 割线",
    "bending to a 41.5° cantilever chord; stretch from 5% secant": "弯曲以 41.5° 悬臂弦角;拉伸取 5% 割线",
    "ISO 13934-1 low-load response · 5% secant stiffness → CLO stretch index (proxy, not a standard stretch test)": "ISO 13934-1 低载响应 · 5% 割线刚度 → CLO 拉伸指数(代理,非标准拉伸测试)",
    "ISO 13934-1 tensile · low-load 3–15% region → CLO stretch index · a proxy, not a standard stretch test": "ISO 13934-1 拉伸 · 低载 3–15% 区间 → CLO 拉伸指数 · 代理,非标准拉伸测试",
    "index = round[10 + 75·(log₁₀k − log₁₀0.13)/2.479]": "指数 = round[10 + 75·(log₁₀k − log₁₀0.13)/2.479]",
    "ISO 139 conditioning not done — disclosed departure": "未做 ISO 139 调湿——已披露的偏离",
    "Single engine (CLO3D) · n=5 per reported test, warp/weft where directional · 7 specimens / 6 specs (P31/P32 same spec, dyed apart)": "单一引擎(CLO3D)· 每项报告测试 n=5,有方向性者分经向/纬向 · 7 试样 / 6 规格(P31/P32 同规格分染)",
    "Single solver (CLO3D 2026.0.374, PD 10), two garment scenarios (G1 drape, G2 fitted), no physical ground-truth validation.": "单一求解器(CLO3D 2026.0.374,PD 10),两个服装场景(G1 悬垂,G2 合体),无物理真值验证。",
    "Spearman 0.98 / 1.00 = internal consistency only, not physical-truth validation": "Spearman 0.98 / 1.00 = 仅内部一致性,非物理真值验证",
    "Specimen level: each fabric's G1 / G2 Δ is that mean over the garment mesh (e.g. P15 G1 = 95 mm). Dataset level: 24.5 / 10.1 mm are the means of the seven specimen-level values (G1 median 12.0 mm).": "试样层:每块面料的 G1 / G2 Δ 是其在服装网格上的均值(如 P15 G1 = 95 mm)。数据集层:24.5 / 10.1 mm 是七个试样层数值的均值(G1 中位数 12.0 mm)。",
    "Every value is a within-CLO3D delta between a named generic preset and the measured input — not an error against physical reality.": "每个数值都是 CLO3D 内、具名通用预设与实测输入之间的差值——并非相对物理真实的误差。",
    "Generic baselines are manually chosen CLO library references, not equivalent physical fabrics — a delta is not an error against a naturally correct baseline.": "通用基线是人工从 CLO 库选的参照,并非等同的实体面料——差值不是相对某个天然正确基线的误差。",
    "Generic thickness is a constant 0.50 mm CLO placeholder across all presets — part of the thickness delta reflects this default, not a class-specific value.": "所有预设的通用厚度都是恒定的 0.50 mm CLO 占位值——厚度差值有一部分反映的是这个默认值,而非某类别的真实值。",
    "Generic preset thickness is a constant 0.50 mm CLO placeholder — part of each thickness gap reflects this default, not a class value.": "通用预设厚度是恒定的 0.50 mm CLO 占位值——每处厚度差有一部分反映的是这个默认值,而非类别真实值。",
    "Baseline = generic preset as shipped; measured side = calibrated copy — the two sides are not symmetric measurements. Baselines were chosen manually from the CLO library as comparison references; they are not claimed to be equivalent physical fabrics.": "基线 = 出厂原样的通用预设;实测一侧 = 已标定的副本——两侧并非对称测量。基线是人工从 CLO 库选作对比参照的,并不宣称是等同的实体面料。",
    "Baseline = generic preset as shipped; measured side = calibrated copy — not symmetric measurements.": "基线 = 出厂原样的通用预设;实测一侧 = 已标定副本——并非对称测量。",
    "Baseline = generic preset as shipped; measured side = calibrated copy — not symmetric measurements. P28 baseline is a woven Melton / Boiled preset used as a felted-wool-knit stand-in.": "基线 = 出厂原样的通用预设;实测一侧 = 已标定副本——并非对称测量。P28 基线用的是梭织 Melton / Boiled 预设,作为毡呢针织的替代。",
    "Measure the whole fabric — don't assume its properties add up.": "测量整块面料——别假定它的各属性能简单相加。",
    "Designer rule": "设计师法则",

    // ---- about ----
    "About this workspace": "关于本工作台",
    "What this is": "这是什么",
    "Whose workspace": "谁的工作台",
    "What the platform does not do": "本平台不做什么",
    "What this does not do": "本工具不做什么",
    "Disclosures": "披露",
    "DRAPE △ is designed to dock as a panel inside the CLO3D workflow; shown here in a desktop concept frame.": "DRAPE △ 设计为在 CLO3D 工作流内以面板形式停靠;此处以桌面概念外框展示。",
    "This v1 runs as a standalone web app; the working form is a panel that docks inside the CLO3D workflow (future integration).": "当前 v1 以独立网页应用运行;实际形态是停靠在 CLO3D 工作流内的面板(未来集成)。",
    "The private measured-material workspace of a fictional brand product-development team. The dataset is seven specimens measured and digitised within this project.": "某虚构品牌产品开发团队的私有实测材料工作台。数据集为本项目内实测并数字化的七个试样。",
    "This prototype represents the private measured-material workspace of a fictional brand product-development team. The dataset is seven specimens measured and digitised within this project.": "本原型代表某虚构品牌产品开发团队的私有实测材料工作台。数据集为本项目内实测并数字化的七个试样。",
    "A measured digital-material workspace: it organises physically-measured fabric and shows how far a named generic CLO preset sits from that measured input.": "实测数字面料工作台:它组织实体测量过的面料,并展示具名通用 CLO 预设与该实测输入差多少。",
    "DRAPE △ is a measured digital-material workspace: it organises fabric that has been physically measured and shows how far a named generic CLO preset sits from that measured input.": "DRAPE △ 是实测数字面料工作台:它组织实体测量过的面料,并展示具名通用 CLO 预设与该实测输入差多少。",
    "Laboratory measurement of cloth is mature; entering those measurements into a garment simulator is not. For each CLO3D input this workspace records whether the value could be entered directly from a physical measurement, through a proxy, through calibration against a physical reference, or not at all — and what that difference does to a simulated garment. The record travels with every fabric here. v1 demonstrates one intake channel end-to-end; the rest are designed concepts.": "面料力学的实验室测量是成熟的；把这些测量填进服装仿真软件不是。本工作区对 CLO3D 的每一个输入都记录：这个值是直接由物理测量填入、走代理量、靠对照实物标定，还是根本拿不到 —— 以及这个差别落到仿真服装上是什么。这份记录跟着每一块面料走。v1 完整演示了一条接入通道，其余为设计概念。",
    "Your measured-material workspace — how far each generic preset sits from the real fabric, inside CLO3D.": "你的实测材料工作台——在 CLO3D 内,每个通用预设与真实面料差多少。",
    "It does not measure fabric, derive properties from a photo, or certify a contributor's data — a file extension alone does not prove a fabric was physically measured. Provenance is shown, not verified; a delta only exists after a named baseline and a defined garment comparison, run in CLO3D offline.": "它不测量面料、不从照片推导属性、也不认证贡献者的数据——单凭文件后缀并不能证明一块面料经过实体测量。溯源是展示,而非核验;只有在具名基线与已定义的服装对比(离线在 CLO3D 中运行)之后,差值才存在。",
    "It does not derive properties from a photo, and a file extension alone does not prove a fabric was physically measured. Uploaded data would be a candidate pending provenance review — a named baseline and garment comparison are still required before any delta.": "它不从照片推导属性,单凭文件后缀也不能证明一块面料经过实体测量。上传的数据只是待溯源审核的候选——任何差值之前仍需具名基线与服装对比。",

    // ---- contribution channels / request ----
    "Contribution channels": "贡献通道",
    "Measured-material assets enter the library through these intake routes. The platform": "实测材料资产通过这些进料通道进入库。平台",
    "organises, versions and hands off": "组织、版本管理并交回",
    "measure, validate or certify. v1 demonstrates channel 1 end-to-end; the rest are the designed intake model.": "测量、验证或认证。v1 端到端演示通道 1;其余是设计的进料模型。",
    "Available": "可用",
    "Concept": "概念",
    "Upload a calibrated .zfab": "上传已标定的 .zfab",
    "Upload a calibrated": "上传已标定的",
    "Upload a measurement package": "上传一个测量包",
    "Drop a calibrated .zfab into the library": "把已标定的 .zfab 拖入库",
    "Drop a calibrated": "拖入已标定的",
    "into the library": "进入库",
    "You already have a CLO fabric file — bring it straight into the library.": "你已有 CLO 面料文件——直接带进库。",
    "Supplier spec-sheet feed": "供应商规格表进料",
    "Mills and suppliers contribute their catalogue data — weight, composition, finish, construction.": "面料厂与供应商贡献其目录数据——克重、成分、后整理、组织。",
    "Import from a fabric platform": "从面料平台导入",
    "Bring in from CLO-SET Connect, a Vizoo xTex scan or Browzwear, keeping source attribution.": "从 CLO-SET Connect、Vizoo xTex 扫描或 Browzwear 导入,保留来源署名。",
    "Measurement-device integration": "测量设备接入",
    "Connect an instrument — Cusick drape · KES / FAST · fabric scanner — that outputs values directly.": "接入直接输出数值的仪器——Cusick 悬垂 · KES / FAST · 面料扫描仪。",
    "Measure to ISO procedures": "按 ISO 方法测量",
    "Request lab measurement": "申请实验室测量",
    "Request measurement": "申请测量",
    "Send a physical swatch; a partner lab measures it to ISO and digitises it into a .zfab.": "寄出实体样布;合作实验室按 ISO 测量并数字化成 .zfab。",
    "Structured ISO values — mass (3801) · thickness (5084) · tensile (13934-1) · bending — as a CSV or form.": "结构化 ISO 数值——克重(3801)· 厚度(5084)· 拉伸(13934-1)· 弯曲——以 CSV 或表单形式。",
    "Stored with its declared provenance as a candidate. The library organises it and hands it back to CLO3D — it does not measure, validate or certify the values; correctness stays with the contributor.": "以其声明的溯源信息作为候选存储。库将其组织并交回 CLO3D——不测量、不验证、不认证数值;正确性由贡献者负责。",
    "This live demo really uploads the file and stores it as a": "本在线演示会真实上传文件并将其存为一个",
    ". It is not registered as a measured asset and produces no delta — provenance review, a named baseline and a garment comparison are still required.": "。它不会登记为实测资产,也不产生差值——仍需溯源审核、具名基线与服装对比。",
    "candidate": "候选",
    "choose a file": "选择文件",
    "choose a file · live": "选择文件 · 在线",
    "No measured assets uploaded to this deployment yet.": "此部署尚无上传的实测资产。",
    "Sign in to contribute": "登录以贡献",
    "Already measured elsewhere?": "已在别处测过?",
    "or structured measurement package for provenance review": "或用于溯源审核的结构化测量包",
    "Future import concept · not available in v1": "未来导入概念 · v1 不可用",
    "Designed future workflow · not available in v1": "设计中的未来流程 · v1 不可用",
    "Out of scope for v1": "超出 v1 范围",
    "No live progress, delivery date, pricing or automated result is produced here — this screen only describes the intended flow.": "此处不产生实时进度、交付日期、价格或自动化结果——本屏仅描述设想的流程。",
    "A new fabric would enter through specimen measurement, digital calibration, registration of a named generic baseline, and a defined garment comparison before being added with its available evidence. Future workflow — no live progress, pricing or automated result in v1.": "新面料将经由试样测量、数字标定、登记具名通用基线、以及已定义的服装对比,再连同其可用证据加入。未来流程——v1 不含实时进度、价格或自动化结果。",
    "A fabric that hasn't been measured has no delta to show. This is how a new fabric would enter the workspace — sketched, not live.": "未经测量的面料没有差值可显示。这是新面料进入工作台的设想路径——示意,非实时。",
    "A future build could register a measured-asset": "未来版本可登记实测资产",
    "after its measurement method, units and calibration provenance are reviewed. A named baseline and garment comparison would still be required before a delta record.": ",前提是其测量方法、单位与标定溯源经过审核。差值记录之前仍需具名基线与服装对比。",
    "It appears in My Materials with its generic-vs-measured delta.": "它会连同其通用 vs 实测差值出现在「我的材料」中。",
    "Unknown fabric": "未知面料",
    "An unmeasured fabric has no comparison data.": "未测量的面料没有对比数据。",
    "Current garment view paused.": "当前服装视图已暂停。",
    "NO MEASURED ASSET SELECTED": "未选择实测资产",
    "v1 covers already-measured fabric; an unmeasured fabric has no delta yet. Full framing in About.": "v1 覆盖已测量的面料;未测量的面料尚无差值。完整说明见「关于」。",
    "v1 covers fabric that has already been measured; an unmeasured fabric has no delta yet — see My Materials → “My fabric isn't here”. Full framing in About.": "v1 覆盖已测量的面料;未测量的面料尚无差值——见「我的材料 → 我的面料不在这里」。完整说明见「关于」。",

    // ---- request flow steps ----
    "A physical swatch goes to the measurement partner.": "实体样布寄给测量合作方。",
    "Send a specimen": "寄送试样",
    "Measure & digitise": "测量并数字化",
    "Mass, thickness, bending and low-load stretch, calibrated into a .zfab.": "克重、厚度、弯曲与低载拉伸,标定成 .zfab。",
    "Record a named generic baseline": "登记具名通用基线",
    "Pick the CLO built-in preset the delta will be measured against.": "选定差值所对照的 CLO 内置预设。",
    "Run the defined garment comparison": "运行已定义的服装对比",
    "Same garment scenario & solver settings, generic vs measured.": "相同服装场景与求解器设置,通用 vs 实测。",
    "Add the asset & its evidence": "加入资产及其证据",
    "Same dress, two fabrics — how differently generic-vs-measured differs.": "同一条裙、两块面料——通用 vs 实测的差异各不相同。",

    // ---- disclaimer footer ----
    "Exploratory prototype. Deltas are generic-vs-measured differences within CLO3D, not errors against physical reality.": "探索性原型。差值是 CLO3D 内通用 vs 实测的差异,并非相对物理真实的误差。",
    "measured fabric and shows each entry's provenance — it does": "实测面料并展示每条的溯源——它",
    "not": "不",
    "and": "、",

    // ---- misc ----
    "Light": "浅色",
    "Dark": "深色",

    // ---- second-pass fills (found in ZH verification) ----
    "Garment Δ": "服装 Δ",
    "= mean per-vertex absolute displacement between the generic-preset run and the measured-input run, within the same CLO3D garment scenario.": "= 在同一 CLO3D 服装场景内,通用预设运行与实测输入运行之间的逐顶点绝对位移均值。",
    "loading drape meshes…": "正在加载悬垂网格…",
    "59,374 vertices": "59,374 顶点",
    "provenance · uploader-declared": "溯源 · 上传者声明",
    "provenance · contributor's test report": "溯源 · 贡献者测试报告",
    "provenance · measurement partner / lab": "溯源 · 测量合作方 / 实验室",
    "provenance · supplier-declared": "溯源 · 供应商声明",
    "provenance · source platform": "溯源 · 来源平台",
    "provenance · instrument read-out": "溯源 · 仪器读数",
    "P06_measured.zfab · calibrated": "P06_measured.zfab · 已标定",
    "P15_measured.zfab · calibrated": "P15_measured.zfab · 已标定",
    "P24_measured.zfab · calibrated": "P24_measured.zfab · 已标定",
    "P27_measured.zfab · calibrated": "P27_measured.zfab · 已标定",
    "P28_measured.zfab · calibrated": "P28_measured.zfab · 已标定",
    "P31_measured.zfab · calibrated": "P31_measured.zfab · 已标定",
    "P32_measured.zfab · calibrated": "P32_measured.zfab · 已标定",

    "Physical fabric": "实体面料"
  };

  try { window.DRAPE_I18N_ZH = ZH; } catch (e) {}
  var STORE = 'drape_lang';
  function lang() {
    try { var u = new URLSearchParams(location.search).get('lang'); if (u === 'zh' || u === 'en') return u; } catch (e) {}
    try { return localStorage.getItem(STORE) || 'en'; } catch (e) { return 'en'; }
  }

  var observer = null, applying = false;
  function isSkippable(node) {
    var p = node.parentNode;
    while (p) { if (p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE' || p.nodeName === 'TEXTAREA') return true; p = p.parentNode; }
    return false;
  }
  function translateTextNodes(root) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n, hits = [];
    while (n = w.nextNode()) {
      if (isSkippable(n)) continue;
      var raw = n.nodeValue; if (!raw) continue;
      var key = raw.replace(/\s+/g, ' ').trim();
      if (key && ZH.hasOwnProperty(key) && ZH[key] !== key) hits.push([n, raw, key]);
    }
    hits.forEach(function (h) {
      // preserve leading/trailing whitespace of the original node value
      var m = h[1].match(/^(\s*)[\s\S]*?(\s*)$/);
      h[0].nodeValue = (m ? m[1] : '') + ZH[h[2]] + (m ? m[2] : '');
    });
  }
  function translateAttrs(root) {
    var els = root.querySelectorAll ? root.querySelectorAll('[placeholder],[aria-label],[title]') : [];
    els.forEach(function (e) {
      ['placeholder', 'aria-label', 'title'].forEach(function (a) {
        var v = e.getAttribute(a); if (!v) return;
        var key = v.replace(/\s+/g, ' ').trim();
        if (ZH.hasOwnProperty(key) && ZH[key] !== key) e.setAttribute(a, ZH[key]);
      });
    });
  }
  function applyZH() {
    if (lang() !== 'zh') return;
    applying = true;
    try { translateTextNodes(document.body); translateAttrs(document.body); } catch (e) {}
    applying = false;
  }
  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(function (muts) {
      if (applying) return;
      applying = true;
      try {
        if (lang() === 'zh') {
          muts.forEach(function (mu) {
            mu.addedNodes && mu.addedNodes.forEach(function (nd) {
              if (nd.nodeType === 1) { translateTextNodes(nd); translateAttrs(nd); }
              else if (nd.nodeType === 3) {
                var key = (nd.nodeValue || '').replace(/\s+/g, ' ').trim();
                if (ZH.hasOwnProperty(key) && ZH[key] !== key) nd.nodeValue = ZH[key];
              }
            });
          });
        }
        ensureToggle(); // keep the language button beside the sign-in control across re-renders
      } catch (e) {}
      applying = false;
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: false });
  }

  function toggle() {
    var next = lang() === 'zh' ? 'en' : 'zh';
    try { localStorage.setItem(STORE, next); } catch (e) {}
    // Switching reloads to re-render cleanly. Without a hash the mobile app boots
    // back to its splash and desktop back to its cover — so if the user is already
    // inside the app, stamp a hash that boot restores (mobile: current tab).
    try {
      var intro = document.getElementById('intro');    // mobile entry overlay
      var launch = document.getElementById('launch');  // desktop entry overlay
      var inMobileApp = intro && getComputedStyle(intro).display === 'none';
      var inDesktopApp = launch && (launch.classList.contains('gone') || getComputedStyle(launch).display === 'none');
      if (inMobileApp) {
        var onTab = document.querySelector('#tabbar button.on');
        location.hash = (onTab && onTab.dataset.v) ? '#' + onTab.dataset.v : '#app';
      } else if (inDesktopApp) {
        location.hash = '#app';
      }
    } catch (e) {}
    location.reload();
  }
  function makeBtn() {
    var b = document.createElement('button');
    b.id = 'langpill'; b.type = 'button';
    b.setAttribute('aria-label', 'Switch language / 切换语言');
    b.onclick = toggle;
    return b;
  }
  var INLINE = 'position:static;margin-right:8px;font-family:var(--mono,ui-monospace,Menlo,monospace);' +
    'font-size:12px;font-weight:700;padding:6px 11px;border-radius:20px;border:1px solid var(--line,#e9ebee);' +
    'background:var(--card,#fff);color:var(--ink,#0d1014);cursor:pointer;line-height:1;vertical-align:middle';
  var FIXED = 'position:fixed;z-index:99998;font-family:var(--mono,ui-monospace,Menlo,monospace);' +
    'font-size:12px;font-weight:700;padding:7px 12px;border-radius:20px;border:1px solid rgba(127,127,127,.28);' +
    'background:#fff;color:#111;cursor:pointer;line-height:1;box-shadow:0 4px 14px -6px rgba(0,0,0,.3)';
  // Cover/entry screen is dark with a green glow — a solid white pill clashes.
  // Use a subtle ghost pill (mono, thin border, muted text) that belongs there.
  var COVER = 'position:absolute;top:18px;right:18px;z-index:5;font-family:var(--mono,ui-monospace,Menlo,monospace);' +
    'font-size:11px;font-weight:600;letter-spacing:.04em;padding:7px 13px;border-radius:20px;' +
    'border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:rgba(255,255,255,.72);' +
    'cursor:pointer;line-height:1;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)';
  // Place the language toggle next to the sign-in / identity control.
  // Desktop: inline, immediately before the .idchip in the panel header.
  // Mobile: fixed, just left of the Light/Dark toggle (both are top-right).
  // Fallback (cover/sign-in screens): fixed top-right corner.
  // A full-screen entry overlay (#launch) sits opaque on top of the panel, so
  // the .idchip underneath still exists in the DOM. While the cover is up we
  // must NOT dock the button into the (hidden) header — float it top-right instead.
  function coverShowing() {
    var l = document.getElementById('launch');
    if (l && !l.classList.contains('gone')) {
      try { return getComputedStyle(l).display !== 'none'; } catch (e) { return true; }
    }
    return false;
  }
  function ensureToggle() {
    var cover = coverShowing();
    var idchip = cover ? null : document.querySelector('.idchip');
    var mtoggle = cover ? null : document.querySelector('.toggle');
    var b = document.getElementById('langpill');
    if (idchip) {
      if (!b) b = makeBtn();
      // sit immediately to the LEFT of the sign-in / identity chip, right-aligned together
      if (b.nextSibling !== idchip || b.parentNode !== idchip.parentNode) {
        b.style.cssText = INLINE + ';margin-left:auto';
        try { idchip.style.marginLeft = '0'; } catch (e) {}
        idchip.parentNode.insertBefore(b, idchip);
      }
    } else if (mtoggle) {
      // Mobile: match the Light/Dark toggle exactly (see injected .mobpill CSS,
      // which follows the light/dark theme), positioned just left of it.
      if (!b) { b = makeBtn(); document.body.appendChild(b); }
      if (b.className !== 'mobpill') { b.removeAttribute('style'); b.className = 'mobpill'; }
      if (b.parentNode !== document.body) document.body.appendChild(b);
      // Same top/inset as the Light toggle so the two line up by construction (top-right).
      b.style.top = 'calc(16px + env(safe-area-inset-top,0px))';
      b.style.left = 'auto'; b.style.bottom = 'auto'; b.style.transform = 'none';
      // The theme toggle is position:fixed, so offsetParent is always null — test its
      // rendered width instead (0 while hidden pre-login).
      var tr = mtoggle.getBoundingClientRect();
      if (tr.width > 0) {
        // In-app: sit just to the LEFT of the visible Light/Dark toggle.
        b.style.right = Math.round(window.innerWidth - tr.left + 10) + 'px';
      } else {
        // Pre-login: theme toggle hidden — take the top-right corner slot alone.
        b.style.right = 'max(18px, calc(50% - 222px))';
      }
    } else {
      if (!b) b = makeBtn();
      var lc = document.getElementById('launch');
      if (lc && !lc.classList.contains('gone')) {
        // dock INSIDE the cover overlay (its own top-right), so a framed/centred
        // window can't push the button outside the visible screen.
        if (b.parentNode !== lc || b.style.position !== 'absolute') {
          b.style.cssText = COVER;
          lc.appendChild(b);
        }
      } else if (b.style.position !== 'fixed' || b.parentNode !== document.body) {
        b.style.cssText = FIXED + ';top:14px;right:14px'; document.body.appendChild(b);
      }
    }
    var lt = lang() === 'zh' ? 'EN' : '中';
    if (b && b.textContent !== lt) b.textContent = lt;
  }

  function injectCSS() {
    if (document.getElementById('drape-i18n-css')) return;
    var s = document.createElement('style'); s.id = 'drape-i18n-css';
    // Mobile pill mirrors the Light/Dark .toggle so the two sit as a matched pair,
    // and follows the theme (light default / body.dark).
    s.textContent =
      '#langpill.mobpill{position:fixed;z-index:40;display:inline-flex;align-items:center;box-sizing:border-box;' +
      'min-height:33px;font-family:var(--mono,ui-monospace,Menlo,monospace);' +
      'font-size:12px;font-weight:600;line-height:1;padding:0 13px;border-radius:22px;cursor:pointer;' +
      'background:#fff;border:1px solid #dcdee1;color:#3a3d42;user-select:none}' +
      'body.dark #langpill.mobpill{background:#17181b;border-color:#2a2c31;color:#c9cbd0}' +
      // Flat on the entry screens (like the sign-in buttons); shadowed once inside the
      // app, matching the Light/Dark toggle that only appears after login.
      'body.entered #langpill.mobpill{box-shadow:0 6px 20px -10px rgba(0,0,0,.3)}' +
      // Tap-to-enlarge for the methods chart (any image inside a .fig).
      '.fig img{cursor:zoom-in}' +
      '#drape-lightbox{position:fixed;inset:0;z-index:100000;background:rgba(10,12,14,.94);' +
      'overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;' +
      '-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}' +
      '#drape-lightbox .lbpad{min-width:100%;min-height:100%;display:flex;align-items:center;' +
      'justify-content:center;padding:16px;box-sizing:border-box}' +
      '#drape-lightbox img{display:block;border-radius:6px;background:#fff;' +
      'box-shadow:0 24px 70px -24px rgba(0,0,0,.7);touch-action:pinch-zoom}' +
      /* Wide screens fit the figure; narrow screens must NOT — fitting a 1064px chart
         into a 375px phone was a 1.07x enlargement, i.e. no enlargement at all. There
         the figure is drawn at its own size and the overlay pans. */
      '@media(min-width:760px){#drape-lightbox img{max-width:calc(100vw - 64px);max-height:calc(100vh - 64px)}}' +
      '@media(max-width:759px){#drape-lightbox img{width:auto;max-width:none}}' +
      '#drape-lbclose{position:fixed;top:calc(10px + env(safe-area-inset-top,0px));right:12px;z-index:1;' +
      'width:44px;height:44px;border-radius:50%;border:0;background:rgba(255,255,255,.92);color:#111;' +
      'font-size:20px;line-height:1;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.4)}' +
      '#drape-lbhint{position:fixed;left:0;right:0;bottom:calc(12px + env(safe-area-inset-bottom,0px));' +
      'text-align:center;font-family:var(--mono,monospace);font-size:11px;color:rgba(255,255,255,.72);pointer-events:none}';
    (document.head || document.documentElement).appendChild(s);
  }
  function zh() {
    try { return ((new URLSearchParams(location.search).get('lang')) ||
      (window.localStorage && localStorage.getItem('drape_lang'))) === 'zh'; } catch (e) { return false; }
  }

  function initLightbox() {
    if (window.__drapeLightbox) return; window.__drapeLightbox = true;
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!(t && t.tagName === 'IMG' && t.closest && t.closest('.fig'))) return;
      var narrow = window.innerWidth < 760;
      var ov = document.createElement('div'); ov.id = 'drape-lightbox';
      var pad = document.createElement('div'); pad.className = 'lbpad';
      var big = document.createElement('img'); big.src = t.currentSrc || t.src; big.alt = t.alt || '';
      // On a phone the figure is shown at its own pixel size so the axis labels are
      // actually readable; the overlay then scrolls in both directions.
      if (narrow) big.onload = function () { big.style.width = (big.naturalWidth || 1000) + 'px'; };
      var x = document.createElement('button'); x.id = 'drape-lbclose'; x.type = 'button';
      x.setAttribute('aria-label', zh() ? '\u5173\u95ed' : 'Close'); x.innerHTML = '\u2715';
      pad.appendChild(big); ov.appendChild(pad); ov.appendChild(x);
      if (narrow) {
        var hint = document.createElement('div'); hint.id = 'drape-lbhint';
        hint.textContent = zh() ? '\u62d6\u52a8\u5e73\u79fb \u00b7 \u53cc\u6307\u7f29\u653e' : 'drag to pan \u00b7 pinch to zoom';
        ov.appendChild(hint);
      }
      document.body.appendChild(ov);
      var prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
      function close() {
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        document.body.style.overflow = prevOverflow;
        document.removeEventListener('keydown', onKey);
      }
      function onKey(ev) { if (ev.key === 'Escape') close(); }
      // Only the backdrop closes: tapping the figure must pan it, not dismiss it.
      ov.addEventListener('click', function (ev) { if (ev.target === ov || ev.target === pad) close(); });
      x.addEventListener('click', close);
      document.addEventListener('keydown', onKey);
      setTimeout(function () { try { x.focus(); } catch (e) {} }, 30);
    });
  }
  function boot() {
    injectCSS();
    initLightbox();
    ensureToggle();
    applyZH();
    startObserver();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  // delayed passes catch late async renders (auth card / identity chip, first 3D view)
  setTimeout(function () { applyZH(); ensureToggle(); }, 400);
  setTimeout(function () { applyZH(); ensureToggle(); }, 1200);
  window.__drapeEnsureToggle = ensureToggle;
})();
