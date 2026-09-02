const express = require("express");
const session = require("express-session");
const { DatabaseSync } = require("node:sqlite"); // built into Node.js — no native compilation needed
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new DatabaseSync(path.join(__dirname, "data.db"));
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  student_name TEXT NOT NULL,
  phone TEXT,
  grade TEXT,
  teacher TEXT,
  note TEXT,
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'محجوز',
  created_by INTEGER,
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  delivered_by INTEGER,
  FOREIGN KEY(created_by) REFERENCES users(id),
  FOREIGN KEY(delivered_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  book TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price REAL NOT NULL DEFAULT 0,
  FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  invoice_id INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(invoice_id) REFERENCES invoices(id)
);
`);

// ---- Lightweight migrations (add columns if this DB predates them) ----
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
ensureColumn("users", "role", "role TEXT NOT NULL DEFAULT 'employee'");
ensureColumn("invoices", "archived_at", "archived_at TEXT");
ensureColumn("invoices", "archived_by", "archived_by INTEGER");
ensureColumn("invoices", "deleted_at", "deleted_at TEXT");
ensureColumn("invoices", "deleted_by", "deleted_by INTEGER");

// No manager hierarchy: everyone is an admin. Upgrade any pre-existing "employee" accounts too.
db.exec("UPDATE users SET role='admin' WHERE role!='admin'");

const userCount = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
if (!userCount) {
  const add = db.prepare("INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)");
  add.run("محمد نبيه", "mohamed", "123456", "admin");
  add.run("علي جبله", "ali", "123456", "admin");
}

app.use(express.json({limit:"1mb"}));
app.use(express.urlencoded({extended:true}));
app.use(session({
  secret: process.env.SESSION_SECRET || "manfaz-kharita-change-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", maxAge: 1000*60*60*12 }
}));
app.use(express.static(path.join(__dirname, "public")));

function auth(req,res,next){
  if(!req.session.user) return res.status(401).json({error:"غير مسجل الدخول"});
  next();
}
function requireAdmin(req,res,next){
  if(!req.session.user) return res.status(401).json({error:"غير مسجل الدخول"});
  if(req.session.user.role!=="admin") return res.status(403).json({error:"هذا الإجراء يتطلب صلاحية إدارية"});
  next();
}
function isAdmin(req){ return req.session.user && req.session.user.role==="admin"; }
function now(){
  return new Date().toISOString();
}
function makeCode(){
  const n = Date.now().toString().slice(-8);
  return `MK-${n}`;
}
function log(userId, action, invoiceId=null){
  db.prepare("INSERT INTO activity_log(user_id, action, invoice_id, created_at) VALUES(?,?,?,?)")
    .run(userId, action, invoiceId, now());
}

// Resolves an invoice while enforcing ownership (owner or admin only).
function getOwnedInvoice(req, id){
  const inv = db.prepare("SELECT * FROM invoices WHERE id=?").get(id);
  if(!inv) return {error:404,message:"الفاتورة غير موجودة"};
  if(!isAdmin(req) && inv.created_by !== req.session.user.id) return {error:403,message:"لا يمكنك التعامل مع بيانات موظف آخر"};
  return {inv};
}

// Builds the "which employee's rows am I allowed to see" SQL clause + params.
// employeeParam: 'all' (admin only) or a specific user id, or undefined (defaults to self).
// column: the fully-qualified owner column for the table being queried (e.g. "i.created_by", "a.user_id").
function ownerScope(req, employeeParam, column="i.created_by"){
  if(isAdmin(req)){
    if(employeeParam && employeeParam!=="all"){
      return {sql:`${column}=?`, params:[Number(employeeParam)]};
    }
    return {sql:"1=1", params:[]};
  }
  return {sql:`${column}=?`, params:[req.session.user.id]};
}

app.get("/api/me",(req,res)=>res.json({user:req.session.user || null}));
app.post("/api/login",(req,res)=>{
  const {username,password} = req.body;
  const user = db.prepare("SELECT id,name,username,role FROM users WHERE username=? AND password=?").get(username,password);
  if(!user) return res.status(401).json({error:"اسم المستخدم أو كلمة المرور غير صحيحة"});
  req.session.user = user;
  res.json({user});
});
app.post("/api/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));

app.get("/api/employees",requireAdmin,(req,res)=>{
  res.json(db.prepare("SELECT id,name,username,role FROM users ORDER BY name").all());
});

// Self-service: change my own password (any logged-in user, requires current password).
app.post("/api/account/change-password",auth,(req,res)=>{
  const {currentPassword,newPassword}=req.body||{};
  if(!currentPassword || !newPassword) return res.status(400).json({error:"كل الحقول مطلوبة"});
  if(String(newPassword).trim().length<4) return res.status(400).json({error:"كلمة المرور الجديدة قصيرة جدًا (٤ أحرف على الأقل)"});
  const user=db.prepare("SELECT * FROM users WHERE id=?").get(req.session.user.id);
  if(!user || user.password!==currentPassword) return res.status(400).json({error:"كلمة المرور الحالية غير صحيحة"});
  db.prepare("UPDATE users SET password=? WHERE id=?").run(String(newPassword).trim(),user.id);
  res.json({ok:true});
});

// Self-service: update my own name / username only (each account manages itself — no
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

app.get("/api/stats",auth,(req,res)=>{
  const {sql,params}=ownerScope(req, req.query.employee);
  const base = `FROM invoices i WHERE ${sql} AND i.archived_at IS NULL AND i.deleted_at IS NULL`;
  const total = db.prepare(`SELECT COALESCE(SUM(i.total),0) x ${base} AND i.status!='ملغي'`).get(...params).x;
  const reservations = db.prepare(`SELECT COUNT(*) x ${base} AND i.status='محجوز'`).get(...params).x;
  const delivered = db.prepare(`SELECT COUNT(*) x ${base} AND i.status='تم التسليم'`).get(...params).x;
  const cancelled = db.prepare(`SELECT COUNT(*) x ${base} AND i.status='ملغي'`).get(...params).x;
  const invoices = db.prepare(`SELECT COUNT(*) x ${base}`).get(...params).x;
  const trashCount = db.prepare(`SELECT COUNT(*) x FROM invoices i WHERE ${sql} AND i.deleted_at IS NOT NULL`).get(...params).x;
  res.json({total,reservations,delivered,cancelled,invoices,trashCount});
});

app.get("/api/suggestions",auth,(req,res)=>{
  const q = String(req.query.q || "").trim();
  const like = `%${q}%`;
  const teachers = db.prepare("SELECT name FROM teachers WHERE name LIKE ? ORDER BY name LIMIT 10").all(like).map(x=>x.name);
  const books = db.prepare("SELECT name FROM books WHERE name LIKE ? ORDER BY name LIMIT 10").all(like).map(x=>x.name);
  res.json({teachers,books});
});

// view: active (default) | archived | trash
app.get("/api/invoices",auth,(req,res)=>{
  const q = String(req.query.q || "").trim();
  const status = String(req.query.status || "");
  const view = String(req.query.view || "active");
  const {sql:ownerSql,params:ownerParams} = ownerScope(req, req.query.employee);

  let sql = `SELECT i.*, u.name created_by_name FROM invoices i
             LEFT JOIN users u ON u.id=i.created_by WHERE ${ownerSql}`;
  const params=[...ownerParams];

  if(view==="archived") sql += " AND i.archived_at IS NOT NULL AND i.deleted_at IS NULL";
  else if(view==="trash") sql += " AND i.deleted_at IS NOT NULL";
  else sql += " AND i.archived_at IS NULL AND i.deleted_at IS NULL";

  if(q){
    sql += ` AND (i.student_name LIKE ? OR i.phone LIKE ? OR i.code LIKE ? OR i.teacher LIKE ?)`;
    const like=`%${q}%`; params.push(like,like,like,like);
  }
  if(status){ sql += " AND i.status=?"; params.push(status); }
  sql += view==="trash" ? " ORDER BY i.deleted_at DESC LIMIT 300" : " ORDER BY i.id DESC LIMIT 300";
  const rows=db.prepare(sql).all(...params);
  const getItems=db.prepare("SELECT id,book,quantity,price FROM invoice_items WHERE invoice_id=? ORDER BY id");
  res.json(rows.map(r=>({...r,items:getItems.all(r.id)})));
});

app.get("/api/invoices/:id",auth,(req,res)=>{
  const {error,message,inv:owned}=getOwnedInvoice(req,req.params.id);
  if(error) return res.status(error).json({error:message});
  const inv=db.prepare(`SELECT i.*, u.name created_by_name, d.name delivered_by_name
                        FROM invoices i
                        LEFT JOIN users u ON u.id=i.created_by
                        LEFT JOIN users d ON d.id=i.delivered_by
                        WHERE i.id=?`).get(owned.id);
  inv.items=db.prepare("SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY id").all(inv.id);
  res.json(inv);
});

app.post("/api/invoices",auth,(req,res)=>{
  const b=req.body;
  if(!b.student_name || !Array.isArray(b.items) || !b.items.length)
    return res.status(400).json({error:"اسم الطالب وكتاب واحد على الأقل مطلوبان"});
  const items=b.items.map(x=>({
    book:String(x.book||"").trim(),
    quantity:Math.max(1,Number(x.quantity)||1),
    price:Math.max(0,Number(x.price)||0)
  })).filter(x=>x.book);
  if(!items.length) return res.status(400).json({error:"أدخل اسم كتاب صحيح"});
  const total=items.reduce((s,x)=>s+x.quantity*x.price,0);
  let code=makeCode();
  while(db.prepare("SELECT 1 FROM invoices WHERE code=?").get(code)) code=makeCode()+Math.floor(Math.random()*9);

  let invoiceId;
  try{
    db.exec("BEGIN");
    const result=db.prepare(`INSERT INTO invoices
      (code,student_name,phone,grade,teacher,note,total,status,created_by,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(code,String(b.student_name).trim(),b.phone||"",b.grade||"",b.teacher||"",b.note||"",total,"محجوز",req.session.user.id,now());
    invoiceId=Number(result.lastInsertRowid);
    const itemStmt=db.prepare("INSERT INTO invoice_items(invoice_id,book,quantity,price) VALUES(?,?,?,?)");
    for(const x of items){
      itemStmt.run(invoiceId,x.book,x.quantity,x.price);
      db.prepare("INSERT OR IGNORE INTO books(name) VALUES(?)").run(x.book);
    }
    if(String(b.teacher||"").trim())
      db.prepare("INSERT OR IGNORE INTO teachers(name) VALUES(?)").run(String(b.teacher).trim());
    log(req.session.user.id,"إنشاء فاتورة",invoiceId);
    db.exec("COMMIT");
  }catch(e){
    db.exec("ROLLBACK");
    return res.status(500).json({error:"تعذر حفظ الفاتورة"});
  }
  res.json({ok:true,id:invoiceId,code});
});

app.post("/api/invoices/:id/deliver",auth,(req,res)=>{
  const {error,message,inv}=getOwnedInvoice(req,req.params.id);
  if(error) return res.status(error).json({error:message});
  if(inv.status==="ملغي") return res.status(400).json({error:"لا يمكن تسليم فاتورة ملغاة"});
  db.prepare("UPDATE invoices SET status='تم التسليم', delivered_at=?, delivered_by=? WHERE id=?")
    .run(now(),req.session.user.id,inv.id);
  log(req.session.user.id,"تأكيد تسليم الفاتورة",inv.id);
  res.json({ok:true});
});

app.post("/api/invoices/:id/cancel",auth,(req,res)=>{
  const {error,message,inv}=getOwnedInvoice(req,req.params.id);
  if(error) return res.status(error).json({error:message});
  db.prepare("UPDATE invoices SET status='ملغي' WHERE id=?").run(inv.id);
  log(req.session.user.id,"إلغاء الفاتورة",inv.id);
  res.json({ok:true});
});

// ---- Archive ----
app.post("/api/invoices/:id/archive",auth,(req,res)=>{
  const {error,message,inv}=getOwnedInvoice(req,req.params.id);
  if(error) return res.status(error).json({error:message});
  if(inv.deleted_at) return res.status(400).json({error:"العنصر موجود في سلة المهملات"});
  db.prepare("UPDATE invoices SET archived_at=?, archived_by=? WHERE id=?").run(now(),req.session.user.id,inv.id);
  log(req.session.user.id,"أرشفة الفاتورة",inv.id);
  res.json({ok:true});
});

app.post("/api/invoices/:id/unarchive",auth,(req,res)=>{
  const {error,message,inv}=getOwnedInvoice(req,req.params.id);
  if(error) return res.status(error).json({error:message});
  db.prepare("UPDATE invoices SET archived_at=NULL, archived_by=NULL WHERE id=?").run(inv.id);
  log(req.session.user.id,"إخراج الفاتورة من الأرشيف",inv.id);
  res.json({ok:true});
});

// ---- Trash (soft delete) ----
app.post("/api/invoices/:id/delete",auth,(req,res)=>{
  const {error,message,inv}=getOwnedInvoice(req,req.params.id);
  if(error) return res.status(error).json({error:message});
  if(inv.deleted_at) return res.status(400).json({error:"العنصر موجود بالفعل في سلة المهملات"});
  db.prepare("UPDATE invoices SET deleted_at=?, deleted_by=? WHERE id=?").run(now(),req.session.user.id,inv.id);
  log(req.session.user.id,"نقل الفاتورة إلى سلة المهملات",inv.id);
  res.json({ok:true});
});

app.post("/api/invoices/:id/restore",auth,(req,res)=>{
  const {error,message,inv}=getOwnedInvoice(req,req.params.id);
  if(error) return res.status(error).json({error:message});
  if(!inv.deleted_at) return res.status(400).json({error:"العنصر ليس في سلة المهملات"});
  db.prepare("UPDATE invoices SET deleted_at=NULL, deleted_by=NULL WHERE id=?").run(inv.id);
  log(req.session.user.id,"استرجاع الفاتورة من سلة المهملات",inv.id);
  res.json({ok:true});
});

// Permanent delete of a single trashed item (owner or admin), irreversible.
app.delete("/api/invoices/:id/permanent",auth,(req,res)=>{
  const {error,message,inv}=getOwnedInvoice(req,req.params.id);
  if(error) return res.status(error).json({error:message});
  if(!inv.deleted_at) return res.status(400).json({error:"يجب نقل العنصر إلى سلة المهملات أولاً"});
  try{
    db.exec("BEGIN");
    db.prepare("UPDATE activity_log SET invoice_id=NULL WHERE invoice_id=?").run(inv.id);
    db.prepare("DELETE FROM invoices WHERE id=?").run(inv.id);
    log(req.session.user.id,`حذف نهائي للفاتورة ${inv.code}`,null);
    db.exec("COMMIT");
  }catch(e){
    db.exec("ROLLBACK");
    return res.status(500).json({error:"تعذر الحذف النهائي"});
  }
  res.json({ok:true});
});

// Empty the whole trash (admin only, irreversible). Scoped by ?employee= if provided.
app.post("/api/trash/empty",requireAdmin,(req,res)=>{
  if(req.body?.confirm !== true) return res.status(400).json({error:"تأكيد الحذف النهائي مطلوب"});
  const {sql,params}=ownerScope(req, req.query.employee || req.body.employee, "created_by");
  let count=0;
  try{
    db.exec("BEGIN");
    db.prepare(`UPDATE activity_log SET invoice_id=NULL WHERE invoice_id IN (SELECT id FROM invoices WHERE ${sql} AND deleted_at IS NOT NULL)`).run(...params);
    const del=db.prepare(`DELETE FROM invoices WHERE ${sql} AND deleted_at IS NOT NULL`);
    count=del.run(...params).changes;
    log(req.session.user.id,`إفراغ سلة المهملات نهائيًا (${count} عنصر)`,null);
    db.exec("COMMIT");
  }catch(e){
    db.exec("ROLLBACK");
    return res.status(500).json({error:"تعذر إفراغ سلة المهملات"});
  }
  res.json({ok:true,count});
});

// "Clear my data": moves the current user's own active + archived invoices into their trash.
app.post("/api/clear-my-data",auth,(req,res)=>{
  if(req.body?.confirm !== true) return res.status(400).json({error:"التأكيد مطلوب"});
  const result=db.prepare(`UPDATE invoices SET deleted_at=?, deleted_by=?
     WHERE created_by=? AND deleted_at IS NULL`).run(now(),req.session.user.id,req.session.user.id);
  log(req.session.user.id,`محو جميع البيانات (نقل ${result.changes} عنصر إلى سلة المهملات)`,null);
  res.json({ok:true,count:result.changes});
});

app.get("/api/logs",auth,(req,res)=>{
  const {sql,params}=ownerScope(req, req.query.employee, "a.user_id");
  const rows=db.prepare(`SELECT a.*,u.name user_name,i.code invoice_code
    FROM activity_log a LEFT JOIN users u ON u.id=a.user_id
    LEFT JOIN invoices i ON i.id=a.invoice_id
    WHERE ${sql} ORDER BY a.id DESC LIMIT 200`).all(...params);
  res.json(rows);
});

// Delete a single log entry (owner of the entry, or admin).
app.delete("/api/logs/:id",auth,(req,res)=>{
  const entry=db.prepare("SELECT * FROM activity_log WHERE id=?").get(req.params.id);
  if(!entry) return res.status(404).json({error:"العملية غير موجودة"});
  if(!isAdmin(req) && entry.user_id!==req.session.user.id) return res.status(403).json({error:"لا يمكنك حذف عمليات موظف آخر"});
  db.prepare("DELETE FROM activity_log WHERE id=?").run(entry.id);
  res.json({ok:true});
});

// Clear the whole activity log (admin only), scoped by ?employee= if provided. Irreversible.
app.delete("/api/logs",requireAdmin,(req,res)=>{
  const {sql,params}=ownerScope(req, req.query.employee, "user_id");
  const result=db.prepare(`DELETE FROM activity_log WHERE ${sql}`).run(...params);
  res.json({ok:true,count:result.changes});
});

app.use((req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`منفذ خريطة يعمل على http://127.0.0.1:${PORT}`));
