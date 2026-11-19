const canvas = document.querySelector("#game");
const gl = canvas.getContext("webgl2", { antialias: true, alpha: false });
if (!gl) {
  document.querySelector("#menu").innerHTML = "<h2>WebGL 2 is unavailable</h2><p>Please use a browser with WebGL 2 support.</p>";
  throw new Error("WebGL 2 is required");
}

const vertexSource = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
out vec3 vNormal;
out vec3 vWorld;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorld = world.xyz;
  vNormal = mat3(uModel) * aNormal;
  gl_Position = uProjection * uView * world;
}`;
const fragmentSource = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vWorld;
uniform vec3 uColor;
uniform vec3 uCamera;
out vec4 outColor;
void main() {
  vec3 n = normalize(vNormal);
  vec3 light = normalize(vec3(-0.45, 0.85, 0.35));
  float diffuse = max(dot(n, light), 0.0);
  float hemi = 0.35 + 0.25 * (n.y * 0.5 + 0.5);
  float fog = smoothstep(22.0, 43.0, distance(vWorld, uCamera));
  vec3 lit = uColor * (hemi + diffuse * 0.72);
  vec3 sky = vec3(0.035, 0.075, 0.11);
  outColor = vec4(mix(lit, sky, fog), 1.0);
}`;
function shader(type, source) {
  const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
const program = gl.createProgram();
gl.attachShader(program, shader(gl.VERTEX_SHADER, vertexSource));
gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentSource));
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
gl.useProgram(program);

const cube = [
 // positions and normals, six faces
 ...face([0,0,1],[1,0,0],[0,1,0]), ...face([0,0,-1],[-1,0,0],[0,1,0]),
 ...face([1,0,0],[0,0,-1],[0,1,0]), ...face([-1,0,0],[0,0,1],[0,1,0]),
 ...face([0,1,0],[1,0,0],[0,0,-1]), ...face([0,-1,0],[1,0,0],[0,0,1])
];
function face(n,u,v) {
  const c=n.map(x=>x*.5), a=u.map(x=>x*.5), b=v.map(x=>x*.5);
  const p1=add(add(c,a.map(x=>-x)),b.map(x=>-x)),p2=add(add(c,a),b.map(x=>-x)),p3=add(add(c,a),b),p4=add(add(c,a.map(x=>-x)),b);
  return [...p1,...n,...p2,...n,...p3,...n,...p1,...n,...p3,...n,...p4,...n];
}
function add(a,b){return a.map((v,i)=>v+b[i]);}
const vao=gl.createVertexArray();gl.bindVertexArray(vao);
const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(cube),gl.STATIC_DRAW);
const stride=24;
const pos=gl.getAttribLocation(program,"aPosition"),norm=gl.getAttribLocation(program,"aNormal");
gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,stride,0);
gl.enableVertexAttribArray(norm);gl.vertexAttribPointer(norm,3,gl.FLOAT,false,stride,12);
const loc={projection:gl.getUniformLocation(program,"uProjection"),view:gl.getUniformLocation(program,"uView"),model:gl.getUniformLocation(program,"uModel"),color:gl.getUniformLocation(program,"uColor"),camera:gl.getUniformLocation(program,"uCamera")};

function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);}
function lookAt(eye,center,up){const z=norm3(sub3(eye,center)),x=norm3(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
function sub3(a,b){return a.map((v,i)=>v-b[i]);}function dot(a,b){return a.reduce((s,v,i)=>s+v*b[i],0);}function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}function norm3(a){const l=Math.hypot(...a)||1;return a.map(v=>v/l);}
function modelMatrix(x,y,z,sx,sy,sz){return new Float32Array([sx,0,0,0,0,sy,0,0,0,0,sz,0,x,y,z,1]);}
function draw(x,y,z,sx,sy,sz,color){gl.uniformMatrix4fv(loc.model,false,modelMatrix(x,y,z,sx,sy,sz));gl.uniform3fv(loc.color,color);gl.drawArrays(gl.TRIANGLES,0,36);}
const COLORS={floor:[.12,.22,.25],wall:[.18,.29,.34],block:[.27,.36,.39],player:[.18,.82,.72],chaser:[.95,.29,.22],runner:[.28,.61,.95],pickup:[.96,.72,.24]};
const SIZE=24, HALF=SIZE/2;
let obstacles=[],bots=[],pickups=[],player={x:0,z:0,yaw:0,pitch:0,score:0};
let chasing=false,active=false,paused=false,remaining=120,last=0,elapsed=0,toastUntil=0;
const keys=new Set();
function seededMap(){
  obstacles=[];for(let x=-HALF+2;x<HALF-2;x++)for(let z=-HALF+2;z<HALF-2;z++){
    if(Math.random()<.085 && Math.hypot(x,z)>4 && Math.random()>.18)obstacles.push({x:x+.5,z:z+.5});
  }
  bots=Array.from({length:4},(_,i)=>({x:(i%2?1:-1)*(4+Math.random()*5),z:(i<2?-1:1)*(4+Math.random()*5),yaw:Math.random()*Math.PI*2,score:0,tagged:false}));
  pickups=Array.from({length:12},()=>({x:(Math.random()-.5)*19,z:(Math.random()-.5)*19,got:false}));
}
function collides(x,z,r=.34){if(Math.abs(x)>HALF-.65||Math.abs(z)>HALF-.65)return true;return obstacles.some(o=>Math.abs(x-o.x)<.78+r&&Math.abs(z-o.z)<.78+r);}
function moveEntity(e,dx,dz){if(!collides(e.x+dx,e.z))e.x+=dx;if(!collides(e.x,e.z+dz))e.z+=dz;}
function start(){seededMap();player={x:0,z:0,yaw:0,pitch:0,score:0};chasing=Math.random()>.5;remaining=120;elapsed=0;active=true;paused=false;document.querySelector("#menu").hidden=true;document.querySelector("#pause").hidden=true;document.querySelector("#hud").hidden=false;document.querySelector("#crosshair").hidden=false;canvas.requestPointerLock?.();say(chasing?"YOU ARE THE CHASER":"RUN — DON'T GET CAUGHT");last=performance.now();}
function say(message){const t=document.querySelector("#toast");t.textContent=message;toastUntil=performance.now()+1800;}
document.querySelector("#start").addEventListener("click",start);
document.querySelector("#resume").addEventListener("click",()=>{paused=false;document.querySelector("#pause").hidden=true;canvas.requestPointerLock?.();last=performance.now();});
document.querySelector("#restart").addEventListener("click",start);
document.addEventListener("keydown",e=>{keys.add(e.code);if(e.code==="Escape"&&active){paused=!paused;document.querySelector("#pause").hidden=!paused;if(paused)document.exitPointerLock?.();else canvas.requestPointerLock?.();}});
document.addEventListener("keyup",e=>keys.delete(e.code));
document.addEventListener("mousemove",e=>{if(document.pointerLockElement===canvas&&active&&!paused){player.yaw-=e.movementX*.0022;player.pitch=Math.max(-1.15,Math.min(1.15,player.pitch-e.movementY*.002));}});
canvas.addEventListener("click",()=>{if(active&&!paused)canvas.requestPointerLock?.();});
function update(dt){
 if(!active||paused)return;remaining=Math.max(0,remaining-dt);elapsed+=dt;
 const forward=(keys.has("KeyW")?1:0)-(keys.has("KeyS")?1:0),side=(keys.has("KeyD")?1:0)-(keys.has("KeyA")?1:0);
 const speed=keys.has("ShiftLeft")?7:4.5,mag=Math.hypot(forward,side)||1;
 const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw),rx=Math.cos(player.yaw),rz=-Math.sin(player.yaw);
 moveEntity(player,((fx*forward+rx*side)/mag)*speed*dt,((fz*forward+rz*side)/mag)*speed*dt);
 bots.forEach((b,i)=>{const dx=player.x-b.x,dz=player.z-b.z,d=Math.hypot(dx,dz)||1;let dir=chasing?1:-1;if(i===0&&chasing)dir=-1;const pace=2.1+((i%2)*.35);if(d<9){moveEntity(b,dx/d*pace*dt*dir,dz/d*pace*dt*dir);}else{b.yaw+=Math.sin(elapsed+i)*dt*.4;moveEntity(b,Math.sin(b.yaw)*pace*.35*dt,Math.cos(b.yaw)*pace*.35*dt);}if(d<.85){if(chasing){player.score+=2;chasing=false;say("TAG! YOU'RE A RUNNER");b.x=-b.x;b.z=-b.z;}else{player.score=Math.max(0,player.score-1);chasing=true;say("CAUGHT! YOU'RE THE CHASER");player.x=0;player.z=0;}}});
 pickups.forEach(p=>{if(!p.got&&Math.hypot(player.x-p.x,player.z-p.z)<.7){p.got=true;player.score+=1;say("+1 POINT");}});
 if(remaining===0){active=false;document.exitPointerLock?.();document.querySelector("#pause").hidden=false;document.querySelector("#pause h2").textContent="Time's up — score "+player.score;document.querySelector("#resume").hidden=true;}
 document.querySelector("#role").textContent=chasing?"CHASER":"RUNNER";document.querySelector("#role").style.color=chasing?"#ff796b":"#62e2cf";document.querySelector("#score").textContent=player.score;document.querySelector("#time").textContent=String(Math.floor(remaining/60)).padStart(2,"0")+":"+String(Math.floor(remaining%60)).padStart(2,"0");document.querySelector("#opponents").textContent=bots.length;
}
function render(){
 const dpr=Math.min(devicePixelRatio||1,2),w=Math.floor(canvas.clientWidth*dpr),h=Math.floor(canvas.clientHeight*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
 gl.enable(gl.DEPTH_TEST);gl.clearColor(.035,.075,.11,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 const eye=[player.x,1.15,player.z],cp=Math.cos(player.pitch),target=[player.x-Math.sin(player.yaw)*cp,1.15+Math.sin(player.pitch),player.z-Math.cos(player.yaw)*cp];
 gl.uniformMatrix4fv(loc.projection,false,perspective(Math.PI/3,w/h,.1,80));gl.uniformMatrix4fv(loc.view,false,lookAt(eye,target,[0,1,0]));gl.uniform3fv(loc.camera,eye);
 draw(0,-.58,0,SIZE,0.16,SIZE,COLORS.floor);
 for(let i=-HALF;i<HALF;i++){draw(i+.5,-.485,0,.012,.012,SIZE,[.2,.34,.36]);draw(0,-.484,i+.5,SIZE,.012,.012,[.2,.34,.36]);}
 draw(0,.5,-HALF, SIZE,2,.5,COLORS.wall);draw(0,.5,HALF,SIZE,2,.5,COLORS.wall);draw(-HALF,.5,0,.5,2,SIZE,COLORS.wall);draw(HALF,.5,0,.5,2,SIZE,COLORS.wall);
 obstacles.forEach(o=>draw(o.x,.35,o.z,.78,.85,.78,COLORS.block));
 pickups.forEach(p=>{if(!p.got){const pulse=.28+Math.sin(elapsed*4+p.x)*.035;draw(p.x,.12+Math.sin(elapsed*3+p.z)*.08,p.z,pulse,pulse,pulse,COLORS.pickup);}});
 bots.forEach((b,i)=>draw(b.x,.42,b.z,.38,.84,.38,i===0?COLORS.chaser:COLORS.runner));
 draw(player.x,.42,player.z,.38,.84,.38,chasing?COLORS.chaser:COLORS.player);
}
function loop(now){const dt=Math.min((now-last)/1000||0,.04);last=now;update(dt);render();if(performance.now()>toastUntil)document.querySelector("#toast").textContent="";requestAnimationFrame(loop);}
requestAnimationFrame(now=>{last=now;loop(now);});
window.addEventListener("resize",()=>{canvas.width=0;});
