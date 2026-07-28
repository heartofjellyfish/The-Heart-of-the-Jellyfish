/**
 * Fragment shader for the Medusa route — the whole ocean is one full-screen triangle.
 *
 * Unlike OceanScene (real geometry, real models), Medusa paints everything
 * procedurally: palette by depth, god rays, marine snow, bioluminescence, and
 * the jellyfish itself as a signed-distance-ish blob. Ported verbatim from the
 * `Medusa.dc.html` design so the look stays byte-identical to what was approved.
 *
 * Uniforms:
 *   uR  canvas resolution in device pixels
 *   uT  seconds since load, scaled by the `motion` prop
 *   uD  scroll depth 0..1 over the whole document — drives the palette
 *   uM  eased mouse position 0..1 (y flipped), parallaxes the rays and the jelly
 */

export const MEDUSA_VS = 'attribute vec2 aP;void main(){gl_Position=vec4(aP,0.,1.);}';

export const MEDUSA_FS = `precision mediump float;
uniform vec2 uR;uniform float uT;uniform float uD;uniform vec2 uM;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
float a=h21(i),b=h21(i+vec2(1.,0.)),c=h21(i+vec2(0.,1.)),d=h21(i+vec2(1.,1.));
return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n2(p);p*=2.03;a*=.5;}return v;}
vec3 pal(float t){
vec3 c0=vec3(.66,.82,.90),c1=vec3(.20,.50,.70),c2=vec3(.05,.24,.38),c3=vec3(.015,.09,.16),c4=vec3(.006,.035,.07);
vec3 c=mix(c0,c1,smoothstep(0.,.25,t));
c=mix(c,c2,smoothstep(.25,.5,t));
c=mix(c,c3,smoothstep(.5,.75,t));
c=mix(c,c4,smoothstep(.75,.95,t));
return c;}
void main(){
vec2 uv=gl_FragCoord.xy/uR;
float asp=uR.x/uR.y;
float d=uD;
float ld=clamp(d+(1.-uv.y)*.07,0.,1.);
vec3 col=pal(ld);
float flash=smoothstep(.43,.485,d)*(1.-smoothstep(.505,.56,d));
float rayStr=(1.-smoothstep(.05,.42,d))*.85+flash*1.3;
float ang=(uv.x-.5)*(7.-2.*uv.y)+(uM.x-.5)*.6;
float rays=pow(abs(sin(ang*6.+uT*.10+sin(ang*2.6-uT*.07)*1.4)),5.);
col+=rays*rayStr*pow(uv.y,1.6)*vec3(.22,.30,.33);
float ca=fbm(uv*vec2(asp,1.)*5.+vec2(uT*.05,uT*.028));
col+=rayStr*smoothstep(.55,.95,ca)*vec3(.09,.13,.14);
vec2 pp=uv*vec2(asp,1.)*26.;pp.y+=uT*.42+d*36.;
vec2 id=floor(pp);float pr=h21(id);vec2 pf=fract(pp)-.5;
float star=smoothstep(.11,.0,length(pf+vec2(sin(uT*.8+pr*7.)*.18,0.)))*step(.93,pr);
col+=star*(.22+.22*sin(uT*2.+pr*20.))*vec3(.55,.75,.8);
float bio=smoothstep(.5,.72,d)*(1.-smoothstep(.88,.98,d));
if(bio>0.){vec2 bp=uv*vec2(asp,1.)*14.;bp.y+=uT*.2+d*20.;
vec2 bid=floor(bp);float br=h21(bid+7.);vec2 bf=fract(bp)-.5;
float tw=max(sin(uT*(1.+br)+br*40.),0.);
float dot2=exp(-pow(length(bf+vec2(sin(uT*.5+br*9.)*.25,cos(uT*.4+br*5.)*.2))*9.,2.));
col+=dot2*step(.9,br)*tw*bio*vec3(.35,.85,.9)*.9;}
vec2 jp=vec2(.5+.22*sin(uT*.045+1.7),.55+.08*sin(uT*.037));
jp+=(uM-jp)*.10;
jp.y+=.012*sin(uT*1.05+.7);
vec2 q=(uv-jp)*vec2(asp,1.);
float pulse=sin(uT*1.05);
float sz=.125;
float rx=sz*(1.-.05*pulse),ry=sz*(.66+.09*pulse);
vec2 qe=vec2(q.x/rx,q.y/ry);
float dd=length(qe);
float aa=atan(qe.y,qe.x);
float body=smoothstep(1.06,.98,dd)*(.09+.28*pow(min(dd,1.),3.));
float rim=exp(-pow((dd-1.)*10.,2.))*.8;
float ribs=(.5+.5*sin(aa*18.+.4*sin(uT*.3)))*smoothstep(.45,1.,dd)*smoothstep(1.06,.9,dd)*.16;
float gon=0.;
for(int i=0;i<4;i++){float fi=float(i)*1.5708+.785;
vec2 go=vec2(cos(fi),sin(fi)*.62)*sz*.30;
gon+=exp(-pow(length(q-vec2(0.,sz*.05)-go)/(sz*.15),2.));}
gon=min(gon,1.)*smoothstep(1.,.8,dd)*.55;
float belowMask=smoothstep(.02,-.02,q.y)*(1.-smoothstep(ry*1.1,ry*3.6,-q.y));
float swayf=sin(uT*1.2-q.y*9.)*.05*clamp(-q.y/sz,0.,3.);
float fr=pow(abs(sin((q.x/sz+swayf)*15.)),6.)*belowMask*smoothstep(rx*1.15,rx*.85,abs(q.x))*.45;
float arms=0.;
for(int i=0;i<4;i++){float fi=float(i)-1.5;
float bx=fi*sz*.15;
float cx=bx+sin(q.y*13.-uT*1.5+fi*1.9)*sz*.10*clamp(-q.y/sz,0.,2.5);
float w=exp(-pow((q.x-cx)/(sz*.05),2.));
float m=smoothstep(.01,-.02,q.y)*(1.-smoothstep(ry*1.8,ry*4.6,-q.y));
arms+=w*m;}
arms*=.5;
float glow=exp(-length(q)/(sz*2.2))*.18;
float jvis=(smoothstep(.06,.28,d)*(1.-smoothstep(.80,.93,d)))*.95+.05;
vec3 jbase=mix(vec3(.86,.94,.97),vec3(.62,.88,.95),smoothstep(.3,.7,d));
vec3 jpink=vec3(.95,.78,.82);
col+=(body+rim+ribs+fr+arms)*jbase*jvis*.85+gon*jpink*jvis*.8+glow*jbase*jvis;
float dawn=smoothstep(.875,1.,d);
vec3 dawnCol=mix(vec3(.93,.86,.72),mix(vec3(.96,.90,.78),vec3(.62,.80,.88),uv.y),.9);
col=mix(col,dawnCol,dawn);
col+=flash*vec3(.85,.92,.97)*pow(uv.y,1.2)*.55;
col*=1.-.32*pow(length(uv-.5),1.9);
col+=(h21(uv*uR+fract(uT)*61.7)-.5)*.045;
gl_FragColor=vec4(col,1.);}`;

/** Static gradient stand-in when WebGL is unavailable — surface → abyss → dawn. */
export const MEDUSA_NO_GL_GRADIENT =
  'linear-gradient(180deg,#7fb3cd,#1d5a82 30%,#0a2a44 62%,#0d3550 78%,#7fb0c8 90%,#f0e6d2 100%)';
