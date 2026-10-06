const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const db = new Database('imt.db');
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'troque-esta-chave-em-producao';

app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));
app.use(session({ secret: SESSION_SECRET, resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 1000*60*60*12 } }));
app.use(express.static(path.join(__dirname, 'public')));

function addColumn(sql){ try { db.exec(sql); } catch(e){ if(!String(e.message).includes('duplicate column name')) throw e; } }

db.exec(`
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'funcionario',active INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS contracts (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,company TEXT NOT NULL,description TEXT,link TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS prices (id INTEGER PRIMARY KEY AUTOINCREMENT,route TEXT NOT NULL,vehicle TEXT NOT NULL,price TEXT NOT NULL,notes TEXT);
CREATE TABLE IF NOT EXISTS notices (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,text TEXT NOT NULL,image TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ombudsman (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,email TEXT,message TEXT NOT NULL,created_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'aberta');
CREATE TABLE IF NOT EXISTS time_logs (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,started_at TEXT NOT NULL,paused_seconds INTEGER NOT NULL DEFAULT 0,finished_at TEXT,status TEXT NOT NULL DEFAULT 'running');
CREATE TABLE IF NOT EXISTS carousel (id INTEGER PRIMARY KEY AUTOINCREMENT,kicker TEXT,title TEXT NOT NULL,text TEXT,image TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS registration_requests (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,created_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pendente');
`);
for(const sql of [
  "ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''",
  "ALTER TABLE users ADD COLUMN department TEXT DEFAULT ''",
  "ALTER TABLE users ADD COLUMN admission_date TEXT DEFAULT ''",
  "ALTER TABLE users ADD COLUMN notes TEXT DEFAULT ''",
  "ALTER TABLE users ADD COLUMN last_login TEXT DEFAULT ''"
]) addColumn(sql);

const adminEmail='admin@imttransportadora.com.br';
if(!db.prepare('SELECT id FROM users WHERE email=?').get(adminEmail)){
  db.prepare('INSERT INTO users(name,email,password,role,active) VALUES(?,?,?,?,1)').run('Administrador IMT',adminEmail,bcrypt.hashSync('Troque123!',10),'presidente');
}
if(!db.prepare('SELECT id FROM carousel').get()){
  const ins=db.prepare('INSERT INTO carousel(kicker,title,text,image,active,sort_order) VALUES(?,?,?,?,1,?)');
  ins.run('NA ESTRADA','Segurança em cada quilômetro','Operações planejadas e foco total no cuidado com pessoas e cargas.','https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=1800&q=80',0);
  ins.run('FROTA','Força para chegar mais longe','Uma operação preparada para diferentes necessidades de transporte.','https://images.unsplash.com/photo-1601584115197-04ecc0da31d8?auto=format&fit=crop&w=1800&q=80',1);
  ins.run('COMPROMISSO','Cada entrega importa','Relacionamento, responsabilidade e transparência do início ao fim.','https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=1800&q=80',2);
}
if(!db.prepare('SELECT key FROM settings WHERE key="radio_url"').get()) db.prepare('INSERT INTO settings(key,value) VALUES("radio_url","")').run();
if(!db.prepare('SELECT key FROM settings WHERE key="radio_name"').get()) db.prepare('INSERT INTO settings(key,value) VALUES("radio_name","Rádio IMT")').run();

function now(){return new Date().toISOString();}
function auth(req,res,next){if(!req.session.user)return res.status(401).json({error:'Não autenticado.'});next();}
function roles(...allowed){return (req,res,next)=>{if(!req.session.user)return res.status(401).json({error:'Não autenticado.'});if(!allowed.includes(req.session.user.role))return res.status(403).json({error:'Acesso não autorizado.'});next();};}
const siteManagers=['presidente','gestor_site'];
const priceManagers=['presidente','gestor_site','diretor_comercial'];
const ombManagers=['presidente','gestor_site','diretor_comercial','gerente_logistica'];

app.get('/api/me',(req,res)=>res.json({user:req.session.user||null}));
app.post('/api/login',(req,res)=>{const email=String(req.body.email||'').trim().toLowerCase();const user=db.prepare('SELECT * FROM users WHERE email=?').get(email);if(!user||!user.active||!bcrypt.compareSync(req.body.password||'',user.password))return res.status(401).json({error:user&&!user.active?'Usuário ainda não foi autorizado.':'E-mail ou senha inválidos.'});db.prepare('UPDATE users SET last_login=? WHERE id=?').run(now(),user.id);req.session.user={id:user.id,name:user.name,email:user.email,role:user.role};res.json({user:req.session.user});});
app.post('/api/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));

app.post('/api/register',(req,res)=>{const {name,email,password}=req.body;const e=String(email||'').trim().toLowerCase();if(!name||!e||!password)return res.status(400).json({error:'Preencha nome, e-mail e senha.'});if(password.length<6)return res.status(400).json({error:'A senha precisa ter pelo menos 6 caracteres.'});if(db.prepare('SELECT id FROM users WHERE email=?').get(e)||db.prepare('SELECT id FROM registration_requests WHERE email=? AND status="pendente"').get(e))return res.status(400).json({error:'Este e-mail já está cadastrado ou aguardando autorização.'});db.prepare('INSERT INTO registration_requests(name,email,password,created_at) VALUES(?,?,?,?)').run(name,e,bcrypt.hashSync(password,10),now());res.json({ok:true});});

app.get('/api/carousel',(req,res)=>res.json(db.prepare('SELECT * FROM carousel WHERE active=1 ORDER BY sort_order,id').all()));
app.get('/api/carousel/all',roles(...siteManagers),(req,res)=>res.json(db.prepare('SELECT * FROM carousel ORDER BY sort_order,id').all()));
app.post('/api/carousel',roles(...siteManagers),(req,res)=>{const {kicker,title,text,image,sort_order}=req.body;if(!title||!image)return res.status(400).json({error:'Título e imagem são obrigatórios.'});const info=db.prepare('INSERT INTO carousel(kicker,title,text,image,sort_order) VALUES(?,?,?,?,?)').run(kicker||'',title,text||'',image,Number(sort_order)||0);res.json({id:info.lastInsertRowid});});
app.patch('/api/carousel/:id',roles(...siteManagers),(req,res)=>{const old=db.prepare('SELECT * FROM carousel WHERE id=?').get(req.params.id);if(!old)return res.status(404).json({error:'Slide não encontrado.'});const x={...old,...req.body};db.prepare('UPDATE carousel SET kicker=?,title=?,text=?,image=?,active=?,sort_order=? WHERE id=?').run(x.kicker||'',x.title||'',x.text||'',x.image||'',Number(x.active)?1:0,Number(x.sort_order)||0,req.params.id);res.json({ok:true});});
app.delete('/api/carousel/:id',roles(...siteManagers),(req,res)=>{db.prepare('DELETE FROM carousel WHERE id=?').run(req.params.id);res.json({ok:true});});

app.get('/api/contracts',auth,(req,res)=>res.json(db.prepare('SELECT * FROM contracts ORDER BY id DESC').all()));
app.post('/api/contracts',roles('presidente','gestor_site','diretor_comercial'),(req,res)=>{const {title,company,description,link}=req.body;if(!title||!company)return res.status(400).json({error:'Título e empresa são obrigatórios.'});const info=db.prepare('INSERT INTO contracts(title,company,description,link,created_at) VALUES(?,?,?,?,?)').run(title,company,description||'',link||'',now());res.json({id:info.lastInsertRowid});});
app.delete('/api/contracts/:id',roles('presidente'),(req,res)=>{db.prepare('DELETE FROM contracts WHERE id=?').run(req.params.id);res.json({ok:true});});

app.get('/api/prices',auth,(req,res)=>res.json(db.prepare('SELECT * FROM prices ORDER BY id DESC').all()));
app.post('/api/prices',roles(...priceManagers),(req,res)=>{const {route,vehicle,price,notes}=req.body;if(!route||!vehicle||!price)return res.status(400).json({error:'Preencha rota, veículo e preço.'});const info=db.prepare('INSERT INTO prices(route,vehicle,price,notes) VALUES(?,?,?,?)').run(route,vehicle,price,notes||'');res.json({id:info.lastInsertRowid});});
app.delete('/api/prices/:id',roles('presidente','gestor_site'),(req,res)=>{db.prepare('DELETE FROM prices WHERE id=?').run(req.params.id);res.json({ok:true});});

app.post('/api/ombudsman',(req,res)=>{const {name,email,message}=req.body;if(!message)return res.status(400).json({error:'Escreva sua mensagem.'});db.prepare('INSERT INTO ombudsman(name,email,message,created_at) VALUES(?,?,?,?)').run(name||'',email||'',message,now());res.json({ok:true});});
app.get('/api/ombudsman',roles(...ombManagers),(req,res)=>res.json(db.prepare('SELECT * FROM ombudsman ORDER BY id DESC').all()));
app.patch('/api/ombudsman/:id',roles(...ombManagers),(req,res)=>{db.prepare('UPDATE ombudsman SET status=? WHERE id=?').run(req.body.status||'em análise',req.params.id);res.json({ok:true});});

app.get('/api/radio',(req,res)=>{const rows=db.prepare('SELECT key,value FROM settings WHERE key IN ("radio_url","radio_name")').all();const out={};rows.forEach(x=>out[x.key]=x.value);res.json(out);});
app.patch('/api/radio',roles(...siteManagers),(req,res)=>{db.prepare('INSERT INTO settings(key,value) VALUES("radio_url",?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(req.body.url||'');db.prepare('INSERT INTO settings(key,value) VALUES("radio_name",?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(req.body.name||'Rádio IMT');res.json({ok:true});});

app.get('/api/time',auth,(req,res)=>res.json(db.prepare("SELECT * FROM time_logs WHERE user_id=? AND status IN ('running','paused') ORDER BY id DESC LIMIT 1").get(req.session.user.id)||null));
app.post('/api/time/start',auth,(req,res)=>{if(db.prepare("SELECT id FROM time_logs WHERE user_id=? AND status IN ('running','paused')").get(req.session.user.id))return res.status(400).json({error:'Já existe um ponto em aberto.'});const info=db.prepare('INSERT INTO time_logs(user_id,started_at,status) VALUES(?,?,?)').run(req.session.user.id,now(),'running');res.json({id:info.lastInsertRowid});});
app.post('/api/time/pause',auth,(req,res)=>{const log=db.prepare("SELECT * FROM time_logs WHERE user_id=? AND status='running' ORDER BY id DESC LIMIT 1").get(req.session.user.id);if(!log)return res.status(400).json({error:'Nenhum ponto em andamento.'});const elapsed=Math.max(0,Math.floor((Date.now()-new Date(log.started_at).getTime())/1000));db.prepare("UPDATE time_logs SET paused_seconds=paused_seconds+?,status='paused' WHERE id=?").run(elapsed,log.id);res.json({ok:true});});
app.post('/api/time/resume',auth,(req,res)=>{const log=db.prepare("SELECT * FROM time_logs WHERE user_id=? AND status='paused' ORDER BY id DESC LIMIT 1").get(req.session.user.id);if(!log)return res.status(400).json({error:'Nenhum ponto pausado.'});db.prepare("UPDATE time_logs SET started_at=?,status='running' WHERE id=?").run(now(),log.id);res.json({ok:true});});
app.post('/api/time/finish',auth,(req,res)=>{const log=db.prepare("SELECT * FROM time_logs WHERE user_id=? AND status IN ('running','paused') ORDER BY id DESC LIMIT 1").get(req.session.user.id);if(!log)return res.status(400).json({error:'Nenhum ponto em aberto.'});let paused=log.paused_seconds;if(log.status==='running')paused+=Math.max(0,Math.floor((Date.now()-new Date(log.started_at).getTime())/1000));db.prepare("UPDATE time_logs SET paused_seconds=?,finished_at=?,status='finished' WHERE id=?").run(paused,now(),log.id);res.json({ok:true});});
app.get('/api/time/all',roles('presidente','gerente_logistica','gestor_site'),(req,res)=>res.json(db.prepare('SELECT t.*,u.name,u.email FROM time_logs t JOIN users u ON u.id=t.user_id ORDER BY t.id DESC LIMIT 300').all()));
app.get('/api/users/:id/time',roles('presidente','gerente_logistica','gestor_site'),(req,res)=>res.json(db.prepare('SELECT * FROM time_logs WHERE user_id=? ORDER BY id DESC LIMIT 100').all(req.params.id)));

app.get('/api/users',roles('presidente'),(req,res)=>res.json(db.prepare('SELECT id,name,email,phone,department,admission_date,notes,role,active,last_login FROM users ORDER BY id DESC').all()));
app.get('/api/registrations',roles('presidente'),(req,res)=>res.json(db.prepare('SELECT id,name,email,created_at,status FROM registration_requests WHERE status="pendente" ORDER BY id DESC').all()));
app.post('/api/users/approve/:id',roles('presidente'),(req,res)=>{const r=db.prepare('SELECT * FROM registration_requests WHERE id=? AND status="pendente"').get(req.params.id);if(!r)return res.status(404).json({error:'Solicitação não encontrada.'});const role=req.body.role||'funcionario';db.prepare('INSERT INTO users(name,email,password,role,active) VALUES(?,?,?,?,1)').run(r.name,r.email,r.password,role);db.prepare('UPDATE registration_requests SET status="aprovada" WHERE id=?').run(r.id);res.json({ok:true});});
app.post('/api/users/reject/:id',roles('presidente'),(req,res)=>{db.prepare('UPDATE registration_requests SET status="recusada" WHERE id=?').run(req.params.id);res.json({ok:true});});
app.post('/api/users',roles('presidente'),(req,res)=>{const {name,email,password,role,phone,department,admission_date,notes}=req.body;if(!name||!email||!password||!role)return res.status(400).json({error:'Preencha nome, e-mail, senha e cargo.'});try{const info=db.prepare('INSERT INTO users(name,email,password,role,phone,department,admission_date,notes,active) VALUES(?,?,?,?,?,?,?,?,1)').run(name,String(email).trim().toLowerCase(),bcrypt.hashSync(password,10),role,phone||'',department||'',admission_date||'',notes||'');res.json({id:info.lastInsertRowid});}catch(e){res.status(400).json({error:'E-mail já cadastrado.'});}});
app.patch('/api/users/:id',roles('presidente'),(req,res)=>{const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);if(!u)return res.status(404).json({error:'Usuário não encontrado.'});const x={...u,...req.body};let sql='UPDATE users SET name=?,email=?,phone=?,department=?,admission_date=?,notes=?,role=?,active=?';let args=[x.name,x.email,x.phone||'',x.department||'',x.admission_date||'',x.notes||'',x.role,Number(x.active)?1:0];if(req.body.password){sql+=',password=?';args.push(bcrypt.hashSync(req.body.password,10));}sql+=' WHERE id=?';args.push(req.params.id);try{db.prepare(sql).run(...args);if(req.session.user.id==u.id)req.session.user={id:u.id,name:x.name,email:x.email,role:x.role};res.json({ok:true});}catch(e){res.status(400).json({error:'Não foi possível salvar. Verifique o e-mail.'});}});

app.patch('/api/profile',auth,(req,res)=>{const {name,email,password}=req.body;const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.session.user.id);const newEmail=String(email||u.email).trim().toLowerCase();if(!name||!newEmail)return res.status(400).json({error:'Nome e e-mail são obrigatórios.'});const dup=db.prepare('SELECT id FROM users WHERE email=? AND id<>?').get(newEmail,u.id);if(dup)return res.status(400).json({error:'Este e-mail já está em uso.'});let sql='UPDATE users SET name=?,email=?';let args=[name,newEmail];if(password){if(password.length<6)return res.status(400).json({error:'A nova senha precisa ter pelo menos 6 caracteres.'});sql+=',password=?';args.push(bcrypt.hashSync(password,10));}sql+=' WHERE id=?';args.push(u.id);db.prepare(sql).run(...args);req.session.user={id:u.id,name,email:newEmail,role:u.role};res.json({user:req.session.user});});

app.get('/api/dashboard',roles('presidente','gestor_site','gerente_logistica'),(req,res)=>{res.json({employees:db.prepare('SELECT count(*) c FROM users WHERE active=1').get().c,activePoints:db.prepare("SELECT count(*) c FROM time_logs WHERE status IN ('running','paused')").get().c,openOmb:db.prepare("SELECT count(*) c FROM ombudsman WHERE status='aberta'").get().c});});

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,()=>console.log(`IMT Transportadora online na porta ${PORT}`));
