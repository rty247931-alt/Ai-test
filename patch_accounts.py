import io
path = "public/index.html"
with io.open(path, "r", encoding="utf-8") as f:
    c = f.read()

changed = 0

old1 = '''      <div class="tabs">
        <button data-tab="trash" class="active">🗑️ سلة المهملات</button>
        <button data-tab="danger">🔄 محو البيانات</button>
      </div>'''
new1 = '''      <div class="tabs">
        <button data-tab="trash" class="active">🗑️ سلة المهملات</button>
        <button data-tab="accounts">👤 الحسابات</button>
        <button data-tab="danger">🔄 محو البيانات</button>
      </div>'''
if old1 in c:
    c = c.replace(old1, new1); changed += 1

old2 = '''      <div id="settingsDanger" class="settings-tab hidden">'''
new2 = '''      <div id="settingsAccounts" class="settings-tab hidden">
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
      </div>

      <div id="settingsDanger" class="settings-tab hidden">'''
if old2 in c:
    c = c.replace(old2, new2); changed += 1

old3 = '''document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tabs button").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".settings-tab").forEach(x=>x.classList.add("hidden"));$("settings"+b.dataset.tab.charAt(0).toUpperCase()+b.dataset.tab.slice(1)).classList.remove("hidden")});'''
new3 = '''document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tabs button").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".settings-tab").forEach(x=>x.classList.add("hidden"));$("settings"+b.dataset.tab.charAt(0).toUpperCase()+b.dataset.tab.slice(1)).classList.remove("hidden");if(b.dataset.tab==="trash")loadTrash();if(b.dataset.tab==="accounts")loadAccounts()});'''
if old3 in c:
    c = c.replace(old3, new3); changed += 1

old4 = '''  if(isAdmin()) $("clearLogsBtn").classList.remove("hidden");
  loadDashboard();addItem();'''
new4 = '''  if(isAdmin()) $("clearLogsBtn").classList.remove("hidden");
  if(isAdmin()) $("adminAccountsCard").classList.remove("hidden");
  loadDashboard();addItem();'''
if old4 in c:
    c = c.replace(old4, new4); changed += 1

old5 = '''async function loadTrash(){
  const params={view:"trash"};
  if(isAdmin()) params.employee=employeeParam();
  const rows=await api("/api/invoices?"+new URLSearchParams(params));
  $("trashTable").innerHTML=table(rows,"trash");
}
'''
new5 = '''async function loadTrash(){
  const params={view:"trash"};
  if(isAdmin()) params.employee=employeeParam();
  const rows=await api("/api/invoices?"+new URLSearchParams(params));
  $("trashTable").innerHTML=table(rows,"trash");
}

// ---- Accounts: self password change + admin credentials management ----
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
'''
if old5 in c:
    c = c.replace(old5, new5); changed += 1

with io.open(path, "w", encoding="utf-8") as f:
    f.write(c)

print("تم تطبيق", changed, "من 5 تعديلات")
if changed < 5:
    print("تحذير: مش كل التعديلات اتطبقت — يمكن يكون الملف اتغيّر قبل كده.")
