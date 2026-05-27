import{r as e}from"./rolldown-runtime-Dw2cE7zH.js";import{$ as t,B as n,J as r}from"./react-B1lg9EFp.js";import{o as i}from"./http-2VXd4Qd7.js";import{t as a}from"./PublicBrandLogo-B4OVne4C.js";import{t as o}from"./vendor-CPSNvO84.js";import{s,u as c}from"./index-BYVSOJ2Y.js";var l=e(t(),1),u=n(),d=o.div`
  min-height: calc(100vh - 60px);
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
  background: radial-gradient(circle at top left, rgba(14, 165, 233, 0.2), transparent 26%), linear-gradient(135deg, #eef7ff 0%, #dbeafe 56%, #e0f2fe 100%);

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`,f=o.section`
  padding: 56px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at top right, rgba(56, 189, 248, 0.3), transparent 24%), radial-gradient(circle at bottom left, rgba(14, 165, 233, 0.2), transparent 26%), linear-gradient(135deg, #1a3a5c 0%, #1e4f78 55%, #0f70a8 100%);

  h1 {
    font-size: 46px;
    line-height: 1.04;
    margin: 18px 0 10px;
    font-weight: 900;
  }

  p {
    margin: 0;
    max-width: 520px;
    line-height: 1.7;
    color: #dbeafe;
    font-size: 15px;
  }
`,p=o.section`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
`,m=o.div`
  width: 100%;
  max-width: 430px;
  background: white;
  border-radius: 22px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 20px 55px rgba(30, 41, 59, 0.16);
  padding: 36px 32px;

  h2 {
    margin: 0;
    font-size: 32px;
    line-height: 1.08;
    color: #0f172a;
    font-weight: 900;
  }

  p {
    margin: 10px 0 24px;
    color: #64748b;
    font-size: 14px;
    line-height: 1.6;
  }
`,h=o.form`
  display: grid;
  gap: 14px;
`,g=o.label`
  display: grid;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: #334155;
`,_=o.input`
  width: 100%;
  padding: 13px 14px;
  border-radius: 12px;
  border: 1px solid #dbe3ef;
  background: #f8fafc;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: #0ea5e9;
    box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
`,v=o.button`
  width: 100%;
  padding: 13px 16px;
  border-radius: 12px;
  border: none;
  background: #0ea5e9;
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`,y=o.div`
  border-radius: 12px;
  border: 1px solid #fecaca;
  background: #fff1f2;
  color: #be123c;
  padding: 10px 12px;
  font-size: 13px;
`,b=o.div`
  border-radius: 12px;
  border: 1px solid #86efac;
  background: #dcfce7;
  color: #166534;
  padding: 10px 12px;
  font-size: 13px;
`;function x(){let e=r(),[t,n]=(0,l.useState)({email:``,password:``}),[o,x]=(0,l.useState)(!1),[S,C]=(0,l.useState)(null),[w,T]=(0,l.useState)(``);(0,l.useEffect)(()=>{i()&&e(`/supplier/dashboard`,{replace:!0})},[e]);let E=e=>{let{name:t,value:r}=e.target;n(e=>({...e,[t]:r})),C(null)};return(0,u.jsxs)(`div`,{style:{minHeight:`100vh`},children:[(0,u.jsx)(c,{variant:`supplier`,activePath:`/supplier/login`}),(0,u.jsxs)(d,{children:[(0,u.jsx)(f,{children:(0,u.jsxs)(`div`,{children:[(0,u.jsx)(a,{height:44,maxWidth:220,marginBottom:24,invert:!0}),(0,u.jsx)(`h1`,{children:`Tedarikçi Portalı`}),(0,u.jsx)(`p`,{children:`Tekliflerinizi yönetin, proje detaylarını görün ve sözleşme süreçlerini tek bir panelden takip edin.`})]})}),(0,u.jsx)(p,{children:(0,u.jsxs)(m,{children:[(0,u.jsx)(`h2`,{children:`Tedarikçi Girişi`}),(0,u.jsx)(`p`,{children:`Tedarikçi hesabınızla giriş yaparak kendi tedarikçi panelinize erişin.`}),(0,u.jsxs)(h,{onSubmit:async n=>{if(n.preventDefault(),C(null),T(``),!t.email){C({field:`email`,message:`E-posta gerekli`});return}if(!t.password){C({field:`password`,message:`Şifre gerekli`});return}x(!0);try{await s(t.email,t.password),T(`Giriş başarılı! Yönlendiriliyorsunuz...`),e(`/supplier/dashboard`,{replace:!0})}catch(e){C({message:e instanceof Error?e.message:`Giriş başarısız. Lütfen e-posta ve şifrenizi kontrol ediniz.`})}finally{x(!1)}},children:[S&&(0,u.jsx)(y,{children:S.message}),w&&(0,u.jsx)(b,{children:w}),(0,u.jsxs)(g,{htmlFor:`email`,children:[`E-posta Adresi`,(0,u.jsx)(_,{type:`email`,id:`email`,name:`email`,value:t.email,onChange:E,placeholder:`ornek@tedarikci.com`,disabled:o,required:!0})]}),(0,u.jsxs)(g,{htmlFor:`password`,children:[`Şifre`,(0,u.jsx)(_,{type:`password`,id:`password`,name:`password`,value:t.password,onChange:E,placeholder:`••••••••`,disabled:o,required:!0})]}),(0,u.jsx)(v,{type:`submit`,disabled:o,children:o?`Giriş yapılıyor...`:`Giriş Yap`})]})]})})]})]})}export{x as default};