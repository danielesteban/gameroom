const Room = require('./room');

class Game extends Room {
  constructor({ dimensions, players }) {
    super();
    this.dimensions = dimensions;
    const displaySize = dimensions.width * dimensions.height;
    this.displays = [...Array(players)].map(() => (
      Buffer.from([...Array(displaySize)])
    ));
    this.players = [...Array(players)].map(() => ({}));
    this.reset();
  }

  onAnimationTick() {
    const {
      clients,
      dimensions,
      displays,
      players,
    } = this;
    if (
      players.reduce((hasEnded, player, display) => {
        if (hasEnded || !player.client) {
          return hasEnded;
        }
        this.drawPiece({
          display,
          ...player,
          color: 0,
        });
        if (player.input.rotate) {
          this.updatePiece({
            display,
            player,
            update: {
              rotation: (player.rotation + 1) % 4,
            },
          });
          delete player.input.rotate;
        }
        if (player.input.move) {
          this.updatePiece({
            display,
            player,
            update: {
              position: {
                ...player.position,
                x: player.position.x + player.input.move,
              },
            },
          });
          delete player.input.move;
        }
        const canMove = this.updatePiece({
          display,
          player,
          update: {
            position: {
              ...player.position,
              y: player.position.y - 1,
            },
          },
        });
        this.drawPiece({
          display,
          ...player,
        });
        if (!canMove) {
          if (this.isOutOfBounds(player)) {
            hasEnded = true;
          } else {
            const height = Game.getPiece(player).length;
            const pixels = displays[display];
            for (let y = player.position.y + height - 1; y >= player.position.y; y -= 1) {
              let isWholeLine = true;
              for (let x = 0; x < dimensions.width; x += 1) {
                if (!pixels[(dimensions.width * y) + x]) {
                  isWholeLine = false;
                  break;
                }
              }
              if (isWholeLine) {
                for (let j = y; j < dimensions.height; j += 1) {
                  for (let x = 0; x < dimensions.width; x += 1) {
                    pixels[(dimensions.width * j) + x] = j < dimensions.height - 1 ? (
                      pixels[(dimensions.width * (j + 1)) + x]
                    ) : 0;
                  }
                }
              }
            }
            this.nextPiece(player);
          }
        }
        return hasEnded;
      }, false)
    ) {
      this.reset();
      players
        .filter(({ client }) => (!!client))
        .forEach((player) => {
          const client = clients[
            clients.findIndex(({ id }) => (id === player.client))
          ];
          delete client.player;
          delete player.client;
        });
    }
    this.broadcast({
      type: 'UPDATE',
      data: {
        displays: displays.map((display) => (
          display.toString('base64')
        )),
      },
    });
  }

  onClose(client) {
    super.onClose(client);
    const { players } = this;
    if (client.player !== undefined) {
      delete players[client.player].client;
      this.reset();
    }
  }

  onRequest(client, request) {
    super.onRequest(client, request);
    const { players } = this;
    switch (request.type) {
      case 'INPUT': {
        if (client.player === undefined) {
          const availableSlots = players
            .filter(({ client }) => (!client))
            .map((client, index) => (index));
          let availableSlot = availableSlots[0];
          if (
            client.lastAssignedSlot !== undefined
            && ~availableSlots.indexOf(client.lastAssignedSlot)
          ) {
            availableSlot = client.lastAssignedSlot;
          }
          if (availableSlot !== undefined) {
            client.lastAssignedSlot = availableSlot;
            client.player = availableSlot;
            players[availableSlot].client = client.id;
            this.reset();
          }
          return;
        }
        let { move, rotate } = request.data;
        move = parseInt(move, 10);
        rotate = parseInt(rotate, 10);
        if (!(
          Number.isNaN(move)
          || (
            move !== -1
            && move !== 1
          )
        )) {
          players[client.player].input.move = move;
        }
        if (!(
          Number.isNaN(rotate)
          || rotate !== 1
        )) {
          players[client.player].input.rotate = true;
        }
        break;
      }
      default:
        break;
    }
  }

  drawPiece({
    display,
    piece,
    position,
    rotation,
    color,
  }) {
    const { dimensions, displays } = this;
    Game.getPiece({ piece, rotation }).forEach((rows, y) => {
      y += position.y;
      rows.forEach((pixel, x) => {
        if (pixel) {
          x += position.x;
          displays[display][(dimensions.width * y) + x] = color;
        }
      });
    });
  }

  static getPiece({ piece, rotation }) {
    const { pieces } = Game;
    return pieces[piece][Math.min(rotation, pieces[piece].length - 1)];
  }

  isOutOfBounds({
    piece,
    position,
    rotation,
  }) {
    const { dimensions } = this;
    return Game.getPiece({ piece, rotation }).reduce((hit, rows, y) => {
      if (!hit) {
        y += position.y;
        hit = rows.reduce((hit, pixel) => {
          if (!hit && pixel) {
            if (y >= dimensions.height) {
              hit = true;
            }
          }
          return hit;
        }, false);
      }
      return hit;
    }, false);
  }

  testPiece({
    display,
    piece,
    position,
    rotation,
  }) {
    const { dimensions, displays } = this;
    return Game.getPiece({ piece, rotation }).reduce((hit, rows, y) => {
      if (!hit) {
        y += position.y;
        hit = rows.reduce((hit, pixel, x) => {
          if (!hit && pixel) {
            x += position.x;
            if (x < 0 || x >= dimensions.width || y < 0) {
              hit = true;
            } else if (y < dimensions.height) {
              hit = !!displays[display][(dimensions.width * y) + x];
            }
          }
          return hit;
        }, false);
      }
      return hit;
    }, false);
  }

  nextPiece(player) {
    const { dimensions } = this;
    const { getPiece, pieces } = Game;
    player.piece = Math.floor(Math.random() * pieces.length);
    player.rotation = Math.floor(Math.random() * 4);
    const width = getPiece(player).length;
    player.position = {
      x: Math.floor(Math.random() * (dimensions.width - width + 1)),
      y: dimensions.height,
    };
    player.color = 0xFF - Math.floor((player.piece * 220) / pieces.length);
  }

  updatePiece({ display, player, update }) {
    const canMove = !this.testPiece({
      display,
      ...player,
      ...update,
    });
    if (canMove) {
      Object.keys(update).forEach((key) => {
        player[key] = update[key];
      });
    }
    return canMove;
  }

  reset() {
    const { displays, players } = this;
    displays.forEach((display) => display.fill(0));
    players.forEach((player) => {
      player.input = {};
      this.nextPiece(player);
    });
    clearInterval(this.animationInterval);
    this.animationInterval = setInterval(this.onAnimationTick.bind(this), 150);
  }
}

Game.pieces = [
  // O
  [
    [
      [1, 1],
      [1, 1],
    ],
  ],
  // I
  [
    [
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
    ],
    [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  // L
  [
    [
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 1],
    ],
    [
      [0, 0, 0],
      [1, 1, 1],
      [1, 0, 0],
    ],
    [
      [1, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
    ],
    [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  ],
  // J
  [
    [
      [0, 1, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    [
      [0, 1, 1],
      [0, 1, 0],
      [0, 1, 0],
    ],
    [
      [0, 0, 0],
      [1, 1, 1],
      [0, 0, 1],
    ],
  ],
  // S
  [
    [
      [0, 0, 0],
      [0, 1, 1],
      [1, 1, 0],
    ],
    [
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
    [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    [
      [0, 1, 0],
      [0, 1, 1],
      [0, 0, 1],
    ],
  ],
  // Z
  [
    [
      [0, 0, 0],
      [1, 1, 0],
      [0, 1, 1],
    ],
    [
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
    [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
  ],
  // T
  [
    [
      [0, 0, 0],
      [1, 1, 1],
      [0, 1, 0],
    ],
    [
      [0, 1, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
    [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    [
      [0, 1, 0],
      [0, 1, 1],
      [0, 1, 0],
    ],
  ],
];

Game.pieces.forEach((rotations) => (
  rotations.forEach((piece) => piece.reverse())
));

module.exports = Game;
