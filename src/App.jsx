import React, { useState, useMemo, useEffect, useRef } from 'react'

import { dbLoad, dbSave } from './db.js'

const SHARED_KEY = "hhb_shared_v1"
const MEMORY_KEY = "hhb_memory_v1"

async function loadShared(def) { return dbLoad(SHARED_KEY, def) }
async function saveShared(data) { return dbSave(SHARED_KEY, data) }
async function loadMemory() { return dbLoad(MEMORY_KEY, {}) }
async function saveMemory(mem) { return dbSave(MEMORY_KEY, mem) }

// Normalize a transaction description to a stable key for memory lookup
// Strip numbers, amounts, dates, terminal codes so "Albert Heijn 1094" == "Albert Heijn 2031"
function memKey(desc) {
  return (desc||"")
    .toLowerCase()
    .replace(/[0-9]{4,}/g, "")   // remove long numbers (terminal IDs etc)
    .replace(/[0-9]+,[0-9]+/g, "") // remove amounts like 12,50
    .replace(/\d+/g, "")      // remove standalone short numbers
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

// Users
const DIRK    = { id:"dirk",    name:"Dirk",    color:"#2563eb", light:"#eff6ff", border:"#bfdbfe" };
const SHELLEY = { id:"shelley", name:"Shelley", color:"#db2777", light:"#fdf2f8", border:"#fbcfe8" };
const USERS   = [DIRK, SHELLEY];
const MONTHS  = ["Januari","Februari","Maart","April","Mei","Juni","Juli","Augustus","September","Oktober","November","December"];
const MONTHS_S = ["Jan","Feb","Mrt","Apr","Mei","Jun","Jul","Aug","Sep","Okt","Nov","Dec"];

function fmt(n) { return new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR"}).format(n||0); }
function newId() { return Math.random().toString(36).slice(2,9); }

// Defaults
const DEFAULT_GROUPS = [
  { id:"samen_vast", label:"Vaste lasten samen" },
  { id:"samen_var",  label:"Variabele lasten samen" },
  { id:"dirk",       label:"Eigen lasten Dirk" },
  { id:"shelley",    label:"Eigen lasten Shelley" },
];

const DEFAULT_POSTS = [
  { id:"huur",      group:"samen_vast", label:"Huur/Hypotheek",       planned:870    },
  { id:"energie",   group:"samen_vast", label:"Energie / Gas",        planned:87     },
  { id:"vitens",    group:"samen_vast", label:"Vitens",               planned:19     },
  { id:"kpn",       group:"samen_vast", label:"Internet KPN",         planned:58     },
  { id:"nlziet",    group:"samen_vast", label:"NL Ziet",              planned:9.90   },
  { id:"spotify",   group:"samen_vast", label:"Spotify",              planned:18     },
  { id:"videoland", group:"samen_vast", label:"Videoland",            planned:3.96   },
  { id:"vodafone",  group:"samen_vast", label:"Vodafone",             planned:52     },
  { id:"autoverzk", group:"samen_vast", label:"Auto verzekering",     planned:25     },
  { id:"zorgverzk", group:"samen_vast", label:"Zorgverzekering",      planned:313.60 },
  { id:"klaverbl",  group:"samen_vast", label:"Klaverblad inboedel",  planned:12     },
  { id:"gezrek",    group:"samen_vast", label:"Gezamenlijke rekening",planned:4.80   },
  { id:"wegenb",    group:"samen_vast", label:"Wegenbelasting",       planned:52     },
  { id:"anwb",      group:"samen_vast", label:"Pechhulp ANWB",        planned:9.20   },
  { id:"kinderopv", group:"samen_vast", label:"Kinderopvang",         planned:1140   },
  { id:"diggy",     group:"samen_vast", label:"Brokken Diggy",        planned:28     },
  { id:"boodschap", group:"samen_var",  label:"Boodschappen",         planned:550    },
  { id:"brandstof", group:"samen_var",  label:"Brandstof",            planned:100    },
  { id:"uitjes",    group:"samen_var",  label:"Uitjes / Uit eten",    planned:150    },
  { id:"maeve",     group:"samen_var",  label:"Gezondheid Maeve",     planned:50     },
  { id:"overig_s",  group:"samen_var",  label:"Overig samen",         planned:50     },
  { id:"duo_d",     group:"dirk",       label:"DUO",                  planned:45.41  },
  { id:"sport_d",   group:"dirk",       label:"Sporten",              planned:43     },
  { id:"dela_d",    group:"dirk",       label:"Dela",                 planned:15.48  },
  { id:"bank_d",    group:"dirk",       label:"Bankkosten",           planned:5.45   },
  { id:"bitease",   group:"dirk",       label:"BitEase",              planned:8.99   },
  { id:"var_d",     group:"dirk",       label:"Variabel Dirk",        planned:150    },
  { id:"sport_s",   group:"shelley",    label:"Sporten",              planned:35.50  },
  { id:"dela_s",    group:"shelley",    label:"Dela",                 planned:15.80  },
  { id:"bank_s",    group:"shelley",    label:"Bankkosten",           planned:3.45   },
  { id:"var_s",     group:"shelley",    label:"Variabel Shelley",     planned:150    },
];

const DEFAULT_SPAAR = [
  { id:"sp_d1", owner:"dirk",    label:"Spaarrekening",   planned:150 },
  { id:"sp_d2", owner:"dirk",    label:"Vakantie",        planned:75  },
  { id:"sp_d3", owner:"dirk",    label:"Buffer",          planned:75  },
  { id:"sp_d4", owner:"dirk",    label:"Maeve potje",     planned:75  },
  { id:"sp_d5", owner:"dirk",    label:"Beleggen",        planned:250 },
  { id:"sp_d6", owner:"dirk",    label:"Crypto",          planned:25  },
  { id:"sp_s1", owner:"shelley", label:"Spaarrekening",   planned:50  },
  { id:"sp_s2", owner:"shelley", label:"Maeve spaarrek.", planned:25  },
  { id:"sp_s3", owner:"shelley", label:"By Bae",          planned:50  },
];

const DEFAULT_DATA = {
  inkomen: { dirk:3367, shelley:2261 },
  groups:  DEFAULT_GROUPS,
  months:  {},
  spaar:   {},
};

// Transaction classification
function classifyTx(code, name, omschr) {
  const c = (code||"").toLowerCase();
  const nd = (name+" "+omschr).toLowerCase();
  if (c === "tb") {
    if (/spaar|vakantie|buffer|maeve|beleggen|crypto|spaargeld/i.test(nd)) return "spaar";
    if (/bello|shelley/i.test(nd)) return "overboeking_partner";
    return "overboeking_eigen";
  }
  if (c === "cc") return "creditcard";
  if (c === "db") return "bankkosten";
  if (c === "ba" && nd.includes("retour")) return "retour";
  return "uitgave";
}

const TX_INFO = {
  spaar:               { label:"Spaartransactie",     hint:"Naar spaar/belegrekening",           def:"overslaan"     },
  overboeking_partner: { label:"Overboeking partner", hint:"Naar gezamenlijk of Shelley",        def:"overslaan"     },
  overboeking_eigen:   { label:"Eigen overboeking",   hint:"Naar eigen rekening",                def:"vragen"        },
  creditcard:          { label:"Creditcardbetaling",  hint:"Samengestelde betaling",             def:"vragen"        },
  bankkosten:          { label:"Bankkosten",          hint:"Rabobank kaart/rekening kosten",     def:"categoriseren" },
  retour:              { label:"Retour",              hint:"Geld terug ontvangen",               def:"overslaan"     },
  uitgave:             { label:"Gewone uitgave",      hint:"Normale betaling, AI categoriseert", def:"categoriseren" },
};

// CSV Parser
function parseRabobank(text) {
  const lines = text.split(/\r?\n/).filter(function(l){ return l.trim(); });
  function parseLine(line) {
    var r = [], cur = "", inQ = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { r.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    r.push(cur.trim());
    return r;
  }
  var si = lines[0].toLowerCase().includes("iban") ? 1 : 0;
  return lines.slice(si).filter(function(l){ return l.trim(); }).map(function(line, i) {
    var r = parseLine(line);
    if (r.length < 7) return null;
    var rawAmt   = (r[6]||"").replace(",",".").replace(/[^0-9.\-+]/g,"");
    var amount   = Math.abs(parseFloat(rawAmt)||0);
    var isCredit = rawAmt.startsWith("+") || parseFloat(rawAmt) > 0;
    var code     = r[13]||"";
    var name     = r[9]||"";
    var omschr   = r[19]||"";
    var desc     = [name, omschr].filter(function(s){ return s.trim(); }).join(" / ").slice(0, 120);
    var txClass  = classifyTx(code, name, omschr);
    return { id:newId(), desc:desc, name:name, amount:amount, isCredit:isCredit, date:r[4]||"", code:code, txClass:txClass };
  }).filter(function(r){ return r && r.amount > 0 && !r.isCredit; });
}

// AI Categorizer
// Keyword fallback categorizer
var KW = [
  {w:["huur","hypotheek"],           id:"huur"},
  {w:["vitens"],                     id:"vitens"},
  {w:["eneco","vattenfall","essent","nuon"], id:"energie"},
  {w:["kpn","ziggo"],                id:"kpn"},
  {w:["nlziet","nl ziet"],           id:"nlziet"},
  {w:["spotify"],                    id:"spotify"},
  {w:["videoland"],                  id:"videoland"},
  {w:["vodafone"],                   id:"vodafone"},
  {w:["asr","zorgverzekering"],      id:"zorgverzk"},
  {w:["klaverblad"],                 id:"klaverbl"},
  {w:["anwb"],                       id:"anwb"},
  {w:["wegenbelasting","rdw"],       id:"wegenb"},
  {w:["autoverzekering","abn auto"], id:"autoverzk"},
  {w:["shell","tinq","tango","brandstof","esso","bp "], id:"brandstof"},
  {w:["kinderopvang","bso","kdv"],   id:"kinderopv"},
  {w:["diggy","dierenarts"],         id:"diggy"},
  {w:["albert heijn","bck*ah","ah to go","jumbo","lidl","aldi","plus tiel","plus supermarkt","spar ","foodmaster","slagerij"], id:"boodschap"},
  {w:["restaurant","cafe","thuisbezorgd","uber eats","deliveroo","mcdonalds","maassilo","posttheater","venue "], id:"uitjes"},
  {w:["duo ","studieschuld"],        id:"duo_d"},
  {w:["dela"],                       id:"dela_d"},
  {w:["fitnessclub","basic-fit","fitness","multisafepay"], id:"sport_d"},
  {w:["bitease"],                    id:"bitease"},
];

function kwMatch(desc, posts) {
  var d = (desc||"").toLowerCase();
  for (var i=0; i<KW.length; i++) {
    for (var j=0; j<KW[i].w.length; j++) {
      if (d.indexOf(KW[i].w[j]) !== -1) {
        if (posts.find(function(p){ return p.id===KW[i].id; })) return KW[i].id;
      }
    }
  }
  return "__onbekend__";
}

function aiCategorize(transactions, posts) {
  if (!transactions.length) return [];
  // Always use keyword matching as the base - it works offline and is fast
  var kwResults = transactions.map(function(t,i){ return {index:i, postId:kwMatch(t.desc,posts)}; });
  return kwResults;
}

// Decimal input for check fields (supports comma + dot)
function DecInput({ value, onCommit, placeholder, style }) {
  var [local, setLocal] = useState(value !== null && value !== undefined ? String(value) : "");
  useEffect(function(){
    if (value !== null && value !== undefined && value !== "") {
      var n = parseFloat(value);
      setLocal(!isNaN(n) && n % 1 !== 0 ? n.toFixed(2).replace(".",",") : String(value));
    } else { setLocal(""); }
  }, [value]);
  return (
    <input
      type="text" inputMode="decimal"
      value={local}
      onChange={function(e){ setLocal(e.target.value.replace(/[^0-9.,]/g,"")); }}
      onBlur={function(e){
        e.target.style.borderColor = "var(--border2)";
        if (local === "") { onCommit(null); return; }
        var n = parseFloat(local.replace(",","."));
        if (!isNaN(n)) {
          onCommit(n);
          setLocal(n % 1 === 0 ? String(n) : n.toFixed(2).replace(".",","));
        }
      }}
      onFocus={function(e){ e.target.style.borderColor = "var(--dirk)"; }}
      placeholder={placeholder}
      style={style}
    />
  );
}

// CSS string - NO template literals, use regular string
var CSS_STR = [
  "@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Fraunces:ital,wght@0,300;0,600;1,300&display=swap');",
  "*{box-sizing:border-box;margin:0;padding:0;}",
  "body{background:#f8f7f4;}",
  ":root{",
  "--bg:#f8f7f4;--surface:#fff;--surface2:#f4f3f0;",
  "--border:#e8e6e0;--border2:#d4d0c8;",
  "--text:#1a1814;--text2:#6b6860;--text3:#a8a49c;",
  "--dirk:#2563eb;--dirk-l:#eff6ff;--dirk-b:#bfdbfe;",
  "--shelley:#db2777;--shelley-l:#fdf2f8;--shelley-b:#fbcfe8;",
  "--green:#16a34a;--green-l:#f0fdf4;",
  "--red:#dc2626;--red-l:#fef2f2;",
  "--orange:#ea580c;--orange-l:#fff7ed;",
  "--shadow:0 1px 3px rgba(0,0,0,.07),0 1px 2px rgba(0,0,0,.04);",
  "--shadow-md:0 4px 12px rgba(0,0,0,.08),0 2px 4px rgba(0,0,0,.05);",
  "--radius:12px;--radius-sm:8px;",
  "}",
  "input,select,button{font-family:'DM Sans',sans-serif;}",
  "input:focus,select:focus{outline:2px solid var(--dirk);outline-offset:1px;}",
  ".fade-in{animation:fadeIn .25s ease;}",
  "@keyframes fadeIn{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;}}",
  ".tab-btn{background:none;border:none;cursor:pointer;padding:.6rem 1rem;font-size:.85rem;font-weight:500;color:var(--text3);border-bottom:2px solid transparent;transition:all .15s;white-space:nowrap;}",
  ".tab-btn:hover{color:var(--text2);}",
  ".tab-btn.active{color:var(--text);border-bottom-color:var(--text);}",
  ".row-hover:hover{background:var(--surface2);border-radius:6px;}",
  "input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}",
  ".pill{display:inline-flex;align-items:center;padding:.15rem .5rem;border-radius:999px;font-size:.7rem;font-weight:600;}",
  ".badge{display:inline-flex;align-items:center;padding:.1rem .45rem;border-radius:4px;font-size:.68rem;font-weight:600;}",
  ".kpi-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:.5rem;}",
  ".two-col{display:grid;grid-template-columns:1fr 1fr;gap:1rem;}",
  ".check-row{display:grid;grid-template-columns:1fr 80px 88px 72px;gap:0 .4rem;align-items:center;}",
  ".check-head{display:grid;grid-template-columns:1fr 80px 88px 72px;gap:0 .4rem;}",
  ".post-row{display:grid;grid-template-columns:1fr 88px 24px;gap:.4rem;align-items:center;}",
  ".spaar-row{display:grid;grid-template-columns:1fr 80px 88px 24px;gap:.4rem;align-items:center;}",
  "@media(max-width:640px){",
  "  .kpi-grid{grid-template-columns:repeat(2,1fr);}",
  "  .kpi-3,.kpi-4,.kpi-5{display:none;}",
  "  .two-col{grid-template-columns:1fr;}",
  "  .check-row{grid-template-columns:1fr 76px 82px;}",
  "  .check-head{grid-template-columns:1fr 76px 82px;}",
  "  .diff-col{display:none;}",
  "  .post-row{grid-template-columns:1fr 80px 24px;}",
  "  .spaar-row{grid-template-columns:1fr 64px 80px 24px;}",
  "  .tab-btn{padding:.5rem .55rem;font-size:.75rem;}",
  "  .header-inner{flex-direction:column;align-items:flex-start;gap:.5rem;}",
  "  .card-pad{padding:.9rem;}",
  "}",
].join("\n");

// Components
function Card({ children, style }) {
  var s = Object.assign({ background:"var(--surface)", borderRadius:"var(--radius)", border:"1px solid var(--border)", boxShadow:"var(--shadow)", padding:"1.25rem", marginBottom:"1rem" }, style||{});
  return <div style={s}>{children}</div>;
}
function Sec({ children }) {
  return <div style={{ fontSize:".65rem", fontWeight:600, letterSpacing:".1em", color:"var(--text3)", textTransform:"uppercase", marginBottom:".85rem" }}>{children}</div>;
}
function DiffBadge({ planned, actual }) {
  if (actual === null || actual === undefined) {
    return <span style={{ color:"var(--text3)", fontSize:".8rem" }}>-</span>;
  }
  var d = actual - planned;
  if (Math.abs(d) < 0.01) return <span style={{ color:"var(--text3)", fontSize:".8rem" }}>ok</span>;
  var pos = d > 0;
  return (
    <span className="badge" style={{ color: pos ? "var(--red)" : "var(--green)", background: pos ? "var(--red-l)" : "var(--green-l)", border: "1px solid " + (pos ? "#fecaca" : "#bbf7d0") }}>
      {pos ? "+" : "-"}{fmt(Math.abs(d))}
    </span>
  );
}
function Bar({ value, max, color, height }) {
  var pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div style={{ background:"var(--surface2)", borderRadius:999, height:height||6, overflow:"hidden" }}>
      <div style={{ width:(pct*100)+"%", height:"100%", background:color||"#2563eb", borderRadius:999, transition:"width .4s ease" }}/>
    </div>
  );
}
function NumInput({ value, onChange, placeholder, accentColor }) {
  var [local, setLocal] = useState(value !== null && value !== undefined ? String(value) : "");
  // Sync if parent value changes (e.g. from import)
  useEffect(function(){
    if (value !== null && value !== undefined && value !== "") {
      var n = parseFloat(value);
      setLocal(!isNaN(n) && n % 1 !== 0 ? n.toFixed(2).replace(".",",") : String(value));
    } else { setLocal(""); }
  }, [value]);
  return (
    <div style={{ position:"relative", display:"flex", alignItems:"center" }}>
      <span style={{ position:"absolute", left:8, color:"var(--text3)", fontSize:".82rem", pointerEvents:"none" }}>€</span>
      <input
        type="text" inputMode="decimal"
        value={local}
        onChange={function(e){
          var v = e.target.value.replace(/[^0-9.,]/g,"");
          setLocal(v);
        }}
        onBlur={function(e){
          e.target.style.borderColor = "var(--border2)";
          if (local === "") { onChange(null); return; }
          var v = local.replace(",",".");
          var n = parseFloat(v);
          if (!isNaN(n)) {
            onChange(n);
            // Show with comma for NL formatting
            setLocal(n % 1 === 0 ? String(n) : n.toFixed(2).replace(".",","));
          }
        }}
        placeholder={placeholder}
        style={{ width:96, paddingLeft:20, paddingRight:6, paddingTop:5, paddingBottom:5, border:"1px solid var(--border2)", borderRadius:"var(--radius-sm)", fontSize:".84rem", color:"var(--text)", background:"var(--surface)", textAlign:"right", outline:"none" }}
        onFocus={function(e){ e.target.style.borderColor = accentColor || "var(--dirk)"; }}
      />
    </div>
  );
}
function AvailBar({ user, available, allocated }) {
  var rem = available - allocated;
  var col = rem < 0 ? "var(--red)" : rem < 100 ? "var(--orange)" : user.color;
  var bg  = rem < 0 ? "var(--red-l)" : rem < 100 ? "var(--orange-l)" : user.light;
  return (
    <div style={{ background:bg, border:"1px solid "+user.border, borderRadius:"var(--radius)", padding:"1rem 1.1rem" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:".6rem" }}>
        <div style={{ display:"flex", alignItems:"center", gap:".5rem" }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:user.color }}/>
          <span style={{ fontWeight:600, fontSize:".88rem" }}>{user.name}</span>
        </div>
        <span style={{ fontSize:".78rem", color:"var(--text2)" }}>Beschikbaar: <strong style={{ color:"var(--text)" }}>{fmt(available)}</strong></span>
      </div>
      <Bar value={allocated} max={available} color={col} height={5}/>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:".5rem", fontSize:".78rem" }}>
        <span style={{ color:"var(--text2)" }}>Verdeeld: {fmt(allocated)}</span>
        <span style={{ color:col, fontWeight:600 }}>Nog over: {fmt(rem)}</span>
      </div>
    </div>
  );
}
function BarChart({ data }) {
  var max = Math.max.apply(null, data.map(function(d){ return d.value; }).concat([1000]));
  return (
    <div style={{ display:"flex", gap:6, alignItems:"flex-end", height:130 }}>
      {data.map(function(d) {
        var h   = Math.max((d.value / max) * 100, 2);
        var col = d.current ? "var(--dirk)" : d.value >= 1000 ? "var(--green)" : "#d4d0c8";
        var bdr = d.current ? "0 0 0 2px var(--dirk-b)" : "none";
        return (
          <div key={d.label} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
            {d.value > 0 && <span style={{ fontSize:".58rem", color:"var(--text3)", transform:"rotate(-30deg)", whiteSpace:"nowrap" }}>{fmt(d.value).replace("€","")}</span>}
            <div style={{ width:"100%", height:100, display:"flex", alignItems:"flex-end" }}>
              <div style={{ width:"100%", height:h+"%", background:col, borderRadius:"4px 4px 0 0", boxShadow:bdr, transition:"height .4s ease" }}/>
            </div>
            <span style={{ fontSize:".65rem", color: d.current ? "var(--dirk)" : "var(--text3)", fontWeight: d.current ? 600 : 400 }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// Main app
export default function App() {
  var now = new Date();
  var [month, setMonth]   = useState(now.getMonth());
  var [year]              = useState(now.getFullYear());
  var [tab,   setTab]     = useState("plan");
  var [notif, setNotif]   = useState("");
  var [syncing, setSyncing]   = useState(false);
  var [lastSync, setLastSync] = useState(null);
  var [data, setDataRaw]      = useState(DEFAULT_DATA);
  var [loaded, setLoaded]     = useState(false);
  var [memory, setMemory]     = useState({});  // learned desc->postId mappings
  var [reviewPopup, setReviewPopup] = useState(null);
  var reviewShownRef = useRef(false);

  useEffect(function() {
    Promise.all([loadShared(DEFAULT_DATA), loadMemory()]).then(function(results) {
      setDataRaw(results[0]);
      setMemory(results[1]);
      setLoaded(true);
    });
  }, []);

  useEffect(function() {
    if (!loaded) return;
    setSyncing(true);
    var t = setTimeout(async function() { await saveShared(data); setSyncing(false); setLastSync(new Date()); }, 800);
    return function(){ clearTimeout(t); };
  }, [data, loaded]);

  useEffect(function() {
    if (!loaded) return;
    async function pull() { var r = await loadShared(null); if (r) setDataRaw(r); }
    var iv = setInterval(pull, 30000);
    document.addEventListener('visibilitychange', pull);
    window.addEventListener('focus', pull);
    return function(){ clearInterval(iv); document.removeEventListener('visibilitychange', pull); window.removeEventListener('focus', pull); };
  }, [loaded]);

  useEffect(function() {
    if (!loaded || reviewShownRef.current) return;
    var prevM = month === 0 ? 11 : month - 1;
    var prevY = month === 0 ? year - 1 : year;
    var prevMD = data.months[prevY + "-" + prevM];
    if (!prevMD) return;
    var prevPosts = prevMD.posts || [];
    var prevActuals = prevMD.actuals || {};
    var diffs = prevPosts.filter(function(p) {
      var a = prevActuals[p.id];
      return (a !== null && a !== undefined) && Math.abs(a - (p.planned || 0)) >= 10;
    }).map(function(p) {
      var a = prevActuals[p.id];
      return { id:p.id, label:p.label, planned:p.planned||0, actual:a, diff:a-(p.planned||0) };
    }).sort(function(a,b){ return Math.abs(b.diff)-Math.abs(a.diff); });
    if (diffs.length > 0) {
      reviewShownRef.current = true;
      setReviewPopup({ month: MONTHS[prevM], year: prevY, diffs: diffs });
    }
  }, [loaded]);

  function setData(fn) { setDataRaw(function(d){ return typeof fn === "function" ? fn(d) : fn; }); }
  function notify(msg) { setNotif(msg); setTimeout(function(){ setNotif(""); }, 2500); }
  function isMonthClosed(y, m) {
    var isPast = y < now.getFullYear() || (y === now.getFullYear() && m < now.getMonth());
    var md = data.months[y + "-" + m];
    return isPast || !!(md && md.closed);
  }

  var mk = year + "-" + month;

  // Month data
  var monthData = useMemo(function() {
    if (data.months[mk]) return data.months[mk];
    var prevMk = month === 0 ? (year-1)+"-11" : year+"-"+(month-1);
    var prev = data.months[prevMk];
    return {
      posts:   prev ? prev.posts.map(function(p){ return Object.assign({},p); }) : DEFAULT_POSTS.map(function(p){ return Object.assign({},p); }),
      actuals: {}
    };
  }, [mk, data.months]);

  var posts   = monthData.posts   || [];
  var actuals = monthData.actuals || {};

  function saveMonthData(md) {
    setData(function(d) {
      var m = Object.assign({}, d.months);
      m[mk] = md;
      return Object.assign({}, d, {months:m});
    });
  }
  function closeCurrentMonth() {
    saveMonthData(Object.assign({}, monthData, { closed: true }));
    notify("Maand afgesloten");
  }
  function setPosts(fn) {
    saveMonthData(Object.assign({}, monthData, { posts: typeof fn === "function" ? fn(posts) : fn }));
  }
  function setActual(pid, val) {
    var num = parseFloat(String(val||"").replace(",","."));
    var a = Object.assign({}, actuals);
    a[pid] = isNaN(num) ? null : num;
    saveMonthData(Object.assign({}, monthData, { actuals:a }));
  }
  function updatePost(id, field, val) {
    setPosts(function(ps){ return ps.map(function(p){ return p.id === id ? Object.assign({},p,{ [field]: field==="planned" ? (parseFloat(String(val).replace(",","."))||0) : val }) : p; }); });
  }
  function deletePost(id) { setPosts(function(ps){ return ps.filter(function(p){ return p.id !== id; }); }); }
  function addPost(gid)   { setPosts(function(ps){ return [...ps, { id:newId(), group:gid, label:"Nieuwe post", planned:0 }]; }); }

  // Spaar
  var spaarMonth = useMemo(function() {
    if (data.spaar[mk]) return data.spaar[mk];
    var prevMk = month === 0 ? (year-1)+"-11" : year+"-"+(month-1);
    var prev = data.spaar[prevMk];
    return prev
      ? prev.map(function(p){ return Object.assign({},p,{actual:null}); })
      : DEFAULT_SPAAR.map(function(p){ return Object.assign({},p,{actual:null}); });
  }, [mk, data.spaar]);

  function saveSpaar(arr) {
    setData(function(d) {
      var s = Object.assign({}, d.spaar);
      s[mk] = arr;
      return Object.assign({}, d, {spaar:s});
    });
  }
  function updateSpaar(id, field, val) {
    var num = parseFloat(String(val||"").replace(",","."));
    saveSpaar(spaarMonth.map(function(p){ return p.id===id ? Object.assign({},p,{ [field]: isNaN(num)?(field==="planned"?0:null):num }) : p; }));
  }

  // Computed
  var totInk = data.inkomen.dirk + data.inkomen.shelley;
  var ratioD = totInk > 0 ? data.inkomen.dirk / totInk : 0.5;
  var ratioS = 1 - ratioD;

  var groupTotals = useMemo(function() {
    var map = {};
    (data.groups||DEFAULT_GROUPS).forEach(function(g){ map[g.id] = { planned:0, actual:0 }; });
    posts.forEach(function(p) {
      if (!map[p.group]) return;
      map[p.group].planned += p.planned||0;
      var a = actuals[p.id];
      map[p.group].actual += (a !== null && a !== undefined) ? a : (p.planned||0);
    });
    return map;
  }, [posts, actuals, data.groups]);

  var sV = (groupTotals["samen_vast"] && groupTotals["samen_vast"].planned) || 0;
  var sR = (groupTotals["samen_var"]  && groupTotals["samen_var"].planned)  || 0;
  var availD = data.inkomen.dirk    - sV*ratioD - sR*ratioD - ((groupTotals["dirk"]    && groupTotals["dirk"].planned)    || 0);
  var availS = data.inkomen.shelley - sV*ratioS - sR*ratioS - ((groupTotals["shelley"] && groupTotals["shelley"].planned) || 0);
  var allocD = spaarMonth.filter(function(p){ return p.owner==="dirk"; }).reduce(function(s,p){ return s+(p.planned||0); }, 0);
  var allocS = spaarMonth.filter(function(p){ return p.owner==="shelley"; }).reduce(function(s,p){ return s+(p.planned||0); }, 0);
  var totSpaar    = allocD + allocS;
  var totSpaarAct = spaarMonth.reduce(function(s,p){ return s + (p.actual !== null && p.actual !== undefined ? p.actual : (p.planned||0)); }, 0);

  var chartData = useMemo(function() {
    return MONTHS_S.map(function(label, i) {
      var key   = year+"-"+i;
      var sp    = data.spaar[key];
      var value = sp ? sp.reduce(function(s,p){ return s + (p.actual !== null && p.actual !== undefined ? p.actual : (i < month ? p.planned||0 : 0)); }, 0) : 0;
      return { label:label, value:value, current: i===month };
    });
  }, [data.spaar, year, month]);

  // Import state
  var [importRows,  setImportRows]  = useState([]);
  var [triageRows,  setTriageRows]  = useState([]);
  var [importStep,  setImportStep]  = useState("idle");
  var [importAcct,  setImportAcct]  = useState("samen");
  var [csvError,    setCsvError]    = useState("");
  var [aiMsg,       setAiMsg]       = useState("");
  var fileRef = useRef();

  var importSummary = useMemo(function() {
    var map = {};
    importRows.filter(function(r){ return r.include !== false && r.assignedId !== "__onbekend__"; }).forEach(function(r) {
      map[r.assignedId] = (map[r.assignedId]||0) + r.amount;
    });
    return map;
  }, [importRows]);

  function runAI(toCateg) {
    setImportStep("ai_processing");
    setAiMsg(toCateg.length + " transacties herkennen...");
    var fromMemory = 0;
    var result = toCateg.map(function(r) {
      var k = memKey(r.desc);
      // Check learned memory first
      if (memory[k] && posts.find(function(p){ return p.id === memory[k]; })) {
        fromMemory++;
        return Object.assign({}, r, { include:true, assignedId:memory[k], _fromMemory:true });
      }
      // Fall back to keyword matching
      return Object.assign({}, r, { include:true, assignedId:kwMatch(r.desc, posts) });
    });
    setImportRows(function(prev){ return [...result, ...prev.filter(function(r){ return r._fromTriage; })]; });
    setImportStep("preview");
    setAiMsg(fromMemory > 0 ? fromMemory + " herkend uit geheugen" : "");
  }

  function handleFile(e) {
    var file = e.target.files[0]; if (!file) return;
    setCsvError(""); setImportStep("processing"); setAiMsg("CSV inlezen...");
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var text = ev.target.result;
        var all  = parseRabobank(text).filter(function(r) {
          var d = new Date(r.date);
          return d.getMonth() === month && d.getFullYear() === year;
        });
        if (!all.length) {
          setCsvError("Geen uitgaven gevonden voor " + MONTHS[month] + " " + year + ". Selecteer de juiste maand bovenaan.");
          setImportStep("idle"); return;
        }
        var needsTriage = all.filter(function(r){ return TX_INFO[r.txClass] && TX_INFO[r.txClass].def === "vragen"; });
        var toCateg     = all.filter(function(r){ return TX_INFO[r.txClass] && TX_INFO[r.txClass].def === "categoriseren"; });
        if (needsTriage.length > 0) {
          setTriageRows(needsTriage.map(function(r){ return Object.assign({},r,{triageDecision:"overslaan",assignedId:"__onbekend__"}); }));
          setImportRows(toCateg.map(function(r){ return Object.assign({},r,{include:true,assignedId:"__onbekend__"}); }));
          setImportStep("triage");
        } else {
          runAI(toCateg);
        }
      } catch(err) {
        console.error("handleFile error:", err);
        setCsvError("Kon bestand niet verwerken: " + err.message);
        setImportStep("idle");
      }
    };
    reader.onerror = function() {
      setCsvError("Kon bestand niet lezen.");
      setImportStep("idle");
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }

  function applyTriage() {
    var toCat  = triageRows.filter(function(r){ return r.triageDecision === "categoriseren"; });
    var manual = triageRows.filter(function(r){ return r.triageDecision === "handmatig" && r.assignedId !== "__onbekend__"; }).map(function(r){ return Object.assign({},r,{include:true,_fromTriage:true}); });
    var base   = [...importRows.filter(function(r){ return !r._fromTriage; }), ...toCat];
    setImportRows([...base, ...manual]);
    if (base.length > 0) { runAI(base); }
    else { setImportStep("preview"); }
  }

  function applyImport() {
    // Batch all actuals in one update to avoid stale closure issues
    var newActuals = Object.assign({}, actuals);
    Object.entries(importSummary).forEach(function(pair) {
      var pid = pair[0], total = pair[1];
      newActuals[pid] = (newActuals[pid]||0) + total;
    });
    saveMonthData(Object.assign({}, monthData, { actuals: newActuals }));

    // Learn from confirmed assignments (only non-unknown, non-memory ones)
    var newMemory = Object.assign({}, memory);
    var learned = 0;
    importRows.filter(function(r){ return r.include !== false && r.assignedId !== "__onbekend__"; }).forEach(function(r) {
      var k = memKey(r.desc);
      if (k && (!newMemory[k] || newMemory[k] !== r.assignedId)) {
        newMemory[k] = r.assignedId;
        learned++;
      }
    });
    if (learned > 0) {
      setMemory(newMemory);
      saveMemory(newMemory);
    }

    setImportStep("done");
    notify("Verwerkt! " + (learned > 0 ? learned + " patronen onthouden." : ""));
    setTimeout(function(){ setImportStep("idle"); setImportRows([]); setTriageRows([]); }, 2500);
  }

  function resetImport() { setImportStep("idle"); setImportRows([]); setTriageRows([]); setCsvError(""); }

  var groups = data.groups || DEFAULT_GROUPS;

  if (!loaded) {
    return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", fontFamily:"sans-serif", color:"#6b6860" }}>Laden...</div>;
  }

  // Shared style objects
  var inpBase = { background:"var(--surface)", border:"1px solid var(--border2)", borderRadius:"var(--radius-sm)", color:"var(--text)", padding:".3rem .55rem", fontSize:".82rem", outline:"none", fontFamily:"DM Sans,sans-serif" };
  var inpFull = Object.assign({}, inpBase, { width:"100%" });
  var inpRight = Object.assign({}, inpBase, { textAlign:"right", width:88, inputMode:"decimal" });
  var colHead = { fontSize:".62rem", fontWeight:600, letterSpacing:".08em", color:"var(--text3)" };
  var primaryBtn = { background:"var(--dirk)", border:"none", borderRadius:"var(--radius-sm)", padding:".5rem 1.25rem", fontSize:".84rem", color:"white", cursor:"pointer", fontWeight:600, fontFamily:"inherit" };
  var ghostBtn   = { border:"1px solid var(--border2)", background:"var(--surface)", borderRadius:"var(--radius-sm)", padding:".5rem 1rem", fontSize:".82rem", cursor:"pointer", color:"var(--text2)", fontFamily:"inherit" };
  var addBtn     = { marginTop:".5rem", border:"1px dashed var(--border2)", background:"transparent", borderRadius:"var(--radius-sm)", padding:".35rem .75rem", fontSize:".78rem", color:"var(--text3)", cursor:"pointer", width:"100%", fontFamily:"inherit" };
  var delBtn     = { background:"none", border:"none", color:"var(--text3)", cursor:"pointer", fontSize:".9rem", borderRadius:4, padding:"2px 5px", fontFamily:"inherit" };

  return (
    <>
      <style>{CSS_STR}</style>
      <div style={{ fontFamily:"DM Sans,sans-serif", background:"var(--bg)", minHeight:"100vh", color:"var(--text)" }}>

        {notif && (
          <div className="fade-in" style={{ position:"fixed", top:16, right:16, background:"var(--text)", color:"white", borderRadius:10, padding:".6rem 1.1rem", fontSize:".82rem", fontWeight:500, zIndex:9999, boxShadow:"var(--shadow-md)" }}>
            {notif}
          </div>
        )}

        {reviewPopup && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:9998, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
            <div style={{ background:"var(--surface)", borderRadius:"var(--radius)", boxShadow:"var(--shadow-md)", maxWidth:480, width:"100%", maxHeight:"80vh", overflowY:"auto", padding:"1.5rem" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1rem" }}>
                <div>
                  <h2 style={{ fontFamily:"Fraunces,serif", fontSize:"1.1rem", fontWeight:600, marginBottom:".3rem" }}>Terugblik {reviewPopup.month}</h2>
                  <p style={{ fontSize:".8rem", color:"var(--text2)", lineHeight:1.4 }}>Deze posten weken vorige maand af van het plan. Wil je het budget bijstellen voor deze maand?</p>
                </div>
                <button onClick={function(){ setReviewPopup(null); }} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"1rem", color:"var(--text3)", padding:"0 0 0 .75rem", flexShrink:0 }}>✕</button>
              </div>
              <div style={{ border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", overflow:"hidden", marginBottom:"1.25rem" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 70px 70px 70px", background:"var(--surface2)", padding:".4rem .75rem", borderBottom:"1px solid var(--border)" }}>
                  {["Post","Gepland","Werkelijk","Verschil"].map(function(h,i){ return <span key={h} style={{ fontSize:".62rem", fontWeight:600, letterSpacing:".08em", color:"var(--text3)", textAlign:i===0?"left":"right" }}>{h.toUpperCase()}</span>; })}
                </div>
                {reviewPopup.diffs.map(function(d) {
                  var over = d.diff > 0;
                  return (
                    <div key={d.id} style={{ display:"grid", gridTemplateColumns:"1fr 70px 70px 70px", padding:".5rem .75rem", borderBottom:"1px solid var(--border)", alignItems:"center" }}>
                      <span style={{ fontSize:".83rem" }}>{d.label}</span>
                      <span style={{ fontSize:".79rem", color:"var(--text2)", textAlign:"right" }}>{fmt(d.planned)}</span>
                      <span style={{ fontSize:".79rem", textAlign:"right" }}>{fmt(d.actual)}</span>
                      <span style={{ fontSize:".79rem", fontWeight:600, textAlign:"right", color: over ? "var(--red)" : "var(--green)" }}>{over ? "+" : ""}{fmt(d.diff)}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display:"flex", gap:".6rem" }}>
                <button style={ghostBtn} onClick={function(){ setReviewPopup(null); }}>Nu niet</button>
                <button style={Object.assign({},primaryBtn,{flex:1})} onClick={function(){ setReviewPopup(null); setTab("plan"); }}>Maandplan aanpassen</button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)", position:"sticky", top:0, zIndex:100 }}>
          <div style={{ maxWidth:960, margin:"0 auto", padding:"0 1.5rem" }}>

            <div className="header-inner" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"1rem 0 .75rem" }}>
              <div style={{ display:"flex", alignItems:"baseline", gap:".75rem" }}>
                <h1 style={{ fontFamily:"Fraunces,serif", fontWeight:600, fontSize:"1.4rem", letterSpacing:"-.01em" }}>Huishoudboekje</h1>
                <span style={{ fontFamily:"Fraunces,serif", fontStyle:"italic", fontWeight:300, fontSize:".95rem", color:"var(--text2)" }}>Dirk &amp; Shelley</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:".75rem" }}>
                <div style={{ display:"flex", alignItems:"center", gap:".35rem", fontSize:".72rem", color:"var(--text3)" }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background: syncing ? "var(--orange)" : "var(--green)" }}/>
                  {syncing ? "Opslaan..." : lastSync ? "Gesynchroniseerd" : "Gedeeld"}
                </div>
                <span className="badge" style={{ color:DIRK.color,    background:DIRK.light,    border:"1px solid "+DIRK.border    }}>D {Math.round(ratioD*100)}%</span>
                <span className="badge" style={{ color:SHELLEY.color, background:SHELLEY.light, border:"1px solid "+SHELLEY.border }}>S {Math.round(ratioS*100)}%</span>
              </div>
            </div>

            <div style={{ display:"flex", gap:3, paddingBottom:".75rem", overflowX:"auto" }}>
              {MONTHS_S.map(function(m,i) {
                var isClosed = isMonthClosed(year, i) && i !== now.getMonth();
                return (
                  <button key={i} onClick={function(){ setMonth(i); }}
                    style={{ padding:".25rem .6rem", borderRadius:6, border:"1px solid", borderColor: month===i ? "var(--dirk)" : (isClosed ? "#bbf7d0" : "var(--border)"), background: month===i ? "var(--dirk-l)" : (isClosed ? "var(--green-l)" : "transparent"), color: month===i ? "var(--dirk)" : (isClosed ? "#16a34a" : "var(--text3)"), cursor:"pointer", fontSize:".72rem", fontWeight: month===i ? 600 : (isClosed ? 500 : 400), fontFamily:"inherit" }}>
                    {m}
                  </button>
                );
              })}
            </div>

            <div className="kpi-grid" style={{ paddingBottom:"1rem" }}>
              {[
                { l:"Inkomen",     v:totInk,  c:"var(--green)",  bg:"var(--green-l)"  },
                { l:"Lasten samen", v:sV+sR,   c:"var(--red)",    bg:"var(--red-l)"    },
                { l:"Vrij Dirk",    v:availD,  c:DIRK.color,      bg:DIRK.light        },
                { l:"Vrij Shelley", v:availS,  c:SHELLEY.color,   bg:SHELLEY.light     },
                { l:"Sparen",      v:totSpaar,c:"#7c3aed",       bg:"#f5f3ff"         },
              ].map(function(item, idx) {
                return (
                  <div key={item.l} className={"kpi-"+(idx+1)} style={{ background:item.bg, borderRadius:"var(--radius-sm)", padding:".6rem .75rem", border:"1px solid "+item.c+"22" }}>
                    <div style={{ fontSize:".62rem", fontWeight:600, letterSpacing:".08em", color:item.c, marginBottom:.2, opacity:.7 }}>{item.l.toUpperCase()}</div>
                    <div style={{ fontSize:".95rem", fontWeight:600, color: item.v < 0 ? "var(--red)" : item.c }}>{fmt(item.v)}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ display:"flex", borderTop:"1px solid var(--border)", overflowX:"auto", marginLeft:"-1.5rem", paddingLeft:"1.5rem", marginRight:"-1.5rem", paddingRight:"1.5rem" }}>
              {[["plan","Maandplan"],["sparen","Sparen"],["resultaat","Resultaat"],["check","Maandcheck"]].map(function(pair) {
                return <button key={pair[0]} className={"tab-btn"+(tab===pair[0]?" active":"")} onClick={function(){ setTab(pair[0]); }}>{pair[1]}</button>;
              })}
            </div>
          </div>
        </div>

        <div style={{ maxWidth:960, margin:"0 auto", padding:"1.5rem" }} className="fade-in">

          {/* MAANDPLAN */}
          {tab === "plan" && (
            <div>
              <Card>
                <Sec>Inkomen</Sec>
                <div className="two-col">
                  {[[DIRK,"dirk"],[SHELLEY,"shelley"]].map(function(pair) {
                    var u = pair[0], uid = pair[1];
                    return (
                      <div key={uid} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:".65rem .85rem", background:u.light, borderRadius:"var(--radius-sm)", border:"1px solid "+u.border }}>
                        <div>
                          <div style={{ fontSize:".75rem", fontWeight:600, color:u.color, marginBottom:.2 }}>{u.name}</div>
                          <div style={{ fontSize:".72rem", color:"var(--text2)" }}>Netto salaris</div>
                        </div>
                        <NumInput accentColor={u.color} value={data.inkomen[uid]} onChange={function(v){ var n=parseFloat(v); if(!isNaN(n)){ setData(function(d){ var ink=Object.assign({},d.inkomen); ink[uid]=n; return Object.assign({},d,{inkomen:ink}); }); }}}/>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {groups.map(function(group) {
                var gPosts = posts.filter(function(p){ return p.group === group.id; });
                var total  = gPosts.reduce(function(s,p){ return s+(p.planned||0); }, 0);
                var owner  = group.id==="dirk" ? DIRK : group.id==="shelley" ? SHELLEY : null;
                return (
                  <Card key={group.id}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:".85rem" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:".5rem" }}>
                        {owner && <div style={{ width:8, height:8, borderRadius:"50%", background:owner.color }}/>}
                        <Sec>{group.label}</Sec>
                      </div>
                      <span style={{ fontSize:".82rem", fontWeight:600, color:"var(--text2)" }}>{fmt(total)}</span>
                    </div>
                    <div className="post-row" style={{ paddingBottom:".4rem", borderBottom:"1px solid var(--border)", marginBottom:".4rem" }}>
                      <span style={colHead}>POST</span>
                      <span style={Object.assign({},colHead,{textAlign:"right"})}>BEDRAG</span>
                      <span/>
                    </div>
                    {gPosts.map(function(post) {
                      return (
                        <div key={post.id} className="row-hover" className="post-row row-hover" style={{ padding:".3rem .25rem", marginBottom:".15rem" }}>
                          <input value={post.label} onChange={function(e){ updatePost(post.id,"label",e.target.value); }} style={Object.assign({},inpFull,{border:"none",background:"transparent",fontSize:".85rem"})}/>
                          <NumInput value={post.planned||""} onChange={function(v){ updatePost(post.id,"planned",v); }} placeholder="0" accentColor={owner ? owner.color : undefined}/>
                          <button style={delBtn} onClick={function(){ deletePost(post.id); }}
                            onMouseEnter={function(e){ e.target.style.color="var(--red)"; }}
                            onMouseLeave={function(e){ e.target.style.color="var(--text3)"; }}>x</button>
                        </div>
                      );
                    })}
                    <button style={addBtn} onClick={function(){ addPost(group.id); }}
                      onMouseEnter={function(e){ e.target.style.borderColor="var(--dirk)"; e.target.style.color="var(--dirk)"; }}
                      onMouseLeave={function(e){ e.target.style.borderColor="var(--border2)"; e.target.style.color="var(--text3)"; }}>
                      + Post toevoegen
                    </button>
                  </Card>
                );
              })}

              <div style={{ padding:".85rem 1.1rem", background:"#fafaf8", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", fontSize:".82rem", color:"var(--text2)" }}>
                Klaar? Ga naar{" "}
                <button onClick={function(){ setTab("sparen"); }} style={{ border:"none", background:"none", color:"var(--dirk)", cursor:"pointer", fontSize:".82rem", fontWeight:600, padding:0, fontFamily:"inherit", textDecoration:"underline" }}>
                  Sparen &amp; Beleggen
                </button>
              </div>
            </div>
          )}

          {/* SPAREN */}
          {tab === "sparen" && (
            <div>
              <div className="two-col" style={{ marginBottom:"1rem" }}>
                <AvailBar user={DIRK}    available={availD} allocated={allocD}/>
                <AvailBar user={SHELLEY} available={availS} allocated={allocS}/>
              </div>
              <Card>
                <Sec>Potjes &amp; Beleggen</Sec>
                <div className="spaar-row" style={{ paddingBottom:".4rem", borderBottom:"1px solid var(--border)", marginBottom:".5rem" }}>
                  {["Naam","Persoon","Bedrag",""].map(function(h,i){ return <span key={i} style={Object.assign({},colHead,{textAlign:i>=2&&i<3?"right":"left"})}>{h.toUpperCase()}</span>; })}
                </div>
                {spaarMonth.map(function(p) {
                  var u = USERS.find(function(u){ return u.id===p.owner; });
                  return (
                    <div key={p.id} className="row-hover" className="spaar-row row-hover" style={{ padding:".3rem .25rem", marginBottom:".15rem" }}>
                      <input value={p.label} onChange={function(e){ updateSpaar(p.id,"label",e.target.value); }} style={Object.assign({},inpFull,{border:"none",background:"transparent",fontSize:".85rem"})}/>
                      <select value={p.owner} onChange={function(e){ updateSpaar(p.id,"owner",e.target.value); }}
                        style={{ border:"1px solid var(--border2)", borderRadius:6, padding:".3rem .4rem", fontSize:".78rem", color: u ? u.color : "inherit", background: u ? u.light : "white", fontFamily:"inherit", outline:"none" }}>
                        <option value="dirk">Dirk</option>
                        <option value="shelley">Shelley</option>
                      </select>
                      <NumInput value={p.planned||""} onChange={function(v){ updateSpaar(p.id,"planned",v); }} placeholder="0" accentColor={u ? u.color : undefined}/>
                      <button style={delBtn} onClick={function(){ saveSpaar(spaarMonth.filter(function(x){ return x.id!==p.id; })); }}
                        onMouseEnter={function(e){ e.target.style.color="var(--red)"; }}
                        onMouseLeave={function(e){ e.target.style.color="var(--text3)"; }}>x</button>
                    </div>
                  );
                })}
                <button style={Object.assign({},addBtn,{borderColor:"#ddd6fe",color:"#7c3aed"})} onClick={function(){ saveSpaar([...spaarMonth,{id:newId(),owner:"dirk",label:"Nieuw potje",planned:0,actual:null}]); }}>
                  + Potje toevoegen
                </button>
                <div style={{ marginTop:"1rem", paddingTop:".75rem", borderTop:"1px solid var(--border)", display:"flex", justifyContent:"space-between", fontSize:".84rem" }}>
                  <span style={{ color:"var(--text2)" }}>Totaal verdeeld</span>
                  <span style={{ fontWeight:600, color:"#7c3aed" }}>{fmt(totSpaar)}</span>
                </div>
              </Card>
            </div>
          )}

          {/* RESULTAAT */}
          {tab === "resultaat" && (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem", marginBottom:"1rem" }}>
                {[[DIRK,"dirk",ratioD,availD,allocD],[SHELLEY,"shelley",ratioS,availS,allocS]].map(function(arr) {
                  var u=arr[0], uid=arr[1], ratio=arr[2], avail=arr[3], alloc=arr[4];
                  var naSpaar = avail - alloc;
                  return (
                    <Card key={uid} style={{ borderTop:"3px solid "+u.color }}>
                      <div style={{ display:"flex", alignItems:"center", gap:".5rem", marginBottom:"1rem" }}>
                        <div style={{ width:10, height:10, borderRadius:"50%", background:u.color }}/>
                        <span style={{ fontWeight:600, fontSize:".9rem" }}>{u.name}</span>
                      </div>
                      {[
                        ["Inkomen",                                      data.inkomen[uid],                                 "var(--green)"  ],
                        ["Samen ("+Math.round(ratio*100)+"%)",           -((sV+sR)*ratio),                                 "var(--red)"    ],
                        ["Eigen lasten",                                 -((groupTotals[uid]&&groupTotals[uid].planned)||0),"var(--red)"    ],
                      ].map(function(row) {
                        var l=row[0], v=row[1], c=row[2];
                        var isSamen = l.indexOf("Samen") === 0;
                        return (
                          <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:".3rem 0", borderBottom:"1px solid var(--border)", fontSize:".82rem" }}>
                            <div>
                              <span style={{ color:"var(--text2)" }}>{l}</span>
                              {isSamen && <div style={{ fontSize:".68rem", color:"var(--text3)", marginTop:".1rem" }}>Over te maken: {fmt(Math.abs((sV+sR)*ratio))}</div>}
                            </div>
                            <span style={{ color:c, fontWeight:500 }}>{v>=0?"+":"-"}{fmt(Math.abs(v))}</span>
                          </div>
                        );
                      })}
                      <div style={{ display:"flex", justifyContent:"space-between", padding:".65rem 0 .4rem", fontSize:".88rem" }}>
                        <span style={{ color:"var(--text2)", fontWeight:500 }}>Vrij voor sparen</span>
                        <span style={{ color:u.color, fontWeight:700 }}>{fmt(avail)}</span>
                      </div>
                      <Bar value={alloc} max={avail} color={u.color} height={4}/>
                      <div style={{ fontSize:".72rem", color:"var(--text2)", margin:".5rem 0 .25rem" }}>Sparen &amp; beleggen:</div>
                      {spaarMonth.filter(function(p){ return p.owner===uid; }).map(function(p) {
                        return (
                          <div key={p.id} style={{ display:"flex", justifyContent:"space-between", fontSize:".76rem", marginBottom:".18rem" }}>
                            <span style={{ color:"var(--text3)" }}>{p.label}</span>
                            <span style={{ color:"#7c3aed" }}>-{fmt(p.planned)}</span>
                          </div>
                        );
                      })}
                      <div style={{ borderTop:"1px solid var(--border)", marginTop:".55rem", paddingTop:".55rem", display:"flex", justifyContent:"space-between" }}>
                        <span style={{ fontSize:".88rem", fontWeight:600 }}>Over na sparen</span>
                        <span style={{ fontSize:"1rem", fontWeight:700, color: naSpaar>=0 ? "var(--green)" : "var(--red)" }}>{fmt(naSpaar)}</span>
                      </div>
                    </Card>
                  );
                })}
              </div>

              <Card>
                <Sec>Spaardoel - 1.000 / maand</Sec>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:".5rem" }}>
                  <span style={{ fontSize:".84rem", color:"var(--text2)" }}>Totaal sparen + beleggen</span>
                  <span style={{ fontWeight:700, color: totSpaar>=1000 ? "var(--green)" : totSpaar>=800 ? "var(--orange)" : "var(--red)" }}>{fmt(totSpaar)}</span>
                </div>
                <Bar value={totSpaar} max={1000} color={totSpaar>=1000?"var(--green)":totSpaar>=800?"var(--orange)":"var(--red)"} height={8}/>
                <div style={{ display:"flex", gap:"1.5rem", marginTop:".6rem", fontSize:".78rem", color:"var(--text2)" }}>
                  <span>Dirk: <strong style={{ color:DIRK.color }}>{fmt(allocD)}</strong></span>
                  <span>Shelley: <strong style={{ color:SHELLEY.color }}>{fmt(allocS)}</strong></span>
                </div>
              </Card>

              <Card>
                <Sec>Gespaard per maand - {year}</Sec>
                <BarChart data={chartData}/>
                <div style={{ display:"flex", gap:"1rem", marginTop:".75rem", fontSize:".72rem", color:"var(--text3)" }}>
                  {[["var(--dirk)","Deze maand"],["var(--green)","Doel gehaald"],["#d4d0c8","Onder doel"]].map(function(pair) {
                    return (
                      <span key={pair[1]} style={{ display:"flex", alignItems:"center", gap:3 }}>
                        <span style={{ width:10, height:10, borderRadius:2, background:pair[0], display:"inline-block", marginRight:3 }}/>
                        {pair[1]}
                      </span>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

          {/* MAANDCHECK */}
          {tab === "check" && (
            <div>
              <Card>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:".85rem" }}>
                  <Sec>Bankimport - Rabobank CSV</Sec>
                  {Object.keys(memory).length > 0 && (
                    <span className="badge" style={{ color:"var(--green)", background:"var(--green-l)", border:"1px solid #bbf7d0", cursor:"default" }}
                      title="Geleerde patronen worden automatisch herkend bij volgende import">
                      {Object.keys(memory).length} patronen geleerd
                    </span>
                  )}
                </div>

                <div style={{ flexWrap:"wrap", gap:".5rem", marginBottom:"1rem", display:"flex" }}>
                  {[["samen","Gezamenlijk","#16a34a","var(--green-l)","#bbf7d0"],[DIRK.id,"Dirk",DIRK.color,DIRK.light,DIRK.border],[SHELLEY.id,"Shelley",SHELLEY.color,SHELLEY.light,SHELLEY.border]].map(function(arr) {
                    var id=arr[0], label=arr[1], col=arr[2], bg=arr[3], brd=arr[4];
                    return (
                      <button key={id} onClick={function(){ setImportAcct(id); if(importStep!=="preview") setImportStep("idle"); }}
                        style={{ flex:1, padding:".5rem", borderRadius:"var(--radius-sm)", border:"2px solid", borderColor: importAcct===id ? col : (brd||"var(--border)"), background: importAcct===id ? bg : "var(--surface)", color: importAcct===id ? col : "var(--text2)", cursor:"pointer", fontSize:".8rem", fontWeight:600, fontFamily:"inherit" }}>
                        {label}
                      </button>
                    );
                  })}
                </div>

                {importStep === "idle" && (
                  <div>
                    <div onClick={function(){ fileRef.current.click(); }}
                      style={{ border:"2px dashed var(--border2)", borderRadius:"var(--radius)", padding:"2rem", textAlign:"center", cursor:"pointer", background:"var(--surface2)" }}
                      onMouseEnter={function(e){ e.currentTarget.style.borderColor="var(--dirk)"; e.currentTarget.style.background="var(--dirk-l)"; }}
                      onMouseLeave={function(e){ e.currentTarget.style.borderColor="var(--border2)"; e.currentTarget.style.background="var(--surface2)"; }}>
                      <div style={{ fontSize:"1.75rem", marginBottom:".4rem" }}>📂</div>
                      <div style={{ fontSize:".88rem", fontWeight:500 }}>Klik om Rabobank CSV te selecteren</div>
                      <div style={{ fontSize:".73rem", color:"var(--text3)", marginTop:.25 }}>Twijfelgevallen worden eerst aan jou voorgelegd</div>
                    </div>
                    <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} style={{ display:"none" }}/>
                    {csvError && <div style={{ marginTop:".6rem", padding:".6rem .85rem", background:"var(--red-l)", border:"1px solid #fecaca", borderRadius:"var(--radius-sm)", fontSize:".8rem", color:"var(--red)" }}>Let op: {csvError}</div>}
                  </div>
                )}

                {(importStep === "processing" || importStep === "ai_processing") && (
                  <div style={{ textAlign:"center", padding:"2rem", color:"var(--text2)" }}>
                    <div style={{ fontSize:".9rem", fontWeight:500 }}>{aiMsg || "Bezig..."}</div>
                    <div style={{ marginTop:".75rem", height:4, background:"var(--border)", borderRadius:999, overflow:"hidden" }}>
                      <div style={{ height:"100%", background:"var(--dirk)", borderRadius:999, width:"40%" }}/>
                    </div>
                  </div>
                )}

                {importStep === "triage" && (
                  <div>
                    <div style={{ marginBottom:".85rem" }}>
                      <div style={{ fontSize:".88rem", fontWeight:600, marginBottom:".25rem" }}>{triageRows.length} transacties vragen een beslissing</div>
                      <div style={{ fontSize:".75rem", color:"var(--text3)" }}>Kies per transactie wat je wil doen. Gewone uitgaven worden daarna door AI gecategoriseerd.</div>
                    </div>
                    {triageRows.map(function(r, i) {
                      var info = TX_INFO[r.txClass] || TX_INFO.uitgave;
                      return (
                        <div key={r.id} style={{ border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", padding:".75rem .9rem", marginBottom:".5rem", background: r.triageDecision==="overslaan" ? "var(--surface2)" : "var(--surface)" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:".5rem", marginBottom:".55rem" }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:".83rem", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.desc}</div>
                              <div style={{ display:"flex", gap:".4rem", marginTop:".2rem", alignItems:"center", flexWrap:"wrap" }}>
                                <span style={{ fontSize:".68rem", color:"var(--text3)" }}>{r.date}</span>
                                <span className="badge" style={{ color:"var(--text2)", background:"var(--surface2)", border:"1px solid var(--border)" }}>{info.label}</span>
                                <span style={{ fontSize:".68rem", color:"var(--text3)", fontStyle:"italic" }}>{info.hint}</span>
                              </div>
                            </div>
                            <span style={{ fontWeight:700, color:"var(--red)", fontSize:".88rem", flexShrink:0 }}>{fmt(r.amount)}</span>
                          </div>
                          <div style={{ display:"flex", gap:".4rem", flexWrap:"wrap", alignItems:"center" }}>
                            {[["overslaan","Overslaan","var(--text3)","var(--surface2)","var(--border2)"],["categoriseren","AI categoriseert","var(--dirk)","var(--dirk-l)","var(--dirk-b)"],["handmatig","Handmatig kiezen","#7c3aed","#f5f3ff","#ddd6fe"]].map(function(arr) {
                              var val=arr[0], label=arr[1], col=arr[2], bg=arr[3], brd=arr[4];
                              var active = r.triageDecision === val;
                              return (
                                <button key={val}
                                  onClick={function(){ setTriageRows(function(ts){ return ts.map(function(x,j){ return j===i ? Object.assign({},x,{triageDecision:val}) : x; }); }); }}
                                  style={{ padding:".28rem .65rem", borderRadius:6, border:"1.5px solid", borderColor: active ? col : brd, background: active ? bg : "var(--surface)", color: active ? col : "var(--text3)", cursor:"pointer", fontSize:".76rem", fontWeight: active ? 600 : 400, fontFamily:"inherit" }}>
                                  {label}
                                </button>
                              );
                            })}
                            {r.triageDecision === "handmatig" && (
                              <select value={r.assignedId}
                                onChange={function(e){ var v=e.target.value; setTriageRows(function(ts){ return ts.map(function(x,j){ return j===i ? Object.assign({},x,{assignedId:v}) : x; }); }); }}
                                style={{ border:"1px solid var(--border2)", borderRadius:6, padding:".28rem .4rem", fontSize:".76rem", fontFamily:"inherit", background:"var(--surface)", marginLeft:"auto" }}>
                                <option value="__onbekend__">Kies post...</option>
                                {posts.map(function(p){ return <option key={p.id} value={p.id}>{p.label}</option>; })}
                              </select>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ display:"flex", gap:".6rem", marginTop:".75rem" }}>
                      <button style={ghostBtn} onClick={resetImport}>Annuleren</button>
                      <button style={Object.assign({},primaryBtn,{flex:1})} onClick={applyTriage}>Doorgaan - AI categoriseert de rest</button>
                    </div>
                  </div>
                )}

                {importStep === "preview" && (
                  <div>
                    <div style={{ fontSize:".84rem", fontWeight:500, marginBottom:".75rem" }}>{importRows.filter(function(r){ return r.include!==false; }).length} transacties herkend</div>
                    <div style={{ border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", overflow:"hidden", marginBottom:".85rem" }}>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 90px 90px", background:"var(--surface2)", padding:".5rem .85rem", borderBottom:"1px solid var(--border)" }}>
                        {["Post","Gepland","Werkelijk"].map(function(h){ return <span key={h} style={colHead}>{h.toUpperCase()}</span>; })}
                      </div>
                      {Object.entries(importSummary).map(function(pair) {
                        var pid=pair[0], total=pair[1];
                        var post = posts.find(function(p){ return p.id===pid; });
                        var over = post && total > post.planned;
                        return (
                          <div key={pid} style={{ display:"grid", gridTemplateColumns:"1fr 90px 90px", padding:".5rem .85rem", borderBottom:"1px solid var(--border)", alignItems:"center" }}>
                            <span style={{ fontSize:".84rem" }}>{post ? post.label : pid}</span>
                            <span style={{ fontSize:".82rem", color:"var(--text2)" }}>{post ? fmt(post.planned) : "-"}</span>
                            <div style={{ display:"flex", alignItems:"center", gap:.4 }}>
                              <span style={{ fontSize:".82rem", fontWeight:500, color: over ? "var(--red)" : "var(--text)" }}>{fmt(total)}</span>
                              {over && <span className="badge" style={{ color:"var(--red)", background:"var(--red-l)", border:"1px solid #fecaca" }}>OVER</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <details style={{ marginBottom:".85rem" }}>
                      <summary style={{ fontSize:".78rem", color:"var(--text2)", cursor:"pointer", padding:".3rem 0", fontWeight:500 }}>Bekijk &amp; corrigeer alle {importRows.length} transacties</summary>
                      <div style={{ maxHeight:240, overflowY:"auto", marginTop:".5rem", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)" }}>
                        {importRows.map(function(r,i) {
                          return (
                            <div key={i} style={{ display:"flex", alignItems:"center", gap:".5rem", padding:".4rem .75rem", borderBottom:"1px solid var(--border)", opacity: r.include===false ? .4 : 1 }}>
                              <input type="checkbox" checked={r.include!==false} onChange={function(e){ var v=e.target.checked; setImportRows(function(rs){ return rs.map(function(x,j){ return j===i?Object.assign({},x,{include:v}):x; }); }); }} style={{ accentColor:"var(--dirk)", flexShrink:0 }}/>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:".79rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                {r.desc}
                                {r._fromMemory && <span className="badge" style={{ marginLeft:4, color:"var(--green)", background:"var(--green-l)", border:"1px solid #bbf7d0", fontSize:".6rem" }}>geleerd</span>}
                              </div>
                              <div style={{ fontSize:".67rem", color:"var(--text3)" }}>{r.date}</div>
                              </div>
                              <select value={r.assignedId} onChange={function(e){ var v=e.target.value; setImportRows(function(rs){ return rs.map(function(x,j){ return j===i?Object.assign({},x,{assignedId:v}):x; }); }); }}
                                style={{ border:"1px solid var(--border2)", borderRadius:6, padding:".25rem .35rem", fontSize:".72rem", fontFamily:"inherit", background:"var(--surface)", maxWidth:130 }}>
                                {posts.map(function(p){ return <option key={p.id} value={p.id}>{p.label}</option>; })}
                                <option value="__onbekend__">Niet toewijzen</option>
                              </select>
                              <span style={{ color:"var(--red)", fontSize:".8rem", fontWeight:500, flexShrink:0 }}>-{fmt(r.amount)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                    <div style={{ display:"flex", gap:".6rem" }}>
                      <button style={ghostBtn} onClick={resetImport}>Annuleren</button>
                      <button style={Object.assign({},primaryBtn,{flex:1})} onClick={applyImport}>Verwerk {importRows.filter(function(r){ return r.include!==false; }).length} transacties</button>
                    </div>
                  </div>
                )}

                {importStep === "done" && (
                  <div style={{ textAlign:"center", padding:"1.5rem", color:"var(--green)" }}>
                    <div style={{ fontSize:"2rem" }}>V</div>
                    <div style={{ fontSize:".9rem", fontWeight:600, marginTop:".35rem" }}>Verwerkt!</div>
                  </div>
                )}
              </Card>

              {/* Manual check */}
              <div style={{ fontSize:".82rem", fontWeight:600, color:"var(--text2)", marginBottom:".6rem" }}>Handmatig invullen of corrigeren</div>
              <div className="check-head" style={{ padding:"0 .5rem", marginBottom:".3rem" }}>
                {["","Gepland","Werkelijk","Verschil"].map(function(h,i){ return <div key={i} className={i===3?"diff-col":""} style={Object.assign({},colHead,{textAlign:i===0?"left":"right"})}>{h.toUpperCase()}</div>; })}
              </div>

              {groups.map(function(group) {
                var gPosts  = posts.filter(function(p){ return p.group===group.id; });
                var totPlan = gPosts.reduce(function(s,p){ return s+(p.planned||0); }, 0);
                var totAct  = gPosts.reduce(function(s,p){ var a=actuals[p.id]; return s+(a!==null&&a!==undefined?a:p.planned||0); }, 0);
                return (
                  <Card key={group.id} className="card-pad" style={{ padding:"1rem 1.1rem" }}>
                    <div className="check-row" style={{ padding:".35rem .4rem", marginBottom:".35rem" }}>
                      <span style={{ fontWeight:600, fontSize:".88rem" }}>{group.label}</span>
                      <span style={{ textAlign:"right", fontSize:".84rem", color:"var(--text2)", fontWeight:500 }}>{fmt(totPlan)}</span>
                      <span style={{ textAlign:"right", fontSize:".84rem", fontWeight:600 }}>{fmt(totAct)}</span>
                      <div className="diff-col" style={{ display:"flex", justifyContent:"flex-end" }}><DiffBadge planned={totPlan} actual={totAct}/></div>
                    </div>
                    <div style={{ borderTop:"1px solid var(--border)", marginBottom:".35rem" }}/>
                    {gPosts.map(function(post) {
                      var act = actuals[post.id];
                      return (
                        <div key={post.id} className="row-hover" className="check-row row-hover" style={{ padding:".3rem .4rem" }}>
                          <span style={{ fontSize:".82rem", color:"var(--text2)" }}>{post.label}</span>
                          <span style={{ textAlign:"right", fontSize:".8rem", color:"var(--text3)" }}>{fmt(post.planned)}</span>
                          <div style={{ display:"flex", justifyContent:"flex-end" }}>
                            <DecInput value={act} onCommit={function(v){ setActual(post.id,v); }} placeholder={String((post.planned||0).toFixed(0))} style={inpRight}/>
                          </div>
                          <div className="diff-col" style={{ display:"flex", justifyContent:"flex-end" }}><DiffBadge planned={post.planned} actual={act}/></div>
                        </div>
                      );
                    })}
                  </Card>
                );
              })}

              <Card className="card-pad" style={{ padding:"1rem 1.1rem" }}>
                <div className="check-row" style={{ padding:".35rem .4rem", marginBottom:".35rem" }}>
                  <span style={{ fontWeight:600, fontSize:".88rem" }}>Sparen &amp; Beleggen</span>
                  <span style={{ textAlign:"right", fontSize:".84rem", color:"var(--text2)", fontWeight:500 }}>{fmt(totSpaar)}</span>
                  <span style={{ textAlign:"right", fontSize:".84rem", fontWeight:600 }}>{fmt(totSpaarAct)}</span>
                  <div style={{ display:"flex", justifyContent:"flex-end" }}><DiffBadge planned={totSpaar} actual={totSpaarAct}/></div>
                </div>
                <div style={{ borderTop:"1px solid var(--border)", marginBottom:".35rem" }}/>
                {spaarMonth.map(function(p) {
                  var u = USERS.find(function(u){ return u.id===p.owner; });
                  return (
                    <div key={p.id} className="row-hover" className="check-row row-hover" style={{ padding:".3rem .4rem" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:".4rem" }}>
                        <span style={{ fontSize:".82rem", color:"var(--text2)" }}>{p.label}</span>
                        {u && <span className="pill" style={{ color:u.color, background:u.light, border:"1px solid "+u.border }}>{u.name[0]}</span>}
                      </div>
                      <span style={{ textAlign:"right", fontSize:".8rem", color:"var(--text3)" }}>{fmt(p.planned)}</span>
                      <div style={{ display:"flex", justifyContent:"flex-end" }}>
                        <DecInput value={p.actual} onCommit={function(v){ updateSpaar(p.id,"actual",v); }} placeholder={String((p.planned||0).toFixed(0))} style={inpRight}/>
                      </div>
                      <div className="diff-col" style={{ display:"flex", justifyContent:"flex-end" }}><DiffBadge planned={p.planned} actual={p.actual}/></div>
                    </div>
                  );
                })}
              </Card>

              <Card style={{ background:"var(--text)", border:"none", padding:"1rem 1.25rem" }}>
                {(function() {
                  var allPlan = posts.reduce(function(s,p){ return s+(p.planned||0); }, 0) + totSpaar;
                  var allAct  = posts.reduce(function(s,p){ var a=actuals[p.id]; return s+(a!==null&&a!==undefined?a:p.planned||0); }, 0) + totSpaarAct;
                  var diff    = allAct - allPlan;
                  var pos     = diff > 0;
                  return (
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 88px 96px 80px", gap:"0 .5rem", alignItems:"center" }}>
                      <span style={{ fontWeight:700, fontSize:".95rem", color:"white" }}>Totaal uitgegaan</span>
                      <span style={{ textAlign:"right", fontSize:".88rem", color:"rgba(255,255,255,.5)", fontWeight:500 }}>{fmt(allPlan)}</span>
                      <span style={{ textAlign:"right", fontSize:".95rem", fontWeight:700, color:"white" }}>{fmt(allAct)}</span>
                      <div style={{ display:"flex", justifyContent:"flex-end" }}>
                        <span className="badge" style={{ color: pos?"#fca5a5":"#86efac", background: pos?"rgba(239,68,68,.2)":"rgba(34,197,94,.2)", border: "1px solid "+(pos?"rgba(239,68,68,.3)":"rgba(34,197,94,.3)"), fontSize:".8rem", fontWeight:700 }}>
                          {Math.abs(diff)<0.01 ? "ok" : (pos?"+":"-")+fmt(Math.abs(diff))}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </Card>

              {monthData.closed ? (
                <div style={{ textAlign:"center", marginTop:"1.25rem", padding:".75rem 1rem", background:"var(--green-l)", border:"1px solid #bbf7d0", borderRadius:"var(--radius-sm)" }}>
                  <span style={{ fontSize:".84rem", color:"#16a34a", fontWeight:600 }}>Maand afgesloten</span>
                </div>
              ) : (
                <div style={{ textAlign:"center", marginTop:"1.25rem" }}>
                  <button onClick={closeCurrentMonth} style={{ background:"#16a34a", border:"none", borderRadius:"var(--radius-sm)", padding:".55rem 1.5rem", fontSize:".84rem", color:"white", cursor:"pointer", fontWeight:600, fontFamily:"inherit" }}>
                    Maand afsluiten
                  </button>
                  <div style={{ fontSize:".72rem", color:"var(--text3)", marginTop:".4rem" }}>Volgende maand zie je een terugblik op de afwijkingen</div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
