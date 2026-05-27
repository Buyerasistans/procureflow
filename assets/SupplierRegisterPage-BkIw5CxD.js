import{r as e}from"./rolldown-runtime-Dw2cE7zH.js";import{$ as t,B as n,J as r,X as i}from"./react-B1lg9EFp.js";import{o as a,s as o,t as s}from"./http-2VXd4Qd7.js";import{r as c,t as l}from"./vendor-CPSNvO84.js";var u=e(t(),1),d=n(),f=l.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
`,p=l.div`
  background: white;
  padding: 40px;
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  max-width: 500px;
  width: 100%;

  h1 {
    margin: 0 0 10px 0;
    font-size: 28px;
    color: #333;
  }

  .subtitle {
    color: #666;
    margin-bottom: 30px;
    font-size: 14px;
  }
`,m=l.div`
  margin-bottom: 20px;

  label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #333;
    font-size: 14px;
  }
`,h=l.input`
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`,g=l.button`
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 4px;
  font-weight: bold;
  font-size: 16px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`,_=l.div`
  background-color: #fee2e2;
  color: #991b1b;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
  font-size: 14px;
`,v=l.div`
  background-color: #d1fae5;
  color: #065f46;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
  font-size: 14px;
`,y=l.div`
  text-align: center;
  padding: 20px;
  color: #666;
`,b=l.div`
  margin-bottom: 24px;
  padding: 16px;
  border-radius: 12px;
  background: linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%);
  border: 1px solid #bfdbfe;
  color: #334155;
  font-size: 13px;

  strong {
    color: #0f172a;
  }

  ul {
    margin: 14px 0 0 18px;
    padding: 0;
    color: #475569;
    line-height: 1.6;
  }
`;function x(){let[e]=i(),t=r(),n=e.get(`token`),[l,x]=(0,u.useState)(!0),[S,C]=(0,u.useState)(!1),[w,T]=(0,u.useState)(null),[E,D]=(0,u.useState)(null),[O,k]=(0,u.useState)({company_name:``,user_name:``,email:``}),[A,j]=(0,u.useState)({password:``,password_confirm:``});return(0,u.useEffect)(()=>{if(a()){console.log(`[REGISTER] Already have supplier token, redirecting to dashboard`),t(`/supplier/dashboard`,{replace:!0});return}if(!n){T(`Geçersiz kayıt bağlantısı`),x(!1);return}(async()=>{try{console.log(`[REGISTER] Calling validate endpoint with token:`,n);let e=await c.get(`https://buyerasistans.com.tr/api/v1/api/v1/supplier/register/validate`,{params:{token:n}});if(console.log(`[REGISTER] Validate response:`,e.data),!e.data?.valid){console.log(`[REGISTER] Valid = false, showing error`),T(e.data?.message||`Geçersiz veya süresi dolmuş bağlantı`),x(!1);return}console.log(`[REGISTER] Valid = true, showing form`),k({company_name:e.data.supplier_name||``,user_name:e.data.supplier_user_name||``,email:e.data.email||``}),x(!1)}catch(e){console.error(`[REGISTER] Validate error:`,e),T(`Geçersiz veya süresi dolmuş bağlantı`),x(!1)}})()},[n,t]),l?(0,d.jsx)(f,{children:(0,d.jsx)(p,{children:(0,d.jsx)(y,{children:`⏳ Veriler yükleniyor...`})})}):(0,d.jsx)(f,{children:(0,d.jsxs)(p,{children:[(0,d.jsx)(`h1`,{children:`Daveti Tamamlayın`}),(0,d.jsx)(`div`,{className:`subtitle`,children:`Stratejik partneriniz sizi ProcureFlow tedarikçi portalına hızlı davet ile ekledi.`}),w&&(0,d.jsxs)(_,{children:[`❌ `,w]}),E&&(0,d.jsxs)(v,{children:[`✅ `,E]}),!E&&(0,d.jsxs)(d.Fragment,{children:[(0,d.jsxs)(b,{children:[(0,d.jsxs)(`div`,{children:[(0,d.jsx)(`strong`,{children:`Firma:`}),` `,O.company_name]}),(0,d.jsxs)(`div`,{style:{marginTop:`6px`},children:[(0,d.jsx)(`strong`,{children:`Davet edilen yetkili:`}),` `,O.user_name||`İlk firma yetkilisi`]}),(0,d.jsxs)(`div`,{style:{marginTop:`6px`},children:[(0,d.jsx)(`strong`,{children:`E-posta:`}),` `,O.email]}),(0,d.jsxs)(`ul`,{children:[(0,d.jsx)(`li`,{children:`Bu adımda hesabınızı aktive eder ve giriş şifrenizi belirlersiniz.`}),(0,d.jsx)(`li`,{children:`Vergi, adres, finans ve belge bilgilerini giriş yaptıktan sonra profil ekranınızdan siz tamamlarsınız.`}),(0,d.jsx)(`li`,{children:`Kayıt tamamlanınca doğrudan supplier paneline yönlendirilirsiniz.`})]})]}),(0,d.jsxs)(`div`,{style:{marginBottom:`20px`,fontSize:`13px`,color:`#666`},children:[(0,d.jsxs)(`p`,{style:{margin:`0 0 8px 0`},children:[(0,d.jsx)(`strong`,{children:`📦 Firma:`}),` `,O.company_name]}),(0,d.jsxs)(`p`,{style:{margin:`0 0 8px 0`},children:[(0,d.jsx)(`strong`,{children:`👤 Yetkili:`}),` `,O.user_name]}),(0,d.jsxs)(`p`,{style:{margin:`0`},children:[(0,d.jsx)(`strong`,{children:`📧 E-mail:`}),` `,O.email]})]}),(0,d.jsxs)(`form`,{onSubmit:async e=>{if(e.preventDefault(),!A.password){T(`Şifre boş olamaz`);return}if(A.password!==A.password_confirm){T(`Şifreler eşleşmiyor`);return}if(A.password.length<8){T(`Şifre en az 8 karakter olmalıdır`);return}try{C(!0),T(null),console.log(`[REGISTER] Posting to /supplier/register with token:`,n?.substring(0,20)+`...`);let e=await s.post(`/supplier/register`,{token:n,password:A.password});if(console.log(`[REGISTER] Response received:`,e.status,e.data),e.data?.access_token)console.log(`[REGISTER] access_token found, saving to session`),o(e.data.access_token);else{console.error(`[REGISTER] ERROR: access_token NOT in response!`,e.data),T(`Kayıt başarılı, ancak token alınamadı`);return}D(`Kayıt başarılı! Panele yönlendiriliyorsunuz...`),setTimeout(()=>{console.log(`[REGISTER] Navigating to /supplier/dashboard`),t(`/supplier/dashboard`,{replace:!0})},1e3)}catch(e){console.error(`[REGISTER] Catch error:`,e),T(`Kayıt sırasında hata oluştu: `+String(e))}finally{C(!1)}},children:[(0,d.jsxs)(m,{children:[(0,d.jsx)(`label`,{htmlFor:`password`,children:`Şifre *`}),(0,d.jsx)(h,{id:`password`,type:`password`,value:A.password,onChange:e=>j({...A,password:e.target.value}),placeholder:`Portal girişiniz için en az 8 karakter`,required:!0,disabled:S})]}),(0,d.jsxs)(m,{children:[(0,d.jsx)(`label`,{htmlFor:`password_confirm`,children:`Şifre Tekrarı *`}),(0,d.jsx)(h,{id:`password_confirm`,type:`password`,value:A.password_confirm,onChange:e=>j({...A,password_confirm:e.target.value}),placeholder:`Aynı şifreyi tekrar girin`,required:!0,disabled:S})]}),(0,d.jsx)(g,{type:`submit`,disabled:S,children:S?`⏳ Davet tamamlanıyor...`:`✅ Davetimi Tamamla`})]})]})]})})}export{x as default};