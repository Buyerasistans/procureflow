import{r as e}from"./rolldown-runtime-Dw2cE7zH.js";import{$ as t,B as n,J as r,Y as ee}from"./react-B1lg9EFp.js";import{t as i}from"./vendor-CPSNvO84.js";import{Ft as te,It as ne,Lt as re,O as ie,R as ae,St as oe,d as se,f as ce,jt as le,k as ue,kt as de}from"./admin.service-BrIkrthe.js";import{l as fe}from"./index-BYVSOJ2Y.js";import{n as pe,t as me}from"./turkey-cities-BgRorRdd.js";import{t as he}from"./CategorySelectionModal-aheIQCD4.js";var a=e(t(),1),o=n(),s=i.div`
  display: grid;
  gap: 16px;
`,c=i.section`
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
`,l=i.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
`,u=i.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
`,d=i.label`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: #111827;
`,f=i.input`
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
`,p=i.select`
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
  background: #fff;
`,m=i.textarea`
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
  resize: vertical;
`,h=i.button`
  border: 0;
  border-radius: 8px;
  padding: 9px 12px;
  font-weight: 600;
  background: #2563eb;
  color: #fff;
  cursor: pointer;
`,g=i(h)`
  background: #4b5563;
`,ge=i(h)`
  background: #dc2626;
`,_=i.button`
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 8px 10px;
  background: #fff;
  color: #334155;
  font-weight: 600;
  cursor: pointer;
`,_e=i.div`
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
  color: ${e=>e.$error?`#991b1b`:`#065f46`};
  background: ${e=>e.$error?`#fee2e2`:`#d1fae5`};
`,v=i.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  background: ${e=>e.$tone===`success`?`#dcfce7`:e.$tone===`warning`?`#fef3c7`:e.$tone===`info`?`#dbeafe`:`#e5e7eb`};
  color: ${e=>e.$tone===`success`?`#166534`:e.$tone===`warning`?`#92400e`:e.$tone===`info`?`#1d4ed8`:`#475569`};
`,y=i.button`
  width: 100%;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 0;
  margin-bottom: 14px;
  h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: #4f4f6c;
  }
`,b=i.span`
  font-size: 18px;
  font-weight: 700;
  color: #334155;
`,ve=i.div`
  margin-top: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
`,ye=i.div`
  display: grid;
  grid-template-columns: minmax(170px, 1.1fr) minmax(170px, 1fr) minmax(220px, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 9px 12px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  color: #475569;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  @media (max-width: 900px) {
    display: none;
  }
`,be=i.div`
  display: grid;
  grid-template-columns: minmax(170px, 1.1fr) minmax(170px, 1fr) minmax(220px, 1fr) auto;
  gap: 8px;
  align-items: start;
  padding: 10px 12px;
  border-bottom: 1px dashed #dbe3ee;
  background: #fff;
  &:last-child {
    border-bottom: none;
  }
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 6px;
  }
`,x=i.div`
  font-size: 12px;
  color: #334155;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  strong {
    color: #0f172a;
  }
`,S=i.button`
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #334155;
  border-radius: 7px;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
`,xe=i(S)`
  border-color: #93c5fd;
  color: #1d4ed8;
`,C=i(S)`
  border-color: #fcd34d;
  color: #92400e;
`,Se=i(S)`
  border-color: #86efac;
  color: #166534;
`,Ce=i.div`
  width: 110px;
  height: 110px;
  border-radius: 12px;
  border: 1px solid #dbe3ee;
  background: #f8fafc;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`,w=i.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
`,we=i.div`
  width: min(700px, 94vw);
  background: #fff;
  border-radius: 10px;
  border: 1px solid #dbe3ee;
  padding: 16px;
`,T=i.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`,Te=[{key:`ziraat`,name:`Ziraat Bankası`},{key:`isbank`,name:`İş Bankası`},{key:`garanti`,name:`Garanti BBVA`},{key:`yapikredi`,name:`Yapı Kredi`},{key:`akbank`,name:`Akbank`},{key:`vakifbank`,name:`VakıfBank`},{key:`halkbank`,name:`Halkbank`},{key:`qnb`,name:`QNB`},{key:`denizbank`,name:`DenizBank`}];function Ee(e){return{company_name:e.company_name||``,company_title:e.company_title||``,phone:e.phone||``,email:e.email||``,website:e.website||``,address:e.address||``,city:e.city||``,address_district:e.address_district||``,postal_code:e.postal_code||``,invoice_name:e.invoice_name||``,invoice_address:e.invoice_address||``,invoice_city:e.invoice_city||``,invoice_district:e.invoice_district||``,invoice_postal_code:e.invoice_postal_code||``,tax_number:e.tax_number||``,registration_number:e.registration_number||``,tax_office:e.tax_office||``,notes:e.notes||``,category:e.category||``,category_tags:e.category_tags||[],partner_category_tags:e.partner_category_tags||[],effective_category_tags:e.effective_category_tags||[],accepts_checks:!!e.accepts_checks,preferred_check_term:e.preferred_check_term||``,payment_accounts:e.payment_accounts||[]}}function De(e){return e?String(e).slice(0,10):``}function E(e){return e?`▲`:`▼`}function D(e){if(!e)return``;let t=e.replace(/\D/g,``);return t.startsWith(`0090`)&&(t=t.slice(4)),t.startsWith(`90`)&&t.length>=12&&(t=t.slice(2)),t.startsWith(`0`)&&t.length>=11&&(t=t.slice(1)),t}function Oe(e){let t=D(e);return t.length>=10&&t.startsWith(`5`)}function O(){let{id:e}=ee(),t=r(),n=Number(e),[i,O]=(0,a.useState)(!0),[ke,Ae]=(0,a.useState)(!1),[je,k]=(0,a.useState)(null),[Me,A]=(0,a.useState)(null),[j,Ne]=(0,a.useState)(null),[M,N]=(0,a.useState)(null),[Pe,Fe]=(0,a.useState)(!0),[Ie,Le]=(0,a.useState)(!0),[Re,P]=(0,a.useState)(!1),[F,ze]=(0,a.useState)(``),[I,Be]=(0,a.useState)(`all`),[Ve,L]=(0,a.useState)(!1),[R,z]=(0,a.useState)({name:``,email:``,phone:``}),[He,B]=(0,a.useState)({}),[V,H]=(0,a.useState)({title:``,guarantee_type:``,amount:``,currency:`TRY`,issued_at:``,expires_at:``}),[U,W]=(0,a.useState)(null),[G,K]=(0,a.useState)(null),[Ue,q]=(0,a.useState)(!1),[J,We]=(0,a.useState)(``),[Ge,Ke]=(0,a.useState)(``),[Y,qe]=(0,a.useState)(``),[Je,Ye]=(0,a.useState)(``),[Xe,Ze]=(0,a.useState)([]),[Qe,$e]=(0,a.useState)(!1),[et,tt]=(0,a.useState)(null),[X,nt]=(0,a.useState)({invoice:!1,users:!0,guarantees:!0,payment:!0}),rt=(0,a.useMemo)(()=>me(),[]),it=(0,a.useMemo)(()=>M?.city?pe(M.city):[],[M?.city]),at=(0,a.useMemo)(()=>M?.invoice_city?pe(M.invoice_city):[],[M?.invoice_city]),ot=(0,a.useMemo)(()=>j?j.users.filter(e=>{let t=[e.name,e.email,e.phone||``].join(` `).toLowerCase().includes(F.toLowerCase()),n=I===`all`?!0:I===`verified`?e.email_verified:!e.email_verified;return t&&n}):[],[j,F,I]),st=(0,a.useMemo)(()=>{let e=j?.supplier.logo_url;return e?e.startsWith(`http`)?e:`https://buyerasistans.com.tr${e}`:null},[j?.supplier.logo_url]),Z=(0,a.useMemo)(()=>j&&(j.users.find(e=>e.is_default)||j.users[0])||null,[j]),ct=(0,a.useMemo)(()=>{if(!j)return{label:`Durum bilinmiyor`,tone:`neutral`};let e=j.users.some(e=>!!e.password_set),t=j.users.some(e=>!!e.email_verified);return e&&t?{label:`Profil erişimi aktif`,tone:`success`}:j.users_count>0?{label:`Davet gönderildi, kayıt bekleniyor`,tone:`warning`}:{label:`Henüz davetli yetkili yok`,tone:`neutral`}},[j]),lt=(e,t,n)=>{let r=[e,t,n,`Türkiye`].filter(Boolean).join(`, `);return`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r)}`},ut=(e,t,n)=>{let r=[e,t,n,`Türkiye`].filter(Boolean).join(`, `);return`https://maps.google.com/maps?output=embed&t=k&q=${encodeURIComponent(r)}`},Q=e=>{nt(t=>({...t,[e]:!t[e]}))},$=(0,a.useCallback)(async()=>{if(!Number.isFinite(n)||n<=0){k(`Geçersiz tedarikçi kimliği`),O(!1);return}try{O(!0),k(null);let e=await ae(n);Ne(e),N(Ee(e.supplier)),B({})}catch(e){k(e instanceof Error?e.message:`Detay yüklenemedi`)}finally{O(!1)}},[n]);(0,a.useEffect)(()=>{$()},[$]);async function dt(){if(M)try{Ae(!0),k(null),A(null),await ne(n,{...M,preferred_check_term:M.accepts_checks?M.preferred_check_term:``}),A(`Tedarikçi bilgileri güncellendi`),await $()}catch(e){k(e instanceof Error?e.message:`Kaydetme hatası`)}finally{Ae(!1)}}function ft(e){B(t=>({...t,[e.id]:{name:e.name,email:e.email,phone:e.phone||``}}))}function pt(e){B(t=>{let n={...t};return delete n[e],n})}async function mt(e){let t=He[e];if(t)try{await re(n,e,t),A(`Yetkili güncellendi`),pt(e),await $()}catch(e){k(e instanceof Error?e.message:`Yetkili güncellenemedi`)}}async function ht(){if(!R.name||!R.email){k(`Kullanıcı adı ve e-posta zorunludur`);return}try{await ce(n,R),z({name:``,email:``,phone:``}),L(!1),A(`Kullanıcı eklendi ve davet e-postası gönderildi`),await $()}catch(e){k(e instanceof Error?e.message:`Kullanıcı eklenemedi`)}}async function gt(e){if(window.confirm(`Teminat kaydını silmek istiyor musunuz?`))try{await ie(n,e),A(`Teminat silindi`),await $()}catch(e){k(e instanceof Error?e.message:`Teminat silinemedi`)}}async function _t(){if(!V.title||!V.guarantee_type){k(`Teminat başlığı ve türü zorunludur`);return}try{await se(n,{title:V.title,guarantee_type:V.guarantee_type,amount:V.amount?Number(V.amount):null,currency:V.currency,issued_at:V.issued_at||null,expires_at:V.expires_at||null}),H({title:``,guarantee_type:``,amount:``,currency:`TRY`,issued_at:``,expires_at:``}),A(`Teminat eklendi`),await $()}catch(e){k(e instanceof Error?e.message:`Teminat eklenemedi`)}}async function vt(){if(!(!U||!G))try{await te(n,U,{title:G.title,guarantee_type:G.guarantee_type,amount:G.amount?Number(G.amount):null,currency:G.currency,issued_at:G.issued_at||null,expires_at:G.expires_at||null,status:G.status}),W(null),K(null),A(`Teminat güncellendi`),await $()}catch(e){k(e instanceof Error?e.message:`Teminat güncellenemedi`)}}async function yt(e){if(window.confirm(`Bu yetkiliyi silmek istiyor musunuz?`))try{await ue(n,e),A(`Yetkili silindi`),await $()}catch(e){k(e instanceof Error?e.message:`Yetkili silinemedi`)}}async function bt(e){try{await le(n,e),A(`Varsayılan yetkili güncellendi`),await $()}catch(e){k(e instanceof Error?e.message:`Varsayılan yetkili güncellenemedi`)}}async function xt(t){if(e)try{tt(t.id);let n=await oe(Number(e),t.id);n.magic_link_sent?(A(`Magic link tekrar gönderildi: ${t.email}`),k(null)):k(n.message||`Magic link yenilendi ancak e-posta gönderilemedi`),await $()}catch(e){k(e instanceof Error?e.message:`Magic link tekrar gönderilemedi`)}finally{tt(null)}}function St(){if(!M)return;let e=lt(M.address,M.address_district,M.city),t=Z?`Yetkili: ${Z.name}\nTelefon: ${Z.phone||`-`}\nE-posta: ${Z.email}`:`Yetkili: -`,n=[M.company_name||`-`,M.address||`-`,`${M.city||`-`}/${M.address_district||`-`}`,``,t,`Konum: ${e}`].join(`
`);window.open(`https://wa.me/?text=${encodeURIComponent(n)}`,`_blank`,`noopener,noreferrer`)}function Ct(e){let t=D(e);t&&(window.location.href=`tel:+90${t}`)}function wt(e){let t=D(e);t&&window.open(`https://wa.me/90${t}`,`_blank`,`noopener,noreferrer`)}function Tt(e){e&&(We(e),Ke(``),qe(`${M?.company_name||`Tedarikçi`} - Bilgilendirme`),Ye(`Merhaba,

`),Ze([]),q(!0))}async function Et(){if(!J||!Y){k(`E-posta alıcısı ve konu zorunludur`);return}try{$e(!0),await de(n,{to_email:J,subject:Y,body:Je,cc:Ge||void 0,attachments:Xe}),A(`E-posta gönderildi`),q(!1)}catch(e){let t=e?.response?.data?.detail;k(t||`E-posta gönderilemedi`)}finally{$e(!1)}}return i?(0,o.jsx)(s,{children:`Yükleniyor...`}):!j||!M?(0,o.jsx)(s,{children:`Veri bulunamadı.`}):(0,o.jsxs)(s,{children:[je&&(0,o.jsx)(_e,{$error:!0,children:je}),Me&&(0,o.jsx)(_e,{children:Me}),(0,o.jsxs)(l,{children:[(0,o.jsxs)(`h2`,{children:[`Tedarikçiyi Görüntüle: `,j.supplier.company_name]}),(0,o.jsxs)(`div`,{style:{display:`flex`,gap:8},children:[(0,o.jsx)(g,{onClick:()=>t(`/admin?tab=suppliers`),children:`Tedarikçilere Dön`}),(0,o.jsx)(g,{onClick:()=>t(`/admin`),children:`Panele Dön`})]})]}),(0,o.jsxs)(c,{children:[(0,o.jsxs)(l,{children:[(0,o.jsx)(`h3`,{children:`Genel Bilgiler`}),(0,o.jsx)(h,{disabled:ke,onClick:dt,children:ke?`Kaydediliyor...`:`Kaydet`})]}),(0,o.jsxs)(`div`,{style:{display:`flex`,gap:16,marginBottom:12,flexWrap:`wrap`},children:[(0,o.jsx)(Ce,{children:st?(0,o.jsx)(`img`,{src:st,alt:`Firma logosu`}):(0,o.jsx)(`span`,{style:{color:`#94a3b8`},children:`Logo Yok`})}),(0,o.jsxs)(`div`,{style:{display:`grid`,gap:8,alignContent:`start`},children:[(0,o.jsx)(`div`,{style:{fontWeight:700,color:`#1e293b`},children:M.company_name||`-`}),(0,o.jsx)(`div`,{style:{color:`#64748b`,fontSize:13},children:`Logoyu tedarikçi kendi profilinden günceller.`}),(0,o.jsxs)(`div`,{style:{display:`flex`,gap:8,flexWrap:`wrap`},children:[(0,o.jsx)(v,{$tone:ct.tone,children:ct.label}),(0,o.jsx)(v,{$tone:j.supplier.address_district||j.supplier.city?`info`:`neutral`,children:j.supplier.address_district||j.supplier.city?`Konum: ${[j.supplier.city,j.supplier.address_district].filter(Boolean).join(` / `)}`:`Konum bilgisi davet seviyesinde`}),(0,o.jsx)(v,{$tone:j.supplier.partner_category_tags.length>0?`info`:`neutral`,children:j.supplier.partner_category_tags.length>0?`${j.supplier.partner_category_tags.length} partner kategorisi`:`Partner kategorisi bekleniyor`})]}),(0,o.jsxs)(T,{children:[(0,o.jsx)(_,{type:`button`,onClick:()=>t(`/admin/suppliers/${n}/workspace?tab=certificates`),children:`Sertifika Yükle`}),(0,o.jsx)(_,{type:`button`,onClick:()=>t(`/admin/suppliers/${n}/workspace?tab=company_docs`),children:`Şirket Evrakları`}),(0,o.jsx)(_,{type:`button`,onClick:()=>t(`/admin/suppliers/${n}/workspace?tab=personnel_docs`),children:`Personel Evrakları`}),(0,o.jsx)(_,{type:`button`,onClick:()=>t(`/admin/suppliers/${n}/finance`),children:`Finans Modülü`}),(0,o.jsx)(_,{type:`button`,onClick:()=>t(`/admin/suppliers/${n}/workspace?tab=guarantee_docs`),children:`Alınan Teminatlar`})]})]})]}),(0,o.jsxs)(u,{children:[(0,o.jsxs)(d,{children:[`Firma Adı`,(0,o.jsx)(f,{value:M.company_name,onChange:e=>N({...M,company_name:e.target.value})})]}),(0,o.jsxs)(d,{children:[`Ünvan`,(0,o.jsx)(f,{value:M.company_title,onChange:e=>N({...M,company_title:e.target.value})})]}),(0,o.jsxs)(d,{children:[`Telefon`,(0,o.jsx)(f,{value:M.phone,onChange:e=>N({...M,phone:e.target.value})}),(0,o.jsxs)(T,{children:[(0,o.jsx)(xe,{type:`button`,onClick:()=>Ct(M.phone),children:`Ara`}),(0,o.jsx)(Se,{type:`button`,disabled:!Oe(M.phone),onClick:()=>wt(M.phone),children:`WhatsApp`})]})]}),(0,o.jsxs)(d,{children:[`E-posta`,(0,o.jsx)(f,{value:M.email,onChange:e=>N({...M,email:e.target.value})}),(0,o.jsx)(T,{children:(0,o.jsx)(C,{type:`button`,onClick:()=>Tt(M.email),children:`Mail Gönder`})})]}),(0,o.jsxs)(d,{children:[`Web Sitesi`,(0,o.jsx)(f,{value:M.website,onChange:e=>N({...M,website:e.target.value})})]}),(0,o.jsxs)(d,{children:[`Stratejik Partner Kategorileri`,(0,o.jsx)(_,{type:`button`,onClick:()=>P(!0),children:`Kategori Seç`}),(0,o.jsx)(`div`,{style:{display:`flex`,flexWrap:`wrap`,gap:8,marginTop:8},children:M.partner_category_tags.length>0?M.partner_category_tags.map(e=>(0,o.jsx)(`span`,{style:{padding:`6px 10px`,borderRadius:999,background:`#eff6ff`,color:`#1d4ed8`,fontWeight:700,fontSize:12},children:e},e)):(0,o.jsx)(`span`,{style:{color:`#94a3b8`,fontSize:12},children:`Henüz partner kategorisi atanmadı`})})]}),(0,o.jsxs)(d,{children:[`Tedarikçinin Kendi Kategorileri`,(0,o.jsx)(`div`,{style:{display:`flex`,flexWrap:`wrap`,gap:8,marginTop:8},children:j.supplier.category_tags.length>0?j.supplier.category_tags.map(e=>(0,o.jsx)(`span`,{style:{padding:`6px 10px`,borderRadius:999,background:`#ecfeff`,color:`#0f766e`,fontWeight:700,fontSize:12},children:e},e)):(0,o.jsx)(`span`,{style:{color:`#94a3b8`,fontSize:12},children:`Tedarikçi kendi görünürlük kategorilerini henüz eklemedi`})})]}),(0,o.jsxs)(d,{style:{gridColumn:`1 / -1`},children:[`Adres`,(0,o.jsx)(m,{rows:2,value:M.address,onChange:e=>N({...M,address:e.target.value})})]}),(0,o.jsxs)(d,{children:[`Şehir`,(0,o.jsxs)(p,{value:M.city,onChange:e=>N({...M,city:e.target.value,address_district:``}),children:[(0,o.jsx)(`option`,{value:``,children:`Seçiniz`}),rt.map(e=>(0,o.jsx)(`option`,{value:e,children:e},e))]})]}),(0,o.jsxs)(d,{children:[`İlçe`,(0,o.jsxs)(p,{value:M.address_district,onChange:e=>N({...M,address_district:e.target.value}),disabled:!M.city,children:[(0,o.jsx)(`option`,{value:``,children:`Seçiniz`}),it.map(e=>(0,o.jsx)(`option`,{value:e,children:e},e))]})]}),(0,o.jsxs)(d,{children:[`Posta Kodu`,(0,o.jsx)(f,{value:M.postal_code,onChange:e=>N({...M,postal_code:e.target.value})})]}),(0,o.jsxs)(d,{style:{gridColumn:`1 / -1`},children:[`Notlar`,(0,o.jsx)(m,{rows:3,value:M.notes,onChange:e=>N({...M,notes:e.target.value})})]})]}),(0,o.jsxs)(`div`,{style:{display:`flex`,gap:8,marginTop:10,flexWrap:`wrap`},children:[(0,o.jsx)(_,{type:`button`,onClick:()=>Fe(e=>!e),children:Pe?`Firma Konumunu Gizle`:`Firma Konumunu Aç`}),(0,o.jsx)(_,{type:`button`,onClick:St,children:`WhatsApp Paylaş`})]}),Pe&&(0,o.jsx)(`div`,{style:{marginTop:10,border:`1px solid #dbe3ee`,borderRadius:8,overflow:`hidden`},children:(0,o.jsx)(`iframe`,{title:`Firma konumu`,src:ut(M.address,M.address_district,M.city),width:`100%`,height:`280`,style:{border:0},loading:`lazy`})})]}),(0,o.jsx)(he,{isOpen:Re,title:`Stratejik Partner Kategorileri`,subtitle:`Bu kategoriler tedarikçiyi partner panelinde hızlı eşleme ve listeleme için etiketler.`,availableOptions:fe,value:M.partner_category_tags,maxSelectionCount:5,onClose:()=>P(!1),onSave:e=>{N(t=>t&&{...t,partner_category_tags:e,category:e[0]||t.category}),P(!1)}}),(0,o.jsxs)(c,{children:[(0,o.jsxs)(y,{onClick:()=>Q(`users`),children:[(0,o.jsxs)(`h3`,{children:[`Yetkili Kullanıcılar (`,j.users_count,`)`]}),(0,o.jsx)(b,{children:E(X.users)})]}),X.users&&(0,o.jsxs)(o.Fragment,{children:[(0,o.jsxs)(u,{children:[(0,o.jsxs)(d,{children:[`Arama`,(0,o.jsx)(f,{value:F,onChange:e=>ze(e.target.value),placeholder:`Ad, e-posta, telefon`})]}),(0,o.jsxs)(d,{children:[`Durum Filtresi`,(0,o.jsxs)(p,{value:I,onChange:e=>Be(e.target.value),children:[(0,o.jsx)(`option`,{value:`all`,children:`Tümü`}),(0,o.jsx)(`option`,{value:`verified`,children:`Doğrulanmış`}),(0,o.jsx)(`option`,{value:`unverified`,children:`Bekleyen`})]})]})]}),(0,o.jsx)(`div`,{style:{marginTop:8},children:(0,o.jsx)(h,{type:`button`,onClick:()=>L(!0),children:`+ Kullanıcı Ekle`})}),(0,o.jsxs)(ve,{children:[(0,o.jsxs)(ye,{children:[(0,o.jsx)(`div`,{children:`Ad Soyad`}),(0,o.jsx)(`div`,{children:`Telefon`}),(0,o.jsx)(`div`,{children:`E-posta`}),(0,o.jsx)(`div`,{style:{textAlign:`right`},children:`İşlemler`})]}),ot.map(e=>{let t=He[e.id];return(0,o.jsxs)(be,{children:[(0,o.jsx)(x,{children:t?(0,o.jsx)(f,{value:t.name,onChange:n=>B(r=>({...r,[e.id]:{...t,name:n.target.value}}))}):(0,o.jsxs)(`strong`,{children:[e.name,e.is_default?` (Varsayılan)`:``]})}),(0,o.jsx)(x,{children:t?(0,o.jsx)(f,{value:t.phone,onChange:n=>B(r=>({...r,[e.id]:{...t,phone:n.target.value}}))}):(0,o.jsxs)(o.Fragment,{children:[e.phone||`-`,(0,o.jsxs)(T,{children:[(0,o.jsx)(xe,{type:`button`,onClick:()=>Ct(e.phone),children:`Ara`}),(0,o.jsx)(Se,{type:`button`,disabled:!Oe(e.phone),onClick:()=>wt(e.phone),children:`WhatsApp`})]})]})}),(0,o.jsx)(x,{children:t?(0,o.jsx)(f,{type:`email`,value:t.email,onChange:n=>B(r=>({...r,[e.id]:{...t,email:n.target.value}}))}):(0,o.jsxs)(o.Fragment,{children:[e.email,(0,o.jsxs)(`div`,{style:{display:`flex`,gap:6,flexWrap:`wrap`,marginTop:4},children:[(0,o.jsx)(v,{$tone:e.password_set?`success`:`warning`,children:e.password_set?`Kayıt tamamlandı`:`Magic link bekleniyor`}),(0,o.jsx)(v,{$tone:e.email_verified?`success`:`neutral`,children:e.email_verified?`E-posta onaylı`:`E-posta onayı bekliyor`})]}),(0,o.jsxs)(T,{children:[(0,o.jsx)(C,{type:`button`,onClick:()=>Tt(e.email),children:`Mail Gönder`}),(!e.password_set||!e.email_verified)&&(0,o.jsx)(C,{type:`button`,onClick:()=>void xt(e),disabled:et===e.id,children:et===e.id?`Gönderiliyor...`:`Magic Link Tekrar Gönder`})]})]})}),(0,o.jsx)(`div`,{style:{display:`flex`,gap:6,justifyContent:`flex-end`,flexWrap:`wrap`},children:t?(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(S,{type:`button`,onClick:()=>void mt(e.id),children:`Kaydet`}),(0,o.jsx)(S,{type:`button`,onClick:()=>pt(e.id),children:`Vazgeç`})]}):(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(S,{type:`button`,onClick:()=>ft(e),children:`Düzenle`}),!e.is_default&&(0,o.jsx)(S,{type:`button`,onClick:()=>void bt(e.id),children:`Varsayılan Yap`}),!e.is_default&&(0,o.jsx)(S,{type:`button`,onClick:()=>void yt(e.id),children:`Sil`})]})})]},e.id)})]})]})]}),(0,o.jsxs)(c,{children:[(0,o.jsxs)(y,{onClick:()=>Q(`invoice`),children:[(0,o.jsx)(`h3`,{children:`Fatura Bilgileri`}),(0,o.jsx)(b,{children:E(X.invoice)})]}),X.invoice&&(0,o.jsxs)(o.Fragment,{children:[(0,o.jsxs)(u,{children:[(0,o.jsxs)(d,{children:[`Fatura Ünvanı`,(0,o.jsx)(f,{value:M.invoice_name,onChange:e=>N({...M,invoice_name:e.target.value})})]}),(0,o.jsxs)(d,{children:[`Vergi Dairesi`,(0,o.jsx)(f,{value:M.tax_office,onChange:e=>N({...M,tax_office:e.target.value})})]}),(0,o.jsxs)(d,{children:[`Vergi No`,(0,o.jsx)(f,{value:M.tax_number,onChange:e=>N({...M,tax_number:e.target.value})})]}),(0,o.jsxs)(d,{children:[`Sicil No`,(0,o.jsx)(f,{value:M.registration_number,onChange:e=>N({...M,registration_number:e.target.value})})]}),(0,o.jsxs)(d,{style:{gridColumn:`1 / -1`},children:[`Fatura Adresi`,(0,o.jsx)(m,{rows:2,value:M.invoice_address,onChange:e=>N({...M,invoice_address:e.target.value})})]}),(0,o.jsxs)(d,{children:[`Fatura Şehir`,(0,o.jsxs)(p,{value:M.invoice_city,onChange:e=>N({...M,invoice_city:e.target.value,invoice_district:``}),children:[(0,o.jsx)(`option`,{value:``,children:`Seçiniz`}),rt.map(e=>(0,o.jsx)(`option`,{value:e,children:e},e))]})]}),(0,o.jsxs)(d,{children:[`Fatura İlçe`,(0,o.jsxs)(p,{value:M.invoice_district,onChange:e=>N({...M,invoice_district:e.target.value}),disabled:!M.invoice_city,children:[(0,o.jsx)(`option`,{value:``,children:`Seçiniz`}),at.map(e=>(0,o.jsx)(`option`,{value:e,children:e},e))]})]}),(0,o.jsxs)(d,{children:[`Fatura Posta Kodu`,(0,o.jsx)(f,{value:M.invoice_postal_code,onChange:e=>N({...M,invoice_postal_code:e.target.value})})]})]}),(0,o.jsx)(`div`,{style:{marginTop:10},children:(0,o.jsx)(_,{type:`button`,onClick:()=>Le(e=>!e),children:Ie?`Fatura Konumunu Gizle`:`Fatura Konumunu Aç`})}),Ie&&(0,o.jsx)(`div`,{style:{marginTop:10,border:`1px solid #dbe3ee`,borderRadius:8,overflow:`hidden`},children:(0,o.jsx)(`iframe`,{title:`Fatura konumu`,src:ut(M.invoice_address,M.invoice_district,M.invoice_city),width:`100%`,height:`280`,style:{border:0},loading:`lazy`})})]})]}),(0,o.jsxs)(c,{children:[(0,o.jsxs)(y,{onClick:()=>Q(`guarantees`),children:[(0,o.jsx)(`h3`,{children:`Teminatlar`}),(0,o.jsx)(b,{children:E(X.guarantees)})]}),X.guarantees&&(0,o.jsxs)(o.Fragment,{children:[(0,o.jsxs)(u,{children:[(0,o.jsxs)(d,{children:[`Başlık`,(0,o.jsx)(f,{value:V.title,onChange:e=>H({...V,title:e.target.value})})]}),(0,o.jsxs)(d,{children:[`Tür`,(0,o.jsx)(f,{value:V.guarantee_type,onChange:e=>H({...V,guarantee_type:e.target.value})})]}),(0,o.jsxs)(d,{children:[`Tutar`,(0,o.jsx)(f,{value:V.amount,onChange:e=>H({...V,amount:e.target.value})})]}),(0,o.jsxs)(d,{children:[`Para Birimi`,(0,o.jsx)(f,{value:V.currency,onChange:e=>H({...V,currency:e.target.value.toUpperCase()})})]}),(0,o.jsxs)(d,{children:[`Veriliş Tarihi`,(0,o.jsx)(f,{type:`date`,value:V.issued_at,onChange:e=>H({...V,issued_at:e.target.value})})]}),(0,o.jsxs)(d,{children:[`Bitiş Tarihi`,(0,o.jsx)(f,{type:`date`,value:V.expires_at,onChange:e=>H({...V,expires_at:e.target.value})})]})]}),(0,o.jsx)(`div`,{style:{marginTop:8},children:(0,o.jsx)(h,{type:`button`,onClick:()=>void _t(),children:`Teminat Ekle`})}),(0,o.jsx)(`div`,{style:{marginTop:12,display:`grid`,gap:8},children:j.guarantees.map(e=>(0,o.jsx)(c,{children:(0,o.jsxs)(l,{children:[(0,o.jsxs)(`div`,{children:[(0,o.jsx)(`strong`,{children:e.title}),(0,o.jsxs)(`div`,{children:[e.guarantee_type,` | `,e.amount??`-`,` `,e.currency||`TRY`]}),(0,o.jsxs)(`div`,{children:[`Durum: `,e.status,` | Bitiş: `,e.expires_at||`-`]})]}),(0,o.jsxs)(`div`,{style:{display:`flex`,gap:8},children:[(0,o.jsx)(g,{type:`button`,onClick:()=>{W(e.id),K({title:e.title,guarantee_type:e.guarantee_type,amount:e.amount==null?``:String(e.amount),currency:e.currency||`TRY`,issued_at:De(e.issued_at),expires_at:De(e.expires_at),status:e.status||`active`})},children:`Düzenle`}),(0,o.jsx)(ge,{type:`button`,onClick:()=>void gt(e.id),children:`Sil`})]})]})},e.id))})]})]}),(0,o.jsxs)(c,{children:[(0,o.jsxs)(y,{onClick:()=>Q(`payment`),children:[(0,o.jsx)(`h3`,{children:`Ödeme ve Çek Ayarları`}),(0,o.jsx)(b,{children:E(X.payment)})]}),X.payment&&(0,o.jsxs)(o.Fragment,{children:[(0,o.jsxs)(u,{children:[(0,o.jsxs)(d,{children:[`Çek Kabulü`,(0,o.jsxs)(p,{value:M.accepts_checks?`yes`:`no`,onChange:e=>N({...M,accepts_checks:e.target.value===`yes`}),children:[(0,o.jsx)(`option`,{value:`yes`,children:`Evet`}),(0,o.jsx)(`option`,{value:`no`,children:`Hayır`})]})]}),(0,o.jsxs)(d,{children:[`Tercih Edilen Çek Vadesi`,(0,o.jsx)(f,{value:M.preferred_check_term,onChange:e=>N({...M,preferred_check_term:e.target.value}),disabled:!M.accepts_checks})]})]}),(0,o.jsxs)(`div`,{style:{marginTop:12,display:`grid`,gap:8},children:[M.payment_accounts.map((e,t)=>(0,o.jsx)(c,{children:(0,o.jsxs)(u,{children:[(0,o.jsxs)(d,{children:[`Banka`,(0,o.jsxs)(p,{value:e.bank_key||``,onChange:e=>{let n=Te.find(t=>t.key===e.target.value),r=[...M.payment_accounts];r[t]={...r[t],bank_key:n?.key||null,bank_name:n?.name||``},N({...M,payment_accounts:r})},children:[(0,o.jsx)(`option`,{value:``,children:`Seçiniz`}),Te.map(e=>(0,o.jsx)(`option`,{value:e.key,children:e.name},e.key))]})]}),(0,o.jsxs)(d,{children:[`IBAN`,(0,o.jsx)(f,{value:e.iban,onChange:e=>{let n=[...M.payment_accounts];n[t]={...n[t],iban:e.target.value},N({...M,payment_accounts:n})}})]}),(0,o.jsxs)(d,{children:[`Hesap Türü`,(0,o.jsxs)(p,{value:e.account_type,onChange:e=>{let n=[...M.payment_accounts];n[t]={...n[t],account_type:e.target.value},N({...M,payment_accounts:n})},children:[(0,o.jsx)(`option`,{value:`tl`,children:`TL`}),(0,o.jsx)(`option`,{value:`doviz`,children:`Döviz`})]})]}),(0,o.jsx)(ge,{type:`button`,onClick:()=>N({...M,payment_accounts:M.payment_accounts.filter((e,n)=>n!==t)}),children:`Hesabı Sil`})]})},`${e.bank_name}-${t}`)),(0,o.jsx)(g,{type:`button`,onClick:()=>N({...M,payment_accounts:[...M.payment_accounts,{bank_name:``,iban:``,account_type:`tl`,bank_key:null}]}),children:`+ Hesap Ekle`})]})]})]}),Ve&&(0,o.jsx)(w,{onClick:()=>L(!1),children:(0,o.jsxs)(we,{onClick:e=>e.stopPropagation(),children:[(0,o.jsx)(`h3`,{children:`Yeni Yetkili Ekle`}),(0,o.jsxs)(u,{children:[(0,o.jsxs)(d,{children:[`Ad Soyad`,(0,o.jsx)(f,{value:R.name,onChange:e=>z({...R,name:e.target.value})})]}),(0,o.jsxs)(d,{children:[`E-posta`,(0,o.jsx)(f,{type:`email`,value:R.email,onChange:e=>z({...R,email:e.target.value})})]}),(0,o.jsxs)(d,{children:[`Telefon`,(0,o.jsx)(f,{value:R.phone,onChange:e=>z({...R,phone:e.target.value})})]})]}),(0,o.jsxs)(`div`,{style:{marginTop:12,display:`flex`,gap:8,justifyContent:`flex-end`},children:[(0,o.jsx)(g,{type:`button`,onClick:()=>L(!1),children:`İptal`}),(0,o.jsx)(h,{type:`button`,onClick:()=>void ht(),children:`Kullanıcı Ekle`})]})]})}),U&&G&&(0,o.jsx)(w,{onClick:()=>{W(null),K(null)},children:(0,o.jsxs)(we,{onClick:e=>e.stopPropagation(),children:[(0,o.jsx)(`h3`,{children:`Teminat Düzenle`}),(0,o.jsxs)(u,{children:[(0,o.jsxs)(d,{children:[`Başlık`,(0,o.jsx)(f,{value:G.title,onChange:e=>K({...G,title:e.target.value})})]}),(0,o.jsxs)(d,{children:[`Tür`,(0,o.jsx)(f,{value:G.guarantee_type,onChange:e=>K({...G,guarantee_type:e.target.value})})]}),(0,o.jsxs)(d,{children:[`Tutar`,(0,o.jsx)(f,{value:G.amount,onChange:e=>K({...G,amount:e.target.value})})]}),(0,o.jsxs)(d,{children:[`Para Birimi`,(0,o.jsx)(f,{value:G.currency,onChange:e=>K({...G,currency:e.target.value.toUpperCase()})})]}),(0,o.jsxs)(d,{children:[`Veriliş Tarihi`,(0,o.jsx)(f,{type:`date`,value:G.issued_at,onChange:e=>K({...G,issued_at:e.target.value})})]}),(0,o.jsxs)(d,{children:[`Bitiş Tarihi`,(0,o.jsx)(f,{type:`date`,value:G.expires_at,onChange:e=>K({...G,expires_at:e.target.value})})]}),(0,o.jsxs)(d,{children:[`Durum`,(0,o.jsxs)(p,{value:G.status,onChange:e=>K({...G,status:e.target.value}),children:[(0,o.jsx)(`option`,{value:`active`,children:`active`}),(0,o.jsx)(`option`,{value:`expired`,children:`expired`}),(0,o.jsx)(`option`,{value:`cancelled`,children:`cancelled`})]})]})]}),(0,o.jsxs)(`div`,{style:{marginTop:12,display:`flex`,gap:8,justifyContent:`flex-end`},children:[(0,o.jsx)(g,{type:`button`,onClick:()=>{W(null),K(null)},children:`İptal`}),(0,o.jsx)(h,{type:`button`,onClick:()=>void vt(),children:`Kaydet`})]})]})}),Ue&&(0,o.jsx)(w,{onClick:()=>q(!1),children:(0,o.jsxs)(we,{onClick:e=>e.stopPropagation(),children:[(0,o.jsx)(`h3`,{children:`E-posta Gönder`}),(0,o.jsxs)(u,{children:[(0,o.jsxs)(d,{children:[`Alıcı (To)`,(0,o.jsx)(f,{type:`email`,value:J,onChange:e=>We(e.target.value)})]}),(0,o.jsxs)(d,{children:[`CC (virgülle ayırın)`,(0,o.jsx)(f,{value:Ge,onChange:e=>Ke(e.target.value)})]}),(0,o.jsxs)(d,{style:{gridColumn:`1 / -1`},children:[`Konu`,(0,o.jsx)(f,{value:Y,onChange:e=>qe(e.target.value)})]}),(0,o.jsxs)(d,{style:{gridColumn:`1 / -1`},children:[`Mesaj`,(0,o.jsx)(m,{rows:7,value:Je,onChange:e=>Ye(e.target.value)})]}),(0,o.jsxs)(d,{style:{gridColumn:`1 / -1`},children:[`Ek Dosyalar`,(0,o.jsx)(f,{type:`file`,multiple:!0,onChange:e=>Ze(Array.from(e.target.files||[]))}),Xe.length>0&&(0,o.jsx)(`div`,{style:{marginTop:6,fontSize:12,color:`#334155`},children:Xe.map(e=>e.name).join(`, `)})]})]}),(0,o.jsxs)(`div`,{style:{marginTop:12,display:`flex`,gap:8,justifyContent:`flex-end`},children:[(0,o.jsx)(g,{type:`button`,onClick:()=>q(!1),children:`İptal`}),(0,o.jsx)(h,{type:`button`,disabled:Qe,onClick:()=>void Et(),children:Qe?`Gönderiliyor...`:`Gönder`})]})]})})]})}export{O as default};