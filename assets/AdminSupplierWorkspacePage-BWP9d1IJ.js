import{r as e}from"./rolldown-runtime-Dw2cE7zH.js";import{$ as t,B as n,J as r,Y as i,q as a}from"./react-B1lg9EFp.js";import{a as o}from"./http-2VXd4Qd7.js";import{t as s}from"./vendor-CPSNvO84.js";import{Qt as c,gt as l,w as u}from"./admin.service-BrIkrthe.js";var d=e(t(),1),f=n(),p=s.div`
  min-height: 100vh;
  background: #f0f4f8;
`,m=s.div`
  background: linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 100%);
  padding: 0 28px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`,h=s.h1`
  margin: 0;
  color: #fff;
  font-size: 20px;
`,g=s.button`
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.35);
  color: #fff;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
`,_=s.div`
  max-width: 1100px;
  margin: 24px auto;
  padding: 0 16px 50px;
`,v=s.div`
  background: #fff;
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.08);
`,y=s.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
`,b=s.button`
  border: 1px solid ${e=>e.$active?`#0f766e`:`#cbd5e1`};
  background: ${e=>e.$active?`#ccfbf1`:`#fff`};
  color: ${e=>e.$active?`#134e4a`:`#334155`};
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
`,x=s.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
`,S=s.input`
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
`,C=s.button`
  border: none;
  background: #2d6a9f;
  color: #fff;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  &:disabled { opacity: 0.6; }
`,w=s.div`
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  margin-top: 12px;
`,T=s.div`
  border-bottom: 1px dashed #dbe3ee;
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  &:last-child { border-bottom: none; }
`,E=s.button`
  border: 1px solid ${e=>e.$danger?`#fecaca`:`#cbd5e1`};
  background: ${e=>e.$danger?`#fff5f5`:`#fff`};
  color: ${e=>e.$danger?`#b91c1c`:`#334155`};
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
`,D=s.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: ${e=>e.$type===`success`?`#065f46`:`#991b1b`};
  color: #fff;
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 700;
`;function O(e){let t=new URLSearchParams(e).get(`tab`);return t===`certificates`||t===`company_docs`||t===`personnel_docs`||t===`guarantee_docs`?t:`certificates`}function k(){let e=r(),t=a(),{id:n}=i(),s=Number(n),k=(0,d.useRef)(null),[A,j]=(0,d.useState)(()=>O(t.search)),[M,N]=(0,d.useState)([]),[P,F]=(0,d.useState)(!1),[I,L]=(0,d.useState)(!1),[R,z]=(0,d.useState)(``),[B,V]=(0,d.useState)(null),H=(e,t)=>{V({msg:e,type:t}),setTimeout(()=>V(null),3e3)};(0,d.useEffect)(()=>{j(O(t.search))},[t.search]),(0,d.useEffect)(()=>{async function e(){if(!(!Number.isFinite(s)||s<=0)){L(!0);try{N(await l(s,A))}catch{H(`Veriler yüklenemedi`,`error`)}finally{L(!1)}}}e()},[s,A]);let U=(0,d.useMemo)(()=>M.filter(e=>!R.trim()||e.original_filename.toLowerCase().includes(R.trim().toLowerCase())),[M,R]),W=t=>{e(`/admin/suppliers/${s}/workspace?tab=${t}`)},G=async e=>{let t=o();if(!t){H(`Oturum bulunamadı`,`error`);return}let n=`https://buyerasistans.com.tr/api/v1/suppliers/${s}/documents/file/${encodeURIComponent(e.stored_filename||``)}?category=${encodeURIComponent(e.category)}`;try{let e=await fetch(n,{headers:{Authorization:`Bearer ${t}`}});if(!e.ok)throw Error(`HTTP ${e.status}`);let r=await e.blob(),i=URL.createObjectURL(r);window.open(i,`_blank`,`noopener,noreferrer`),setTimeout(()=>URL.revokeObjectURL(i),6e4)}catch{H(`Doküman açılamadı`,`error`)}},K=async e=>{if(window.confirm(`Bu dokümanı silmek istediğinize emin misiniz?`))try{await u(s,e),H(`Doküman silindi`,`success`),N(await l(s,A))}catch{H(`Doküman silinemedi`,`error`)}};return(0,f.jsxs)(p,{children:[(0,f.jsxs)(m,{children:[(0,f.jsx)(h,{children:`Evrak ve Dokümanlar`}),(0,f.jsx)(g,{onClick:()=>e(`/admin/suppliers/${s}`),children:`← Tedarikçi Detayına Dön`})]}),(0,f.jsx)(_,{children:(0,f.jsxs)(v,{children:[(0,f.jsxs)(y,{children:[(0,f.jsx)(b,{$active:A===`certificates`,onClick:()=>W(`certificates`),children:`Sertifikalar`}),(0,f.jsx)(b,{$active:A===`company_docs`,onClick:()=>W(`company_docs`),children:`Şirket Evrakları`}),(0,f.jsx)(b,{$active:A===`personnel_docs`,onClick:()=>W(`personnel_docs`),children:`Personel Evrakları`}),(0,f.jsx)(b,{$active:A===`guarantee_docs`,onClick:()=>W(`guarantee_docs`),children:`Alınan Teminatlar`})]}),I&&(0,f.jsx)(`div`,{style:{color:`#64748b`,fontSize:14},children:`Yükleniyor...`}),!I&&(0,f.jsxs)(f.Fragment,{children:[(0,f.jsxs)(x,{children:[(0,f.jsx)(S,{value:R,onChange:e=>z(e.target.value),placeholder:`Dosya adına göre filtrele`}),(0,f.jsx)(C,{onClick:()=>k.current?.click(),disabled:P,children:P?`⏳ Yükleniyor...`:`+ Evrak Yükle`})]}),(0,f.jsx)(`input`,{ref:k,type:`file`,accept:`application/pdf,image/jpeg,image/png,image/webp`,style:{display:`none`},onChange:async e=>{let t=e.target.files?.[0];if(t)try{F(!0),await c(s,A,t),H(`Evrak yüklendi`,`success`),N(await l(s,A))}catch(e){H(e?.response?.data?.detail||`Evrak yüklenemedi`,`error`)}finally{F(!1),e.target.value=``}}}),(0,f.jsxs)(w,{children:[U.length===0&&(0,f.jsx)(T,{style:{color:`#64748b`,fontSize:13},children:`Kayıt bulunamadı`}),U.map(e=>(0,f.jsxs)(T,{children:[(0,f.jsxs)(`div`,{children:[(0,f.jsx)(`div`,{style:{fontWeight:700,fontSize:13},children:e.original_filename}),(0,f.jsx)(`div`,{style:{color:`#64748b`,fontSize:12},children:e.created_at?new Date(e.created_at).toLocaleString(`tr-TR`):``})]}),(0,f.jsxs)(`div`,{style:{display:`flex`,gap:8},children:[(0,f.jsx)(E,{type:`button`,onClick:()=>G(e),children:`Görüntüle`}),(0,f.jsx)(E,{type:`button`,$danger:!0,onClick:()=>void K(e.id),children:`Sil`})]})]},e.id))]})]})]})}),B&&(0,f.jsx)(D,{$type:B.type,children:B.msg})]})}export{k as default};