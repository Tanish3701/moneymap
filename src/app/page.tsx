"use client";
import {useEffect,useMemo,useState} from "react";
import {PieChart,Pie,Cell,ResponsiveContainer,Tooltip,AreaChart,Area,XAxis,YAxis,CartesianGrid} from "recharts";
import {Tx,Insight,agg,fromRaw,parseCsv,sampleData,summarize,detectSubs,localInsights,inr,COLORS} from "@/lib/engine";

const Card=({children,className="",d=0}:{children:React.ReactNode;className?:string;d?:number})=>
 <div style={{animationDelay:`${d}ms`}} className={`bg-card border border-line rounded-xl p-6 up ${className}`}>{children}</div>;
const H=({children}:{children:React.ReactNode})=><h2 className="text-sm font-medium text-muted mb-4">{children}</h2>;
const fmtM=(k:string)=>new Date(k+"-01T00:00").toLocaleDateString("en-IN",{month:"short",year:"2-digit"});

export default function Page(){
 const [txs,setTxs]=useState<Tx[]>([]),[ready,setReady]=useState(false),[month,setMonth]=useState(""),[range,setRange]=useState(6);
 const [hot,setHot]=useState<string|null>(null),[busy,setBusy]=useState(false),[limit,setLimit]=useState(40),[sort,setSort]=useState<"date"|"amt">("date"),[q,setQ]=useState(""),[err,setErr]=useState(""),[ai,setAi]=useState<Insight[]|null>(null);
 useEffect(()=>{try{const s=localStorage.getItem("moneymap");if(s)setTxs(JSON.parse(s))}catch{}setReady(true)},[]);
 useEffect(()=>{if(ready)localStorage.setItem("moneymap",JSON.stringify(txs))},[txs,ready]);
 const S=useMemo(()=>summarize(txs),[txs]),months=Object.keys(S).sort(),cur=month==="all"||months.includes(month)?month:months.at(-1)||"";
 const subs=useMemo(()=>detectSubs(txs),[txs]),c=cur==="all"?agg(S):S[cur];
 useEffect(()=>{if(!txs.length){setAi(null);return}
  const last3=Object.fromEntries(months.slice(-3).map(k=>[k,S[k]]));
  fetch("/api/insights",{method:"POST",body:JSON.stringify({months:last3,subscriptions:subs})}).then(r=>r.ok?r.json():null).then(j=>setAi(j?.insights??null)).catch(()=>setAi(null));
 // eslint-disable-next-line
 },[txs]);
 const insights=ai??localInsights(txs);
 async function onFiles(list:FileList|null){if(!list||!list.length)return;setErr("");setBusy(true);const errs:string[]=[];
  for(const f of Array.from(list)){try{await onFile(f)}catch(e){errs.push(`${f.name}: ${(e as Error).message}`)}}
  setBusy(false);if(errs.length)setErr(errs.join("\n"))}
 async function onFile(f:File){
  const add=(n:Tx[])=>setTxs(p=>{const k=(x:Tx)=>`${x.date}|${x.amount}|${x.type}|${x.merchant}`,seen=new Set(p.map(k));return[...p,...n.filter(x=>!seen.has(k(x))).map(x=>({...x,src:f.name,id:`${f.name}-${x.id}`}))]});
  if(/\.pdf$/i.test(f.name)){let pw="";
   for(let t=0;t<3;t++){const fd=new FormData();fd.append("file",f);fd.append("password",pw);
    let r:Response;try{r=await fetch(process.env.NEXT_PUBLIC_PARSER_URL||"http://localhost:8000/parse",{method:"POST",body:fd})}catch{throw new Error("Can't reach the PDF parser. Start it: cd parser, pip install -r requirements.txt, python -m uvicorn app:app --port 8000")}
    const j=await r.json();
    if(r.status===401){pw=prompt(`"${f.name}" is password-protected. Enter the password (often DOB or PAN based):`)||"";if(!pw)throw new Error("Skipped (no password given).");continue}
    if(!r.ok)throw new Error(j.error||"PDF parse failed");add(fromRaw(j.rows));return}
   throw new Error("Wrong PDF password.")}
  let txt:string;if(/\.xlsx?$/i.test(f.name)){const X=await import("xlsx");const wb=X.read(await f.arrayBuffer());txt=X.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]],{dateNF:"yyyy-mm-dd"})}else txt=await f.text();
  add(parseCsv(txt))}

 if(!ready)return null;
 if(!txs.length)return(
  <main className="min-h-screen grid place-items-center p-6"><div className="max-w-lg w-full text-center up">
   <div className="text-4xl font-semibold tracking-tight">Money<span className="text-primary">Map</span></div>
   <p className="text-muted mt-3 mb-8">Upload any bank statement and instantly understand where your money went.</p>
   <label onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();onFiles(e.dataTransfer.files)}} className="block border border-dashed border-line hover:border-primary transition rounded-xl p-12 cursor-pointer bg-card">
    <input type="file" multiple accept=".csv,.xlsx,.xls,.pdf" className="hidden" onChange={e=>{onFiles(e.target.files);e.target.value=""}}/>
    <div className="text-fg">Drop one or many statements (CSV, Excel, PDF), or click to browse</div>
    <div className="text-xs text-muted mt-2">Mix banks and cards freely · HDFC · ICICI · SBI · Axis · parsed in your browser, never uploaded</div></label>
   {err&&<p className="text-bad text-sm mt-4 whitespace-pre-line">{err}</p>}
   <button onClick={()=>setTxs(sampleData())} className="mt-6 text-primary text-sm hover:underline">or try with sample data</button>
  </div></main>);

 const sources=Object.entries(txs.reduce((a,x)=>{const k=x.src||"Sample data";a[k]=(a[k]||0)+1;return a},{} as Record<string,number>));
 const pie=Object.entries(c?.by||{}).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value}));
 const total=pie.reduce((a,b)=>a+b.value,0),shown=hot?pie.find(p=>p.name===hot):null;
 const trend=(range?months.slice(-range):months).map(k=>({m:fmtM(k),Spending:Math.round(S[k].expense),Savings:Math.round(S[k].savings)}));
 const flow=c?[{l:"Salary",a:c.income,col:"#58A6FF"},...pie.slice(0,6).map(p=>({l:p.name,a:p.value,col:COLORS[p.name]||"#8B949E"})),{l:"Savings",a:Math.max(c.savings,0),col:"#3FB950"}]:[];
 const all=txs.filter(x=>(cur==="all"||x.date.startsWith(cur))&&`${x.merchant} ${x.category}`.toLowerCase().includes(q.toLowerCase())).sort(sort==="amt"?(a,b)=>b.amount-a.amount:(a,b)=>b.date.localeCompare(a.date)),list=all.slice(0,limit);
 const stat=(l:string,v:string,col="text-fg")=>({l,v,col});
 const stats=c?[stat("Income",inr(c.income)),stat("Expenses",inr(c.expense)),stat("Savings",inr(c.savings),c.savings>=0?"text-ok":"text-bad"),stat("Savings rate",(c.income?Math.round(c.savings/c.income*100):0)+"%","text-primary")]:[];

 return(
 <main className="max-w-6xl mx-auto p-6 md:p-10 space-y-6">
  <header className="flex flex-wrap items-center justify-between gap-4 up">
   <div className="text-2xl font-semibold tracking-tight">Money<span className="text-primary">Map</span></div>
   <div className="flex items-center gap-3 text-sm">
    <select value={cur} onChange={e=>setMonth(e.target.value)} className="bg-card border border-line rounded-lg px-3 py-2"><option value="all">All months</option>{months.map(m=><option key={m} value={m}>{fmtM(m)}</option>)}</select>
    <label className="bg-primary text-bg font-medium rounded-lg px-4 py-2 cursor-pointer hover:opacity-90 transition">{busy?"Parsing…":"Upload statements"}<input type="file" multiple accept=".csv,.xlsx,.xls,.pdf" className="hidden" onChange={e=>{onFiles(e.target.files);e.target.value=""}}/></label>
    <button onClick={()=>confirm("Clear all data?")&&setTxs([])} className="text-muted hover:text-bad transition">Clear</button>
   </div></header>
  {err&&<p className="text-bad text-sm whitespace-pre-line">{err}</p>}
  <div className="flex flex-wrap gap-2 text-xs">{sources.map(([n,c])=><span key={n} className="flex items-center gap-2 bg-card border border-line rounded-full pl-3 pr-2 py-1 text-muted">{n} · {c}<button onClick={()=>setTxs(p=>p.filter(x=>(x.src||"Sample data")!==n))} className="hover:text-bad">✕</button></span>)}</div>

  <section className="grid grid-cols-2 md:grid-cols-4 gap-4">{stats.map((s,i)=>
   <Card key={s.l} d={i*70}><div className="text-xs text-muted">{s.l}</div><div className={`text-3xl font-semibold mt-2 ${s.col}`}>{s.v}</div></Card>)}</section>

  <section className="grid md:grid-cols-5 gap-4">
   <Card className="md:col-span-2" d={200}><H>Spending breakdown</H>
    <div className="relative h-56"><ResponsiveContainer><PieChart>
     <Pie data={pie} dataKey="value" innerRadius={70} outerRadius={100} paddingAngle={2} stroke="none" onMouseEnter={(_,i)=>setHot(pie[i].name)} onMouseLeave={()=>setHot(null)}>
      {pie.map(p=><Cell key={p.name} fill={COLORS[p.name]||"#8B949E"} opacity={!hot||hot===p.name?1:.25}/>)}</Pie></PieChart></ResponsiveContainer>
     <div className="absolute inset-0 grid place-items-center pointer-events-none text-center"><div>
      <div className="text-xs text-muted">{shown?shown.name:"Spent"}</div><div className="text-xl font-semibold">{inr(shown?shown.value:total)}</div></div></div></div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-4 text-sm">{pie.map(p=>
     <button key={p.name} onMouseEnter={()=>setHot(p.name)} onMouseLeave={()=>setHot(null)} className={`flex items-center gap-2 text-left transition ${hot&&hot!==p.name?"opacity-40":""}`}>
      <span className="w-2.5 h-2.5 rounded-full" style={{background:COLORS[p.name]||"#8B949E"}}/><span className="text-muted">{p.name}</span><span className="ml-auto">{Math.round(p.value/total*100)}%</span></button>)}</div></Card>
   <Card className="md:col-span-3" d={260}>
    <div className="flex justify-between items-center mb-4"><H>Monthly trends</H>
     <div className="flex gap-1 text-xs -mt-4">{[[3,"3M"],[6,"6M"],[12,"12M"],[0,"All"]].map(([v,l])=>
      <button key={l} onClick={()=>setRange(v as number)} className={`px-2.5 py-1 rounded-md transition ${range===v?"bg-line text-fg":"text-muted hover:text-fg"}`}>{l}</button>)}</div></div>
    <div className="h-72"><ResponsiveContainer><AreaChart data={trend}>
     <CartesianGrid stroke="#30363D" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="m" stroke="#8B949E" fontSize={12} tickLine={false} axisLine={false}/>
     <YAxis stroke="#8B949E" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v=>"₹"+v/1000+"k"}/>
     <Tooltip contentStyle={{background:"#161B22",border:"1px solid #30363D",borderRadius:12}} formatter={(v)=>inr(Number(v))}/>
     <Area dataKey="Spending" stroke="#58A6FF" fill="#58A6FF" fillOpacity={.15} strokeWidth={2}/><Area dataKey="Savings" stroke="#3FB950" fill="#3FB950" fillOpacity={.15} strokeWidth={2}/>
    </AreaChart></ResponsiveContainer></div></Card></section>

  <Card key={cur} d={300}><H>Where did my salary go?</H>
   <div className="space-y-2 max-w-2xl">{flow.map((f,i)=>
    <div key={f.l}>{i>0&&<div className="text-muted text-xs pl-2 leading-none mb-2">↓</div>}
     <div className="relative bg-bg border border-line rounded-xl overflow-hidden">
      <div className="grow absolute inset-y-0 left-0 opacity-25" style={{["--w" as string]:`${c.income?Math.min(100,f.a/c.income*100):0}%`,background:f.col,animationDelay:`${i*120}ms`}}/>
      <div className="relative flex justify-between px-4 py-3"><span>{f.l}</span><span className="font-medium" style={{color:f.col}}>{inr(f.a)}</span></div></div></div>)}</div></Card>

  <section className="grid md:grid-cols-2 gap-4">
   <Card d={340}><H>Subscriptions</H>
    {subs.length?<><div className="space-y-3">{subs.map(s=><div key={s.merchant} className="flex justify-between text-sm"><div><div>{s.merchant}</div><div className="text-xs text-muted">monthly · {s.count} charges</div></div>
     <div className="text-right"><div>{inr(s.amount)}/mo</div><div className="text-xs text-muted">{inr(s.yearly)}/yr</div></div></div>)}</div>
     <div className="border-t border-line mt-4 pt-4 flex justify-between text-sm"><span className="text-muted">Total recurring</span><span className="text-warn font-medium">{inr(subs.reduce((a,b)=>a+b.amount,0))}/mo · {inr(subs.reduce((a,b)=>a+b.yearly,0))}/yr</span></div></>
     :<p className="text-sm text-muted">No recurring charges detected yet. Upload 3+ months for best results.</p>}</Card>
   <Card d={380}><H>AI insights</H><div className="space-y-3">{insights.map(i=>
    <div key={i.kind} className="border border-line rounded-xl p-4 bg-bg"><div className="text-[11px] uppercase tracking-wide text-primary">{i.kind}</div>
     <div className="font-medium mt-1">{i.title}</div><div className="text-sm text-muted mt-1">{i.body}</div></div>)}</div></Card></section>

  <Card d={420}><div className="flex justify-between items-center mb-4"><H>Transactions ({all.length})</H>
   <div className="flex gap-1 text-xs -mt-4">{([["date","Newest"],["amt","Largest"]] as const).map(([v,l])=><button key={v} onClick={()=>setSort(v)} className={`px-2.5 py-1 rounded-md transition ${sort===v?"bg-line text-fg":"text-muted hover:text-fg"}`}>{l}</button>)}</div>
   <input value={q} onChange={e=>{setQ(e.target.value);setLimit(40)}} placeholder="Search merchant or category…" className="bg-bg border border-line rounded-lg px-3 py-2 text-sm w-64 -mt-4 outline-none focus:border-primary"/></div>
   <div className="divide-y divide-line text-sm">{list.map(x=><div key={x.id} className="flex items-center gap-4 py-2.5">
    <span className="text-muted w-24">{x.date}</span><span className="flex-1 truncate">{x.merchant}</span>
    <span className="text-xs px-2 py-0.5 rounded-full border border-line text-muted">{x.category}</span>
    <span className={`w-28 text-right ${x.type==="CREDIT"?"text-ok":""}`}>{x.type==="CREDIT"?"+":"−"}{inr(x.amount)}</span></div>)}</div>{all.length>limit&&<button onClick={()=>setLimit(l=>l+100)} className="mt-4 text-primary text-sm hover:underline">Show more ({all.length-limit} remaining)</button>}</Card>
 </main>);
}
