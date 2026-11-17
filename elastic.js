// A spring-driven textured mesh. No copied Elastic Man code or assets.
export class ElasticFace {
  constructor(canvas, { onPull = () => {}, isCalm = () => false, onReady = () => {} } = {}) {
    this.canvas = canvas; this.onPull = onPull; this.isCalm = isCalm;
    this.playing = false; this.busy = false; this.pulse = 0; this.points = []; this.drag = null;
    this.gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
    this.image = new Image();
    this.image.onload = () => {
      this.loaded = true;
      try {
        // Embedded artwork avoids file-origin texture restrictions on double-click.
        this.textureSource = document.createElement('canvas'); this.textureSource.width=1024;this.textureSource.height=1024;
        this.textureSource.getContext('2d').drawImage(this.image,0,0,1024,1024);
        if (this.gl) this.setupGL(); onReady();
      } catch {
        // Keep the face visible even when a device cannot upload a WebGL texture.
        this.gl=null;this.canvas.style.background=`url('${this.image.src}') center / 86% no-repeat`;onReady();
      }
    };
    this.image.onerror = () => { this.failed = true; onReady(new Error('Head image could not load')); };
    this.image.src = HEAD_DATA_URI;
    this.resize = () => { const rect = canvas.getBoundingClientRect(); const dpr = Math.min(devicePixelRatio || 1, 1.5); canvas.width = Math.round(rect.width*dpr); canvas.height = Math.round(rect.height*dpr); if (this.gl) this.gl.viewport(0,0,canvas.width,canvas.height); };
    this.observer = new ResizeObserver(this.resize); this.observer.observe(canvas);
    const n = this.n = 24;
    for (let y=0;y<=n;y++) for (let x=0;x<=n;x++) this.points.push({bx:x/n,by:y/n,x:x/n,y:y/n,vx:0,vy:0});
    this.indices = [];
    for (let y=0;y<n;y++) for (let x=0;x<n;x++) { const a=y*(n+1)+x,b=a+1,c=a+n+1,d=c+1; this.indices.push(a,b,c,b,d,c); }
    canvas.addEventListener('pointerdown', e => {
      const p=this.pointer(e); if (Math.hypot((p.x-.5)/.48,(p.y-.5)/.48)>1) return;
      this.drag = {x:p.x,y:p.y,tx:p.x,ty:p.y}; canvas.setPointerCapture(e.pointerId); this.onPull(0,p);
    });
    canvas.addEventListener('pointermove', e => { if(!this.drag)return; const p=this.pointer(e);this.drag.tx=p.x;this.drag.ty=p.y;const force=Math.hypot(p.x-this.drag.x,p.y-this.drag.y);if(force>.14 && !this.drag.popped){this.onPull(force,p);this.drag.popped=true;} });
    const release = () => { this.drag=null; };
    canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release); canvas.addEventListener('lostpointercapture', release);
    canvas.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();this.squish();this.onPull(.3,{x:.5,y:.5});}});
    this.frame = requestAnimationFrame(t=>this.animate(t));
  }
  pointer(e){const r=this.canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};}
  squish(){this.pulse=1;for(const p of this.points){p.vx+=(p.bx-.5)*.05;p.vy-=(p.by-.5)*.04;}}
  setupGL(){
    const gl=this.gl;
    const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;};
    const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,'attribute vec2 a_position; attribute vec2 a_uv; varying vec2 v_uv; void main(){v_uv=a_uv;gl_Position=vec4(a_position.x*2.0-1.0,1.0-a_position.y*2.0,0.0,1.0);}'));
    gl.attachShader(program,compile(gl.FRAGMENT_SHADER,'precision mediump float; varying vec2 v_uv; uniform sampler2D u_texture; void main(){gl_FragColor=texture2D(u_texture,v_uv);}'));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);
    this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    for(const [name,offset] of [['a_position',0],['a_uv',8]]){const location=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,16,offset);}
    const indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(this.indices),gl.STATIC_DRAW);
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.textureSource);gl.uniform1i(gl.getUniformLocation(program,'u_texture'),0);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
    this.vertices = new Float32Array(this.points.length*4); this.resize();
  }
  animate(t){
    const calm=this.isCalm(), dt=Math.min((t-(this.last||t))/16.667,2);this.last=t;
    this.pulse*=.92;
    for(let i=0;i<this.points.length;i++){
      const p=this.points[i];let tx=p.bx,ty=p.by;
      if(this.drag){let dx=this.drag.tx-this.drag.x,dy=this.drag.ty-this.drag.y;const d=Math.hypot(dx,dy);if(d>.48){dx*=.48/d;dy*=.48/d;}const influence=Math.exp(-((p.bx-this.drag.x)**2+(p.by-this.drag.y)**2)/.035);tx+=dx*influence;ty+=dy*influence;}
      if(!calm){const rim=Math.sin(p.by*Math.PI)*Math.sin(p.bx*Math.PI);tx+=Math.sin(t*.0017+p.by*5)*.003*rim;ty+=Math.cos(t*.0014+p.bx*4)*.004*rim;if(this.playing||this.busy){const mouth=Math.exp(-((p.bx-.5)**2/.035+(p.by-.68)**2/.018));const chatter=(Math.sin(t*.027)+Math.sin(t*.043))*.014;ty+=mouth*chatter;tx+=(p.bx-.5)*mouth*Math.abs(chatter);}}
      p.vx=(p.vx+(tx-p.x)*.13*dt)*Math.pow(.78,dt);p.vy=(p.vy+(ty-p.y)*.13*dt)*Math.pow(.78,dt);p.x+=p.vx*dt;p.y+=p.vy*dt;
      if(this.vertices){this.vertices[i*4]=.07+p.x*.86;this.vertices[i*4+1]=.07+p.y*.86;this.vertices[i*4+2]=p.bx;this.vertices[i*4+3]=p.by;}
    }
    if(this.loaded&&this.gl&&this.vertices){const gl=this.gl;gl.clear(gl.COLOR_BUFFER_BIT);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.vertices,gl.DYNAMIC_DRAW);gl.drawElements(gl.TRIANGLES,this.indices.length,gl.UNSIGNED_SHORT,0);}
    else if(this.loaded&&!this.gl){this.canvas.style.background=`url('${this.image.src}') center / 86% no-repeat`;this.canvas.style.transform=`scale(${1+this.pulse*.1},${1-this.pulse*.1})`;}
    this.frame=requestAnimationFrame(time=>this.animate(time));
  }
}
