import{r as e}from"./rolldown-runtime-Dw2cE7zH.js";import{$ as t,B as n,J as r,q as i}from"./react-B1lg9EFp.js";import{i as a}from"./http-2VXd4Qd7.js";import{t as o}from"./vendor-CPSNvO84.js";import{d as s,f as c,m as l,p as u,x as d}from"./supplier-profile.service-Duxtoz2X.js";var f=e(t(),1),p=n(),m=o.div`
  padding: 20px;
`,h=o.div`
  margin-bottom: 20px;

  h2 {
    margin: 0;
    color: #1f2937;
  }

  p {
    color: #6b7280;
    margin: 5px 0 0 0;
  }
`,g=o.div`
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  overflow: hidden;
`,_=o.table`
  width: 100%;
  min-width: 1040px;
  border-collapse: collapse;
  table-layout: fixed;
  font-variant-numeric: tabular-nums;

  th, td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: top;
    word-break: normal;
  }

  th {
    background-color: #f3f4f6;
    font-weight: 600;
  }

  tr:hover {
    background-color: #f9fafb;
  }
`,v=o.div`
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 4px;
`,y=o.button`
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  background-color: ${e=>{switch(e.variant){case`success`:return`#10b981`;case`secondary`:return`#6b7280`;default:return`#3b82f6`}}};
  color: white;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    background-color: #9ca3af;
    cursor: not-allowed;
  }
`,b=o.span`
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  background-color: ${e=>{switch(e.status){case`tasarı`:return`#f3f4f6`;case`gönderilen`:return`#fef3c7`;case`revize_edildi`:return`#ffedd5`;case`yanıtlandı`:return`#d1fae5`;case`reddedildi`:case`kapatildi`:case`kapatıldı`:case`kapatildi_yuksek_fiyat`:case`kapatıldı_yüksek_fiyat`:return`#fee2e2`;default:return`#f3f4f6`}}};
  color: ${e=>{switch(e.status){case`tasarı`:return`#374151`;case`gönderilen`:return`#92400e`;case`revize_edildi`:return`#9a3412`;case`yanıtlandı`:return`#065f46`;case`reddedildi`:case`kapatildi`:case`kapatıldı`:case`kapatildi_yuksek_fiyat`:case`kapatıldı_yüksek_fiyat`:return`#991b1b`;default:return`#374151`}}};
`,x=o.form`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin: 15px 0;
`,S=o.div`
  display: flex;
  flex-direction: column;
`,C=o.label`
  margin-bottom: 5px;
  font-weight: 600;
  font-size: 13px;
`,w=o.input`
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
`,T=o.div`
  background-color: #fee2e2;
  color: #991b1b;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 15px;
`,ee=o.div`
  background-color: #d1fae5;
  color: #065f46;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 15px;
`,E=o.div`
  text-align: center;
  padding: 40px;
  color: #9ca3af;
`;function D({apiUrl:e,authToken:t}){let[n,r]=(0,f.useState)([]),[i,a]=(0,f.useState)(!1),[o,s]=(0,f.useState)(null),[c,l]=(0,f.useState)(null),[u,d]=(0,f.useState)(null),[D,O]=(0,f.useState)({}),[k,A]=(0,f.useState)(null),[te,j]=(0,f.useState)(null),[ne,re]=(0,f.useState)({}),[ie,M]=(0,f.useState)(null),[N,P]=(0,f.useState)(`pending`),[F,I]=(0,f.useState)(null),L=e=>{let t=String(e||`TRY`).toUpperCase();return t===`TL`||t===`TRL`?`TRY`:t===`USDT`?`USD`:t===`USD`||t===`EUR`?t:`TRY`},R=(e,t)=>{let n=L(t);return Number(e||0).toLocaleString(`tr-TR`,{style:`currency`,currency:n,minimumFractionDigits:2})},ae=e=>{let t=L(e);return t===`USD`?`$`:t===`EUR`?`€`:`₺`},oe=e=>{if(!e)return{note:``,currency:`TRY`};try{let t=JSON.parse(e);if(t&&typeof t==`object`)return{note:String(t.user_note??t.note??``),currency:L(String(t.currency??`TRY`))}}catch{}return{note:String(e),currency:`TRY`}},z=(e,t)=>JSON.stringify({user_note:String(e||``),currency:L(t)}),B=e=>{let t=L(e);return t===`TRY`?1:F?Number(t===`USD`?F.usd_try||0:F.eur_try||0):0},V=(e,t,n)=>{let r=Number(e||0),i=L(t),a=L(n);if(i===a)return r;let o=B(i),s=B(a);return o<=0||s<=0?0:r*o/s},H=e=>e.reduce((e,t)=>{let n=L(t.currency);return e[n]+=Number(t.total_price||0),e},{TRY:0,USD:0,EUR:0}),U=(e,t,n)=>{let r=L(t),i=e.reduce((e,t)=>e+V(Number(t.total_price||0),L(t.currency),r),0),a=i*Number(n||0)/100,o=i-a,s=H(e);return{total_amount:i,discount_amount:a,final_amount:o,currencyBuckets:s,totalTryEquivalent:s.TRY+s.USD*B(`USD`)+s.EUR*B(`EUR`)}},W=(e,t)=>{let n=L(t),r=Number(e||0);return n===`TRY`?r:F?n===`USD`?r*Number(F.usd_try||0):r*Number(F.eur_try||0):null},G=e=>String(e||``).toLowerCase(),K=e=>{let t=G(e.quote_status),n=G(e.status);return n===`revize_edildi`?!1:t===`approved`||t===`rejected`||n===`reddedildi`||n===`kapatildi`||n===`kapatıldı`||n===`kapatildi_yuksek_fiyat`||n===`kapatıldı_yüksek_fiyat`},q=e=>G(e.status)===`yanıtlandı`&&!K(e),J=e=>{if(K(e)||q(e))return!1;let t=G(e.status);return t===`gönderilen`||t===`tasarı`||t===`revize_edildi`||!t},se=e=>{let t=G(e.quote_status),n=G(e.status);return t===`approved`?n===`onaylandı`?`Teklifiniz onaylandı. Sözleşme süreci başlatılacaktır.`:n===`kapatildi_yuksek_fiyat`||n===`kapatıldı_yüksek_fiyat`||n===`kapatildi`||n===`kapatıldı`||e.selected_supplier_id&&e.selected_supplier_id!==e.supplier_id?`Fiyatınız yüksek bulunduğu için sözleşme başka tedarikçi ile yapıldı.`:e.selected_supplier_id&&e.selected_supplier_id===e.supplier_id?`Teklifiniz onaylandı. Sözleşme süreci başlatılacaktır.`:`Bu teklif yönetici tarafından onaylanarak kapatıldı.`:t===`rejected`?`İş kapsamı değişikliği veya red nedeniyle teklif kapatıldı.`:`Teklif kapatıldı.`},Y=n.filter(J),X=n.filter(q),Z=n.filter(K),Q=(e,t)=>t?!!ne[e]?.[t]:!1,ce=(e,t)=>{t&&re(n=>({...n,[e]:{...n[e]||{},[t]:!n[e]?.[t]}}))},$=(0,f.useCallback)(async()=>{try{a(!0),s(null);let n=await fetch(`${e}/api/v1/supplier-quotes/me`,{headers:{Authorization:`Bearer ${t}`}});if(!n.ok){let e=(await n.json().catch(()=>({})))?.detail||`Teklif listesi yüklenemedi`;throw Error(e)}r(await n.json())}catch(e){s(e instanceof Error?e.message:`Teklif listesi yüklenemedi`),console.error(`Error loading quotes:`,e)}finally{a(!1)}},[e,t]);(0,f.useEffect)(()=>{$()},[$]),(0,f.useEffect)(()=>{(async()=>{try{let n=await fetch(`${e}/api/v1/supplier-quotes/exchange-rates/tcmb`,{headers:{Authorization:`Bearer ${t}`}});if(!n.ok)return;let r=await n.json();I({usd_try:Number(r?.usd_try||0),eur_try:Number(r?.eur_try||0)})}catch{}})()},[e,t]);function le(e){D[e.id]||O(t=>({...t,[e.id]:{items:e.items.filter(e=>!e.is_group_header).map(e=>{let t=oe(e.notes);return{quote_item_id:e.quote_item_id,unit_price:e.supplier_unit_price||0,total_price:e.supplier_total_price||0,notes:t.note,currency:t.currency}}),total_amount:e.total_amount,discount_percent:0,discount_amount:0,final_amount:e.final_amount,currency:L(e.currency),payment_terms:e.payment_terms||``,delivery_time:e.delivery_time||0,warranty:e.warranty||``}}))}let ue=e=>{let t=D[e];if(!t)return null;let n=(t.items||[]).filter(e=>Number.isFinite(Number(e.quote_item_id))).map(e=>({quote_item_id:Number(e.quote_item_id),unit_price:Number.isFinite(Number(e.unit_price))?Number(e.unit_price):0,total_price:Number.isFinite(Number(e.total_price))?Number(e.total_price):0,notes:z(String(e.notes||``),L(e.currency))})),r=Number.isFinite(Number(t.total_amount))?Number(t.total_amount):0,i=Number.isFinite(Number(t.discount_percent))?Number(t.discount_percent):0,a=Number.isFinite(Number(t.discount_amount))?Number(t.discount_amount):0,o=Number.isFinite(Number(t.final_amount))?Number(t.final_amount):r,s=Number.isFinite(Number(t.delivery_time))?Math.max(0,Math.trunc(Number(t.delivery_time))):0;return{items:n,total_amount:r,discount_percent:i,discount_amount:a,final_amount:o,currency:L(t.currency),payment_terms:String(t.payment_terms||``),delivery_time:s,warranty:String(t.warranty||``)}};async function de(n){try{A(n);let r=ue(n);if(!r||r.items.length===0)throw Error(`Kaydetmek için en az bir geçerli kalem gereklidir`);let i=await fetch(`${e}/api/v1/supplier-quotes/${n}/draft-save`,{method:`POST`,headers:{Authorization:`Bearer ${t}`,"Content-Type":`application/json`},body:JSON.stringify(r)});if(!i.ok){let e=(await i.json().catch(()=>({}))).detail,t=typeof e==`string`?e:e?.message;throw Error(t||`Taslak kaydedilemedi`)}l(`✅ Taslak kaydedildi`),window.alert(`Teklif taslağı kaydedildi.`),setTimeout(()=>l(null),3e3)}catch(e){s(e instanceof Error?e.message:`Taslak kaydedilemedi`)}finally{A(null)}}async function fe(n){try{A(n);let r=ue(n);if(!r||r.items.length===0)throw Error(`Göndermek için en az bir geçerli kalem gereklidir`);let i=await fetch(`${e}/api/v1/supplier-quotes/${n}/submit`,{method:`POST`,headers:{Authorization:`Bearer ${t}`,"Content-Type":`application/json`},body:JSON.stringify(r)});if(!i.ok){let e=(await i.json().catch(()=>({}))).detail,t=typeof e==`string`?e:e?.message;throw Error(t||`Teklif gönderilemedi`)}l(`✅ Teklif başarıyla gönderildi. Yönetici panelinde ilgili teklif detayında görülebilir.`),window.alert(`Teklif gönderildi. Yönetici panelinde ilgili teklif detayında görüntülenebilir.`),d(null),$(),setTimeout(()=>l(null),3e3)}catch(e){s(e instanceof Error?e.message:`Teklif gönderilemedi`)}finally{A(null)}}return i?(0,p.jsx)(m,{children:`Yükleniyor...`}):(0,p.jsxs)(m,{children:[(0,p.jsxs)(h,{children:[(0,p.jsx)(`h2`,{children:`📬 Teklif Yanıtları`}),(0,p.jsx)(`p`,{children:`Gönderilen tekliflere fiyat girerek yanıt verin`})]}),o&&(0,p.jsxs)(T,{children:[`❌ `,o]}),c&&(0,p.jsx)(ee,{children:c}),N===`pending`&&Y.length>0?(0,p.jsx)(`div`,{style:{display:`grid`,gridTemplateColumns:`repeat(auto-fit, minmax(180px, 1fr))`,gap:12,marginBottom:16},children:[{label:`Platform Ağına Açık`,value:Y.filter(e=>e.platform_network_listing_enabled).length,bg:`#ecfdf5`,color:`#166534`},{label:`Premium Rozetli`,value:Y.filter(e=>e.premium_listing_enabled).length,bg:`#fff7ed`,color:`#b45309`},{label:`Sadece Ozel Havuz`,value:Y.filter(e=>!e.platform_network_listing_enabled).length,bg:`#eff6ff`,color:`#1d4ed8`},{label:`Yanit Verdikleriniz`,value:X.length,bg:`#f5f3ff`,color:`#6d28d9`}].map(e=>(0,p.jsxs)(`div`,{style:{borderRadius:12,border:`1px solid #e5e7eb`,background:e.bg,padding:12},children:[(0,p.jsx)(`div`,{style:{fontSize:11,fontWeight:800,textTransform:`uppercase`,letterSpacing:1.1,color:e.color},children:e.label}),(0,p.jsx)(`div`,{style:{marginTop:8,fontSize:24,fontWeight:900,color:e.color},children:e.value})]},e.label))}):null,(0,p.jsx)(`div`,{style:{display:`flex`,gap:`0`,marginBottom:`16px`,borderBottom:`2px solid #e5e7eb`},children:[{key:`pending`,label:`Bekleyen`,count:Y.length,activeColor:`#f59e0b`,activeBg:`#fffbeb`},{key:`submitted`,label:`Gönderilen`,count:X.length,activeColor:`#059669`,activeBg:`#f0fdf4`},{key:`closed`,label:`Kapanmış`,count:Z.length,activeColor:`#dc2626`,activeBg:`#fef2f2`}].map(e=>(0,p.jsxs)(`button`,{onClick:()=>P(e.key),style:{padding:`10px 18px`,border:`none`,borderBottom:N===e.key?`3px solid ${e.activeColor}`:`3px solid transparent`,background:N===e.key?e.activeBg:`transparent`,cursor:`pointer`,fontWeight:N===e.key?700:500,fontSize:`14px`,color:N===e.key?e.activeColor:`#6b7280`,transition:`all 0.15s`,display:`flex`,alignItems:`center`,gap:`6px`},children:[e.label,(0,p.jsx)(`span`,{style:{display:`inline-flex`,alignItems:`center`,justifyContent:`center`,minWidth:`20px`,height:`20px`,borderRadius:`999px`,padding:`0 6px`,fontSize:`11px`,fontWeight:700,background:N===e.key?e.activeColor:`#e5e7eb`,color:N===e.key?`#fff`:`#6b7280`},children:e.count})]},e.key))}),n.length===0?(0,p.jsx)(E,{children:(0,p.jsx)(`p`,{children:`Henüz teklif alınmamış veya tüm tekliflere yanıt verilmiş`})}):N===`pending`?Y.length===0?(0,p.jsx)(E,{children:(0,p.jsx)(`p`,{children:`Bekleyen teklif yok.`})}):Y.map(e=>{D[e.id]||le(e);let t=D[e.id],r=G(e.status)===`revize_edildi`,i=n.filter(t=>t.quote_id===e.quote_id&&t.supplier_id===e.supplier_id).sort((e,t)=>Number(e.revision_number||0)-Number(t.revision_number||0)),a=e=>String(e||``).split(`.`).map(e=>Number.parseInt(e,10)).map(e=>Number.isFinite(e)?e:9999),o=(e,t)=>{let n=a(e),r=a(t),i=Math.max(n.length,r.length);for(let e=0;e<i;e++){let t=n[e]??0,i=r[e]??0;if(t!==i)return t-i}return String(e||``).localeCompare(String(t||``))},s=e.items.filter(e=>!!e.is_group_header).sort((e,t)=>o(e.line_number,t.line_number)),c=e.items.filter(e=>!e.is_group_header).sort((e,t)=>o(e.line_number,t.line_number)),l=new Set,m=[];for(let e of s){m.push({kind:`header`,item:e});let t=String(e.line_number||``).split(`.`)[0],n=c.filter(e=>{let n=String(e.line_number||``);return t&&n.startsWith(`${t}.`)});for(let e of n)l.add(Number(e.quote_item_id)),m.push({kind:`item`,item:e})}for(let e of c)l.has(Number(e.quote_item_id))||m.push({kind:`item`,item:e});let h=t?U(t.items,L(t.currency),Number(t.discount_percent||0)):{total_amount:0,discount_amount:0,final_amount:0,currencyBuckets:{TRY:0,USD:0,EUR:0},totalTryEquivalent:0},T=e.active_premium_feature_codes||[];return(0,p.jsxs)(g,{children:[(0,p.jsxs)(`div`,{style:{display:`grid`,gap:8,marginBottom:12},children:[(0,p.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,alignItems:`flex-start`,gap:10,flexWrap:`wrap`},children:[(0,p.jsxs)(`div`,{children:[(0,p.jsx)(`div`,{style:{fontWeight:800,color:`#111827`,fontSize:16},children:e.quote_title}),(0,p.jsx)(`div`,{style:{marginTop:4,color:`#6b7280`,fontSize:13},children:e.published_by_tenant_name||`Firma belirtilmedi`})]}),(0,p.jsxs)(`div`,{style:{display:`flex`,gap:6,flexWrap:`wrap`},children:[(0,p.jsx)(`span`,{style:{display:`inline-flex`,padding:`4px 8px`,borderRadius:999,background:`#eff6ff`,color:`#1d4ed8`,fontWeight:800,fontSize:11},children:e.listing_scope_label||`Listeleme yok`}),(0,p.jsx)(`span`,{style:{display:`inline-flex`,padding:`4px 8px`,borderRadius:999,background:`#f8fafc`,color:`#475569`,fontWeight:800,fontSize:11},children:e.package_plan_name||e.package_plan_code||`Plan yok`}),T.length>0?(0,p.jsxs)(`span`,{style:{display:`inline-flex`,padding:`4px 8px`,borderRadius:999,background:`#fff7ed`,color:`#b45309`,fontWeight:800,fontSize:11},children:[`Premium: `,T.join(`, `)]}):null]})]}),(0,p.jsxs)(`div`,{style:{display:`grid`,gridTemplateColumns:`repeat(auto-fit, minmax(160px, 1fr))`,gap:8},children:[(0,p.jsxs)(`div`,{style:{borderRadius:10,border:`1px solid #e5e7eb`,background:`#f8fafc`,padding:`10px 12px`},children:[(0,p.jsx)(`div`,{style:{fontSize:11,color:`#64748b`,fontWeight:800,textTransform:`uppercase`},children:`Davet`}),(0,p.jsx)(`div`,{style:{marginTop:6,fontWeight:900,color:`#0f172a`,fontSize:20},children:e.invited_supplier_count||0})]}),(0,p.jsxs)(`div`,{style:{borderRadius:10,border:`1px solid #e5e7eb`,background:`#f8fafc`,padding:`10px 12px`},children:[(0,p.jsx)(`div`,{style:{fontSize:11,color:`#64748b`,fontWeight:800,textTransform:`uppercase`},children:`Platform`}),(0,p.jsx)(`div`,{style:{marginTop:6,fontWeight:900,color:`#0f172a`,fontSize:20},children:e.platform_network_supplier_count||0})]}),(0,p.jsxs)(`div`,{style:{borderRadius:10,border:`1px solid #e5e7eb`,background:`#f8fafc`,padding:`10px 12px`},children:[(0,p.jsx)(`div`,{style:{fontSize:11,color:`#64748b`,fontWeight:800,textTransform:`uppercase`},children:`Ozel Havuz`}),(0,p.jsx)(`div`,{style:{marginTop:6,fontWeight:900,color:`#0f172a`,fontSize:20},children:e.private_supplier_count||0})]}),(0,p.jsxs)(`div`,{style:{borderRadius:10,border:`1px solid #e5e7eb`,background:e.platform_network_listing_enabled?`#ecfdf5`:`#fff7ed`,padding:`10px 12px`},children:[(0,p.jsx)(`div`,{style:{fontSize:11,color:e.platform_network_listing_enabled?`#166534`:`#9a3412`,fontWeight:800,textTransform:`uppercase`},children:`Paket Yetkisi`}),(0,p.jsx)(`div`,{style:{marginTop:6,fontWeight:900,color:e.platform_network_listing_enabled?`#166534`:`#9a3412`,fontSize:14},children:e.platform_network_listing_enabled?`Platform gorunurlugu acik`:`Private kapsam`})]})]}),e.entitlement_summary?(0,p.jsx)(`div`,{style:{borderRadius:10,border:`1px solid ${e.platform_network_listing_enabled?`#bbf7d0`:`#fed7aa`}`,background:e.platform_network_listing_enabled?`#f0fdf4`:`#fff7ed`,padding:`10px 12px`,color:e.platform_network_listing_enabled?`#166534`:`#9a3412`,fontSize:12,lineHeight:1.7},children:e.entitlement_summary}):null]}),(0,p.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,alignItems:`center`,cursor:`pointer`,padding:`8px 0`},onClick:()=>d(u===e.id?null:e.id),children:[(0,p.jsxs)(`div`,{children:[(0,p.jsx)(`h3`,{style:{margin:`0 0 5px 0`},children:e.quote_title}),(0,p.jsxs)(`p`,{style:{margin:`0`,fontSize:`13px`,color:`#6b7280`},children:[e.items.length,` kalem • Son Tarih:`,` `,new Date(e.created_at).toLocaleDateString(`tr-TR`)]})]}),(0,p.jsx)(b,{status:e.status,children:e.status})]}),u===e.id&&t&&(0,p.jsxs)(p.Fragment,{children:[r&&(0,p.jsx)(`div`,{style:{marginTop:`10px`,marginBottom:`8px`,padding:`10px 12px`,borderRadius:`6px`,background:`#fff7ed`,border:`1px solid #fdba74`,fontSize:`12px`,color:`#9a3412`},children:`Revize istendi. Eski fiyatlar sabit gösterilir, her kaleme yeni revize fiyat girilir.`}),i.length>0&&(0,p.jsx)(`div`,{style:{marginBottom:`10px`,padding:`10px 12px`,borderRadius:`6px`,background:`#eff6ff`,border:`1px solid #bfdbfe`,fontSize:`12px`,color:`#1e3a8a`,overflow:`hidden`,boxSizing:`border-box`},children:i.map(t=>(0,p.jsxs)(`div`,{style:{display:`grid`,gridTemplateColumns:`minmax(0,1fr) auto`,gap:`8px`,alignItems:`center`,width:`100%`,minWidth:0},children:[(0,p.jsx)(`span`,{style:{fontWeight:700,minWidth:0,overflow:`hidden`,textOverflow:`ellipsis`},children:Number(t.revision_number||0)===0?`İlk Teklif`:`${t.revision_number}. Revize`}),(0,p.jsx)(`span`,{style:{whiteSpace:`nowrap`,fontSize:`11px`,paddingLeft:`8px`,maxWidth:`100%`},children:R(Number(t.final_amount||0),L(t.currency))})]},`history-${e.id}-${t.id}`))}),(0,p.jsx)(v,{style:{marginTop:`15px`},children:(0,p.jsxs)(_,{children:[(0,p.jsx)(`thead`,{children:(0,p.jsxs)(`tr`,{children:[(0,p.jsx)(`th`,{style:{width:`31%`},children:`Kalem`}),(0,p.jsx)(`th`,{style:{width:`6%`},children:`Ünite`}),(0,p.jsx)(`th`,{style:{width:`6%`},children:`Miktar`}),(0,p.jsx)(`th`,{style:{width:`19%`},children:`Birim Fiyat`}),(0,p.jsx)(`th`,{style:{width:`14%`},children:`Birim Toplam Fiyat`}),(0,p.jsx)(`th`,{style:{width:`11%`},children:`KDV Tutar`}),(0,p.jsx)(`th`,{style:{width:`13%`},children:`KDV Dahil Toplam`})]})}),(0,p.jsx)(`tbody`,{children:m.map((n,a)=>{let o=n.item,s=n.kind===`header`,c=String(o.line_number||``),l=c.split(`.`)[0];if(!s&&l&&Q(e.id,l))return null;let u=e.items.filter(e=>!e.is_group_header&&(e.line_number||``).startsWith(`${l}.`)),d=u.reduce((e,n)=>{let r=t.items.find(e=>e.quote_item_id===n.quote_item_id);return e+V(Number(r?.total_price||0),L(r?.currency),`TRY`)},0),m=u.reduce((e,n)=>{let r=t.items.find(e=>e.quote_item_id===n.quote_item_id);return e+V(Number(r?.total_price||0),L(r?.currency),`TRY`)*Number(n.vat_rate??20)/100},0),h=L(e.currency),g=u.reduce((e,t)=>e+V(Number(t.supplier_total_price||0),h,`TRY`),0),_=u.reduce((e,t)=>e+V(Number(t.supplier_total_price||0),h,`TRY`)*Number(t.vat_rate??20)/100,0),v=g+_;if(s)return(0,p.jsxs)(`tr`,{style:{background:`#fef3c7`,borderBottom:`2px solid #eab308`,fontWeight:700},children:[(0,p.jsxs)(`td`,{colSpan:3,style:{padding:`10px 12px`,color:`#92400e`,fontSize:`13px`,letterSpacing:`0.03em`},children:[(0,p.jsx)(`span`,{style:{background:`#f59e0b`,color:`#fff`,borderRadius:`999px`,padding:`2px 8px`,fontSize:`11px`,marginRight:`8px`,fontWeight:700},children:`Grup`}),(0,p.jsx)(`button`,{type:`button`,onClick:t=>{t.stopPropagation(),ce(e.id,l)},style:{marginRight:`8px`,border:`none`,background:`transparent`,color:`#92400e`,cursor:`pointer`,fontWeight:800,padding:0},title:Q(e.id,l)?`Grubu Aç`:`Grubu Kapat`,children:Q(e.id,l)?`▶`:`▼`}),c&&(0,p.jsx)(`span`,{style:{marginRight:`8px`,fontWeight:800},children:c}),o.description]}),(0,p.jsx)(`td`,{style:{padding:`10px 12px`,fontWeight:700,whiteSpace:`nowrap`,textAlign:`left`},children:(0,p.jsx)(`span`,{style:{fontSize:`11px`,color:`#92400e`,fontWeight:700},children:`Grup Toplamı`})}),(0,p.jsx)(`td`,{style:{padding:`10px 10px`,fontWeight:700,whiteSpace:`nowrap`,textAlign:`right`,fontSize:`13px`},children:(0,p.jsxs)(`div`,{style:{display:`flex`,flexDirection:`column`,alignItems:`flex-start`,gap:`2px`},children:[r&&(0,p.jsxs)(`span`,{style:{fontSize:`10px`,color:`#6b7280`,fontWeight:500},children:[`İlk Teklif: `,R(g,`TRY`)]}),(0,p.jsx)(`span`,{children:R(d,`TRY`)})]})}),(0,p.jsxs)(`td`,{style:{padding:`10px 10px`,fontWeight:700,whiteSpace:`nowrap`,textAlign:`right`,fontSize:`13px`},children:[r&&(0,p.jsxs)(`div`,{style:{fontSize:`10px`,color:`#6b7280`,fontWeight:500},children:[`İlk Teklif: `,R(_,`TRY`)]}),R(m,`TRY`)]}),(0,p.jsxs)(`td`,{style:{padding:`10px 10px`,fontWeight:700,whiteSpace:`nowrap`,textAlign:`right`,fontSize:`13px`},children:[r&&(0,p.jsxs)(`div`,{style:{fontSize:`10px`,color:`#6b7280`,fontWeight:500},children:[`İlk Teklif: `,R(v,`TRY`)]}),R(d+m,`TRY`)]})]},a);let y=t.items.findIndex(e=>e.quote_item_id===o.quote_item_id);if(y===-1)return null;let b=t.items[y],x=L(b.currency),S=Number(o.vat_rate??20),C=b.total_price*(S/100),T=b.total_price+C,ee=V(C,x,`TRY`),E=V(T,x,`TRY`),D=i.map(e=>{let t=e.items?.find(e=>Number(e.quote_item_id)===Number(o.quote_item_id));if(!t)return null;let n=Number(e.revision_number||0)===0?`İlk Teklif`:`${e.revision_number}. Revize`,r=L(e.currency);return`${n}: ${R(Number(t.supplier_total_price||0),r)}`}).filter(Boolean).join(` • `);return(0,p.jsxs)(f.Fragment,{children:[(0,p.jsxs)(`tr`,{style:{background:`#fff`},children:[(0,p.jsxs)(`td`,{style:{verticalAlign:`top`,paddingBottom:o.item_detail||o.item_image_url?`2px`:void 0},children:[(0,p.jsxs)(`div`,{style:{fontWeight:600},children:[c&&(0,p.jsx)(`span`,{style:{marginRight:`8px`,color:`#64748b`,fontWeight:700},children:c}),o.description]}),D&&(0,p.jsx)(`div`,{style:{marginTop:`4px`,fontSize:`11px`,color:`#64748b`,lineHeight:1.4},children:D})]}),(0,p.jsx)(`td`,{style:{whiteSpace:`nowrap`,textAlign:`center`},children:o.unit}),(0,p.jsx)(`td`,{style:{whiteSpace:`nowrap`,textAlign:`center`},children:o.quantity.toLocaleString(`tr-TR`)}),(0,p.jsxs)(`td`,{children:[r&&(0,p.jsxs)(`div`,{style:{fontSize:`11px`,color:`#6b7280`,marginBottom:`4px`},children:[`İlk Teklif: `,R(Number(o.supplier_unit_price||0),L(e.currency))]}),(0,p.jsxs)(`div`,{style:{position:`relative`,border:`1px solid #d1d5db`,borderRadius:`6px`,background:`#fff`},children:[(0,p.jsx)(w,{type:`number`,step:`0.01`,value:b.unit_price===0&&te===`${e.id}-${y}`?``:b.unit_price,onFocus:t=>{j(`${e.id}-${y}`),M(null),t.target.select()},onBlur:()=>j(t=>t===`${e.id}-${y}`?null:t),onChange:n=>{let r=[...t.items],i=n.target.value.trim(),a=i===``?0:parseFloat(i)||0;r[y].unit_price=a,r[y].total_price=r[y].unit_price*(o.quantity||0);let s=U(r,L(t.currency),Number(t.discount_percent||0));O(n=>({...n,[e.id]:{...t,items:r,total_amount:s.total_amount,discount_amount:s.discount_amount,final_amount:s.final_amount}}))},style:{width:`100%`,minWidth:`84px`,border:`none`,padding:`8px 48px 8px 8px`}}),(0,p.jsxs)(`button`,{type:`button`,onClick:()=>M(t=>t===`${e.id}-${y}`?null:`${e.id}-${y}`),style:{position:`absolute`,right:`4px`,top:`50%`,transform:`translateY(-50%)`,width:`40px`,padding:`6px 4px`,border:`none`,borderLeft:`1px solid #e5e7eb`,borderRadius:`4px`,background:`#f8fafc`,cursor:`pointer`,fontWeight:700,color:`#334155`},children:[ae(x),` ▾`]}),ie===`${e.id}-${y}`&&(0,p.jsx)(`div`,{style:{position:`absolute`,right:`4px`,top:`calc(100% + 4px)`,background:`#fff`,border:`1px solid #d1d5db`,borderRadius:`6px`,boxShadow:`0 6px 14px rgba(15, 23, 42, 0.12)`,zIndex:30,minWidth:`42px`,overflow:`hidden`},children:[`TRY`,`USD`,`EUR`].map(n=>(0,p.jsx)(`button`,{type:`button`,onClick:()=>{let r=L(n),i=[...t.items];i[y]={...i[y],currency:r};let a=U(i,L(t.currency),Number(t.discount_percent||0));O(n=>({...n,[e.id]:{...t,items:i,total_amount:a.total_amount,discount_amount:a.discount_amount,final_amount:a.final_amount}})),M(null)},style:{display:`block`,width:`100%`,border:`none`,background:n===x?`#eff6ff`:`#fff`,color:n===x?`#1e40af`:`#334155`,textAlign:`left`,padding:`8px 8px`,cursor:`pointer`,fontWeight:n===x?700:500},children:n===`TRY`?`₺`:n===`USD`?`$`:`€`},`${e.id}-${y}-${n}`))})]}),(0,p.jsx)(`div`,{style:{marginTop:`8px`},children:(0,p.jsx)(w,{type:`text`,value:b.notes,placeholder:`Not ekleyin...`,onChange:n=>{let r=[...t.items];r[y].notes=n.target.value,O(n=>({...n,[e.id]:{...t,items:r}}))},style:{width:`100%`,fontSize:`12px`}})})]}),(0,p.jsxs)(`td`,{style:{whiteSpace:`nowrap`,textAlign:`right`,fontSize:`13px`},children:[r&&(0,p.jsxs)(`div`,{style:{fontSize:`10px`,color:`#6b7280`,marginBottom:`2px`},children:[`İlk Teklif: `,R(Number(o.supplier_total_price||0),L(e.currency))]}),(0,p.jsxs)(`div`,{style:{fontWeight:700},children:[R(b.total_price,x),x!==`TRY`&&(0,p.jsxs)(`div`,{style:{fontSize:`11px`,color:`#92400e`},children:[`TL: `,R(V(b.total_price,x,`TRY`),`TRY`)]})]})]}),(0,p.jsxs)(`td`,{style:{whiteSpace:`nowrap`,textAlign:`right`,fontSize:`13px`},children:[r&&(0,p.jsxs)(`div`,{style:{fontSize:`10px`,color:`#6b7280`,marginBottom:`2px`},children:[`İlk Teklif: `,R(Number(o.supplier_total_price||0)*S/100,L(e.currency))]}),(0,p.jsx)(`div`,{style:{fontWeight:700},children:R(C,x)}),x!==`TRY`&&(0,p.jsxs)(`div`,{style:{fontSize:`11px`,color:`#92400e`},children:[`TL: `,R(ee,`TRY`)]})]}),(0,p.jsxs)(`td`,{style:{whiteSpace:`nowrap`,textAlign:`right`,fontSize:`13px`},children:[r&&(0,p.jsxs)(`div`,{style:{fontSize:`10px`,color:`#6b7280`,marginBottom:`2px`},children:[`İlk Teklif: `,R(Number(o.supplier_total_price||0)+Number(o.supplier_total_price||0)*S/100,L(e.currency))]}),(0,p.jsx)(`div`,{style:{fontWeight:700},children:R(T,x)}),x!==`TRY`&&(0,p.jsxs)(`div`,{style:{fontSize:`11px`,color:`#92400e`},children:[`TL: `,R(E,`TRY`)]})]})]}),(o.item_detail||o.item_image_url)&&(0,p.jsx)(`tr`,{style:{background:`#fafafa`},children:(0,p.jsx)(`td`,{colSpan:7,style:{paddingTop:`2px`,paddingBottom:`10px`,paddingLeft:`12px`},children:(0,p.jsxs)(`div`,{style:{display:`flex`,gap:`14px`,alignItems:`flex-start`},children:[o.item_image_url&&(0,p.jsx)(`a`,{href:o.item_image_url,target:`_blank`,rel:`noopener noreferrer`,title:`Görseli yeni sekmede aç`,children:(0,p.jsx)(`img`,{src:o.item_image_url,alt:`Kalem görseli`,style:{width:`160px`,height:`110px`,objectFit:`cover`,borderRadius:`6px`,border:`1px solid #e5e7eb`,flexShrink:0}})}),o.item_detail&&(0,p.jsx)(`span`,{style:{fontSize:`12px`,color:`#6b7280`,whiteSpace:`pre-wrap`,lineHeight:`1.5`},children:o.item_detail})]})})})]},a)})})]})}),(0,p.jsxs)(x,{children:[(0,p.jsxs)(S,{style:{gridColumn:`1 / -1`},children:[(0,p.jsxs)(C,{children:[`Toplam Tutar (`,L(t.currency),`)`]}),(0,p.jsx)(w,{type:`text`,value:R(t.total_amount,L(t.currency)),readOnly:!0}),(0,p.jsxs)(`div`,{style:{fontSize:`12px`,color:`#475569`,marginTop:`4px`},children:[R(t.total_amount,L(t.currency)),L(t.currency)!==`TRY`&&(0,p.jsxs)(`span`,{style:{marginLeft:`8px`,color:`#92400e`,fontWeight:600},children:[`(TL karşılığı: `,W(t.total_amount,L(t.currency))===null?`kur bekleniyor`:R(Number(W(t.total_amount,L(t.currency))),`TRY`),`)`]})]})]}),(0,p.jsxs)(S,{children:[(0,p.jsx)(C,{children:`İndirim %`}),(0,p.jsx)(w,{type:`number`,step:`0.01`,min:`0`,max:`100`,value:t.discount_percent,onChange:n=>{let r=parseFloat(n.target.value)||0,i=U(t.items,L(t.currency),r);O(n=>({...n,[e.id]:{...t,discount_percent:r,discount_amount:i.discount_amount,final_amount:i.final_amount}}))}})]}),(0,p.jsxs)(S,{children:[(0,p.jsxs)(C,{children:[`İndirim Tutar (`,L(t.currency),`)`]}),(0,p.jsx)(w,{type:`text`,value:R(t.discount_amount,L(t.currency)),readOnly:!0}),(0,p.jsx)(`div`,{style:{fontSize:`12px`,color:`#475569`,marginTop:`4px`},children:R(t.discount_amount,L(t.currency))})]}),(0,p.jsxs)(S,{children:[(0,p.jsxs)(C,{children:[`Final Tutar (`,L(t.currency),`)`]}),(0,p.jsx)(w,{type:`text`,value:R(t.final_amount,L(t.currency)),readOnly:!0,style:{fontWeight:`bold`,color:`#10b981`,fontSize:`16px`}}),(0,p.jsxs)(`div`,{style:{fontSize:`12px`,color:`#047857`,marginTop:`4px`,fontWeight:700},children:[R(t.final_amount,L(t.currency)),L(t.currency)!==`TRY`&&(0,p.jsxs)(`span`,{style:{marginLeft:`8px`,color:`#92400e`},children:[`(TL karşılığı: `,W(t.final_amount,L(t.currency))===null?`kur bekleniyor`:R(Number(W(t.final_amount,L(t.currency))),`TRY`),`)`]})]})]}),(0,p.jsxs)(S,{children:[(0,p.jsx)(C,{children:`Teslimat Süresi (Gün)`}),(0,p.jsx)(w,{type:`number`,value:t.delivery_time,onChange:n=>O(r=>({...r,[e.id]:{...t,delivery_time:parseInt(n.target.value)||0}}))})]}),(0,p.jsxs)(S,{style:{gridColumn:`1 / -1`},children:[(0,p.jsx)(C,{children:`Ödeme Şartları`}),(0,p.jsx)(w,{type:`text`,placeholder:`Örn: %50 peşin, %50 30 gün`,value:t.payment_terms,onChange:n=>O(r=>({...r,[e.id]:{...t,payment_terms:n.target.value}}))})]}),(0,p.jsxs)(S,{style:{gridColumn:`1 / -1`},children:[(0,p.jsx)(C,{children:`Garanti`}),(0,p.jsx)(w,{type:`text`,placeholder:`Örn: 12 ay ürün garantisi`,value:t.warranty,onChange:n=>O(r=>({...r,[e.id]:{...t,warranty:n.target.value}}))})]})]}),(0,p.jsxs)(`div`,{style:{marginTop:`8px`,marginBottom:`12px`,padding:`10px 12px`,borderRadius:`6px`,border:`1px solid #e2e8f0`,background:`#f8fafc`,fontSize:`12px`,color:`#334155`},children:[(0,p.jsx)(`div`,{style:{fontWeight:700,marginBottom:`6px`},children:`Döviz Özeti (Kalem Toplamları)`}),(0,p.jsxs)(`div`,{style:{display:`grid`,gridTemplateColumns:`repeat(auto-fit, minmax(220px, 1fr))`,gap:`6px`},children:[(0,p.jsxs)(`div`,{children:[`USD Toplami: `,R(h.currencyBuckets.USD,`USD`),(0,p.jsxs)(`span`,{style:{marginLeft:`6px`,color:`#92400e`},children:[`(TL: `,R(V(h.currencyBuckets.USD,`USD`,`TRY`),`TRY`),`)`]})]}),(0,p.jsxs)(`div`,{children:[`EUR Toplami: `,R(h.currencyBuckets.EUR,`EUR`),(0,p.jsxs)(`span`,{style:{marginLeft:`6px`,color:`#92400e`},children:[`(TL: `,R(V(h.currencyBuckets.EUR,`EUR`,`TRY`),`TRY`),`)`]})]}),(0,p.jsxs)(`div`,{children:[`TL Toplami: `,R(h.currencyBuckets.TRY,`TRY`)]})]}),(0,p.jsxs)(`div`,{style:{marginTop:`6px`,fontWeight:700},children:[`Toplam TL Karsiligi: `,R(h.totalTryEquivalent,`TRY`)]})]}),(0,p.jsxs)(`div`,{style:{display:`flex`,gap:`8px`,marginTop:`15px`},children:[(0,p.jsxs)(y,{variant:`secondary`,onClick:()=>de(e.id),disabled:k!==null,children:[k===e.id?`⏳`:`💾`,` Taslak Kaydet`]}),(0,p.jsx)(y,{onClick:()=>fe(e.id),disabled:k!==null,children:k===e.id?`⏳ Gönderiliyor...`:r?`✅ Revize Teklifi Gönder`:`✅ Teklifi Gönder`})]}),(0,p.jsxs)(`div`,{style:{marginTop:`10px`,padding:`8px 10px`,borderRadius:`6px`,background:L(t.currency)===`TRY`?`#f1f5f9`:`#fffbeb`,border:L(t.currency)===`TRY`?`1px solid #cbd5e1`:`1px solid #fcd34d`,fontSize:`12px`,color:L(t.currency)===`TRY`?`#334155`:`#92400e`,fontWeight:600},children:[`Teklif para birimi: `,L(t.currency),(0,p.jsxs)(`span`,{style:{marginLeft:`8px`,fontWeight:700},children:[`| Toplam: `,R(t.total_amount,L(t.currency)),` `,`• Indirim: `,R(t.discount_amount,L(t.currency)),` `,`• Final: `,R(t.final_amount,L(t.currency))]}),L(t.currency)!==`TRY`&&F&&(0,p.jsxs)(`span`,{style:{marginLeft:`8px`,fontWeight:700},children:[`(TCMB efektif satış: 1 USD = `,F.usd_try.toFixed(4),` TL, 1 EUR = `,F.eur_try.toFixed(4),` TL)`]})]})]})]},e.id)}):N===`submitted`?X.length===0?(0,p.jsx)(E,{children:(0,p.jsx)(`p`,{children:`Henüz gönderilmiş teklif yok.`})}):(0,p.jsx)(`div`,{style:{display:`grid`,gap:`10px`},children:X.map(e=>(0,p.jsx)(g,{children:(0,p.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,alignItems:`center`,gap:`12px`},children:[(0,p.jsxs)(`div`,{children:[(0,p.jsx)(`div`,{style:{fontWeight:700},children:e.quote_title}),(0,p.jsxs)(`div`,{style:{marginTop:`4px`,fontSize:`13px`,color:`#475569`},children:[`Gönderilen Tutar: `,R(Number(e.final_amount||0),L(e.currency)),L(e.currency)!==`TRY`&&(0,p.jsxs)(`span`,{style:{marginLeft:`8px`,color:`#92400e`,fontWeight:600},children:[`(TL: `,W(Number(e.final_amount||0),L(e.currency))===null?`kur bekleniyor`:R(Number(W(Number(e.final_amount||0),L(e.currency))),`TRY`),`)`]})]}),e.submitted_at&&(0,p.jsxs)(`div`,{style:{marginTop:`4px`,fontSize:`12px`,color:`#9ca3af`},children:[`Gönderilme: `,new Date(e.submitted_at).toLocaleString(`tr-TR`)]})]}),(0,p.jsx)(b,{status:e.status,children:e.status})]})},`submitted-${e.id}`))}):Z.length===0?(0,p.jsx)(E,{children:(0,p.jsx)(`p`,{children:`Kapanmış teklif yok.`})}):(0,p.jsx)(`div`,{style:{display:`grid`,gap:`10px`},children:Z.map(e=>(0,p.jsx)(g,{children:(0,p.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,alignItems:`center`,gap:`12px`},children:[(0,p.jsxs)(`div`,{style:{flex:1},children:[(0,p.jsx)(`div`,{style:{fontWeight:700},children:e.quote_title}),(0,p.jsxs)(`div`,{style:{marginTop:`4px`,fontSize:`13px`,color:`#475569`},children:[`Son Teklifiniz: `,R(Number(e.final_amount||0),L(e.currency))]}),(0,p.jsxs)(`div`,{style:{marginTop:`8px`,fontSize:`12px`,color:`#7c2d12`,background:`#fef2f2`,border:`1px solid #fecaca`,borderRadius:`6px`,padding:`8px 10px`},children:[`ℹ️ `,se(e)]})]}),(0,p.jsx)(b,{status:e.status,children:e.status})]})},`closed-${e.id}`))})]})}var O=[`certificates`,`company_docs`,`personnel_docs`,`guarantee_docs`],k={profile:`Profilim`,offers:`Tekliflerim`,contracts:`Sözleşmelerim`,guarantees:`Teminatlarım`,certificates:`Sertifikalar`,company_docs:`Şirket Evrakları`,personnel_docs:`Personel Evrakları`,guarantee_docs:`Alınan Teminatlar`},A=o.div`
  min-height: 100vh;
  background: #f0f4f8;
`,te=o.div`
  background: linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 100%);
  padding: 0 28px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`,j=o.h1`
  margin: 0;
  color: #fff;
  font-size: 20px;
`,ne=o.button`
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.35);
  color: #fff;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
`,re=o.div`
  max-width: 1100px;
  margin: 24px auto;
  padding: 0 16px 50px;
`,ie=o.div`
  background: #fff;
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.08);
`,M=o.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
`,N=o.button`
  border: 1px solid ${e=>e.$active?`#0f766e`:`#cbd5e1`};
  background: ${e=>e.$active?`#ccfbf1`:`#fff`};
  color: ${e=>e.$active?`#134e4a`:`#334155`};
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
`,P=o.button`
  border: none;
  background: #2d6a9f;
  color: #fff;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  &:disabled { opacity: 0.6; }
`,F=o.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  @media (max-width: 700px) {
    grid-template-columns: 1fr;
  }
`,I=o.input`
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
`,L=o.select`
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
`,R=o.div`
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  margin-top: 12px;
`,ae=o.div`
  border-bottom: 1px dashed #dbe3ee;
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  &:last-child { border-bottom: none; }
  a {
    color: #0f766e;
    font-size: 12px;
    font-weight: 700;
    text-decoration: none;
  }
`,oe=o.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: ${e=>e.$type===`success`?`#065f46`:`#991b1b`};
  color: #fff;
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 700;
`;function z(e){return O.includes(e)}function B(e){let t=new URLSearchParams(e).get(`tab`),n=[`profile`,`offers`,`contracts`,`guarantees`,...O];return t&&n.includes(t)?t:`profile`}function V(){let e=r(),t=i(),n=(0,f.useRef)(null),[o,m]=(0,f.useState)(()=>B(t.search)),[h,g]=(0,f.useState)(!1),[_,v]=(0,f.useState)(!1),[y,b]=(0,f.useState)(null),[x,S]=(0,f.useState)(null),[C,w]=(0,f.useState)([]),[T,ee]=(0,f.useState)([]),[E,V]=(0,f.useState)([]),[H,U]=(0,f.useState)(``),[W,G]=(0,f.useState)(``),[K,q]=(0,f.useState)(``),[J,se]=(0,f.useState)(`all`),Y=(e,t)=>{b({msg:e,type:t}),setTimeout(()=>b(null),3e3)};(0,f.useEffect)(()=>{if(!a()){e(`/supplier/login`,{replace:!0});return}m(B(t.search))},[t.search,e]),(0,f.useEffect)(()=>{async function e(){g(!0);try{o===`profile`?S(await s()):z(o)?w(await u(o)):o===`contracts`?ee(await c()):o===`guarantees`&&V(await l())}catch{Y(`Veriler yüklenemedi`,`error`)}finally{g(!1)}}e()},[o]);let X=t=>{e(`/supplier/workspace?tab=${t}`)},Z=(e,t,n)=>{if(!t&&!n)return!0;if(!e)return!1;let r=new Date(e);return!(Number.isNaN(r.getTime())||t&&r<new Date(`${t}T00:00:00`)||n&&r>new Date(`${n}T23:59:59`))},Q=(0,f.useMemo)(()=>C.filter(e=>{let t=!H.trim()||e.original_filename.toLowerCase().includes(H.trim().toLowerCase()),n=Z(e.created_at,W,K);return t&&n}),[C,H,W,K]),ce=(0,f.useMemo)(()=>T.filter(e=>J===`all`||e.status===J),[T,J]),$=async e=>{let t=e.target.files?.[0];if(!(!t||!z(o)))try{v(!0),await d(o,t),w(await u(o)),Y(`Evrak yüklendi`,`success`)}catch(e){Y(e?.response?.data?.detail||`Evrak yüklenemedi`,`error`)}finally{v(!1),e.target.value=``}},le=async e=>{let t=a();if(!t){Y(`Oturum bulunamadı`,`error`);return}try{let n=await fetch(`https://buyerasistans.com.tr${e.file_url}`,{headers:{Authorization:`Bearer ${t}`}});if(!n.ok)throw Error();let r=await n.blob(),i=URL.createObjectURL(r);window.open(i,`_blank`,`noopener,noreferrer`),setTimeout(()=>URL.revokeObjectURL(i),6e4)}catch{Y(`Doküman açılamadı`,`error`)}};return(0,p.jsxs)(A,{children:[(0,p.jsxs)(te,{children:[(0,p.jsx)(j,{children:`Tedarikçi Workspace`}),(0,p.jsx)(ne,{onClick:()=>e(`/supplier/dashboard`),children:`← Panele Dön`})]}),(0,p.jsx)(re,{children:(0,p.jsxs)(ie,{children:[(0,p.jsxs)(M,{children:[(0,p.jsx)(N,{$active:o===`profile`,onClick:()=>X(`profile`),children:k.profile}),(0,p.jsx)(N,{$active:o===`offers`,onClick:()=>X(`offers`),children:k.offers}),(0,p.jsx)(N,{$active:o===`contracts`,onClick:()=>X(`contracts`),children:k.contracts}),(0,p.jsx)(N,{$active:o===`guarantees`,onClick:()=>X(`guarantees`),children:k.guarantees}),O.map(e=>(0,p.jsx)(N,{$active:o===e,onClick:()=>X(e),children:k[e]},e))]}),h&&(0,p.jsx)(`div`,{style:{color:`#64748b`,fontSize:14},children:`Yükleniyor...`}),!h&&o===`profile`&&(0,p.jsx)(`div`,{style:{border:`1px solid #e2e8f0`,borderRadius:10,background:`#f8fafc`,padding:14},children:x?(0,p.jsxs)(p.Fragment,{children:[(0,p.jsxs)(`div`,{style:{display:`grid`,gridTemplateColumns:`1fr 1fr`,gap:10},children:[(0,p.jsxs)(`div`,{children:[(0,p.jsx)(`div`,{style:{fontSize:12,color:`#64748b`},children:`Firma`}),(0,p.jsx)(`div`,{style:{fontWeight:700},children:x.supplier.company_name||`-`})]}),(0,p.jsxs)(`div`,{children:[(0,p.jsx)(`div`,{style:{fontSize:12,color:`#64748b`},children:`Kategori`}),(0,p.jsx)(`div`,{style:{fontWeight:700},children:x.supplier.category||`-`})]}),(0,p.jsxs)(`div`,{children:[(0,p.jsx)(`div`,{style:{fontSize:12,color:`#64748b`},children:`Email`}),(0,p.jsx)(`div`,{style:{fontWeight:700},children:x.supplier.email||`-`})]}),(0,p.jsxs)(`div`,{children:[(0,p.jsx)(`div`,{style:{fontSize:12,color:`#64748b`},children:`Telefon`}),(0,p.jsx)(`div`,{style:{fontWeight:700},children:x.supplier.phone||`-`})]})]}),(0,p.jsxs)(`div`,{style:{marginTop:12,display:`flex`,gap:8,flexWrap:`wrap`},children:[(0,p.jsx)(P,{onClick:()=>e(`/supplier/profile`),children:`Profili Düzenle`}),(0,p.jsx)(P,{style:{background:`#334155`},onClick:()=>e(`/supplier/finance`),children:`Finans Modülü`})]})]}):(0,p.jsx)(`div`,{style:{color:`#64748b`,fontSize:13},children:`Profil bilgileri bulunamadı.`})}),!h&&o===`offers`&&(0,p.jsx)(`div`,{style:{border:`1px solid #e2e8f0`,borderRadius:10,background:`#fff`,padding:8},children:(0,p.jsx)(D,{apiUrl:`https://buyerasistans.com.tr`,authToken:a()||``})}),!h&&o===`contracts`&&(0,p.jsxs)(p.Fragment,{children:[(0,p.jsx)(F,{children:(0,p.jsxs)(L,{value:J,onChange:e=>se(e.target.value),children:[(0,p.jsx)(`option`,{value:`all`,children:`Tüm Durumlar`}),(0,p.jsx)(`option`,{value:`draft`,children:`Taslak`}),(0,p.jsx)(`option`,{value:`generated`,children:`Oluşturuldu`}),(0,p.jsx)(`option`,{value:`sent`,children:`Gönderildi`}),(0,p.jsx)(`option`,{value:`signed`,children:`İmzalı`}),(0,p.jsx)(`option`,{value:`completed`,children:`Tamamlandı`}),(0,p.jsx)(`option`,{value:`cancelled`,children:`İptal`})]})}),(0,p.jsxs)(R,{children:[ce.length===0&&(0,p.jsx)(`div`,{style:{padding:12,fontSize:13,color:`#64748b`},children:`Sözleşme bulunmuyor.`}),ce.map(e=>(0,p.jsxs)(`div`,{style:{borderBottom:`1px dashed #dbe3ee`,padding:`10px 12px`},children:[(0,p.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,gap:8},children:[(0,p.jsx)(`strong`,{style:{fontSize:13},children:e.contract_number}),(0,p.jsx)(`span`,{style:{fontSize:12,color:`#0f766e`,fontWeight:700},children:e.status})]}),(0,p.jsxs)(`div`,{style:{marginTop:4,fontSize:12,color:`#475569`,display:`flex`,justifyContent:`space-between`,gap:8},children:[(0,p.jsxs)(`span`,{children:[`Teklif: `,e.quote_id]}),(0,p.jsx)(`span`,{children:e.final_amount?`${e.final_amount.toLocaleString(`tr-TR`)} TL`:`-`})]})]},e.id))]})]}),!h&&o===`guarantees`&&(0,p.jsxs)(R,{children:[E.length===0&&(0,p.jsx)(`div`,{style:{padding:12,fontSize:13,color:`#64748b`},children:`Teminat kaydı bulunmuyor.`}),E.map(e=>(0,p.jsxs)(`div`,{style:{borderBottom:`1px dashed #dbe3ee`,padding:`10px 12px`},children:[(0,p.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,gap:8},children:[(0,p.jsx)(`strong`,{style:{fontSize:13},children:e.title}),(0,p.jsx)(`span`,{style:{fontSize:12,color:`#0f766e`,fontWeight:700},children:e.status})]}),(0,p.jsx)(`div`,{style:{marginTop:4,fontSize:12,color:`#475569`},children:e.amount?`${e.amount.toLocaleString(`tr-TR`)} ${e.currency}`:`Tutar yok`})]},e.id))]}),!h&&z(o)&&(0,p.jsxs)(p.Fragment,{children:[(0,p.jsxs)(F,{children:[(0,p.jsx)(I,{value:H,onChange:e=>U(e.target.value),placeholder:`Dosya adına göre filtrele`}),(0,p.jsx)(I,{type:`date`,value:W,onChange:e=>G(e.target.value)}),(0,p.jsx)(I,{type:`date`,value:K,onChange:e=>q(e.target.value)}),(0,p.jsx)(P,{onClick:()=>n.current?.click(),disabled:_,children:_?`⏳ Yükleniyor...`:`+ Evrak Yükle`})]}),(0,p.jsx)(`input`,{ref:n,type:`file`,accept:`application/pdf,image/jpeg,image/png,image/webp`,style:{display:`none`},onChange:$}),(0,p.jsxs)(R,{children:[Q.length===0&&(0,p.jsx)(`div`,{style:{padding:12,fontSize:13,color:`#64748b`},children:`Filtreye uygun evrak yok.`}),Q.map(e=>(0,p.jsxs)(ae,{children:[(0,p.jsxs)(`div`,{children:[(0,p.jsx)(`div`,{style:{fontSize:13,color:`#334155`},children:e.original_filename}),(0,p.jsx)(`div`,{style:{marginTop:2,fontSize:11,color:`#64748b`},children:e.created_at?new Date(e.created_at).toLocaleString(`tr-TR`):`Tarih bilgisi yok`})]}),(0,p.jsx)(`a`,{href:`#`,onClick:t=>{t.preventDefault(),le(e)},children:`Aç`})]},e.id))]})]})]})}),y&&(0,p.jsx)(oe,{$type:y.type,children:y.msg})]})}export{V as default};