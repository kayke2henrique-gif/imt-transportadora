const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const db = new Database("imt.db");
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || "troque-esta-chave-em-producao";

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: false, maxAge: 1000 * 60 * 60 * 12 }
}));
app.use(express.static(path.join(__dirname, ".")));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'funcionario',
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  description TEXT,
  link TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route TEXT NOT NULL,
  vehicle TEXT NOT NULL,
  price TEXT NOT NULL,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  image TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ombudsman (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta'
);
CREATE TABLE IF NOT EXISTS time_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  paused_seconds INTEGER NOT NULL DEFAULT 0,
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'running'
);
`);

const adminExists = db.prepare("SELECT id FROM users WHERE email = ?").get("admin@imttransportadora.com.br");
if (!adminExists) {
  const hash = bcrypt.hashSync("Troque123!", 10);
  db.prepare("INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)")
    .run("Administrador IMT", "admin@imttransportadora.com.br", hash, "presidente");
}

function auth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Não autenticado." });
  next();
}
function roles(...allowed) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: "Não autenticado." });
    if (!allowed.includes(req.session.user.role)) return res.status(403).json({ error: "Acesso negado." });
    next();
  };
}
function now() { return new Date().toISOString(); }

app.get("/api/me", (req,res) => res.json({ user: req.session.user || null }));

app.post("/api/login", (req,res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND active = 1").get(email);
  if (!user || !bcrypt.compareSync(password || "", user.password))
    return res.status(401).json({ error: "E-mail ou senha inválidos." });
  req.session.user = { id:user.id, name:user.name, email:user.email, role:user.role };
  res.json({ user: req.session.user });
});
app.post("/api/logout", (req,res) => req.session.destroy(() => res.json({ ok:true })));

app.get("/api/notices", (req,res) => {
  res.json(db.prepare("SELECT * FROM notices ORDER BY id DESC").all());
});
app.post("/api/notices", roles("presidente","diretor_comercial","gerente_logistica"), (req,res) => {
  const { title, text, image } = req.body;
  if (!title || !text) return res.status(400).json({error:"Preencha título e texto."});
  const info = db.prepare("INSERT INTO notices(title,text,image,created_at) VALUES(?,?,?,?)").run(title,text,image||"",now());
  res.json({id:info.lastInsertRowid});
});
app.delete("/api/notices/:id", roles("presidente"), (req,res) => {
  db.prepare("DELETE FROM notices WHERE id=?").run(req.params.id); res.json({ok:true});
});

app.get("/api/contracts", auth, (req,res) => {
  res.json(db.prepare("SELECT * FROM contracts ORDER BY id DESC").all());
});
app.post("/api/contracts", roles("presidente","diretor_comercial"), (req,res) => {
  const { title, company, description, link } = req.body;
  if (!title || !company) return res.status(400).json({error:"Título e empresa são obrigatórios."});
  const info = db.prepare("INSERT INTO contracts(title,company,description,link,created_at) VALUES(?,?,?,?,?)")
    .run(title,company,description||"",link||"",now());
  res.json({id:info.lastInsertRowid});
});
app.delete("/api/contracts/:id", roles("presidente"), (req,res) => {
  db.prepare("DELETE FROM contracts WHERE id=?").run(req.params.id); res.json({ok:true});
});

app.get("/api/prices", auth, (req,res) => res.json(db.prepare("SELECT * FROM prices ORDER BY id DESC").all()));
app.post("/api/prices", roles("presidente","diretor_comercial"), (req,res) => {
  const { route, vehicle, price, notes } = req.body;
  if (!route || !vehicle || !price) return res.status(400).json({error:"Preencha rota, veículo e preço."});
  const info = db.prepare("INSERT INTO prices(route,vehicle,price,notes) VALUES(?,?,?,?)").run(route,vehicle,price,notes||"");
  res.json({id:info.lastInsertRowid});
});
app.delete("/api/prices/:id", roles("presidente"), (req,res) => {
  db.prepare("DELETE FROM prices WHERE id=?").run(req.params.id); res.json({ok:true});
});

app.post("/api/ombudsman", (req,res) => {
  const { name, email, message } = req.body;
  if (!message) return res.status(400).json({error:"Escreva sua mensagem."});
  db.prepare("INSERT INTO ombudsman(name,email,message,created_at) VALUES(?,?,?,?)")
    .run(name||"",email||"",message,now());
  res.json({ok:true});
});
app.get("/api/ombudsman", roles("presidente","diretor_comercial","gerente_logistica"), (req,res) => {
  res.json(db.prepare("SELECT * FROM ombudsman ORDER BY id DESC").all());
});
app.patch("/api/ombudsman/:id", roles("presidente","diretor_comercial","gerente_logistica"), (req,res) => {
  db.prepare("UPDATE ombudsman SET status=? WHERE id=?").run(req.body.status || "em análise", req.params.id);
  res.json({ok:true});
});

app.get("/api/time", auth, (req,res) => {
  const log = db.prepare("SELECT * FROM time_logs WHERE user_id=? AND status IN ('running','paused') ORDER BY id DESC LIMIT 1")
    .get(req.session.user.id);
  res.json(log || null);
});
app.post("/api/time/start", auth, (req,res) => {
  const current = db.prepare("SELECT * FROM time_logs WHERE user_id=? AND status IN ('running','paused')").get(req.session.user.id);
  if (current) return res.status(400).json({error:"Já existe um ponto em aberto."});
  const info = db.prepare("INSERT INTO time_logs(user_id,started_at,status) VALUES(?,?,?)").run(req.session.user.id,now(),"running");
  res.json({id:info.lastInsertRowid});
});
app.post("/api/time/pause", auth, (req,res) => {
  const log = db.prepare("SELECT * FROM time_logs WHERE user_id=? AND status='running' ORDER BY id DESC LIMIT 1").get(req.session.user.id);
  if (!log) return res.status(400).json({error:"Nenhum ponto em andamento."});
  const elapsed = Math.max(0, Math.floor((Date.now()-new Date(log.started_at).getTime())/1000));
  db.prepare("UPDATE time_logs SET paused_seconds=paused_seconds+?, status='paused' WHERE id=?").run(elapsed,log.id);
  res.json({ok:true});
});
app.post("/api/time/resume", auth, (req,res) => {
  const log = db.prepare("SELECT * FROM time_logs WHERE user_id=? AND status='paused' ORDER BY id DESC LIMIT 1").get(req.session.user.id);
  if (!log) return res.status(400).json({error:"Nenhum ponto pausado."});
  db.prepare("UPDATE time_logs SET started_at=?, status='running' WHERE id=?").run(now(),log.id);
  res.json({ok:true});
});
app.post("/api/time/finish", auth, (req,res) => {
  const log = db.prepare("SELECT * FROM time_logs WHERE user_id=? AND status IN ('running','paused') ORDER BY id DESC LIMIT 1").get(req.session.user.id);
  if (!log) return res.status(400).json({error:"Nenhum ponto em aberto."});
  let paused = log.paused_seconds;
  if (log.status === "running") paused += Math.max(0,Math.floor((Date.now()-new Date(log.started_at).getTime())/1000));
  db.prepare("UPDATE time_logs SET paused_seconds=?, finished_at=?, status='finished' WHERE id=?").run(paused,now(),log.id);
  res.json({ok:true});
});
app.get("/api/time/all", roles("presidente","gerente_logistica"), (req,res) => {
  res.json(db.prepare(`
    SELECT t.*, u.name, u.email FROM time_logs t
    JOIN users u ON u.id=t.user_id ORDER BY t.id DESC LIMIT 200
  `).all());
});

app.get("/api/users", roles("presidente"), (req,res) => {
  res.json(db.prepare("SELECT id,name,email,role,active FROM users ORDER BY id DESC").all());
});
app.post("/api/users", roles("presidente"), (req,res) => {
  const {name,email,password,role} = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({error:"Preencha todos os campos."});
  try {
    const hash = bcrypt.hashSync(password,10);
    const info = db.prepare("INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)").run(name,email,hash,role);
    res.json({id:info.lastInsertRowid});
  } catch(e) { res.status(400).json({error:"E-mail já cadastrado."}); }
});
app.patch("/api/users/:id", roles("presidente"), (req,res) => {
  const {role,active} = req.body;
  db.prepare("UPDATE users SET role=COALESCE(?,role), active=COALESCE(?,active) WHERE id=?").run(role ?? null, active ?? null, req.params.id);
  res.json({ok:true});
});

app.listen(PORT, () => console.log(`IMT Transportadora rodando em http://localhost:${PORT}`));
