import{r as e}from"./rolldown-runtime-Dw2cE7zH.js";import{$ as t,B as n,J as r}from"./react-B1lg9EFp.js";import{i}from"./http-2VXd4Qd7.js";import{t as a}from"./vendor-CPSNvO84.js";import{_ as ee,a as te,g as o,i as ne,n as s,o as c,r as l,s as re,u,v as d}from"./supplier-profile.service-Duxtoz2X.js";var f=e(t(),1),p=n(),m=a.div`
  max-width: 1100px;
  margin: 28px auto;
  padding: 0 16px 50px;
  display: grid;
  gap: 16px;
`,h=a.section`
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
`,g=a.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
`,_=a.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
`,v=a.label`
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 13px;
  color: #334155;
`,y=a.input`
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
`,b=a.button`
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  color: #0f172a;
  padding: 8px 12px;
  font-weight: 700;
  cursor: pointer;
`,x=a(b)`
  border: 0;
  background: #2563eb;
  color: #fff;
`,S=a.div`
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
  color: ${e=>e.$error?`#991b1b`:`#065f46`};
  background: ${e=>e.$error?`#fee2e2`:`#d1fae5`};
`;function C(){let e=r(),[t,n]=(0,f.useState)(!0),[a,C]=(0,f.useState)(null),[w,T]=(0,f.useState)(null),[E,D]=(0,f.useState)(null),[O,k]=(0,f.useState)(``),[A,j]=(0,f.useState)(``),[M,N]=(0,f.useState)(``),[P,F]=(0,f.useState)(``),[I,L]=(0,f.useState)(``),[R,z]=(0,f.useState)(``),[B,V]=(0,f.useState)(null),[H,U]=(0,f.useState)(``),[W,G]=(0,f.useState)(``),[K,q]=(0,f.useState)(``),[J,Y]=(0,f.useState)(``),[X,Z]=(0,f.useState)(null),Q=(0,f.useCallback)(async()=>{D(await u({query:O||void 0,date_from:A||void 0,date_to:M||void 0}))},[O,A,M]);(0,f.useEffect)(()=>{if(!i()){e(`/supplier/login`,{replace:!0});return}(async()=>{try{n(!0),await Q()}catch{C(`Finans verileri yuklenemedi`)}finally{n(!1)}})()},[e,Q]);async function ie(){let e=Number(I);if(!(!P||!Number.isFinite(e)||e<=0))try{await s({title:P,amount:e,invoice_date:R||void 0,file:B||void 0}),F(``),L(``),z(``),V(null),await Q(),T(`Fatura eklendi`),C(null)}catch{C(`Fatura eklenemedi`)}}async function ae(){let e=Number(W);if(!(!H||!Number.isFinite(e)||e<=0))try{await l({title:H,amount:e,payment_date:K||void 0}),U(``),G(``),q(``),await Q(),T(`Odeme eklendi`),C(null)}catch{C(`Odeme eklenemedi`)}}async function $(){if(!(!J||!X))try{await ne({title:J,file:X}),Y(``),Z(null),await Q(),T(`İş fotoğrafı eklendi`),C(null)}catch{C(`İş fotoğrafı eklenemedi`)}}async function oe(e,t){let n=window.prompt(`Fatura basligi`,t.title);if(!n)return;let r=window.prompt(`Fatura tutari`,String(t.amount));if(!r)return;let i=Number(r);!Number.isFinite(i)||i<=0||(await o(e,{title:n,amount:i,invoice_date:window.prompt(`Fatura tarihi (YYYY-MM-DD)`,t.invoice_date||``)||void 0}),await Q())}async function se(e){window.confirm(`Fatura silinsin mi?`)&&(await te(e),await Q())}async function ce(e,t){let n=window.prompt(`Odeme basligi`,t.title);if(!n)return;let r=window.prompt(`Odeme tutari`,String(t.amount));if(!r)return;let i=Number(r);!Number.isFinite(i)||i<=0||(await ee(e,{title:n,amount:i,payment_date:window.prompt(`Odeme tarihi (YYYY-MM-DD)`,t.payment_date||``)||void 0}),await Q())}async function le(e){window.confirm(`Odeme silinsin mi?`)&&(await c(e),await Q())}async function ue(e,t){let n=window.prompt(`Fotograf basligi`,t.title);n&&(await d(e,{title:n,description:window.prompt(`Açıklama`,t.description||``)||void 0}),await Q())}async function de(e){window.confirm(`Fotograf silinsin mi?`)&&(await re(e),await Q())}return t?(0,p.jsx)(m,{children:`Yukleniyor...`}):(0,p.jsxs)(m,{children:[a&&(0,p.jsx)(S,{$error:!0,children:a}),w&&(0,p.jsx)(S,{children:w}),(0,p.jsxs)(h,{children:[(0,p.jsxs)(g,{children:[(0,p.jsx)(`h2`,{style:{margin:0},children:`Finans Modulu`}),(0,p.jsx)(b,{type:`button`,onClick:()=>e(`/supplier/profile`),children:`Profile Don`})]}),!!E?.alerts?.length&&(0,p.jsx)(S,{$error:!0,style:{marginTop:10},children:E.alerts.join(` `)})]}),(0,p.jsx)(h,{children:(0,p.jsxs)(_,{children:[(0,p.jsxs)(v,{children:[`Sozlesme Toplami`,(0,p.jsx)(y,{readOnly:!0,value:(E?.totals.contract_total??0).toLocaleString(`tr-TR`)})]}),(0,p.jsxs)(v,{children:[`Fatura Toplami`,(0,p.jsx)(y,{readOnly:!0,value:(E?.totals.invoice_total??0).toLocaleString(`tr-TR`)})]}),(0,p.jsxs)(v,{children:[`Odeme Toplami`,(0,p.jsx)(y,{readOnly:!0,value:(E?.totals.payment_total??0).toLocaleString(`tr-TR`)})]})]})}),(0,p.jsxs)(h,{children:[(0,p.jsx)(`h3`,{style:{marginTop:0},children:`Filtrele`}),(0,p.jsxs)(_,{children:[(0,p.jsxs)(v,{children:[`Arama`,(0,p.jsx)(y,{value:O,onChange:e=>k(e.target.value),placeholder:`Baslik, tutar, not`})]}),(0,p.jsxs)(v,{children:[`Tarih Başlangıç`,(0,p.jsx)(y,{type:`date`,value:A,onChange:e=>j(e.target.value)})]}),(0,p.jsxs)(v,{children:[`Tarih Bitis`,(0,p.jsx)(y,{type:`date`,value:M,onChange:e=>N(e.target.value)})]})]}),(0,p.jsx)(`div`,{style:{marginTop:8},children:(0,p.jsx)(b,{type:`button`,onClick:()=>void Q(),children:`Filtrele`})})]}),(0,p.jsxs)(h,{children:[(0,p.jsx)(`h3`,{style:{marginTop:0},children:`Fatura Ekle`}),(0,p.jsxs)(_,{children:[(0,p.jsxs)(v,{children:[`Fatura Basligi`,(0,p.jsx)(y,{value:P,onChange:e=>F(e.target.value)})]}),(0,p.jsxs)(v,{children:[`Fatura Tutari`,(0,p.jsx)(y,{type:`number`,value:I,onChange:e=>L(e.target.value)})]}),(0,p.jsxs)(v,{children:[`Fatura Tarihi`,(0,p.jsx)(y,{type:`date`,value:R,onChange:e=>z(e.target.value)})]}),(0,p.jsxs)(v,{children:[`Fatura Dosyasi`,(0,p.jsx)(y,{type:`file`,onChange:e=>V(e.target.files?.[0]||null)})]})]}),(0,p.jsx)(`div`,{style:{marginTop:8},children:(0,p.jsx)(x,{type:`button`,onClick:()=>void ie(),children:`Fatura Ekle`})})]}),(0,p.jsxs)(h,{children:[(0,p.jsx)(`h3`,{style:{marginTop:0},children:`Odeme Ekle`}),(0,p.jsxs)(_,{children:[(0,p.jsxs)(v,{children:[`Odeme Basligi`,(0,p.jsx)(y,{value:H,onChange:e=>U(e.target.value)})]}),(0,p.jsxs)(v,{children:[`Odeme Tutari`,(0,p.jsx)(y,{type:`number`,value:W,onChange:e=>G(e.target.value)})]}),(0,p.jsxs)(v,{children:[`Odeme Tarihi`,(0,p.jsx)(y,{type:`date`,value:K,onChange:e=>q(e.target.value)})]})]}),(0,p.jsx)(`div`,{style:{marginTop:8},children:(0,p.jsx)(x,{type:`button`,onClick:()=>void ae(),children:`Odeme Ekle`})})]}),(0,p.jsxs)(h,{children:[(0,p.jsx)(`h3`,{style:{marginTop:0},children:`İş Fotoğrafı Ekle`}),(0,p.jsxs)(_,{children:[(0,p.jsxs)(v,{children:[`Fotograf Basligi`,(0,p.jsx)(y,{value:J,onChange:e=>Y(e.target.value)})]}),(0,p.jsxs)(v,{children:[`İş Fotoğrafı`,(0,p.jsx)(y,{type:`file`,accept:`image/*`,onChange:e=>Z(e.target.files?.[0]||null)})]})]}),(0,p.jsx)(`div`,{style:{marginTop:8},children:(0,p.jsx)(x,{type:`button`,onClick:()=>void $(),children:`Fotograf Ekle`})})]}),(0,p.jsxs)(h,{children:[(0,p.jsxs)(`h3`,{style:{marginTop:0},children:[`Faturalar (`,E?.invoices.length||0,`)`]}),(0,p.jsxs)(`div`,{style:{display:`grid`,gap:8},children:[(E?.invoices||[]).map(e=>(0,p.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,gap:8,alignItems:`center`},children:[(0,p.jsxs)(`span`,{children:[e.title,` - `,e.amount.toLocaleString(`tr-TR`),` `,e.currency]}),(0,p.jsxs)(`div`,{style:{display:`flex`,gap:6},children:[(0,p.jsx)(b,{type:`button`,onClick:()=>void oe(e.id,e),children:`Duzenle`}),(0,p.jsx)(b,{type:`button`,onClick:()=>void se(e.id),children:`Sil`})]})]},e.id)),(E?.invoices||[]).length===0&&(0,p.jsx)(`span`,{style:{color:`#94a3b8`,fontSize:12},children:`Kayit yok.`})]})]}),(0,p.jsxs)(h,{children:[(0,p.jsxs)(`h3`,{style:{marginTop:0},children:[`Odemeler (`,E?.payments.length||0,`)`]}),(0,p.jsxs)(`div`,{style:{display:`grid`,gap:8},children:[(E?.payments||[]).map(e=>(0,p.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,gap:8,alignItems:`center`},children:[(0,p.jsxs)(`span`,{children:[e.title,` - `,e.amount.toLocaleString(`tr-TR`),` `,e.currency]}),(0,p.jsxs)(`div`,{style:{display:`flex`,gap:6},children:[(0,p.jsx)(b,{type:`button`,onClick:()=>void ce(e.id,e),children:`Duzenle`}),(0,p.jsx)(b,{type:`button`,onClick:()=>void le(e.id),children:`Sil`})]})]},e.id)),(E?.payments||[]).length===0&&(0,p.jsx)(`span`,{style:{color:`#94a3b8`,fontSize:12},children:`Kayit yok.`})]})]}),(0,p.jsxs)(h,{children:[(0,p.jsxs)(`h3`,{style:{marginTop:0},children:[`İş Fotoğrafları (`,E?.photos.length||0,`)`]}),(0,p.jsxs)(`div`,{style:{display:`grid`,gap:8},children:[(E?.photos||[]).map(e=>(0,p.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,gap:8,alignItems:`center`},children:[(0,p.jsx)(`a`,{href:e.file_url,target:`_blank`,rel:`noreferrer`,children:e.title}),(0,p.jsxs)(`div`,{style:{display:`flex`,gap:6},children:[(0,p.jsx)(b,{type:`button`,onClick:()=>void ue(e.id,e),children:`Duzenle`}),(0,p.jsx)(b,{type:`button`,onClick:()=>void de(e.id),children:`Sil`})]})]},e.id)),(E?.photos||[]).length===0&&(0,p.jsx)(`span`,{style:{color:`#94a3b8`,fontSize:12},children:`Kayit yok.`})]})]})]})}export{C as default};