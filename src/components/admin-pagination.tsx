"use client";
import Link from "next/link";
import {usePathname,useSearchParams} from "next/navigation";

export function AdminPagination({pagination,columns}:{pagination?:{page:number;per_page:number;total:number;pages:number};columns:string[]}){
 const path=usePathname(),sp=useSearchParams();
 if(!pagination)return null;
 const {page,per_page,total,pages}=pagination;
 const href=(p:number)=>{const q=new URLSearchParams(sp.toString());q.set("page",String(p));q.delete("id");return path+"?"+q.toString()};
 return <section className="my-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line-2 bg-white p-4" aria-label="List pagination and sorting">
  <p className="text-sm text-muted">{total?`${(page-1)*per_page+1}–${Math.min(page*per_page,total)} of ${total}`:"No matching records"}</p>
  <form method="get" className="flex flex-wrap items-center gap-2">
   {[...sp.entries()].filter(([k])=>!["page","per_page","sort","direction","id"].includes(k)).map(([k,v])=><input key={k} type="hidden" name={k} value={v}/>)}
   <label className="text-sm">Sort <select name="sort" defaultValue={sp.get("sort")??""} className="rounded-lg border border-line-2 p-2"><option value="">Default</option>{columns.map(c=><option key={c} value={c}>{c.replaceAll("_"," ")}</option>)}</select></label>
   <select name="direction" aria-label="Sort direction" defaultValue={sp.get("direction")??"asc"} className="rounded-lg border border-line-2 p-2"><option value="asc">Ascending</option><option value="desc">Descending</option></select>
   <select name="per_page" aria-label="Rows per page" defaultValue={per_page} className="rounded-lg border border-line-2 p-2">{[25,50,100,200].map(n=><option key={n} value={n}>{n} rows</option>)}</select>
   <button className="rounded-lg bg-ink px-3 py-2 text-sm text-white">Apply</button>
  </form>
  <nav aria-label="Pages" className="flex items-center gap-3 text-sm">{page>1&&<Link href={href(page-1)}>Previous</Link>}<span>Page {page} of {Math.max(1,pages)}</span>{page<pages&&<Link href={href(page+1)}>Next</Link>}</nav>
 </section>
}
