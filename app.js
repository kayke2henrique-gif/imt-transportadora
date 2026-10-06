let me=null, currentLog=null, timer=null;
const $=s=>document.querySelector(s);
document.querySelector("#year").textContent=new Date().getFullYear();

document.querySelectorAll(".dots button").forEach(b=>b.onclick=()=>showSlide(+b.dataset.i));
let slideIndex=0; setInterval(()=>showSlide((slideIndex+1)%3),5000);
function showSlide(i){slideIndex=i;document.querySelectorAll(".slide").forEach((s,j)=>s.classList.toggle("active",j===i));document.querySelectorAll(".dots button").forEach((b,j)=>b.classList.toggle("on",j===i));}

$("#loginBtn").onclick=()=>$("#loginModal").classList.remove("hidden");
$("#closeLogin").onclick=()=>$("#loginModal").classList.add("hidden");
$("#loginForm").onsubmit=async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.target));const r=await api("/api/login","POST",body);if(r.error){$("#loginMsg").textContent=r.error;return}me=r.user;$("#loginModal").classList.add("hidden");openPanel();};
$("#logout").onclick=async()=>{await api("/api/logout","POST");location.reload()};

async function api(url,method="GET",body){const r=await fetch(url,{method,headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined});let x={};try{x=await r.json()}catch{}if(!r.ok)x.error=x.error||"Erro";return x}
async function openPanel(){ $("#panel").classList.remove("hidden"); $("#welcome").textContent=`Olá, ${me.name}`; renderTab("ponto"); }
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>renderTab(b.dataset.tab));

async function renderTab(tab){
 const c=$("#tabContent");
 if(tab==="ponto"){
  currentLog=await api("/api/time"); 
  c.innerHTML=`<div class="tab-body"><h2>Controle de ponto</h2><p class="small">Registre início, pausa, retorno e finalização da jornada.</p>
  <div class="item"><h1 id="clock">00:00:00</h1><p id="state">${currentLog?currentLog.status:"Nenhum ponto aberto"}</p>
  <div class="actions"><button class="btn" onclick="startTime()">Começar</button><button class="btn" onclick="pauseTime()">Pausar</button><button class="btn" onclick="resumeTime()">Retomar</button><button class="btn" onclick="finishTime()">Finalizar</button></div></div>
  ${["presidente","gerente_logistica"].includes(me.role)?'<div id="allTime" style="margin-top:25px"></div>':""}</div>`;
  updateClock(); if(timer)clearInterval(timer);timer=setInterval(updateClock,1000);
  if(["presidente","gerente_logistica"].includes(me.role))loadAllTime();
 }
 if(tab==="contratos"){
  const list=await api("/api/contracts"); const can=["presidente","diretor_comercial"].includes(me.role);
  c.innerHTML=`<div class="tab-body"><h2>Contratos e parceiros</h2>${can?`<form id="contractForm" class="form"><input name="title" placeholder="Nome do contrato" required><input name="company" placeholder="Empresa parceira" required><textarea name="description" placeholder="Descrição"></textarea><input name="link" placeholder="Link/documento (opcional)"><button class="btn">Cadastrar contrato</button></form><hr>`:""}<div class="grid-list">${list.map(x=>`<div class="item"><b>${esc(x.title)}</b><p><strong>${esc(x.company)}</strong></p><p>${esc(x.description||"")}</p>${x.link?`<a href="${esc(x.link)}" target="_blank">Abrir documento</a>`:""}</div>`).join("")||"<div class='empty'>Nenhum contrato cadastrado.</div>"}</div></div>`;
  if(can)$("#contractForm").onsubmit=async e=>{e.preventDefault();await api("/api/contracts","POST",Object.fromEntries(new FormData(e.target)));renderTab("contratos")};
 }
 if(tab==="precos"){
  const list=await api("/api/prices"); const can=["presidente","diretor_comercial"].includes(me.role);
  c.innerHTML=`<div class="tab-body"><h2>Tabela de preços</h2>${can?`<form id="priceForm" class="form"><input name="route" placeholder="Rota" required><input name="vehicle" placeholder="Tipo de veículo" required><input name="price" placeholder="Preço" required><input name="notes" placeholder="Observações"><button class="btn">Cadastrar preço</button></form><hr>`:""}<table class="table"><tr><th>Rota</th><th>Veículo</th><th>Preço</th><th>Obs.</th></tr>${list.map(x=>`<tr><td>${esc(x.route)}</td><td>${esc(x.vehicle)}</td><td>${esc(x.price)}</td><td>${esc(x.notes||"")}</td></tr>`).join("")||"<tr><td colspan='4'>Nenhum preço cadastrado.</td></tr>"}</table></div>`;
  if(can)$("#priceForm").onsubmit=async e=>{e.preventDefault();await api("/api/prices","POST",Object.fromEntries(new FormData(e.target)));renderTab("precos")};
 }
 if(tab==="ouvidoria"){
  if(!["presidente","diretor_comercial","gerente_logistica"].includes(me.role)){c.innerHTML='<div class="tab-body"><h2>Acesso restrito</h2><p>Somente Presidência, Diretoria Comercial e Gerência de Logística possuem acesso.</p></div>';return}
  const list=await api("/api/ombudsman");
  c.innerHTML=`<div class="tab-body"><h2>Ouvidoria</h2>${list.map(x=>`<div class="item" style="margin-bottom:12px"><b>${esc(x.name||"Anônimo")}</b><span class="small"> • ${esc(x.status)}</span><p>${esc(x.message)}</p><span class="small">${esc(x.email||"")}</span><br><button class="btn" onclick="changeOmb(${x.id})">Marcar como em análise</button></div>`).join("")||"<div class='empty'>Nenhuma manifestação.</div>"}</div>`;
 }
 if(tab==="admin"){
  if(me.role!=="presidente"){c.innerHTML='<div class="tab-body"><h2>Acesso restrito</h2><p>Apenas a Presidência pode gerenciar cargos e usuários.</p></div>';return}
  const users=await api("/api/users");
  c.innerHTML=`<div class="tab-body"><h2>Administração total</h2><p>Cadastre funcionários e defina cargos e acessos.</p><form id="userForm" class="form"><input name="name" placeholder="Nome" required><input name="email" type="email" placeholder="E-mail" required><input name="password" placeholder="Senha provisória" required><select name="role"><option value="funcionario">Funcionário</option><option value="gerente_logistica">Gerente de Logística</option><option value="diretor_comercial">Diretor Comercial</option><option value="presidente">Presidente</option></select><button class="btn">Criar usuário</button></form><hr><table class="table"><tr><th>Nome</th><th>E-mail</th><th>Cargo</th><th>Ação</th></tr>${users.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td><select onchange="setRole(${u.id},this.value)"><option ${u.role==="funcionario"?"selected":""} value="funcionario">Funcionário</option><option ${u.role==="gerente_logistica"?"selected":""} value="gerente_logistica">Gerente de Logística</option><option ${u.role==="diretor_comercial"?"selected":""} value="diretor_comercial">Diretor Comercial</option><option ${u.role==="presidente"?"selected":""} value="presidente">Presidente</option></select></td><td>${u.active?"Ativo":"Inativo"}</td></tr>`).join("")}</table></div>`;
  $("#userForm").onsubmit=async e=>{e.preventDefault();const r=await api("/api/users","POST",Object.fromEntries(new FormData(e.target)));if(r.error)alert(r.error);else renderTab("admin")};
 }
}

function updateClock(){const el=$("#clock");if(!el)return;let s=0;if(currentLog){s=currentLog.paused_seconds||0;if(currentLog.status==="running")s+=Math.max(0,Math.floor((Date.now()-new Date(currentLog.started_at).getTime())/1000));}el.textContent=fmt(s);$("#state").textContent=currentLog?currentLog.status:"Nenhum ponto aberto"}
function fmt(s){let h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return [h,m,x].map(v=>String(v).padStart(2,"0")).join(":")}
async function startTime(){const r=await api("/api/time/start","POST");if(r.error)alert(r.error);renderTab("ponto")}
async function pauseTime(){const r=await api("/api/time/pause","POST");if(r.error)alert(r.error);renderTab("ponto")}
async function resumeTime(){const r=await api("/api/time/resume","POST");if(r.error)alert(r.error);renderTab("ponto")}
async function finishTime(){const r=await api("/api/time/finish","POST");if(r.error)alert(r.error);renderTab("ponto")}
async function loadAllTime(){const x=await api("/api/time/all");const el=$("#allTime");if(!el)return;el.innerHTML=`<h3>Registros recentes</h3><table class="table"><tr><th>Funcionário</th><th>Início</th><th>Fim</th><th>Status</th></tr>${x.map(a=>`<tr><td>${esc(a.name)}</td><td>${new Date(a.started_at).toLocaleString()}</td><td>${a.finished_at?new Date(a.finished_at).toLocaleString():"—"}</td><td>${a.status}</td></tr>`).join("")}</table>`}
async function changeOmb(id){await api("/api/ombudsman/"+id,"PATCH",{status:"em análise"});renderTab("ouvidoria")}
async function setRole(id,role){const r=await api("/api/users/"+id,"PATCH",{role});if(r.error)alert(r.error)}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

$("#ombForm").onsubmit=async e=>{e.preventDefault();const r=await api("/api/ombudsman","POST",Object.fromEntries(new FormData(e.target)));$("#ombMsg").textContent=r.error||"Mensagem enviada com sucesso.";if(!r.error)e.target.reset()};
(async()=>{const r=await api("/api/me");if(r.user)me=r.user})();
