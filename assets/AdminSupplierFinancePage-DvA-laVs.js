import{r as e}from"./rolldown-runtime-Dw2cE7zH.js";import{$ as t,B as n,J as r,Y as i}from"./react-B1lg9EFp.js";import{t as a}from"./vendor-CPSNvO84.js";import{D as ee,E as te,L as ne,Mt as o,Nt as s,Pt as re,R as ie,T as c,c as l,l as u,u as d}from"./admin.service-BrIkrthe.js";var f=e(t(),1),p=n(),m=a.div`
  display: grid;
  gap: 16px;
`,h=a.section`
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
`,ae=a.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
`,g=a.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
`,_=a.label`
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 13px;
  color: #334155;
`,v=a.input`
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
`,y=a.button`
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  color: #0f172a;
  padding: 8px 12px;
  font-weight: 700;
  cursor: pointer;
`,b=a(y)`
  border: 0;
  background: #2563eb;
  color: #fff;
`,x=a.div`
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
  color: ${e=>e.$error?`#991b1b`:`#065f46`};
  background: ${e=>e.$error?`#fee2e2`:`#d1fae5`};
`;function S(){let e=r(),{id:t}=i(),n=Number(t),[a,S]=(0,f.useState)(!0),[C,w]=(0,f.useState)(null),[T,E]=(0,f.useState)(null),[D,O]=(0,f.useState)(``),[k,A]=(0,f.useState)(null),[j,oe]=(0,f.useState)(``),[M,se]=(0,f.useState)(``),[N,P]=(0,f.useState)(``),[F,I]=(0,f.useState)(``),[L,R]=(0,f.useState)(``),[z,B]=(0,f.useState)(``),[V,H]=(0,f.useState)(null),[U,W]=(0,f.useState)(``),[G,K]=(0,f.useState)(``),[q,J]=(0,f.useState)(``),[Y,X]=(0,f.useState)(``),[Z,Q]=(0,f.useState)(null),$=(0,f.useCallback)(async()=>{A(await ne(n,{query:j||void 0,date_from:M||void 0,date_to:N||void 0}))},[n,j,M,N]);(0,f.useEffect)(()=>{if(!Number.isFinite(n)||n<=0){w(`Geçersiz tedarikçi numarası`),S(!1);return}(async()=>{try{S(!0);let[e]=await Promise.all([ie(n),$()]);O(e.supplier.company_name||`#${n}`)}catch{w(`Finans verileri yuklenemedi`)}finally{S(!1)}})()},[n,$]);async function ce(){let e=Number(L);if(!(!F||!Number.isFinite(e)||e<=0))try{await l(n,{title:F,amount:e,invoice_date:z||void 0,file:V||void 0}),I(``),R(``),B(``),H(null),await $(),E(`Fatura eklendi`),w(null)}catch{w(`Fatura eklenemedi`)}}async function le(){let e=Number(G);if(!(!U||!Number.isFinite(e)||e<=0))try{await u(n,{title:U,amount:e,payment_date:q||void 0}),W(``),K(``),J(``),await $(),E(`Odeme eklendi`),w(null)}catch{w(`Odeme eklenemedi`)}}async function ue(){if(!(!Y||!Z))try{await d(n,{title:Y,file:Z}),X(``),Q(null),await $(),E(`İş fotoğrafı eklendi`),w(null)}catch{w(`İş fotoğrafı eklenemedi`)}}async function de(e,t){let r=window.prompt(`Fatura basligi`,t.title);if(!r)return;let i=window.prompt(`Fatura tutari`,String(t.amount));if(!i)return;let a=Number(i);!Number.isFinite(a)||a<=0||(await o(n,e,{title:r,amount:a,invoice_date:window.prompt(`Fatura tarihi (YYYY-MM-DD)`,t.invoice_date||``)||void 0}),await $())}async function fe(e){window.confirm(`Fatura silinsin mi?`)&&(await c(n,e),await $())}async function pe(e,t){let r=window.prompt(`Odeme basligi`,t.title);if(!r)return;let i=window.prompt(`Odeme tutari`,String(t.amount));if(!i)return;let a=Number(i);!Number.isFinite(a)||a<=0||(await s(n,e,{title:r,amount:a,payment_date:window.prompt(`Odeme tarihi (YYYY-MM-DD)`,t.payment_date||``)||void 0}),await $())}async function me(e){window.confirm(`Odeme silinsin mi?`)&&(await te(n,e),await $())}async function he(e,t){let r=window.prompt(`Fotograf basligi`,t.title);r&&(await re(n,e,{title:r,description:window.prompt(`Açıklama`,t.description||``)||void 0}),await $())}async function ge(e){window.confirm(`Fotograf silinsin mi?`)&&(await ee(n,e),await $())}return a?(0,p.jsx)(m,{children:`Yukleniyor...`}):(0,p.jsxs)(m,{children:[C&&(0,p.jsx)(x,{$error:!0,children:C}),T&&(0,p.jsx)(x,{children:T}),(0,p.jsxs)(h,{children:[(0,p.jsxs)(ae,{children:[(0,p.jsxs)(`h2`,{style:{margin:0},children:[`Finans Modulu: `,D||`#${n}`]}),(0,p.jsx)(y,{type:`button`,onClick:()=>e(`/admin/suppliers/${n}`),children:`Tedarikçi Detayına Dön`})]}),!!k?.alerts?.length&&(0,p.jsx)(x,{$error:!0,style:{marginTop:10},children:k.alerts.join(` `)})]}),(0,p.jsx)(h,{children:(0,p.jsxs)(g,{children:[(0,p.jsxs)(_,{children:[`Sozlesme Toplami`,(0,p.jsx)(v,{readOnly:!0,value:(k?.totals.contract_total??0).toLocaleString(`tr-TR`)})]}),(0,p.jsxs)(_,{children:[`Fatura Toplami`,(0,p.jsx)(v,{readOnly:!0,value:(k?.totals.invoice_total??0).toLocaleString(`tr-TR`)})]}),(0,p.jsxs)(_,{children:[`Odeme Toplami`,(0,p.jsx)(v,{readOnly:!0,value:(k?.totals.payment_total??0).toLocaleString(`tr-TR`)})]})]})}),(0,p.jsxs)(h,{children:[(0,p.jsx)(`h3`,{style:{marginTop:0},children:`Filtrele`}),(0,p.jsxs)(g,{children:[(0,p.jsxs)(_,{children:[`Arama`,(0,p.jsx)(v,{value:j,onChange:e=>oe(e.target.value),placeholder:`Baslik, tutar, not`})]}),(0,p.jsxs)(_,{children:[`Tarih Başlangıç`,(0,p.jsx)(v,{type:`date`,value:M,onChange:e=>se(e.target.value)})]}),(0,p.jsxs)(_,{children:[`Tarih Bitis`,(0,p.jsx)(v,{type:`date`,value:N,onChange:e=>P(e.target.value)})]})]}),(0,p.jsx)(`div`,{style:{marginTop:8},children:(0,p.jsx)(y,{type:`button`,onClick:()=>void $(),children:`Filtrele`})})]}),(0,p.jsxs)(h,{children:[(0,p.jsx)(`h3`,{style:{marginTop:0},children:`Fatura Ekle`}),(0,p.jsxs)(g,{children:[(0,p.jsxs)(_,{children:[`Fatura Basligi`,(0,p.jsx)(v,{value:F,onChange:e=>I(e.target.value)})]}),(0,p.jsxs)(_,{children:[`Fatura Tutari`,(0,p.jsx)(v,{type:`number`,value:L,onChange:e=>R(e.target.value)})]}),(0,p.jsxs)(_,{children:[`Fatura Tarihi`,(0,p.jsx)(v,{type:`date`,value:z,onChange:e=>B(e.target.value)})]}),(0,p.jsxs)(_,{children:[`Fatura Dosyasi`,(0,p.jsx)(v,{type:`file`,onChange:e=>H(e.target.files?.[0]||null)})]})]}),(0,p.jsx)(`div`,{style:{marginTop:8},children:(0,p.jsx)(b,{type:`button`,onClick:()=>void ce(),children:`Fatura Ekle`})})]}),(0,p.jsxs)(h,{children:[(0,p.jsx)(`h3`,{style:{marginTop:0},children:`Odeme Ekle`}),(0,p.jsxs)(g,{children:[(0,p.jsxs)(_,{children:[`Odeme Basligi`,(0,p.jsx)(v,{value:U,onChange:e=>W(e.target.value)})]}),(0,p.jsxs)(_,{children:[`Odeme Tutari`,(0,p.jsx)(v,{type:`number`,value:G,onChange:e=>K(e.target.value)})]}),(0,p.jsxs)(_,{children:[`Odeme Tarihi`,(0,p.jsx)(v,{type:`date`,value:q,onChange:e=>J(e.target.value)})]})]}),(0,p.jsx)(`div`,{style:{marginTop:8},children:(0,p.jsx)(b,{type:`button`,onClick:()=>void le(),children:`Odeme Ekle`})})]}),(0,p.jsxs)(h,{children:[(0,p.jsx)(`h3`,{style:{marginTop:0},children:`İş Fotoğrafı Ekle`}),(0,p.jsxs)(g,{children:[(0,p.jsxs)(_,{children:[`Fotograf Basligi`,(0,p.jsx)(v,{value:Y,onChange:e=>X(e.target.value)})]}),(0,p.jsxs)(_,{children:[`İş Fotoğrafı`,(0,p.jsx)(v,{type:`file`,accept:`image/*`,onChange:e=>Q(e.target.files?.[0]||null)})]})]}),(0,p.jsx)(`div`,{style:{marginTop:8},children:(0,p.jsx)(b,{type:`button`,onClick:()=>void ue(),children:`Fotograf Ekle`})})]}),(0,p.jsxs)(h,{children:[(0,p.jsxs)(`h3`,{style:{marginTop:0},children:[`Faturalar (`,k?.invoices.length||0,`)`]}),(0,p.jsxs)(`div`,{style:{display:`grid`,gap:8},children:[(k?.invoices||[]).map(e=>(0,p.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,gap:8,alignItems:`center`},children:[(0,p.jsxs)(`span`,{children:[e.title,` - `,e.amount.toLocaleString(`tr-TR`),` `,e.currency]}),(0,p.jsxs)(`div`,{style:{display:`flex`,gap:6},children:[(0,p.jsx)(y,{type:`button`,onClick:()=>void de(e.id,e),children:`Duzenle`}),(0,p.jsx)(y,{type:`button`,onClick:()=>void fe(e.id),children:`Sil`})]})]},e.id)),(k?.invoices||[]).length===0&&(0,p.jsx)(`span`,{style:{color:`#94a3b8`,fontSize:12},children:`Kayit yok.`})]})]}),(0,p.jsxs)(h,{children:[(0,p.jsxs)(`h3`,{style:{marginTop:0},children:[`Odemeler (`,k?.payments.length||0,`)`]}),(0,p.jsxs)(`div`,{style:{display:`grid`,gap:8},children:[(k?.payments||[]).map(e=>(0,p.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,gap:8,alignItems:`center`},children:[(0,p.jsxs)(`span`,{children:[e.title,` - `,e.amount.toLocaleString(`tr-TR`),` `,e.currency]}),(0,p.jsxs)(`div`,{style:{display:`flex`,gap:6},children:[(0,p.jsx)(y,{type:`button`,onClick:()=>void pe(e.id,e),children:`Duzenle`}),(0,p.jsx)(y,{type:`button`,onClick:()=>void me(e.id),children:`Sil`})]})]},e.id)),(k?.payments||[]).length===0&&(0,p.jsx)(`span`,{style:{color:`#94a3b8`,fontSize:12},children:`Kayit yok.`})]})]}),(0,p.jsxs)(h,{children:[(0,p.jsxs)(`h3`,{style:{marginTop:0},children:[`İş Fotoğrafları (`,k?.photos.length||0,`)`]}),(0,p.jsxs)(`div`,{style:{display:`grid`,gap:8},children:[(k?.photos||[]).map(e=>(0,p.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,gap:8,alignItems:`center`},children:[(0,p.jsx)(`a`,{href:e.file_url,target:`_blank`,rel:`noreferrer`,children:e.title}),(0,p.jsxs)(`div`,{style:{display:`flex`,gap:6},children:[(0,p.jsx)(y,{type:`button`,onClick:()=>void he(e.id,e),children:`Duzenle`}),(0,p.jsx)(y,{type:`button`,onClick:()=>void ge(e.id),children:`Sil`})]})]},e.id)),(k?.photos||[]).length===0&&(0,p.jsx)(`span`,{style:{color:`#94a3b8`,fontSize:12},children:`Kayit yok.`})]})]})]})}export{S as default};