import{r as e}from"./rolldown-runtime-Dw2cE7zH.js";import{$ as t,B as n,J as r,X as i}from"./react-B1lg9EFp.js";import{n as a}from"./http-2VXd4Qd7.js";import{t as o}from"./vendor-CPSNvO84.js";import{t as s}from"./supplier-profile.service-Duxtoz2X.js";var c=e(t(),1),l=n(),u=o.div`
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #eef2f7;
  padding: 16px;
`,d=o.div`
  width: 100%;
  max-width: 560px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.12);
  padding: 26px;
`,f=o.button`
  margin-top: 18px;
  border: none;
  background: #0f766e;
  color: #fff;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
`;function p(){let e=r(),[t]=i(),[n,o]=(0,c.useState)(!0),[p,m]=(0,c.useState)(!1),[h,g]=(0,c.useState)(`Doğrulama yapılıyor...`),[_,v]=(0,c.useState)(!1),[y,b]=(0,c.useState)(6),[x,S]=(0,c.useState)(``),[C,w]=(0,c.useState)(``),[T,E]=(0,c.useState)(``);return(0,c.useEffect)(()=>{async function e(){let e=(t.get(`token`)||``).trim();if(!e){g(`Token bulunamadı.`),o(!1);return}E(e),g(`E-posta doğrulamak için isterseniz yeni şifre belirleyip onaylayın.`),o(!1)}e()},[t]),(0,c.useEffect)(()=>{if(n||!_)return;if(y<=0){e(`/supplier/login`,{replace:!0});return}let t=window.setTimeout(()=>b(e=>e-1),1e3);return()=>window.clearTimeout(t)},[n,_,y,e]),(0,l.jsx)(u,{children:(0,l.jsxs)(d,{children:[(0,l.jsx)(`h2`,{style:{marginTop:0,color:`#1f2937`},children:`E-posta Doğrulama`}),(0,l.jsx)(`p`,{style:{color:`#475569`,fontSize:15},children:n?`İşlem sürüyor...`:h}),!n&&!_&&(0,l.jsxs)(`div`,{style:{display:`grid`,gap:10},children:[(0,l.jsx)(`input`,{type:`password`,value:x,onChange:e=>S(e.target.value),placeholder:`Yeni şifre (opsiyonel)`,style:{border:`1px solid #cbd5e1`,borderRadius:8,padding:`10px 12px`,fontSize:14}}),(0,l.jsx)(`input`,{type:`password`,value:C,onChange:e=>w(e.target.value),placeholder:`Yeni şifre tekrar`,style:{border:`1px solid #cbd5e1`,borderRadius:8,padding:`10px 12px`,fontSize:14}}),(0,l.jsx)(f,{onClick:async()=>{if(!(!T||p)){if(x||C){if(x!==C){g(`Şifre tekrar alanı eşleşmiyor.`);return}if(x.length<4){g(`Şifre en az 4 karakter olmalıdır.`);return}}try{m(!0),g((await s(T,x||void 0)).message||`E-posta değişikliği onaylandı.`),v(!0),a()}catch(e){let t=e?.response?.data?.detail;g(t||`Onay işlemi başarısız.`)}finally{m(!1)}}},disabled:p,children:p?`Onaylanıyor...`:`E-postayı Onayla`})]}),!n&&_&&(0,l.jsxs)(`p`,{style:{color:`#0f766e`,fontSize:14,fontWeight:700},children:[`Oturumunuz güvenlik için kapatıldı. `,y,` sn içinde giriş sayfasına yönlendirileceksiniz.`]}),!n&&_&&(0,l.jsx)(f,{onClick:()=>e(`/supplier/login`,{replace:!0}),children:_?`Giriş Sayfasına Git`:`Tekrar Girişe Dön`})]})})}export{p as default};