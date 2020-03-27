import {
  BoxGeometry,
  BufferGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  ShaderLib,
  ShaderMaterial,
  UniformsUtils,
  VertexColors,
} from '../core/three.js';

// Instanced display

class Display extends InstancedMesh {
  static setupGeometry() {
    const pixel = new BoxGeometry(1, 1, 1, 1, 1, 1);
    pixel.faces.splice(10, 2);
    pixel.faces.forEach((face, i) => {
      if (i % 2 === 1) {
        face.color.setHSL(0, 0, i > 8 ? 1 : 0.5);
        pixel.faces[i - 1].color.copy(face.color);
      }
    });
    Display.geometry = (new BufferGeometry()).fromGeometry(pixel);
    delete Display.geometry.attributes.normal;
    delete Display.geometry.attributes.uv;
  }

  static setupMaterial() {
    const material = new ShaderMaterial({
      name: 'display-material',
      vertexColors: VertexColors,
      fragmentShader: ShaderLib.basic.fragmentShader
        .replace(
          '#include <common>',
          [
            'varying float vInstanceColor;',
            'const float ColorWheelStep = 1.0 / 3.0;',
            'vec3 ColorWheel( float pos ) {',
            '  vec3 color;',
            '  if (pos == 0.0) {',
            '    color = vec3( 0.17, 0.17, 0.17 );',
            '  } else if (pos >= 254.5) {',
            '    color = vec3( 1.0, 1.0, 1.0 );',
            '  } else {',
            '    pos = pos / 255.0;',
            '    if ( pos < ColorWheelStep ) {',
            '      color = vec3( pos * 3.0, 1.0 - pos * 3.0, 0.0 );',
            '    } else if( pos < ColorWheelStep * 2.0 ) {',
            '      pos -= ColorWheelStep;',
            '      color = vec3( 1.0 - pos * 3.0, 0.0, pos * 3.0 );',
            '    } else {',
            '      pos -= ColorWheelStep * 2.0;',
            '      color = vec3( 0.0, pos * 3.0, 1.0 - pos * 3.0 );',
            '    }',
            '    color += vec3(ColorWheelStep);',
            '  }',
            '  color.r = pow(color.r, 2.2);',
            '  color.g = pow(color.g, 2.2);',
            '  color.b = pow(color.b, 2.2);',
            '  return color;',
            '}',
            '#include <common>',
          ].join('\n')
        )
        .replace(
          'vec4 diffuseColor = vec4( diffuse, opacity );',
          'vec4 diffuseColor = vec4( diffuse * ColorWheel(vInstanceColor), opacity );'
        ),
      vertexShader: ShaderLib.basic.vertexShader
        .replace(
          '#include <common>',
          [
            'attribute float instanceColor;',
            'varying float vInstanceColor;',
            '#include <common>',
          ].join('\n')
        )
        .replace(
          '#include <begin_vertex>',
          [
            '#include <begin_vertex>',
            'vInstanceColor = instanceColor;',
          ].join('\n')
        ),
      uniforms: UniformsUtils.clone(ShaderLib.basic.uniforms),
    });
    Display.material = material;
    Display.intersectMaterial = new MeshBasicMaterial({
      visible: false,
    });
  }

  constructor({
    width,
    height,
    resolution = 1,
    offset = 0,
  }) {
    if (!Display.geometry) {
      Display.setupGeometry();
    }
    if (!Display.material) {
      Display.setupMaterial();
    }
    const count = (width * resolution) * (height * resolution);
    const geometry = Display.geometry.clone();
    geometry.setAttribute('instanceColor', new InstancedBufferAttribute(new Float32Array(count), 1));
    super(
      geometry,
      Display.material,
      count
    );
    const size = {
      x: width - (offset * 2),
      y: height - (offset * 2),
    };
    this.pixels = {
      x: width * resolution,
      y: height * resolution,
    };
    const step = {
      x: size.x / this.pixels.x,
      y: size.y / this.pixels.y,
    };
    const origin = {
      x: size.x * -0.5 + step.x * 0.5,
      y: size.y * -0.5 + step.y * 0.5,
    };
    const pixel = new Object3D();
    pixel.scale.set(step.x * 0.75, step.y * 0.75, 0.05);
    for (let i = 0, y = 0; y < this.pixels.y; y += 1) {
      for (let x = 0; x < this.pixels.x; x += 1, i += 1) {
        pixel.position.set(
          origin.x + x * step.x,
          origin.y + y * step.y,
          0
        );
        pixel.updateMatrix();
        this.setMatrixAt(i, pixel.matrix);
      }
    }
    this.position.set(0, 0, 0.025);
  }

  dispose() {
    const { geometry } = this;
    geometry.dispose();
  }

  update(state) {
    const { geometry } = this;
    const instances = geometry.getAttribute('instanceColor');
    state = atob(state);
    for (let i = 0; i < instances.count; i += 1) {
      instances.array[i] = state.charCodeAt(i);
    }
    instances.needsUpdate = true;
  }
}

export default Display;
