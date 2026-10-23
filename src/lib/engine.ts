import Papa from "papaparse";
export type Tx={id:string;src?:string;date:string;merchant:string;amount:number;type:"CREDIT"|"DEBIT";category:string};
export const COLORS:Record<string,string>={Food:"#58A6FF",Shopping:"#BC8CFF",Transport:"#3FB950",Rent:"#D29922",Bills:"#F0883E",Healthcare:"#F85149",Investment:"#39D0D8",Entertainment:"#DB61A2",Travel:"#79C0FF",Fitness:"#56D364",Education:"#E3B341",Software:"#A5D6FF",Subscriptions:"#D2A8FF",Other:"#8B949E"};
const RULES:[RegExp,string][]=[
[/CRED\.CLUB|CRED CLU/,"Transfer"],
[/CRED\.UTILITY/,"Bills"],
[/\bEMI (INTEREST|PRINCIPAL)\b|SMARTEMI|\b[ICS]?GST\b|FINANCE CHARGE|LATE FEE/,"Bills"],
[/CASHBACK|REFUND|REVERSAL/,"Refund"],
[/ZOMATO|SWIGGY|DOMINO|MCDONALD|STARBUCKS|BLINKIT|ZEPTO|BIGBASKET/,"Food"],
[/UBER|\bOLA\b|RAPIDO|NAMMA|IRCTC|FASTAG|METRO/,"Transport"],
[/AMAZON PRIME|NETFLIX|SPOTIFY|YOUTUBE|HOTSTAR|PRIME VIDEO/,"Subscriptions"],
[/OPENAI|CHATGPT|CLAUDE|ANTHROPIC|GITHUB|VERCEL|JETBRAINS|NOTION/,"Software"],
[/AMAZON|FLIPKART|MYNTRA|AJIO|NYKAA|ZARA|H&M|PANTALOONS|LIFESTYLE/,"Shopping"],
[/\bRENT\b|NOBROKER|HOUSING/,"Rent"],
[/ZERODHA|GROWW|MUTUAL|\bSIP\b|\bNPS\b|PPF/,"Investment"],
[/SALARY|PAYROLL/,"Salary"],
[/ELECTRIC|BESCOM|AIRTEL|\bJIO\b|FIBERNET|BROADBAND|RECHARGE|INSURANCE|\bLIC\b/,"Bills"],
[/APOLLO|PHARM|1MG|HOSPITAL|CLINIC|DIAGNOS/,"Healthcare"],
[/CULT|GYM|DECATHLON/,"Fitness"],
[/UDEMY|COURSERA|UNACADEMY|SCHOOL|COLLEGE/,"Education"],
[/MAKEMYTRIP|GOIBIBO|INDIGO|AIRLINE|OYO|AIRBNB/,"Travel"],
[/BOOKMYSHOW|PVR|INOX/,"Entertainment"],
[/CREDIT CARD|CC PAYMENT|CREDIT CRD|SELF|OWN ACC|PAYMENT RECEI|BBPS PAYMENT|AUTOPAY|PAYMENT - THANK/,"Transfer"]];
export const categorize=(d:string)=>RULES.find(([r])=>r.test(d.toUpperCase()))?.[1]??"Other";
export const inr=(n:number)=>"₹"+Math.round(n).toLocaleString("en-IN");
export function merchantOf(d:string){const p=d.toUpperCase().split(/[-\/@*|,]+/).map(s=>s.replace(/[0-9]+/g," ").trim()).filter(s=>/[A-Z]{3}/.test(s)&&!/^(UPI|POS|NEFT|IMPS|ACH|ECOM|PUR|ATW|NACH|BIL|MB|IB|DR|CR)$/.test(s));return(p[0]||d).split(/\s+/).slice(0,3).join(" ")}
function pd(s:string){s=s.trim();let m=s.match(/^(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{2,4})/);if(m){let y=+m[3];if(y<100)y+=2000;return `${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`}m=s.match(/^\d{4}-\d{2}-\d{2}/);if(m)return m[0];const M="jan feb mar apr may jun jul aug sep oct nov dec".split(" ");m=s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+'?(\d{2,4})/);if(m&&M.includes(m[2].toLowerCase())){let y=+m[3];if(y<100)y+=2000;return `${y}-${String(M.indexOf(m[2].toLowerCase())+1).padStart(2,"0")}-${m[1].padStart(2,"0")}`}const d=new Date(s);return isNaN(+d)?null:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
const num=(s?:string)=>{const v=parseFloat((s||"").replace(/[^0-9.\-]/g,""));return isNaN(v)?0:v};
export function parseCsv(text:string):Tx[]{
 const rows=Papa.parse<string[]>(text,{skipEmptyLines:true}).data;
 const hi=rows.findIndex(r=>r.some(c=>/date/i.test(c))&&r.some(c=>/narration|description|particulars|remarks|detail/i.test(c)));
 if(hi<0)throw new Error("Couldn't find Date and Description columns. Export your statement as CSV and try again.");
 const h=rows[hi].map(c=>c.toLowerCase().trim()),f=(re:RegExp)=>h.findIndex(c=>re.test(c));
 const di=h.findIndex(c=>/date/.test(c)&&!/value/.test(c)),ni=f(/narration|description|particulars|remarks|detail/),ti=f(/debit\/credit|dr\/cr|^type$|cr\/dr/),ai=f(/amount/),dr=ti<0?f(/withdraw|debit|^dr/):-1,cr=ti<0?f(/deposit|credit|^cr/):-1;
 const out:Tx[]=[];
 rows.slice(hi+1).forEach((r,i)=>{const date=pd(r[di]||"");if(!date)return;let d=num(r[dr]),c=num(r[cr]);if(ti>=0&&ai>=0){const a=Math.abs(num(r[ai]));if(/^\s*c/i.test(r[ti]||""))c=a;else d=a}if(!d&&!c)return;const desc=r[ni]||"";out.push({id:`${date}-${i}`,date,merchant:merchantOf(desc),amount:Math.abs(d||c),type:d?"DEBIT":"CREDIT",category:categorize(desc)})});
 if(!out.length)throw new Error("No transactions found in this file.");return out}
export type MS={income:number;expense:number;savings:number;by:Record<string,number>};
export function summarize(t:Tx[]){const m:Record<string,MS>={};for(const x of t){if(x.category==="Transfer"||x.category==="Refund")continue;const k=x.date.slice(0,7),s=(m[k]??={income:0,expense:0,savings:0,by:{}});if(x.type==="CREDIT")s.income+=x.amount;else if(x.category!=="Investment"){s.expense+=x.amount;s.by[x.category]=(s.by[x.category]||0)+x.amount}}Object.values(m).forEach(s=>s.savings=s.income-s.expense);return m}
export function detectSubs(t:Tx[]){const g:Record<string,Tx[]>={};t.filter(x=>x.type==="DEBIT"&&x.category!=="Transfer").forEach(x=>(g[x.merchant]??=[]).push(x));const out:{merchant:string;amount:number;yearly:number;count:number}[]=[];
 for(const[m,a]of Object.entries(g)){if(a.length<2)continue;a.sort((x,y)=>x.date.localeCompare(y.date));const am=a.map(x=>x.amount),med=[...am].sort((x,y)=>x-y)[am.length>>1];if(am.some(v=>Math.abs(v-med)/med>.1))continue;
 const gaps=a.slice(1).map((x,i)=>(+new Date(x.date)-+new Date(a[i].date))/864e5);if(!gaps.every(v=>Math.abs(v-30)<=5))continue;
 if(a.length<3&&!/NETFLIX|SPOTIFY|OPENAI|CHATGPT|CLAUDE|YOUTUBE|PRIME/.test(m))continue;out.push({merchant:m,amount:med,yearly:med*12,count:a.length})}
 return out.sort((a,b)=>b.amount-a.amount)}
export type Insight={kind:string;title:string;body:string};
export function localInsights(t:Tx[]):Insight[]{const S=summarize(t),ks=Object.keys(S).sort(),cur=ks.at(-1);if(!cur)return[];const c=S[cur],p=S[ks.at(-2)||""],out:Insight[]=[];
 if(p){let b="",pc=0;for(const[k,v]of Object.entries(c.by)){const pv=p.by[k]||0;if(pv>0&&(v-pv)/pv>pc){pc=(v-pv)/pv;b=k}}if(b&&pc>.1)out.push({kind:"Spending leak",title:`${b} up ${Math.round(pc*100)}%`,body:`${b} went from ${inr(p.by[b])} to ${inr(c.by[b])} versus last month.`})}
 const big=t.filter(x=>x.type==="DEBIT"&&x.date.startsWith(cur)&&!["Transfer","Rent","Investment"].includes(x.category)).sort((a,b)=>b.amount-a.amount)[0];
 if(big)out.push({kind:"Unusual spending",title:`Biggest spend: ${inr(big.amount)}`,body:`${big.merchant} on ${big.date} was your largest non-rent debit this month.`});
 const s=detectSubs(t);if(s.length)out.push({kind:"Subscription review",title:`${s.length} subscriptions · ${inr(s.reduce((a,b)=>a+b.amount,0))}/month`,body:`That adds up to ${inr(s.reduce((a,b)=>a+b.yearly,0))} a year. Cancel what you haven't used lately.`});
 if(c.by.Food)out.push({kind:"Savings opportunity",title:`Cut Food by 20% to save ${inr(c.by.Food*.2)}/month`,body:`Food was ${inr(c.by.Food)} this month. That's about ${inr(c.by.Food*.2*12)} a year.`});
 out.push({kind:"Monthly summary",title:cur,body:`You earned ${inr(c.income)}, spent ${inr(c.expense)} and kept ${inr(c.savings)}, a ${c.income?Math.round(c.savings/c.income*100):0}% savings rate.`});return out}
export function sampleData():Tx[]{const out:Tx[]=[];let s=7;const r=()=>(s=(s*9301+49297)%233280)/233280,now=new Date();
 for(let k=5;k>=0;k--){const d=new Date(now.getFullYear(),now.getMonth()-k,1),ym=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
 const add=(day:number,desc:string,amt:number,type:"DEBIT"|"CREDIT"="DEBIT")=>{const date=`${ym}-${String(day).padStart(2,"0")}`;out.push({id:date+out.length,date,merchant:merchantOf(desc),amount:Math.round(amt),type,category:categorize(desc)})};
 add(1,"SALARY ACME PAYROLL",85000,"CREDIT");add(2,"UPI-RENT-LANDLORD",15000);add(5,"NETFLIX.COM",649);add(6,"OPENAI CHATGPT",1950);add(8,"SPOTIFY INDIA",119);add(10,"BESCOM ELECTRICITY",1200+r()*400);add(12,"ZERODHA SIP",10000);
 for(let i=0;i<9;i++)add(3+i*3,i%2?"UPI-SWIGGY":"UPI-ZOMATO",250+r()*(k<2?650:300));
 for(let i=0;i<6;i++)add(4+i*4,"UBER INDIA",120+r()*220);
 add(15,"AMAZON PAY",800+r()*(k===0?6000:2500));add(20,"AMAZON PAY",500+r()*1500);if(k%2)add(22,"BOOKMYSHOW",900);if(k===3)add(25,"MAKEMYTRIP FLIGHT",9800)}
 return out}

export const fromRaw=(rows:{date:string;desc:string;amount:number;type:"DEBIT"|"CREDIT"}[]):Tx[]=>rows.map((r,i)=>({id:`${r.date}-p${i}`,date:r.date,merchant:merchantOf(r.desc),amount:r.amount,type:r.type,category:categorize(r.desc)}));
export const agg=(S:Record<string,MS>):MS=>Object.values(S).reduce((a,s)=>{a.income+=s.income;a.expense+=s.expense;a.savings+=s.savings;for(const[k,v]of Object.entries(s.by))a.by[k]=(a.by[k]||0)+v;return a},{income:0,expense:0,savings:0,by:{}} as MS);
