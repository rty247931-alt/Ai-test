import io

# ---------------- index.html ----------------
hpath = "public/index.html"
with io.open(hpath, "r", encoding="utf-8") as f:
    c = f.read()

h_steps = [
("""    <section id="reservations" class="page hidden"><div class="card"><h3>الحجوزات</h3><div class="row3"><div><label>بحث</label><input id="resSearch" placeholder="اسم، هاتف، رقم فاتورة، مدرس..."></div><div><label>الحالة</label><select id="resStatus"><option value="">الكل</option><option>محجوز</option><option>تم التسليم</option><option>ملغي</option></select></div></div><div id="resTable" style="margin-top:14px"></div></div></section>""",
"""    <section id="reservations" class="page hidden"><div class="card"><h3>الحجوزات</h3><div class="row3"><div><label>بحث</label><input id="resSearch" placeholder="اسم، هاتف، رقم فاتورة، مدرس..."></div><div><label>الحالة</label><select id="resStatus"><option value="">الكل</option><option>محجوز</option><option>تم التسليم</option><option>ملغي</option></select></div></div><div id="resSummary" class="card" style="margin-top:14px;background:var(--panel2);display:none"></div><div id="resTable" style="margin-top:14px"></div></div></section>"""),

("""async function loadInvoices(type){
  const q=$(type==="res"?"resSearch":"arcSearch").value;
  const status=type==="res"?$("resStatus").value:"";
  const view=type==="res"?"active":"archived";
  const params={q,status,view};
  if(isAdmin()) params.employee=employeeParam();
  const rows=await api("/api/invoices?"+new URLSearchParams(params));
  $(type==="res"?"resTable":"arcTable").innerHTML=table(rows,view);
}
$("resSearch").oninput=()=>loadInvoices("res");$("resStatus").onchange=()=>loadInvoices("res");$("arcSearch").oninput=()=>loadInvoices("arc");""",
"""async function loadInvoices(type){
  const q=$(type==="res"?"resSearch":"arcSearch").value;
  const status=type==="res"?$("resStatus").value:"";
  const view=type==="res"?"active":"archived";
  const params={q,status,view};
  if(isAdmin()) params.employee=employeeParam();
  const rows=await api("/api/invoices?"+new URLSearchParams(params));
  $(type==="res"?"resTable":"arcTable").innerHTML=table(rows,view);
  if(type==="res") renderResSummary(rows);
}
// Live counter above the reservations table: total reservations + total copies (and per-book
// breakdown) matching the current search/filter — so you know exactly how many to order.
function renderResSummary(rows){
  const box=$("resSummary");
  if(!rows.length){box.style.display="none";box.innerHTML="";return}
  let totalCopies=0;
  const perBook={};
  rows.forEach(r=>(r.items||[]).forEach(it=>{
    const qty=Number(it.quantity)||0;
    totalCopies+=qty;
    perBook[it.book]=(perBook[it.book]||0)+qty;
  }));
  const breakdown=Object.entries(perBook).sort((a,b)=>b[1]-a[1]).map(([b,q])=>`${esc(b)}: <b>${q}</b>`).join(" &nbsp;•&nbsp; ");
  box.style.display="block";
  box.innerHTML=`📦 عدد الحجوزات: <b>${rows.length}</b> &nbsp;—&nbsp; إجمالي عدد النسخ: <b>${totalCopies}</b>${breakdown?`<div class="muted" style="margin-top:6px">${breakdown}</div>`:""}`;
}
$("resSearch").oninput=()=>loadInvoices("res");$("resStatus").onchange=()=>loadInvoices("res");$("arcSearch").oninput=()=>loadInvoices("arc");"""),

("""      <div id="settingsAccounts" class="settings-tab hidden">
        <div class="card">
          <h3>🔑 تغيير كلمة المرور الخاصة بي</h3>
          <p class="muted">لازم تدخل كلمة المرور الحالية عشان تقدر تغيّرها.</p>
          <div class="row3">
            <div><label>كلمة المرور الحالية</label><input id="curPass" type="password"></div>
            <div><label>كلمة المرور الجديدة</label><input id="newPass" type="password"></div>
            <div><label>تأكيد كلمة المرور الجديدة</label><input id="newPass2" type="password"></div>
          </div>
          <button id="changePassBtn" class="btn primary" style="margin-top:14px">تغيير كلمة المرور</button>
        </div>
        <div id="adminAccountsCard" class="card section hidden">
          <h3>👤 إدارة حسابات الموظفين</h3>
          <p class="muted">تقدر تعدّل الاسم أو اسم المستخدم أو كلمة المرور لأي حساب. اسيب خانة كلمة المرور فاضية لو مش عايز تغيّرها.</p>
          <div id="accountsTable" style="margin-top:14px"></div>
        </div>
      </div>""",
"""      <div id="settingsAccounts" class="settings-tab hidden">
        <div class="card">
          <h3>👤 بيانات حسابي</h3>
          <p class="muted">كل حساب يشوف ويعدّل بياناته الخاصة بس، ومش شايف أو عارف يغيّر بيانات باقي الحسابات.</p>
          <div class="row3">
            <div><label>الاسم</label><input id="myName"></div>
            <div><label>اسم المستخدم</label><input id="myUsername"></div>
          </div>
          <button id="saveMyAccountBtn" class="btn primary" style="margin-top:14px">حفظ البيانات</button>
        </div>
        <div class="card section">
          <h3>🔑 تغيير كلمة المرور</h3>
          <p class="muted">لازم تدخل كلمة المرور الحالية عشان تقدر تغيّرها.</p>
          <div class="row3">
            <div><label>كلمة المرور الحالية</label><div class="pass-wrap"><input id="curPass" type="password"><button type="button" class="eye-btn" data-target="curPass">👁️</button></div></div>
            <div><label>كلمة المرور الجديدة</label><div class="pass-wrap"><input id="newPass" type="password"><button type="button" class="eye-btn" data-target="newPass">👁️</button></div></div>
            <div><label>تأكيد كلمة المرور الجديدة</label><div class="pass-wrap"><input id="newPass2" type="password"><button type="button" class="eye-btn" data-target="newPass2">👁️</button></div></div>
          </div>
          <button id="changePassBtn" class="btn primary" style="margin-top:14px">تغيير كلمة المرور</button>
        </div>
      </div>"""),

("""      <label>كلمة المرور</label><input id="password" type="password" required autocomplete="current-password">""",
"""      <label>كلمة المرور</label><div class="pass-wrap"><input id="password" type="password" required autocomplete="current-password"><button type="button" class="eye-btn" data-target="password">👁️</button></div>"""),

(""".role-chip{font-size:11px;padding:2px 8px;border-radius:99px;background:var(--panel2);color:var(--muted);margin-right:6px}""",
""".pass-wrap{position:relative}.pass-wrap input{padding-left:40px}.eye-btn{position:absolute;left:6px;top:50%;transform:translateY(-50%);background:transparent;color:var(--muted);font-size:16px;padding:6px}
.role-chip{font-size:11px;padding:2px 8px;border-radius:99px;background:var(--panel2);color:var(--muted);margin-right:6px}"""),

("""document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tabs button").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".settings-tab").forEach(x=>x.classList.add("hidden"));$("settings"+b.dataset.tab.charAt(0).toUpperCase()+b.dataset.tab.slice(1)).classList.remove("hidden");if(b.dataset.tab==="trash")loadTrash();if(b.dataset.tab==="accounts")loadAccounts()});""",
"""document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tabs button").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".settings-tab").forEach(x=>x.classList.add("hidden"));$("settings"+b.dataset.tab.charAt(0).toUpperCase()+b.dataset.tab.slice(1)).classList.remove("hidden");if(b.dataset.tab==="trash")loadTrash();if(b.dataset.tab==="accounts")loadMyAccount()});

// Show/hide password toggle (works for the login field and any settings password field)
document.addEventListener("click",e=>{
  if(e.target.classList.contains("eye-btn")){
    const inp=$(e.target.dataset.target);
    inp.type = inp.type==="password" ? "text" : "password";
    e.target.textContent = inp.type==="password" ? "👁️" : "🙈";
  }
});"""),

("""  if(isAdmin()) $("clearLogsBtn").classList.remove("hidden");
  if(isAdmin()) $("adminAccountsCard").classList.remove("hidden");
  loadDashboard();addItem();
}""",
"""  if(isAdmin()) $("clearLogsBtn").classList.remove("hidden");
  loadDashboard();addItem();
}"""),

("""// ---- Accounts: self password change + admin credentials management ----
$("changePassBtn").onclick=async()=>{
  const cur=$("curPass").value, n1=$("newPass").value, n2=$("newPass2").value;
  if(!cur||!n1){toast("من فضلك أدخل كل الحقول");return}
  if(n1!==n2){toast("كلمتا المرور الجديدتان غير متطابقتين");return}
  try{
    await api("/api/account/change-password",{method:"POST",body:JSON.stringify({currentPassword:cur,newPassword:n1})});
    toast("تم تغيير كلمة المرور بنجاح");
    $("curPass").value="";$("newPass").value="";$("newPass2").value="";
  }catch(x){toast(x.message)}
}
async function loadAccounts(){
  if(!isAdmin())return;
  const emps=await api("/api/employees");
  $("accountsTable").innerHTML=`<div class="table-wrap"><table class="table"><thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>كلمة مرور جديدة</th><th></th></tr></thead><tbody>${emps.map(e=>`<tr>
    <td><input value="${esc(e.name)}" data-field="name" data-id="${e.id}" class="acc-input"></td>
    <td><input value="${esc(e.username)}" data-field="username" data-id="${e.id}" class="acc-input"></td>
    <td><input type="password" placeholder="اتركها فارغة لعدم التغيير" data-field="password" data-id="${e.id}" class="acc-input"></td>
    <td><button class="btn primary" onclick="saveAccount(${e.id})">حفظ</button></td>
  </tr>`).join("")}</tbody></table></div>`;
}
async function saveAccount(id){
  const name=document.querySelector(`.acc-input[data-id="${id}"][data-field="name"]`).value.trim();
  const username=document.querySelector(`.acc-input[data-id="${id}"][data-field="username"]`).value.trim();
  const password=document.querySelector(`.acc-input[data-id="${id}"][data-field="password"]`).value.trim();
  try{
    await api("/api/employees/"+id,{method:"PATCH",body:JSON.stringify({name,username,password:password||undefined})});
    toast("تم حفظ بيانات الحساب");
    loadAccounts();
  }catch(x){toast(x.message)}
}
""",
"""// ---- Accounts: everyone manages only their own name/username + password ----
$("changePassBtn").onclick=async()=>{
  const cur=$("curPass").value, n1=$("newPass").value, n2=$("newPass2").value;
  if(!cur||!n1){toast("من فضلك أدخل كل الحقول");return}
  if(n1!==n2){toast("كلمتا المرور الجديدتان غير متطابقتين");return}
  try{
    await api("/api/account/change-password",{method:"POST",body:JSON.stringify({currentPassword:cur,newPassword:n1})});
    toast("تم تغيير كلمة المرور بنجاح");
    $("curPass").value="";$("newPass").value="";$("newPass2").value="";
  }catch(x){toast(x.message)}
}
function loadMyAccount(){
  $("myName").value=currentUser.name;
  $("myUsername").value=currentUser.username;
}
$("saveMyAccountBtn").onclick=async()=>{
  const name=$("myName").value.trim(), username=$("myUsername").value.trim();
  if(!name||!username){toast("من فضلك أدخل الاسم واسم المستخدم");return}
  try{
    const d=await api("/api/account",{method:"PATCH",body:JSON.stringify({name,username})});
    currentUser=d.user;
    $("userName").textContent=currentUser.name;
    toast("تم حفظ بياناتك بنجاح");
  }catch(x){toast(x.message)}
}
"""),
]

h_changed = 0
for old_s, new_s in h_steps:
    if old_s in c:
        c = c.replace(old_s, new_s)
        h_changed += 1

with io.open(hpath, "w", encoding="utf-8") as f:
    f.write(c)
print("index.html: تم تطبيق", h_changed, "من", len(h_steps), "تعديلات")

# ---------------- server.js ----------------
spath = "server.js"
with io.open(spath, "r", encoding="utf-8") as f:
    s = f.read()

s_old = """// Admin: update any employee's login credentials (name / username / password).
app.patch("/api/employees/:id",requireAdmin,(req,res)=>{
  const emp=db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
  if(!emp) return res.status(404).json({error:"الحساب غير موجود"});
  const b=req.body||{};
  const newName = b.name!==undefined && String(b.name).trim() ? String(b.name).trim() : emp.name;
  const newUsername = b.username!==undefined && String(b.username).trim() ? String(b.username).trim() : emp.username;
  const newPassword = b.password!==undefined && String(b.password).trim() ? String(b.password).trim() : emp.password;
  try{
    db.prepare("UPDATE users SET name=?, username=?, password=? WHERE id=?").run(newName,newUsername,newPassword,emp.id);
  }catch(e){
    return res.status(400).json({error:"اسم المستخدم ده مستخدم بالفعل لحساب آخر"});
  }
  res.json({ok:true});
});
"""
s_new = """// Self-service: update my own name / username only (each account manages itself — no
// account can see or edit another account's login details). Password changes go through
// /api/account/change-password above, which already requires the current password.
app.patch("/api/account",auth,(req,res)=>{
  const me=db.prepare("SELECT * FROM users WHERE id=?").get(req.session.user.id);
  const b=req.body||{};
  const newName = b.name!==undefined && String(b.name).trim() ? String(b.name).trim() : me.name;
  const newUsername = b.username!==undefined && String(b.username).trim() ? String(b.username).trim() : me.username;
  try{
    db.prepare("UPDATE users SET name=?, username=? WHERE id=?").run(newName,newUsername,me.id);
    req.session.user.name=newName; req.session.user.username=newUsername;
  }catch(e){
    return res.status(400).json({error:"اسم المستخدم ده مستخدم بالفعل لحساب آخر"});
  }
  res.json({ok:true,user:{id:me.id,name:newName,username:newUsername,role:me.role}});
});
"""
s_changed = 0
if s_old in s:
    s = s.replace(s_old, s_new)
    s_changed = 1

with io.open(spath, "w", encoding="utf-8") as f:
    f.write(s)
print("server.js: تم تطبيق", s_changed, "من 1 تعديل")
