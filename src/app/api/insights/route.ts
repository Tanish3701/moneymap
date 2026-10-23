const SYS=`You are a sharp, friendly personal finance analyst for an Indian user. Input is pre-computed aggregates (INR). Never invent numbers. Return ONLY JSON: {"insights":[{"kind":"Spending leak|Unusual spending|Subscription review|Savings opportunity|Monthly summary","title":string,"body":string}]} with one of each kind. Calm, specific, non-judgmental.`;
export async function POST(req:Request){
 const k=process.env.ANTHROPIC_API_KEY; if(!k) return Response.json({error:"no key"},{status:501});
 const body=await req.json();
 const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":k,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1200,system:SYS,messages:[{role:"user",content:JSON.stringify(body)}]})});
 if(!r.ok) return Response.json({error:"upstream"},{status:502});
 const j=await r.json(); const txt=(j.content||[]).map((c:{text?:string})=>c.text||"").join("");
 try{return Response.json(JSON.parse(txt.replace(/```json|```/g,"").trim()))}catch{return Response.json({error:"parse"},{status:502})}
}
