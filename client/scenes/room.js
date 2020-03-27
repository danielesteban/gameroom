import Scene from '../core/scene.js';
import Translocable from '../core/translocable.js';
import Wall from '../renderables/wall.js';
import Display from '../renderables/display.js';

class Room extends Scene {
  constructor(renderer) {
    super(renderer);
    const { width, length, height } = Room.dimensions;

    const floor = new Wall({ width, height: length, light: 0.6 });
    floor.rotation.set(Math.PI * -0.5, 0, 0);
    this.add(floor);
    const ceiling = new Wall({ width, height: length, light: 0.5 });
    ceiling.position.set(0, height, 0);
    ceiling.rotation.set(Math.PI * 0.5, 0, 0);
    this.add(ceiling);

    this.displays = [];
    [
      [width, 0, length * -0.5, 1],
      [length, width * 0.5, 0, 0.4],
      [width, 0, length * 0.5, 0.3],
      [length, width * -0.5, 0, 0.4],
    ]
      .forEach(([width, x, z, light], i) => {
        const wall = new Wall({ width, height, light });
        wall.position.set(x, height * 0.5, z);
        wall.lookAt(0, height * 0.5, 0);
        this.add(wall);
        if (i === 0) {
          const players = 4;
          const w = width - 1;
          const size = w / players;
          const offset = (w * -0.5) + (size * 0.5);
          [...Array(players)].forEach((v, i) => {
            const display = new Display({ width: 2, height: 4, resolution: 5 });
            display.position.x = offset + (size * i);
            this.displays.push(display);
            wall.add(display);
          });
        }
      });

    const translocable = new Translocable({ width, length, offset: 0.25 });
    this.translocables.push(translocable);
    this.add(translocable);

    this.player.position.set(
      Math.floor(Math.random() * 4) - 2,
      0,
      Math.floor(Math.random() * 4) - 2
    );
  }

  onBeforeRender(renderer, scene, camera) {
    const { player, server } = this;
    super.onBeforeRender(renderer, scene, camera);
    player.controllers.forEach((controller) => {
      const {
        buttons: {
          leftwardsDown,
          rightwardsDown,
          triggerDown,
        },
        hand,
      } = controller;
      if (!hand) {
        return;
      }
      if (
        hand.handedness === 'right'
        && (leftwardsDown || rightwardsDown || triggerDown)
      ) {
        let move;
        if (leftwardsDown) {
          move = -1;
        }
        if (rightwardsDown) {
          move = 1;
        }
        let rotate;
        if (triggerDown) {
          rotate = 1;
        }
        server.send(JSON.stringify({
          type: 'INPUT',
          data: {
            move,
            rotate,
          },
        }));
      }
    });
  }

  onEvent(event) {
    super.onEvent(event);
    const { displays } = this;
    const { type, data } = event;
    switch (type) {
      case 'UPDATE':
        data.displays.forEach((state, display) => (
          displays[display].update(state)
        ));
        break;
      default:
        break;
    }
  }
}

Room.dimensions = {
  width: 10,
  length: 10,
  height: 5,
};

export default Room;
